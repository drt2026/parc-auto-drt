/* ============================================================
   MOTEUR DE GENERATION — RAPPORT CARBURANT (PPTX)
   Fonctionne à l'identique en Node (tests) et dans le navigateur
   (admin.html), à condition de recevoir un constructeur PptxGenJS
   et les données déjà chargées de l'application (getFuelData()).
   ============================================================ */

const DRT_KIT = (typeof require !== 'undefined') ? require('./drt-premium-kit.js') : (typeof window !== 'undefined' ? window.DRT_KIT : null);

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTH_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

// Palette premium partagée (drt-premium-kit.js) — cohérente avec Réparations et Marchés
const COLORS = {
  navy:      '132C4C',
  midnight:  '0B1526',
  ink:       '1C2536',
  slate:     '5B6B82',
  mist:      'E4E9F0',
  paper:     'FFFFFF',
  bg:        'F7F9FC',
  teal:      '0E8FA0',
  tealSoft:  'D6F1F3',
  amber:     'C97A1A',
  amberSoft: 'FBEBD6',
  green:     '178A5F',
  greenSoft: 'DCF3E8',
  red:       'C13A3A',
  redSoft:   'FBE4E4',
};

/* ---------- Agrégations (reprennent la même logique que admin.html) ---------- */

function computeAnnualKPI(allData, year) {
  let totalLitres = 0, totalMontant = 0, totalKm = 0, pctSum = 0, pctCount = 0;
  const vehicles = new Set();
  let monthsWithData = 0;
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2,'0')}`;
    const entries = Object.values((allData && allData[key]) || {});
    if (entries.length) monthsWithData++;
    entries.forEach(e => {
      totalLitres += e.litres || 0;
      totalMontant += e.montant || 0;
      totalKm += e.km || 0;
      if (isFinite(e.pct) && e.pct) { pctSum += e.pct; pctCount++; }
      vehicles.add(e.matricule);
    });
  }
  return {
    totalLitres, totalMontant, totalKm,
    avgPct: pctCount ? pctSum / pctCount : 0,
    avgMonthlySpend: monthsWithData ? totalMontant / monthsWithData : 0,
    vehicleCount: vehicles.size,
    monthsWithData
  };
}

function computeMonthlyEvolution(allData, year) {
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2,'0')}`;
    const entries = Object.values((allData && allData[key]) || {});
    if (!entries.length) continue;
    const litres = entries.reduce((s,e)=>s+(e.litres||0),0);
    const montant = entries.reduce((s,e)=>s+(e.montant||0),0);
    const km = entries.reduce((s,e)=>s+(e.km||0),0);
    const pctVals = entries.filter(e=>isFinite(e.pct)&&e.pct);
    const pct = pctVals.length ? pctVals.reduce((s,e)=>s+e.pct,0)/pctVals.length : 0;
    out.push({ monthIndex: m-1, label: MONTH_SHORT[m-1], litres, montant, km, pct, nbVehicles: entries.length });
  }
  return out;
}

function computeAnnualByVehicle(allData, year) {
  const byVehicle = {};
  Object.keys(allData || {}).forEach(monthKey => {
    if (!monthKey.startsWith(String(year))) return;
    Object.values(allData[monthKey]).forEach(e => {
      if (!byVehicle[e.matricule]) {
        byVehicle[e.matricule] = { matricule: e.matricule, modele: e.modele, chauffeur: e.chauffeur,
          litres: 0, montant: 0, km: 0, pctSum: 0, pctCount: 0, months: 0, lastStatut: 'OK' };
      }
      const v = byVehicle[e.matricule];
      v.litres += e.litres || 0; v.montant += e.montant || 0; v.km += e.km || 0;
      if (isFinite(e.pct) && e.pct) { v.pctSum += e.pct; v.pctCount++; }
      v.months++;
      v.chauffeur = e.chauffeur || v.chauffeur;
      v.modele = e.modele || v.modele;
      v.lastStatut = e.statut || v.lastStatut;
    });
  });
  return Object.values(byVehicle)
    .map(v => ({ ...v, avgPct: v.pctCount ? v.pctSum / v.pctCount : 0 }))
    .sort((a,b) => b.montant - a.montant);
}

