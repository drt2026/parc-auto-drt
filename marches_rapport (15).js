/* ============================================================
   MOTEUR DE GENERATION — RAPPORT SUIVI DES MARCHES (PPTX)
   Fonctionne à l'identique en Node (tests) et dans le navigateur
   (admin.html), à partir des données exposées par mrcGetReportData().
   ============================================================ */

/* BLOC ADDITIF : encapsulation IIFE — corrige une collision de portée
   ("const COLORS" était déclaré au top-level du script à la fois ici et
   dans fuel_rapport.js ; en JS classique, les `const` de premier niveau
   partagent la même portée entre tous les <script src> d'une page, donc
   ce fichier plantait avec une SyntaxError dès qu'il était chargé après
   fuel_rapport.js, et son contenu — y compris le bouton "Générer Rapport"
   — ne s'exécutait jamais). Fonctionne à l'identique en Node et navigateur. */
(function () {
'use strict';

const COLORS = {
  navy:      '1E3A5F',
  midnight:  '0F172A',
  ink:       '1E293B',
  slate:     '64748B',
  mist:      'E2E8F0',
  paper:     'FFFFFF',
  bg:        'F8FAFC',
  orange:    'EF6C00',
  orangeSoft:'FEF3C7',
  green:     '10B981',
  greenSoft: 'D1FAE5',
  red:       'EF4444',
  redSoft:   'FEE2E2',
  teal:      '0EA5B7',
};

function fmt(n, dec) { return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: dec||0, maximumFractionDigits: dec||0 }); }

function statusLabel(v) {
  if (v >= 80) return 'Avancé';
  if (v >= 50) return 'En cours';
  if (v > 0) return 'Démarré';
  return 'Non démarré';
}
function statusColor(v) {
  if (v >= 80) return COLORS.red;
  if (v >= 50) return COLORS.orange;
  if (v > 0) return COLORS.green;
  return COLORS.slate;
}

