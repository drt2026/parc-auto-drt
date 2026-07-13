/* ==========================================================================
   BLOC ADDITIF — Import Excel "Parc Auto DRT Sfax" (onglet Parc Véhicules)
   ==========================================================================
   Principe : identique aux autres modules additifs (Scanner BL, CSC…) — on
   ne touche à AUCUNE logique existante de #vehicle-form ni du reste de
   l'application. Ce module ajoute juste un bouton "📥 Importer Parc Excel"
   dans l'onglet Parc Véhicules, lit le fichier "Parc_AUTO_DRT_SFAX_2026.xlsx",
   affiche un écran de vérification, puis — pour chaque véhicule coché —
   REMPLIT le vrai formulaire #vehicle-form et déclenche son submit normal.
   Aucune autre logique/onglet n'est modifié.

   Format attendu (colonnes du fichier "Parc_AUTO_DRT_SFAX_2026.xlsx") :
     N° | N° IMMAT | Marque | Energie | GENRE | Mise en SC | PCE | Nb Place |
     Division | subdivision | Central/CSC/ROC/Unité | Prénom | Nom

   Mapping vers #vehicle-form :
     N° IMMAT          → Matricule (préfixé "17-", format du parc DRT Sfax)
     Marque             → Modèle
     Energie            → Énergie (Gasoil / Gasoil sans soufre → Diesel,
                          Super sans plomb → Essence)
     GENRE              → Genre
     Mise en SC         → Date 1ère mise en circulation
     Division           → Division
     Prénom + Nom       → Chauffeur

   Colonnes SANS champ correspondant dans le profil véhicule actuel — donc
   volontairement NON importées (sur demande explicite : import simple,
   aucune modification du reste de l'application) : PCE, Nb Place,
   subdivision, Central/CSC/ROC/Unité.

   Kilométrage actuel : absent du fichier source alors qu'il est obligatoire
   dans #vehicle-form → mis à 0 par défaut, éditable ligne par ligne avant
   import (à corriger manuellement ensuite).

   Doublons : un matricule du fichier déjà présent dans le Parc Véhicules
   actuel est automatiquement décoché et ignoré à l'import (jamais de
   doublon créé), avec un rapport récapitulatif à l'écran.
   ========================================================================== */
