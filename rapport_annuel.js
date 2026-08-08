/**
 * ============================================================
 *  RAPPORT_ANNUEL.JS — Rapport Annuel Consolidé — Parc Auto DRT Sfax
 *  Agrège automatiquement : parc véhicules, dépenses réparations
 *  (repair_rapport.js), CSC (csc_rapport.js), carburant (fuelData),
 *  sinistres — pour produire un rapport PowerPoint ET Excel
 *  professionnels, remplaçant le classeur "RAPPORT_2025-2026.xlsm"
 *  assemblé manuellement.
 *
 *  À inclure dans admin.html APRÈS repair_rapport.js et csc_rapport.js :
 *  <script src="rapport_annuel.js"></script>
 *
 *  Ne modifie AUCUNE fonction existante — module 100% additif.
 *  Injecte lui-même son onglet de navigation + sa carte UI.
 * ============================================================
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
   *  PALETTE — identique à fuel_rapport.js / repair_rapport.js / csc_rapport.js
   * ══════════════════════════════════════════════════════════ */
  var PPT = {
    navy: '1E3A5F', midnight: '0F172A', ink: '1E293B', slate: '64748B',
    mist: 'E2E8F0', paper: 'FFFFFF', bg: 'F8FAFC', orange: 'EF6C00',
    green: '10B981', red: 'EF4444', purple: '7C77DD', pink: 'D4537E', teal: '0EA5B7'
  };
  var TT_NAVY = 'FF1E3A5F', TT_ORANGE = 'FFEF6C00', TT_BAND = 'FFF1F5F9', TT_WHITE = 'FFFFFFFF';
  var PALETTE = [PPT.navy, PPT.orange, PPT.green, PPT.purple, PPT.pink, PPT.teal, PPT.slate, PPT.red];

  function fmt(n, dec) {
    return (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  }
  function normKey(s) { return String(s || '—').trim().toLowerCase().replace(/\s+/g, ' '); }
  function cap(s) {
    s = String(s || '—').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
  }

  /* ══════════════════════════════════════════════════════════
   *  LECTURE DES DONNÉES — même pattern get*Data() que les
   *  autres modules (mémoire pa.data > parcAutoData_v3 > clé dédiée)
   * ══════════════════════════════════════════════════════════ */
  function readShared(mainKey, dedicatedKey, fallback) {
    try {
      var pa = window.parcAuto;
      if (pa && pa.data && pa.data[mainKey]) {
        var v = pa.data[mainKey];
        if (Array.isArray(v) ? v.length : Object.keys(v || {}).length) return v;
      }
    } catch (e) {}
    try {
      var main = JSON.parse(localStorage.getItem('parcAutoData_v3') || '{}');
      if (main[mainKey]) return main[mainKey];
    } catch (e) {}
    try {
      var stored = JSON.parse(localStorage.getItem(dedicatedKey));
      if (stored) return stored;
    } catch (e) {}
    return fallback;
  }

  function getVehiclesList() {
    try {
      var pa = window.parcAuto;
      if (pa && pa.data && Array.isArray(pa.data.vehicles) && pa.data.vehicles.length) return pa.data.vehicles;
    } catch (e) {}
    try {
      var main = JSON.parse(localStorage.getItem('parcAutoData_v3') || '{}');
      if (Array.isArray(main.vehicles) && main.vehicles.length) return main.vehicles;
    } catch (e) {}
    try {
      if (typeof DEFAULT_DATA !== 'undefined' && Array.isArray(DEFAULT_DATA.vehicles)) return DEFAULT_DATA.vehicles;
    } catch (e) {}
    return [];
  }
  function getRepairHist() { return readShared('repairHistData', 'parcAutoRepairHist_v1', {}); }
  function getCscHist() { return readShared('cscHistData', 'parcAutoCscHist_v1', { vehicles: [], years: [] }); }
  function getFuelData() { return readShared('fuelData', 'parcAutoFuel_v1', {}); }
  function getSinistresData() {
    var v = readShared('sinistresData', 'parcAutoSinistres_v1', null);
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.values(v);
    return [];
  }

  /* ══════════════════════════════════════════════════════════
   *  AGRÉGATION — construit un objet unique "AN" (Annuel) prêt
   *  à être injecté dans les slides / feuilles Excel
   * ══════════════════════════════════════════════════════════ */
  function buildAnnualDataset(annee) {
    annee = String(annee);
    var vehicles = getVehiclesList();
    var repairHist = getRepairHist();
    var cscHist = getCscHist();
    var fuelData = getFuelData();
    var sinistres = getSinistresData();

    /* ---- Réparations de l'année ---- */
    var repYear = repairHist[annee] || {};
    var repEntries = Object.values(repYear);
    var repTotal = repEntries.reduce(function (s, e) { return s + (Number(e.montant) || 0); }, 0);

    var repYears = Object.keys(repairHist).map(Number).filter(function (y) { return !isNaN(y); }).sort();
    var repEvolution = repYears.map(function (y) {
      var ents = Object.values(repairHist[y] || {});
      return { annee: y, total: ents.reduce(function (s, e) { return s + (Number(e.montant) || 0); }, 0), nb: ents.length };
    });

    var byDivision = {};
    repEntries.forEach(function (e) {
      var raw = (e.division || 'Non renseigné').trim();
      var k = normKey(raw);
      if (!byDivision[k]) byDivision[k] = { label: cap(raw), nb: 0, total: 0 };
      byDivision[k].nb++; byDivision[k].total += Number(e.montant) || 0;
    });
    var divisionList = Object.values(byDivision).sort(function (a, b) { return b.total - a.total; });

    var byMarque = {};
    repEntries.forEach(function (e) {
      var raw = (e.marque || 'Non renseigné').trim();
      var k = normKey(raw);
      if (!byMarque[k]) byMarque[k] = { label: cap(raw), nb: 0, total: 0 };
      byMarque[k].nb++; byMarque[k].total += Number(e.montant) || 0;
    });
    var marqueList = Object.values(byMarque).sort(function (a, b) { return b.total - a.total; });

    var top10Repairs = repEntries.slice().sort(function (a, b) { return (b.montant || 0) - (a.montant || 0); }).slice(0, 10);

    /* ---- Parc / CSC (attributs véhicules) ---- */
    var cscVehicles = cscHist.vehicles || [];
    var byDivisionParc = {};
    var byAnciennete = {};
    var byEnergie = {};
    cscVehicles.forEach(function (v) {
      var d = (v.subdivision || 'Non renseigné').trim();
      var dk = normKey(d);
      if (!byDivisionParc[dk]) byDivisionParc[dk] = { label: cap(d), nb: 0 };
      byDivisionParc[dk].nb++;

      var a = (v.anciennete || 'Non renseigné').trim();
      var ak = normKey(a);
      if (!byAnciennete[ak]) byAnciennete[ak] = { label: cap(a), nb: 0 };
      byAnciennete[ak].nb++;

      var en = (v.energie || 'Non renseigné').trim();
      var ek = normKey(en);
      if (!byEnergie[ek]) byEnergie[ek] = { label: cap(en), nb: 0 };
      byEnergie[ek].nb++;
    });
    var divisionParcList = Object.values(byDivisionParc).sort(function (a, b) { return b.nb - a.nb; });
    var ancienneteList = Object.values(byAnciennete).sort(function (a, b) { return b.nb - a.nb; });
    var energieList = Object.values(byEnergie).sort(function (a, b) { return b.nb - a.nb; });

    /* ---- Dépense CSC de l'année, par zone ---- */
    var byCsc = {};
    var cscTotal = 0;
    cscVehicles.forEach(function (v) {
      var montant = (v.montants && v.montants[annee]) ? Number(v.montants[annee]) : 0;
      if (!montant) return;
      cscTotal += montant;
      var z = (v.subdivision || 'Non renseigné').trim();
      var zk = normKey(z);
      if (!byCsc[zk]) byCsc[zk] = { label: cap(z), total: 0, nb: 0 };
      byCsc[zk].total += montant; byCsc[zk].nb++;
    });
    var cscList = Object.values(byCsc).sort(function (a, b) { return b.total - a.total; });

    /* ---- Carburant de l'année (12 mois) ---- */
    var fuelMonths = Object.keys(fuelData).filter(function (k) { return k.indexOf(annee) === 0; });
    var fuelTotal = 0, fuelLitres = 0;
    var byFuelVehicle = {};
    fuelMonths.forEach(function (mk) {
      var month = fuelData[mk] || {};
      Object.keys(month).forEach(function (mat) {
        var e = month[mat] || {};
        var montant = Number(e.montant) || 0, litres = Number(e.litres) || 0;
        fuelTotal += montant; fuelLitres += litres;
        if (!byFuelVehicle[mat]) byFuelVehicle[mat] = { matricule: mat, modele: e.modele || '', chauffeur: e.chauffeur || '', montant: 0, litres: 0 };
        byFuelVehicle[mat].montant += montant; byFuelVehicle[mat].litres += litres;
      });
    });
    var topFuelVehicles = Object.values(byFuelVehicle).sort(function (a, b) { return b.montant - a.montant; }).slice(0, 10);

    /* ---- Sinistres de l'année ---- */
    var sinistresYear = sinistres.filter(function (s) {
      var d = s.date || s.dateSinistre || '';
      return String(d).indexOf(annee) === 0;
    });

    /* ---- Coût combiné par véhicule (entretien + carburant) pour Top 10 ---- */
    var byVehCombined = {};
    repEntries.forEach(function (e) {
      var m = e.matricule;
      if (!byVehCombined[m]) byVehCombined[m] = { matricule: m, chauffeur: e.chauffeur, entretien: 0, carburant: 0 };
      byVehCombined[m].entretien += Number(e.montant) || 0;
    });
    Object.values(byFuelVehicle).forEach(function (e) {
      var m = e.matricule;
      if (!byVehCombined[m]) byVehCombined[m] = { matricule: m, chauffeur: e.chauffeur, entretien: 0, carburant: 0 };
      byVehCombined[m].carburant += e.montant;
    });
    var top10Combined = Object.values(byVehCombined).map(function (v) {
      v.total = v.entretien + v.carburant; return v;
    }).sort(function (a, b) { return b.total - a.total; }).slice(0, 10);

    /* ---- Insights / synthèse auto ---- */
    var nbVehicules = vehicles.length || cscVehicles.length;
    var parcAge10Plus = ancienneteList.filter(function (a) { return /10|15|20/.test(a.label); })
      .reduce(function (s, a) { return s + a.nb; }, 0);
    var pctAge10Plus = cscVehicles.length ? Math.round((parcAge10Plus / cscVehicles.length) * 100) : 0;

    var prevYear = String(Number(annee) - 1);
    var prevTotal = (repEvolution.find(function (e) { return String(e.annee) === prevYear; }) || {}).total || 0;
    var evolPct = prevTotal ? Math.round(((repTotal - prevTotal) / prevTotal) * 100) : null;

    return {
      annee: annee,
      nbVehicules: nbVehicules,
      repTotal: repTotal, repNb: repEntries.length, repEvolution: repEvolution,
      divisionList: divisionList, marqueList: marqueList, top10Repairs: top10Repairs,
      divisionParcList: divisionParcList, ancienneteList: ancienneteList, energieList: energieList,
      cscList: cscList, cscTotal: cscTotal,
      fuelTotal: fuelTotal, fuelLitres: fuelLitres, topFuelVehicles: topFuelVehicles,
      sinistresYear: sinistresYear,
      top10Combined: top10Combined,
      pctAge10Plus: pctAge10Plus, evolPct: evolPct,
      dépenseGlobale: repTotal + fuelTotal + cscTotal
    };
  }

  /* ══════════════════════════════════════════════════════════
   *  CONSTRUCTION PPTX
   * ══════════════════════════════════════════════════════════ */
  function buildRapportAnnuelPptx(PptxGenJSCtor, AN, meta) {
    meta = meta || {};
    var pres = new PptxGenJSCtor();
    pres.layout = 'LAYOUT_WIDE';
    pres.author = 'Parc Auto DRT Sfax';
    pres.title = 'Rapport Annuel ' + AN.annee + ' — Parc Automobile DRT Sfax';

    /* ============ SLIDE 1 — COUVERTURE ============ */
    {
      var s = pres.addSlide();
      s.background = { color: PPT.midnight };
      s.addShape(pres.shapes.OVAL, { x: 9.6, y: -2.2, w: 6, h: 6, fill: { color: PPT.navy }, line: { type: 'none' } });
      s.addShape(pres.shapes.OVAL, { x: 10.6, y: 4.6, w: 4.2, h: 4.2, fill: { color: PPT.orange, transparency: 84 }, line: { type: 'none' } });
      s.addText('🚗', { x: 0.7, y: 0.75, w: 1.2, h: 1.2, fontSize: 44, align: 'left', valign: 'middle' });
      s.addText('TUNISIE TELECOM — DRT SFAX', { x: 0.7, y: 1.75, w: 9, h: 0.5, fontSize: 14, color: PPT.orange, bold: true, charSpacing: 3, fontFace: 'Calibri' });
      s.addText('Rapport Annuel', { x: 0.65, y: 2.25, w: 11, h: 1.3, fontSize: 48, color: PPT.paper, bold: true, fontFace: 'Cambria' });
      s.addText('Parc Automobile', { x: 0.65, y: 3.1, w: 11, h: 0.8, fontSize: 30, color: PPT.mist, bold: true, fontFace: 'Cambria' });
      s.addText('Exercice ' + AN.annee + ' — Direction Régionale des Télécommunications de Sfax', {
        x: 0.7, y: 3.95, w: 10, h: 0.5, fontSize: 15, color: PPT.mist, fontFace: 'Calibri'
      });
      s.addText('Document généré le ' + (meta.generatedOn || new Date().toLocaleDateString('fr-FR')), {
        x: 0.7, y: 6.7, w: 8, h: 0.4, fontSize: 11, color: '94A3B8', fontFace: 'Calibri'
      });
    }

    /* ============ SLIDE 2 — VUE D'ENSEMBLE (KPIs) ============ */
    {
      var s = pres.addSlide();
      s.background = { color: PPT.bg };
      s.addText('Vue d\u2019ensemble', { x: 0.6, y: 0.4, w: 10, h: 0.6, fontSize: 28, bold: true, color: PPT.ink, fontFace: 'Cambria' });
      s.addText('Indicateurs clés — exercice ' + AN.annee, { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: PPT.slate, fontFace: 'Calibri' });

      var kpis = [
        { label: 'Véhicules au parc', val: fmt(AN.nbVehicules), color: PPT.navy },
        { label: 'Dépense entretien', val: fmt(AN.repTotal, 0) + ' DT', color: PPT.orange },
        { label: 'Dépense carburant', val: fmt(AN.fuelTotal, 0) + ' DT', color: PPT.green },
        { label: 'Dépense CSC (contrôle)', val: fmt(AN.cscTotal, 0) + ' DT', color: PPT.teal },
        { label: 'Interventions réparation', val: fmt(AN.repNb), color: PPT.purple },
        { label: 'Coût moyen / véhicule', val: AN.nbVehicules ? fmt(Math.round(AN.repTotal / AN.nbVehicules)) + ' DT' : '—', color: PPT.pink },
        { label: 'Parc > 10 ans', val: AN.pctAge10Plus + ' %', color: PPT.red },
        { label: 'Évolution vs N-1', val: AN.evolPct === null ? 'n/d' : (AN.evolPct > 0 ? '+' : '') + AN.evolPct + ' %', color: (AN.evolPct > 0 ? PPT.red : PPT.green) }
      ];
      var cw = 2.9, ch = 1.55, gx = 0.25, gy = 0.25, x0 = 0.6, y0 = 1.55;
      kpis.forEach(function (k, i) {
        var col = i % 4, row = Math.floor(i / 4);
        var x = x0 + col * (cw + gx), y = y0 + row * (ch + gy);
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x, y: y, w: cw, h: ch, rectRadius: 0.08, fill: { color: PPT.paper }, line: { color: PPT.mist, width: 1 }, shadow: { type: 'outer', blur: 6, offset: 2, angle: 90, color: '000000', opacity: 0.08 } });
        s.addShape(pres.shapes.RECTANGLE, { x: x, y: y, w: 0.08, h: ch, fill: { color: k.color }, line: { type: 'none' } });
        s.addText(k.val, { x: x + 0.2, y: y + 0.18, w: cw - 0.4, h: 0.7, fontSize: 22, bold: true, color: PPT.ink, fontFace: 'Cambria', align: 'left' });
        s.addText(k.label, { x: x + 0.2, y: y + 0.92, w: cw - 0.4, h: 0.5, fontSize: 11, color: PPT.slate, fontFace: 'Calibri', align: 'left' });
      });
    }

    /* ============ SLIDE 3 — RÉPARTITION DU PARC PAR DIVISION ============ */
    addDoughnutSlide(pres, 'Répartition du parc par division', 'Nombre de véhicules par division / subdivision',
      AN.divisionParcList, 'nb', 'Nb véhicules');

    /* ============ SLIDE 4 — DÉPENSE ENTRETIEN PAR DIVISION ============ */
    addBarTableSlide(pres, 'Dépense entretien par division', 'Exercice ' + AN.annee,
      AN.divisionList, AN.repTotal, 'Division');

    /* ============ SLIDE 5 — DÉPENSE ENTRETIEN PAR MARQUE ============ */
    addBarTableSlide(pres, 'Dépense entretien par marque', 'Exercice ' + AN.annee,
      AN.marqueList, AN.repTotal, 'Marque');

    /* ============ SLIDE 6 — ANCIENNETÉ & ÉNERGIE DU PARC ============ */
    {
      var s = pres.addSlide();
      s.background = { color: PPT.paper };
      s.addText('Ancienneté et énergie du parc', { x: 0.6, y: 0.4, w: 10, h: 0.6, fontSize: 28, bold: true, color: PPT.ink, fontFace: 'Cambria' });
      s.addText('Structure du parc automobile', { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: PPT.slate, fontFace: 'Calibri' });

      if (AN.ancienneteList.length) {
        s.addChart(pres.charts.BAR, [{ name: 'Nb véhicules', labels: AN.ancienneteList.map(function (d) { return d.label; }), values: AN.ancienneteList.map(function (d) { return d.nb; }) }], {
          x: 0.5, y: 1.55, w: 6.0, h: 4.9, chartColors: [PPT.navy], barGapWidthPct: 40,
          chartArea: { fill: { color: PPT.paper } }, catAxisLabelColor: PPT.slate, valAxisLabelColor: PPT.slate,
          valGridLine: { color: PPT.mist, size: 0.75 }, catGridLine: { style: 'none' },
          showLegend: false, showValue: true, dataLabelColor: PPT.ink, dataLabelFontSize: 9,
          title: 'Par ancienneté', showTitle: true, titleColor: PPT.ink, titleFontSize: 12
        });
      }
      if (AN.energieList.length) {
        s.addChart(pres.charts.DOUGHNUT, [{ name: 'Énergie', labels: AN.energieList.map(function (d) { return d.label; }), values: AN.energieList.map(function (d) { return d.nb; }) }], {
          x: 6.9, y: 1.55, w: 6.0, h: 4.9, chartColors: PALETTE,
          showLegend: true, legendPos: 'b', legendColor: PPT.slate, legendFontSize: 10,
          showPercent: true, dataLabelColor: PPT.paper, dataLabelFontSize: 10, dataLabelPosition: 'ctr',
          chartArea: { fill: { color: PPT.paper } },
          title: 'Par énergie', showTitle: true, titleColor: PPT.ink, titleFontSize: 12
        });
      }
      if (!AN.ancienneteList.length && !AN.energieList.length) {
        s.addText('Aucune donnée d\u2019ancienneté / énergie importée (module CSC).', { x: 0.6, y: 3, w: 10, h: 0.6, fontSize: 16, color: PPT.slate });
      }
    }

    /* ============ SLIDE 7 — CARBURANT ============ */
    {
      var s = pres.addSlide();
      s.background = { color: PPT.bg };
      s.addText('Carburant', { x: 0.6, y: 0.4, w: 10, h: 0.6, fontSize: 28, bold: true, color: PPT.ink, fontFace: 'Cambria' });
      s.addText('Consommation — exercice ' + AN.annee, { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: PPT.slate, fontFace: 'Calibri' });

      s.addText(fmt(AN.fuelTotal, 0) + ' DT', { x: 0.6, y: 1.5, w: 4, h: 0.6, fontSize: 26, bold: true, color: PPT.green, fontFace: 'Cambria' });
      s.addText('Dépense totale carburant', { x: 0.6, y: 2.05, w: 4, h: 0.4, fontSize: 11, color: PPT.slate });
      s.addText(fmt(AN.fuelLitres, 0) + ' L', { x: 4.8, y: 1.5, w: 4, h: 0.6, fontSize: 26, bold: true, color: PPT.navy, fontFace: 'Cambria' });
      s.addText('Volume total', { x: 4.8, y: 2.05, w: 4, h: 0.4, fontSize: 11, color: PPT.slate });

      if (AN.topFuelVehicles.length) {
        s.addText('Top 10 véhicules — consommation', { x: 0.6, y: 2.75, w: 8, h: 0.4, fontSize: 14, bold: true, color: PPT.ink, fontFace: 'Calibri' });
        var rows = [[
          { text: 'Matricule', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10 } },
          { text: 'Modèle', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10 } },
          { text: 'Litres', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'center' } },
          { text: 'Montant (DT)', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'right' } }
        ]];
        AN.topFuelVehicles.forEach(function (v, i) {
          var fill = i % 2 === 0 ? PPT.paper : PPT.bg;
          rows.push([
            { text: v.matricule, options: { fill: { color: fill }, fontSize: 9.5, color: PPT.ink } },
            { text: v.modele || '—', options: { fill: { color: fill }, fontSize: 9.5, color: PPT.slate } },
            { text: fmt(v.litres, 0), options: { fill: { color: fill }, fontSize: 9.5, color: PPT.slate, align: 'center' } },
            { text: fmt(v.montant, 0), options: { fill: { color: fill }, fontSize: 9.5, bold: true, color: PPT.navy, align: 'right' } }
          ]);
        });
        s.addTable(rows, { x: 0.6, y: 3.2, w: 12.1, colW: [3.2, 5.2, 1.8, 1.9], border: { pt: 0.5, color: PPT.mist }, valign: 'middle', rowH: 0.32 });
      }
    }

    /* ============ SLIDE 8 — DÉPENSE CSC PAR ZONE ============ */
    addBarTableSlide(pres, 'Dépense contrôle technique (CSC) par zone', 'Exercice ' + AN.annee,
      AN.cscList, AN.cscTotal, 'Zone CSC');

    /* ============ SLIDE 9 — ÉVOLUTION PLURIANNUELLE ============ */
    {
      var s = pres.addSlide();
      s.background = { color: PPT.paper };
      s.addText('Évolution pluriannuelle des dépenses d\u2019entretien', { x: 0.6, y: 0.4, w: 11, h: 0.6, fontSize: 26, bold: true, color: PPT.ink, fontFace: 'Cambria' });
      s.addText('Toutes années importées', { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: PPT.slate, fontFace: 'Calibri' });

      if (AN.repEvolution.length) {
        s.addChart(pres.charts.LINE, [{
          name: 'Dépense (DT)', labels: AN.repEvolution.map(function (e) { return String(e.annee); }), values: AN.repEvolution.map(function (e) { return Math.round(e.total); })
        }], {
          x: 0.5, y: 1.55, w: 12.3, h: 4.9, chartColors: [PPT.orange], lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 7,
          chartArea: { fill: { color: PPT.paper } }, catAxisLabelColor: PPT.slate, valAxisLabelColor: PPT.slate,
          valGridLine: { color: PPT.mist, size: 0.75 }, catGridLine: { style: 'none' },
          showLegend: false, showValue: true, dataLabelColor: PPT.ink, dataLabelFontSize: 9
        });
      } else {
        s.addText('Aucune donnée pluriannuelle disponible.', { x: 0.6, y: 3, w: 10, h: 0.6, fontSize: 16, color: PPT.slate });
      }
    }

    /* ============ SLIDE 10 — TOP 10 VÉHICULES LES PLUS COÛTEUX ============ */
    {
      var s = pres.addSlide();
      s.background = { color: PPT.bg };
      s.addText('Top 10 véhicules les plus coûteux', { x: 0.6, y: 0.4, w: 11, h: 0.6, fontSize: 28, bold: true, color: PPT.ink, fontFace: 'Cambria' });
      s.addText('Entretien + carburant cumulés — ' + AN.annee, { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: PPT.slate, fontFace: 'Calibri' });

      if (AN.top10Combined.length) {
        var rows = [[
          { text: 'Matricule', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10 } },
          { text: 'Chauffeur', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10 } },
          { text: 'Entretien (DT)', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'right' } },
          { text: 'Carburant (DT)', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'right' } },
          { text: 'Total (DT)', options: { bold: true, color: PPT.paper, fill: { color: PPT.orange }, fontSize: 10, align: 'right' } }
        ]];
        AN.top10Combined.forEach(function (v, i) {
          var fill = i % 2 === 0 ? PPT.paper : PPT.bg;
          rows.push([
            { text: v.matricule || '—', options: { fill: { color: fill }, fontSize: 9.5, color: PPT.ink } },
            { text: v.chauffeur || '—', options: { fill: { color: fill }, fontSize: 9.5, color: PPT.slate } },
            { text: fmt(v.entretien, 0), options: { fill: { color: fill }, fontSize: 9.5, color: PPT.slate, align: 'right' } },
            { text: fmt(v.carburant, 0), options: { fill: { color: fill }, fontSize: 9.5, color: PPT.slate, align: 'right' } },
            { text: fmt(v.total, 0), options: { fill: { color: fill }, fontSize: 9.5, bold: true, color: PPT.navy, align: 'right' } }
          ]);
        });
        s.addTable(rows, { x: 0.6, y: 1.6, w: 12.1, colW: [2.5, 3.6, 2.1, 2.1, 1.8], border: { pt: 0.5, color: PPT.mist }, valign: 'middle', rowH: 0.42 });
      } else {
        s.addText('Aucune donnée disponible.', { x: 0.6, y: 3, w: 10, h: 0.6, fontSize: 16, color: PPT.slate });
      }
    }

    /* ============ SLIDE 11 — SYNTHÈSE & RECOMMANDATIONS ============ */
    {
      var s = pres.addSlide();
      s.background = { color: PPT.midnight };
      s.addText('Synthèse & recommandations', { x: 0.6, y: 0.5, w: 11, h: 0.7, fontSize: 28, bold: true, color: PPT.paper, fontFace: 'Cambria' });

      var bullets = [];
      if (AN.divisionList.length) bullets.push('La division ' + AN.divisionList[0].label + ' concentre la dépense d\u2019entretien la plus élevée (' + fmt(AN.divisionList[0].total, 0) + ' DT).');
      if (AN.marqueList.length) bullets.push('La marque ' + AN.marqueList[0].label + ' représente le poste de dépense le plus important (' + fmt(AN.marqueList[0].total, 0) + ' DT sur ' + AN.marqueList[0].nb + ' véhicule(s)).');
      if (AN.evolPct !== null) bullets.push('La dépense d\u2019entretien a ' + (AN.evolPct >= 0 ? 'augmenté' : 'diminué') + ' de ' + Math.abs(AN.evolPct) + ' % par rapport à ' + (Number(AN.annee) - 1) + '.');
      bullets.push(AN.pctAge10Plus + ' % du parc a plus de 10 ans d\u2019ancienneté — un renouvellement progressif est recommandé pour limiter la hausse des coûts de maintenance.');
      if (AN.top10Combined.length) bullets.push('Le véhicule ' + AN.top10Combined[0].matricule + ' concentre le coût global le plus élevé (' + fmt(AN.top10Combined[0].total, 0) + ' DT entretien + carburant).');
      bullets.push('Dépense globale consolidée (entretien + carburant + CSC) : ' + fmt(AN.dépenseGlobale, 0) + ' DT sur l\u2019exercice ' + AN.annee + '.');

      s.addText(bullets.map(function (b) { return { text: b, options: { bullet: { code: '2726', color: PPT.orange }, breakLine: true, paraSpaceAfter: 14 } }; }), {
        x: 0.7, y: 1.5, w: 11.5, h: 5.2, fontSize: 15, color: PPT.mist, fontFace: 'Calibri', valign: 'top'
      });
    }

    /* ============ SLIDE 12 — CLÔTURE ============ */
    {
      var s = pres.addSlide();
      s.background = { color: PPT.navy };
      s.addShape(pres.shapes.OVAL, { x: 9.6, y: -2.2, w: 6, h: 6, fill: { color: PPT.midnight }, line: { type: 'none' } });
      s.addText('Merci', { x: 0.7, y: 2.6, w: 8, h: 1.2, fontSize: 44, color: PPT.paper, bold: true, fontFace: 'Cambria' });
      s.addText('Parc Automobile DRT Sfax — Rapport Annuel ' + AN.annee, { x: 0.7, y: 3.6, w: 9, h: 0.5, fontSize: 15, color: PPT.mist, fontFace: 'Calibri' });
      s.addText('Document généré automatiquement le ' + (meta.generatedOn || new Date().toLocaleDateString('fr-FR')), { x: 0.7, y: 6.7, w: 9, h: 0.4, fontSize: 11, color: '94A3B8' });
    }

    return pres;
  }

  /* ---- helpers de slides réutilisables ---- */
  function addDoughnutSlide(pres, title, subtitle, list, valueKey, valueLabel) {
    var s = pres.addSlide();
    s.background = { color: PPT.bg };
    s.addText(title, { x: 0.6, y: 0.4, w: 10, h: 0.6, fontSize: 28, bold: true, color: PPT.ink, fontFace: 'Cambria' });
    s.addText(subtitle, { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: PPT.slate, fontFace: 'Calibri' });

    if (list.length) {
      var total = list.reduce(function (s2, d) { return s2 + d[valueKey]; }, 0);
      s.addChart(pres.charts.DOUGHNUT, [{ name: valueLabel, labels: list.map(function (d) { return d.label; }), values: list.map(function (d) { return d[valueKey]; }) }], {
        x: 0.6, y: 1.6, w: 6.2, h: 5.1, chartColors: PALETTE,
        showLegend: true, legendPos: 'r', legendColor: PPT.slate, legendFontSize: 11,
        showPercent: true, dataLabelColor: PPT.paper, dataLabelFontSize: 10, dataLabelPosition: 'ctr',
        chartArea: { fill: { color: PPT.bg } }
      });
      var rows = [[
        { text: 'Libellé', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10 } },
        { text: valueLabel, options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'right' } },
        { text: '%', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'center' } }
      ]];
      list.forEach(function (d, i) {
        var fill = i % 2 === 0 ? PPT.paper : PPT.bg;
        rows.push([
          { text: d.label, options: { fill: { color: fill }, fontSize: 9.5, color: PPT.ink } },
          { text: fmt(d[valueKey]), options: { fill: { color: fill }, fontSize: 9.5, bold: true, color: PPT.navy, align: 'right' } },
          { text: total ? ((d[valueKey] / total) * 100).toFixed(1) + '%' : '0%', options: { fill: { color: fill }, fontSize: 9.5, color: PPT.slate, align: 'center' } }
        ]);
      });
      s.addTable(rows, { x: 7.1, y: 1.6, w: 5.6, colW: [3.2, 1.4, 1.0], border: { pt: 0.5, color: PPT.mist }, valign: 'middle', rowH: 0.3 });
    } else {
      s.addText('Aucune donnée disponible (module CSC non importé pour cette année).', { x: 0.6, y: 3, w: 10, h: 0.6, fontSize: 16, color: PPT.slate });
    }
  }

  function addBarTableSlide(pres, title, subtitle, list, total, colLabel) {
    var s = pres.addSlide();
    s.background = { color: PPT.paper };
    s.addText(title, { x: 0.6, y: 0.4, w: 10, h: 0.6, fontSize: 26, bold: true, color: PPT.ink, fontFace: 'Cambria' });
    s.addText(subtitle, { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: PPT.slate, fontFace: 'Calibri' });

    if (list.length) {
      var top = list.slice(0, 8);
      s.addChart(pres.charts.BAR, [{ name: 'Dépense (DT)', labels: top.map(function (d) { return d.label; }), values: top.map(function (d) { return Math.round(d.total); }) }], {
        x: 0.5, y: 1.55, w: 12.3, h: 2.4, chartColors: [PPT.navy], barGapWidthPct: 40, barDir: 'bar',
        chartArea: { fill: { color: PPT.paper } }, catAxisLabelColor: PPT.slate, valAxisLabelColor: PPT.slate,
        valGridLine: { color: PPT.mist, size: 0.75 }, catGridLine: { style: 'none' },
        showLegend: false, showValue: true, dataLabelColor: PPT.ink, dataLabelFontSize: 9
      });
      var rows = [[
        { text: colLabel, options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10 } },
        { text: 'Nb véh.', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'center' } },
        { text: 'Dépense (DT)', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'right' } },
        { text: '%', options: { bold: true, color: PPT.paper, fill: { color: PPT.navy }, fontSize: 10, align: 'center' } }
      ]];
      list.forEach(function (d, i) {
        var fill = i % 2 === 0 ? PPT.paper : PPT.bg;
        rows.push([
          { text: d.label, options: { fill: { color: fill }, fontSize: 9.5, color: PPT.ink } },
          { text: fmt(d.nb || 0), options: { fill: { color: fill }, fontSize: 9.5, color: PPT.slate, align: 'center' } },
          { text: fmt(d.total, 0) + ' DT', options: { fill: { color: fill }, fontSize: 9.5, bold: true, color: PPT.navy, align: 'right' } },
          { text: total ? ((d.total / total) * 100).toFixed(1) + '%' : '0%', options: { fill: { color: fill }, fontSize: 9.5, color: PPT.slate, align: 'center' } }
        ]);
      });
      s.addTable(rows, { x: 0.6, y: 4.1, w: 12.1, colW: [5.5, 1.8, 3.1, 1.7], border: { pt: 0.5, color: PPT.mist }, valign: 'middle', rowH: 0.3 });
    } else {
      s.addText('Aucune donnée disponible pour cette année.', { x: 0.6, y: 3, w: 10, h: 0.6, fontSize: 16, color: PPT.slate });
    }
  }

  /* ══════════════════════════════════════════════════════════
   *  CONSTRUCTION EXCEL — classeur multi-feuilles stylé TT
   * ══════════════════════════════════════════════════════════ */
  function styleSheetSection(ws, startRow, title, headers, rows, colWidths, numFmts) {
    var nCols = headers.length;
    ws.mergeCells(startRow, 1, startRow, nCols);
    var titleCell = ws.getCell(startRow, 1);
    titleCell.value = title;
    titleCell.font = { bold: true, color: { argb: TT_WHITE }, size: 12 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TT_NAVY } };
    ws.getRow(startRow).height = 24;

    var headerRow = ws.getRow(startRow + 1);
    headers.forEach(function (h, i) {
      var c = headerRow.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: TT_WHITE }, size: 10 };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TT_ORANGE } };
      c.border = { top: { style: 'thin', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }, left: { style: 'thin', color: { argb: 'FFCCCCCC' } }, right: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
    });
    headerRow.height = 20;

    rows.forEach(function (row, idx) {
      var r = ws.getRow(startRow + 2 + idx);
      row.forEach(function (val, ci) {
        var c = r.getCell(ci + 1);
        c.value = val;
        c.font = { size: 9 };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.border = { top: { style: 'thin', color: { argb: 'FFE0E0E0' } }, bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }, left: { style: 'thin', color: { argb: 'FFE0E0E0' } }, right: { style: 'thin', color: { argb: 'FFE0E0E0' } } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: (idx % 2 === 0) ? TT_WHITE : TT_BAND } };
        if (numFmts && numFmts[ci]) c.numFmt = numFmts[ci];
      });
    });

    if (colWidths) colWidths.forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    return startRow + 2 + rows.length + 2; // ligne libre pour la prochaine section
  }

  async function buildRapportAnnuelExcel(ExcelJSCtor, AN) {
    var wb = new ExcelJSCtor.Workbook();
    wb.creator = 'DRT Sfax — Parc Auto';

    /* ---- Feuille Synthèse ---- */
    var wsSynth = wb.addWorksheet('Synthèse ' + AN.annee);
    styleSheetSection(wsSynth, 1, 'RAPPORT ANNUEL PARC AUTOMOBILE — DRT SFAX — ' + AN.annee,
      ['Indicateur', 'Valeur'], [
        ['Véhicules au parc', AN.nbVehicules],
        ['Dépense entretien (DT)', Math.round(AN.repTotal)],
        ['Dépense carburant (DT)', Math.round(AN.fuelTotal)],
        ['Dépense CSC (DT)', Math.round(AN.cscTotal)],
        ['Dépense globale consolidée (DT)', Math.round(AN.dépenseGlobale)],
        ['Interventions réparation', AN.repNb],
        ['Coût moyen / véhicule (DT)', AN.nbVehicules ? Math.round(AN.repTotal / AN.nbVehicules) : 0],
        ['Parc > 10 ans (%)', AN.pctAge10Plus],
        ['Évolution dépense entretien vs N-1 (%)', AN.evolPct === null ? 'n/d' : AN.evolPct]
      ], [40, 20]);

    /* ---- Feuille Parc par division ---- */
    var wsParc = wb.addWorksheet('Parc par Division');
    styleSheetSection(wsParc, 1, 'RÉPARTITION DU PARC PAR DIVISION — ' + AN.annee,
      ['Division', 'Nb véhicules'],
      AN.divisionParcList.map(function (d) { return [d.label, d.nb]; }), [40, 16]);

    /* ---- Feuille Dépense par Division ---- */
    var wsDiv = wb.addWorksheet('Dépense par Division');
    styleSheetSection(wsDiv, 1, 'DÉPENSE ENTRETIEN PAR DIVISION — ' + AN.annee,
      ['Division', 'Nb véhicules', 'Dépense (DT)', '% du total'],
      AN.divisionList.map(function (d) { return [d.label, d.nb, Math.round(d.total), AN.repTotal ? ((d.total / AN.repTotal) * 100).toFixed(1) + '%' : '0%']; }),
      [40, 14, 18, 12]);

    /* ---- Feuille Dépense par Marque ---- */
    var wsMarque = wb.addWorksheet('Dépense par Marque');
    styleSheetSection(wsMarque, 1, 'DÉPENSE ENTRETIEN PAR MARQUE — ' + AN.annee,
      ['Marque', 'Nb véhicules', 'Dépense (DT)', '% du total'],
      AN.marqueList.map(function (d) { return [d.label, d.nb, Math.round(d.total), AN.repTotal ? ((d.total / AN.repTotal) * 100).toFixed(1) + '%' : '0%']; }),
      [30, 14, 18, 12]);

    /* ---- Feuille Ancienneté & Énergie ---- */
    var wsAge = wb.addWorksheet('Ancienneté & Énergie');
    var nextRow = styleSheetSection(wsAge, 1, 'RÉPARTITION PAR ANCIENNETÉ',
      ['Ancienneté', 'Nb véhicules'], AN.ancienneteList.map(function (d) { return [d.label, d.nb]; }), [30, 16]);
    styleSheetSection(wsAge, nextRow, 'RÉPARTITION PAR ÉNERGIE',
      ['Énergie', 'Nb véhicules'], AN.energieList.map(function (d) { return [d.label, d.nb]; }), [30, 16]);

    /* ---- Feuille CSC ---- */
    var wsCsc = wb.addWorksheet('Dépense CSC');
    styleSheetSection(wsCsc, 1, 'DÉPENSE CONTRÔLE TECHNIQUE (CSC) PAR ZONE — ' + AN.annee,
      ['Zone', 'Nb véhicules', 'Dépense (DT)', '% du total'],
      AN.cscList.map(function (d) { return [d.label, d.nb, Math.round(d.total), AN.cscTotal ? ((d.total / AN.cscTotal) * 100).toFixed(1) + '%' : '0%']; }),
      [30, 14, 18, 12]);

    /* ---- Feuille Carburant ---- */
    var wsFuel = wb.addWorksheet('Carburant');
    styleSheetSection(wsFuel, 1, 'TOP VÉHICULES — CONSOMMATION CARBURANT — ' + AN.annee,
      ['Matricule', 'Modèle', 'Chauffeur', 'Litres', 'Montant (DT)'],
      AN.topFuelVehicles.map(function (v) { return [v.matricule, v.modele || '—', v.chauffeur || '—', Math.round(v.litres), Math.round(v.montant)]; }),
      [16, 22, 26, 12, 16]);

    /* ---- Feuille Évolution pluriannuelle ---- */
    var wsEvol = wb.addWorksheet('Évolution pluriannuelle');
    styleSheetSection(wsEvol, 1, 'ÉVOLUTION DES DÉPENSES D\u2019ENTRETIEN', ['Année', 'Nb interventions', 'Dépense (DT)'],
      AN.repEvolution.map(function (e) { return [e.annee, e.nb, Math.round(e.total)]; }), [14, 18, 18]);

    /* ---- Feuille Top véhicules ---- */
    var wsTop = wb.addWorksheet('Top Véhicules');
    styleSheetSection(wsTop, 1, 'TOP 10 VÉHICULES LES PLUS COÛTEUX (ENTRETIEN + CARBURANT) — ' + AN.annee,
      ['Matricule', 'Chauffeur', 'Entretien (DT)', 'Carburant (DT)', 'Total (DT)'],
      AN.top10Combined.map(function (v) { return [v.matricule || '—', v.chauffeur || '—', Math.round(v.entretien), Math.round(v.carburant), Math.round(v.total)]; }),
      [16, 26, 16, 16, 16]);

    return wb;
  }

  /* ══════════════════════════════════════════════════════════
   *  UI — injection de l'onglet "Rapport Annuel" (100% additif)
   * ══════════════════════════════════════════════════════════ */
  function injectNavAndTab() {
    if (document.getElementById('tab-rapport-annuel')) return; // déjà injecté

    var navList = document.querySelector('.nav-item[data-nav="repairs"]');
    if (navList && navList.parentNode) {
      var navItem = document.createElement('div');
      navItem.className = 'nav-item';
      navItem.setAttribute('data-nav', 'rapport-annuel');
      navItem.setAttribute('onclick', "showTab('rapport-annuel'); closeMobileSidebar(); if(typeof renderRapportAnnuelKpis==='function') renderRapportAnnuelKpis();");
      navItem.innerHTML = '<span>📈</span> Rapport Annuel';
      navList.parentNode.insertBefore(navItem, navList);
    }

    var anyTabContent = document.querySelector('.tab-content');
    if (anyTabContent && anyTabContent.parentNode) {
      var tab = document.createElement('div');
      tab.className = 'tab-content';
      tab.id = 'tab-rapport-annuel';
      tab.innerHTML =
        '<div class="card">' +
        '  <div class="card-header">' +
        '    <div>' +
        '      <div class="card-title">📈 Rapport Annuel — Parc Automobile</div>' +
        '      <div class="card-subtitle">Synthèse consolidée : entretien, carburant, CSC, parc — générée à partir de toutes les données déjà importées</div>' +
        '    </div>' +
        '    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">' +
        '      <select class="form-select" id="rapport-annuel-year-select" style="max-width:120px;" onchange="renderRapportAnnuelKpis()"></select>' +
        '      <button class="btn btn-primary" onclick="genererRapportAnnuelPPTX(event)">📊 Générer PPTX</button>' +
        '      <button class="btn btn-primary" style="background:#0EA5B7;" onclick="genererRapportAnnuelExcel(event)">🎨 Générer Excel</button>' +
        '    </div>' +
        '  </div>' +
        '  <div style="margin-bottom:12px;"><span id="rapport-annuel-status" style="font-size:13px;color:var(--secondary);"></span></div>' +
        '  <div style="font-size:12px;font-weight:700;color:var(--secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">📆 Indicateurs de l\u2019exercice</div>' +
        '  <div class="stats-grid" id="rapport-annuel-kpi-grid" style="margin-bottom:10px;"></div>' +
        '</div>';
      anyTabContent.parentNode.insertBefore(tab, anyTabContent);
    }

    populateYearSelect();
  }

  function populateYearSelect() {
    var sel = document.getElementById('rapport-annuel-year-select');
    if (!sel) return;
    var repairHist = getRepairHist();
    var cscHist = getCscHist();
    var years = {};
    Object.keys(repairHist).forEach(function (y) { years[y] = true; });
    (cscHist.years || []).forEach(function (y) { years[y] = true; });
    years[String(new Date().getFullYear())] = true;
    var list = Object.keys(years).sort(function (a, b) { return b - a; });
    sel.innerHTML = list.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
  }

  window.renderRapportAnnuelKpis = function () {
    var sel = document.getElementById('rapport-annuel-year-select');
    if (!sel) return;
    if (!sel.options.length) populateYearSelect();
    var annee = sel.value || String(new Date().getFullYear());
    var AN = buildAnnualDataset(annee);
    var grid = document.getElementById('rapport-annuel-kpi-grid');
    if (!grid) return;
    function card(label, val) {
      return '<div class="stat-card"><div class="stat-value">' + val + '</div><div class="stat-label">' + label + '</div></div>';
    }
    grid.innerHTML =
      card('Véhicules au parc', fmt(AN.nbVehicules)) +
      card('Dépense entretien', fmt(AN.repTotal, 0) + ' DT') +
      card('Dépense carburant', fmt(AN.fuelTotal, 0) + ' DT') +
      card('Dépense CSC', fmt(AN.cscTotal, 0) + ' DT') +
      card('Parc > 10 ans', AN.pctAge10Plus + ' %') +
      card('Évolution vs N-1', AN.evolPct === null ? 'n/d' : (AN.evolPct > 0 ? '+' : '') + AN.evolPct + ' %');
  };

  function currentAnnee() {
    var sel = document.getElementById('rapport-annuel-year-select');
    return (sel && sel.value) ? sel.value : String(new Date().getFullYear());
  }
  function setStatus(msg) {
    var el = document.getElementById('rapport-annuel-status');
    if (el) el.textContent = msg;
  }
  function btnState(btn, loading, label) {
    if (!btn) return;
    if (loading) { btn.dataset.originalLabel = btn.dataset.originalLabel || btn.innerHTML; btn.innerHTML = '⏳ Génération en cours...'; btn.disabled = true; }
    else { if (btn.dataset.originalLabel) btn.innerHTML = btn.dataset.originalLabel; btn.disabled = false; }
  }

  window.genererRapportAnnuelPPTX = async function (evt) {
    var btn = evt && evt.target ? evt.target.closest('button') : null;
    try {
      if (typeof PptxGenJS === 'undefined') { alert('Librairie PptxGenJS non disponible — vérifiez votre connexion.'); return; }
      btnState(btn, true);
      setStatus('Agrégation des données…');
      var annee = currentAnnee();
      var AN = buildAnnualDataset(annee);
      setStatus('Génération du PowerPoint…');
      var pres = buildRapportAnnuelPptx(PptxGenJS, AN, { generatedOn: new Date().toLocaleDateString('fr-FR') });
      var today = new Date().toISOString().slice(0, 10);
      await pres.writeFile({ fileName: 'Rapport_Annuel_' + annee + '_DRT_Sfax_' + today + '.pptx' });
      setStatus('✅ Rapport PPTX généré (' + annee + ').');
    } catch (err) {
      console.error('[RapportAnnuel] Erreur génération PPTX:', err);
      alert('Erreur lors de la génération du rapport PPTX : ' + (err && err.message ? err.message : err));
      setStatus('❌ Échec de la génération.');
    } finally {
      btnState(btn, false);
    }
  };

  window.genererRapportAnnuelExcel = async function (evt) {
    var btn = evt && evt.target ? evt.target.closest('button') : null;
    try {
      if (typeof ExcelJS === 'undefined') { alert('Librairie ExcelJS non disponible — vérifiez votre connexion.'); return; }
      btnState(btn, true);
      setStatus('Agrégation des données…');
      var annee = currentAnnee();
      var AN = buildAnnualDataset(annee);
      setStatus('Génération du classeur Excel…');
      var wb = await buildRapportAnnuelExcel(ExcelJS, AN);
      var buf = await wb.xlsx.writeBuffer();
      var blob = new Blob([buf], { type: 'application/octet-stream' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var today = new Date().toISOString().slice(0, 10);
      a.href = url; a.download = 'Rapport_Annuel_' + annee + '_DRT_Sfax_' + today + '.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      setStatus('✅ Rapport Excel généré (' + annee + ').');
    } catch (err) {
      console.error('[RapportAnnuel] Erreur génération Excel:', err);
      alert('Erreur lors de la génération du rapport Excel : ' + (err && err.message ? err.message : err));
      setStatus('❌ Échec de la génération.');
    } finally {
      btnState(btn, false);
    }
  };

  /* ══════════════════════════════════════════════════════════
   *  INIT
   * ══════════════════════════════════════════════════════════ */
  function init() {
    injectNavAndTab();
    window.renderRapportAnnuelKpis();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // API publique
  window.__buildAnnualDataset = buildAnnualDataset;
  window.__buildRapportAnnuelPptx = buildRapportAnnuelPptx;
  window.__buildRapportAnnuelExcel = buildRapportAnnuelExcel;
  window.rapportAnnuel = {
    genPptx: window.genererRapportAnnuelPPTX,
    genExcel: window.genererRapportAnnuelExcel,
    dataset: buildAnnualDataset
  };

})();