function parseFrDate(s) {
  // format attendu "JJ/MM/AAAA"
  if (!s || typeof s !== 'string') return null;
  const parts = s.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function computeSummary(data) {
  const { fournisseurs, getT, selMois } = data;
  const budgetTotal = fournisseurs.reduce((s, f) => s + f.budget, 0);
  let conso = 0, tauxSum = 0;
  fournisseurs.forEach(f => {
    const t = getT(f.id, selMois);
    conso += f.budget * (t / 100);
    tauxSum += t;
  });
  const tauxMoyen = fournisseurs.length ? tauxSum / fournisseurs.length : 0;
  return {
    budgetTotal, conso, reste: budgetTotal - conso, tauxMoyen,
    nbMarches: fournisseurs.length
  };
}

function computeDetail(data) {
  const { fournisseurs, getT, selMois } = data;
  return fournisseurs.map(f => {
    const t = getT(f.id, selMois);
    const conso = f.budget * t / 100;
    return {
      ...f, taux: t, conso, reste: f.budget - conso,
      status: statusLabel(t), statusColor: statusColor(t)
    };
  });
}

function computeEvolution(data) {
  const { fournisseurs, getT, mois } = data;
  return mois.map((label, mi) => {
    const row = { label };
    fournisseurs.forEach(f => { row[f.id] = getT(f.id, mi); });
    return row;
  });
}

function computeAlerts(detail) {
  const now = new Date();
  const risques = [];
  detail.forEach(f => {
    const fin = parseFrDate(f.fin);
    if (!fin) return;
    const joursRestants = Math.round((fin - now) / (1000 * 60 * 60 * 24));
    if (joursRestants <= 120 && f.taux < 60) {
      risques.push({ ...f, joursRestants });
    }
  });
  risques.sort((a, b) => a.joursRestants - b.joursRestants);
  const proches = detail.filter(f => f.taux >= 80).sort((a, b) => b.taux - a.taux);
  return { risques, proches };
}

/* BLOC ADDITIF — analyse approfondie : rythme mensuel de consommation, autonomie
   budgétaire estimée au rythme actuel, et comparaison avec l'échéance contractuelle.
   Ne réutilise que des données déjà présentes (budget, taux mensuels, date de fin) —
   aucune hypothèse ajoutée sur une date de démarrage non fournie. */
function computeAnalysis(data, detail) {
  const now = new Date();
  return detail.map(f => {
    const moisActifs = data.mois.reduce((n, _, mi) => n + (data.getT(f.id, mi) > 0 ? 1 : 0), 0);
    const rythmeMensuel = moisActifs > 0 ? f.conso / moisActifs : 0;
    const moisAutonomie = rythmeMensuel > 0 ? f.reste / rythmeMensuel : null;
    let dateEpuisement = null;
    if (moisAutonomie !== null && isFinite(moisAutonomie)) {
      dateEpuisement = new Date(now.getFullYear(), now.getMonth() + Math.round(moisAutonomie), 1);
    }
    const fin = parseFrDate(f.fin);
    const joursEcheance = fin ? Math.round((fin - now) / (1000 * 60 * 60 * 24)) : null;

    let diagnostic, diagColor;
    if (f.taux >= 95) {
      diagnostic = 'Budget quasi épuisé';
      diagColor = COLORS.red;
    } else if (dateEpuisement && fin && dateEpuisement < fin) {
      diagnostic = 'Rythme actuel \u2192 dépassement avant échéance';
      diagColor = COLORS.red;
    } else if (rythmeMensuel === 0 && f.taux < 20) {
      diagnostic = 'Marché peu actif \u2014 à relancer';
      diagColor = COLORS.slate;
    } else if (dateEpuisement && fin && dateEpuisement >= fin) {
      diagnostic = 'Rythme actuel \u2192 budget tiendra jusqu\u2019à l\u2019échéance';
      diagColor = COLORS.green;
    } else {
      diagnostic = 'Rythme sous contrôle';
      diagColor = COLORS.green;
    }
    return { ...f, moisActifs, rythmeMensuel, moisAutonomie, dateEpuisement, joursEcheance, diagnostic, diagColor };
  });
}

/* ---------- Construction du PPTX ---------- */

function buildMarchesReportPptx(PptxGenJSCtor, data, meta) {
  meta = meta || {};
  const pres = new PptxGenJSCtor();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = 'Parc Auto DRT Sfax';
  pres.title = 'Rapport Suivi des Marchés — DRT Sfax';

  const summary = computeSummary(data);
  const detail = computeDetail(data);
  const evolution = computeEvolution(data);
  const alerts = computeAlerts(detail);
  const monthLabel = data.moisFull[data.selMois] || '';

  const W = 13.33;

  /* ============ SLIDE 1 — TITRE ============ */
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.midnight };
    s.addShape(pres.shapes.OVAL, { x: 9.6, y: -2.2, w: 6, h: 6, fill: { color: COLORS.navy }, line: { type: 'none' } });
    s.addShape(pres.shapes.OVAL, { x: 10.6, y: 4.6, w: 4.2, h: 4.2, fill: { color: COLORS.orange, transparency: 84 }, line: { type: 'none' } });

    s.addText('📑', { x: 0.7, y: 0.75, w: 1.2, h: 1.2, fontSize: 44, align: 'left', valign: 'middle' });
    s.addText('SUIVI DES MARCHÉS — DRT SFAX', { x: 0.7, y: 1.75, w: 9, h: 0.5,
      fontSize: 14, color: COLORS.orange, bold: true, charSpacing: 3, fontFace: 'Calibri' });
    s.addText('Rapport Marchés', { x: 0.65, y: 2.25, w: 11, h: 1.3,
      fontSize: 48, color: COLORS.paper, bold: true, fontFace: 'Cambria' });
    s.addText(`Situation au ${monthLabel} 2026 — Garage DRT Sfax`, { x: 0.7, y: 3.45, w: 10, h: 0.55,
      fontSize: 20, color: 'CBD5E1', fontFace: 'Calibri' });

    s.addShape(pres.shapes.LINE, { x: 0.7, y: 4.25, w: 3.2, h: 0, line: { color: COLORS.orange, width: 2 } });

    const chips = [
      [`${summary.nbMarches}`, 'marchés suivis'],
      [`${fmt(summary.budgetTotal/1000,0)} kDT`, 'budget total'],
      [`${summary.tauxMoyen.toFixed(1)} %`, 'taux moyen'],
    ];
    let cx = 0.7;
    chips.forEach(([big, small]) => {
      s.addText([
        { text: big + '  ', options: { fontSize: 20, bold: true, color: COLORS.paper, breakLine: false } },
        { text: small, options: { fontSize: 12, color: '94A3B8' } }
      ], { x: cx, y: 4.6, w: 3.3, h: 0.5, fontFace: 'Calibri' });
      cx += 3.3;
    });

    s.addText(`Généré le ${meta.generatedOn || new Date().toLocaleDateString('fr-FR')} — Chef de Parc : Hamdi Ben Aouicha`,
      { x: 0.7, y: 6.9, w: 9, h: 0.35, fontSize: 10.5, color: '64748B', fontFace: 'Calibri' });
  }

  /* ============ SLIDE 2 — BILAN ============ */
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.bg };
    s.addText('Bilan budgétaire', { x: 0.6, y: 0.4, w: 8, h: 0.6, fontSize: 28, bold: true, color: COLORS.ink, fontFace: 'Cambria' });
    s.addText(`${summary.nbMarches} marchés · Situation ${monthLabel} 2026`, { x: 0.6, y: 0.95, w: 8, h: 0.4, fontSize: 13, color: COLORS.slate, fontFace: 'Calibri' });

    const cards = [
      { icon: '💰', big: `${fmt(summary.budgetTotal/1000,0)} kDT`, label: 'Budget total', color: COLORS.navy, soft: COLORS.mist },
      { icon: '📉', big: `${fmt(summary.conso/1000,2)} kDT`, label: `Consommé — ${monthLabel}`, color: COLORS.orange, soft: COLORS.orangeSoft },
      { icon: '💵', big: `${fmt(summary.reste/1000,2)} kDT`, label: 'Reste budget', color: COLORS.green, soft: COLORS.greenSoft },
      { icon: '📊', big: `${summary.tauxMoyen.toFixed(1)} %`, label: 'Taux d\u2019avancement moyen', color: statusColor(summary.tauxMoyen), soft: COLORS.mist },
    ];
    const gx = 0.6, gy = 1.7, gw = (W - 1.2 - 3*0.3) / 4, gh = 1.9, gapX = 0.3;
    cards.forEach((c, i) => {
      const x = gx + i*(gw+gapX), y = gy;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: gw, h: gh, rectRadius: 0.08,
        fill: { color: COLORS.paper },
        shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 90, opacity: 0.08 } });
      s.addShape(pres.shapes.OVAL, { x: x+0.25, y: y+0.25, w: 0.55, h: 0.55, fill: { color: c.soft }, line: { type: 'none' } });
      s.addText(c.icon, { x: x+0.25, y: y+0.25, w: 0.55, h: 0.55, fontSize: 20, align: 'center', valign: 'middle', margin: 0 });
      s.addText(c.big, { x: x+0.22, y: y+1.0, w: gw-0.4, h: 0.5, fontSize: 19, bold: true, color: c.color, fontFace: 'Cambria', margin: 0 });
      s.addText(c.label, { x: x+0.22, y: y+1.5, w: gw-0.4, h: 0.35, fontSize: 10.5, color: COLORS.slate, fontFace: 'Calibri', margin: 0 });
    });

    // Table détail par fournisseur
    s.addText('Détail par fournisseur', { x: 0.6, y: 4.0, w: 8, h: 0.4, fontSize: 16, bold: true, color: COLORS.ink, fontFace: 'Cambria' });
    const rows = [[
      { text: 'Fournisseur', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10 } },
      { text: 'Budget', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10, align: 'right' } },
      { text: 'Taux', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10, align: 'center' } },
      { text: 'Consommé', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10, align: 'right' } },
      { text: 'Reste', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10, align: 'right' } },
      { text: 'Statut', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10, align: 'center' } },
    ]];
    detail.forEach((f, i) => {
      const fill = i % 2 === 0 ? COLORS.paper : COLORS.bg;
      rows.push([
        { text: f.nom, options: { fill: { color: fill }, fontSize: 10, bold: true, color: COLORS.ink } },
        { text: `${fmt(f.budget/1000,0)} kDT`, options: { fill: { color: fill }, fontSize: 10, color: COLORS.slate, align: 'right' } },
        { text: `${f.taux.toFixed(1)}%`, options: { fill: { color: fill }, fontSize: 10, bold: true, color: f.statusColor, align: 'center' } },
        { text: `${fmt(f.conso/1000,2)} kDT`, options: { fill: { color: fill }, fontSize: 10, color: COLORS.slate, align: 'right' } },
        { text: `${fmt(f.reste/1000,2)} kDT`, options: { fill: { color: fill }, fontSize: 10, color: COLORS.slate, align: 'right' } },
        { text: f.status, options: { fill: { color: fill }, fontSize: 9.5, color: f.statusColor, align: 'center' } },
      ]);
    });
    s.addTable(rows, { x: 0.6, y: 4.45, w: 12.1, colW: [3.4, 1.9, 1.5, 2.0, 2.0, 1.3],
      border: { pt: 0.5, color: COLORS.mist }, valign: 'middle', rowH: 0.38 });
  }

  /* BLOC ADDITIF — SLIDE 3 — VUE GLOBALE (heatmap tous les mois, reproduit l'onglet
     "Suivi des Marchés" de l'interface : une ligne par marché, une colonne par mois,
     cellule colorée selon le même code que mrcBc() côté admin.html). */
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.bg };
    s.addText('Vue globale — tous les mois', { x: 0.6, y: 0.4, w: 10, h: 0.6, fontSize: 28, bold: true, color: COLORS.ink, fontFace: 'Cambria' });
    s.addText('Taux d\\u2019avancement (%) par marché et par mois — 2026', { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: COLORS.slate, fontFace: 'Calibri' });

    function heatColor(v) {
      if (v >= 80) return { bg: COLORS.redSoft, fg: COLORS.red };
      if (v >= 50) return { bg: COLORS.orangeSoft, fg: COLORS.orange };
      if (v > 0) return { bg: COLORS.greenSoft, fg: COLORS.green };
      return { bg: COLORS.mist, fg: COLORS.slate };
    }

    const rows = [[
      { text: 'Fournisseur / Marché', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 9, align: 'left' } }
    ].concat(data.mois.map(m => ({ text: m, options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 9, align: 'center' } })))
     .concat([{ text: 'Moy.', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 9, align: 'center' } }])];

    data.fournisseurs.forEach((f) => {
      let sum = 0;
      const monthCells = data.mois.map((_, mi) => {
        const v = data.getT(f.id, mi);
        sum += v;
        const c = heatColor(v);
        return { text: v > 0 ? v.toFixed(1) : '—', options: { fill: { color: c.bg }, color: c.fg, bold: true, fontSize: 9, align: 'center' } };
      });
      const avg = sum / data.mois.length;
      rows.push([
        { text: f.nom, options: { fill: { color: COLORS.paper }, color: COLORS.ink, bold: true, fontSize: 9 } }
      ].concat(monthCells).concat([
        { text: avg.toFixed(1) + '%', options: { fill: { color: COLORS.mist }, color: COLORS.navy, bold: true, fontSize: 9, align: 'center' } }
      ]));
    });

    const colW = [2.5].concat(data.mois.map(() => 0.75)).concat([0.85]);
    s.addTable(rows, { x: 0.6, y: 1.6, w: colW.reduce((a, b) => a + b, 0), colW,
      border: { pt: 0.5, color: COLORS.mist }, valign: 'middle', rowH: 0.55 });

    const legend = [['\u2265 80 %', COLORS.red], ['50–79 %', COLORS.orange], ['1–49 %', COLORS.green], ['0 %', COLORS.slate]];
    let lx = 0.6;
    legend.forEach(function (item) {
      s.addShape(pres.shapes.OVAL, { x: lx, y: 6.35, w: 0.18, h: 0.18, fill: { color: item[1] }, line: { type: 'none' } });
      s.addText(item[0], { x: lx + 0.25, y: 6.28, w: 1.3, h: 0.32, fontSize: 10, color: COLORS.slate, fontFace: 'Calibri' });
      lx += 1.6;
    });
  }

  /* ============ SLIDE 4 — EVOLUTION DES TAUX ============ */
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.paper };
    s.addText('Évolution des taux d\u2019avancement', { x: 0.6, y: 0.4, w: 10, h: 0.6, fontSize: 28, bold: true, color: COLORS.ink, fontFace: 'Cambria' });
    s.addText('Suivi mensuel par marché — 2026', { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: COLORS.slate, fontFace: 'Calibri' });

    const palette = [COLORS.navy, COLORS.orange, COLORS.green, '7C77DD', 'D4537E'];
    const series = data.fournisseurs.map((f, i) => ({
      name: f.nom,
      labels: evolution.map(e => e.label),
      values: evolution.map(e => e[f.id])
    }));

    s.addChart(pres.charts.LINE, series, {
      x: 0.5, y: 1.55, w: 12.3, h: 4.7,
      chartColors: palette,
      lineSize: 2.5, lineSmooth: false, lineDataSymbol: 'circle', lineDataSymbolSize: 5,
      chartArea: { fill: { color: COLORS.paper } },
      catAxisLabelColor: COLORS.slate, valAxisLabelColor: COLORS.slate,
      valAxisMinVal: 0, valAxisMaxVal: 100,
      valAxisTitle: '% avancement', showValAxisTitle: true, valAxisTitleColor: COLORS.slate, valAxisTitleFontSize: 10,
      valGridLine: { color: COLORS.mist, size: 0.75 }, catGridLine: { style: 'none' },
      showLegend: true, legendPos: 'b', legendColor: COLORS.slate, legendFontSize: 10,
    });
  }

  /* ============ SLIDE 5 — REPARTITION BUDGETAIRE ============ */
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.bg };
    s.addText('Répartition budgétaire', { x: 0.6, y: 0.4, w: 10, h: 0.6, fontSize: 28, bold: true, color: COLORS.ink, fontFace: 'Cambria' });
    s.addText('Part de chaque marché dans le budget global', { x: 0.6, y: 0.95, w: 9, h: 0.4, fontSize: 13, color: COLORS.slate, fontFace: 'Calibri' });

    const palette = [COLORS.navy, COLORS.orange, COLORS.green, '7C77DD', 'D4537E'];
    s.addChart(pres.charts.DOUGHNUT, [{
      name: 'Budget', labels: data.fournisseurs.map(f => f.nom), values: data.fournisseurs.map(f => f.budget)
    }], {
      x: 0.6, y: 1.6, w: 6.2, h: 5.1,
      chartColors: palette,
      showLegend: true, legendPos: 'r', legendColor: COLORS.slate, legendFontSize: 11,
      showPercent: true, dataLabelColor: COLORS.paper, dataLabelFontSize: 10, dataLabelPosition: 'ctr',
      chartArea: { fill: { color: COLORS.bg } },
    });

    const rows = [[
      { text: 'Marché', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10 } },
      { text: 'N° Cmd', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10, align: 'center' } },
      { text: 'Budget', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10, align: 'right' } },
      { text: 'Échéance', options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10, align: 'center' } },
    ]];
    data.fournisseurs.forEach((f, i) => {
      const fill = i % 2 === 0 ? COLORS.paper : COLORS.bg;
      rows.push([
        { text: f.nom, options: { fill: { color: fill }, fontSize: 9.5, color: COLORS.ink } },
        { text: f.cmd, options: { fill: { color: fill }, fontSize: 9.5, color: COLORS.slate, align: 'center' } },
        { text: `${fmt(f.budget/1000,0)} kDT`, options: { fill: { color: fill }, fontSize: 9.5, bold: true, color: COLORS.navy, align: 'right' } },
        { text: f.fin, options: { fill: { color: fill }, fontSize: 9.5, color: COLORS.slate, align: 'center' } },
      ]);
    });
    s.addTable(rows, { x: 7.1, y: 1.6, w: 5.65, colW: [2.55, 1.1, 1.1, 0.9],
      border: { pt: 0.5, color: COLORS.mist }, valign: 'middle', rowH: 0.7 });
  }

  /* ============ SLIDE 6 — POINTS D'ATTENTION ============ */
  {
    const s = pres.addSlide();
    s.background = { color: COLORS.midnight };
    s.addText('Points d\u2019attention', { x: 0.6, y: 0.5, w: 8, h: 0.6, fontSize: 28, bold: true, color: COLORS.paper, fontFace: 'Cambria' });
    s.addText('Marchés à surveiller', { x: 0.6, y: 1.05, w: 9, h: 0.4, fontSize: 13, color: '94A3B8', fontFace: 'Calibri' });

    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 1.7, w: 5.9, h: 5.1, rectRadius: 0.08, fill: { color: '16213E' }, line: { type: 'none' } });
    s.addText('⏰  Échéance proche (< 4 mois) & taux < 60%', { x: 0.9, y: 1.95, w: 5.3, h: 0.6, fontSize: 14, bold: true, color: COLORS.orange, fontFace: 'Calibri' });
    if (alerts.risques.length) {
      const txt = alerts.risques.map(f => ({
        text: `${f.nom}  —  ${f.taux.toFixed(0)}%  (fin ${f.fin})`,
        options: { bullet: { code: '25CF' }, color: 'E2E8F0', fontSize: 12.5, breakLine: true, paraSpaceAfter: 8 }
      }));
      txt[txt.length-1].options.breakLine = false;
      s.addText(txt, { x: 0.95, y: 2.75, w: 5.3, h: 3.8, fontFace: 'Calibri' });
    } else {
      s.addText('Aucun marché à risque identifié.', { x: 0.95, y: 2.75, w: 5.3, h: 0.6, fontSize: 13, color: '94A3B8', fontFace: 'Calibri' });
    }

    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.8, y: 1.7, w: 5.9, h: 5.1, rectRadius: 0.08, fill: { color: '16213E' }, line: { type: 'none' } });
    s.addText('✅  Marchés avancés (≥ 80%)', { x: 7.1, y: 1.95, w: 5.3, h: 0.4, fontSize: 14, bold: true, color: COLORS.green, fontFace: 'Calibri' });
    if (alerts.proches.length) {
      const txt2 = alerts.proches.map(f => ({
        text: `${f.nom}  —  ${f.taux.toFixed(0)}%  (reste ${fmt(f.reste/1000,2)} kDT)`,
        options: { bullet: { code: '25CF' }, color: 'E2E8F0', fontSize: 12.5, breakLine: true, paraSpaceAfter: 8 }
      }));
      txt2[txt2.length-1].options.breakLine = false;
      s.addText(txt2, { x: 7.15, y: 2.5, w: 5.3, h: 4, fontFace: 'Calibri' });
    } else {
      s.addText('Aucun marché proche de la clôture.', { x: 7.15, y: 2.5, w: 5.3, h: 0.6, fontSize: 13, color: '94A3B8', fontFace: 'Calibri' });
    }
  }

  return pres;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildMarchesReportPptx, computeSummary, computeDetail, computeEvolution, computeAlerts, computeAnalysis, COLORS };
}

