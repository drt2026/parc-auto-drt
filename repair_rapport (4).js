/**
 * ============================================================
 *  REPAIR_RAPPORT.JS — Module Dépenses Réparations Pluriannuel — DRT Sfax
 *  Import Excel historique (format "depenses anciennes") +
 *  Dashboard statistiques + Rapport Excel avec graphiques
 *  À inclure dans admin.html APRÈS le script SheetJS existant
 *  <script src="repair_rapport.js"></script>
 *  Ne modifie AUCUNE fonction existante — module 100% additif.
 * ============================================================
 */
(function () {
  'use strict';

  const REPAIR_HIST_KEY = 'parcAutoRepairHist_v1';
  // Structure : { "2025": { "17-355557": {matricule,chauffeur,marque,division,subdivision,montant,nbVidange,nbAccident}, ... }, ... }

  /* ── Couleurs branding (identiques à fuel_rapport.js) ── */
  const CLR = {
    navyFg  : 'FFFFFFFF', navyBg  : 'FF1E3A5F',
    orangeBg: 'FFEF6C00', orangeFg: 'FFFFFFFF',
    greyBg  : 'FFF1F5F9', greyFg  : 'FF1E293B',
    whiteBg : 'FFFFFFFF',
    greenBg : 'FFD1FAE5', greenFg : 'FF065F46',
    redBg   : 'FFFEE2E2', redFg   : 'FF991B1B',
    borderClr: 'FFE2E8F0', alertBg : 'FFFFF3CD',
  };

  /* ══════════════════════════════════════════════════════════
   *  HELPERS DONNÉES
   * ══════════════════════════════════════════════════════════ */
  function getRepairHistData() {
    try { return JSON.parse(localStorage.getItem(REPAIR_HIST_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveRepairHistData(data) {
    localStorage.setItem(REPAIR_HIST_KEY, JSON.stringify(data));
  }
  function currentHistYear() {
    return document.getElementById('repair-hist-year-select')?.value || String(new Date().getFullYear());
  }
  /* Normalise une chaîne (casse/espaces) pour regrouper les variantes identiques */
  function normKey(s) { return String(s || '—').trim().toLowerCase().replace(/\s+/g, ' '); }

  function initRepairHistYearSelect() {
    const sel = document.getElementById('repair-hist-year-select');
    if (!sel || sel.options.length) return;
    const data = getRepairHistData();
    const years = Object.keys(data).map(Number);
    const curYear = new Date().getFullYear();
    const minY = years.length ? Math.min(...years, curYear - 5) : curYear - 5;
    const maxY = curYear;
    for (let y = minY; y <= maxY; y++) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      if (y === curYear) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  /* ══════════════════════════════════════════════════════════
   *  IMPORT EXCEL HISTORIQUE (format "depenses anciennes")
   * ══════════════════════════════════════════════════════════ */
  function handleRepairHistImport(evt) {
    const file = evt.target.files[0];
    if (!file) return;
    const status = document.getElementById('repair-hist-import-status');
    status.textContent = '⏳ Lecture du fichier...';

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const sheetName = wb.SheetNames.find(n => /depenses?\s*anciennes?|d[ée]pens/i.test(n)) || wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];

        // Détecte automatiquement la ligne d'en-tête (cherche "Immatriculation")
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        let headerRowIdx = raw.findIndex(row => row.some(c => /immatriculation/i.test(String(c))));
        if (headerRowIdx === -1) headerRowIdx = 0;

        const headers = raw[headerRowIdx].map(h => String(h).trim());
        const dataRows = raw.slice(headerRowIdx + 1);

        const findCol = (patterns) => {
          for (const p of patterns) {
            const idx = headers.findIndex(h => p.test(h));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const iImmat   = findCol([/immatriculation/i]);
        const iChauf   = findCol([/chauffeur/i]);
        const iMarque  = findCol([/marque/i]);
        const iDiv     = findCol([/^division$/i, /division/i]);
        const iSubdiv  = findCol([/subdivision/i]);
        const iAncien  = findCol([/anciennet/i]);
        const iGenre   = findCol([/genre/i]);
        const iVidange = findCol([/nb\s*vidange/i]);
        const iChaine  = findCol([/nb\s*chaine/i]);
        const iAccident= findCol([/nb\s*accident/i]);

        // Colonnes années : en-têtes numériques (2020, 2021, ...)
        const yearCols = [];
        headers.forEach((h, idx) => {
          const n = parseInt(h);
          if (!isNaN(n) && n >= 2000 && n <= 2100) yearCols.push({ year: n, idx });
        });

        if (iImmat === -1 || !yearCols.length) {
          status.textContent = '❌ Format non reconnu (colonnes Immatriculation / années introuvables)';
          return;
        }

        const allData = getRepairHistData();
        let imported = 0;

        // Pour chaque année détectée dans le fichier, on construit/écrase l'entrée correspondante
        yearCols.forEach(({ year, idx: colIdx }) => {
          const yearData = allData[String(year)] || {};
          dataRows.forEach(row => {
            const immat = String(row[iImmat] || '').trim();
            if (!immat || /^immat/i.test(immat)) return;
            const montant = parseFloat(row[colIdx]) || 0;

            yearData[immat] = {
              matricule: immat,
              chauffeur: iChauf !== -1 ? String(row[iChauf] || '').trim() : '—',
              marque:    iMarque !== -1 ? String(row[iMarque] || '').trim() : '—',
              genre:     iGenre !== -1 ? String(row[iGenre] || '').trim() : '',
              division:  iDiv !== -1 ? String(row[iDiv] || '').trim() : '—',
              subdivision: iSubdiv !== -1 ? String(row[iSubdiv] || '').trim() : '',
              anciennete: iAncien !== -1 ? String(row[iAncien] || '').trim() : '',
              montant:   +montant.toFixed(2),
              nbVidange: iVidange !== -1 ? (parseInt(row[iVidange]) || 0) : 0,
              nbChaine:  iChaine !== -1 ? (parseInt(row[iChaine]) || 0) : 0,
              nbAccident:iAccident !== -1 ? (parseInt(row[iAccident]) || 0) : 0,
            };
            imported++;
          });
          allData[String(year)] = yearData;
        });

        saveRepairHistData(allData);
        status.textContent = `✅ ${yearCols.length} année(s) importée(s) — ${imported} lignes traitées`;

        // Met à jour le sélecteur d'année si nouvelle année
        const sel = document.getElementById('repair-hist-year-select');
        yearCols.forEach(({ year }) => {
          if (![...sel.options].some(o => o.value == year)) {
            const opt = document.createElement('option');
            opt.value = year; opt.textContent = year;
            sel.appendChild(opt);
          }
        });
        sel.value = Math.max(...yearCols.map(y => y.year));

        renderRepairHistDashboard();
      } catch (err) {
        console.error(err);
        status.textContent = '❌ Erreur de lecture — ' + err.message;
      }
    };
    reader.readAsArrayBuffer(file);
    evt.target.value = '';
  }

  function clearRepairHistYear() {
    const year = currentHistYear();
    if (!confirm(`Effacer toutes les données réparations de l'année ${year} ?`)) return;
    const allData = getRepairHistData();
    delete allData[year];
    saveRepairHistData(allData);
    renderRepairHistDashboard();
  }

  /* ══════════════════════════════════════════════════════════
   *  DASHBOARD : KPI + TABLEAUX
   * ══════════════════════════════════════════════════════════ */
  function renderRepairHistKPI(yearData) {
    const entries = Object.values(yearData || {});
    const total = entries.reduce((s, e) => s + e.montant, 0);
    const nbVeh = entries.length;
    const avg = nbVeh ? total / nbVeh : 0;
    const nbAccidents = entries.reduce((s, e) => s + (e.nbAccident || 0), 0);
    const nbVidanges = entries.reduce((s, e) => s + (e.nbVidange || 0), 0);

    document.getElementById('repair-hist-kpi-grid').innerHTML = `
      <div class="stat-card"><div class="stat-icon blue">💰</div><div class="stat-info"><h3>${total.toLocaleString('fr-FR',{maximumFractionDigits:0})} DT</h3><p>Dépense totale</p></div></div>
      <div class="stat-card"><div class="stat-icon green">🚗</div><div class="stat-info"><h3>${nbVeh}</h3><p>Véhicules concernés</p></div></div>
      <div class="stat-card"><div class="stat-icon orange">📊</div><div class="stat-info"><h3>${avg.toLocaleString('fr-FR',{maximumFractionDigits:0})} DT</h3><p>Moyenne / véhicule</p></div></div>
      <div class="stat-card"><div class="stat-icon red">🛠️</div><div class="stat-info"><h3>${nbVidanges}</h3><p>Vidanges effectuées</p></div></div>
      <div class="stat-card"><div class="stat-icon red">⚠️</div><div class="stat-info"><h3>${nbAccidents}</h3><p>Accidents enregistrés</p></div></div>
    `;
  }

  function renderRepairHistDivision(yearData) {
    const entries = Object.values(yearData || {});
    const total = entries.reduce((s, e) => s + e.montant, 0);
    const byDiv = {};
    entries.forEach(e => {
      const raw = (e.division || '—').trim();
      const key = normKey(raw);
      if (!byDiv[key]) byDiv[key] = { division: raw, nb: 0, total: 0 };
      byDiv[key].nb++;
      byDiv[key].total += e.montant;
    });
    const list = Object.values(byDiv).sort((a, b) => b.total - a.total);
    const tbody = document.getElementById('repair-hist-division-body');
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--secondary);">Aucune donnée pour cette année</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(d => `
      <tr>
        <td><strong>${d.division}</strong></td>
        <td>${d.nb}</td>
        <td>${d.total.toLocaleString('fr-FR',{maximumFractionDigits:0})} DT</td>
        <td>${(d.total/d.nb).toLocaleString('fr-FR',{maximumFractionDigits:0})} DT</td>
        <td>${total > 0 ? ((d.total/total)*100).toFixed(1) : 0}%</td>
      </tr>`).join('');
  }

  function renderRepairHistMarque(yearData) {
    const entries = Object.values(yearData || {});
    const byMarque = {};
    entries.forEach(e => {
      const raw = (e.marque || '—').trim();
      const key = normKey(raw);
      if (!byMarque[key]) byMarque[key] = { marque: raw, nb: 0, total: 0 };
      byMarque[key].nb++;
      byMarque[key].total += e.montant;
    });
    const list = Object.values(byMarque).sort((a, b) => b.total - a.total);
    const tbody = document.getElementById('repair-hist-marque-body');
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--secondary);">Aucune donnée pour cette année</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(m => `
      <tr>
        <td><strong>${m.marque}</strong></td>
        <td>${m.nb}</td>
        <td>${m.total.toLocaleString('fr-FR',{maximumFractionDigits:0})} DT</td>
        <td>${(m.total/m.nb).toLocaleString('fr-FR',{maximumFractionDigits:0})} DT</td>
      </tr>`).join('');
  }

  function renderRepairHistTop10(yearData) {
    const entries = Object.values(yearData || {});
    const total = entries.reduce((s, e) => s + e.montant, 0);
    const sorted = [...entries].sort((a, b) => b.montant - a.montant).slice(0, 10);
    const tbody = document.getElementById('repair-hist-top10-body');
    if (!sorted.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--secondary);">Aucune donnée pour cette année</td></tr>`;
      return;
    }
    tbody.innerHTML = sorted.map((e, i) => `
      <tr style="${i < 3 ? 'background:#fff7ed;' : ''}">
        <td><strong>${i+1}</strong></td>
        <td>${e.matricule}</td>
        <td>${e.chauffeur}</td>
        <td>${e.marque}</td>
        <td>${e.division}</td>
        <td>${e.montant.toLocaleString('fr-FR',{maximumFractionDigits:0})} DT</td>
        <td>${total > 0 ? ((e.montant/total)*100).toFixed(1) : 0}%</td>
      </tr>`).join('');
  }

  /* ── Graphique évolution annuelle (barres CSS) ── */
  function renderRepairHistEvolutionChart() {
    const allData = getRepairHistData();
    const years = Object.keys(allData).map(Number).sort((a,b) => a-b);
    if (!years.length) {
      document.getElementById('repair-hist-evolution-chart').innerHTML =
        '<p style="text-align:center;padding:20px;color:var(--secondary);">Aucune donnée importée</p>';
      return;
    }
    const totals = years.map(y => Object.values(allData[y]).reduce((s,e) => s + e.montant, 0));
    const max = Math.max(...totals, 1);

    document.getElementById('repair-hist-evolution-chart').innerHTML = `
      <div style="display:flex;align-items:flex-end;gap:14px;height:200px;padding:0 8px;">
        ${totals.map((t,i) => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;">
            <div style="font-size:11px;color:var(--secondary);font-weight:700;">${t>0?Math.round(t).toLocaleString('fr-FR'):''}</div>
            <div style="width:100%;background:linear-gradient(180deg,#ef6c00,#1e3a5f);border-radius:6px 6px 0 0;height:${Math.max((t/max)*150,t>0?4:0)}px;"></div>
            <div style="font-size:12px;color:var(--secondary);font-weight:700;">${years[i]}</div>
          </div>`).join('')}
      </div>
      <div style="text-align:center;font-size:12px;color:var(--secondary);margin-top:8px;">Dépense totale réparations par année (DT)</div>
    `;
  }

  /* ── Graphique répartition Division (barres horizontales) ── */
  function renderRepairHistDivisionChart(yearData) {
    const entries = Object.values(yearData || {});
    const byDiv = {};
    const labelByKey = {};
    entries.forEach(e => {
      const raw = (e.division || '—').trim();
      const key = normKey(raw);
      labelByKey[key] = raw;
      byDiv[key] = (byDiv[key] || 0) + e.montant;
    });
    const list = Object.entries(byDiv).map(([key, val]) => [labelByKey[key], val]).sort((a,b) => b[1]-a[1]);
    const max = Math.max(...list.map(d => d[1]), 1);
    const el = document.getElementById('repair-hist-division-chart');
    if (!list.length) { el.innerHTML = '<p style="text-align:center;padding:20px;color:var(--secondary);">Aucune donnée pour cette année</p>'; return; }

    el.innerHTML = list.map(([div, val]) => `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
          <span style="font-weight:600;color:var(--text);">${div}</span>
          <span style="color:var(--secondary);">${Math.round(val).toLocaleString('fr-FR')} DT</span>
        </div>
        <div style="background:#f1f5f9;border-radius:6px;height:14px;overflow:hidden;">
          <div style="width:${(val/max)*100}%;height:100%;background:linear-gradient(90deg,#1e3a5f,#ef6c00);border-radius:6px;"></div>
        </div>
      </div>`).join('');
  }

  function renderRepairHistDashboard() {
    const allData = getRepairHistData();
    const year = currentHistYear();
    const yearData = allData[year] || {};
    renderRepairHistKPI(yearData);
    renderRepairHistDivision(yearData);
    renderRepairHistMarque(yearData);
    renderRepairHistTop10(yearData);
    renderRepairHistEvolutionChart();
    renderRepairHistDivisionChart(yearData);
  }

  /* ══════════════════════════════════════════════════════════
   *  GRAPHIQUES EN BARRES — DIRECTEMENT DANS LES CELLULES EXCEL
   *  (la bibliothèque XLSX gratuite ne supporte pas l'insertion
   *   d'images ; on simule des barres avec des caractères pleins
   *   colorés selon la proportion de la valeur max)
   * ══════════════════════════════════════════════════════════ */
  const BAR_CHAR = '█';
  const BAR_MAXLEN = 30;

  function barString(value, max) {
    if (max <= 0) return '';
    const len = Math.max(1, Math.round((value / max) * BAR_MAXLEN));
    return BAR_CHAR.repeat(len);
  }

  function barColorByRank(idx, n) {
    // Dégradé navy → orange selon le rang (1er = orange vif, dernier = navy clair)
    const palette = ['FFEF6C00','FFF2872B','FFF59E0B','FF1E3A5F','FF334155','FF475569','FF64748B'];
    return palette[Math.min(idx, palette.length - 1)];
  }

  /* Ajoute une feuille "graphique en barres" pour une série label/valeur */
  function buildBarChartSheet(wb, sheetName, titre, labels, values, unitLabel) {
    const ws = {};
    setColWidths(ws, [28, 14, BAR_MAXLEN + 4]);

    addMerge(ws, 0, 0, 0, 2);
    writeCell(ws, 0, 0, titre, hdr('navyBg', 'navyFg'));

    const cols = ['Libellé', `Valeur (${unitLabel})`, 'Graphique'];
    cols.forEach((c, i) => writeCell(ws, 2, i, c, hdr('orangeBg', 'orangeFg')));

    const max = Math.max(...values, 1);
    labels.forEach((lbl, idx) => {
      const r = 3 + idx;
      const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
      writeCell(ws, r, 0, lbl, dataCell(false, true, bg));
      writeCell(ws, r, 1, +values[idx].toFixed(2), dataCell(true, false, bg));
      writeCell(ws, r, 2, barString(values[idx], max), {
        fill: { fgColor: { rgb: CLR[bg] } },
        font: { color: { rgb: barColorByRank(idx, labels.length) }, sz: 13, name: 'Consolas' },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: thinBorder()
      });
    });

    ws['!ref'] = `A1:C${3 + labels.length + 1}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  /* ══════════════════════════════════════════════════════════
   *  RAPPORT EXCEL — HELPERS STYLE (mêmes conventions que fuel_rapport.js)
   * ══════════════════════════════════════════════════════════ */
  function cellRef(r, c) { return String.fromCharCode(65 + c) + (r + 1); }
  function styleCell(ws, addr, style) { if (!ws[addr]) ws[addr] = { t: 'z', v: '' }; ws[addr].s = style; }
  function writeCell(ws, r, c, value, style) {
    const addr = cellRef(r, c);
    const t = typeof value === 'number' ? 'n' : 's';
    ws[addr] = { t, v: value };
    if (style) ws[addr].s = style;
    return addr;
  }
  function setColWidths(ws, widths) { ws['!cols'] = widths.map(w => ({ wch: w })); }
  function addMerge(ws, r1, c1, r2, c2) {
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
  }
  function thinBorder() {
    const b = { style: 'thin', color: { rgb: CLR.borderClr } };
    return { top: b, bottom: b, left: b, right: b };
  }
  function hdr(bgKey, fgKey, bold) {
    return {
      fill: { fgColor: { rgb: CLR[bgKey] } },
      font: { bold: bold !== false, color: { rgb: CLR[fgKey] }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: thinBorder()
    };
  }
  function dataCell(num, bold, bgKey) {
    return {
      fill: { fgColor: { rgb: CLR[bgKey || 'whiteBg'] } },
      font: { bold: !!bold, color: { rgb: CLR.greyFg }, sz: 10 },
      alignment: { horizontal: num ? 'right' : 'left', vertical: 'center' },
      border: thinBorder(),
      numFmt: num ? '#,##0.00' : '@'
    };
  }
  function totalRow() {
    return {
      fill: { fgColor: { rgb: CLR.orangeBg } },
      font: { bold: true, color: { rgb: CLR.orangeFg }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder(), numFmt: '#,##0.00'
    };
  }

  /* ══════════════════════════════════════════════════════════
   *  FEUILLE : PAGE DE GARDE
   * ══════════════════════════════════════════════════════════ */
  function buildRepairCoverSheet(wb, annee) {
    const ws = {};
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
    setColWidths(ws, [5, 20, 20, 20, 20, 20, 5]);

    addMerge(ws, 2, 1, 3, 5);
    writeCell(ws, 2, 1, 'TUNISIE TELECOM', {
      fill: { fgColor: { rgb: CLR.navyBg } },
      font: { bold: true, color: { rgb: CLR.navyFg }, sz: 20 },
      alignment: { horizontal: 'center', vertical: 'center' }
    });
    addMerge(ws, 5, 1, 6, 5);
    writeCell(ws, 5, 1, `RAPPORT ANNUEL DES DÉPENSES — ${annee}`, {
      fill: { fgColor: { rgb: CLR.orangeBg } },
      font: { bold: true, color: { rgb: CLR.orangeFg }, sz: 16 },
      alignment: { horizontal: 'center', vertical: 'center' }
    });
    addMerge(ws, 8, 1, 9, 5);
    writeCell(ws, 8, 1, 'Réparations & Maintenance — Parc Automobile DRT Sfax', {
      fill: { fgColor: { rgb: CLR.greyBg } },
      font: { bold: true, color: { rgb: CLR.greyFg }, sz: 13 },
      alignment: { horizontal: 'center', vertical: 'center' }
    });

    const rows = [
      ['Direction Régionale', 'DRT Sfax'],
      ['Responsable Parc', 'Chef de Parc'],
      ["Année d'exercice", String(annee)],
      ["Date d'édition", dateStr],
    ];
    rows.forEach(([lbl, val], i) => {
      const r = 12 + i * 2;
      addMerge(ws, r, 1, r, 3);
      writeCell(ws, r, 1, lbl, hdr('navyBg', 'navyFg'));
      addMerge(ws, r, 4, r, 5);
      writeCell(ws, r, 4, val, dataCell(false, true, 'greyBg'));
    });

    ws['!ref'] = `A1:G${12 + rows.length * 2 + 4}`;
    XLSX.utils.book_append_sheet(wb, ws, 'Page de garde');
  }

  /* ══════════════════════════════════════════════════════════
   *  FEUILLE : SYNTHÈSE GLOBALE + GRAPHIQUE ÉVOLUTION
   * ══════════════════════════════════════════════════════════ */
  function buildRepairSynthSheet(wb, allData, annee) {
    const ws = {};
    setColWidths(ws, [22, 18, 5, 5, 5, 5, 5, 5, 5, 5]);

    addMerge(ws, 0, 0, 0, 5);
    writeCell(ws, 0, 0, 'SYNTHÈSE GLOBALE — DÉPENSES RÉPARATIONS', hdr('navyBg', 'navyFg'));

    const years = Object.keys(allData).map(Number).sort((a, b) => a - b);
    const yearData = allData[String(annee)] || {};
    const entries = Object.values(yearData);
    const total = entries.reduce((s, e) => s + e.montant, 0);
    const nbVeh = entries.length;
    const totalAll = years.reduce((s, y) => s + Object.values(allData[y]).reduce((s2, e) => s2 + e.montant, 0), 0);
    const moyAnnuelle = years.length ? totalAll / years.length : 0;

    const kpis = [
      [`Dépense totale ${annee}`, total.toFixed(2) + ' DT'],
      ['Véhicules concernés', nbVeh],
      ['Moyenne / véhicule', nbVeh ? (total / nbVeh).toFixed(2) + ' DT' : '0 DT'],
      ['Total toutes années importées', totalAll.toFixed(2) + ' DT'],
      ['Moyenne annuelle (toutes années)', moyAnnuelle.toFixed(2) + ' DT'],
      ['Nombre d\'années importées', years.length],
      ['Vidanges effectuées', entries.reduce((s, e) => s + (e.nbVidange || 0), 0)],
      ['Accidents enregistrés', entries.reduce((s, e) => s + (e.nbAccident || 0), 0)],
    ];
    kpis.forEach(([lbl, val], i) => {
      const r = 2 + i;
      writeCell(ws, r, 0, lbl, hdr('greyBg', 'greyFg'));
      addMerge(ws, r, 1, r, 3);
      writeCell(ws, r, 1, val, { ...dataCell(false, true), alignment: { horizontal: 'left' } });
    });

    ws['!ref'] = `A1:J${2 + kpis.length + 2}`;
    XLSX.utils.book_append_sheet(wb, ws, 'Synthèse');

    // Feuille graphique évolution (barres en cellules)
    if (years.length >= 1) {
      const labels = years.map(String);
      const values = years.map(y => Object.values(allData[y]).reduce((s, e) => s + e.montant, 0));
      buildBarChartSheet(wb, 'Graph. Évolution', `ÉVOLUTION ANNUELLE DES DÉPENSES (DT)`, labels, values, 'DT');
    }
  }

  /* ══════════════════════════════════════════════════════════
   *  FEUILLE : RÉPARTITION PAR DIVISION (table + graphique)
   * ══════════════════════════════════════════════════════════ */
  function buildRepairDivisionSheet(wb, yearData, annee) {
    const ws = {};
    setColWidths(ws, [28, 14, 16, 18, 12]);

    addMerge(ws, 0, 0, 0, 4);
    writeCell(ws, 0, 0, `DÉPENSES PAR DIVISION — ${annee}`, hdr('navyBg', 'navyFg'));

    const cols = ['Division', 'Nb véhicules', 'Total (DT)', 'Moy/véh (DT)', '% Budget'];
    cols.forEach((c, i) => writeCell(ws, 2, i, c, hdr('orangeBg', 'orangeFg')));

    const entries = Object.values(yearData || {});
    const total = entries.reduce((s, e) => s + e.montant, 0);
    const byDiv = {};
    entries.forEach(e => {
      const rawDiv = (e.division || '—').trim();
      const key = rawDiv.toLowerCase();
      if (!byDiv[key]) byDiv[key] = { division: rawDiv, nb: 0, total: 0 };
      byDiv[key].nb++; byDiv[key].total += e.montant;
    });
    const list = Object.values(byDiv).sort((a, b) => b.total - a.total);

    list.forEach((d, idx) => {
      const r = 3 + idx;
      const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
      writeCell(ws, r, 0, d.division, dataCell(false, true, bg));
      writeCell(ws, r, 1, d.nb, { ...dataCell(false, false, bg), numFmt: '#,##0' });
      writeCell(ws, r, 2, +d.total.toFixed(2), dataCell(true, false, bg));
      writeCell(ws, r, 3, +(d.total / d.nb).toFixed(2), dataCell(true, false, bg));
      writeCell(ws, r, 4, total > 0 ? +((d.total / total) * 100).toFixed(1) : 0, { ...dataCell(true, false, bg), numFmt: '0.0"%"' });
    });

    const tr = 3 + list.length;
    const ts = totalRow();
    writeCell(ws, tr, 0, 'TOTAL', ts);
    writeCell(ws, tr, 1, entries.length, { ...ts, numFmt: '#,##0' });
    writeCell(ws, tr, 2, +total.toFixed(2), ts);
    writeCell(ws, tr, 3, '', ts);
    writeCell(ws, tr, 4, 100, { ...ts, numFmt: '0.0"%"' });

    ws['!ref'] = `A1:E${tr + 2}`;
    XLSX.utils.book_append_sheet(wb, ws, 'Par Division');

    // Feuille graphique répartition Division (barres en cellules)
    if (list.length) {
      buildBarChartSheet(wb, 'Graph. Division', `RÉPARTITION PAR DIVISION — ${annee} (DT)`,
        list.map(d => d.division), list.map(d => d.total), 'DT');
    }
  }

  /* ══════════════════════════════════════════════════════════
   *  FEUILLE : RÉPARTITION PAR MARQUE (table + graphique)
   * ══════════════════════════════════════════════════════════ */
  function buildRepairMarqueSheet(wb, yearData, annee) {
    const ws = {};
    setColWidths(ws, [22, 14, 16, 18]);

    addMerge(ws, 0, 0, 0, 3);
    writeCell(ws, 0, 0, `DÉPENSES PAR MARQUE / MODÈLE — ${annee}`, hdr('navyBg', 'navyFg'));

    const cols = ['Marque', 'Nb véhicules', 'Total (DT)', 'Moy/véh (DT)'];
    cols.forEach((c, i) => writeCell(ws, 2, i, c, hdr('orangeBg', 'orangeFg')));

    const entries = Object.values(yearData || {});
    const byMarque = {};
    entries.forEach(e => {
      const raw = (e.marque || '—').trim();
      const key = normKey(raw);
      if (!byMarque[key]) byMarque[key] = { marque: raw, nb: 0, total: 0 };
      byMarque[key].nb++; byMarque[key].total += e.montant;
    });
    const list = Object.values(byMarque).sort((a, b) => b.total - a.total);

    list.forEach((m, idx) => {
      const r = 3 + idx;
      const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
      writeCell(ws, r, 0, m.marque, dataCell(false, true, bg));
      writeCell(ws, r, 1, m.nb, { ...dataCell(false, false, bg), numFmt: '#,##0' });
      writeCell(ws, r, 2, +m.total.toFixed(2), dataCell(true, false, bg));
      writeCell(ws, r, 3, +(m.total / m.nb).toFixed(2), dataCell(true, false, bg));
    });

    const tr = 3 + list.length;
    const ts = totalRow();
    const total = list.reduce((s, m) => s + m.total, 0);
    writeCell(ws, tr, 0, 'TOTAL', ts);
    writeCell(ws, tr, 1, entries.length, { ...ts, numFmt: '#,##0' });
    writeCell(ws, tr, 2, +total.toFixed(2), ts);
    writeCell(ws, tr, 3, '', ts);

    ws['!ref'] = `A1:D${tr + 2}`;
    XLSX.utils.book_append_sheet(wb, ws, 'Par Marque');

    // Feuille graphique top marques (barres en cellules)
    if (list.length) {
      const top = list.slice(0, 10);
      buildBarChartSheet(wb, 'Graph. Marques', `TOP MARQUES — DÉPENSE ${annee} (DT)`,
        top.map(m => m.marque), top.map(m => m.total), 'DT');
    }
  }

  /* ══════════════════════════════════════════════════════════
   *  FEUILLE : TOP 10 VÉHICULES
   * ══════════════════════════════════════════════════════════ */
  function buildRepairTop10Sheet(wb, yearData, annee) {
    const ws = {};
    setColWidths(ws, [5, 14, 22, 16, 24, 16, 10]);

    const entries = Object.values(yearData || {});
    const total = entries.reduce((s, e) => s + e.montant, 0);
    const sorted = [...entries].sort((a, b) => b.montant - a.montant).slice(0, 10);

    addMerge(ws, 0, 0, 0, 6);
    writeCell(ws, 0, 0, `TOP 10 VÉHICULES LES PLUS COÛTEUX — ${annee}`, hdr('navyBg', 'navyFg'));

    const cols = ['#', 'Matricule', 'Chauffeur', 'Marque', 'Division', 'Total (DT)', '% Budget'];
    cols.forEach((c, i) => writeCell(ws, 2, i, c, hdr('orangeBg', 'orangeFg')));

    sorted.forEach((e, idx) => {
      const r = 3 + idx;
      const bg = idx < 3 ? 'alertBg' : (idx % 2 === 0 ? 'whiteBg' : 'greyBg');
      writeCell(ws, r, 0, idx + 1, { ...dataCell(true, true, bg), alignment: { horizontal: 'center' } });
      writeCell(ws, r, 1, e.matricule, dataCell(false, true, bg));
      writeCell(ws, r, 2, e.chauffeur, dataCell(false, false, bg));
      writeCell(ws, r, 3, e.marque, dataCell(false, false, bg));
      writeCell(ws, r, 4, e.division, dataCell(false, false, bg));
      writeCell(ws, r, 5, +e.montant.toFixed(2), dataCell(true, false, bg));
      writeCell(ws, r, 6, total > 0 ? +((e.montant / total) * 100).toFixed(1) : 0, { ...dataCell(true, false, bg), numFmt: '0.0"%"' });
    });

    ws['!ref'] = `A1:G${3 + sorted.length + 2}`;
    XLSX.utils.book_append_sheet(wb, ws, 'Top 10');

    // Feuille graphique top 10 (barres en cellules)
    if (sorted.length) {
      buildBarChartSheet(wb, 'Graph. Top10', `TOP 10 VÉHICULES — ${annee} (DT)`,
        sorted.map(e => e.matricule), sorted.map(e => e.montant), 'DT');
    }
  }

  /* ══════════════════════════════════════════════════════════
   *  FEUILLE : LISTE DÉTAILLÉE
   * ══════════════════════════════════════════════════════════ */
  function buildRepairDetailSheet(wb, yearData, annee) {
    const ws = {};
    setColWidths(ws, [14, 22, 18, 24, 24, 14, 10, 10]);

    addMerge(ws, 0, 0, 0, 7);
    writeCell(ws, 0, 0, `LISTE DÉTAILLÉE DES DÉPENSES — ${annee}`, hdr('navyBg', 'navyFg'));

    const cols = ['Matricule', 'Chauffeur', 'Marque', 'Division', 'Subdivision', 'Montant (DT)', 'Vidanges', 'Accidents'];
    cols.forEach((c, i) => writeCell(ws, 2, i, c, hdr('orangeBg', 'orangeFg')));

    const entries = Object.values(yearData || {}).sort((a, b) => a.matricule.localeCompare(b.matricule));
    entries.forEach((e, idx) => {
      const r = 3 + idx;
      const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
      writeCell(ws, r, 0, e.matricule, dataCell(false, true, bg));
      writeCell(ws, r, 1, e.chauffeur, dataCell(false, false, bg));
      writeCell(ws, r, 2, e.marque, dataCell(false, false, bg));
      writeCell(ws, r, 3, e.division, dataCell(false, false, bg));
      writeCell(ws, r, 4, e.subdivision || '', dataCell(false, false, bg));
      writeCell(ws, r, 5, +e.montant.toFixed(2), dataCell(true, false, bg));
      writeCell(ws, r, 6, e.nbVidange || 0, { ...dataCell(false, false, bg), numFmt: '#,##0' });
      writeCell(ws, r, 7, e.nbAccident || 0, { ...dataCell(false, false, bg), numFmt: '#,##0' });
    });

    const tr = 3 + entries.length;
    const ts = totalRow();
    const total = entries.reduce((s, e) => s + e.montant, 0);
    writeCell(ws, tr, 0, 'TOTAL', ts);
    writeCell(ws, tr, 1, '', ts);
    writeCell(ws, tr, 2, '', ts);
    writeCell(ws, tr, 3, '', ts);
    writeCell(ws, tr, 4, `${entries.length} véhicules`, ts);
    writeCell(ws, tr, 5, +total.toFixed(2), ts);
    writeCell(ws, tr, 6, entries.reduce((s,e)=>s+(e.nbVidange||0),0), { ...ts, numFmt: '#,##0' });
    writeCell(ws, tr, 7, entries.reduce((s,e)=>s+(e.nbAccident||0),0), { ...ts, numFmt: '#,##0' });

    ws['!ref'] = `A1:H${tr + 2}`;
    XLSX.utils.book_append_sheet(wb, ws, 'Détail');
  }

  /* ══════════════════════════════════════════════════════════
   *  GÉNÉRATION RAPPORT ANNUEL RÉPARATIONS
   * ══════════════════════════════════════════════════════════ */
  function genRepairRapportAnnuel(annee) {
    const allData = getRepairHistData();
    const yearData = allData[String(annee)] || {};
    if (!Object.keys(yearData).length) {
      alert(`Aucune donnée importée pour l'année ${annee}. Importez d'abord le fichier Excel historique.`);
      return;
    }

    const wb = XLSX.utils.book_new();
    buildRepairCoverSheet(wb, annee);
    buildRepairSynthSheet(wb, allData, annee);
    buildRepairDivisionSheet(wb, yearData, annee);
    buildRepairMarqueSheet(wb, yearData, annee);
    buildRepairTop10Sheet(wb, yearData, annee);
    buildRepairDetailSheet(wb, yearData, annee);

    XLSX.writeFile(wb, `Rapport_Reparations_Annuel_${annee}.xlsx`);
  }

  /* ══════════════════════════════════════════════════════════
   *  MODALE DE GÉNÉRATION
   * ══════════════════════════════════════════════════════════ */
  function showRepairRapportModal() {
    const allData = getRepairHistData();
    const years = Object.keys(allData).map(Number).sort((a, b) => b - a);
    const curYear = years.length ? years[0] : new Date().getFullYear();

    const existing = document.getElementById('repair-rapport-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'repair-rapport-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:28px 32px;min-width:360px;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,0.25);font-family:'Segoe UI',sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="font-size:18px;font-weight:800;color:#1e3a5f;margin:0;">📊 Rapport Annuel Réparations</h2>
          <button id="close-repair-rapport-modal" style="background:none;border:none;font-size:20px;cursor:pointer;color:#64748b;width:32px;height:32px;border-radius:50%;">✕</button>
        </div>
        <div style="margin-bottom:20px;">
          <label style="font-size:13px;font-weight:600;color:#1e293b;display:block;margin-bottom:6px;">Année</label>
          <select id="rpt-repair-year" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">
            ${years.length ? years.map(y => `<option value="${y}">${y}</option>`).join('') : `<option value="${curYear}">${curYear} (aucune donnée)</option>`}
          </select>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;font-size:12px;color:#1e40af;margin-bottom:20px;">
          Le rapport inclut : synthèse globale, dépenses par division, par marque, top 10 véhicules, liste détaillée — avec graphiques intégrés.
        </div>
        <button id="btn-gen-repair-rapport" style="width:100%;background:linear-gradient(135deg,#1e3a5f,#334155);color:#fff;border:none;border-radius:10px;padding:12px 20px;font-size:14px;font-weight:700;cursor:pointer;">⬇️ Télécharger le rapport Excel</button>
        <div style="margin-top:12px;font-size:11px;color:#94a3b8;text-align:center;">Format : Excel (.xlsx) avec graphiques — DRT Sfax</div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('close-repair-rapport-modal').onclick = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    document.getElementById('btn-gen-repair-rapport').onclick = () => {
      const annee = parseInt(document.getElementById('rpt-repair-year').value);
      const btn = document.getElementById('btn-gen-repair-rapport');
      btn.textContent = '⏳ Génération en cours...';
      btn.disabled = true;
      setTimeout(() => {
        try {
          genRepairRapportAnnuel(annee);
          overlay.remove();
        } catch (err) {
          console.error(err);
          alert('Erreur lors de la génération : ' + err.message);
          btn.textContent = '⬇️ Télécharger le rapport Excel';
          btn.disabled = false;
        }
      }, 50);
    };
  }

  /* ══════════════════════════════════════════════════════════
   *  HOOK NAVIGATION (n'écrase pas showTab, vient s'ajouter)
   * ══════════════════════════════════════════════════════════ */
  function hookShowTab() {
    if (window.__repairRapportHooked) return;
    window.__repairRapportHooked = true;
    const prev = window.showTab;
    window.showTab = function (tabName) {
      prev && prev(tabName);
      if (tabName === 'repairs') {
        initRepairHistYearSelect();
        setTimeout(renderRepairHistDashboard, 50);
      }
    };
  }

  /* ══════════════════════════════════════════════════════════
   *  INITIALISATION
   * ══════════════════════════════════════════════════════════ */
  function init() {
    if (typeof XLSX === 'undefined') {
      console.warn('[repair_rapport] SheetJS (XLSX) non disponible. Vérifiez l\'ordre des scripts.');
      return;
    }
    hookShowTab();
    initRepairHistYearSelect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ══════════════════════════════════════════════════════════
   *  BLOC ADDITIF — RAPPORT RÉPARATIONS POWERPOINT (PptxGenJS)
   *  Même style visuel que fuel_rapport.js / marches_rapport.js.
   *  Purement additif : n'altère aucune fonction existante.
   * ══════════════════════════════════════════════════════════ */
  const PPT = {
    navy:      '1E3A5F',
    midnight:  '0F172A',
    ink:       '1E293B',
    slate:     '64748B',
    mist:      'E2E8F0',
    paper:     'FFFFFF',
    bg:        'F8FAFC',
    orange:    'EF6C00',
    green:     '10B981',
    red:       'EF4444',
  };
  function pfmt(n, dec) { return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); }

  function buildRepairReportPptx(PptxGenJSCtor, allData, annee, meta) {
    meta = meta || {};
    const pres = new PptxGenJSCtor();
    pres.layout = 'LAYOUT_WIDE';
    pres.author = 'Parc Auto DRT Sfax';
    pres.title = `Rapport Réparations ${annee} — DRT Sfax`;

    const years = Object.keys(allData).map(Number).sort((a, b) => a - b);
    const yearData = allData[String(annee)] || {};
    const entries = Object.values(yearData);
    const total = entries.reduce((s, e) => s + e.montant, 0);
    const nbVeh = entries.length;
    const totalAll = years.reduce((s, y) => s + Object.values(allData[y]).reduce((s2, e) => s2 + e.montant, 0), 0);

    const byDiv = {};
    entries.forEach(e => {
      const raw = (e.division || '—').trim();
      const key = normKey(raw);
      if (!byDiv[key]) byDiv[key] = { division: raw, nb: 0, total: 0 };
      byDiv[key].nb++; byDiv[key].total += e.montant;
    });
    const divList = Object.values(byDiv).sort((a, b) => b.total - a.total);

    const byMarque = {};
    entries.forEach(e => {
      const raw = (e.marque || '—').trim();
      const key = normKey(raw);
      if (!byMarque[key]) byMarque[key] = { marque: raw, nb: 0, total: 0 };
      byMarque[key].nb++; byMarque[key].total += e.montant;
    });
    const marqueList = Object.values(byMarque).sort((a, b) => b.total - a.total);

    const top10 = [...entries].sort((a, b) => b.montant - a.montant).slice(0, 10);

    const W = 13.33;

    /* ============ SLIDE 1 — TITRE ============ */
    {
      const s = pres.addSlide();
      s.background = { color: PPT.midnight };
      s.addShape(pres.shapes.OVAL, { x: 9.6, y: -2.2, w: 6, h: 6, fill: { color: PPT.navy }, line: { type: 'none' } });
      s.addShape(pres.shapes.OVAL, { x: 10.6, y: 4.6, w: 4.2, h: 4.2, fill: { color: PPT.orange, transparency: 84 }, line: { type: 'none' } });

      s.addText('🔧', { x: 0.7, y: 0.75, w: 1.2, h: 1.2, fontSize: 44, align: 'left', valign: 'middle' });
      s.addText('RÉPARATIONS & MAINTENANCE — DRT SFAX', { x: 0.7, y: 1.75, w: 9, h: 0.5,
        fontSize: 14, color: PPT.orange, bold: true, charSpacing: 3, fontFace: 'Calibri' });
      s.addText('Rapport Réparations', { x: 0.65, y: 2.25, w: 11, h: 1.3,
        fontSize: 48, color: PPT.paper, bold: true, fontFace: 'Cambria' });
      s.addText(`Exercice ${annee} — Parc Automobile DRT Sfax`, { x: 0.7, y: 3.45, w: 10, h: 0.55,
        fontSize: 20, color: 'CBD5E1', fontFace: 'Calibri' });
      s.addShape(pres.shapes.LINE, { x: 0.7, y: 4.25, w: 3.2, h: 0, line: { color: PPT.orange, width: 2 } });

      const chips = [
        [`${nbVeh}`, 'véhicules concernés'],
        [`${pfmt(total / 1000, 0)} kDT`, 'dépense totale'],
        [`${pfmt(nbVeh ? total / nbVeh : 0)} DT`, 'moyenne / véhicule'],
      ];
      let cx = 0.7;
      chips.forEach(([big, small]) => {
        s.addText([
          { text: big + '  ', options: { fontSize: 20, bold: true, color: PPT.paper, breakLine: false } },
          { text: small, options: { fontSize: 12, color: '94A3B8' } }
        ], { x: cx, y: 4.6, w: 3.6, h: 0.5, fontFace: 'Calibri' });
        cx += 3.6;
      });

      s.addText(`Généré le ${meta.generatedOn || new Date().toLocaleDateString('fr-FR')} — Chef de Parc : Hamdi Ben Aouicha`,
        { x: 0.7, y: 6.9, w: 9, h: 0.35, fontSize: 10.5, color: '64748B', fontFace: 'Calibri' });
    }

    /* ============ SLIDE 2 — BILAN ============ */
    {
      const s = pres.addSlide();
      s.background = { color: PPT.bg };
      s.addText('Bilan des dépenses', { x: 0.6, y: 0.4, w: 8, h: 0.6, fontSize: 28, bold: true, color: PPT.ink, fontFace: 'Cambria' });
      s.addText(`Exercice ${annee}`, { x: 0.6, y: 0.95, w: 8, h: 0.4, fontSize: 13, color: PPT.slate, fontFace: 'Calibri' });

      const cards = [
        { icon: '💰', big: `${pfmt(total / 1000, 1)} kDT`, label: 'Dépense totale', soft: PPT.mist },
        { icon: '🚗', big: `${nbVeh}`, label: 'Véhicules concernés', soft: PPT.mist },
        { icon: '📊', big: `${pfmt(nbVeh ? total / nbVeh : 0)} DT`, label: 'Moyenne / véhicule', soft: PPT.mist },
        { icon: '🛠️', big: `${entries.reduce((s, e) => s + (e.nbVidange || 0), 0)}`, label: 'Vidanges effectuées', soft: PPT.mist },
      ];
      const gx = 0.6, gy = 1.7, gw = (W - 1.2 - 3 * 0.3) / 4, gh = 1.9, gapX = 0.3;
      cards.forEach((c, i) => {
        const x = gx + i * (gw + gapX), y = gy;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: gw, h: gh, rectRadius: 0.08,
          fill: { color: PPT.paper },
          shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 90, opacity: 0.08 } });
        s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, fill: { color: c.soft }, line: { type: 'none' } });
        s.addText(c.icon, { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, fontSize: 20, align: 'center', valign: 'middle', margin: 0 });
        s.addText(c.big, { x: x + 0.2, y: y + 0.95, w: gw - 0.4, h: 0.55, fontSize: 22, bold: true, color: PPT.navy, fontFace: 'Cambria' });
        s.addText(c.label, { x: x + 0.2, y: y + 1.48, w: gw - 0.4, h: 0.35, fontSize: 11, color: PPT.slate, fontFace: 'Calibri' });
      });

      const rows = [[
        { text: 'Division', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10 } },
        { text: 'Nb véh.', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'center' } },
        { text: 'Total (DT)', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'right' } },
        { text: '% budget', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'center' } },
      ]];
      divList.forEach((d, i) => {
        const fill = i % 2 === 0 ? PPT.paper : PPT.bg;
        rows.push([
          { text: d.division, options: { fill: { color: fill }, fontSize: 9.5, color: PPT.ink } },
          { text: String(d.nb), options: { fill: { color: fill }, fontSize: 9.5, color: PPT.slate, align: 'center' } },
          { text: `${pfmt(d.total)} DT`, options: { fill: { color: fill }, fontSize: 9.5, bold: true, color: PPT.navy, align: 'right' } },
          { text: total > 0 ? `${((d.total / total) * 100).toFixed(1)}%` : '0%', options: { fill: { color: fill }, fontSize: 9.5, color: PPT.slate, align: 'center' } },
        ]);
      });
      s.addTable(rows, { x: 0.6, y: 4.05, w: 12.1, colW: [5.5, 2.2, 2.7, 1.7],
        border: { pt: 0.5, color: PPT.mist }, valign: 'middle', rowH: 0.34 });
    }

    /* ============ SLIDE 3 — ÉVOLUTION ANNUELLE ============ */
    {
      const s = pres.addSlide();
      s.background = { color: PPT.paper };
      s.addText('Évolution annuelle des dépenses', { x: 0.6, y: 0.4, w: 10, h: 0.6, fontSize: 28, bold: true, color: PPT.ink, fontFace: 'Cambria' });
      s.addText('Toutes années importées', { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: PPT.slate, fontFace: 'Calibri' });

      if (years.length) {
        const labels = years.map(String);
        const values = years.map(y => Object.values(allData[y]).reduce((s, e) => s + e.montant, 0));
        s.addChart(pres.charts.BAR, [{ name: 'Dépense (DT)', labels, values }], {
          x: 0.5, y: 1.55, w: 12.3, h: 4.9,
          chartColors: [PPT.navy],
          barGapWidthPct: 40,
          chartArea: { fill: { color: PPT.paper } },
          catAxisLabelColor: PPT.slate, valAxisLabelColor: PPT.slate,
          valGridLine: { color: PPT.mist, size: 0.75 }, catGridLine: { style: 'none' },
          showLegend: false, showValue: true, dataLabelColor: PPT.ink, dataLabelFontSize: 9,
        });
      } else {
        s.addText('Aucune donnée disponible.', { x: 0.6, y: 3, w: 10, h: 0.6, fontSize: 16, color: PPT.slate });
      }
    }

    /* ============ SLIDE 4 — RÉPARTITION PAR DIVISION ============ */
    {
      const s = pres.addSlide();
      s.background = { color: PPT.bg };
      s.addText('Répartition par division', { x: 0.6, y: 0.4, w: 10, h: 0.6, fontSize: 28, bold: true, color: PPT.ink, fontFace: 'Cambria' });
      s.addText(`Part de chaque division — ${annee}`, { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: PPT.slate, fontFace: 'Calibri' });

      if (divList.length) {
        const palette = [PPT.navy, PPT.orange, PPT.green, '7C77DD', 'D4537E', '0EA5B7', PPT.slate];
        s.addChart(pres.charts.DOUGHNUT, [{
          name: 'Dépense', labels: divList.map(d => d.division), values: divList.map(d => Math.round(d.total))
        }], {
          x: 0.6, y: 1.6, w: 6.2, h: 5.1,
          chartColors: palette,
          showLegend: true, legendPos: 'r', legendColor: PPT.slate, legendFontSize: 11,
          showPercent: true, dataLabelColor: PPT.paper, dataLabelFontSize: 10, dataLabelPosition: 'ctr',
          chartArea: { fill: { color: PPT.bg } },
        });

        const rows = [[
          { text: 'Division', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10 } },
          { text: 'Nb véh.', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'center' } },
          { text: 'Total (DT)', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'right' } },
        ]];
        divList.forEach((d, i) => {
          const fill = i % 2 === 0 ? PPT.paper : PPT.bg;
          rows.push([
            { text: d.division, options: { fill: { color: fill }, fontSize: 9.5, color: PPT.ink } },
            { text: String(d.nb), options: { fill: { color: fill }, fontSize: 9.5, color: PPT.slate, align: 'center' } },
            { text: `${pfmt(d.total)} DT`, options: { fill: { color: fill }, fontSize: 9.5, bold: true, color: PPT.navy, align: 'right' } },
          ]);
        });
        s.addTable(rows, { x: 7.1, y: 1.6, w: 5.65, colW: [3.0, 1.15, 1.5],
          border: { pt: 0.5, color: PPT.mist }, valign: 'middle', rowH: 0.55 });
      } else {
        s.addText('Aucune donnée disponible.', { x: 0.6, y: 3, w: 10, h: 0.6, fontSize: 16, color: PPT.slate });
      }
    }

    /* ============ SLIDE 5 — TOP 10 VÉHICULES / MARQUES ============ */
    {
      const s = pres.addSlide();
      s.background = { color: PPT.paper };
      s.addText('Top 10 véhicules & marques', { x: 0.6, y: 0.4, w: 10, h: 0.6, fontSize: 28, bold: true, color: PPT.ink, fontFace: 'Cambria' });
      s.addText(`Véhicules les plus coûteux — ${annee}`, { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: PPT.slate, fontFace: 'Calibri' });

      if (top10.length) {
        const rows = [[
          { text: '#', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'center' } },
          { text: 'Matricule', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10 } },
          { text: 'Chauffeur', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10 } },
          { text: 'Montant (DT)', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'right' } },
        ]];
        top10.forEach((e, i) => {
          const fill = i < 3 ? 'FFF3CD' : (i % 2 === 0 ? PPT.paper : PPT.bg);
          rows.push([
            { text: String(i + 1), options: { fill: { color: fill }, fontSize: 10, color: PPT.slate, align: 'center' } },
            { text: e.matricule, options: { fill: { color: fill }, fontSize: 10, bold: true, color: PPT.ink } },
            { text: e.chauffeur || '—', options: { fill: { color: fill }, fontSize: 9.5, color: PPT.ink } },
            { text: `${pfmt(e.montant)} DT`, options: { fill: { color: fill }, fontSize: 10, color: PPT.navy, bold: true, align: 'right' } },
          ]);
        });
        s.addTable(rows, { x: 0.6, y: 1.55, w: 5.9, colW: [0.5, 1.6, 2.4, 1.4],
          border: { pt: 0.5, color: PPT.mist }, valign: 'middle', rowH: 0.44 });
      }

      if (marqueList.length) {
        const palette = [PPT.navy, PPT.orange, PPT.green, '7C93B8', '94D2DB', PPT.slate];
        s.addChart(pres.charts.DOUGHNUT, [{
          name: 'Dépense', labels: marqueList.slice(0, 7).map(m => m.marque), values: marqueList.slice(0, 7).map(m => Math.round(m.total))
        }], {
          x: 6.8, y: 1.5, w: 6.0, h: 5.1,
          chartColors: palette,
          showLegend: true, legendPos: 'b', legendColor: PPT.slate, legendFontSize: 10,
          showPercent: true, dataLabelColor: PPT.paper, dataLabelFontSize: 9, dataLabelPosition: 'ctr',
          chartArea: { fill: { color: PPT.paper } },
        });
      }
    }

    /* ============ SLIDE 6 — POINTS D'ATTENTION ============ */
    {
      const s = pres.addSlide();
      s.background = { color: PPT.midnight };
      s.addText('Points d\u2019attention', { x: 0.6, y: 0.5, w: 8, h: 0.6, fontSize: 28, bold: true, color: PPT.paper, fontFace: 'Cambria' });
      s.addText('Véhicules à forte sinistralité / coût', { x: 0.6, y: 1.05, w: 9, h: 0.4, fontSize: 13, color: '94A3B8', fontFace: 'Calibri' });

      const accidents = entries.filter(e => (e.nbAccident || 0) > 0).sort((a, b) => (b.nbAccident || 0) - (a.nbAccident || 0)).slice(0, 10);
      const couteux = top10.slice(0, 5);

      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 1.7, w: 5.9, h: 5.1, rectRadius: 0.08, fill: { color: '16213E' }, line: { type: 'none' } });
      s.addText('🚨  Accidents enregistrés', { x: 0.9, y: 1.95, w: 5.3, h: 0.4, fontSize: 14, bold: true, color: PPT.orange, fontFace: 'Calibri' });
      if (accidents.length) {
        const txt = accidents.map(e => ({
          text: `${e.matricule}  —  ${e.division || ''}  (${e.nbAccident} accident${e.nbAccident > 1 ? 's' : ''})`,
          options: { bullet: { code: '25CF' }, color: 'E2E8F0', fontSize: 12.5, breakLine: true, paraSpaceAfter: 8 }
        }));
        txt[txt.length - 1].options.breakLine = false;
        s.addText(txt, { x: 0.95, y: 2.5, w: 5.3, h: 4, fontFace: 'Calibri' });
      } else {
        s.addText('Aucun accident enregistré sur la période.', { x: 0.95, y: 2.5, w: 5.3, h: 0.6, fontSize: 13, color: '94A3B8', fontFace: 'Calibri' });
      }

      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.8, y: 1.7, w: 5.9, h: 5.1, rectRadius: 0.08, fill: { color: '16213E' }, line: { type: 'none' } });
      s.addText('💸  Véhicules les plus coûteux', { x: 7.1, y: 1.95, w: 5.3, h: 0.4, fontSize: 14, bold: true, color: PPT.red, fontFace: 'Calibri' });
      if (couteux.length) {
        const txt2 = couteux.map(e => ({
          text: `${e.matricule}  —  ${e.division || ''}  (${pfmt(e.montant)} DT)`,
          options: { bullet: { code: '25CF' }, color: 'E2E8F0', fontSize: 12.5, breakLine: true, paraSpaceAfter: 8 }
        }));
        txt2[txt2.length - 1].options.breakLine = false;
        s.addText(txt2, { x: 7.15, y: 2.5, w: 5.3, h: 4, fontFace: 'Calibri' });
      } else {
        s.addText('Aucune donnée disponible.', { x: 7.15, y: 2.5, w: 5.3, h: 0.6, fontSize: 13, color: '94A3B8', fontFace: 'Calibri' });
      }
    }

    return pres;
  }

  const PPTXGENJS_CDN = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgenjs.bundle.js';
  function _loadPptxGenJsRepair() {
    if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
    if (window.__pptxgenjsLoading) return window.__pptxgenjsLoading;
    window.__pptxgenjsLoading = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = PPTXGENJS_CDN;
      script.onload = function () { resolve(window.PptxGenJS); };
      script.onerror = function () { reject(new Error('Impossible de charger la librairie PptxGenJS.')); };
      document.head.appendChild(script);
    });
    return window.__pptxgenjsLoading;
  }
  function _repairPptxBtnState(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.dataset.originalLabel = btn.dataset.originalLabel || btn.innerHTML;
      btn.innerHTML = '⏳ Génération en cours...';
      btn.disabled = true;
    } else {
      if (btn.dataset.originalLabel) btn.innerHTML = btn.dataset.originalLabel;
      btn.disabled = false;
    }
  }

  window.__buildRepairReportPptx = buildRepairReportPptx;
  window.genererRapportReparationsPPTX = async function genererRapportReparationsPPTX(evt) {
    const btn = evt && evt.target ? evt.target.closest('button') : null;
    try {
      _repairPptxBtnState(btn, true);
      const PptxCtor = await _loadPptxGenJsRepair();

      const allData = getRepairHistData();
      const annee = parseInt(currentHistYear(), 10);
      const yearData = allData[String(annee)] || {};
      if (!Object.keys(yearData).length) {
        alert(`Aucune donnée importée pour l'année ${annee}. Importez d'abord le fichier Excel historique.`);
        return;
      }

      const pres = buildRepairReportPptx(PptxCtor, allData, annee, {
        generatedOn: new Date().toLocaleDateString('fr-FR')
      });

      const today = new Date().toISOString().slice(0, 10);
      await pres.writeFile({ fileName: 'Rapport_Reparations_' + annee + '_DRT_Sfax_' + today + '.pptx' });
    } catch (err) {
      console.error('[RepairRapport] Erreur génération PPTX:', err);
      alert('Erreur lors de la génération du rapport : ' + (err && err.message ? err.message : err));
    } finally {
      _repairPptxBtnState(btn, false);
    }
  };

  // API publique
  window.handleRepairHistImport   = handleRepairHistImport;
  window.clearRepairHistYear      = clearRepairHistYear;
  window.renderRepairHistDashboard= renderRepairHistDashboard;
  window.showRepairRapportModal   = showRepairRapportModal;
  window.repairRapport = { genAnnuel: genRepairRapportAnnuel, showModal: showRepairRapportModal, genPptx: window.genererRapportReparationsPPTX };

})();
