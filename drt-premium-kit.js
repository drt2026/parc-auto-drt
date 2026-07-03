/* ============================================================
   DRT-PREMIUM-KIT.JS — Design system partagé
   Carburant · Réparations · Suivi des Marchés — DRT Sfax

   Un seul fichier de vérité pour la palette et les composants
   visuels réutilisés par fuel_rapport.js, marches_rapport.js,
   repair_rapport.js (PPTX) et ttExportStyledExcel (Excel).
   À charger AVANT les 3 fichiers *_rapport.js dans admin.html :
     <script src="drt-premium-kit.js"></script>
     <script src="fuel_rapport.js"></script>
     ...
   Module UMD minimal (Node pour les tests, window pour le navigateur).
   ============================================================ */
(function (root, factory) {
  const kit = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = kit;
  if (typeof window !== 'undefined') window.DRT_KIT = kit;
})(this, function () {
  'use strict';

  /* ---------- Palette premium (dérivée de l'identité existante, affinée) ---------- */
  const PALETTE = {
    navy:      '132C4C',   // était 1E3A5F — plus profond, plus "premium"
    navyLight: '24476F',
    midnight:  '0B1526',   // était 0F172A
    ink:       '1C2536',
    slate:     '5B6B82',
    mist:      'E4E9F0',
    paper:     'FFFFFF',
    bg:        'F7F9FC',
    amber:     'C97A1A',   // était EF6C00 / F59E0B — plus feutré, moins "alerte"
    amberSoft: 'FBEBD6',
    gold:      'B8862A',   // usage TRÈS ponctuel : liseré d'accent uniquement
    teal:      '0E8FA0',
    tealSoft:  'D6F1F3',
    green:     '178A5F',
    greenSoft: 'DCF3E8',
    red:       'C13A3A',
    redSoft:   'FBE4E4',
    highlight: 'FBF3E3',   // remplace l'ancien jaune vif FFF3CD (top 3, etc.)
  };

  const FONT_DISPLAY = 'Cambria';
  const FONT_TEXT = 'Calibri';

  function fmt(n, dec) {
    return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  }

  /* ══════════════════════════════════════════════════════════
     PPTX — composants partagés (pptxgenjs)
     ══════════════════════════════════════════════════════════ */

  /**
   * Slide de titre premium : fond nuit, double halo (accent module),
   * bandeau kicker, titre, sous-titre, règle fine, chips KPI, signature.
   * opts: { pres, icon, kicker, title, subtitle, accentColor, accentSoftColor,
   *         chips: [[big, small], ...], signature }
   */
  function titleSlide(opts) {
    const s = opts.pres.addSlide();
    const accent = opts.accentColor || PALETTE.amber;
    s.background = { color: PALETTE.midnight };

    s.addShape(opts.pres.shapes.OVAL, { x: 9.6, y: -2.3, w: 6.2, h: 6.2, fill: { color: PALETTE.navy }, line: { type: 'none' } });
    s.addShape(opts.pres.shapes.OVAL, { x: 10.7, y: 4.5, w: 4.3, h: 4.3, fill: { color: accent, transparency: 85 }, line: { type: 'none' } });
    // liseré d'accent en haut de slide — signature premium discrète
    s.addShape(opts.pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: accent }, line: { type: 'none' } });

    s.addText(opts.icon || '', { x: 0.7, y: 0.78, w: 1.2, h: 1.2, fontSize: 42, align: 'left', valign: 'middle' });
    s.addText((opts.kicker || '').toUpperCase(), { x: 0.7, y: 1.78, w: 10, h: 0.5,
      fontSize: 13, color: accent, bold: true, charSpacing: 3, fontFace: FONT_TEXT });
    s.addText(opts.title, { x: 0.65, y: 2.26, w: 11.5, h: 1.3,
      fontSize: 46, color: PALETTE.paper, bold: true, fontFace: FONT_DISPLAY });
    if (opts.subtitle) {
      s.addText(opts.subtitle, { x: 0.7, y: 3.44, w: 10.5, h: 0.55,
        fontSize: 18, color: 'B9C4D4', fontFace: FONT_TEXT });
    }
    s.addShape(opts.pres.shapes.LINE, { x: 0.7, y: 4.2, w: 3.2, h: 0, line: { color: accent, width: 2 } });

    let cx = 0.7;
    (opts.chips || []).forEach(([big, small]) => {
      s.addText([
        { text: big + '  ', options: { fontSize: 20, bold: true, color: PALETTE.paper, breakLine: false } },
        { text: small, options: { fontSize: 12, color: '90A0B8' } }
      ], { x: cx, y: 4.55, w: 3.5, h: 0.5, fontFace: FONT_TEXT });
      cx += 3.5;
    });

    s.addText(opts.signature || '', { x: 0.7, y: 6.95, w: 10, h: 0.35, fontSize: 10.5, color: '5B6B82', fontFace: FONT_TEXT });
    return s;
  }

  /**
   * En-tête de section standard (slides claires).
   */
  function sectionHeader(s, { title, subtitle, accentColor }) {
    s.addShape(s._pres ? s._pres.shapes.RECTANGLE : { }, {}); // no-op guard (pptxgenjs shapes need pres ref, see footer() below for real usage)
  }

  /**
   * Pied de page premium — sur TOUTES les slides sauf la couverture.
   * Filet fin + wordmark module + numéro de page (via slideNumber natif pptxgenjs).
   */
  function footer(pres, s, { wordmark, accentColor, dark }) {
    const lineColor = dark ? '2A3B55' : PALETTE.mist;
    const textColor = dark ? '5B6B82' : '90A0B8';
    s.addShape(pres.shapes.LINE, { x: 0.6, y: 7.14, w: 12.13, h: 0, line: { color: lineColor, width: 0.75 } });
    s.addText(wordmark || 'DRT SFAX · PARC AUTO', { x: 0.6, y: 7.2, w: 6, h: 0.28,
      fontSize: 8.5, color: dark ? '5B6B82' : PALETTE.slate, fontFace: FONT_TEXT, charSpacing: 1 });
    s.slideNumber = { x: 12.5, y: 7.2, w: 0.4, h: 0.28, fontSize: 8.5, color: dark ? '5B6B82' : PALETTE.slate, fontFace: FONT_TEXT, align: 'right' };
  }

  /**
   * Carte KPI premium (icône en médaillon + grande valeur + libellé), utilisée
   * en grille sur les slides de bilan.
   */
  function kpiCard(s, pres, { x, y, w, h, icon, big, label, color, soft }) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.09,
      fill: { color: PALETTE.paper },
      shadow: { type: 'outer', color: '0B1526', blur: 9, offset: 2, angle: 90, opacity: 0.10 } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, fill: { color: soft }, line: { type: 'none' } });
    s.addText(icon, { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, fontSize: 20, align: 'center', valign: 'middle', margin: 0 });
    s.addText(big, { x: x + 0.22, y: y + 0.95, w: w - 0.44, h: 0.55, fontSize: 22, bold: true, color: color, fontFace: FONT_DISPLAY });
    s.addText(label, { x: x + 0.22, y: y + 1.45, w: w - 0.44, h: 0.4, fontSize: 11, color: PALETTE.slate, fontFace: FONT_TEXT });
  }

  /* ══════════════════════════════════════════════════════════
     EXCEL — habillage premium partagé (ExcelJS)
     ══════════════════════════════════════════════════════════ */

  /**
   * Applique un chrome premium à une feuille déjà remplie via ttExportStyledExcel
   * (ou équivalent) : accent supérieur, figeage d'en-tête, filtre auto, impression.
   * ws = worksheet ExcelJS ; nCols/nRows = dimensions de la zone de données (hors bandeau titre).
   */
  function polishSheet(ws, { nCols, headerRowIndex, lastRowIndex, tabColor, landscape }) {
    ws.views = [{ state: 'frozen', ySplit: headerRowIndex || 2, showGridLines: false }];
    if (nCols && lastRowIndex) {
      ws.autoFilter = { from: { row: headerRowIndex || 2, column: 1 }, to: { row: headerRowIndex || 2, column: nCols } };
    }
    ws.pageSetup = { orientation: landscape === false ? 'portrait' : 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
    if (tabColor) ws.properties.tabColor = { argb: 'FF' + tabColor };
  }

  return {
    PALETTE, FONT_DISPLAY, FONT_TEXT, fmt,
    titleSlide, footer, kpiCard, polishSheet,
  };
});
