/* ============================================================
   BLOC ADDITIF — BILAN GLOBAL CARBURANT (VÉHICULES + GROUPES ÉLECTROGÈNES)
   Fichier : bilan_global_carburant.js
   100% additif : ne lit que des données déjà exposées par les
   autres modules (getFuelData() de admin.html, getGEData() /
   __geCompute() / __GE_MOIS de groupe_electrogene.js).
   N'altère aucune fonction existante.
   À inclure APRÈS fuel_rapport.js ET groupe_electrogene.js :
   <script src="bilan_global_carburant.js?v=1"></script>
   ============================================================ */
(function () {
  'use strict';

  const TARIF_GAZOIL_GE = 1.985; // DT/L — même tarif Gazoil que le Suivi Carburant véhicules

  const MONTH_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const MONTH_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

  const COLORS = {
    navy: '1E3A5F', midnight: '0F172A', ink: '1E293B', slate: '64748B',
    mist: 'E2E8F0', paper: 'FFFFFF', bg: 'F8FAFC',
    teal: '0EA5B7', tealSoft: 'CFF3F6',
    amber: 'F59E0B', amberSoft: 'FEF3C7',
    green: '10B981', greenSoft: 'D1FAE5',
    orange: 'EF6C00',
  };
  const TT_NAVY = 'FF1E3A5F', TT_ORANGE = 'FFEF6C00', TT_BAND = 'FFF1F5F9', TT_WHITE = 'FFFFFFFF';

  function bgNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function fmt(n, dec) { return (bgNum(n)).toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); }

  /* ══════════════════════════════════════════════════════════
   *  COLLECTE / AGRÉGATION (lecture seule)
   * ══════════════════════════════════════════════════════════ */

  function _currentYear() {
    const sel = document.getElementById('bilan-global-year-select');
    return (sel && sel.value) ? sel.value : String(new Date().getFullYear());
  }

  function computeFuelMonthly(year) {
    const allData = (typeof getFuelData === 'function') ? getFuelData() : {};
    const out = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      const entries = Object.values((allData && allData[key]) || {});
      out.push({
        m,
        litres: entries.reduce((s, e) => s + (e.litres || 0), 0),
        montant: entries.reduce((s, e) => s + (e.montant || 0), 0),
        km: entries.reduce((s, e) => s + (e.km || 0), 0),
        nbVehicules: entries.length
      });
    }
    return out;
  }

  function computeGEMonthly(year) {
    const list = (typeof getGEData === 'function') ? getGEData() : [];
    const compute = (typeof window.__geCompute === 'function') ? window.__geCompute : null;
    const out = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      const entries = list.filter(e => e.mois === key);
      let litres = 0;
      entries.forEach(e => {
        const c = compute ? compute(e) : { consMois: (bgNum(e.nbrH)) * (bgNum(e.consH)) };
        litres += c.consMois || 0;
      });
      out.push({ m, litres, cout: litres * TARIF_GAZOIL_GE, nbSites: entries.length });
    }
    return out;
  }

  function computeGlobal(year) {
    const fuel = computeFuelMonthly(year);
    const ge = computeGEMonthly(year);
    const rows = fuel.map((f, i) => {
      const g = ge[i];
      return {
        m: f.m, label: MONTH_LABELS[i],
        fuelLitres: f.litres, fuelMontant: f.montant, fuelKm: f.km, fuelVehicules: f.nbVehicules,
        geLitres: g.litres, geCout: g.cout, geSites: g.nbSites,
        totalLitres: f.litres + g.litres,
        totalCout: f.montant + g.cout
      };
    });
    const totals = rows.reduce((acc, r) => {
      acc.fuelLitres += r.fuelLitres; acc.fuelMontant += r.fuelMontant; acc.fuelKm += r.fuelKm;
      acc.geLitres += r.geLitres; acc.geCout += r.geCout;
      acc.totalLitres += r.totalLitres; acc.totalCout += r.totalCout;
      return acc;
    }, { fuelLitres: 0, fuelMontant: 0, fuelKm: 0, geLitres: 0, geCout: 0, totalLitres: 0, totalCout: 0 });
    return { year, rows, totals };
  }

  /* ══════════════════════════════════════════════════════════
   *  RENDU TABLEAU DE BORD (admin.html)
   * ══════════════════════════════════════════════════════════ */

  function populateYearSelect() {
    const sel = document.getElementById('bilan-global-year-select');
    if (!sel || sel.dataset.filled) return;
    const years = new Set();
    try {
      const allData = (typeof getFuelData === 'function') ? getFuelData() : {};
      Object.keys(allData).forEach(k => years.add(k.slice(0, 4)));
    } catch (e) {}
    try {
      (typeof window.__GE_MOIS !== 'undefined' ? window.__GE_MOIS : []).forEach(m => years.add(m.key.slice(0, 4)));
    } catch (e) {}
    years.add(String(new Date().getFullYear()));
    Array.from(years).sort().forEach(y => {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      sel.appendChild(opt);
    });
    sel.value = String(new Date().getFullYear());
    sel.dataset.filled = '1';
  }

  function renderBilanGlobalDashboard() {
    populateYearSelect();
    const year = _currentYear();
    const g = computeGlobal(year);

    const kpiGrid = document.getElementById('bilan-global-kpi-grid');
    if (kpiGrid) {
      // Mêmes classes .stat-card/.stat-icon/.stat-info déjà utilisées par
      // renderFuelDashboard() — seules 4 couleurs d'icône existent : blue/green/orange/red
      const cards = [
        { icon: '⛽', cls: 'blue', big: `${fmt(g.totals.fuelLitres, 0)} L`, label: 'Litres véhicules' },
        { icon: '🔌', cls: 'orange', big: `${fmt(g.totals.geLitres, 0)} L`, label: 'Litres groupes électrogènes' },
        { icon: '🧮', cls: 'blue', big: `${fmt(g.totals.totalLitres, 0)} L`, label: 'Total carburant global' },
        { icon: '💰', cls: 'green', big: `${fmt(g.totals.fuelMontant, 0)} DT`, label: 'Coût véhicules' },
        { icon: '💰', cls: 'orange', big: `${fmt(g.totals.geCout, 0)} DT`, label: 'Coût GE estimé' },
        { icon: '💶', cls: 'green', big: `${fmt(g.totals.totalCout, 0)} DT`, label: 'Coût global total' },
      ];
      kpiGrid.innerHTML = cards.map(c => `
        <div class="stat-card"><div class="stat-icon ${c.cls}">${c.icon}</div><div class="stat-info"><h3>${c.big}</h3><p>${c.label}</p></div></div>`).join('');
    }

    const wrap = document.getElementById('bilan-global-table-wrap');
    if (wrap) {
      const rowsHtml = g.rows.map(r => `
        <tr>
          <td>${r.label} ${year}</td>
          <td style="text-align:right">${fmt(r.fuelLitres, 2)}</td>
          <td style="text-align:right">${fmt(r.fuelMontant, 2)}</td>
          <td style="text-align:right">${fmt(r.fuelKm, 0)}</td>
          <td style="text-align:right">${fmt(r.geLitres, 2)}</td>
          <td style="text-align:right">${fmt(r.geCout, 2)}</td>
          <td style="text-align:right;font-weight:700">${fmt(r.totalLitres, 2)}</td>
          <td style="text-align:right;font-weight:700">${fmt(r.totalCout, 2)}</td>
        </tr>`).join('');
      const totalHtml = `
        <tr style="background:#EF6C00;color:#fff;font-weight:700">
          <td>CUMUL ${year}</td>
          <td style="text-align:right">${fmt(g.totals.fuelLitres, 2)}</td>
          <td style="text-align:right">${fmt(g.totals.fuelMontant, 2)}</td>
          <td style="text-align:right">${fmt(g.totals.fuelKm, 0)}</td>
          <td style="text-align:right">${fmt(g.totals.geLitres, 2)}</td>
          <td style="text-align:right">${fmt(g.totals.geCout, 2)}</td>
          <td style="text-align:right">${fmt(g.totals.totalLitres, 2)}</td>
          <td style="text-align:right">${fmt(g.totals.totalCout, 2)}</td>
        </tr>`;
      wrap.innerHTML = `
        <table class="data-table" style="width:100%">
          <thead>
            <tr>
              <th>Mois</th><th>Litres Véh.</th><th>DT Véh.</th><th>Km Véh.</th>
              <th>Litres GE</th><th>Coût GE (DT)</th><th>Total Litres</th><th>Total Coût (DT)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}${totalHtml}</tbody>
        </table>`;
    }
  }
  window.renderBilanGlobalDashboard = renderBilanGlobalDashboard;

  /* ══════════════════════════════════════════════════════════
   *  EXPORT EXCEL (ExcelJS — même moteur que Groupes Électrogènes
   *  et Rapport Global, déjà chargé dans admin.html)
   * ══════════════════════════════════════════════════════════ */

  function _loadExcelJS(cb) {
    if (window.ExcelJS) { cb(); return; }
    const mirrors = [
      'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
      'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
      'https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js'
    ];
    let i = 0;
    (function tryNext() {
      if (window.ExcelJS) { cb(); return; }
      if (i >= mirrors.length) { cb(new Error('Librairie ExcelJS indisponible (réseau).')); return; }
      const s = document.createElement('script');
      s.src = mirrors[i++];
      s.onload = function () { cb(); };
      s.onerror = tryNext;
      document.head.appendChild(s);
    })();
  }

  function addStyledSheet(wb, opts) {
    const ws = wb.addWorksheet(opts.sheetName);
    const nCols = (opts.headers || []).length || 1;
    ws.mergeCells(1, 1, 1, nCols);
    const t = ws.getCell(1, 1);
    t.value = opts.title || '';
    t.font = { bold: true, color: { argb: TT_WHITE }, size: 13 };
    t.alignment = { horizontal: 'center', vertical: 'middle' };
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TT_NAVY } };
    ws.getRow(1).height = 28;

    const hr = ws.getRow(2);
    (opts.headers || []).forEach((h, i) => {
      const c = hr.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: TT_WHITE }, size: 10 };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TT_ORANGE } };
      c.border = { top: { style: 'thin', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }, left: { style: 'thin', color: { argb: 'FFCCCCCC' } }, right: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
    });
    hr.height = 22;

    (opts.rows || []).forEach((row, idx) => {
      const r = ws.getRow(3 + idx);
      row.forEach((val, ci) => {
        const c = r.getCell(ci + 1);
        c.value = val;
        c.font = { size: 9, bold: !!opts.boldLastRow && idx === opts.rows.length - 1 };
        c.alignment = { horizontal: ci === 0 ? 'left' : 'right', vertical: 'middle' };
        c.border = { top: { style: 'thin', color: { argb: 'FFE0E0E0' } }, bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }, left: { style: 'thin', color: { argb: 'FFE0E0E0' } }, right: { style: 'thin', color: { argb: 'FFE0E0E0' } } };
        const isTotal = opts.boldLastRow && idx === opts.rows.length - 1;
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isTotal ? TT_ORANGE : ((idx % 2 === 0) ? TT_WHITE : TT_BAND) } };
        if (isTotal) c.font.color = { argb: TT_WHITE };
      });
    });

    (opts.colWidths || []).forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    if ((opts.rows || []).length) ws.views = [{ state: 'frozen', ySplit: 2 }];
    return ws;
  }

  const MONTH_SHEET_NAMES = ['Janv26','Fev26','Mars26','Avril26','Mai26','Juin26','Juillet26','Aout26','Septembre26','Octobre26','Novembre26','Decembre26'];

  function computeVehicleAnnualRecap(year) {
    const allData = (typeof getFuelData === 'function') ? getFuelData() : {};
    const byVehicle = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      Object.values((allData && allData[key]) || {}).forEach(e => {
        if (!byVehicle[e.matricule]) byVehicle[e.matricule] = { matricule: e.matricule, modele: e.modele, chauffeur: e.chauffeur, litres: 0, montant: 0, km: 0, pctSum: 0, pctCount: 0, months: 0 };
        const v = byVehicle[e.matricule];
        v.litres += e.litres || 0; v.montant += e.montant || 0; v.km += e.km || 0;
        if (isFinite(e.pct) && e.pct) { v.pctSum += e.pct; v.pctCount++; }
        v.months++;
        v.modele = e.modele || v.modele; v.chauffeur = e.chauffeur || v.chauffeur;
      });
    }
    return Object.values(byVehicle).map(v => ({ ...v, avgPct: v.pctCount ? v.pctSum / v.pctCount : 0 })).sort((a, b) => b.montant - a.montant);
  }

  function computeGEAnnualGrid(year) {
    const sites = (typeof window.__GE_SITES !== 'undefined' && window.__GE_SITES) ? window.__GE_SITES : [];
    const list = (typeof getGEData === 'function') ? getGEData() : [];
    const compute = (typeof window.__geCompute === 'function') ? window.__geCompute : null;
    return sites.map(s => {
      const monthly = [];
      let total = 0;
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, '0')}`;
        const e = list.find(x => x.site === s.site && x.mois === key);
        const litres = e ? ((compute ? compute(e) : { consMois: (bgNum(e.nbrH)) * (bgNum(e.consH)) }).consMois || 0) : 0;
        monthly.push(+litres.toFixed(2));
        total += litres;
      }
      return { site: s.site, puiss: s.puiss, monthly, total: +total.toFixed(2) };
    });
  }

  async function buildBilanGlobalWorkbook(year) {
    const g = computeGlobal(year);
    const wb = new window.ExcelJS.Workbook();
    wb.creator = 'Hamdi Ben Aouicha — Chef de Parc — DRT Sfax';

    /* ---- Feuille 1 : Bilan Global (synthèse mensuelle consolidée) ---- */
    {
      const rows = g.rows.map(r => [
        `${r.label} ${year}`, +r.fuelLitres.toFixed(2), +r.fuelMontant.toFixed(2), Math.round(r.fuelKm),
        +r.geLitres.toFixed(2), +r.geCout.toFixed(2), +r.totalLitres.toFixed(2), +r.totalCout.toFixed(2)
      ]);
      rows.push([
        `CUMUL ${year}`, +g.totals.fuelLitres.toFixed(2), +g.totals.fuelMontant.toFixed(2), Math.round(g.totals.fuelKm),
        +g.totals.geLitres.toFixed(2), +g.totals.geCout.toFixed(2), +g.totals.totalLitres.toFixed(2), +g.totals.totalCout.toFixed(2)
      ]);
      addStyledSheet(wb, {
        sheetName: 'Bilan_Global_' + year,
        title: `DRT SFAX — BILAN GLOBAL CARBURANT ${year} (VÉHICULES + GROUPES ÉLECTROGÈNES)`,
        headers: ['Mois', 'Litres Véh.', 'DT Véh.', 'Km Véh.', 'Litres GE', 'Coût GE estimé (DT)', 'Total Litres', 'Total Coût (DT)'],
        rows, boldLastRow: true,
        colWidths: [18, 14, 14, 12, 14, 18, 14, 16]
      });
    }

    /* ---- Feuille 2 : Récapitulatif annuel véhicules (cumul par véhicule) ---- */
    {
      const list = computeVehicleAnnualRecap(year);
      const rows = list.map(v => [v.matricule, v.modele || '—', v.chauffeur || '—', +v.litres.toFixed(2), +v.montant.toFixed(2), Math.round(v.km), +v.avgPct.toFixed(2), v.months]);
      addStyledSheet(wb, {
        sheetName: 'Recap_Vehicules_Annuel',
        title: `RÉCAPITULATIF ANNUEL VÉHICULES ${year} — CUMUL PAR VÉHICULE`,
        headers: ['Matricule', 'Modèle', 'Chauffeur', 'Cumul Litres', 'Cumul Montant (DT)', 'Cumul Km', 'Taux moyen (%)', 'Mois renseignés'],
        rows, colWidths: [14, 20, 20, 14, 16, 12, 14, 14]
      });
    }

    /* ---- Feuille 3 : Récapitulatif annuel GE (grille site x mois) ---- */
    {
      const grid = computeGEAnnualGrid(year);
      const rows = grid.map(s => [s.site, s.puiss, ...s.monthly, s.total]);
      const totals = ['TOTAL', ''];
      for (let m = 0; m < 12; m++) totals.push(+grid.reduce((sum, s) => sum + (s.monthly[m] || 0), 0).toFixed(2));
      totals.push(+grid.reduce((sum, s) => sum + s.total, 0).toFixed(2));
      rows.push(totals);
      addStyledSheet(wb, {
        sheetName: 'GE_Recap_Annuel',
        title: `RÉCAPITULATIF ANNUEL — CONSOMMATION GAZOIL (L) — GROUPES ÉLECTROGÈNES ${year}`,
        headers: ['Site', 'Puiss (kVA)', ...MONTH_LABELS, 'TOTAL ANNUEL'],
        rows, boldLastRow: true,
        colWidths: [18, 10, ...Array(12).fill(9), 12]
      });
    }

    /* ---- Feuilles mensuelles véhicules (Janv26 ... Decembre26) ---- */
    {
      const allData = (typeof getFuelData === 'function') ? getFuelData() : {};
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, '0')}`;
        const entries = Object.values((allData && allData[key]) || {});
        const rows = entries.map(e => [
          e.matricule || '—', e.modele || '—', e.chauffeur || '—',
          +(e.litres || 0).toFixed(2), +(e.montant || 0).toFixed(2), Math.round(e.km || 0),
          isFinite(e.pct) && e.pct ? +e.pct.toFixed(2) : 0, e.statut || '—'
        ]);
        addStyledSheet(wb, {
          sheetName: MONTH_SHEET_NAMES[m - 1],
          title: `DRT SFAX — SUIVI CARBURANT VÉHICULES — ${MONTH_LABELS[m - 1]} ${year}`,
          headers: ['Matricule', 'Modèle', 'Chauffeur', 'Litres', 'Montant (DT)', 'Km', 'Taux (%)', 'Statut'],
          rows, colWidths: [14, 20, 20, 12, 14, 10, 12, 16]
        });
      }
    }

    /* ---- Feuilles mensuelles GE (GE_Janv26 ... GE_Decembre26) ---- */
    {
      const sites = (typeof window.__GE_SITES !== 'undefined' && window.__GE_SITES) ? window.__GE_SITES : [];
      const list = (typeof getGEData === 'function') ? getGEData() : [];
      const compute = (typeof window.__geCompute === 'function') ? window.__geCompute : null;
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, '0')}`;
        const rows = sites.map(s => {
          const e = list.find(x => x.site === s.site && x.mois === key);
          if (!e) return [s.site, s.puiss, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          const c = compute ? compute(e) : {
            totalChargeDinar: (e.chargeMoisPrecDinar || 0) + (e.chargeCoursDinar || 0),
            totalChargeLitre: (e.chargeMoisPrecLitre || 0) + (e.chargeCoursLitre || 0),
            restantCarteLitre: 0, totalGazoil: (e.situMoisPrecL || 0) + (e.ravitL || 0),
            consMois: (bgNum(e.nbrH)) * (bgNum(e.consH)), restantGazoil: 0
          };
          return [
            s.site, s.puiss, +c.totalChargeDinar.toFixed(2), +c.totalChargeLitre.toFixed(2),
            +(e.sortieLitre || 0).toFixed(2), +(e.situMoisPrecL || 0).toFixed(2), +(e.ravitL || 0).toFixed(2),
            +c.totalGazoil.toFixed(2), +(e.nbrH || 0), +(e.consH || 0), +c.consMois.toFixed(2), +c.restantGazoil.toFixed(2)
          ];
        });
        addStyledSheet(wb, {
          sheetName: 'GE_' + MONTH_SHEET_NAMES[m - 1],
          title: `SITUATION GAZOIL — GROUPES ÉLECTROGÈNES — ${MONTH_LABELS[m - 1].toUpperCase()} ${year}`,
          headers: ['Site', 'Puiss (kVA)', 'Total Charge (DT)', 'Total Charge (L)', 'Sortie (L)', 'Sit-Mois-Préc (L)', 'Ravit (L)', 'Total Gazoil (L)', 'Nbr-H Marche/Mois', 'Cons/H (L)', 'Cons/Mois (L)', 'Restant Gazoil (L)'],
          rows, colWidths: [16, 10, 14, 14, 12, 14, 10, 14, 14, 10, 12, 14]
        });
      }
    }

    return wb;
  }

  function _btnState(btn, loading) {
    if (!btn) return;
    if (loading) { btn.dataset.originalLabel = btn.dataset.originalLabel || btn.innerHTML; btn.innerHTML = '⏳ Génération en cours...'; btn.disabled = true; }
    else { if (btn.dataset.originalLabel) btn.innerHTML = btn.dataset.originalLabel; btn.disabled = false; }
  }

  window.genererBilanGlobalExcel = function genererBilanGlobalExcel(evt) {
    const btn = evt && evt.target ? evt.target.closest('button') : null;
    const status = document.getElementById('bilan-global-status');
    _btnState(btn, true);
    if (status) status.textContent = '⏳ Génération Excel en cours...';
    _loadExcelJS(function (err) {
      if (err) { _btnState(btn, false); if (status) status.textContent = '❌ ' + err.message; return; }
      const year = _currentYear();
      buildBilanGlobalWorkbook(year).then(function (wb) {
        return wb.xlsx.writeBuffer();
      }).then(function (buf) {
        const blob = new Blob([buf], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'Bilan_Global_Carburant_' + year + '_DRT_Sfax_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        if (status) status.textContent = '✅ Fichier Excel généré.';
      }).catch(function (e) {
        console.error('[BilanGlobal] Erreur export Excel:', e);
        if (status) status.textContent = '❌ Erreur : ' + (e && e.message ? e.message : e);
      }).finally(function () { _btnState(btn, false); });
    });
  };

  /* ══════════════════════════════════════════════════════════
   *  EXPORT POWERPOINT (PptxGenJS — même moteur que fuel_rapport.js)
   * ══════════════════════════════════════════════════════════ */

  const PPTX_CDN = [
    'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
    'https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
    'https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
  ];
  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error('Échec chargement ' + src));
      document.head.appendChild(s);
    });
  }
  async function _loadPptxGenJs() {
    if (window.PptxGenJS) return window.PptxGenJS;
    if (window.__pptxgenjsLoading) return window.__pptxgenjsLoading;
    window.__pptxgenjsLoading = (async () => {
      let lastErr = null;
      for (const url of PPTX_CDN) {
        try { await _loadScript(url); if (window.PptxGenJS) return window.PptxGenJS; }
        catch (e) { lastErr = e; }
      }
      window.__pptxgenjsLoading = null;
      throw new Error('Impossible de charger PptxGenJS. ' + (lastErr ? lastErr.message : ''));
    })();
    return window.__pptxgenjsLoading;
  }

  function buildBilanGlobalPptx(PptxCtor, year) {
    const g = computeGlobal(year);
    const pres = new PptxCtor();
    pres.layout = 'LAYOUT_WIDE';
    pres.author = 'Parc Auto DRT Sfax';
    pres.title = `Bilan Global Carburant ${year} — DRT Sfax`;
    const W = 13.33;

    /* SLIDE 1 — TITRE */
    {
      const s = pres.addSlide();
      s.background = { color: COLORS.midnight };
      s.addShape(pres.shapes.OVAL, { x: 9.6, y: -2.2, w: 6, h: 6, fill: { color: COLORS.navy }, line: { type: 'none' } });
      s.addShape(pres.shapes.OVAL, { x: 10.6, y: 4.6, w: 4.2, h: 4.2, fill: { color: COLORS.teal, transparency: 82 }, line: { type: 'none' } });
      s.addText('⛽🔌', { x: 0.7, y: 0.75, w: 1.6, h: 1.2, fontSize: 40, align: 'left', valign: 'middle' });
      s.addText('BILAN GLOBAL CARBURANT — DRT SFAX', { x: 0.7, y: 1.75, w: 10, h: 0.5,
        fontSize: 14, color: COLORS.teal, bold: true, charSpacing: 3, fontFace: 'Calibri' });
      s.addText('Véhicules + Groupes Électrogènes', { x: 0.65, y: 2.25, w: 11, h: 1.3,
        fontSize: 44, color: COLORS.paper, bold: true, fontFace: 'Cambria' });
      s.addText(`Exercice ${year}`, { x: 0.7, y: 3.45, w: 9, h: 0.55, fontSize: 20, color: 'CBD5E1', fontFace: 'Calibri' });
      s.addShape(pres.shapes.LINE, { x: 0.7, y: 4.25, w: 3.2, h: 0, line: { color: COLORS.teal, width: 2 } });
      const chips = [
        [`${fmt(g.totals.totalLitres)} L`, 'carburant total'],
        [`${fmt(g.totals.totalCout)} DT`, 'coût global'],
      ];
      let cx = 0.7;
      chips.forEach(([big, small]) => {
        s.addText([{ text: big + '  ', options: { fontSize: 20, bold: true, color: COLORS.paper, breakLine: false } },
          { text: small, options: { fontSize: 12, color: '94A3B8' } }], { x: cx, y: 4.6, w: 4.2, h: 0.5, fontFace: 'Calibri' });
        cx += 4.2;
      });
      s.addText(`Généré le ${new Date().toLocaleDateString('fr-FR')} — Direction Régionale de Sfax`,
        { x: 0.7, y: 6.9, w: 8, h: 0.35, fontSize: 10.5, color: '64748B', fontFace: 'Calibri' });
    }

    /* SLIDE 2 — KPI */
    {
      const s = pres.addSlide();
      s.background = { color: COLORS.bg };
      s.addText('Bilan consolidé', { x: 0.6, y: 0.4, w: 8, h: 0.6, fontSize: 28, bold: true, color: COLORS.ink, fontFace: 'Cambria' });
      s.addText(`Exercice ${year} — Véhicules + Groupes Électrogènes`, { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: COLORS.slate, fontFace: 'Calibri' });
      const cards = [
        { icon: '⛽', big: `${fmt(g.totals.fuelLitres)} L`, label: 'Litres véhicules', color: COLORS.teal, soft: COLORS.tealSoft },
        { icon: '🔌', big: `${fmt(g.totals.geLitres)} L`, label: 'Litres groupes électrogènes', color: COLORS.amber, soft: COLORS.amberSoft },
        { icon: '🧮', big: `${fmt(g.totals.totalLitres)} L`, label: 'Total carburant global', color: COLORS.navy, soft: COLORS.mist },
        { icon: '💰', big: `${fmt(g.totals.fuelMontant)} DT`, label: 'Coût véhicules', color: COLORS.green, soft: COLORS.greenSoft },
        { icon: '💰', big: `${fmt(g.totals.geCout)} DT`, label: 'Coût GE estimé', color: COLORS.orange, soft: COLORS.amberSoft },
        { icon: '💶', big: `${fmt(g.totals.totalCout)} DT`, label: 'Coût global total', color: COLORS.navy, soft: COLORS.mist },
      ];
      const gx = 0.6, gy = 1.6, gw = (W - 1.2 - 2 * 0.35) / 3, gh = 1.7, gapX = 0.35, gapY = 0.35;
      cards.forEach((c, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = gx + col * (gw + gapX), y = gy + row * (gh + gapY);
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: gw, h: gh, rectRadius: 0.08, fill: { color: COLORS.paper },
          shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 90, opacity: 0.08 } });
        s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, fill: { color: c.soft }, line: { type: 'none' } });
        s.addText(c.icon, { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, fontSize: 20, align: 'center', valign: 'middle', margin: 0 });
        s.addText(c.big, { x: x + 0.25, y: y + 0.9, w: gw - 0.5, h: 0.5, fontSize: 20, bold: true, color: c.color, fontFace: 'Cambria', margin: 0 });
        s.addText(c.label, { x: x + 0.25, y: y + 1.35, w: gw - 0.5, h: 0.3, fontSize: 11, color: COLORS.slate, fontFace: 'Calibri', margin: 0 });
      });
    }

    /* SLIDE 3 — ÉVOLUTION MENSUELLE (véhicules vs GE) */
    {
      const s = pres.addSlide();
      s.background = { color: COLORS.paper };
      s.addText('Évolution mensuelle', { x: 0.6, y: 0.4, w: 8, h: 0.6, fontSize: 28, bold: true, color: COLORS.ink, fontFace: 'Cambria' });
      s.addText('Litres consommés — Véhicules vs Groupes Électrogènes', { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: COLORS.slate, fontFace: 'Calibri' });
      const labels = g.rows.map((r, i) => MONTH_SHORT[i]);
      const fuelL = g.rows.map(r => Math.round(r.fuelLitres));
      const geL = g.rows.map(r => Math.round(r.geLitres));
      s.addChart([
        { type: pres.charts.BAR, data: [{ name: 'Véhicules (L)', labels, values: fuelL }, { name: 'Groupes Électrogènes (L)', labels, values: geL }],
          options: { barDir: 'col', chartColors: [COLORS.teal, COLORS.amber] } }
      ], {
        x: 0.6, y: 1.55, w: 12.1, h: 4.5, chartArea: { fill: { color: COLORS.paper } },
        catAxisLabelColor: COLORS.slate, valAxisLabelColor: COLORS.slate,
        valAxisTitle: 'Litres', showValAxisTitle: true, valAxisTitleColor: COLORS.slate, valAxisTitleFontSize: 10,
        valGridLine: { color: COLORS.mist, size: 0.75 }, catGridLine: { style: 'none' },
        showValue: false, showLegend: true, legendPos: 'b', legendColor: COLORS.slate, legendFontSize: 11,
      });
      s.addText(`Total période : ${fmt(g.totals.totalLitres)} L · ${fmt(g.totals.totalCout)} DT`,
        { x: 0.6, y: 6.85, w: 8, h: 0.35, fontSize: 11, color: COLORS.slate, fontFace: 'Calibri' });
    }

    /* SLIDE 4 — TABLEAU RÉCAPITULATIF */
    {
      const s = pres.addSlide();
      s.background = { color: COLORS.bg };
      s.addText('Détail mensuel', { x: 0.6, y: 0.4, w: 8, h: 0.6, fontSize: 28, bold: true, color: COLORS.ink, fontFace: 'Cambria' });
      const rows = [['Mois', 'Litres Véh.', 'DT Véh.', 'Litres GE', 'Coût GE (DT)', 'Total (L)', 'Total (DT)']];
      g.rows.forEach(r => rows.push([r.label, fmt(r.fuelLitres), fmt(r.fuelMontant), fmt(r.geLitres), fmt(r.geCout), fmt(r.totalLitres), fmt(r.totalCout)]));
      rows.push([`CUMUL ${year}`, fmt(g.totals.fuelLitres), fmt(g.totals.fuelMontant), fmt(g.totals.geLitres), fmt(g.totals.geCout), fmt(g.totals.totalLitres), fmt(g.totals.totalCout)]);
      s.addTable(rows, {
        x: 0.4, y: 1.15, w: 12.5, h: 5.8, fontSize: 9.5, fontFace: 'Calibri',
        border: { type: 'solid', color: COLORS.mist, pt: 0.5 },
        color: COLORS.ink, align: 'center',
        fill: { color: COLORS.paper },
        autoPage: true,
      });
    }

    return pres;
  }

  window.genererBilanGlobalPPTX = async function genererBilanGlobalPPTX(evt) {
    const btn = evt && evt.target ? evt.target.closest('button') : null;
    const status = document.getElementById('bilan-global-status');
    try {
      _btnState(btn, true);
      if (status) status.textContent = '⏳ Génération PPT en cours...';
      const PptxCtor = await _loadPptxGenJs();
      const year = _currentYear();
      const pres = buildBilanGlobalPptx(PptxCtor, year);
      await pres.writeFile({ fileName: 'Bilan_Global_Carburant_' + year + '_DRT_Sfax_' + new Date().toISOString().slice(0, 10) + '.pptx' });
      if (status) status.textContent = '✅ Rapport PowerPoint généré.';
    } catch (err) {
      console.error('[BilanGlobal] Erreur génération PPTX:', err);
      if (status) status.textContent = '❌ Erreur : ' + (err && err.message ? err.message : err);
    } finally {
      _btnState(btn, false);
    }
  };

  /* Rendu automatique dès que l'onglet devient visible (si parcAuto expose un hook) */
  document.addEventListener('DOMContentLoaded', function () {
    const nav = document.querySelector('[data-nav="bilan-global"]');
    if (nav) nav.addEventListener('click', function () { setTimeout(renderBilanGlobalDashboard, 50); });
  });

})();
