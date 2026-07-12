/* ==========================================================================
   BLOC ADDITIF — Scanner OCR "Bon de Livraison" pour import direct des
   Réparations (Parc Auto DRT Sfax).
   ==========================================================================
   Principe : on ne touche à AUCUNE logique existante de #repair-form. Ce
   module se contente d'injecter un bouton "📷 Scanner BL" dans l'onglet
   Réparations, d'extraire les champs par OCR (Tesseract.js déjà chargé dans
   admin.html), d'afficher un écran de vérification/correction, puis — pour
   chaque ligne validée — de REMPLIR le formulaire réel #repair-form et de
   déclencher son submit normal. Toute la logique de sauvegarde, de mise à
   jour des échéances, etc. reste donc exactement celle déjà en place.

   Champs extraits automatiquement (d'après le modèle de BL fourni —
   "SOCIETE IDEAL AUTO SFAX") :
     1. Matricule véhicule   ← champ "Commande N°" (ex : 17-349212)
     2. N° Bon de Livraison  ← champ "Bon de Livraison N°"
     3. Désignation          ← colonne "Désignation" de chaque ligne
     4. Quantité              ← colonne "Qte"
     5. Total HT (ligne)     ← colonne "Total HT." de chaque ligne
     6. Total HT du BL       ← ligne de synthèse "Total HT." en bas du bon
   ========================================================================== */
