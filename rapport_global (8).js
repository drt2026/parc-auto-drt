/**
 * ============================================================
 *  RAPPORT_GLOBAL.JS — Rapport consolidé 1 clic — DRT Sfax
 *  Combine : Carburant, Marchés, Véhicules, Réparations,
 *            Sinistres, Stock Pneus
 *  → génère 1 fichier PPTX + 1 fichier Excel, tous deux stylés
 *    avec l'identité visuelle DRT Sfax déjà utilisée dans les
 *    autres rapports (fuel_rapport.js, marches_rapport.js,
 *    repair_rapport.js).
 *  100% additif : ne lit que des données déjà exposées par les
 *  autres modules (aucune fonction existante modifiée).
 *  À inclure APRÈS fuel_rapport.js / marches_rapport.js /
 *  repair_rapport.js / stock_pneus.js :
 *  <script src="rapport_global.js"></script>
 * ============================================================
 */
(function () {
  'use strict';

  /* ── Palette identique aux autres rapports ── */
  const COLORS = {
    navy: '1E3A5F', midnight: '0F172A', ink: '1E293B', slate: '64748B',
    mist: 'E2E8F0', paper: 'FFFFFF', bg: 'F8FAFC',
    teal: '0EA5B7', tealSoft: 'CFF3F6',
    amber: 'F59E0B', amberSoft: 'FEF3C7',
    green: '10B981', greenSoft: 'D1FAE5',
    orange: 'EF6C00',
    red: 'EF4444', redSoft: 'FEE2E2',
  };

  function fmt(n, dec) { return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); }
  function esc(s) { return (s === undefined || s === null) ? '' : String(s); }

  /* ══════════════════════════════════════════════════════════
   *  COLLECTE DES DONNÉES (lecture seule, aucune modification)
   * ══════════════════════════════════════════════════════════ */

  function currentYearStr() { return String(new Date().getFullYear()); }

  function gatherFuel() {
    try {
      const allData = (typeof getFuelData === 'function') ? getFuelData() : {};
      const years = Object.keys(allData).map(k => k.slice(0, 4)).filter((v, i, a) => a.indexOf(v) === i).sort();
      if (!years.length) return { available: false };
      const year = years.includes(currentYearStr()) ? currentYearStr() : years[years.length - 1];
      const byVehicle = {};
      let totalLitres = 0, totalMontant = 0, totalKm = 0;
      Object.keys(allData).forEach(monthKey => {
        if (monthKey.indexOf(year) !== 0) return;
        Object.values(allData[monthKey]).forEach(e => {
          totalLitres += e.litres || 0; totalMontant += e.montant || 0; totalKm += e.km || 0;
          if (!byVehicle[e.matricule]) byVehicle[e.matricule] = { matricule: e.matricule, chauffeur: e.chauffeur, montant: 0, litres: 0 };
          byVehicle[e.matricule].montant += e.montant || 0;
          byVehicle[e.matricule].litres += e.litres || 0;
          byVehicle[e.matricule].chauffeur = e.chauffeur || byVehicle[e.matricule].chauffeur;
        });
      });
      const list = Object.values(byVehicle).sort((a, b) => b.montant - a.montant);
      return { available: list.length > 0, year, totalLitres, totalMontant, totalKm, vehicleCount: list.length, top5: list.slice(0, 5) };
    } catch (e) { return { available: false }; }
  }

  function gatherMarches() {
    try {
      if (typeof window.mrcGetReportData !== 'function') return { available: false, notLoaded: true };
      const data = window.mrcGetReportData();
      const fournisseurs = data.fournisseurs || [];
      if (!fournisseurs.length) return { available: false, notLoaded: true };
      const rows = fournisseurs.map(f => {
        const taux = (data.mois || []).map((_, m) => data.getT(f.id, m));
        const avg = taux.length ? taux.reduce((a, b) => a + b, 0) / taux.length : 0;
        const consomme = Math.round((f.budget || 0) * avg / 100);
        return { nom: f.nom, budget: f.budget || 0, avg, consomme, reste: (f.budget || 0) - consomme };
      });
      const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
      const totalConsomme = rows.reduce((s, r) => s + r.consomme, 0);
      return { available: true, rows, totalBudget, totalConsomme, count: rows.length };
    } catch (e) { return { available: false, notLoaded: true }; }
  }

  function gatherVehicules() {
    try {
      const pa = window.parcAuto;
      let list = [];
      if (pa && pa.data) {
        if (Array.isArray(pa.data.vehicles) && pa.data.vehicles.length) list = pa.data.vehicles;
        else if (Array.isArray(pa.data.vehicules) && pa.data.vehicules.length) list = pa.data.vehicules;
      }
      const byMarque = {};
      list.forEach(v => {
        const key = v.marque || v.modele || 'Non renseigné';
        byMarque[key] = (byMarque[key] || 0) + 1;
      });
      const marqueList = Object.entries(byMarque).map(([marque, count]) => ({ marque, count })).sort((a, b) => b.count - a.count);
      return { available: list.length > 0, count: list.length, list, byMarque: marqueList };
    } catch (e) { return { available: false, count: 0, list: [], byMarque: [] }; }
  }

  function gatherReparations() {
    try {
      const raw = JSON.parse(localStorage.getItem('parcAutoRepairHist_v1') || '{}');
      const years = Object.keys(raw);
      if (!years.length) return { available: false };
      const year = years.includes(currentYearStr()) ? currentYearStr() : years.sort()[years.length - 1];
      const entries = Object.values(raw[year] || {});
      const total = entries.reduce((s, e) => s + (e.montant || 0), 0);
      const top5 = entries.slice().sort((a, b) => (b.montant || 0) - (a.montant || 0)).slice(0, 5);
      return { available: entries.length > 0, year, total, count: entries.length, top5 };
    } catch (e) { return { available: false }; }
  }

  function gatherSinistres() {
    try {
      const list = JSON.parse(localStorage.getItem('parcAutoSinistres_v1') || '[]');
      const totalDegats = list.reduce((s, e) => s + (Number(e.montantDegats) || 0), 0);
      const totalRembourse = list.reduce((s, e) => s + (Number(e.montantRembourse) || 0), 0);
      const enCours = list.filter(e => e.statut && String(e.statut).toLowerCase().indexOf('cours') !== -1).length;
      const recent = list.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8);
      return { available: list.length > 0, list, recent, count: list.length, totalDegats, totalRembourse, enCours };
    } catch (e) { return { available: false, list: [], recent: [], count: 0 }; }
  }

  function gatherStockPneus() {
    try {
      const pa = window.parcAuto;
      const sp = (pa && pa.data && pa.data.stockPneus) ? pa.data.stockPneus : { references: [], mouvements: [] };
      const refs = sp.references || [];
      const mvts = sp.mouvements || [];
      const alertes = refs.filter(r => typeof r.seuilAlerte === 'number' && r.seuilAlerte > 0).length;
      return { available: refs.length > 0, refs, mouvementsCount: mvts.length, count: refs.length, alertes };
    } catch (e) { return { available: false, refs: [], count: 0, mouvementsCount: 0, alertes: 0 }; }
  }

  // BLOC ADDITIF — Groupes Électrogènes (lit window.getGEData() / __geCompute()
  // exposés par groupe_electrogene.js ; purement additif, aucune lecture directe
  // du Gist ni de localStorage).
  const GE_TARIF_GAZOIL = 1.985; // DT/L — même tarif que le Suivi Carburant véhicules
  function gatherGE() {
    try {
      const list = (typeof window.getGEData === 'function') ? window.getGEData() : [];
      const compute = (typeof window.__geCompute === 'function') ? window.__geCompute : null;
      if (!list.length) return { available: false };
      let totalLitres = 0;
      const bySite = {};
      list.forEach(e => {
        const c = compute ? compute(e) : { consMois: (e.nbrH || 0) * (e.consH || 0) };
        const litres = c.consMois || 0;
        totalLitres += litres;
        if (!bySite[e.site]) bySite[e.site] = { site: e.site, litres: 0 };
        bySite[e.site].litres += litres;
      });
      const rows = Object.values(bySite).sort((a, b) => b.litres - a.litres);
      const sitesCount = (typeof window.__GE_SITES !== 'undefined' && window.__GE_SITES) ? window.__GE_SITES.length : rows.length;
      return { available: true, totalLitres, totalCout: totalLitres * GE_TARIF_GAZOIL, sitesCount, top5: rows.slice(0, 5) };
    } catch (e) { return { available: false }; }
  }

  function gatherAll() {
    return {
      fuel: gatherFuel(),
      marches: gatherMarches(),
      vehicules: gatherVehicules(),
      reparations: gatherReparations(),
      sinistres: gatherSinistres(),
      pneus: gatherStockPneus(),
      ge: gatherGE(),
    };
  }

  /* ══════════════════════════════════════════════════════════
   *  CHARGEMENT PptxGenJS (mêmes miroirs CDN que les autres modules)
   * ══════════════════════════════════════════════════════════ */

  const PPTX_CDN = [
    'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
    'https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
  ];
  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error('Échec chargement ' + src));
      document.head.appendChild(s);
    });
  }
  async function _loadPptxGenJsGlobal() {
    if (window.PptxGenJS) return window.PptxGenJS;
    let lastErr = null;
    for (const url of PPTX_CDN) {
      try { await _loadScript(url); if (window.PptxGenJS) return window.PptxGenJS; }
      catch (e) { lastErr = e; }
    }
    throw new Error('Impossible de charger PptxGenJS (tous les miroirs CDN ont échoué). ' + (lastErr ? lastErr.message : ''));
  }

  /* ══════════════════════════════════════════════════════════
   *  CONSTRUCTION DU PPTX GLOBAL
   * ══════════════════════════════════════════════════════════ */

  function addOverviewSlide(pres, opts) {
    // opts = { icon, title, subtitle, cards:[{big,label,color,soft}], tableHeaders, tableRows, colW, emptyMsg }
    const s = pres.addSlide();
    s.background = { color: COLORS.bg };
    s.addText(`${opts.icon}  ${opts.title}`, { x: 0.6, y: 0.4, w: 11, h: 0.6, fontSize: 26, bold: true, color: COLORS.ink, fontFace: 'Cambria' });
    s.addText(opts.subtitle || '', { x: 0.6, y: 0.95, w: 11.5, h: 0.4, fontSize: 12.5, color: COLORS.slate, fontFace: 'Calibri' });

    const cards = opts.cards || [];
    const gx = 0.6, gy = 1.55, gw = (13.33 - 1.2 - 2 * 0.3) / 3, gh = 1.25, gapX = 0.3;
    cards.forEach((c, i) => {
      const x = gx + i * (gw + gapX);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: gy, w: gw, h: gh, rectRadius: 0.08, fill: { color: COLORS.paper },
        shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 90, opacity: 0.08 } });
      s.addText(c.big, { x: x + 0.2, y: gy + 0.18, w: gw - 0.4, h: 0.55, fontSize: 22, bold: true, color: c.color || COLORS.navy, fontFace: 'Cambria', margin: 0 });
      s.addText(c.label, { x: x + 0.2, y: gy + 0.75, w: gw - 0.4, h: 0.4, fontSize: 11, color: COLORS.slate, fontFace: 'Calibri', margin: 0 });
    });

    if (opts.tableRows && opts.tableRows.length) {
      const headerRow = (opts.tableHeaders || []).map(h => ({
        text: h, options: { bold: true, color: COLORS.paper, fill: { color: COLORS.navy }, fontSize: 10 }
      }));
      const rows = [headerRow];
      opts.tableRows.forEach((r, i) => {
        const fillC = i % 2 === 0 ? COLORS.paper : COLORS.bg;
        rows.push(r.map((cell, ci) => ({
          text: String(cell), options: { fill: { color: fillC }, fontSize: 9.5, color: ci === 0 ? COLORS.ink : COLORS.slate, bold: ci === 0 }
        })));
      });
      s.addTable(rows, { x: 0.6, y: 3.05, w: 12.15, colW: opts.colW, border: { pt: 0.5, color: COLORS.mist }, valign: 'middle', rowH: 0.4 });
    } else {
      s.addText(opts.emptyMsg || 'Aucune donnée disponible.', { x: 0.6, y: 3.3, w: 10, h: 0.6, fontSize: 14, color: COLORS.slate, fontFace: 'Calibri' });
    }
  }

  function buildGlobalReportPptx(PptxGenJSCtor, data, meta) {
    meta = meta || {};
    const pres = new PptxGenJSCtor();
    pres.layout = 'LAYOUT_WIDE';
    pres.author = 'Parc Auto DRT Sfax';
    pres.title = 'Rapport Global — DRT Sfax';

    /* ---- Slide 1 : Couverture ---- */
    {
      const s = pres.addSlide();
      s.background = { color: COLORS.midnight };
      s.addShape(pres.shapes.OVAL, { x: 9.6, y: -2.2, w: 6, h: 6, fill: { color: COLORS.navy }, line: { type: 'none' } });
      s.addShape(pres.shapes.OVAL, { x: 10.6, y: 4.6, w: 4.2, h: 4.2, fill: { color: COLORS.orange, transparency: 84 }, line: { type: 'none' } });

      s.addText('📦', { x: 0.7, y: 0.75, w: 1.2, h: 1.2, fontSize: 44, align: 'left', valign: 'middle' });
      s.addText('PARC AUTO — DRT SFAX', { x: 0.7, y: 1.75, w: 9, h: 0.5, fontSize: 14, color: COLORS.teal, bold: true, charSpacing: 3, fontFace: 'Calibri' });
      s.addText('Rapport Global', { x: 0.65, y: 2.25, w: 11, h: 1.3, fontSize: 48, color: COLORS.paper, bold: true, fontFace: 'Cambria' });
      s.addText('Carburant · Marchés · Véhicules · Réparations · Sinistres · Stock Pneus', { x: 0.7, y: 3.45, w: 11.5, h: 0.55, fontSize: 15.5, color: 'CBD5E1', fontFace: 'Calibri' });
      s.addShape(pres.shapes.LINE, { x: 0.7, y: 4.25, w: 3.2, h: 0, line: { color: COLORS.teal, width: 2 } });

      const modulesOK = Object.values(data).filter(d => d.available).length;
      const chips = [
        [`${modulesOK} / 6`, 'modules avec données'],
        [`${data.vehicules.count || 0}`, 'véhicules au parc'],
        [`${new Date().toLocaleDateString('fr-FR')}`, 'date de génération'],
      ];
      let cx = 0.7;
      chips.forEach(([big, small]) => {
        s.addText([
          { text: big + '  ', options: { fontSize: 20, bold: true, color: COLORS.paper, breakLine: false } },
          { text: small, options: { fontSize: 12, color: '94A3B8' } }
        ], { x: cx, y: 4.6, w: 3.6, h: 0.5, fontFace: 'Calibri' });
        cx += 3.6;
      });

      s.addText(`Généré le ${meta.generatedOn || new Date().toLocaleDateString('fr-FR')} — Chef de Parc : Hamdi Ben Aouicha`,
        { x: 0.7, y: 6.9, w: 10, h: 0.35, fontSize: 10.5, color: '64748B', fontFace: 'Calibri' });
    }

    /* ---- Slide 2 : Carburant ---- */
    {
      const f = data.fuel;
      addOverviewSlide(pres, {
        icon: '⛽', title: 'Suivi Carburant', subtitle: f.available ? `Exercice ${f.year} — ${f.vehicleCount} véhicules suivis` : 'Aucune donnée carburant importée',
        cards: f.available ? [
          { big: `${fmt(f.totalLitres)} L`, label: 'Litres ravitaillés', color: COLORS.teal },
          { big: `${fmt(f.totalMontant)} DT`, label: 'Dépense totale', color: COLORS.green },
          { big: `${fmt(f.totalKm)} km`, label: 'Km parcourus', color: COLORS.navy },
        ] : [],
        tableHeaders: ['Matricule', 'Chauffeur', 'Litres', 'Montant (DT)'],
        tableRows: f.available ? f.top5.map(v => [v.matricule, v.chauffeur || '—', fmt(v.litres) + ' L', fmt(v.montant) + ' DT']) : null,
        colW: [3, 5, 2.15, 2],
      });
    }

    /* ---- Slide 3 : Marchés ---- */
    {
      const m = data.marches;
      addOverviewSlide(pres, {
        icon: '📑', title: 'Suivi des Marchés', subtitle: m.available ? `${m.count} fournisseurs suivis` : (m.notLoaded ? 'Ouvrez l\'onglet "Suivi des Marchés" avant de générer ce rapport pour inclure ces données' : 'Aucune donnée de marché disponible'),
        cards: m.available ? [
          { big: `${fmt(m.totalBudget)} DT`, label: 'Budget total', color: COLORS.navy },
          { big: `${fmt(m.totalConsomme)} DT`, label: 'Consommé', color: COLORS.orange },
          { big: `${fmt(m.totalBudget - m.totalConsomme)} DT`, label: 'Reste', color: COLORS.green },
        ] : [],
        tableHeaders: ['Fournisseur', 'Budget (DT)', 'Taux moy.', 'Consommé (DT)'],
        tableRows: m.available ? m.rows.slice(0, 8).map(r => [r.nom, fmt(r.budget), r.avg.toFixed(1) + '%', fmt(r.consomme)]) : null,
        colW: [4.5, 2.65, 2.5, 2.5],
      });
    }

    /* ---- Slide 4 : Véhicules ---- */
    {
      const v = data.vehicules;
      addOverviewSlide(pres, {
        icon: '🚗', title: 'Parc Véhicules', subtitle: v.available ? `${v.count} véhicules au parc DRT Sfax` : 'Aucune donnée véhicule disponible',
        cards: v.available ? [
          { big: `${v.count}`, label: 'Véhicules au total', color: COLORS.navy },
          { big: `${v.byMarque.length}`, label: 'Marques / modèles différents', color: COLORS.teal },
          { big: v.byMarque[0] ? v.byMarque[0].marque : '—', label: 'Marque la plus représentée', color: COLORS.amber },
        ] : [],
        tableHeaders: ['Marque / Modèle', 'Nb véhicules'],
        tableRows: v.available ? v.byMarque.slice(0, 8).map(r => [r.marque, r.count]) : null,
        colW: [9.15, 3],
      });
    }

    /* ---- Slide 5 : Réparations ---- */
    {
      const r = data.reparations;
      addOverviewSlide(pres, {
        icon: '🔧', title: 'Réparations', subtitle: r.available ? `Exercice ${r.year} — ${r.count} véhicules concernés` : 'Aucune donnée de réparation importée',
        cards: r.available ? [
          { big: `${fmt(r.total)} DT`, label: 'Dépense totale', color: COLORS.orange },
          { big: `${r.count}`, label: 'Véhicules concernés', color: COLORS.navy },
          { big: `${fmt(r.count ? r.total / r.count : 0)} DT`, label: 'Moyenne / véhicule', color: COLORS.teal },
        ] : [],
        tableHeaders: ['Matricule', 'Chauffeur', 'Marque', 'Montant (DT)'],
        tableRows: r.available ? r.top5.map(e => [e.matricule || '—', e.chauffeur || '—', e.marque || '—', fmt(e.montant)]) : null,
        colW: [3, 4, 3, 2.15],
      });
    }

    /* ---- Slide 6 : Sinistres ---- */
    {
      const si = data.sinistres;
      addOverviewSlide(pres, {
        icon: '🚨', title: 'Dossier Sinistre', subtitle: si.available ? `${si.count} dossiers enregistrés` : 'Aucun dossier sinistre enregistré',
        cards: si.available ? [
          { big: `${si.count}`, label: 'Dossiers au total', color: COLORS.navy },
          { big: `${si.enCours}`, label: 'En cours', color: COLORS.amber },
          { big: `${fmt(si.totalDegats)} DT`, label: 'Montant total des dégâts', color: COLORS.red },
        ] : [],
        tableHeaders: ['Date', 'Matricule', 'Compagnie', 'Statut'],
        tableRows: si.available ? si.recent.slice(0, 8).map(e => [e.date || '—', e.matricule || '—', e.compagnie || '—', e.statut || '—']) : null,
        colW: [2.65, 3, 3.5, 3],
      });
    }

    /* ---- Slide 7 : Stock Pneus ---- */
    {
      const p = data.pneus;
      addOverviewSlide(pres, {
        icon: '🛞', title: 'Stock Pneus', subtitle: p.available ? `${p.count} références suivies` : 'Aucune référence de stock enregistrée',
        cards: p.available ? [
          { big: `${p.count}`, label: 'Références en stock', color: COLORS.navy },
          { big: `${p.mouvementsCount}`, label: 'Mouvements enregistrés', color: COLORS.teal },
          { big: `${p.alertes}`, label: 'Seuils d\'alerte définis', color: COLORS.amber },
        ] : [],
        tableHeaders: ['Dimension', 'Marque', 'Seuil alerte'],
        tableRows: p.available ? p.refs.slice(0, 8).map(r => [r.dimension || '—', r.marque || '—', r.seuilAlerte || 0]) : null,
        colW: [6, 4.65, 1.5],
      });
    }

    /* ---- Slide 8 : Groupes Électrogènes (BLOC ADDITIF) ---- */
    {
      const ge = data.ge;
      addOverviewSlide(pres, {
        icon: '🔌', title: 'Groupes Électrogènes', subtitle: ge.available ? `${ge.sitesCount} sites suivis` : 'Aucune donnée GE saisie',
        cards: ge.available ? [
          { big: `${fmt(ge.totalLitres)} L`, label: 'Gazoil consommé', color: COLORS.amber },
          { big: `${fmt(ge.totalCout)} DT`, label: 'Coût estimé', color: COLORS.orange },
          { big: `${ge.sitesCount}`, label: 'Sites équipés', color: COLORS.navy },
        ] : [],
        tableHeaders: ['Site', 'Gazoil (L)'],
        tableRows: ge.available ? ge.top5.map(r => [r.site, fmt(r.litres) + ' L']) : null,
        colW: [9.15, 3],
      });
    }

    /* ---- Slide finale : signature ---- */
    {
      const s = pres.addSlide();
      s.background = { color: COLORS.midnight };
      s.addText('Rapport Global — Parc Auto DRT Sfax', { x: 0.7, y: 2.7, w: 11.5, h: 0.7, fontSize: 26, bold: true, color: COLORS.paper, fontFace: 'Cambria' });
      s.addShape(pres.shapes.LINE, { x: 0.7, y: 3.45, w: 3.2, h: 0, line: { color: COLORS.teal, width: 2 } });
      s.addText('Chef de Parc : Hamdi Ben Aouicha', { x: 0.7, y: 3.65, w: 8, h: 0.4, fontSize: 15, color: '94A3B8', fontFace: 'Calibri' });
      s.addText(`Document généré automatiquement le ${meta.generatedOn || new Date().toLocaleDateString('fr-FR')}`,
        { x: 0.7, y: 4.1, w: 9, h: 0.35, fontSize: 11, color: '64748B', fontFace: 'Calibri' });
    }

    return pres;
  }

  /* ══════════════════════════════════════════════════════════
   *  CONSTRUCTION DE L'EXCEL GLOBAL (ExcelJS — mêmes couleurs que
   *  window.ttExportStyledExcel)
   * ══════════════════════════════════════════════════════════ */

  const TT_NAVY = 'FF1E3A5F', TT_ORANGE = 'FFEF6C00', TT_BAND = 'FFF1F5F9', TT_WHITE = 'FFFFFFFF';

  function addStyledSheet(wb, opts) {
    // opts = { sheetName, title, headers, rows, colWidths }
    const ws = wb.addWorksheet(opts.sheetName);
    const nCols = (opts.headers || []).length || 1;

    ws.mergeCells(1, 1, 1, nCols);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = opts.title || '';
    titleCell.font = { bold: true, color: { argb: TT_WHITE }, size: 13 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TT_NAVY } };
    ws.getRow(1).height = 28;

    const headerRow = ws.getRow(2);
    (opts.headers || []).forEach((h, i) => {
      const c = headerRow.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: TT_WHITE }, size: 10 };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TT_ORANGE } };
      c.border = { top: { style: 'thin', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }, left: { style: 'thin', color: { argb: 'FFCCCCCC' } }, right: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
    });
    headerRow.height = 22;

    (opts.rows || []).forEach((row, idx) => {
      const r = ws.getRow(3 + idx);
      row.forEach((val, ci) => {
        const c = r.getCell(ci + 1);
        c.value = val;
        c.font = { size: 9 };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.border = { top: { style: 'thin', color: { argb: 'FFE0E0E0' } }, bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }, left: { style: 'thin', color: { argb: 'FFE0E0E0' } }, right: { style: 'thin', color: { argb: 'FFE0E0E0' } } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: (idx % 2 === 0) ? TT_WHITE : TT_BAND } };
      });
    });

    (opts.colWidths || []).forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    if ((opts.rows || []).length) ws.views = [{ state: 'frozen', ySplit: 2 }];
    return ws;
  }

  async function buildGlobalReportExcel(data) {
    if (typeof ExcelJS === 'undefined') throw new Error('Librairie ExcelJS non disponible.');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Hamdi Ben Aouicha — Chef de Parc — DRT Sfax';
    const today = new Date().toLocaleDateString('fr-FR');

    /* ---- Sommaire ---- */
    {
      const ws = wb.addWorksheet('Sommaire');
      ws.mergeCells(1, 1, 1, 3);
      const t = ws.getCell(1, 1);
      t.value = 'DIRECTION RÉGIONALE DES TÉLÉCOMMUNICATIONS DE SFAX — RAPPORT GLOBAL PARC AUTO';
      t.font = { bold: true, color: { argb: TT_WHITE }, size: 13 };
      t.alignment = { horizontal: 'center', vertical: 'middle' };
      t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TT_NAVY } };
      ws.getRow(1).height = 30;

      const infos = [
        ['Chef de Parc', 'Hamdi Ben Aouicha'],
        ['Généré le', today],
        ['Véhicules au parc', data.vehicules.count || 0],
        ['Carburant', data.fuel.available ? `Exercice ${data.fuel.year} — ${fmt(data.fuel.totalMontant)} DT` : 'Aucune donnée'],
        ['Marchés', data.marches.available ? `${data.marches.count} fournisseurs` : 'Aucune donnée'],
        ['Réparations', data.reparations.available ? `Exercice ${data.reparations.year} — ${fmt(data.reparations.total)} DT` : 'Aucune donnée'],
        ['Sinistres', data.sinistres.available ? `${data.sinistres.count} dossiers` : 'Aucun dossier'],
        ['Stock Pneus', data.pneus.available ? `${data.pneus.count} références` : 'Aucune donnée'],
        ['Groupes Électrogènes', data.ge.available ? `${fmt(data.ge.totalLitres)} L — ${fmt(data.ge.totalCout)} DT` : 'Aucune donnée'],
      ];
      infos.forEach((row, idx) => {
        const r = ws.getRow(3 + idx);
        r.getCell(1).value = row[0];
        r.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1E293B' } };
        r.getCell(2).value = row[1];
        r.getCell(2).font = { size: 10 };
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
      ws.getColumn(1).width = 24; ws.getColumn(2).width = 40;
    }

    /* ---- Carburant ---- */
    {
      const f = data.fuel;
      addStyledSheet(wb, {
        sheetName: 'Carburant',
        title: f.available ? `SUIVI CARBURANT — EXERCICE ${f.year}` : 'SUIVI CARBURANT — AUCUNE DONNÉE',
        headers: ['Rang', 'Matricule', 'Chauffeur', 'Litres', 'Montant (DT)'],
        rows: f.available ? f.top5.map((v, i) => [i + 1, v.matricule, v.chauffeur || '—', +v.litres.toFixed(2), +v.montant.toFixed(2)]) : [],
        colWidths: [8, 16, 24, 12, 16],
      });
    }

    /* ---- Marchés ---- */
    {
      const m = data.marches;
      addStyledSheet(wb, {
        sheetName: 'Marchés',
        title: m.available ? 'SUIVI DES MARCHÉS' : 'SUIVI DES MARCHÉS — AUCUNE DONNÉE',
        headers: ['Fournisseur', 'Budget (DT)', 'Taux moyen (%)', 'Consommé (DT)', 'Reste (DT)'],
        rows: m.available ? m.rows.map(r => [r.nom, +r.budget.toFixed(2), +r.avg.toFixed(1), +r.consomme.toFixed(2), +r.reste.toFixed(2)]) : [],
        colWidths: [26, 14, 14, 16, 14],
      });
    }

    /* ---- Véhicules ---- */
    {
      const v = data.vehicules;
      addStyledSheet(wb, {
        sheetName: 'Véhicules',
        title: v.available ? `PARC VÉHICULES — ${v.count} VÉHICULES` : 'PARC VÉHICULES — AUCUNE DONNÉE',
        headers: ['Matricule', 'Marque / Modèle', 'Chauffeur', 'Division', 'KM'],
        rows: v.available ? v.list.map(x => [x.matricule || x.immat || '—', x.marque || x.modele || '—', x.chauffeur || '—', x.division || '—', x.km || 0]) : [],
        colWidths: [16, 22, 24, 18, 12],
      });
    }

    /* ---- Réparations ---- */
    {
      const r = data.reparations;
      addStyledSheet(wb, {
        sheetName: 'Réparations',
        title: r.available ? `RÉPARATIONS — EXERCICE ${r.year}` : 'RÉPARATIONS — AUCUNE DONNÉE',
        headers: ['Matricule', 'Chauffeur', 'Marque', 'Division', 'Montant (DT)'],
        rows: r.available ? r.top5.map(e => [e.matricule || '—', e.chauffeur || '—', e.marque || '—', e.division || '—', +(e.montant || 0).toFixed(2)]) : [],
        colWidths: [16, 22, 18, 18, 16],
      });
    }

    /* ---- Sinistres ---- */
    {
      const si = data.sinistres;
      addStyledSheet(wb, {
        sheetName: 'Sinistres',
        title: si.available ? 'DOSSIERS SINISTRE' : 'DOSSIERS SINISTRE — AUCUNE DONNÉE',
        headers: ['Date', 'Matricule', 'Chauffeur', 'Compagnie', 'Montant dégâts (DT)', 'Montant remboursé (DT)', 'Statut'],
        rows: si.available ? si.list.map(e => [e.date || '—', e.matricule || '—', e.chauffeur || '—', e.compagnie || '—', +(Number(e.montantDegats) || 0).toFixed(2), +(Number(e.montantRembourse) || 0).toFixed(2), e.statut || '—']) : [],
        colWidths: [14, 16, 22, 18, 18, 20, 16],
      });
    }

    /* ---- Stock Pneus ---- */
    {
      const p = data.pneus;
      addStyledSheet(wb, {
        sheetName: 'Stock Pneus',
        title: p.available ? 'STOCK PNEUS — RÉFÉRENCES' : 'STOCK PNEUS — AUCUNE DONNÉE',
        headers: ['Dimension', 'Marque', 'Seuil alerte', 'Prix unitaire (DT)'],
        rows: p.available ? p.refs.map(r => [r.dimension || '—', r.marque || '—', r.seuilAlerte || 0, r.prixUnitaireDefaut || 0]) : [],
        colWidths: [18, 18, 14, 18],
      });
    }

    /* ---- Groupes Électrogènes (BLOC ADDITIF) ---- */
    {
      const ge = data.ge;
      addStyledSheet(wb, {
        sheetName: 'Groupes Électrogènes',
        title: ge.available ? 'GROUPES ÉLECTROGÈNES — GAZOIL' : 'GROUPES ÉLECTROGÈNES — AUCUNE DONNÉE',
        headers: ['Site', 'Gazoil consommé (L)'],
        rows: ge.available ? ge.top5.map(r => [r.site, +r.litres.toFixed(2)]) : [],
        colWidths: [26, 20],
      });
    }

    return wb;
  }

  /* ══════════════════════════════════════════════════════════
   *  BOUTON — 1 clic → PPTX + Excel
   * ══════════════════════════════════════════════════════════ */

  function _btnState(btn, loading) {
    if (!btn) return;
    if (loading) { btn.dataset.originalLabel = btn.dataset.originalLabel || btn.innerHTML; btn.innerHTML = '⏳ Génération en cours...'; btn.disabled = true; }
    else { if (btn.dataset.originalLabel) btn.innerHTML = btn.dataset.originalLabel; btn.disabled = false; }
  }

  window.genererRapportGlobal = async function genererRapportGlobal(evt) {
    const btn = evt && evt.target ? evt.target.closest('button') : null;
    try {
      _btnState(btn, true);

      if (typeof ExcelJS === 'undefined') { alert('Librairie ExcelJS non disponible — vérifiez votre connexion.'); return; }

      const data = gatherAll();
      const anyAvailable = Object.values(data).some(d => d.available);
      if (!anyAvailable) {
        alert('Aucune donnée disponible dans aucun module (Carburant, Marchés, Véhicules, Réparations, Sinistres, Stock Pneus). Importez au moins un module avant de générer le rapport.');
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const meta = { generatedOn: new Date().toLocaleDateString('fr-FR') };

      // 1) Excel
      const wb = await buildGlobalReportExcel(data);
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Rapport_Global_DRT_Sfax_${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      // 2) PPTX
      const PptxCtor = await _loadPptxGenJsGlobal();
      const pres = buildGlobalReportPptx(PptxCtor, data, meta);
      await pres.writeFile({ fileName: `Rapport_Global_DRT_Sfax_${today}.pptx` });

    } catch (err) {
      console.error('[RapportGlobal] Erreur génération :', err);
      alert('Erreur lors de la génération du rapport global : ' + (err && err.message ? err.message : err));
    } finally {
      _btnState(btn, false);
    }
  };

})();