function computeByModel(byVehicleList) {
  const agg = {};
  byVehicleList.forEach(v => {
    const key = v.modele || 'Non renseigné';
    if (!agg[key]) agg[key] = { modele: key, litres: 0, montant: 0, count: 0 };
    agg[key].litres += v.litres; agg[key].montant += v.montant; agg[key].count++;
  });
  const list = Object.values(agg).sort((a,b) => b.montant - a.montant);
  const TOP = 6;
  if (list.length <= TOP) return list;
  const top = list.slice(0, TOP);
  const rest = list.slice(TOP);
  const autres = rest.reduce((acc, r) => {
    acc.montant += r.montant; acc.litres += r.litres; acc.count += r.count; return acc;
  }, { modele: 'Autres modèles', litres: 0, montant: 0, count: 0 });
  top.push(autres);
  return top;
}

function computeAlerts(allData, year, byVehicleList) {
  const immobilises = byVehicleList.filter(v => v.lastStatut && v.lastStatut !== 'OK');
  const surconso = byVehicleList.filter(v => v.avgPct > 9).sort((a,b) => b.avgPct - a.avgPct).slice(0, 5);
  return { immobilises, surconso };
}

function fmt(n, dec) { return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: dec||0, maximumFractionDigits: dec||0 }); }

/* ---------- Construction du PPTX ---------- */

