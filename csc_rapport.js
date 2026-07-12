/* ==========================================================================
   csc_rapport.js — Module "Dépenses par CSC" (onglet Réparations)
   DRT Sfax — Parc Auto
   --------------------------------------------------------------------------
   Ce fichier manquait : les boutons/IDs existaient déjà dans admin.html
   ("csc-hist-file-input", "csc-hist-year-select", "csc-hist-kpi-grid",
   "csc-hist-table-body", "csc-hist-chart", "csc-hist-import-status") mais
   aucune des fonctions appelées (handleCscHistImport, renderCscHistDashboard,
   clearCscHistYear, showCscRapportModal) n'était définie nulle part — d'où
   l'absence totale de réaction au clic sur "Importer Excel".

   Format attendu du fichier "STAT CSC" (ex: 2020-2025n.xlsx) :
   ligne d'en-tête : Immatriculation | Modèle | Energie | Subdivision |
                     Ancienneté | GENRE | Situation du véhicule | <année1> | <année2> | ...
   (les colonnes années sont dynamiques : autant que présentes dans le fichier)

   Stockage : suit le même pattern que fuelData / sinistresData déjà en place
   dans admin.html — localStorage dédié + délégation à pa.saveData() pour la
   sync cloud (Gist via le Worker), avec pa.data comme source de vérité en
   mémoire une fois chargé.
   ========================================================================== */