/* ============================================================
   INTEGRATION NAVIGATEUR — bouton "Générer Rapport" (Suivi des Marchés)
   Purement additif : n'altère aucune fonction existante.
   ============================================================ */
if (typeof window !== 'undefined') {
  window.__buildMarchesReportPptx = buildMarchesReportPptx;

  const PPTXGENJS_CDN_URLS = [
    'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
    'https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
    'https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
  ];

  function _loadScriptOnceMrc(src) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = src;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('404/erreur réseau : ' + src)); };
      document.head.appendChild(script);
    });
  }

  function _loadPptxGenJsMrc() {
    if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
    if (window.__pptxgenjsLoading) return window.__pptxgenjsLoading;
    window.__pptxgenjsLoading = (async function () {
      let lastErr = null;
      for (const url of PPTXGENJS_CDN_URLS) {
        try {
          await _loadScriptOnceMrc(url);
          if (window.PptxGenJS) return window.PptxGenJS;
        } catch (e) { lastErr = e; }
      }
      window.__pptxgenjsLoading = null;
      throw new Error('Impossible de charger la librairie PptxGenJS (tous les miroirs CDN ont échoué). Vérifiez votre connexion internet. ' + (lastErr ? lastErr.message : ''));
    })();
    return window.__pptxgenjsLoading;
  }

  function _mrcBtnState(btn, loading) {
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

  window.genererRapportMarchesPPTX = async function genererRapportMarchesPPTX(evt) {
    const btn = evt && evt.target ? evt.target.closest('button') : null;
    try {
      _mrcBtnState(btn, true);
      const PptxCtor = await _loadPptxGenJsMrc();

      if (typeof window.mrcGetReportData !== 'function') {
        alert('Le module Suivi des Marchés n\'est pas encore chargé. Ouvrez d\'abord l\'onglet "Suivi des Marchés".');
        return;
      }
      const data = window.mrcGetReportData();

      const pres = buildMarchesReportPptx(PptxCtor, data, {
        generatedOn: new Date().toLocaleDateString('fr-FR')
      });

      const today = new Date().toISOString().slice(0, 10);
      await pres.writeFile({ fileName: 'Rapport_Marches_DRT_Sfax_' + today + '.pptx' });
    } catch (err) {
      console.error('[MarchesRapport] Erreur génération PPTX:', err);
      alert('Erreur lors de la génération du rapport : ' + (err && err.message ? err.message : err));
    } finally {
      _mrcBtnState(btn, false);
    }
  };
}

