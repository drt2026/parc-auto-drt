/* ============================================================
   MOTEUR DE GENERATION — RAPPORT CARBURANT (PPTX)
   Fonctionne à l'identique en Node (tests) et dans le navigateur
   (admin.html), à condition de recevoir un constructeur PptxGenJS
   et les données déjà chargées de l'application (getFuelData()).
   ============================================================ */

/* BLOC ADDITIF : encapsulation IIFE — corrige une collision de portée
   ("const COLORS" était déclaré au top-level du script à la fois ici et
   dans marches_rapport.js ; en JS classique, les `const` de premier niveau
   partagent la même portée entre tous les <script src> d'une page, donc le
   second fichier chargé levait une SyntaxError et cassait tout son contenu,
   y compris le bouton "Générer Rapport" de Suivi des Marchés).
   Fonctionne à l'identique en Node (module.exports) et navigateur. */
(function () {
'use strict';

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTH_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

// Palette alignée sur l'identité visuelle de l'admin (var(--primary):#1e3a5f)
const COLORS = {
  navy:      '1E3A5F',
  midnight:  '0F172A',
  ink:       '1E293B',
  slate:     '64748B',
  mist:      'E2E8F0',
  paper:     'FFFFFF',
  bg:        'F8FAFC',
  teal:      '0EA5B7',
  tealSoft:  'CFF3F6',
  amber:     'F59E0B',
  amberSoft: 'FEF3C7',
  green:     '10B981',
  greenSoft: 'D1FAE5',
  red:       'EF4444',
  redSoft:   'FEE2E2',
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
    const s = pres.addSlide();
    s.background = { color: COLORS.midnight };

    s.addShape(pres.shapes.OVAL, { x: 9.6, y: -2.2, w: 6, h: 6, fill: { color: COLORS.navy }, line: { type: 'none' } });
    s.addShape(pres.shapes.OVAL, { x: 10.6, y: 4.6, w: 4.2, h: 4.2, fill: { color: COLORS.teal, transparency: 82 }, line: { type: 'none' } });

    s.addText('⛽', { x: 0.7, y: 0.75, w: 1.2, h: 1.2, fontSize: 44, align: 'left', valign: 'middle' });
    s.addText('SUIVI CARBURANT — DRT SFAX', { x: 0.7, y: 1.75, w: 9, h: 0.5,
      fontSize: 14, color: COLORS.teal, bold: true, charSpacing: 3, fontFace: 'Calibri' });
    s.addText('Rapport Carburant', { x: 0.65, y: 2.25, w: 11, h: 1.3,
      fontSize: 48, color: COLORS.paper, bold: true, fontFace: 'Cambria' });
    s.addText(`Période S1 ${year} · ${periodLabel} ${year}`, { x: 0.7, y: 3.45, w: 9, h: 0.55,
      fontSize: 20, color: 'CBD5E1', fontFace: 'Calibri' });

    s.addShape(pres.shapes.LINE, { x: 0.7, y: 4.25, w: 3.2, h: 0, line: { color: COLORS.teal, width: 2 } });

    const chips = [
      [`${kpi.vehicleCount}`, 'véhicules suivis'],
      [`${fmt(kpi.totalMontant)} DT`, 'dépense totale'],
      [`${kpi.monthsWithData} mois`, 'de données'],
    ];
    let cx = 0.7;
    chips.forEach(([big, small]) => {
      s.addText([
        { text: big + '  ', options: { fontSize: 20, bold: true, color: COLORS.paper, breakLine: false } },
        { text: small, options: { fontSize: 12, color: '94A3B8' } }
      ], { x: cx, y: 4.6, w: 3.3, h: 0.5, fontFace: 'Calibri' });
      cx += 3.3;
    });

    s.addText(`Généré le ${meta.generatedOn || new Date().toLocaleDateString('fr-FR')} — Direction Régionale de Sfax`,
      { x: 0.7, y: 6.9, w: 8, h: 0.35, fontSize: 10.5, color: '64748B', fontFace: 'Calibri' });
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

  const PPTXGENJS_CDN_URLS = [
    'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
    'https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
    'https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
  ];

  function _loadScriptOnce(src) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = src;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('404/erreur réseau : ' + src)); };
      document.head.appendChild(script);
    });
  }

  function _loadPptxGenJs() {
    if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
    if (window.__pptxgenjsLoading) return window.__pptxgenjsLoading;
    window.__pptxgenjsLoading = (async function () {
      let lastErr = null;
      for (const url of PPTXGENJS_CDN_URLS) {
        try {
          await _loadScriptOnce(url);
          if (window.PptxGenJS) return window.PptxGenJS;
        } catch (e) { lastErr = e; }
      }
      window.__pptxgenjsLoading = null;
      throw new Error('Impossible de charger la librairie PptxGenJS (tous les miroirs CDN ont échoué). Vérifiez votre connexion internet. ' + (lastErr ? lastErr.message : ''));
    })();
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

/* ============================================================
   BLOC ADDITIF — RAPPORT CARBURANT EXCEL AVEC COULEUR (SheetJS)
   Même convention visuelle que repair_rapport.js (palette CLR,
   cellules stylées, feuilles graphiques en barres).
   Purement additif : n'altère aucune fonction existante.
   ============================================================ */
const XLCLR = {
  navyFg: 'FFFFFFFF', navyBg: 'FF1E3A5F',
  orangeBg: 'FF0EA5B7', orangeFg: 'FFFFFFFF',
  greyBg: 'FFF1F5F9', greyFg: 'FF1E293B',
  whiteBg: 'FFFFFFFF',
  greenBg: 'FFD1FAE5', greenFg: 'FF065F46',
  redBg: 'FFFEE2E2', redFg: 'FF991B1B',
  borderClr: 'FFE2E8F0', alertBg: 'FFFFF3CD',
};

function xlCellRef(r, c) { return String.fromCharCode(65 + c) + (r + 1); }
function xlWriteCell(ws, r, c, value, style) {
  const addr = xlCellRef(r, c);
  const t = typeof value === 'number' ? 'n' : 's';
  ws[addr] = { t, v: value };
  if (style) ws[addr].s = style;
  return addr;
}
function xlSetColWidths(ws, widths) { ws['!cols'] = widths.map(w => ({ wch: w })); }
function xlAddMerge(ws, r1, c1, r2, c2) {
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
}
function xlThinBorder() {
  const b = { style: 'thin', color: { rgb: XLCLR.borderClr } };
  return { top: b, bottom: b, left: b, right: b };
}
function xlHdr(bgKey, fgKey, bold) {
  return {
    fill: { fgColor: { rgb: XLCLR[bgKey] } },
    font: { bold: bold !== false, color: { rgb: XLCLR[fgKey] }, sz: 11 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: xlThinBorder()
  };
}
function xlDataCell(num, bold, bgKey) {
  return {
    fill: { fgColor: { rgb: XLCLR[bgKey || 'whiteBg'] } },
    font: { bold: !!bold, color: { rgb: XLCLR.greyFg }, sz: 10 },
    alignment: { horizontal: num ? 'right' : 'left', vertical: 'center' },
    border: xlThinBorder(),
    numFmt: num ? '#,##0.00' : '@'
  };
}
function xlTotalRow() {
  return {
    fill: { fgColor: { rgb: XLCLR.orangeBg } },
    font: { bold: true, color: { rgb: XLCLR.orangeFg }, sz: 11 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: xlThinBorder(), numFmt: '#,##0.00'
  };
}
const XL_BAR_CHAR = '█', XL_BAR_MAXLEN = 30;
function xlBarString(value, max) {
  if (max <= 0) return '';
  const len = Math.max(1, Math.round((value / max) * XL_BAR_MAXLEN));
  return XL_BAR_CHAR.repeat(len);
}
function xlBarColorByRank(idx) {
  const palette = ['FF0EA5B7', 'FF14B8C4', 'FF1E3A5F', 'FF334155', 'FF475569', 'FF64748B', 'FF94A3B8'];
  return palette[Math.min(idx, palette.length - 1)];
}
function xlBuildBarChartSheet(wb, sheetName, titre, labels, values, unitLabel) {
  const ws = {};
  xlSetColWidths(ws, [28, 14, XL_BAR_MAXLEN + 4]);
  xlAddMerge(ws, 0, 0, 0, 2);
  xlWriteCell(ws, 0, 0, titre, xlHdr('navyBg', 'navyFg'));
  ['Libellé', `Valeur (${unitLabel})`, 'Graphique'].forEach((c, i) => xlWriteCell(ws, 2, i, c, xlHdr('orangeBg', 'orangeFg')));
  const max = Math.max.apply(null, values.concat([1]));
  labels.forEach((lbl, idx) => {
    const r = 3 + idx;
    const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
    xlWriteCell(ws, r, 0, lbl, xlDataCell(false, true, bg));
    xlWriteCell(ws, r, 1, +values[idx].toFixed(2), xlDataCell(true, false, bg));
    xlWriteCell(ws, r, 2, xlBarString(values[idx], max), {
      fill: { fgColor: { rgb: XLCLR[bg] } },
      font: { color: { rgb: xlBarColorByRank(idx) }, sz: 13, name: 'Consolas' },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: xlThinBorder()
    });
  });
  ws['!ref'] = `A1:C${3 + labels.length + 1}`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

function buildFuelCoverSheetXL(wb, year) {
  const ws = {};
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  xlSetColWidths(ws, [5, 20, 20, 20, 20, 20, 5]);
  xlAddMerge(ws, 2, 1, 3, 5);
  xlWriteCell(ws, 2, 1, 'TUNISIE TELECOM', { fill: { fgColor: { rgb: XLCLR.navyBg } }, font: { bold: true, color: { rgb: XLCLR.navyFg }, sz: 20 }, alignment: { horizontal: 'center', vertical: 'center' } });
  xlAddMerge(ws, 5, 1, 6, 5);
  xlWriteCell(ws, 5, 1, `RAPPORT ANNUEL CARBURANT — ${year}`, { fill: { fgColor: { rgb: XLCLR.orangeBg } }, font: { bold: true, color: { rgb: XLCLR.orangeFg }, sz: 16 }, alignment: { horizontal: 'center', vertical: 'center' } });
  xlAddMerge(ws, 8, 1, 9, 5);
  xlWriteCell(ws, 8, 1, 'Suivi Consommation — Parc Automobile DRT Sfax', { fill: { fgColor: { rgb: XLCLR.greyBg } }, font: { bold: true, color: { rgb: XLCLR.greyFg }, sz: 13 }, alignment: { horizontal: 'center', vertical: 'center' } });
  const rows = [
    ['Direction Régionale', 'DRT Sfax'],
    ['Responsable Parc', 'Hamdi Ben Aouicha'],
    ["Année d'exercice", String(year)],
    ["Date d'édition", dateStr],
  ];
  rows.forEach(([lbl, val], i) => {
    const r = 12 + i * 2;
    xlAddMerge(ws, r, 1, r, 3);
    xlWriteCell(ws, r, 1, lbl, xlHdr('navyBg', 'navyFg'));
    xlAddMerge(ws, r, 4, r, 5);
    xlWriteCell(ws, r, 4, val, { ...xlDataCell(false, true, 'greyBg'), alignment: { horizontal: 'left', vertical: 'center' } });
  });
  ws['!ref'] = `A1:G${12 + rows.length * 2 + 4}`;
  XLSX.utils.book_append_sheet(wb, ws, 'Page de garde');
}

function buildFuelSynthSheetXL(wb, kpi, evolution, year) {
  const ws = {};
  xlSetColWidths(ws, [24, 18, 5, 5, 5, 5, 5, 5, 5, 5]);
  xlAddMerge(ws, 0, 0, 0, 5);
  xlWriteCell(ws, 0, 0, `SYNTHÈSE GLOBALE — CARBURANT ${year}`, xlHdr('navyBg', 'navyFg'));
  const kpis = [
    ['Dépense totale', fmt(kpi.totalMontant) + ' DT'],
    ['Litres consommés', fmt(kpi.totalLitres) + ' L'],
    ['Kilométrage total', fmt(kpi.totalKm) + ' km'],
    ['Véhicules suivis', kpi.vehicleCount],
    ['Mois avec données', kpi.monthsWithData],
    ['Dépense moyenne / mois', fmt(kpi.avgMonthlySpend) + ' DT'],
    ["Taux moyen d'écart (%)", kpi.avgPct.toFixed(1) + ' %'],
  ];
  kpis.forEach(([lbl, val], i) => {
    const r = 2 + i;
    xlWriteCell(ws, r, 0, lbl, xlHdr('greyBg', 'greyFg'));
    xlAddMerge(ws, r, 1, r, 3);
    xlWriteCell(ws, r, 1, val, { ...xlDataCell(false, true), alignment: { horizontal: 'left', vertical: 'center' } });
  });
  ws['!ref'] = `A1:J${2 + kpis.length + 2}`;
  XLSX.utils.book_append_sheet(wb, ws, 'Synthèse');

  if (evolution.length) {
    xlBuildBarChartSheet(wb, 'Graph. Évolution', `ÉVOLUTION MENSUELLE — DÉPENSE ${year} (DT)`,
      evolution.map(e => e.label), evolution.map(e => e.montant), 'DT');
  }
}

function buildFuelEvolutionSheetXL(wb, evolution, year) {
  const ws = {};
  xlSetColWidths(ws, [12, 14, 16, 14, 12, 14]);
  xlAddMerge(ws, 0, 0, 0, 5);
  xlWriteCell(ws, 0, 0, `ÉVOLUTION MENSUELLE — ${year}`, xlHdr('navyBg', 'navyFg'));
  ['Mois', 'Litres', 'Montant (DT)', 'KM parcourus', 'Écart moyen (%)', 'Nb véhicules'].forEach((c, i) => xlWriteCell(ws, 2, i, c, xlHdr('orangeBg', 'orangeFg')));
  evolution.forEach((e, idx) => {
    const r = 3 + idx;
    const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
    xlWriteCell(ws, r, 0, e.label, xlDataCell(false, true, bg));
    xlWriteCell(ws, r, 1, +e.litres.toFixed(2), xlDataCell(true, false, bg));
    xlWriteCell(ws, r, 2, +e.montant.toFixed(2), xlDataCell(true, false, bg));
    xlWriteCell(ws, r, 3, +e.km.toFixed(0), { ...xlDataCell(true, false, bg), numFmt: '#,##0' });
    xlWriteCell(ws, r, 4, +e.pct.toFixed(1), { ...xlDataCell(true, false, bg), numFmt: '0.0"%"' });
    xlWriteCell(ws, r, 5, e.nbVehicles, { ...xlDataCell(true, false, bg), numFmt: '#,##0' });
  });
  const tr = 3 + evolution.length;
  const ts = xlTotalRow();
  xlWriteCell(ws, tr, 0, 'TOTAL', ts);
  xlWriteCell(ws, tr, 1, +evolution.reduce((s, e) => s + e.litres, 0).toFixed(2), ts);
  xlWriteCell(ws, tr, 2, +evolution.reduce((s, e) => s + e.montant, 0).toFixed(2), ts);
  xlWriteCell(ws, tr, 3, +evolution.reduce((s, e) => s + e.km, 0).toFixed(0), { ...ts, numFmt: '#,##0' });
  xlWriteCell(ws, tr, 4, '', ts);
  xlWriteCell(ws, tr, 5, '', ts);
  ws['!ref'] = `A1:F${tr + 2}`;
  XLSX.utils.book_append_sheet(wb, ws, 'Évolution mensuelle');
}

function buildFuelVehicleSheetXL(wb, byVehicle, year) {
  const ws = {};
  xlSetColWidths(ws, [5, 14, 22, 12, 14, 12, 14]);
  xlAddMerge(ws, 0, 0, 0, 6);
  xlWriteCell(ws, 0, 0, `DÉPENSE PAR VÉHICULE — ${year}`, xlHdr('navyBg', 'navyFg'));
  ['#', 'Matricule', 'Chauffeur', 'Litres', 'Montant (DT)', 'Écart moy. (%)', 'Statut'].forEach((c, i) => xlWriteCell(ws, 2, i, c, xlHdr('orangeBg', 'orangeFg')));
  byVehicle.forEach((v, idx) => {
    const r = 3 + idx;
    const bg = idx < 3 ? 'alertBg' : (idx % 2 === 0 ? 'whiteBg' : 'greyBg');
    xlWriteCell(ws, r, 0, idx + 1, { ...xlDataCell(true, true, bg), alignment: { horizontal: 'center' } });
    xlWriteCell(ws, r, 1, v.matricule, xlDataCell(false, true, bg));
    xlWriteCell(ws, r, 2, v.chauffeur || '—', xlDataCell(false, false, bg));
    xlWriteCell(ws, r, 3, +v.litres.toFixed(2), xlDataCell(true, false, bg));
    xlWriteCell(ws, r, 4, +v.montant.toFixed(2), xlDataCell(true, false, bg));
    xlWriteCell(ws, r, 5, +v.avgPct.toFixed(1), { ...xlDataCell(true, false, bg), numFmt: '0.0"%"' });
    const statutStyle = v.lastStatut && v.lastStatut !== 'OK'
      ? { fill: { fgColor: { rgb: XLCLR.redBg } }, font: { bold: true, color: { rgb: XLCLR.redFg }, sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: xlThinBorder() }
      : { fill: { fgColor: { rgb: XLCLR.greenBg } }, font: { bold: true, color: { rgb: XLCLR.greenFg }, sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: xlThinBorder() };
    xlWriteCell(ws, r, 6, v.lastStatut || 'OK', statutStyle);
  });
  const tr = 3 + byVehicle.length;
  const ts = xlTotalRow();
  xlWriteCell(ws, tr, 0, '', ts);
  xlWriteCell(ws, tr, 1, 'TOTAL', ts);
  xlWriteCell(ws, tr, 2, `${byVehicle.length} véhicules`, ts);
  xlWriteCell(ws, tr, 3, +byVehicle.reduce((s, v) => s + v.litres, 0).toFixed(2), ts);
  xlWriteCell(ws, tr, 4, +byVehicle.reduce((s, v) => s + v.montant, 0).toFixed(2), ts);
  xlWriteCell(ws, tr, 5, '', ts);
  xlWriteCell(ws, tr, 6, '', ts);
  ws['!ref'] = `A1:G${tr + 2}`;
  XLSX.utils.book_append_sheet(wb, ws, 'Par véhicule');

  const top10 = byVehicle.slice(0, 10);
  if (top10.length) {
    xlBuildBarChartSheet(wb, 'Graph. Top10 véh.', `TOP 10 VÉHICULES — DÉPENSE ${year} (DT)`,
      top10.map(v => v.matricule), top10.map(v => v.montant), 'DT');
  }
}

function buildFuelModelSheetXL(wb, byModel, year) {
  const ws = {};
  xlSetColWidths(ws, [22, 12, 14, 16]);
  xlAddMerge(ws, 0, 0, 0, 3);
  xlWriteCell(ws, 0, 0, `RÉPARTITION PAR MODÈLE — ${year}`, xlHdr('navyBg', 'navyFg'));
  ['Modèle', 'Véh.', 'Litres', 'Montant (DT)'].forEach((c, i) => xlWriteCell(ws, 2, i, c, xlHdr('orangeBg', 'orangeFg')));
  byModel.forEach((m, idx) => {
    const r = 3 + idx;
    const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
    xlWriteCell(ws, r, 0, m.modele, xlDataCell(false, true, bg));
    xlWriteCell(ws, r, 1, m.count, { ...xlDataCell(false, false, bg), numFmt: '#,##0' });
    xlWriteCell(ws, r, 2, +m.litres.toFixed(2), xlDataCell(true, false, bg));
    xlWriteCell(ws, r, 3, +m.montant.toFixed(2), xlDataCell(true, false, bg));
  });
  const tr = 3 + byModel.length;
  const ts = xlTotalRow();
  xlWriteCell(ws, tr, 0, 'TOTAL', ts);
  xlWriteCell(ws, tr, 1, byModel.reduce((s, m) => s + m.count, 0), { ...ts, numFmt: '#,##0' });
  xlWriteCell(ws, tr, 2, +byModel.reduce((s, m) => s + m.litres, 0).toFixed(2), ts);
  xlWriteCell(ws, tr, 3, +byModel.reduce((s, m) => s + m.montant, 0).toFixed(2), ts);
  ws['!ref'] = `A1:D${tr + 2}`;
  XLSX.utils.book_append_sheet(wb, ws, 'Par modèle');

  if (byModel.length) {
    xlBuildBarChartSheet(wb, 'Graph. Modèles', `DÉPENSE PAR MODÈLE — ${year} (DT)`,
      byModel.map(m => m.modele), byModel.map(m => m.montant), 'DT');
  }
}

function buildFuelAlertsSheetXL(wb, alerts, year) {
  const ws = {};
  xlSetColWidths(ws, [5, 14, 22, 16, 16]);
  xlAddMerge(ws, 0, 0, 0, 4);
  xlWriteCell(ws, 0, 0, `POINTS D'ATTENTION — ${year}`, xlHdr('navyBg', 'navyFg'));

  xlAddMerge(ws, 2, 0, 2, 4);
  xlWriteCell(ws, 2, 0, '⚠️ Surconsommation (> 9%)', xlHdr('orangeBg', 'orangeFg'));
  ['#', 'Matricule', 'Modèle', 'Écart moy. (%)', ''].forEach((c, i) => xlWriteCell(ws, 3, i, c, xlHdr('greyBg', 'greyFg')));
  let r = 4;
  if (alerts.surconso.length) {
    alerts.surconso.forEach((v, idx) => {
      const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
      xlWriteCell(ws, r, 0, idx + 1, { ...xlDataCell(true, true, bg), alignment: { horizontal: 'center' } });
      xlWriteCell(ws, r, 1, v.matricule, xlDataCell(false, true, bg));
      xlWriteCell(ws, r, 2, v.modele || '—', xlDataCell(false, false, bg));
      xlWriteCell(ws, r, 3, +v.avgPct.toFixed(1), { ...xlDataCell(true, false, bg), numFmt: '0.0"%"' });
      xlWriteCell(ws, r, 4, '', xlDataCell(false, false, bg));
      r++;
    });
  } else {
    xlAddMerge(ws, r, 0, r, 4);
    xlWriteCell(ws, r, 0, 'Aucun véhicule en surconsommation notable.', xlDataCell(false, false, 'whiteBg'));
    r++;
  }

  r += 1;
  xlAddMerge(ws, r, 0, r, 4);
  xlWriteCell(ws, r, 0, '🚫 Immobilisés / en panne', xlHdr('orangeBg', 'orangeFg'));
  r++;
  ['#', 'Matricule', 'Modèle', 'Statut', ''].forEach((c, i) => xlWriteCell(ws, r, i, c, xlHdr('greyBg', 'greyFg')));
  r++;
  if (alerts.immobilises.length) {
    alerts.immobilises.forEach((v, idx) => {
      const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
      xlWriteCell(ws, r, 0, idx + 1, { ...xlDataCell(true, true, bg), alignment: { horizontal: 'center' } });
      xlWriteCell(ws, r, 1, v.matricule, xlDataCell(false, true, bg));
      xlWriteCell(ws, r, 2, v.modele || '—', xlDataCell(false, false, bg));
      xlWriteCell(ws, r, 3, v.lastStatut, { fill: { fgColor: { rgb: XLCLR.redBg } }, font: { bold: true, color: { rgb: XLCLR.redFg }, sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: xlThinBorder() });
      xlWriteCell(ws, r, 4, '', xlDataCell(false, false, bg));
      r++;
    });
  } else {
    xlAddMerge(ws, r, 0, r, 4);
    xlWriteCell(ws, r, 0, 'Aucun véhicule immobilisé signalé.', xlDataCell(false, false, 'whiteBg'));
    r++;
  }

  ws['!ref'] = `A1:E${r + 2}`;
  XLSX.utils.book_append_sheet(wb, ws, 'Alertes');
}

function buildFuelReportExcel(allData, year) {
  const kpi = computeAnnualKPI(allData, year);
  const evolution = computeMonthlyEvolution(allData, year);
  const byVehicle = computeAnnualByVehicle(allData, year);
  const byModel = computeByModel(byVehicle);
  const alerts = computeAlerts(allData, year, byVehicle);

  const wb = XLSX.utils.book_new();
  buildFuelCoverSheetXL(wb, year);
  buildFuelSynthSheetXL(wb, kpi, evolution, year);
  buildFuelEvolutionSheetXL(wb, evolution, year);
  buildFuelVehicleSheetXL(wb, byVehicle, year);
  buildFuelModelSheetXL(wb, byModel, year);
  buildFuelAlertsSheetXL(wb, alerts, year);
  return wb;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports.buildFuelReportExcel = buildFuelReportExcel;
}

if (typeof window !== 'undefined') {
  window.__buildFuelReportExcel = buildFuelReportExcel;

  function _fuelXlBtnState(btn, loading) {
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

  window.genererRapportCarburantExcel = function genererRapportCarburantExcel(evt) {
    const btn = evt && evt.target ? evt.target.closest('button') : null;
    try {
      _fuelXlBtnState(btn, true);
      if (typeof XLSX === 'undefined') {
        alert('La librairie Excel (SheetJS) n\'est pas chargée.');
        return;
      }
      const allData = (typeof getFuelData === 'function') ? getFuelData() : {};
      const year = (function () {
        const sel = document.getElementById('fuel-year-select');
        return (sel && sel.value) ? sel.value : String(new Date().getFullYear());
      })();

      const hasData = Object.keys(allData).some(function (k) {
        return k.indexOf(String(year)) === 0 && Object.keys(allData[k]).length;
      });
      if (!hasData) {
        alert('Aucune donnée carburant importée pour l\'année ' + year + '. Importez au moins un mois avant de générer le rapport.');
        return;
      }

      const wb = buildFuelReportExcel(allData, year);
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, 'Rapport_Carburant_' + year + '_DRT_Sfax_' + today + '.xlsx');
    } catch (err) {
      console.error('[FuelRapport] Erreur génération Excel:', err);
      alert('Erreur lors de la génération du rapport Excel : ' + (err && err.message ? err.message : err));
    } finally {
      _fuelXlBtnState(btn, false);
    }
  };
}

})();