(function () {
  'use strict';

  var NAVY = '#1E3A5F', ORANGE = '#EF6C00';

  function el(id) { return document.getElementById(id); }

  /* ───────────────────────── 1. Normalisation des montants ───────────────
     Certaines lignes du BL sont imprimées/scannées avec le séparateur
     décimal "mangé" par l'OCR (ex: "72957" au lieu de "72.957"). Comme tous
     les montants de ce type de BL comportent 3 décimales, on les réinsère
     quand aucun séparateur n'est détecté. */
  function normalizeAmount(tok) {
    if (tok == null) return null;
    var s = String(tok).replace(/,/g, '.').trim();
    if (/\./.test(s)) { var n0 = parseFloat(s); return isNaN(n0) ? null : n0; }
    if (/^\d{4,6}$/.test(s)) return parseFloat(s.slice(0, -3) + '.' + s.slice(-3));
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  /* ───────────────────────── 2. Parsing du texte OCR brut ───────────────── */
  function parseBL(raw) {
    var text = String(raw || '').replace(/\r/g, '');
    var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);

    var result = { blNumero: null, matricule: null, date: null, totalHT: null, lignes: [] };

    var mBL = text.match(/Bon\s*de\s*Livraison\s*N[°o]?[^\d]{0,6}(\d{4,10})/i);
    if (mBL) result.blNumero = mBL[1];

    var mDate = text.match(/Date\s*[:\s]*?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i);
    if (mDate) {
      var d = mDate[1].padStart(2, '0'), mo = mDate[2].padStart(2, '0');
      var y = mDate[3].length === 2 ? '20' + mDate[3] : mDate[3];
      result.date = y + '-' + mo + '-' + d;
    }

    // Le matricule véhicule est saisi par le garage dans le champ "Commande N°"
    var mCmd = text.match(/Commande\s*N[°o]?\s*[:.]?\s*(\d{1,3})[\-\s]+(\d{3,7})/i);
    if (mCmd) result.matricule = mCmd[1] + '-' + mCmd[2];

    // Total HT global : tolère les confusions OCR "Total"→"Fotal"/"TotaI"
    var reTotal = /[TF]ot[ao][lI]\s*HT\.?\s*[:.]?\s*(\d+[.,]\d{1,3})\b/gi;
    var mt, lastTotal = null;
    while ((mt = reTotal.exec(text)) !== null) lastTotal = mt[1];
    if (lastTotal) result.totalHT = normalizeAmount(lastTotal);

    var skipRe = /Bon de Livraison|SOCIETE|SIAS|Rue |TEL\s*:|FAX|T\s*\.?\s*V\s*\.?\s*A|Code client|TUNISIE TELECOM|Commande\s*N|Code\s+D[ée]signation|[TF]ot[ao][lI]\s*HT\.?\s*\d|Remis\s*[àa]|Signature|^SFAX$/i;

    lines.forEach(function (line) {
      if (skipRe.test(line)) return;
      var clean = line.replace(/[()[\]!|]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!clean) return;
      var tokens = clean.split(' ');

      var qteIdx = -1;
      for (var i = 1; i < tokens.length; i++) { // token 0 = code article
        if (/^\d+\.\d{3}$/.test(tokens[i])) { qteIdx = i; break; }
      }
      if (qteIdx === -1) return;

      var code = tokens[0];
      var designation = tokens.slice(1, qteIdx).join(' ');
      var qte = parseFloat(tokens[qteIdx]);

      var rest = tokens.slice(qteIdx + 1).filter(function (t) { return /\d/.test(t); });
      if (!rest.length) return;
      var total = normalizeAmount(rest[rest.length - 1]);
      var prix = rest.length >= 2 ? normalizeAmount(rest[0]) : null;

      if (!designation || total == null) return;
      result.lignes.push({ code: code, designation: designation, qte: qte, prixHT: prix, totalHT: total, include: true });
    });

    return result;
  }

  /* ───────────────────────── 3. Correspondance matricule ─────────────────
     Le champ #repair-matricule est une liste déroulante déjà peuplée par
     l'application. On cherche l'option dont la valeur ou le texte contient
     le matricule détecté par OCR (même logique que pour le Stock Pneus). */
  function matchMatriculeOption(rawMatricule) {
    var select = el('repair-matricule');
    if (!select || !rawMatricule) return null;
    var target = String(rawMatricule).replace(/\s+/g, '');
    var options = Array.prototype.slice.call(select.options);
    var found = options.find(function (o) {
      var v = (o.value || '').replace(/\s+/g, '');
      var t = (o.textContent || '').replace(/\s+/g, '');
      return v === target || t.indexOf(target) !== -1 || v.indexOf(target) !== -1;
    });
    return found ? found.value : null;
  }

  /* ───────────────────────── 4. OCR (Tesseract.js) ────────────────────── */
  function ensureTesseract(cb) {
    if (window.Tesseract) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = cb;
    s.onerror = function () { setStatus('❌ Impossible de charger le moteur OCR (Tesseract). Vérifiez la connexion internet.', 'error'); };
    document.head.appendChild(s);
  }

  function runOCR(file) {
    setStatus('⏳ Lecture de l\'image…', 'info');
    var reader = new FileReader();
    reader.onload = function (e) {
      ensureTesseract(function () {
        setStatus('⏳ Analyse OCR en cours (peut prendre 10–20 s)…', 'info');
        Tesseract.recognize(e.target.result, 'fra', { tessedit_pageseg_mode: '4' })
          .then(function (res) {
            var raw = (res && res.data && res.data.text) || '';
            var parsed = parseBL(raw);
            renderPreview(parsed);
          })
          .catch(function (err) {
            console.error(err);
            setStatus('❌ Erreur OCR — réessayez avec une photo plus nette et bien cadrée.', 'error');
          });
      });
    };
    reader.onerror = function () { setStatus('❌ Erreur de lecture du fichier', 'error'); };
    reader.readAsDataURL(file);
  }

  /* ───────────────────────── 5. Interface (modal) ─────────────────────── */
  function injectStylesAndModal() {
    if (el('bl-scan-modal')) return;

    var style = document.createElement('style');
    style.textContent =
      '.bl-scan-overlay{display:none;position:fixed;inset:0;z-index:9998;background:rgba(15,23,42,0.55);align-items:center;justify-content:center;padding:16px;}' +
      '.bl-scan-overlay.open{display:flex;}' +
      '.bl-scan-modal{background:#fff;border-radius:16px;width:min(880px,96vw);max-height:92vh;overflow:auto;box-shadow:0 24px 64px rgba(0,0,0,0.25);}' +
      '.bl-scan-header{background:' + NAVY + ';color:#fff;padding:18px 22px;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center;}' +
      '.bl-scan-header h3{margin:0;font-size:16px;font-weight:800;}' +
      '.bl-scan-close{background:transparent;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;}' +
      '.bl-scan-body{padding:20px 22px;}' +
      '.bl-scan-status{font-size:13px;padding:10px 12px;border-radius:8px;margin-bottom:14px;}' +
      '.bl-scan-headfields{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px;}' +
      '.bl-scan-headfields label{display:block;font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;}' +
      '.bl-scan-headfields input,.bl-scan-headfields select{width:100%;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;}' +
      '.bl-scan-table{width:100%;border-collapse:collapse;font-size:12.5px;}' +
      '.bl-scan-table th{background:#f1f5f9;color:#334155;text-align:left;padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;}' +
      '.bl-scan-table td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;}' +
      '.bl-scan-table input[type=text],.bl-scan-table input[type=number]{width:100%;padding:5px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:12.5px;}' +
      '.bl-scan-total-badge{background:#fff7ed;border:1px solid ' + ORANGE + ';color:#9a3412;padding:8px 12px;border-radius:8px;font-size:12.5px;font-weight:700;margin:12px 0;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;}' +
      '.bl-scan-actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;}' +
      '.bl-scan-btn{padding:10px 18px;border-radius:8px;border:none;font-weight:700;font-size:13px;cursor:pointer;}' +
      '.bl-scan-btn-primary{background:' + ORANGE + ';color:#fff;}' +
      '.bl-scan-btn-secondary{background:#f1f5f9;color:#334155;}' +
      '.bl-scan-btn:disabled{opacity:.5;cursor:not-allowed;}';
    document.head.appendChild(style);

    var overlay = document.createElement('div');
    overlay.className = 'bl-scan-overlay';
    overlay.id = 'bl-scan-modal';
    overlay.innerHTML =
      '<div class="bl-scan-modal">' +
        '<div class="bl-scan-header"><h3>📷 Scanner un Bon de Livraison</h3><button class="bl-scan-close" id="bl-scan-close-btn">&times;</button></div>' +
        '<div class="bl-scan-body">' +
          '<div class="bl-scan-status" id="bl-scan-status" style="display:none;"></div>' +
          '<div id="bl-scan-upload-zone">' +
            '<p style="font-size:13px;color:#64748b;margin-bottom:12px;">Prenez une photo ou importez une image du bon de livraison (matricule, désignations et montants seront extraits automatiquement — à vérifier avant import).</p>' +
            '<input type="file" id="bl-scan-file-input" accept="image/*" capture="environment" style="display:none;">' +
            '<button class="bl-scan-btn bl-scan-btn-primary" id="bl-scan-pick-btn">📷 Choisir / Prendre une photo</button>' +
          '</div>' +
          '<div id="bl-scan-review" style="display:none;">' +
            '<div class="bl-scan-headfields">' +
              '<div><label>Véhicule (matricule)</label><select id="bl-scan-matricule"></select></div>' +
              '<div><label>N° Bon de Livraison</label><input type="text" id="bl-scan-blnum"></div>' +
              '<div><label>Date</label><input type="date" id="bl-scan-date"></div>' +
              '<div><label>Kilométrage *</label><input type="number" id="bl-scan-km" placeholder="Requis pour l\'import"></div>' +
            '</div>' +
            '<div class="bl-scan-total-badge">' +
              '<span>💰 Total HT imprimé sur le BL : <span id="bl-scan-total-bl">—</span> DT</span>' +
              '<span>➕ Somme des lignes cochées : <span id="bl-scan-total-lignes">0.000</span> DT</span>' +
            '</div>' +
            '<div style="overflow-x:auto;">' +
              '<table class="bl-scan-table">' +
                '<thead><tr><th></th><th>Désignation</th><th>Qté</th><th>Total HT (DT)</th></tr></thead>' +
                '<tbody id="bl-scan-lines-body"></tbody>' +
              '</table>' +
            '</div>' +
            '<div class="bl-scan-actions">' +
              '<button class="bl-scan-btn bl-scan-btn-primary" id="bl-scan-import-btn">✅ Importer les lignes cochées</button>' +
              '<button class="bl-scan-btn bl-scan-btn-secondary" id="bl-scan-rescan-btn">🔄 Rescanner</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    el('bl-scan-close-btn').addEventListener('click', closeModal);
    el('bl-scan-pick-btn').addEventListener('click', function () { el('bl-scan-file-input').click(); });
    el('bl-scan-file-input').addEventListener('change', function (evt) {
      var file = evt.target.files[0];
      evt.target.value = '';
      if (file) runOCR(file);
    });
    el('bl-scan-rescan-btn').addEventListener('click', function () {
      el('bl-scan-review').style.display = 'none';
      el('bl-scan-upload-zone').style.display = 'block';
      setStatus('', null);
    });
  }

  function setStatus(text, type) {
    var box = el('bl-scan-status');
    if (!box) return;
    if (!text) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    if (type === 'success') { box.style.background = '#f0fdf4'; box.style.color = '#065f46'; box.style.border = '1px solid #10b981'; }
    else if (type === 'error') { box.style.background = '#fef2f2'; box.style.color = '#991b1b'; box.style.border = '1px solid #ef4444'; }
    else { box.style.background = '#eff6ff'; box.style.color = '#1e40af'; box.style.border = '1px solid #bfdbfe'; }
    box.textContent = text;
  }

  var currentParsed = null;

  function renderPreview(parsed) {
    currentParsed = parsed;
    el('bl-scan-upload-zone').style.display = 'none';
    el('bl-scan-review').style.display = 'block';

    // Champ matricule : proposer la correspondance détectée dans la liste réelle
    var select = el('bl-scan-matricule');
    var sourceSelect = el('repair-matricule');
    select.innerHTML = sourceSelect ? sourceSelect.innerHTML : '<option value="">—</option>';
    var matched = matchMatriculeOption(parsed.matricule);
    if (matched) select.value = matched;
    else if (parsed.matricule) {
      var opt = document.createElement('option');
      opt.value = parsed.matricule; opt.textContent = parsed.matricule + ' (non reconnu — à vérifier)';
      select.insertBefore(opt, select.firstChild);
      select.value = parsed.matricule;
    }

    el('bl-scan-blnum').value = parsed.blNumero || '';
    el('bl-scan-date').value = parsed.date || '';
    el('bl-scan-total-bl').textContent = parsed.totalHT != null ? parsed.totalHT.toFixed(3) : '—';

    var tbody = el('bl-scan-lines-body');
    tbody.innerHTML = '';
    parsed.lignes.forEach(function (ligne, idx) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="checkbox" data-idx="' + idx + '" class="bl-line-chk" checked></td>' +
        '<td><input type="text" data-idx="' + idx + '" class="bl-line-desig" value="' + ligne.designation.replace(/"/g, '&quot;') + '"></td>' +
        '<td><input type="number" step="0.001" data-idx="' + idx + '" class="bl-line-qte" value="' + ligne.qte + '" style="width:70px;"></td>' +
        '<td><input type="number" step="0.001" data-idx="' + idx + '" class="bl-line-total" value="' + ligne.totalHT.toFixed(3) + '" style="width:90px;"></td>';
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('input').forEach(function (inp) { inp.addEventListener('input', updateLignesTotal); });
    updateLignesTotal();

    if (parsed.lignes.length === 0) {
      setStatus('⚠️ Aucune ligne d\'article détectée automatiquement — vérifiez la netteté de la photo ou ajoutez les lignes manuellement après import.', 'error');
    } else {
      setStatus('✅ ' + parsed.lignes.length + ' ligne(s) détectée(s) — vérifiez avant import (le total du BL sert de contrôle).', 'success');
    }
  }

  function updateLignesTotal() {
    var sum = 0;
    document.querySelectorAll('.bl-line-chk').forEach(function (chk) {
      if (chk.checked) {
        var idx = chk.getAttribute('data-idx');
        var totInp = document.querySelector('.bl-line-total[data-idx="' + idx + '"]');
        var v = totInp ? parseFloat(totInp.value) : 0;
        if (!isNaN(v)) sum += v;
      }
    });
    el('bl-scan-total-lignes').textContent = sum.toFixed(3);
  }

  /* ───────────────────────── 6. Import réel — réutilise #repair-form ────
     Pour chaque ligne cochée, on remplit le vrai formulaire de réparation
     puis on déclenche son submit habituel : aucune logique de sauvegarde,
     de mise à jour d'échéance, etc. n'est dupliquée ou contournée. */
  function importLignes() {
    if (!currentParsed) return;
    var matricule = el('bl-scan-matricule').value;
    var blNum = el('bl-scan-blnum').value.trim();
    var date = el('bl-scan-date').value;
    var km = el('bl-scan-km').value;

    if (!matricule) { setStatus('❌ Sélectionnez un véhicule avant d\'importer.', 'error'); return; }
    if (!date) { setStatus('❌ Renseignez la date avant d\'importer.', 'error'); return; }
    if (!km) { setStatus('❌ Le kilométrage est requis par le formulaire de réparation.', 'error'); return; }

    var lignesAImporter = [];
    document.querySelectorAll('.bl-line-chk').forEach(function (chk) {
      if (!chk.checked) return;
      var idx = chk.getAttribute('data-idx');
      var desig = document.querySelector('.bl-line-desig[data-idx="' + idx + '"]').value.trim();
      var total = parseFloat(document.querySelector('.bl-line-total[data-idx="' + idx + '"]').value);
      if (!desig || isNaN(total)) return;
      lignesAImporter.push({ designation: desig, montant: total });
    });

    if (!lignesAImporter.length) { setStatus('❌ Aucune ligne cochée à importer.', 'error'); return; }

    var repairForm = el('repair-form');
    if (!repairForm) { setStatus('❌ Formulaire de réparation introuvable.', 'error'); return; }

    var i = 0;
    setStatus('⏳ Import de ' + lignesAImporter.length + ' ligne(s) en cours…', 'info');

    function importNext() {
      if (i >= lignesAImporter.length) {
        setStatus('✅ ' + lignesAImporter.length + ' réparation(s) importée(s) depuis le BL' + (blNum ? ' n°' + blNum : '') + '.', 'success');
        setTimeout(closeModal, 1400);
        if (typeof window.showTab === 'function') window.showTab('repairs');
        return;
      }
      var ligne = lignesAImporter[i];
      el('repair-matricule').value = matricule;
      el('repair-type').value = 'Réparation';
      el('repair-date').value = date;
      el('repair-km').value = km;
      el('repair-designation').value = ligne.designation + (blNum ? ' — BL n°' + blNum : '');
      el('repair-montant').value = ligne.montant;
      var chauffeurEl = el('repair-chauffeur'); if (chauffeurEl) chauffeurEl.value = '';
      var nvEl = el('repair-next-vidange'); if (nvEl) nvEl.value = '';
      var ncEl = el('repair-next-chaine'); if (ncEl) ncEl.value = '';
      var nvisEl = el('repair-next-visite'); if (nvisEl) nvisEl.value = '';

      if (typeof repairForm.requestSubmit === 'function') repairForm.requestSubmit();
      else repairForm.dispatchEvent(new Event('submit', { cancelable: true }));

      i++;
      setTimeout(importNext, 350); // laisse le temps à la logique existante de traiter chaque soumission
    }
    importNext();
  }

  function openModal() {
    injectStylesAndModal();
    el('bl-scan-modal').classList.add('open');
    el('bl-scan-upload-zone').style.display = 'block';
    el('bl-scan-review').style.display = 'none';
    setStatus('', null);
    if (!el('bl-scan-import-btn').dataset.bound) {
      el('bl-scan-import-btn').addEventListener('click', importLignes);
      el('bl-scan-import-btn').dataset.bound = '1';
    }
  }
  function closeModal() {
    var m = el('bl-scan-modal');
    if (m) m.classList.remove('open');
    currentParsed = null;
  }
  window.openBLScanner = openModal;

  /* ───────────────────────── 7. Injection du bouton ──────────────────── */
  function injectButton() {
    if (el('bl-scan-open-btn')) return;
    var repairsTab = el('tab-repairs');
    if (!repairsTab) return;
    // On cible l'en-tête de la carte "Historique des réparations" (celle qui contient le bouton "➕ Nouvelle")
    var newBtn = Array.prototype.find.call(repairsTab.querySelectorAll('button'), function (b) {
      return /Nouvelle/i.test(b.textContent) && /showTab\('add-repair'\)/.test(b.getAttribute('onclick') || '');
    });
    if (!newBtn || !newBtn.parentElement) return;
    var scanBtn = document.createElement('button');
    scanBtn.className = 'btn btn-primary';
    scanBtn.id = 'bl-scan-open-btn';
    scanBtn.style.background = NAVY;
    scanBtn.textContent = '📷 Scanner BL';
    scanBtn.addEventListener('click', openModal);
    newBtn.parentElement.insertBefore(scanBtn, newBtn);
  }

  function init() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (el('tab-repairs')) { injectButton(); clearInterval(iv); }
      if (tries > 40) clearInterval(iv);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
/* ==========================================================================
   FIN BLOC ADDITIF — Scanner OCR "Bon de Livraison"
   ========================================================================== */