/* ============================================================
   BLOC ADDITIF — RAPPORT MARCHÉS EXCEL AVEC COULEUR (SheetJS)
   Même convention visuelle que repair_rapport.js / fuel_rapport.js.
   Purement additif : n'altère aucune fonction existante.
   ============================================================ */
const XLCLR = {
  navyFg: 'FFFFFFFF', navyBg: 'FF1E3A5F',
  orangeBg: 'FFEF6C00', orangeFg: 'FFFFFFFF',
  greyBg: 'FFF1F5F9', greyFg: 'FF1E293B',
  whiteBg: 'FFFFFFFF',
  greenBg: 'FFD1FAE5', greenFg: 'FF065F46',
  redBg: 'FFFEE2E2', redFg: 'FF991B1B',
  borderClr: 'FFE2E8F0', alertBg: 'FFFFF3CD',
  /* BLOC ADDITIF — teintes douces alignées sur mrcBc() de l'interface (Suivi des Marchés) */
  orangeSoftBg: 'FFFEF3C7', orangeTextFg: 'FFB45300',
  mutedFg: 'FF94A3B8',
};

function xlColLetter(c) {
  let s = '';
  c = c + 1;
  while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
  return s;
}
function xlCellRef(r, c) { return xlColLetter(c) + (r + 1); }
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
/* BLOC ADDITIF — reproduit exactement mrcBc(v) de l'interface (rouge ≥80, orange ≥50, vert >0, gris =0)
   pour que les couleurs du rapport Excel correspondent à celles vues à l'écran dans Suivi des Marchés. */