(function () {
  'use strict';

  var NAVY = '#1E3A5F', ORANGE = '#EF6C00';

  function el(id) { return document.getElementById(id); }

  var ENERGIE_MAP = {
    'gasoil': 'Diesel',
    'gasoil sans soufre': 'Diesel',
    'super sans plomb': 'Essence',
    'essence': 'Essence',
    'electrique': 'Électrique',
    'électrique': 'Électrique',
    'hybride': 'Hybride',
    'gpl': 'GPL'
  };
  function mapEnergie(raw) {
    if (!raw) return '';
    var key = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
    return ENERGIE_MAP[key] || '';
  }

  function excelDateToISO(val) {
    if (!val) return '';
    if (val instanceof Date && !isNaN(val)) {
      var y = val.getFullYear(), m = String(val.getMonth() + 1).padStart(2, '0'), d = String(val.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + d;
    }
    if (typeof val === 'number') {
      // Numéro de série Excel (jours depuis 1899-12-30)
      var epoch = new Date(Date.UTC(1899, 11, 30));
      var dt = new Date(epoch.getTime() + val * 86400000);
      return dt.toISOString().slice(0, 10);
    }
    var s = String(val).trim();
    var m2 = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m2) {
      var yy = m2[3].length === 2 ? '20' + m2[3] : m2[3];
      return yy + '-' + m2[2].padStart(2, '0') + '-' + m2[1].padStart(2, '0');
    }
    return '';
  }

  function normalizeMatricule(m) {
    return String(m || '').replace(/\s+/g, '').toUpperCase();
  }

  /* ─────────────── Matricules déjà présents dans le Parc Véhicules ────── */
  function getExistingMatricules() {
    var set = {};
    var tbody = el('vehicles-table-body');
    if (!tbody) return set;
    tbody.querySelectorAll('tr').forEach(function (tr) {
      var firstTd = tr.querySelector('td');
      if (firstTd) set[normalizeMatricule(firstTd.textContent)] = true;
    });
    return set;
  }

  /* ─────────────── Parsing du fichier Excel ────────────────────────── */
  function parseParcExcel(workbook) {
    var sheetName = workbook.SheetNames.find(function (n) { return /parc|feuil/i.test(n); }) || workbook.SheetNames[0];
    var ws = workbook.Sheets[sheetName];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

    var headerRowIdx = -1, headerRow = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].some(function (c) { return typeof c === 'string' && /immat/i.test(c); })) {
        headerRowIdx = i; headerRow = rows[i]; break;
      }
    }
    if (headerRowIdx === -1) return { error: 'En-tête "N° IMMAT" introuvable dans le fichier.' };

    var col = {};
    headerRow.forEach(function (h, idx) {
      if (h === null || h === undefined) return;
      var key = String(h).trim();
      if (/immat/i.test(key)) col.immat = idx;
      else if (/marque/i.test(key)) col.marque = idx;
      else if (/energie|énergie/i.test(key)) col.energie = idx;
      else if (/^genre$/i.test(key)) col.genre = idx;
      else if (/mise\s*en\s*s\.?c/i.test(key)) col.dateMiseEnSC = idx;
      else if (/^division$/i.test(key)) col.division = idx;
      else if (/pr[ée]nom/i.test(key)) col.prenom = idx;
      else if (/^nom$/i.test(key)) col.nom = idx;
    });
    if (col.immat === undefined) return { error: 'Colonne "N° IMMAT" introuvable.' };

    var existing = getExistingMatricules();
    var out = [];
    for (var r = headerRowIdx + 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || row[col.immat] === null || row[col.immat] === undefined || String(row[col.immat]).trim() === '') continue;
      var matricule = '17-' + String(row[col.immat]).trim();
      var prenom = col.prenom !== undefined ? (row[col.prenom] || '') : '';
      var nom = col.nom !== undefined ? (row[col.nom] || '') : '';
      var chauffeur = (String(prenom).trim() + ' ' + String(nom).trim()).trim();
      var energieRaw = col.energie !== undefined ? row[col.energie] : null;

      out.push({
        matricule: matricule,
        modele: col.marque !== undefined ? (row[col.marque] || '') : '',
        genre: col.genre !== undefined ? (row[col.genre] || '') : '',
        energieRaw: energieRaw,
        energie: mapEnergie(energieRaw),
        dateCirculation: col.dateMiseEnSC !== undefined ? excelDateToISO(row[col.dateMiseEnSC]) : '',
        division: col.division !== undefined ? (String(row[col.division] || '').trim()) : '',
        chauffeur: chauffeur,
        km: 0,
        dejaExistant: !!existing[normalizeMatricule(matricule)],
        include: !existing[normalizeMatricule(matricule)]
      });
    }
    return { vehicules: out };
  }

  /* ─────────────── OCR non nécessaire ici — juste XLSX ────────────── */
  function ensureXLSX(cb) {
    if (window.XLSX) { cb(); return; }
    setStatus('❌ Librairie XLSX non disponible (rechargez la page).', 'error');
  }

  function handleParcImportFile(event) {
    var file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    setStatus('⏳ Lecture du fichier…', 'info');
    ensureXLSX(function () {
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
          var res = parseParcExcel(wb);
          if (res.error) { setStatus('❌ ' + res.error, 'error'); return; }
          renderReview(res.vehicules);
        } catch (err) {
          console.error('[Parc Import] Erreur:', err);
          setStatus('❌ Erreur lors de la lecture du fichier : ' + err.message, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }
  window.handleParcImportFile = handleParcImportFile;

  /* ─────────────── Interface (modal) ──────────────────────────────── */
  function injectStylesAndModal() {
    if (el('parc-import-modal')) return;

    var style = document.createElement('style');
    style.textContent =
      '.parc-import-overlay{display:none;position:fixed;inset:0;z-index:9998;background:rgba(15,23,42,0.55);align-items:center;justify-content:center;padding:16px;}' +
      '.parc-import-overlay.open{display:flex;}' +
      '.parc-import-modal{background:#fff;border-radius:16px;width:min(1080px,97vw);max-height:92vh;overflow:auto;box-shadow:0 24px 64px rgba(0,0,0,0.25);}' +
      '.parc-import-header{background:' + NAVY + ';color:#fff;padding:18px 22px;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center;}' +
      '.parc-import-header h3{margin:0;font-size:16px;font-weight:800;}' +
      '.parc-import-close{background:transparent;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;}' +
      '.parc-import-body{padding:20px 22px;}' +
      '.parc-import-status{font-size:13px;padding:10px 12px;border-radius:8px;margin-bottom:14px;}' +
      '.parc-import-table{width:100%;border-collapse:collapse;font-size:12.5px;}' +
      '.parc-import-table th{background:#f1f5f9;color:#334155;text-align:left;padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;}' +
      '.parc-import-table td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;}' +
      '.parc-import-table input[type=text],.parc-import-table input[type=number],.parc-import-table select{width:100%;padding:5px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:12.5px;}' +
      '.parc-import-badge-new{background:#f0fdf4;color:#166534;border:1px solid #86efac;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;}' +
      '.parc-import-badge-dup{background:#fef2f2;color:#991b1b;border:1px solid #fca5a5;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;}' +
      '.parc-import-summary{background:#fff7ed;border:1px solid ' + ORANGE + ';color:#9a3412;padding:8px 12px;border-radius:8px;font-size:12.5px;font-weight:700;margin:12px 0;}' +
      '.parc-import-actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;}' +
      '.parc-import-btn{padding:10px 18px;border-radius:8px;border:none;font-weight:700;font-size:13px;cursor:pointer;}' +
      '.parc-import-btn-primary{background:' + ORANGE + ';color:#fff;}' +
      '.parc-import-btn-secondary{background:#f1f5f9;color:#334155;}';
    document.head.appendChild(style);

    var overlay = document.createElement('div');
    overlay.className = 'parc-import-overlay';
    overlay.id = 'parc-import-modal';
    overlay.innerHTML =
      '<div class="parc-import-modal">' +
        '<div class="parc-import-header"><h3>📥 Importer le Parc Auto (Excel)</h3><button class="parc-import-close" id="parc-import-close-btn">&times;</button></div>' +
        '<div class="parc-import-body">' +
          '<div class="parc-import-status" id="parc-import-status" style="display:none;"></div>' +
          '<p style="font-size:12px;color:#64748b;margin-bottom:10px;">Les véhicules déjà présents dans le Parc (matricule identique) sont automatiquement décochés — aucun doublon ne sera créé. Le kilométrage n\'étant pas dans le fichier, il est à 0 par défaut : à corriger avant ou après import.</p>' +
          '<div style="overflow-x:auto;">' +
            '<table class="parc-import-table">' +
              '<thead><tr><th></th><th>Statut</th><th>Matricule</th><th>Modèle</th><th>Énergie</th><th>Genre</th><th>Division</th><th>Chauffeur</th><th>KM *</th></tr></thead>' +
              '<tbody id="parc-import-table-body"></tbody>' +
            '</table>' +
          '</div>' +
          '<div class="parc-import-summary" id="parc-import-summary"></div>' +
          '<div class="parc-import-actions">' +
            '<button class="parc-import-btn parc-import-btn-primary" id="parc-import-btn">✅ Importer les véhicules cochés</button>' +
            '<button class="parc-import-btn parc-import-btn-secondary" id="parc-import-cancel-btn">Annuler</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    el('parc-import-close-btn').addEventListener('click', closeParcImportModal);
    el('parc-import-cancel-btn').addEventListener('click', closeParcImportModal);
  }

  function setStatus(text, type) {
    var box = el('parc-import-status');
    if (!box) return;
    if (!text) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    if (type === 'success') { box.style.background = '#f0fdf4'; box.style.color = '#065f46'; box.style.border = '1px solid #10b981'; }
    else if (type === 'error') { box.style.background = '#fef2f2'; box.style.color = '#991b1b'; box.style.border = '1px solid #ef4444'; }
    else { box.style.background = '#eff6ff'; box.style.color = '#1e40af'; box.style.border = '1px solid #bfdbfe'; }
    box.textContent = text;
  }

  var currentVehicules = null;
  var ENERGIE_OPTIONS = ['', 'Diesel', 'Essence', 'Électrique', 'Hybride', 'GPL'];

  function renderReview(vehicules) {
    currentVehicules = vehicules;
    injectStylesAndModal();
    el('parc-import-modal').classList.add('open');

    var tbody = el('parc-import-table-body');
    tbody.innerHTML = vehicules.map(function (v, idx) {
      return '<tr>' +
        '<td><input type="checkbox" data-idx="' + idx + '" class="parc-line-chk"' + (v.include ? ' checked' : '') + (v.dejaExistant ? ' disabled' : '') + '></td>' +
        '<td>' + (v.dejaExistant ? '<span class="parc-import-badge-dup">Existe déjà</span>' : '<span class="parc-import-badge-new">Nouveau</span>') + '</td>' +
        '<td><input type="text" data-idx="' + idx + '" class="parc-line-matricule" value="' + v.matricule + '" ' + (v.dejaExistant ? 'disabled' : '') + '></td>' +
        '<td><input type="text" data-idx="' + idx + '" class="parc-line-modele" value="' + String(v.modele).replace(/"/g, '&quot;') + '"></td>' +
        '<td><select data-idx="' + idx + '" class="parc-line-energie">' +
          ENERGIE_OPTIONS.map(function (o) { return '<option value="' + o + '"' + (o === v.energie ? ' selected' : '') + '>' + (o || '—') + '</option>'; }).join('') +
        '</select></td>' +
        '<td><input type="text" data-idx="' + idx + '" class="parc-line-genre" value="' + String(v.genre).replace(/"/g, '&quot;') + '"></td>' +
        '<td><input type="text" data-idx="' + idx + '" class="parc-line-division" value="' + String(v.division).replace(/"/g, '&quot;') + '"></td>' +
        '<td><input type="text" data-idx="' + idx + '" class="parc-line-chauffeur" value="' + String(v.chauffeur).replace(/"/g, '&quot;') + '"></td>' +
        '<td><input type="number" data-idx="' + idx + '" class="parc-line-km" value="0" style="width:80px;"></td>' +
        '</tr>';
    }).join('');

    var nbNew = vehicules.filter(function (v) { return !v.dejaExistant; }).length;
    var nbDup = vehicules.filter(function (v) { return v.dejaExistant; }).length;
    el('parc-import-summary').textContent = '📊 ' + vehicules.length + ' véhicule(s) lu(s) dans le fichier — ' + nbNew + ' nouveau(x), ' + nbDup + ' déjà existant(s) (ignoré·s automatiquement).';

    setStatus('✅ Fichier lu — vérifiez le kilométrage (obligatoire, mis à 0 par défaut) avant import.', 'success');

    if (!el('parc-import-btn').dataset.bound) {
      el('parc-import-btn').addEventListener('click', importParcSelection);
      el('parc-import-btn').dataset.bound = '1';
    }
  }

  function closeParcImportModal() {
    var m = el('parc-import-modal');
    if (m) m.classList.remove('open');
    currentVehicules = null;
  }
  window.closeParcImportModal = closeParcImportModal;

  /* ─────────────── Import réel — réutilise #vehicle-form ─────────────
     Pour chaque véhicule coché, on remplit le vrai formulaire véhicule et
     on déclenche son submit habituel : aucune logique de sauvegarde,
     de calcul d'alertes, etc. n'est dupliquée ou contournée. */
  function importParcSelection() {
    if (!currentVehicules) return;
    var vehicleForm = el('vehicle-form');
    if (!vehicleForm) { setStatus('❌ Formulaire véhicule introuvable.', 'error'); return; }

    var aImporter = [];
    document.querySelectorAll('.parc-line-chk').forEach(function (chk) {
      if (!chk.checked || chk.disabled) return;
      var idx = chk.getAttribute('data-idx');
      var g = function (cls) { var e = document.querySelector('.' + cls + '[data-idx="' + idx + '"]'); return e ? e.value : ''; };
      var matricule = g('parc-line-matricule').trim();
      var km = parseFloat(g('parc-line-km'));
      if (!matricule || isNaN(km)) return;
      aImporter.push({
        matricule: matricule,
        modele: g('parc-line-modele').trim(),
        energie: g('parc-line-energie'),
        genre: g('parc-line-genre').trim(),
        division: g('parc-line-division').trim(),
        chauffeur: g('parc-line-chauffeur').trim(),
        km: km,
        dateCirculation: currentVehicules[idx].dateCirculation || ''
      });
    });

    if (!aImporter.length) { setStatus('❌ Aucun véhicule coché à importer.', 'error'); return; }

    var i = 0;
    setStatus('⏳ Import de ' + aImporter.length + ' véhicule(s) en cours…', 'info');

    function importNext() {
      if (i >= aImporter.length) {
        setStatus('✅ ' + aImporter.length + ' véhicule(s) importé(s) dans le Parc Véhicules. Pensez à corriger le kilométrage réel de chacun.', 'success');
        setTimeout(closeParcImportModal, 1800);
        if (typeof window.showTab === 'function') window.showTab('vehicles');
        return;
      }
      var v = aImporter[i];
      el('vehicle-id').value = '';
      el('vehicle-matricule').value = v.matricule;
      el('vehicle-matricule-agent').value = v.division;
      el('vehicle-modele').value = v.modele;
      el('vehicle-chauffeur').value = v.chauffeur;
      var constructeurEl = el('vehicle-constructeur'); if (constructeurEl) constructeurEl.value = '';
      var typeCommEl = el('vehicle-type-commercial'); if (typeCommEl) typeCommEl.value = '';
      var numSerieEl = el('vehicle-num-serie'); if (numSerieEl) numSerieEl.value = '';
      el('vehicle-date-circulation').value = v.dateCirculation || '';
      el('vehicle-genre').value = v.genre;
      el('vehicle-energie').value = v.energie || '';
      var whatsappEl = el('vehicle-whatsapp'); if (whatsappEl) whatsappEl.value = '';
      el('vehicle-km').value = v.km;
      var vidangeEl = el('vehicle-vidange'); if (vidangeEl) vidangeEl.value = '';
      var chaineEl = el('vehicle-chaine'); if (chaineEl) chaineEl.value = '';
      var visiteEl = el('vehicle-visite'); if (visiteEl) visiteEl.value = '';
      var battDateEl = el('vehicle-batterie-date'); if (battDateEl) battDateEl.value = '';
      var battIdxEl = el('vehicle-batterie-index'); if (battIdxEl) battIdxEl.value = '';
      var pneusDateEl = el('vehicle-pneus-date'); if (pneusDateEl) pneusDateEl.value = '';

      if (typeof vehicleForm.requestSubmit === 'function') vehicleForm.requestSubmit();
      else vehicleForm.dispatchEvent(new Event('submit', { cancelable: true }));

      i++;
      setTimeout(importNext, 350);
    }
    importNext();
  }

  /* ─────────────── Injection du bouton dans l'onglet Parc Véhicules ──── */
  function injectButton() {
    if (el('parc-import-open-btn')) return;
    var vehiclesTab = el('tab-vehicles');
    if (!vehiclesTab) return;
    var addBtn = Array.prototype.find.call(vehiclesTab.querySelectorAll('button'), function (b) {
      return /Ajouter/i.test(b.textContent) && /openVehicleModal/.test(b.getAttribute('onclick') || '');
    });
    if (!addBtn || !addBtn.parentElement) return;

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'parc-import-file-input';
    fileInput.accept = '.xlsx,.xls,.xlsm';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleParcImportFile);
    addBtn.parentElement.appendChild(fileInput);

    var importBtn = document.createElement('button');
    importBtn.className = 'btn btn-success';
    importBtn.id = 'parc-import-open-btn';
    importBtn.style.background = NAVY;
    importBtn.textContent = '📥 Importer Parc Excel';
    importBtn.addEventListener('click', function () { fileInput.click(); });
    addBtn.parentElement.insertBefore(importBtn, addBtn.nextSibling);
  }

  function init() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (el('tab-vehicles')) { injectButton(); clearInterval(iv); }
      if (tries > 40) clearInterval(iv);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
/* ==========================================================================
   FIN BLOC ADDITIF — Import Excel "Parc Auto DRT Sfax"
   ========================================================================== */