function buildFuelReportPptx(PptxGenJSCtor, allData, year, meta) {
  meta = meta || {};
  const pres = new PptxGenJSCtor();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = 'Parc Auto DRT Sfax';
  pres.title = `Rapport Carburant ${year} — DRT Sfax`;

  const kpi = computeAnnualKPI(allData, year);
  const evolution = computeMonthlyEvolution(allData, year);
  const byVehicle = computeAnnualByVehicle(allData, year);
  const byModel = computeByModel(byVehicle);
  const top10 = byVehicle.slice(0, 10);
  const alerts = computeAlerts(allData, year, byVehicle);
  const periodLabel = evolution.length
    ? (evolution.length === 1 ? evolution[0].label : `${evolution[0].label} – ${evolution[evolution.length-1].label}`)
    : '—';

  const W = 13.33, H = 7.5;

  /* ============ SLIDE 1 — TITRE ============ */
  {
    DRT_KIT.titleSlide({
      pres, icon: '⛽', kicker: 'Suivi carburant — DRT Sfax', title: 'Rapport Carburant',
      subtitle: `Période ${periodLabel} ${year}`,
      accentColor: COLORS.teal, accentSoftColor: COLORS.tealSoft,
      chips: [
        [`${kpi.vehicleCount}`, 'véhicules suivis'],
        [`${fmt(kpi.totalMontant)} DT`, 'dépense totale'],
        [`${kpi.monthsWithData} mois`, 'de données'],
      ],
      signature: `Généré le ${meta.generatedOn || new Date().toLocaleDateString('fr-FR')} — Direction Régionale de Sfax`,
    });
  }

  /* ============ SLIDE 2 — BILAN / KPI ============ */
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.bg };
    s.addText('Bilan de la période', { x: 0.6, y: 0.4, w: 8, h: 0.6, fontSize: 28, bold: true, color: COLORS.ink, fontFace: 'Cambria' });
    s.addText(`${kpi.vehicleCount} véhicules · ${periodLabel} ${year}`, { x: 0.6, y: 0.95, w: 8, h: 0.4, fontSize: 13, color: COLORS.slate, fontFace: 'Calibri' });

    const cards = [
      { icon: '⛽', big: `${fmt(kpi.totalLitres)} L`, label: 'Litres ravitaillés', color: COLORS.teal, soft: COLORS.tealSoft },
      { icon: '💰', big: `${fmt(kpi.totalMontant)} DT`, label: 'Dépense totale', color: COLORS.green, soft: COLORS.greenSoft },
      { icon: '🛣️', big: `${fmt(kpi.totalKm)} km`, label: 'Km parcourus', color: COLORS.navy, soft: COLORS.mist },
      { icon: '📊', big: `${kpi.avgPct.toFixed(1)} %`, label: 'Consommation moyenne', color: COLORS.amber, soft: COLORS.amberSoft },
      { icon: '📅', big: `${fmt(kpi.avgMonthlySpend)} DT`, label: 'Dépense moyenne / mois', color: COLORS.navy, soft: COLORS.mist },
      { icon: '🚗', big: `${kpi.vehicleCount}`, label: 'Véhicules actifs', color: COLORS.teal, soft: COLORS.tealSoft },
    ];
    const gx = 0.6, gy = 1.6, gw = (W - 1.2 - 2*0.35) / 3, gh = 1.7, gapX = 0.35, gapY = 0.35;
    cards.forEach((c, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = gx + col*(gw+gapX), y = gy + row*(gh+gapY);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: gw, h: gh, rectRadius: 0.08,
        fill: { color: COLORS.paper },
        shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 90, opacity: 0.08 } });
      s.addShape(pres.shapes.OVAL, { x: x+0.25, y: y+0.25, w: 0.55, h: 0.55, fill: { color: c.soft }, line: { type: 'none' } });
      s.addText(c.icon, { x: x+0.25, y: y+0.25, w: 0.55, h: 0.55, fontSize: 20, align: 'center', valign: 'middle', margin: 0 });
      s.addText(c.big, { x: x+0.25, y: y+0.9, w: gw-0.5, h: 0.5, fontSize: 21, bold: true, color: c.color, fontFace: 'Cambria', margin: 0 });
      s.addText(c.label, { x: x+0.25, y: y+1.35, w: gw-0.5, h: 0.3, fontSize: 11, color: COLORS.slate, fontFace: 'Calibri', margin: 0 });
    });
    DRT_KIT.footer(pres, s, { wordmark: 'DRT SFAX · CARBURANT', accentColor: COLORS.teal, dark: false });
  }

  /* ============ SLIDE 3 — EVOLUTION MENSUELLE ============ */
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.paper };
    s.addText('Évolution mensuelle', { x: 0.6, y: 0.4, w: 8, h: 0.6, fontSize: 28, bold: true, color: COLORS.ink, fontFace: 'Cambria' });
    s.addText('Dépense carburant (DT) et taux de consommation moyen (%)', { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: COLORS.slate, fontFace: 'Calibri' });

    if (evolution.length) {
      const labels = evolution.map(e => e.label);
      const montants = evolution.map(e => Math.round(e.montant));
      const pcts = evolution.map(e => Number(e.pct.toFixed(1)));

      s.addChart([
        { type: pres.charts.BAR, data: [{ name: 'Dépense (DT)', labels, values: montants }],
          options: { barDir: 'col', chartColors: [COLORS.navy] } },
        { type: pres.charts.LINE, data: [{ name: '% Consommation', labels, values: pcts }],
          options: { secondaryValAxis: true, secondaryCatAxis: true, chartColors: [COLORS.amber], lineSize: 3, lineSmooth: true, lineDataSymbol: 'circle', lineDataSymbolSize: 7 } }
      ], {
        x: 0.6, y: 1.55, w: 12.1, h: 4.5,
        chartArea: { fill: { color: COLORS.paper } },
        catAxisLabelColor: COLORS.slate, valAxisLabelColor: COLORS.slate,
        valAxisTitle: 'DT', showValAxisTitle: true, valAxisTitleColor: COLORS.slate, valAxisTitleFontSize: 10,
        sizeToFit: false,
        valGridLine: { color: COLORS.mist, size: 0.75 },
        catGridLine: { style: 'none' },
        showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: COLORS.ink, dataLabelFontSize: 9,
        showLegend: true, legendPos: 'b', legendColor: COLORS.slate, legendFontSize: 11,
      });
    } else {
      s.addText('Aucune donnée mensuelle disponible pour cette année.', { x: 0.6, y: 3, w: 10, h: 0.6, fontSize: 16, color: COLORS.slate });
    }

    s.addText(`Total période : ${fmt(kpi.totalMontant)} DT · ${fmt(kpi.totalLitres)} L`, { x: 0.6, y: 6.85, w: 8, h: 0.35, fontSize: 11, color: COLORS.slate, fontFace: 'Calibri' });
    DRT_KIT.footer(pres, s, { wordmark: 'DRT SFAX · CARBURANT', accentColor: COLORS.teal, dark: false });
  }

  /* ============ SLIDE 4 — TOP 10 CONSOMMATEURS ============ */
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.bg };
    s.addText('Top 10 des consommateurs', { x: 0.6, y: 0.4, w: 8, h: 0.6, fontSize: 28, bold: true, color: COLORS.ink, fontFace: 'Cambria' });
    s.addText('Classement par dépense carburant décroissante', { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: COLORS.slate, fontFace: 'Calibri' });

    if (top10.length) {
      const chartLabels = top10.map(v => v.matricule).reverse();
      const chartValues = top10.map(v => Math.round(v.montant)).reverse();
      s.addChart(pres.charts.BAR, [{ name: 'Dépense (DT)', labels: chartLabels, values: chartValues }], {
        x: 0.55, y: 1.55, w: 6.5, h: 5.3, barDir: 'bar',
        chartColors: [COLORS.teal],
        chartArea: { fill: { color: COLORS.bg } },
        catAxisLabelColor: COLORS.slate, valAxisLabelColor: COLORS.slate, catAxisLabelFontSize: 10,
        valGridLine: { color: COLORS.mist, size: 0.75 }, catGridLine: { style: 'none' },
        showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: COLORS.ink, dataLabelFontSize: 9,
        showLegend: false,
      });

      const rows = [
        [
          { text: '#', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10 } },
          { text: 'Matricule', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10 } },
          { text: 'Chauffeur', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10 } },
          { text: 'Montant', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10, align: 'right' } },
        ]
      ];
      top10.forEach((v, i) => {
        const fill = i % 2 === 0 ? COLORS.paper : COLORS.bg;
        rows.push([
          { text: String(i+1), options: { fill: { color: fill }, fontSize: 10, color: COLORS.slate } },
          { text: v.matricule, options: { fill: { color: fill }, fontSize: 10, bold: true, color: COLORS.ink } },
          { text: v.chauffeur || '—', options: { fill: { color: fill }, fontSize: 9.5, color: COLORS.ink } },
          { text: `${fmt(v.montant)} DT`, options: { fill: { color: fill }, fontSize: 10, color: COLORS.navy, bold: true, align: 'right' } },
        ]);
      });
      s.addTable(rows, { x: 7.3, y: 1.55, w: 5.45, colW: [0.45, 1.5, 2.4, 1.1],
        border: { pt: 0.5, color: COLORS.mist }, autoPage: false, valign: 'middle',
        rowH: 0.44 });
    } else {
      s.addText('Aucune donnée véhicule disponible.', { x: 0.6, y: 3, w: 10, h: 0.6, fontSize: 16, color: COLORS.slate });
    }
    DRT_KIT.footer(pres, s, { wordmark: 'DRT SFAX · CARBURANT', accentColor: COLORS.teal, dark: false });
  }

  /* ============ SLIDE 5 — REPARTITION PAR MODELE ============ */
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.paper };
    s.addText('Répartition par modèle de véhicule', { x: 0.6, y: 0.4, w: 10, h: 0.6, fontSize: 28, bold: true, color: COLORS.ink, fontFace: 'Cambria' });
    s.addText('Part de la dépense carburant totale', { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: COLORS.slate, fontFace: 'Calibri' });

    if (byModel.length) {
      const palette = [COLORS.navy, COLORS.teal, COLORS.amber, COLORS.green, '7C93B8', '94D2DB', COLORS.slate];
      s.addChart(pres.charts.DOUGHNUT, [{
        name: 'Dépense', labels: byModel.map(m => m.modele), values: byModel.map(m => Math.round(m.montant))
      }], {
        x: 0.5, y: 1.5, w: 6.2, h: 5.3,
        chartColors: palette,
        showLegend: true, legendPos: 'r', legendColor: COLORS.slate, legendFontSize: 11,
        showPercent: true, dataLabelColor: COLORS.paper, dataLabelFontSize: 10, dataLabelPosition: 'ctr',
        chartArea: { fill: { color: COLORS.paper } },
      });

      const rows = [[
        { text: 'Modèle', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10 } },
        { text: 'Véh.', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10, align: 'center' } },
        { text: 'Litres', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10, align: 'right' } },
        { text: 'Montant', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10, align: 'right' } },
      ]];
      byModel.forEach((m, i) => {
        const fill = i % 2 === 0 ? COLORS.paper : COLORS.bg;
        rows.push([
          { text: m.modele, options: { fill: { color: fill }, fontSize: 9.5, color: COLORS.ink } },
          { text: String(m.count), options: { fill: { color: fill }, fontSize: 9.5, color: COLORS.slate, align: 'center' } },
          { text: fmt(m.litres), options: { fill: { color: fill }, fontSize: 9.5, color: COLORS.slate, align: 'right' } },
          { text: `${fmt(m.montant)} DT`, options: { fill: { color: fill }, fontSize: 9.5, color: COLORS.navy, bold: true, align: 'right' } },
        ]);
      });
      s.addTable(rows, { x: 6.95, y: 1.55, w: 5.8, colW: [2.6, 0.7, 1.2, 1.3],
        border: { pt: 0.5, color: COLORS.mist }, valign: 'middle', rowH: 0.6 });
    } else {
      s.addText('Aucune donnée disponible.', { x: 0.6, y: 3, w: 10, h: 0.6, fontSize: 16, color: COLORS.slate });
    }
    DRT_KIT.footer(pres, s, { wordmark: 'DRT SFAX · CARBURANT', accentColor: COLORS.teal, dark: false });
  }

  /* ============ SLIDE 6 — POINTS D'ATTENTION ============ */
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.midnight };
    s.addText('Points d\u2019attention', { x: 0.6, y: 0.5, w: 8, h: 0.6, fontSize: 28, bold: true, color: COLORS.paper, fontFace: 'Cambria' });
    s.addText('Véhicules à surveiller sur la période', { x: 0.6, y: 1.05, w: 9, h: 0.4, fontSize: 13, color: '94A3B8', fontFace: 'Calibri' });

    // Colonne gauche : surconsommation
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 1.7, w: 5.9, h: 5.1, rectRadius: 0.08, fill: { color: '16213E' }, line: { type: 'none' } });
    s.addText('⚠️  Surconsommation (> 9%)', { x: 0.9, y: 1.95, w: 5.3, h: 0.4, fontSize: 15, bold: true, color: COLORS.amber, fontFace: 'Calibri' });
    if (alerts.surconso.length) {
      const txt = alerts.surconso.map(v => ({
        text: `${v.matricule}  —  ${v.modele || ''}  (${v.avgPct.toFixed(1)}%)`,
        options: { bullet: { code: '25CF' }, color: 'E2E8F0', fontSize: 13, breakLine: true, paraSpaceAfter: 8 }
      }));
      txt[txt.length-1].options.breakLine = false;
      s.addText(txt, { x: 0.95, y: 2.5, w: 5.3, h: 4, fontFace: 'Calibri' });
    } else {
      s.addText('Aucun véhicule en surconsommation notable.', { x: 0.95, y: 2.5, w: 5.3, h: 0.6, fontSize: 13, color: '94A3B8', fontFace: 'Calibri' });
    }

    // Colonne droite : immobilisés
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.8, y: 1.7, w: 5.9, h: 5.1, rectRadius: 0.08, fill: { color: '16213E' }, line: { type: 'none' } });
    s.addText('🚫  Immobilisés / en panne', { x: 7.1, y: 1.95, w: 5.3, h: 0.4, fontSize: 15, bold: true, color: COLORS.red, fontFace: 'Calibri' });
    if (alerts.immobilises.length) {
      const txt2 = alerts.immobilises.slice(0, 10).map(v => ({
        text: `${v.matricule}  —  ${v.modele || ''}  (${v.lastStatut})`,
        options: { bullet: { code: '25CF' }, color: 'E2E8F0', fontSize: 13, breakLine: true, paraSpaceAfter: 8 }
      }));
      txt2[txt2.length-1].options.breakLine = false;
      s.addText(txt2, { x: 7.15, y: 2.5, w: 5.3, h: 4, fontFace: 'Calibri' });
    } else {
      s.addText('Aucun véhicule immobilisé signalé.', { x: 7.15, y: 2.5, w: 5.3, h: 0.6, fontSize: 13, color: '94A3B8', fontFace: 'Calibri' });
    }
    DRT_KIT.footer(pres, s, { wordmark: 'DRT SFAX · CARBURANT', accentColor: COLORS.teal, dark: true });
  }

  return pres;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildFuelReportPptx, computeAnnualKPI, computeMonthlyEvolution,
    computeAnnualByVehicle, computeByModel, computeAlerts, COLORS
  };
}