function xlHeatCell(v) {
  if (v >= 80) return { bgKey: 'redBg', fgKey: 'redFg' };
  if (v >= 50) return { bgKey: 'orangeSoftBg', fgKey: 'orangeTextFg' };
  if (v > 0) return { bgKey: 'greenBg', fgKey: 'greenFg' };
  return { bgKey: 'greyBg', fgKey: 'mutedFg' };
}
function xlHeatStyle(v, extra) {
  const c = xlHeatCell(v);
  return Object.assign({
    fill: { fgColor: { rgb: XLCLR[c.bgKey] } },
    font: { bold: true, color: { rgb: XLCLR[c.fgKey] }, sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: xlThinBorder(), numFmt: '0.0"%"'
  }, extra || {});
}
const XL_BAR_CHAR = '█', XL_BAR_MAXLEN = 30;
function xlBarString(value, max) {
  if (max <= 0) return '';
  const len = Math.max(1, Math.round((value / max) * XL_BAR_MAXLEN));
  return XL_BAR_CHAR.repeat(len);
}
function xlBarColorByRank(idx) {
  const palette = ['FFEF6C00', 'FFF2872B', 'FFF59E0B', 'FF1E3A5F', 'FF334155', 'FF475569', 'FF64748B'];
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

function buildMarchesCoverSheetXL(wb, monthLabel) {
  const ws = {};
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  xlSetColWidths(ws, [5, 20, 20, 20, 20, 20, 5]);
  xlAddMerge(ws, 2, 1, 3, 5);
  xlWriteCell(ws, 2, 1, 'TUNISIE TELECOM', { fill: { fgColor: { rgb: XLCLR.navyBg } }, font: { bold: true, color: { rgb: XLCLR.navyFg }, sz: 20 }, alignment: { horizontal: 'center', vertical: 'center' } });
  xlAddMerge(ws, 5, 1, 6, 5);
  xlWriteCell(ws, 5, 1, 'RAPPORT SUIVI DES MARCHÉS', { fill: { fgColor: { rgb: XLCLR.orangeBg } }, font: { bold: true, color: { rgb: XLCLR.orangeFg }, sz: 16 }, alignment: { horizontal: 'center', vertical: 'center' } });
  xlAddMerge(ws, 8, 1, 9, 5);
  xlWriteCell(ws, 8, 1, 'Suivi Budgétaire — Parc Automobile DRT Sfax', { fill: { fgColor: { rgb: XLCLR.greyBg } }, font: { bold: true, color: { rgb: XLCLR.greyFg }, sz: 13 }, alignment: { horizontal: 'center', vertical: 'center' } });
  const rows = [
    ['Direction Régionale', 'DRT Sfax'],
    ['Validateurs', 'Hanen Feki / Zied Ouledabdallah'],
    ['Situation au', `${monthLabel} 2026`],
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

function buildMarchesSynthSheetXL(wb, summary, monthLabel) {
  const ws = {};
  xlSetColWidths(ws, [24, 18, 5, 5, 5, 5, 5, 5]);
  xlAddMerge(ws, 0, 0, 0, 5);
  xlWriteCell(ws, 0, 0, `SYNTHÈSE GLOBALE — SITUATION ${monthLabel}`, xlHdr('navyBg', 'navyFg'));
  const kpis = [
    ['Nombre de marchés suivis', summary.nbMarches],
    ['Budget total', fmt(summary.budgetTotal) + ' DT'],
    [`Consommé — ${monthLabel}`, fmt(summary.conso, 2) + ' DT'],
    ['Reste budget', fmt(summary.reste, 2) + ' DT'],
    ["Taux d'avancement moyen", summary.tauxMoyen.toFixed(1) + ' %'],
  ];
  kpis.forEach(([lbl, val], i) => {
    const r = 2 + i;
    xlWriteCell(ws, r, 0, lbl, xlHdr('greyBg', 'greyFg'));
    xlAddMerge(ws, r, 1, r, 3);
    xlWriteCell(ws, r, 1, val, { ...xlDataCell(false, true), alignment: { horizontal: 'left', vertical: 'center' } });
  });
  ws['!ref'] = `A1:H${2 + kpis.length + 2}`;
  XLSX.utils.book_append_sheet(wb, ws, 'Synthèse');
}

function buildMarchesDetailSheetXL(wb, detail, monthLabel) {
  const ws = {};
  xlSetColWidths(ws, [26, 14, 12, 14, 14, 14]);
  xlAddMerge(ws, 0, 0, 0, 5);
  xlWriteCell(ws, 0, 0, `DÉTAIL PAR MARCHÉ — ${monthLabel}`, xlHdr('navyBg', 'navyFg'));
  ['Marché', 'N° Cmd', 'Budget (DT)', 'Taux (%)', 'Consommé (DT)', 'Statut'].forEach((c, i) => xlWriteCell(ws, 2, i, c, xlHdr('orangeBg', 'orangeFg')));
  detail.forEach((f, idx) => {
    const r = 3 + idx;
    const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
    xlWriteCell(ws, r, 0, f.nom, xlDataCell(false, true, bg));
    xlWriteCell(ws, r, 1, f.cmd, xlDataCell(false, false, bg));
    xlWriteCell(ws, r, 2, +f.budget.toFixed(2), xlDataCell(true, false, bg));
    xlWriteCell(ws, r, 3, +f.taux.toFixed(1), { ...xlDataCell(true, false, bg), numFmt: '0.0"%"' });
    xlWriteCell(ws, r, 4, +f.conso.toFixed(2), xlDataCell(true, false, bg));
    const statutStyle = f.taux >= 80
      ? { fill: { fgColor: { rgb: XLCLR.redBg } }, font: { bold: true, color: { rgb: XLCLR.redFg }, sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: xlThinBorder() }
      : f.taux >= 50
      ? { fill: { fgColor: { rgb: XLCLR.orangeSoftBg } }, font: { bold: true, color: { rgb: XLCLR.orangeTextFg }, sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: xlThinBorder() }
      : { fill: { fgColor: { rgb: XLCLR.greenBg } }, font: { bold: true, color: { rgb: XLCLR.greenFg }, sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: xlThinBorder() };
    xlWriteCell(ws, r, 5, f.status, statutStyle);
  });
  const tr = 3 + detail.length;
  const ts = xlTotalRow();
  xlWriteCell(ws, tr, 0, 'TOTAL', ts);
  xlWriteCell(ws, tr, 1, '', ts);
  xlWriteCell(ws, tr, 2, +detail.reduce((s, f) => s + f.budget, 0).toFixed(2), ts);
  xlWriteCell(ws, tr, 3, '', ts);
  xlWriteCell(ws, tr, 4, +detail.reduce((s, f) => s + f.conso, 0).toFixed(2), ts);
  xlWriteCell(ws, tr, 5, '', ts);
  ws['!ref'] = `A1:F${tr + 2}`;
  XLSX.utils.book_append_sheet(wb, ws, 'Détail par marché');
}

/* BLOC ADDITIF — feuille "Vue Globale" : reproduit le tableau heatmap de l'onglet
   Suivi des Marchés (un fournisseur par ligne, un mois par colonne, cellule colorée
   selon mrcBc(v) : rouge ≥80%, orange ≥50%, vert >0%, gris =0%). Purement additive,
   n'altère aucune feuille existante. */
function buildMarchesVueGlobaleSheetXL(wb, data, evolution) {
  const ws = {};
  const nbMonths = data.mois.length;
  const lastCol = nbMonths + 1; // fournisseur(0) + mois(1..12) + moyenne(13)
  xlSetColWidths(ws, [30].concat(data.mois.map(() => 7)).concat([10]));

  xlAddMerge(ws, 0, 0, 0, lastCol);
  xlWriteCell(ws, 0, 0, 'VUE GLOBALE — TOUS LES MOIS 2026', xlHdr('navyBg', 'navyFg'));
  xlAddMerge(ws, 1, 0, 1, lastCol);
  xlWriteCell(ws, 1, 0, `${data.fournisseurs.length} marché(s) suivi(s) — taux d'avancement (%) par mois`,
    { fill: { fgColor: { rgb: XLCLR.greyBg } }, font: { italic: true, color: { rgb: XLCLR.greyFg }, sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' } });

  const headerRow = 3;
  xlWriteCell(ws, headerRow, 0, 'Fournisseur / Marché', xlHdr('orangeBg', 'orangeFg'));
  data.mois.forEach((m, i) => xlWriteCell(ws, headerRow, 1 + i, m, xlHdr('orangeBg', 'orangeFg')));
  xlWriteCell(ws, headerRow, lastCol, 'Moy.', xlHdr('orangeBg', 'orangeFg'));

  data.fournisseurs.forEach((f, fi) => {
    const r = headerRow + 1 + fi;
    // Nom du marché + repère couleur (identique au point coloré MRC_COLORS de l'interface) + sous-ligne Cmd/Année/Fin
    const accentColor = (data.colors && data.colors[fi] ? data.colors[fi] : '#1E3A5F').replace('#', 'FF').toUpperCase();
    xlWriteCell(ws, r, 0, `\u25CF ${f.nom}\nCmd: ${f.cmd} \u00B7 ${f.annee || ''} \u00B7 Fin: ${f.fin}`, {
      fill: { fgColor: { rgb: XLCLR.whiteBg } },
      font: { bold: true, color: { rgb: XLCLR.greyFg }, sz: 10 },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: xlThinBorder()
    });
    let sum = 0;
    data.mois.forEach((_, mi) => {
      const v = data.getT(f.id, mi);
      sum += v;
      xlWriteCell(ws, r, 1 + mi, +v.toFixed(1), xlHeatStyle(v));
    });
    const avg = sum / nbMonths;
    xlWriteCell(ws, r, lastCol, +avg.toFixed(1), xlHeatStyle(avg, { font: { bold: true, sz: 10.5, color: { rgb: XLCLR.navyBg } }, fill: { fgColor: { rgb: XLCLR.greyBg } } }));
  });
  ws['!rows'] = [{ hpt: 22 }, { hpt: 16 }, {}, { hpt: 18 }].concat(data.fournisseurs.map(() => ({ hpt: 30 })));
  ws['!ref'] = `A1:${xlColLetter(lastCol)}${headerRow + data.fournisseurs.length + 2}`;
  XLSX.utils.book_append_sheet(wb, ws, 'Vue Globale');
}

function buildMarchesEvolutionSheetXL(wb, data, evolution) {
  const ws = {};
  const cols = [14].concat(data.fournisseurs.map(() => 16));
  xlSetColWidths(ws, cols);
  xlAddMerge(ws, 0, 0, 0, data.fournisseurs.length);
  xlWriteCell(ws, 0, 0, `ÉVOLUTION DES TAUX D'AVANCEMENT — 2026`, xlHdr('navyBg', 'navyFg'));
  xlWriteCell(ws, 2, 0, 'Mois', xlHdr('orangeBg', 'orangeFg'));
  data.fournisseurs.forEach((f, i) => xlWriteCell(ws, 2, 1 + i, f.nom, xlHdr('orangeBg', 'orangeFg')));
  evolution.forEach((row, idx) => {
    const r = 3 + idx;
    const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
    xlWriteCell(ws, r, 0, row.label, xlDataCell(false, true, bg));
    data.fournisseurs.forEach((f, i) => {
      xlWriteCell(ws, r, 1 + i, +Number(row[f.id] || 0).toFixed(1), { ...xlDataCell(true, false, bg), numFmt: '0.0"%"' });
    });
  });
  ws['!ref'] = `A1:${xlColLetter(data.fournisseurs.length)}${3 + evolution.length + 1}`;
  XLSX.utils.book_append_sheet(wb, ws, 'Évolution des taux');
}

function buildMarchesBudgetSheetXL(wb, data, monthLabel) {
  const ws = {};
  xlSetColWidths(ws, [26, 14, 16, 14]);
  xlAddMerge(ws, 0, 0, 0, 3);
  xlWriteCell(ws, 0, 0, `RÉPARTITION BUDGÉTAIRE — ${monthLabel}`, xlHdr('navyBg', 'navyFg'));
  ['Marché', 'N° Cmd', 'Budget (DT)', 'Échéance'].forEach((c, i) => xlWriteCell(ws, 2, i, c, xlHdr('orangeBg', 'orangeFg')));
  data.fournisseurs.forEach((f, idx) => {
    const r = 3 + idx;
    const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
    xlWriteCell(ws, r, 0, f.nom, xlDataCell(false, true, bg));
    xlWriteCell(ws, r, 1, f.cmd, xlDataCell(false, false, bg));
    xlWriteCell(ws, r, 2, +f.budget.toFixed(2), xlDataCell(true, false, bg));
    xlWriteCell(ws, r, 3, f.fin, xlDataCell(false, false, bg));
  });
  const tr = 3 + data.fournisseurs.length;
  const ts = xlTotalRow();
  xlWriteCell(ws, tr, 0, 'TOTAL', ts);
  xlWriteCell(ws, tr, 1, '', ts);
  xlWriteCell(ws, tr, 2, +data.fournisseurs.reduce((s, f) => s + f.budget, 0).toFixed(2), ts);
  xlWriteCell(ws, tr, 3, '', ts);
  ws['!ref'] = `A1:D${tr + 2}`;
  XLSX.utils.book_append_sheet(wb, ws, 'Répartition budgétaire');

  xlBuildBarChartSheet(wb, 'Graph. Budget', `RÉPARTITION BUDGÉTAIRE (DT)`,
    data.fournisseurs.map(f => f.nom), data.fournisseurs.map(f => f.budget), 'DT');
}

function buildMarchesAlertsSheetXL(wb, alerts) {
  const ws = {};
  xlSetColWidths(ws, [5, 26, 16, 20]);
  xlAddMerge(ws, 0, 0, 0, 3);
  xlWriteCell(ws, 0, 0, `POINTS D'ATTENTION`, xlHdr('navyBg', 'navyFg'));

  xlAddMerge(ws, 2, 0, 2, 3);
  xlWriteCell(ws, 2, 0, '⏰ Échéance proche (< 4 mois) & taux < 60%', xlHdr('orangeBg', 'orangeFg'));
  ['#', 'Marché', 'Taux (%)', 'Échéance'].forEach((c, i) => xlWriteCell(ws, 3, i, c, xlHdr('greyBg', 'greyFg')));
  let r = 4;
  if (alerts.risques.length) {
    alerts.risques.forEach((f, idx) => {
      const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
      xlWriteCell(ws, r, 0, idx + 1, { ...xlDataCell(true, true, bg), alignment: { horizontal: 'center' } });
      xlWriteCell(ws, r, 1, f.nom, xlDataCell(false, true, bg));
      xlWriteCell(ws, r, 2, +f.taux.toFixed(1), { ...xlDataCell(true, false, bg), numFmt: '0.0"%"' });
      xlWriteCell(ws, r, 3, f.fin, xlDataCell(false, false, bg));
      r++;
    });
  } else {
    xlAddMerge(ws, r, 0, r, 3);
    xlWriteCell(ws, r, 0, 'Aucun marché à risque identifié.', xlDataCell(false, false, 'whiteBg'));
    r++;
  }

  r += 1;
  xlAddMerge(ws, r, 0, r, 3);
  xlWriteCell(ws, r, 0, '✅ Marchés avancés (≥ 80%)', xlHdr('orangeBg', 'orangeFg'));
  r++;
  ['#', 'Marché', 'Taux (%)', 'Reste (DT)'].forEach((c, i) => xlWriteCell(ws, r, i, c, xlHdr('greyBg', 'greyFg')));
  r++;
  if (alerts.proches.length) {
    alerts.proches.forEach((f, idx) => {
      const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
      xlWriteCell(ws, r, 0, idx + 1, { ...xlDataCell(true, true, bg), alignment: { horizontal: 'center' } });
      xlWriteCell(ws, r, 1, f.nom, xlDataCell(false, true, bg));
      xlWriteCell(ws, r, 2, +f.taux.toFixed(1), { ...xlDataCell(true, false, bg), numFmt: '0.0"%"' });
      xlWriteCell(ws, r, 3, +f.reste.toFixed(2), xlDataCell(true, false, bg));
      r++;
    });
  } else {
    xlAddMerge(ws, r, 0, r, 3);
    xlWriteCell(ws, r, 0, 'Aucun marché proche de la clôture.', xlDataCell(false, false, 'whiteBg'));
    r++;
  }

  ws['!ref'] = `A1:D${r + 2}`;
  XLSX.utils.book_append_sheet(wb, ws, 'Points attention');
}

/* BLOC ADDITIF — feuille "Analyse & Projections" : rythme mensuel, autonomie budgétaire
   estimée et diagnostic par marché (voir computeAnalysis). */
function buildMarchesAnalyseSheetXL(wb, analysis, monthLabel) {
  const ws = {};
  xlSetColWidths(ws, [26, 15, 11, 13, 14, 15, 13, 30]);
  xlAddMerge(ws, 0, 0, 0, 7);
  xlWriteCell(ws, 0, 0, `ANALYSE & PROJECTIONS — SITUATION ${monthLabel}`, xlHdr('navyBg', 'navyFg'));
  xlAddMerge(ws, 1, 0, 1, 7);
  xlWriteCell(ws, 1, 0, 'Rythme de consommation observé et autonomie budgétaire estimée au rythme actuel',
    { fill: { fgColor: { rgb: XLCLR.greyBg } }, font: { italic: true, color: { rgb: XLCLR.greyFg }, sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' } });

  const headers = ['Marché', 'Rythme mensuel (DT/mois)', 'Mois actifs', 'Reste budget (DT)',
    'Autonomie estimée', 'Épuisement estimé', 'Échéance', 'Diagnostic'];
  headers.forEach((h, i) => xlWriteCell(ws, 3, i, h, xlHdr('orangeBg', 'orangeFg')));

  analysis.forEach((f, idx) => {
    const r = 4 + idx;
    const bg = idx % 2 === 0 ? 'whiteBg' : 'greyBg';
    xlWriteCell(ws, r, 0, f.nom, xlDataCell(false, true, bg));
    xlWriteCell(ws, r, 1, +f.rythmeMensuel.toFixed(2), xlDataCell(true, false, bg));
    xlWriteCell(ws, r, 2, f.moisActifs, { ...xlDataCell(true, false, bg), alignment: { horizontal: 'center' } });
    xlWriteCell(ws, r, 3, +f.reste.toFixed(2), xlDataCell(true, false, bg));
    xlWriteCell(ws, r, 4, f.moisAutonomie !== null ? `${f.moisAutonomie.toFixed(1)} mois` : '\u2014',
      { ...xlDataCell(false, false, bg), alignment: { horizontal: 'center' } });
    xlWriteCell(ws, r, 5, f.dateEpuisement ? f.dateEpuisement.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '\u2014',
      { ...xlDataCell(false, false, bg), alignment: { horizontal: 'center' } });
    xlWriteCell(ws, r, 6, f.fin, { ...xlDataCell(false, false, bg), alignment: { horizontal: 'center' } });
    const diagBgKey = f.diagColor === COLORS.red ? 'redBg' : f.diagColor === COLORS.slate ? 'greyBg' : 'greenBg';
    const diagFgKey = f.diagColor === COLORS.red ? 'redFg' : f.diagColor === COLORS.slate ? 'mutedFg' : 'greenFg';
    xlWriteCell(ws, r, 7, f.diagnostic, {
      fill: { fgColor: { rgb: XLCLR[diagBgKey] } },
      font: { bold: true, color: { rgb: XLCLR[diagFgKey] }, sz: 9.5 },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: xlThinBorder()
    });
  });
  ws['!ref'] = `A1:H${4 + analysis.length + 2}`;
  XLSX.utils.book_append_sheet(wb, ws, 'Analyse & Projections');
}

function buildMarchesReportExcel(data) {
  const summary = computeSummary(data);
  const detail = computeDetail(data);
  const evolution = computeEvolution(data);
  const alerts = computeAlerts(detail);
  const analysis = computeAnalysis(data, detail);
  const monthLabel = data.moisFull[data.selMois] || '';

  const wb = XLSX.utils.book_new();
  buildMarchesCoverSheetXL(wb, monthLabel);
  buildMarchesSynthSheetXL(wb, summary, monthLabel);
  buildMarchesVueGlobaleSheetXL(wb, data, evolution);
  buildMarchesDetailSheetXL(wb, detail, monthLabel);
  buildMarchesEvolutionSheetXL(wb, data, evolution);
  buildMarchesBudgetSheetXL(wb, data, monthLabel);
  buildMarchesAnalyseSheetXL(wb, analysis, monthLabel);
  buildMarchesAlertsSheetXL(wb, alerts);
  return wb;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports.buildMarchesReportExcel = buildMarchesReportExcel;
}

if (typeof window !== 'undefined') {
  window.__buildMarchesReportExcel = buildMarchesReportExcel;

  function _mrcXlBtnState(btn, loading) {
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

  window.genererRapportMarchesExcel = function genererRapportMarchesExcel(evt) {
    const btn = evt && evt.target ? evt.target.closest('button') : null;
    try {
      _mrcXlBtnState(btn, true);
      if (typeof XLSX === 'undefined') {
        alert('La librairie Excel (SheetJS) n\'est pas chargée.');
        return;
      }
      if (typeof window.mrcGetReportData !== 'function') {
        alert('Le module Suivi des Marchés n\'est pas encore chargé. Ouvrez d\'abord l\'onglet "Suivi des Marchés".');
        return;
      }
      const data = window.mrcGetReportData();
      const wb = buildMarchesReportExcel(data);
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, 'Rapport_Marches_DRT_Sfax_' + today + '.xlsx');
    } catch (err) {
      console.error('[MarchesRapport] Erreur génération Excel:', err);
      alert('Erreur lors de la génération du rapport Excel : ' + (err && err.message ? err.message : err));
    } finally {
      _mrcXlBtnState(btn, false);
    }
  };
}

})();
