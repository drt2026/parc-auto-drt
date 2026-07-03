/* ============================================================
   MOTEUR DE GENERATION — RAPPORT SUIVI DES MARCHES (PPTX)
   Fonctionne à l'identique en Node (tests) et dans le navigateur
   (admin.html), à partir des données exposées par mrcGetReportData().
   ============================================================ */

const DRT_KIT = (typeof require !== 'undefined') ? require('./drt-premium-kit.js') : (typeof window !== 'undefined' ? window.DRT_KIT : null);

const COLORS = {
  navy:      '132C4C',
  midnight:  '0B1526',
  ink:       '1C2536',
  slate:     '5B6B82',
  mist:      'E4E9F0',
  paper:     'FFFFFF',
  bg:        'F7F9FC',
  orange:    'C97A1A',
  orangeSoft:'FBEBD6',
  green:     '178A5F',
  greenSoft: 'DCF3E8',
  red:       'C13A3A',
  redSoft:   'FBE4E4',
  teal:      '0E8FA0',
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
    DRT_KIT.titleSlide({
      pres, icon: '📑', kicker: 'Suivi des marchés — DRT Sfax', title: 'Rapport Marchés',
      subtitle: `Situation au ${monthLabel} 2026 — Garage DRT Sfax`,
      accentColor: COLORS.orange, accentSoftColor: COLORS.orangeSoft,
      chips: [
        [`${summary.nbMarches}`, 'marchés suivis'],
        [`${fmt(summary.budgetTotal/1000,0)} kDT`, 'budget total'],
        [`${summary.tauxMoyen.toFixed(1)} %`, 'taux moyen'],
      ],
      signature: `Généré le ${meta.generatedOn || new Date().toLocaleDateString('fr-FR')} — Chef de Parc : Hamdi Ben Aouicha`,
    });
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
    DRT_KIT.footer(pres, s, { wordmark: 'DRT SFAX · MARCHÉS', accentColor: COLORS.orange, dark: false });
  }

  /* ============ SLIDE 3 — EVOLUTION DES TAUX ============ */
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
    DRT_KIT.footer(pres, s, { wordmark: 'DRT SFAX · MARCHÉS', accentColor: COLORS.orange, dark: false });
  }

  /* ============ SLIDE 4 — REPARTITION BUDGETAIRE ============ */
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
    DRT_KIT.footer(pres, s, { wordmark: 'DRT SFAX · MARCHÉS', accentColor: COLORS.orange, dark: false });
  }

  /* ============ SLIDE 5 — POINTS D'ATTENTION ============ */
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
    DRT_KIT.footer(pres, s, { wordmark: 'DRT SFAX · MARCHÉS', accentColor: COLORS.orange, dark: true });
  }

  return pres;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildMarchesReportPptx, computeSummary, computeDetail, computeEvolution, computeAlerts, COLORS };
}

/* ============================================================
   INTEGRATION NAVIGATEUR — bouton "Générer Rapport" (Suivi des Marchés)
   Purement additif : n'altère aucune fonction existante.
   ============================================================ */
if (typeof window !== 'undefined') {
  window.__buildMarchesReportPptx = buildMarchesReportPptx;

  const PPTXGENJS_CDN = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgenjs.bundle.js';

  function _loadPptxGenJsMrc() {
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