/* ============================================================
   INTEGRATION NAVIGATEUR — bouton "Générer Rapport" (Carburant)
   Purement additif : n'altère aucune fonction existante.
   ============================================================ */
if (typeof window !== 'undefined') {
  window.__buildFuelReportPptx = buildFuelReportPptx;

  const PPTXGENJS_CDN = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgenjs.bundle.js';

  function _loadPptxGenJs() {
    if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
    if (window.__pptxgenjsLoading) return window.__pptxgenjsLoading;
    window.__pptxgenjsLoading = new Promise(function(resolve, reject) {
      const script = document.createElement('script');
      script.src = PPTXGENJS_CDN;
      script.onload = function() { resolve(window.PptxGenJS); };
      script.onerror = function() { reject(new Error('Impossible de charger la librairie PptxGenJS.')); };
      document.head.appendChild(script);
    });
    return window.__pptxgenjsLoading;
  }

  function _currentFuelYear() {
    const sel = document.getElementById('fuel-year-select');
    return (sel && sel.value) ? sel.value : String(new Date().getFullYear());
  }

  function _fuelBtnState(btn, loading) {
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

  window.genererRapportCarburantPPTX = async function genererRapportCarburantPPTX(evt) {
    const btn = evt && evt.target ? evt.target.closest('button') : null;
    try {
      _fuelBtnState(btn, true);
      const PptxCtor = await _loadPptxGenJs();

      const allData = (typeof getFuelData === 'function') ? getFuelData() : {};
      const year = _currentFuelYear();

      const hasData = Object.keys(allData).some(function(k) {
        return k.indexOf(String(year)) === 0 && Object.keys(allData[k]).length;
      });
      if (!hasData) {
        alert('Aucune donnée carburant importée pour l\'année ' + year + '. Importez au moins un mois avant de générer le rapport.');
        return;
      }

      const pres = buildFuelReportPptx(PptxCtor, allData, year, {
        generatedOn: new Date().toLocaleDateString('fr-FR')
      });

      const today = new Date().toISOString().slice(0, 10);
      await pres.writeFile({ fileName: 'Rapport_Carburant_' + year + '_DRT_Sfax_' + today + '.pptx' });
    } catch (err) {
      console.error('[FuelRapport] Erreur génération PPTX:', err);
      alert('Erreur lors de la génération du rapport : ' + (err && err.message ? err.message : err));
    } finally {
      _fuelBtnState(btn, false);
    }
  };
}
