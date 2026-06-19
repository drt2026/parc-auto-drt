/**
 * ============================================================
 *  FUEL_RAPPORT.JS — Module Rapports Carburant — DRT Sfax
 *  Rapports : Mensuel / Semestriel / Annuel  →  Excel (.xlsx)
 *  À inclure dans admin.html APRÈS le script SheetJS existant
 *  <script src="fuel_rapport.js"></script>
 *  Ne modifie AUCUNE fonction existante.
 * ============================================================
 */
(function () {
  'use strict';

  /* ── Noms des mois ── */
  const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin',
                'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  /* ── Couleurs branding Tunisie Telecom ── */
  const CLR = {
    navyFg  : 'FFFFFFFF',
    navyBg  : 'FF1E3A5F',
    orangeBg: 'FFEF6C00',
    orangeFg: 'FFFFFFFF',
    greyBg  : 'FFF1F5F9',
    greyFg  : 'FF1E293B',
    whiteBg : 'FFFFFFFF',
    greenBg : 'FFD1FAE5',
    greenFg : 'FF065F46',
    redBg   : 'FFFEE2E2',
    redFg   : 'FF991B1B',
    borderClr: 'FFE2E8F0',
    alertBg : 'FFFFF3CD',
  };

  /* ══════════════════════════════════════════════════════════
   *  HELPERS
   * ══════════════════════════════════════════════════════════ */
  function getFuelData() {
    try { return JSON.parse(localStorage.getItem('parcAutoFuel_v1')) || {}; }
    catch(e) { return {}; }
  }

  function cellRef(r, c) {
    const col = String.fromCharCode(65 + c);
    return col + (r + 1);
  }

  /* Applique style à une cellule dans ws */
  function styleCell(ws, addr, style) {
    if (!ws[addr]) ws[addr] = { t: 'z', v: '' };
    ws[addr].s = style;
  }

  /* Écriture + style simultanés */
  function writeCell(ws, r, c, value, style) {
    const addr = cellRef(r, c);
    const t = typeof value === 'number' ? 'n' : 's';
    ws[addr] = { t, v: value };
    if (style) ws[addr].s = style;
    return addr;
  }

  function setColWidths(ws, widths) {
    ws['!cols'] = widths.map(w => ({ wch: w }));
  }

  function addMerge(ws, r1, c1, r2, c2) {
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
  }

  /* Style helpers */
  function hdr(bgKey, fgKey, bold) {
    return {
      fill:   { fgColor: { rgb: CLR[bgKey] } },
      font:   { bold: bold !== false, color: { rgb: CLR[fgKey] }, sz: 11 },
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
  function thinBorder() {
    const b = { style: 'thin', color: { rgb: CLR.borderClr } };
    return { top: b, bottom: b, left: b, right: b };
  }
  function totalRow() {
    return {
      fill: { fgColor: { rgb: CLR.orangeBg } },
      font: { bold: true, color: { rgb: CLR.orangeFg }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder(),
      numFmt: '#,##0.00'
    };
  }

  /* ══════════════════════════════════════════════════════════
   *  FEUILLE : PAGE DE GARDE
   * ══════════════════════════════════════════════════════════ */
  function buildCoverSheet(wb, titre, subtitle, annee) {
    const ws = {};
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });

    setColWidths(ws, [5, 20, 20, 20, 20, 20, 5]);

    // Titre principal
    addMerge(ws, 2, 1, 3, 5);
    writeCell(ws, 2, 1, 'TUNISIE TELECOM', {
      fill: { fgColor: { rgb: CLR.navyBg } },
      font: { bold: true, color: { rgb: CLR.navyFg }, sz: 20 },
      alignment: { horizontal: 'center', vertical: 'center' }
    });

    addMerge(ws, 5, 1, 6, 5);
    writeCell(ws, 5, 1, titre, {
      fill: { fgColor: { rgb: CLR.orangeBg } },
      font: { bold: true, color: { rgb: CLR.orangeFg }, sz: 16 },
      alignment: { horizontal: 'center', vertical: 'center' }
    });

    addMerge(ws, 8, 1, 9, 5);
    writeCell(ws, 8, 1, subtitle, {
      fill: { fgColor: { rgb: CLR.greyBg } },
      font: { bold: true, color: { rgb: CLR.greyFg }, sz: 13 },
      alignment: { horizontal: 'center', vertical: 'center' }
    });

    // Infos
    const rows = [
      ['Direction Régionale', 'DRT Sfax'],
      ['Responsable Parc', 'Chef de Parc'],
      ["Année d'exercice", String(annee)],
      ["Date d'édition", dateStr],
    ];
    rows.forEach(([lbl, val], i) => {
      const r = 12 + i * 2;
      addMerge(ws, r, 1, r, 3);
      writeCell(ws, r, 1, lbl, hdr('navyBg','navyFg'));
      addMerge(ws, r, 4, r, 5);
      writeCell(ws, r, 4, val, dataCell(false, true, 'greyBg'));
    });

    ws['!ref'] = `A1:G${12 + rows.length * 2 + 4}`;
    XLSX.utils.book_append_sheet(wb, ws, 'Page de garde');
  }

  /* ══════════════════════════════════════════════════════════
   *  FEUILLE : DÉTAIL MENSUEL (1 mois)
   * ══════════════════════════════════════════════════════════ */
  function buildMonthSheet(wb, monthKey, monthData) {
    const ws = {};
    const [y, m] = monthKey.split('-');
    const nomMois = MOIS[parseInt(m) - 1];
    const entries = Object.values(monthData).sort((a, b) => a.matricule.localeCompare(b.matricule));

    setColWidths(ws, [14, 14, 22, 10, 12, 14, 12, 14]);

    // Titre
    addMerge(ws, 0, 0, 0, 7);
    writeCell(ws, 0, 0, `RAPPORT CARBURANT — ${nomMois.toUpperCase()} ${y} — DRT SFAX`, hdr('navyBg','navyFg'));

    // En-têtes colonnes
    const cols = ['Matricule','Modèle','Chauffeur','Litres (L)','Montant (DT)','Km parcourus','% Conso','Statut'];
    cols.forEach((c, i) => writeCell(ws, 2, i, c, hdr('orangeBg','orangeFg')));

    // Données
    let totL = 0, totM = 0, totKm = 0, pctSum = 0, pctCnt = 0;
    entries.forEach((e, idx) => {
      const r = 3 + idx;
      const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
      writeCell(ws, r, 0, e.matricule, dataCell(false, true, bg));
      writeCell(ws, r, 1, e.modele || '—', dataCell(false, false, bg));
      writeCell(ws, r, 2, e.chauffeur, dataCell(false, false, bg));
      writeCell(ws, r, 3, e.litres, dataCell(true, false, bg));
      writeCell(ws, r, 4, e.montant, dataCell(true, false, bg));
      writeCell(ws, r, 5, e.km, { ...dataCell(false, false, bg), numFmt: '#,##0' });
      writeCell(ws, r, 6, e.pct, dataCell(true, false, bg));

      // Statut coloré
      const isOK = e.statut === 'OK';
      writeCell(ws, r, 7, e.statut, {
        fill: { fgColor: { rgb: isOK ? CLR.greenBg : CLR.redBg } },
        font: { bold: true, color: { rgb: isOK ? CLR.greenFg : CLR.redFg }, sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder()
      });

      totL += e.litres; totM += e.montant; totKm += e.km;
      if (isFinite(e.pct)) { pctSum += e.pct; pctCnt++; }
    });

    // Ligne totaux
    const tr = 3 + entries.length;
    const ts = totalRow();
    writeCell(ws, tr, 0, 'TOTAL / MOYENNE', ts);
    writeCell(ws, tr, 1, '', ts);
    writeCell(ws, tr, 2, `${entries.length} véhicules`, ts);
    writeCell(ws, tr, 3, totL, ts);
    writeCell(ws, tr, 4, totM, ts);
    writeCell(ws, tr, 5, totKm, { ...ts, numFmt: '#,##0' });
    writeCell(ws, tr, 6, pctCnt ? +(pctSum / pctCnt).toFixed(2) : 0, ts);
    writeCell(ws, tr, 7, '', ts);

    // KPIs résumé (après tableau)
    const kpiR = tr + 3;
    addMerge(ws, kpiR, 0, kpiR, 7);
    writeCell(ws, kpiR, 0, '── INDICATEURS CLÉS ──', hdr('navyBg','navyFg'));

    const immob = entries.filter(e => e.statut !== 'OK').length;
    const kpis = [
      ['Total litres', totL.toFixed(0) + ' L'],
      ['Dépense totale', totM.toFixed(2) + ' DT'],
      ['Total km', totKm.toLocaleString('fr-FR') + ' km'],
      ['Conso. moyenne', (pctCnt ? pctSum / pctCnt : 0).toFixed(2) + '%'],
      ['Véhicules suivis', entries.length],
      ['Immobilisés / en panne', immob],
    ];
    kpis.forEach(([lbl, val], i) => {
      const r = kpiR + 1 + i;
      writeCell(ws, r, 0, lbl, hdr('greyBg','greyFg'));
      addMerge(ws, r, 1, r, 7);
      writeCell(ws, r, 1, val, { ...dataCell(false, true), alignment: { horizontal: 'left' } });
    });

    ws['!ref'] = `A1:H${kpiR + kpis.length + 2}`;
    XLSX.utils.book_append_sheet(wb, ws, nomMois.substring(0, 5) + ' ' + y);
  }

  /* ══════════════════════════════════════════════════════════
   *  FEUILLE : SYNTHÈSE SEMESTRIELLE ou ANNUELLE (cumul véhicules)
   * ══════════════════════════════════════════════════════════ */
  function buildSynthSheet(wb, sheetName, titre, monthKeys, allData) {
    const ws = {};
    setColWidths(ws, [14, 14, 22, 10, 12, 14, 12, 10]);

    // Agrégation par véhicule
    const byVeh = {};
    monthKeys.forEach(mk => {
      Object.values(allData[mk] || {}).forEach(e => {
        if (!byVeh[e.matricule]) {
          byVeh[e.matricule] = { matricule: e.matricule, modele: e.modele, chauffeur: e.chauffeur,
            litres: 0, montant: 0, km: 0, pctSum: 0, pctCnt: 0, mois: 0 };
        }
        const v = byVeh[e.matricule];
        v.litres += e.litres; v.montant += e.montant; v.km += e.km;
        if (isFinite(e.pct)) { v.pctSum += e.pct; v.pctCnt++; }
        v.mois++;
        v.chauffeur = e.chauffeur || v.chauffeur;
        v.modele = e.modele || v.modele;
      });
    });

    const entries = Object.values(byVeh).sort((a, b) => b.montant - a.montant);

    // Titre
    addMerge(ws, 0, 0, 0, 7);
    writeCell(ws, 0, 0, titre, hdr('navyBg','navyFg'));

    addMerge(ws, 1, 0, 1, 7);
    writeCell(ws, 1, 0, `Période : ${monthKeys.length} mois | ${entries.length} véhicules`, hdr('orangeBg','orangeFg'));

    // En-têtes
    const cols = ['Matricule','Modèle','Chauffeur','Litres (L)','Montant (DT)','Km parcourus','% Conso moy','Nb Mois'];
    cols.forEach((c, i) => writeCell(ws, 3, i, c, hdr('navyBg','navyFg')));

    let totL = 0, totM = 0, totKm = 0, pctSum = 0, pctCnt = 0;
    entries.forEach((v, idx) => {
      const r = 4 + idx;
      const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
      const avgPct = v.pctCnt ? v.pctSum / v.pctCnt : 0;
      writeCell(ws, r, 0, v.matricule, dataCell(false, true, bg));
      writeCell(ws, r, 1, v.modele || '—', dataCell(false, false, bg));
      writeCell(ws, r, 2, v.chauffeur, dataCell(false, false, bg));
      writeCell(ws, r, 3, +v.litres.toFixed(2), dataCell(true, false, bg));
      writeCell(ws, r, 4, +v.montant.toFixed(2), dataCell(true, false, bg));
      writeCell(ws, r, 5, v.km, { ...dataCell(false, false, bg), numFmt: '#,##0' });
      writeCell(ws, r, 6, +avgPct.toFixed(2), dataCell(true, false, bg));
      writeCell(ws, r, 7, v.mois, dataCell(false, false, bg));

      totL += v.litres; totM += v.montant; totKm += v.km;
      if (v.pctCnt) { pctSum += v.pctSum / v.pctCnt; pctCnt++; }
    });

    // Totaux
    const tr = 4 + entries.length;
    const ts = totalRow();
    writeCell(ws, tr, 0, 'TOTAL', ts);
    writeCell(ws, tr, 1, '', ts);
    writeCell(ws, tr, 2, `${entries.length} véhicules`, ts);
    writeCell(ws, tr, 3, +totL.toFixed(2), ts);
    writeCell(ws, tr, 4, +totM.toFixed(2), ts);
    writeCell(ws, tr, 5, totKm, { ...ts, numFmt: '#,##0' });
    writeCell(ws, tr, 6, pctCnt ? +(pctSum / pctCnt).toFixed(2) : 0, ts);
    writeCell(ws, tr, 7, '', ts);

    ws['!ref'] = `A1:H${tr + 2}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  /* ══════════════════════════════════════════════════════════
   *  FEUILLE : ÉVOLUTION MENSUELLE (tableau + mini-graphe texte)
   * ══════════════════════════════════════════════════════════ */
  function buildEvolutionSheet(wb, annee, allData) {
    const ws = {};
    setColWidths(ws, [16, 14, 14, 14, 14, 16]);

    addMerge(ws, 0, 0, 0, 5);
    writeCell(ws, 0, 0, `ÉVOLUTION MENSUELLE CARBURANT — ${annee}`, hdr('navyBg','navyFg'));

    const hdrs = ['Mois','Nb véhicules','Litres (L)','Montant (DT)','Km parcourus','% Conso moy'];
    hdrs.forEach((h, i) => writeCell(ws, 2, i, h, hdr('orangeBg','orangeFg')));

    let totL = 0, totM = 0, totKm = 0, totVeh = 0;
    for (let mi = 1; mi <= 12; mi++) {
      const mk = `${annee}-${String(mi).padStart(2,'0')}`;
      const entries = Object.values(allData[mk] || {});
      const r = 2 + mi;
      const bg = mi % 2 === 0 ? 'greyBg' : 'whiteBg';
      const hasData = entries.length > 0;

      const mL = entries.reduce((s, e) => s + e.litres, 0);
      const mM = entries.reduce((s, e) => s + e.montant, 0);
      const mKm = entries.reduce((s, e) => s + e.km, 0);
      let pctS = 0, pctC = 0;
      entries.forEach(e => { if (isFinite(e.pct)) { pctS += e.pct; pctC++; } });

      writeCell(ws, r, 0, MOIS[mi-1], dataCell(false, true, bg));
      writeCell(ws, r, 1, hasData ? entries.length : '—', hasData ? dataCell(true,false,bg) : dataCell(false,false,bg));
      writeCell(ws, r, 2, hasData ? +mL.toFixed(2) : '—', hasData ? dataCell(true,false,bg) : dataCell(false,false,bg));
      writeCell(ws, r, 3, hasData ? +mM.toFixed(2) : '—', hasData ? dataCell(true,false,bg) : dataCell(false,false,bg));
      writeCell(ws, r, 4, hasData ? mKm : '—', hasData ? { ...dataCell(false,false,bg), numFmt:'#,##0' } : dataCell(false,false,bg));
      writeCell(ws, r, 5, hasData && pctC ? +(pctS/pctC).toFixed(2) : '—', hasData ? dataCell(true,false,bg) : dataCell(false,false,bg));

      if (hasData) { totL += mL; totM += mM; totKm += mKm; totVeh = Math.max(totVeh, entries.length); }
    }

    // Total annuel
    const tRow = 15;
    const ts = totalRow();
    ['TOTAL ANNUEL', '', '', totL, totM, totKm].forEach((v, i) => {
      writeCell(ws, tRow, i, typeof v === 'number' ? +v.toFixed(2) : v, ts);
    });

    ws['!ref'] = `A1:F${tRow + 2}`;
    XLSX.utils.book_append_sheet(wb, ws, 'Évolution mensuelle');
  }

  /* ══════════════════════════════════════════════════════════
   *  FEUILLE : CLASSEMENT VÉHICULES (Top consommateurs)
   * ══════════════════════════════════════════════════════════ */
  function buildRankSheet(wb, titre, monthKeys, allData) {
    const ws = {};
    setColWidths(ws, [5, 14, 14, 22, 12, 14, 14, 10]);

    // Agrégation
    const byVeh = {};
    monthKeys.forEach(mk => {
      Object.values(allData[mk] || {}).forEach(e => {
        if (!byVeh[e.matricule]) {
          byVeh[e.matricule] = { matricule: e.matricule, modele: e.modele, chauffeur: e.chauffeur,
            litres: 0, montant: 0, km: 0 };
        }
        byVeh[e.matricule].litres += e.litres;
        byVeh[e.matricule].montant += e.montant;
        byVeh[e.matricule].km += e.km;
        byVeh[e.matricule].modele = e.modele || byVeh[e.matricule].modele;
        byVeh[e.matricule].chauffeur = e.chauffeur || byVeh[e.matricule].chauffeur;
      });
    });

    const sorted = Object.values(byVeh).sort((a, b) => b.montant - a.montant);
    const totalM = sorted.reduce((s, v) => s + v.montant, 0);

    addMerge(ws, 0, 0, 0, 7);
    writeCell(ws, 0, 0, titre, hdr('navyBg','navyFg'));
    addMerge(ws, 1, 0, 1, 7);
    writeCell(ws, 1, 0, 'Classement par dépense carburant décroissante', hdr('orangeBg','orangeFg'));

    const hdrs = ['#','Matricule','Modèle','Chauffeur','Litres (L)','Montant (DT)','% Budget','Km'];
    hdrs.forEach((h, i) => writeCell(ws, 3, i, h, hdr('navyBg','navyFg')));

    sorted.forEach((v, idx) => {
      const r = 4 + idx;
      const bg = idx < 3 ? 'alertBg' : (idx % 2 === 0 ? 'whiteBg' : 'greyBg');
      const pctBudget = totalM > 0 ? +((v.montant / totalM) * 100).toFixed(1) : 0;
      writeCell(ws, r, 0, idx + 1, { ...dataCell(true, true, bg), alignment: { horizontal: 'center' } });
      writeCell(ws, r, 1, v.matricule, dataCell(false, true, bg));
      writeCell(ws, r, 2, v.modele || '—', dataCell(false, false, bg));
      writeCell(ws, r, 3, v.chauffeur, dataCell(false, false, bg));
      writeCell(ws, r, 4, +v.litres.toFixed(2), dataCell(true, false, bg));
      writeCell(ws, r, 5, +v.montant.toFixed(2), dataCell(true, false, bg));
      writeCell(ws, r, 6, pctBudget, { ...dataCell(true, false, bg), numFmt: '0.0%' });
      writeCell(ws, r, 7, v.km, { ...dataCell(false, false, bg), numFmt: '#,##0' });
    });

    ws['!ref'] = `A1:H${4 + sorted.length + 1}`;
    XLSX.utils.book_append_sheet(wb, ws, 'Classement');
  }

  /* ══════════════════════════════════════════════════════════
   *  GÉNÉRATION RAPPORT MENSUEL
   * ══════════════════════════════════════════════════════════ */
  function genRapportMensuel(monthKey) {
    const allData = getFuelData();
    const monthData = allData[monthKey] || {};
    if (!Object.keys(monthData).length) {
      alert(`Aucune donnée pour ${monthKey}. Importez d'abord le fichier Excel mensuel.`);
      return;
    }
    const [y, m] = monthKey.split('-');
    const nomMois = MOIS[parseInt(m) - 1];

    const wb = XLSX.utils.book_new();
    buildCoverSheet(wb, `RAPPORT MENSUEL CARBURANT`, `${nomMois} ${y} — DRT Sfax`, y);
    buildMonthSheet(wb, monthKey, monthData);
    buildRankSheet(wb, `TOP CONSOMMATEURS — ${nomMois} ${y}`, [monthKey], allData);

    XLSX.writeFile(wb, `Rapport_Carburant_${nomMois}_${y}.xlsx`);
  }

  /* ══════════════════════════════════════════════════════════
   *  GÉNÉRATION RAPPORT SEMESTRIEL (S1 = jan-juin, S2 = juil-déc)
   * ══════════════════════════════════════════════════════════ */
  function genRapportSemestriel(annee, semestre) {
    const allData = getFuelData();
    const startM = semestre === 1 ? 1 : 7;
    const endM   = semestre === 1 ? 6 : 12;
    const moisKeys = [];
    for (let mi = startM; mi <= endM; mi++) {
      moisKeys.push(`${annee}-${String(mi).padStart(2,'0')}`);
    }
    const hasData = moisKeys.some(mk => Object.keys(allData[mk] || {}).length > 0);
    if (!hasData) {
      alert(`Aucune donnée pour le S${semestre} ${annee}. Importez les fichiers mensuels.`);
      return;
    }

    const nomSem = `Semestre ${semestre} ${annee}`;
    const wb = XLSX.utils.book_new();
    buildCoverSheet(wb, `RAPPORT SEMESTRIEL CARBURANT`, `${nomSem} — DRT Sfax`, annee);
    buildSynthSheet(wb, 'Bilan S' + semestre, `BILAN SEMESTRIEL S${semestre} — ${annee} — DRT SFAX`, moisKeys, allData);
    buildEvolutionSheet(wb, annee, allData); // évolution 12 mois pour contexte
    buildRankSheet(wb, `TOP CONSOMMATEURS S${semestre} ${annee}`, moisKeys, allData);

    // Feuilles mensuelles individuelles
    moisKeys.forEach(mk => {
      const md = allData[mk] || {};
      if (Object.keys(md).length > 0) buildMonthSheet(wb, mk, md);
    });

    XLSX.writeFile(wb, `Rapport_Carburant_S${semestre}_${annee}.xlsx`);
  }

  /* ══════════════════════════════════════════════════════════
   *  GÉNÉRATION RAPPORT ANNUEL
   * ══════════════════════════════════════════════════════════ */
  function genRapportAnnuel(annee) {
    const allData = getFuelData();
    const allKeys = [];
    for (let mi = 1; mi <= 12; mi++) {
      allKeys.push(`${annee}-${String(mi).padStart(2,'0')}`);
    }
    const hasData = allKeys.some(mk => Object.keys(allData[mk] || {}).length > 0);
    if (!hasData) {
      alert(`Aucune donnée pour l'année ${annee}. Importez les fichiers mensuels.`);
      return;
    }

    const wb = XLSX.utils.book_new();
    buildCoverSheet(wb, `RAPPORT ANNUEL CARBURANT`, `Année ${annee} — DRT Sfax`, annee);
    buildSynthSheet(wb, 'Bilan annuel', `BILAN ANNUEL CARBURANT ${annee} — DRT SFAX`, allKeys, allData);
    buildEvolutionSheet(wb, annee, allData);
    buildRankSheet(wb, `TOP CONSOMMATEURS — ${annee}`, allKeys, allData);

    // S1 & S2
    const s1Keys = allKeys.slice(0, 6);
    const s2Keys = allKeys.slice(6);
    buildSynthSheet(wb, 'Bilan S1', `BILAN S1 ${annee}`, s1Keys, allData);
    buildSynthSheet(wb, 'Bilan S2', `BILAN S2 ${annee}`, s2Keys, allData);

    // Feuilles mensuelles
    allKeys.forEach(mk => {
      const md = allData[mk] || {};
      if (Object.keys(md).length > 0) buildMonthSheet(wb, mk, md);
    });

    XLSX.writeFile(wb, `Rapport_Carburant_Annuel_${annee}.xlsx`);
  }

  /* ══════════════════════════════════════════════════════════
   *  INTERFACE : MODALE DE SÉLECTION RAPPORT
   * ══════════════════════════════════════════════════════════ */
  function showRapportModal() {
    // Récupère l'année et le mois courants depuis les sélecteurs de l'app
    const selYear = document.getElementById('fuel-year-select');
    const selMonth = document.getElementById('fuel-month-select');
    const curYear = selYear ? parseInt(selYear.value) : new Date().getFullYear();
    const curMonth = selMonth ? selMonth.value : String(new Date().getMonth() + 1).padStart(2, '0');
    const curMonthKey = `${curYear}-${curMonth}`;

    // Évite les doublons
    const existing = document.getElementById('rapport-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'rapport-modal-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;
      display:flex;align-items:center;justify-content:center;
    `;

    overlay.innerHTML = `
      <div style="
        background:#fff;border-radius:16px;padding:28px 32px;min-width:360px;max-width:480px;
        box-shadow:0 20px 60px rgba(0,0,0,0.25);font-family:'Segoe UI',sans-serif;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="font-size:18px;font-weight:800;color:#1e3a5f;margin:0;">📊 Générer un rapport</h2>
          <button id="close-rapport-modal" style="
            background:none;border:none;font-size:20px;cursor:pointer;color:#64748b;
            width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;
          ">✕</button>
        </div>

        <div style="margin-bottom:16px;">
          <label style="font-size:13px;font-weight:600;color:#1e293b;display:block;margin-bottom:6px;">Année</label>
          <select id="rpt-year" style="
            width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;
          "></select>
        </div>

        <div style="margin-bottom:20px;">
          <label style="font-size:13px;font-weight:600;color:#1e293b;display:block;margin-bottom:6px;">Type de rapport</label>
          <select id="rpt-type" style="
            width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;
          ">
            <option value="mensuel">📅 Rapport Mensuel</option>
            <option value="s1">📆 Rapport Semestriel — S1 (Janvier–Juin)</option>
            <option value="s2">📆 Rapport Semestriel — S2 (Juillet–Décembre)</option>
            <option value="annuel">📋 Rapport Annuel</option>
          </select>
        </div>

        <div id="rpt-month-row" style="margin-bottom:20px;">
          <label style="font-size:13px;font-weight:600;color:#1e293b;display:block;margin-bottom:6px;">Mois</label>
          <select id="rpt-month" style="
            width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;
          ">
            ${Array.from({length:12},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}">${MOIS[i]}</option>`).join('')}
          </select>
        </div>

        <div id="rpt-info" style="
          background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;
          padding:10px 14px;font-size:13px;color:#1e40af;margin-bottom:20px;display:none;
        "></div>

        <div style="display:flex;gap:12px;">
          <button id="btn-gen-rapport" style="
            flex:1;background:linear-gradient(135deg,#1e3a5f,#334155);color:#fff;
            border:none;border-radius:10px;padding:12px 20px;font-size:14px;font-weight:700;
            cursor:pointer;transition:opacity .2s;
          ">⬇️ Télécharger le rapport Excel</button>
        </div>

        <div style="margin-top:12px;font-size:11px;color:#94a3b8;text-align:center;">
          Format : Excel (.xlsx) avec mise en forme DRT Sfax
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Remplir le select année
    const yearSel = document.getElementById('rpt-year');
    for (let y = curYear - 2; y <= curYear + 1; y++) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      if (y === curYear) opt.selected = true;
      yearSel.appendChild(opt);
    }

    // Mois courant présélectionné
    const monthSel = document.getElementById('rpt-month');
    monthSel.value = curMonth;

    // Afficher/cacher le select mois selon type
    function updateMonthRow() {
      const type = document.getElementById('rpt-type').value;
      document.getElementById('rpt-month-row').style.display = type === 'mensuel' ? '' : 'none';
    }
    document.getElementById('rpt-type').addEventListener('change', updateMonthRow);

    // Fermeture
    document.getElementById('close-rapport-modal').onclick = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    // Génération
    document.getElementById('btn-gen-rapport').onclick = () => {
      const annee = parseInt(document.getElementById('rpt-year').value);
      const type = document.getElementById('rpt-type').value;
      const mois = document.getElementById('rpt-month').value;

      const btn = document.getElementById('btn-gen-rapport');
      btn.textContent = '⏳ Génération en cours...';
      btn.disabled = true;

      setTimeout(() => {
        try {
          if (type === 'mensuel') {
            genRapportMensuel(`${annee}-${mois}`);
          } else if (type === 's1') {
            genRapportSemestriel(annee, 1);
          } else if (type === 's2') {
            genRapportSemestriel(annee, 2);
          } else {
            genRapportAnnuel(annee);
          }
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
   *  INJECTION DU BOUTON DANS L'ONGLET CARBURANT
   * ══════════════════════════════════════════════════════════ */
  function injectRapportButton() {
    // Cherche la zone boutons export de l'onglet fuel
    const exportBtn = document.querySelector('#tab-fuel button[onclick*="exportFuelCSV"]');
    if (!exportBtn) {
      // Si l'onglet fuel n'est pas encore dans le DOM (cas app.js séparé), on réessaie
      return false;
    }

    // Évite les doublons
    if (document.getElementById('btn-rapport-fuel')) return true;

    const btn = document.createElement('button');
    btn.id = 'btn-rapport-fuel';
    btn.className = 'btn btn-primary'; // reprend le style existant de l'app
    btn.style.cssText = 'background:linear-gradient(135deg,#1e3a5f,#334155);color:#fff;border:none;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px;';
    btn.innerHTML = '📊 Générer Rapport';
    btn.onclick = showRapportModal;

    // Insère après le bouton Export CSV
    exportBtn.insertAdjacentElement('afterend', btn);
    return true;
  }

  /* ══════════════════════════════════════════════════════════
   *  INITIALISATION (attend que SheetJS et le DOM soient prêts)
   * ══════════════════════════════════════════════════════════ */
  function init() {
    if (typeof XLSX === 'undefined') {
      console.warn('[fuel_rapport] SheetJS (XLSX) non disponible. Vérifiez l\'ordre des scripts.');
      return;
    }
    // Tente l'injection immédiate, sinon observe le DOM
    if (!injectRapportButton()) {
      const observer = new MutationObserver(() => {
        if (injectRapportButton()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose publiquement pour usage manuel si nécessaire
  window.fuelRapport = { genMensuel: genRapportMensuel, genSemestriel: genRapportSemestriel, genAnnuel: genRapportAnnuel, showModal: showRapportModal };

})();