(function () {
  'use strict';

  var CSC_KEY = 'parcAutoCscHist_v1';
  // Structure stockée :
  // { vehicles: [ { matricule, modele, energie, subdivision, anciennete,
  //                 genre, situation, montants: {"2020": 123.4, "2021": ...} } ],
  //   years: ["2020","2021","2022","2023","2024","2025"] }

  var TT_COLORS = ['#1E3A5F', '#EF6C00', '#2E9E6B'];
  var cscSelectedYear = 'all'; // 'all' = cumulé toutes années présentes

  // ---------------------------------------------------------------------
  // Normalisation du libellé CSC : le fichier source mélange "CSC Sfax Sud"
  // et "C S C Sfax Nord" (espaces entre C-S-C). On regroupe sous un seul
  // libellé propre par zone pour éviter que la même CSC apparaisse deux fois
  // dans le tableau/graphique.
  // ---------------------------------------------------------------------
  function normalizeCscLabel(raw) {
    if (!raw) return 'Non renseigné';
    var s = String(raw).replace(/\s+/g, ' ').trim();
    s = s.replace(/^C\s*S\s*C\b/i, 'CSC');
    return s;
  }

  // ---------------------------------------------------------------------
  // Persistance — même pattern que getFuelData()/saveFuelData() plus haut
  // dans admin.html : mémoire (pa.data) > parcAutoData_v3 > clé dédiée.
  // ---------------------------------------------------------------------
  function getCscHistData() {
    try {
      var pa = window.parcAuto;
      if (pa && pa.data && pa.data.cscHistData && Array.isArray(pa.data.cscHistData.vehicles) && pa.data.cscHistData.vehicles.length > 0)
        return pa.data.cscHistData;
    } catch (e) {}
    try {
      var main = JSON.parse(localStorage.getItem('parcAutoData_v3') || '{}');
      if (main.cscHistData && Array.isArray(main.cscHistData.vehicles) && main.cscHistData.vehicles.length > 0)
        return main.cscHistData;
    } catch (e) {}
    try {
      var stored = JSON.parse(localStorage.getItem(CSC_KEY));
      if (stored && Array.isArray(stored.vehicles)) return stored;
    } catch (e) {}
    return { vehicles: [], years: [] };
  }

  function saveCscHistData(data) {
    localStorage.setItem(CSC_KEY, JSON.stringify(data));
    try {
      var pa = window.parcAuto;
      if (pa && pa.data) {
        pa.data.cscHistData = data;
        if (typeof pa.saveData === 'function') pa.saveData();
      }
    } catch (e) { console.warn('[CSC] sync cloud échouée:', e); }
  }

  // ---------------------------------------------------------------------
  // Import Excel
  // ---------------------------------------------------------------------
  window.handleCscHistImport = function (event) {
    var file = event.target.files[0];
    if (!file) return;
    var status = document.getElementById('csc-hist-import-status');
    if (status) status.textContent = '⏳ Lecture du fichier...';

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        if (typeof XLSX === 'undefined') {
          if (status) status.textContent = '❌ Librairie XLSX non disponible.';
          return;
        }
        var wb = XLSX.read(e.target.result, { type: 'array' });
        var sheetName = wb.SheetNames.find(function (n) { return /csc|stat/i.test(n); }) || wb.SheetNames[0];
        var ws = wb.Sheets[sheetName];
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

        // Trouver la ligne d'en-tête (celle qui contient "Immatriculation")
        var headerRowIdx = -1, headerRow = null;
        for (var i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i].some(function (c) { return typeof c === 'string' && /immatriculation/i.test(c); })) {
            headerRowIdx = i; headerRow = rows[i]; break;
          }
        }
        if (headerRowIdx === -1) {
          if (status) status.textContent = '❌ En-tête "Immatriculation" introuvable dans le fichier.';
          return;
        }

        var col = {};
        headerRow.forEach(function (h, idx) {
          if (h === null || h === undefined) return;
          var key = String(h).trim();
          if (/immatriculation/i.test(key)) col.matricule = idx;
          else if (/mod[eè]le/i.test(key)) col.modele = idx;
          else if (/energie|énergie/i.test(key)) col.energie = idx;
          else if (/subdivision/i.test(key)) col.subdivision = idx;
          else if (/anciennet[eé]/i.test(key)) col.anciennete = idx;
          else if (/^genre$/i.test(key)) col.genre = idx;
          else if (/situation/i.test(key)) col.situation = idx;
          else if (/^\d{4}$/.test(key)) { col.years = col.years || []; col.years.push({ idx: idx, year: key }); }
        });

        if (col.matricule === undefined || col.subdivision === undefined || !col.years || !col.years.length) {
          if (status) status.textContent = '❌ Colonnes attendues manquantes (Immatriculation / Subdivision / années).';
          return;
        }

        var existing = getCscHistData();
        var byMatricule = {};
        existing.vehicles.forEach(function (v) { byMatricule[v.matricule] = v; });

        var importedYears = {};
        for (var r = headerRowIdx + 1; r < rows.length; r++) {
          var row = rows[r];
          if (!row || !row[col.matricule]) continue;
          var matricule = String(row[col.matricule]).trim();
          var rec = byMatricule[matricule];
          if (!rec) {
            rec = {
              matricule: matricule,
              modele: col.modele !== undefined ? row[col.modele] : null,
              energie: col.energie !== undefined ? row[col.energie] : null,
              subdivision: normalizeCscLabel(col.subdivision !== undefined ? row[col.subdivision] : null),
              anciennete: col.anciennete !== undefined ? row[col.anciennete] : null,
              genre: col.genre !== undefined ? row[col.genre] : null,
              situation: col.situation !== undefined ? row[col.situation] : null,
              montants: {}
            };
            byMatricule[matricule] = rec;
            existing.vehicles.push(rec);
          } else {
            // Rafraîchit les infos descriptives (le fichier source fait foi)
            rec.subdivision = normalizeCscLabel(col.subdivision !== undefined ? row[col.subdivision] : rec.subdivision);
            if (col.modele !== undefined && row[col.modele]) rec.modele = row[col.modele];
            if (col.situation !== undefined && row[col.situation]) rec.situation = row[col.situation];
          }
          col.years.forEach(function (yc) {
            var val = row[yc.idx];
            rec.montants[yc.year] = (typeof val === 'number') ? val : (parseFloat(val) || 0);
            importedYears[yc.year] = true;
          });
        }

        var allYears = {};
        existing.vehicles.forEach(function (v) { Object.keys(v.montants).forEach(function (y) { allYears[y] = true; }); });
        existing.years = Object.keys(allYears).sort();

        saveCscHistData(existing);
        populateCscYearSelect();
        cscSelectedYear = 'all';
        var sel = document.getElementById('csc-hist-year-select');
        if (sel) sel.value = 'all';
        renderCscHistDashboard();

        var nYears = Object.keys(importedYears).length;
        var nVeh = existing.vehicles.length;
        if (status) status.textContent = '✅ Import réussi — ' + nVeh + ' véhicules, ' + nYears + ' année(s) (' + Object.keys(importedYears).sort().join(', ') + ')';
      } catch (err) {
        console.error('[CSC] Erreur import:', err);
        if (status) status.textContent = '❌ Erreur lors de la lecture du fichier : ' + err.message;
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ---------------------------------------------------------------------
  // Sélecteur d'année
  // ---------------------------------------------------------------------
  function populateCscYearSelect() {
    var sel = document.getElementById('csc-hist-year-select');
    if (!sel) return;
    var data = getCscHistData();
    var years = data.years || [];
    var current = sel.value;
    sel.innerHTML = '';
    var optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = 'Toutes années (cumulé)';
    sel.appendChild(optAll);
    years.forEach(function (y) {
      var opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      sel.appendChild(opt);
    });
    if (years.indexOf(current) !== -1 || current === 'all') sel.value = current;
    else sel.value = years.length ? years[years.length - 1] : 'all';
    cscSelectedYear = sel.value;
  }

  // ---------------------------------------------------------------------
  // Agrégation par CSC pour l'année sélectionnée ('all' = somme de toutes)
  // ---------------------------------------------------------------------
  function aggregateCscData(year) {
    var data = getCscHistData();
    var byCsc = {}; // { label: { nbVehicules, total, matricules:Set } }
    data.vehicles.forEach(function (v) {
      var label = v.subdivision || 'Non renseigné';
      var total = 0;
      if (year === 'all') {
        Object.keys(v.montants).forEach(function (y) { total += (v.montants[y] || 0); });
      } else {
        total = v.montants[year] || 0;
      }
      if (!byCsc[label]) byCsc[label] = { label: label, nbVehicules: 0, total: 0, matricules: {} };
      if (!byCsc[label].matricules[v.matricule]) {
        byCsc[label].matricules[v.matricule] = true;
        byCsc[label].nbVehicules++;
      }
      byCsc[label].total += total;
    });
    var list = Object.keys(byCsc).map(function (k) { return byCsc[k]; });
    list.forEach(function (item) { delete item.matricules; });
    list.sort(function (a, b) { return b.total - a.total; });
    return list;
  }

  // ---------------------------------------------------------------------
  // Rendu tableau de bord (KPI + tableau + graphique)
  // ---------------------------------------------------------------------
  window.renderCscHistDashboard = function () {
    var sel = document.getElementById('csc-hist-year-select');
    var year = sel ? sel.value : 'all';
    cscSelectedYear = year;

    var list = aggregateCscData(year);
    var grandTotal = list.reduce(function (s, c) { return s + c.total; }, 0);
    var totalVehicules = list.reduce(function (s, c) { return s + c.nbVehicules; }, 0);
    var moyenneGenerale = totalVehicules ? grandTotal / totalVehicules : 0;
    var topCsc = list.length ? list[0] : null;

    // --- KPI ---
    var kpiGrid = document.getElementById('csc-hist-kpi-grid');
    if (kpiGrid) {
      kpiGrid.innerHTML =
        '<div class="stat-card"><div class="stat-icon blue">🏬</div><div class="stat-info"><h3>' + list.length + '</h3><p>CSC recensées</p></div></div>' +
        '<div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-info"><h3>' + grandTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' DT</h3><p>Total dépenses' + (year === 'all' ? ' (cumulé)' : ' — ' + year) + '</p></div></div>' +
        '<div class="stat-card"><div class="stat-icon orange">🚚</div><div class="stat-info"><h3>' + totalVehicules + '</h3><p>Véhicules concernés</p></div></div>' +
        '<div class="stat-card"><div class="stat-icon red">📊</div><div class="stat-info"><h3>' + moyenneGenerale.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' DT</h3><p>Moyenne / véhicule</p></div></div>' +
        (topCsc ? '<div class="stat-card"><div class="stat-icon blue">🔺</div><div class="stat-info"><h3>' + topCsc.label + '</h3><p>CSC la plus coûteuse</p></div></div>' : '');
    }

    // --- Tableau ---
    var tbody = document.getElementById('csc-hist-table-body');
    if (tbody) {
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--secondary);">Aucune donnée importée</td></tr>';
      } else {
        tbody.innerHTML = list.map(function (c) {
          var moyenne = c.nbVehicules ? c.total / c.nbVehicules : 0;
          var pct = grandTotal ? (c.total / grandTotal * 100) : 0;
          return '<tr>' +
            '<td style="font-weight:600;">' + c.label + '</td>' +
            '<td>' + c.nbVehicules + '</td>' +
            '<td>' + c.total.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + '</td>' +
            '<td>' + moyenne.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + '</td>' +
            '<td>' + pct.toFixed(1) + '%</td>' +
            '</tr>';
        }).join('');
      }
    }

    // --- Graphique (barres CSS, pas de canvas dans le markup existant) ---
    var chartDiv = document.getElementById('csc-hist-chart');
    if (chartDiv) {
      if (!list.length) {
        chartDiv.innerHTML = '<div style="text-align:center;padding:20px;color:var(--secondary);">Aucune donnée à afficher</div>';
      } else {
        var maxVal = Math.max.apply(null, list.map(function (c) { return c.total; }));
        chartDiv.innerHTML = list.map(function (c, i) {
          var pctWidth = maxVal ? (c.total / maxVal * 100) : 0;
          var color = TT_COLORS[i % TT_COLORS.length];
          return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
            '<div style="min-width:140px;font-size:13px;font-weight:600;">' + c.label + '</div>' +
            '<div style="flex:1;background:#F1F5F9;border-radius:4px;overflow:hidden;height:22px;">' +
            '<div style="width:' + pctWidth.toFixed(1) + '%;background:' + color + ';height:100%;border-radius:4px;"></div>' +
            '</div>' +
            '<div style="min-width:100px;text-align:right;font-size:13px;color:var(--secondary);">' + c.total.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' DT</div>' +
            '</div>';
        }).join('');
      }
    }
  };

  // ---------------------------------------------------------------------
  // Effacer l'année sélectionnée
  // ---------------------------------------------------------------------
  window.clearCscHistYear = function () {
    var sel = document.getElementById('csc-hist-year-select');
    var year = sel ? sel.value : null;
    if (!year) return;
    if (year === 'all') {
      if (!confirm('Effacer TOUTES les données CSC importées (toutes années) ? Cette action est irréversible.')) return;
      saveCscHistData({ vehicles: [], years: [] });
    } else {
      if (!confirm('Effacer les données CSC de l\'année ' + year + ' ? Cette action est irréversible.')) return;
      var data = getCscHistData();
      data.vehicles.forEach(function (v) { delete v.montants[year]; });
      data.vehicles = data.vehicles.filter(function (v) { return Object.keys(v.montants).length > 0; });
      data.years = data.years.filter(function (y) { return y !== year; });
      saveCscHistData(data);
    }
    populateCscYearSelect();
    renderCscHistDashboard();
  };

  // ---------------------------------------------------------------------
  // Export Excel stylé (via le helper ttExportStyledExcel déjà présent)
  // ---------------------------------------------------------------------
  window.showCscRapportModal = function () {
    var sel = document.getElementById('csc-hist-year-select');
    var year = sel ? sel.value : 'all';
    var list = aggregateCscData(year);
    if (!list.length) { alert('Aucune donnée CSC à exporter — importez d\'abord un fichier.'); return; }
    if (typeof ttExportStyledExcel === 'undefined') { alert('Librairie ExcelJS non disponible.'); return; }

    var grandTotal = list.reduce(function (s, c) { return s + c.total; }, 0);
    var today = new Date().toISOString().slice(0, 10);
    var headers = ['CSC', 'Nb véhicules', 'Total (DT)', 'Moyenne / véhicule (DT)', '% du budget'];
    var rows = list.map(function (c) {
      var moyenne = c.nbVehicules ? c.total / c.nbVehicules : 0;
      var pct = grandTotal ? (c.total / grandTotal * 100) : 0;
      return [c.label, c.nbVehicules, Math.round(c.total * 100) / 100, Math.round(moyenne * 100) / 100, pct.toFixed(1) + '%'];
    });

    ttExportStyledExcel({
      sheetName: 'Dépenses CSC',
      title: 'PARC AUTO — DÉPENSES PAR CSC — ' + (year === 'all' ? 'CUMULÉ' : year) + ' — ' + today + ' — DRT SFAX',
      headers: headers,
      rows: rows,
      colWidths: [22, 14, 16, 20, 12],
      filename: 'depenses_csc_' + (year === 'all' ? 'cumule' : year) + '_' + today + '.xlsx'
    });
  };

  // ---------------------------------------------------------------------
  // Initialisation au chargement
  // ---------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    populateCscYearSelect();
    renderCscHistDashboard();
  });
  // Si le DOM est déjà prêt (script chargé en fin de page, comme les autres
  // modules *_rapport.js), on initialise directement aussi.
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(function () { populateCscYearSelect(); renderCscHistDashboard(); }, 0);
  }
})();
