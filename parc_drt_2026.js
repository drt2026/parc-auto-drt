/* ==========================================================================
   BLOC ADDITIF — Onglet "🚘 Parc DRT 2026" (Import + Export uniquement)
   ==========================================================================
   Principe : identique aux autres modules additifs (Scanner BL, CSC, Import
   Parc, Stock Pneus…) — on ne touche à AUCUNE logique existante.

   Ce module ajoute :
     1. Une entrée de menu "🚘 Parc DRT 2026" dans la sidebar.
     2. Un onglet MINIMAL avec seulement 2 boutons :
          - "📥 Importer Parc Excel"  → réutilise le module parc_import.js
            déjà présent (aucune logique dupliquée, aucun champ modifié).
          - "📊 Exporter Excel"       → génère un classeur .xlsx complet,
            présentable, à plusieurs feuilles, décrivant le parc.

   Aucune table n'est affichée/reflétée à l'écran dans cet onglet : c'est
   uniquement un point d'entrée pour importer / exporter le fichier.
   ========================================================================== */
(function () {
  'use strict';

  var NAVY   = 'FF1E3A5F';
  var ORANGE = 'FFEF6C00';
  var BAND   = 'FFF1F5F9';
  var WHITE  = 'FFFFFFFF';
  var GREY   = 'FF64748B';

  function el(id) { return document.getElementById(id); }

  /* ─────────────── Lecture des véhicules (jamais d'écriture) ──────────── */
  function getVehiclesData() {
    try {
      var pa = window.parcAuto;
      if (pa && pa.data && Array.isArray(pa.data.vehicles) && pa.data.vehicles.length > 0) {
        return pa.data.vehicles;
      }
    } catch (e) {}
    try {
      var main = JSON.parse(localStorage.getItem('parcAutoData_v3') || '{}');
      if (Array.isArray(main.vehicles)) return main.vehicles;
    } catch (e) {}
    return [];
  }

  /* ─────────────── Helper : une feuille stylée dans un classeur ExcelJS ─
     opts = { title, headers, rows, colWidths, numFmts, freeze, subtitle } */
  function addStyledSheet(wb, sheetName, opts) {
    var ws = wb.addWorksheet(sheetName);
    var headers = opts.headers || [];
    var rows = opts.rows || [];
    var nCols = Math.max(headers.length, 1);
    var rowCursor = 1;

    // Bandeau titre
    ws.mergeCells(rowCursor, 1, rowCursor, nCols);
    var titleCell = ws.getCell(rowCursor, 1);
    titleCell.value = opts.title || sheetName;
    titleCell.font = { bold: true, color: { argb: WHITE }, size: 14, name: 'Arial' };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    ws.getRow(rowCursor).height = 30;
    rowCursor++;

    // Sous-titre optionnel (ex: date, effectif)
    if (opts.subtitle) {
      ws.mergeCells(rowCursor, 1, rowCursor, nCols);
      var subCell = ws.getCell(rowCursor, 1);
      subCell.value = opts.subtitle;
      subCell.font = { italic: true, color: { argb: GREY }, size: 10, name: 'Arial' };
      subCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(rowCursor).height = 18;
      rowCursor++;
    }

    var headerRowIdx = rowCursor;
    var headerRow = ws.getRow(headerRowIdx);
    headers.forEach(function (h, i) {
      var c = headerRow.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: WHITE }, size: 10, name: 'Arial' };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
      c.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };
    });
    headerRow.height = 24;
    rowCursor++;

    rows.forEach(function (row, idx) {
      var r = ws.getRow(rowCursor + idx);
      row.forEach(function (val, ci) {
        var c = r.getCell(ci + 1);
        c.value = (val === null || val === undefined) ? '' : val;
        c.font = { size: 9.5, name: 'Arial' };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: (idx % 2 === 0) ? WHITE : BAND } };
        if (opts.numFmts && opts.numFmts[ci]) c.numFmt = opts.numFmts[ci];
      });
      r.height = 18;
    });

    (opts.colWidths || []).forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    ws.views = [{ state: 'frozen', ySplit: headerRowIdx }];
    if (headers.length) {
      ws.autoFilter = {
        from: { row: headerRowIdx, column: 1 },
        to: { row: headerRowIdx, column: headers.length }
      };
    }
    return ws;
  }

  /* ─────────────── Construction des données agrégées ───────────────────── */
  function buildAggregates(vehicules) {
    function countBy(fn) {
      var map = {};
      vehicules.forEach(function (v) {
        var key = fn(v) || 'Non renseigné';
        map[key] = (map[key] || 0) + 1;
      });
      return Object.keys(map).sort().map(function (k) { return [k, map[k]]; });
    }
    var actifs = vehicules.filter(function (v) { return v.statut === 'actif'; }).length;
    var kms = vehicules.map(function (v) { return typeof v.km === 'number' ? v.km : 0; }).filter(function (k) { return k > 0; });
    var kmMoyen = kms.length ? Math.round(kms.reduce(function (a, b) { return a + b; }, 0) / kms.length) : 0;

    return {
      parDivision: countBy(function (v) { return v.matriculeAgent; }),
      parEnergie: countBy(function (v) { return v.energie; }),
      parGenre: countBy(function (v) { return v.genre; }),
      total: vehicules.length,
      actifs: actifs,
      inactifs: vehicules.length - actifs,
      kmMoyen: kmMoyen
    };
  }

  /* ─────────────── Export Excel multi-feuilles, présentable ────────────── */
  async function exportParcDrt2026Excel() {
    if (typeof ExcelJS === 'undefined') {
      alert('Librairie ExcelJS non disponible — vérifiez votre connexion.');
      return;
    }
    var vehicules = getVehiclesData().slice().sort(function (a, b) {
      return String(a.matricule || '').localeCompare(String(b.matricule || ''));
    });
    if (!vehicules.length) { alert('Aucun véhicule à exporter.'); return; }

    var today = new Date().toISOString().slice(0, 10);
    var wb = new ExcelJS.Workbook();
    wb.creator = 'DRT Sfax — Parc Auto';
    wb.created = new Date();

    var agg = buildAggregates(vehicules);

    // Feuille 1 — Parc Véhicules (liste complète)
    var headers1 = ['Matricule', 'Modèle', 'Constructeur', 'Type commercial', 'Genre', 'Énergie',
      'Division', 'Chauffeur', 'KM actuel', 'Statut', '1ère circulation', 'N° série'];
    var rows1 = vehicules.map(function (v) {
      return [
        v.matricule || '', v.modele || '', v.constructeur || '', v.typeCommercial || '',
        v.genre || '', v.energie || '', v.matriculeAgent || '', v.chauffeur || '',
        typeof v.km === 'number' ? v.km : 0, v.statut === 'actif' ? 'Actif' : (v.statut || ''),
        v.dateCirculation || '', v.numSerie || ''
      ];
    });
    addStyledSheet(wb, 'Parc Véhicules', {
      title: 'PARC AUTO — PARC DRT SFAX 2026',
      subtitle: vehicules.length + ' véhicules — export du ' + today,
      headers: headers1,
      rows: rows1,
      colWidths: [14, 18, 14, 16, 12, 12, 20, 22, 12, 10, 14, 20],
      numFmts: [null, null, null, null, null, null, null, null, '#,##0', null, null, null]
    });

    // Feuille 2 — Répartition par Division
    addStyledSheet(wb, 'Par Division', {
      title: 'RÉPARTITION DU PARC PAR DIVISION',
      subtitle: 'Export du ' + today,
      headers: ['Division', 'Nombre de véhicules'],
      rows: agg.parDivision,
      colWidths: [30, 20],
      numFmts: [null, '#,##0']
    });

    // Feuille 3 — Répartition par Énergie / Genre
    var maxLen = Math.max(agg.parEnergie.length, agg.parGenre.length);
    var rowsEG = [];
    for (var i = 0; i < maxLen; i++) {
      rowsEG.push([
        agg.parEnergie[i] ? agg.parEnergie[i][0] : '',
        agg.parEnergie[i] ? agg.parEnergie[i][1] : '',
        agg.parGenre[i] ? agg.parGenre[i][0] : '',
        agg.parGenre[i] ? agg.parGenre[i][1] : ''
      ]);
    }
    addStyledSheet(wb, 'Par Energie-Genre', {
      title: 'RÉPARTITION PAR ÉNERGIE ET PAR GENRE',
      subtitle: 'Export du ' + today,
      headers: ['Énergie', 'Nombre', 'Genre', 'Nombre'],
      rows: rowsEG,
      colWidths: [16, 12, 16, 12],
      numFmts: [null, '#,##0', null, '#,##0']
    });

    // Feuille 4 — Statistiques globales
    addStyledSheet(wb, 'Statistiques', {
      title: 'STATISTIQUES GLOBALES DU PARC',
      subtitle: 'Export du ' + today,
      headers: ['Indicateur', 'Valeur'],
      rows: [
        ['Total véhicules', agg.total],
        ['Véhicules actifs', agg.actifs],
        ['Véhicules inactifs', agg.inactifs],
        ['Kilométrage moyen (véhicules roulants)', agg.kmMoyen]
      ],
      colWidths: [40, 16],
      numFmts: [null, '#,##0']
    });

    var buf = await wb.xlsx.writeBuffer();
    var blob = new Blob([buf], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'parc_drt_sfax_2026_' + today + '.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }
  window.exportParcDrt2026Excel = exportParcDrt2026Excel;

  /* ─────────────── BLOC ADDITIF — Tableau des véhicules (lecture seule) ─── */
  function renderParcDrt2026Table() {
    var body = el('parc-drt-2026-table-body');
    if (!body) return; // onglet pas encore ouvert/injecté

    var vehicules = getVehiclesData().slice().sort(function (a, b) {
      return String(a.matricule || '').localeCompare(String(b.matricule || ''));
    });

    var searchInput = el('parc-drt-2026-search');
    var q = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (q) {
      vehicules = vehicules.filter(function (v) {
        return [v.matricule, v.modele, v.constructeur, v.genre, v.energie, v.matriculeAgent, v.chauffeur, v.statut]
          .some(function (f) { return String(f || '').toLowerCase().indexOf(q) !== -1; });
      });
    }

    if (!vehicules.length) {
      body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#94a3b8;">' +
        (getVehiclesData().length ? 'Aucun véhicule ne correspond à la recherche' : 'Aucun véhicule importé pour le moment — cliquez sur « 📥 Importer Parc Excel »') +
        '</td></tr>';
    } else {
      body.innerHTML = vehicules.map(function (v) {
        var isActif = v.statut === 'actif';
        var statutHtml = '<span style="display:inline-block;padding:2px 10px;border-radius:6px;font-size:11px;font-weight:700;background:' +
          (isActif ? '#DCFCE7;color:#166534' : '#FEE2E2;color:#991B1B') + ';">' +
          (isActif ? 'Actif' : (v.statut || 'Inactif')) + '</span>';
        return '<tr>' +
          '<td><strong>' + (v.matricule || '-') + '</strong></td>' +
          '<td>' + (v.modele || '-') + '</td>' +
          '<td>' + (v.genre || '-') + '</td>' +
          '<td>' + (v.energie || '-') + '</td>' +
          '<td>' + (v.matriculeAgent || '-') + '</td>' +
          '<td>' + (v.chauffeur || '-') + '</td>' +
          '<td>' + (typeof v.km === 'number' ? v.km.toLocaleString('fr-FR') : '-') + '</td>' +
          '<td>' + statutHtml + '</td>' +
        '</tr>';
      }).join('');
    }

    var countEl = el('parc-drt-2026-count');
    if (countEl) {
      var total = getVehiclesData().length;
      countEl.textContent = q ? (vehicules.length + ' résultat(s) sur ' + total + ' véhicule(s)') : (total + ' véhicule(s) au total');
    }
  }
  window.renderParcDrt2026Table = renderParcDrt2026Table;
  /* FIN BLOC ADDITIF */

  /* ─────────────── Bouton Import : réutilise parc_import.js tel quel ───── */
  function triggerParcImport() {
    var existingBtn = el('parc-import-open-btn');
    var fileInput = el('parc-import-file-input');
    if (existingBtn || fileInput) {
      // BLOC ADDITIF — surveille le nombre de véhicules pendant 30s pour rafraîchir
      // automatiquement le tableau dès que l'import (asynchrone) se termine, sans
      // toucher/dépendre du code interne de parc_import.js.
      var before = getVehiclesData().length;
      var checks = 0;
      var iv = setInterval(function () {
        checks++;
        var now = getVehiclesData().length;
        if (now !== before) {
          if (typeof window.renderParcDrt2026Table === 'function') window.renderParcDrt2026Table();
          before = now;
        }
        if (checks > 30) clearInterval(iv);
      }, 1000);
      // FIN BLOC ADDITIF
    }
    if (existingBtn) { existingBtn.click(); return; }
    if (fileInput) { fileInput.click(); return; }
    alert('Module d\'import (parc_import.js) introuvable ou pas encore chargé.');
  }
  window.triggerParcImport = triggerParcImport;

  /* ─────────────── Ouverture de l'onglet (breadcrumb) ──────────────────── */
  function openParcDrt2026Tab() {
    if (typeof window.showTab === 'function') window.showTab('parc-drt-2026');
    var breadcrumb = el('breadcrumb-current');
    if (breadcrumb) breadcrumb.textContent = 'Parc DRT 2026';
    document.querySelectorAll('.nav-item[data-nav]').forEach(function (item) {
      item.classList.toggle('active', item.dataset.nav === 'parc-drt-2026');
    });
    document.querySelectorAll('.tab-content').forEach(function (tab) {
      tab.classList.toggle('active', tab.id === 'tab-parc-drt-2026');
    });
    if (typeof window.renderParcDrt2026Table === 'function') window.renderParcDrt2026Table(); // BLOC ADDITIF
  }
  window.openParcDrt2026Tab = openParcDrt2026Tab;

  /* ─────────────── Injection de l'entrée de menu ───────────────────────── */
  function injectNavItem() {
    if (el('nav-parc-drt-2026')) return;
    var vehiclesNav = document.querySelector('.nav-item[data-nav="vehicles"]');
    if (!vehiclesNav || !vehiclesNav.parentElement) return;

    var navItem = document.createElement('div');
    navItem.className = 'nav-item';
    navItem.id = 'nav-parc-drt-2026';
    navItem.setAttribute('data-nav', 'parc-drt-2026');
    navItem.innerHTML = '<span>🚘</span> Parc DRT 2026';
    navItem.addEventListener('click', function () {
      openParcDrt2026Tab();
      if (typeof window.closeMobileSidebar === 'function') window.closeMobileSidebar();
    });
    vehiclesNav.parentElement.insertBefore(navItem, vehiclesNav.nextSibling);
  }

  /* ─────────────── Injection de l'onglet (2 boutons uniquement) ────────── */
  function injectTabContent() {
    if (el('tab-parc-drt-2026')) return;
    var vehiclesTab = el('tab-vehicles');
    if (!vehiclesTab || !vehiclesTab.parentElement) return;

    var tab = document.createElement('div');
    tab.className = 'tab-content';
    tab.id = 'tab-parc-drt-2026';
    tab.innerHTML =
      '<div class="card">' +
        '<div class="card-header">' +
          '<div>' +
            '<div class="card-title">🚘 Parc DRT 2026</div>' +
            '<div class="card-subtitle">Import et export du fichier parc véhicules</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:16px;flex-wrap:wrap;padding:24px 4px;">' +
          '<button class="btn btn-secondary" style="padding:14px 22px;font-size:15px;" onclick="triggerParcImport()">📥 Importer Parc Excel</button>' +
          '<button class="btn btn-success" style="padding:14px 22px;font-size:15px;background:#1E3A5F;" onclick="exportParcDrt2026Excel()">📊 Exporter Excel</button>' +
        '</div>' +
      '</div>' +
      /* BLOC ADDITIF — Tableau des véhicules importés (lecture seule, ne modifie aucune donnée) */
      '<div class="card" style="margin-top:16px;">' +
        '<div class="card-header">' +
          '<div>' +
            '<div class="card-title">📋 Liste des véhicules importés</div>' +
            '<div class="card-subtitle" id="parc-drt-2026-count">—</div>' +
          '</div>' +
          '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
            '<input type="text" id="parc-drt-2026-search" class="form-input" placeholder="🔎 Matricule, chauffeur, division..." style="width:260px;" oninput="renderParcDrt2026Table()">' +
            '<button class="btn btn-secondary" onclick="renderParcDrt2026Table()">🔄 Actualiser</button>' +
          '</div>' +
        '</div>' +
        '<div style="overflow-x:auto;">' +
          '<table class="data-table">' +
            '<thead><tr>' +
              '<th>Matricule</th><th>Modèle</th><th>Genre</th><th>Énergie</th><th>Division</th><th>Chauffeur</th><th>KM</th><th>Statut</th>' +
            '</tr></thead>' +
            '<tbody id="parc-drt-2026-table-body"></tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
      /* FIN BLOC ADDITIF */
      '';
    vehiclesTab.parentElement.insertBefore(tab, vehiclesTab.nextSibling);
  }

  function init() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (el('tab-vehicles') && document.querySelector('.nav-item[data-nav="vehicles"]')) {
        injectTabContent();
        injectNavItem();
        if (typeof window.renderParcDrt2026Table === 'function') window.renderParcDrt2026Table(); // BLOC ADDITIF
        clearInterval(iv);
      }
      if (tries > 40) clearInterval(iv);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
/* ==========================================================================
   FIN BLOC ADDITIF — Onglet "🚘 Parc DRT 2026"
   ========================================================================== */
