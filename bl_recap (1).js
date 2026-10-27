/* ============================================================================
 * bl_recap.js — BLOC ADDITIF — Onglet admin « Récap BL »
 * Scan d'un Bon de Livraison (image ou PDF) → lecture OCR → ajout automatique
 * dans le récap fournisseur (modèle MODEL_RECAP.xlsx, feuille MM-AAAA).
 *
 * Colonnes du récap : Véhicule Matricule | Désignation/article | N° PO | N° APPEL
 *                     | Bon de livraison n° | date BL | Mtt BL
 * → tout est rempli automatiquement SAUF « N° PO » et « N° APPEL » (saisie manuelle).
 *
 * Module 100 % additif : aucune fonction existante n'est modifiée.
 * Dépendances (déjà chargées par admin.html) : Tesseract.js, ExcelJS.
 * PDF.js est chargé à la demande (uniquement si un PDF est importé).
 * Données : parcAuto.data.blRecap (synchro cloud) + copie localStorage.
 * ========================================================================== */
(function () {
  'use strict';

  var LS_KEY = 'blRecap_v1';
  var PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/';
  var DEFAULT_SUPPLIERS = {
    'Ste VEGA SUD': { commande: '1089241', marche: 25000, base: 0, debut: '', fin: '' }
  };
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  /* ======================================================================
   * 1) PARSING (fonctions pures — testables hors navigateur)
   * ==================================================================== */
  function toNum(s) {
    if (s == null) return null;
    var t = String(s).replace(/\s/g, '').replace(',', '.');
    var n = parseFloat(t);
    return isNaN(n) ? null : Math.round(n * 1000) / 1000;
  }
  function normText(s) { return String(s || '').replace(/[\u2013\u2014\u2212]/g, '-'); }

  function detectSupplier(text) {
    if (/VEGA\s*SUD/i.test(text)) return 'Ste VEGA SUD';
    if (/IDEAL\s*AUTO/i.test(text)) return 'Société IDEAL AUTO SFAX';
    return '';
  }

  function findBL(text) {
    var t = normText(text), m;
    m = /LIV\s*RAISON[\s\S]{0,40}?N\s*[°º\u00ba]?\s*[:;.]?\s*([0-9OoIl]{6,9})/i.exec(t);
    if (!m) m = /\bN\s*[°º\u00ba]\s*[:;.]?\s*(20[0-9OoIl]{5,7})\b/.exec(t);
    if (!m) return '';
    return m[1].replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
  }

  function isoDate(d, mo, y) {
    d = +d; mo = +mo; y = +y;
    if (y < 100) y += 2000;
    if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return '';
    return y + '-' + (mo < 10 ? '0' : '') + mo + '-' + (d < 10 ? '0' : '') + d;
  }
  function findDate(text) {
    var t = normText(text), re = /(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})/g, m, best = '', first = '';
    while ((m = re.exec(t))) {
      var before = t.slice(Math.max(0, m.index - 16), m.index);
      if (/D\.?\s*M\.?\s*C\s*$|[ée]dit[ée]?\s*(le)?\s*$|mise\s*en\s*circ\w*\s*$|\bLe\s*$/i.test(before)) continue;
      var iso = isoDate(m[1], m[2], m[3]);
      if (!iso) continue;
      if (/Date\s*(du|:)?\s*$/i.test(before)) { best = iso; break; }
      if (!first) first = iso;
    }
    return best || first;
  }

  function findAmount(text) {
    var t = normText(text), NUM = '(\\d{4,6}[.,]\\d{3}|\\d{1,3}(?:\\s\\d{3})*[.,]\\d{3})', m;
    var pats = [
      new RegExp('NET\\s*[AÀ4]\\s*PAYER[^\\d]{0,15}' + NUM, 'i'),
      new RegExp('TOTAL\\s*T\\.?T\\.?C\\.?[^\\d]{0,15}' + NUM, 'i'),
      new RegExp('MONTANT\\s*T\\.?T\\.?C\\.?[^\\d]{0,15}' + NUM, 'i'),
      new RegExp('TOTAL\\s*[AÀ]\\s*PAYER[^\\d]{0,15}' + NUM, 'i')
    ];
    for (var i = 0; i < pats.length; i++) {
      m = pats[i].exec(t);
      if (m) return { value: toNum(m[1]), sure: true };
    }
    // repli : plus grand montant à 3 décimales trouvé (à vérifier par l'utilisateur)
    var re = /(\d{1,6})[.,](\d{3})(?!\d)/g, max = null;
    while ((m = re.exec(t))) {
      var v = toNum(m[1] + '.' + m[2]);
      if (v != null && (max == null || v > max)) max = v;
    }
    return { value: max, sure: false };
  }

  function findMatricule(text, fleet) {
    var t = normText(text), cands = [], m;
    var re1 = /(^|[^\d])(\d{2})\s*-\s*(\d{6})(?!\d)/g;
    while ((m = re1.exec(t))) cands.push(m[2] + '-' + m[3]);
    var re2 = /(^|[^\d])(17)[\s]?(\d{6})(?!\d)/g;
    while ((m = re2.exec(t))) cands.push(m[2] + '-' + m[3]);
    if (!cands.length) return { value: '', note: '' };
    var i;
    if (fleet && fleet.size) {
      for (i = 0; i < cands.length; i++) if (fleet.has(cands[i])) return { value: cands[i], note: '' };
    }
    var pick = cands[0];
    for (i = 0; i < cands.length; i++) if (cands[i].indexOf('17-') === 0) { pick = cands[i]; break; }
    return fixAgainstFleet(pick, fleet);
  }
  // correction d'une erreur OCR d'un seul chiffre, si un seul véhicule du parc correspond
  function fixAgainstFleet(mat, fleet) {
    if (!fleet || !fleet.size || fleet.has(mat)) return { value: mat, note: '' };
    var hit = [];
    fleet.forEach(function (f) {
      if (f.length !== mat.length) return;
      var d = 0;
      for (var i = 0; i < f.length; i++) if (f[i] !== mat[i]) d++;
      if (d === 1) hit.push(f);
    });
    if (hit.length === 1) return { value: hit[0], note: 'corrigé depuis ' + mat };
    return { value: mat, note: '' };
  }

  function isNumTok(t) {
    return /\d/.test(t) && /^[|\[\]_]*\d+[.,;:]?\d*[|\]]*$/.test(t) && (/[.,;:|]/.test(t) || /^\d+$/.test(t));
  }
  function isDec3(t) { return /^[|\[\]_]*\d+[.,]\d{3}[|\]]*$/.test(t); }

  function stripCodeColumn(ws) {
    if (ws.length < 2) return ws;
    var hs = ws.map(function (w) { return (w.y1 || 0) - (w.y0 || 0); }).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
    var h = hs.length ? hs[hs.length >> 1] : 0;
    if (h) {
      for (var i = 1; i < Math.min(ws.length, 4); i++) {
        if (ws[i].x0 - ws[i - 1].x1 > 2.5 * h) return ws.slice(i);
      }
    }
    if (/[\d\-]/.test(ws[0].text) && ws.length >= 3) return ws.slice(1);
    return ws;
  }

  function findDesignation(lines) {
    var out = [];
    (lines || []).forEach(function (ln) {
      var ws = (ln.words || []).filter(function (w) { return w && w.text && w.text.trim(); });
      if (!ws.length) return;
      var txt = ws.map(function (w) { return w.text; }).join(' ');
      if (/\b(total|base|libell\w*|montant|capital|c\.c\.b|arr[êe]t[ée])\b|net\s*[aà]\s*payer|\btva\b|code\s*article|d[ée]signation|remise/i.test(txt)) return;
      var nDec = ws.filter(function (w) { return isDec3(w.text); }).length;
      if (nDec < 2) return;
      var des = [];
      for (var i = 0; i < ws.length; i++) {
        if (des.length && isNumTok(ws[i].text)) break;
        des.push(ws[i]);
      }
      des = stripCodeColumn(des);
      var s = des.map(function (w) { return w.text; }).join(' ').replace(/[|_\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!s || /^TAUX\s*HORAIRE/i.test(s)) return;     // main-d'œuvre horaire : bruit
      if (out.indexOf(s) < 0) out.push(s);
    });
    return out.join(' / ');
  }

  // ocr = { text, lines:[{words:[{text,x0,y0,x1,y1}]}] }
  function parseBL(ocr, fleet) {
    var text = ocr.text || '';
    var mat = findMatricule(text, fleet);
    var amt = findAmount(text);
    var rec = {
      fournisseur: detectSupplier(text),
      matricule: mat.value,
      designation: findDesignation(ocr.lines),
      bl: findBL(text),
      dateBL: findDate(text),
      montant: amt.value
    };
    rec._warn = [];
    if (mat.note) rec._warn.push('Matricule ' + mat.note);
    if (!rec.matricule) rec._warn.push('Matricule non détecté');
    if (!rec.bl) rec._warn.push('N° BL non détecté');
    if (!rec.dateBL) rec._warn.push('Date non détectée');
    if (rec.montant == null) rec._warn.push('Montant non détecté');
    else if (!amt.sure) rec._warn.push('Montant à vérifier (total TTC non repéré)');
    return rec;
  }

  /* ======================================================================
   * 2) ÉTAT & PERSISTANCE
   * ==================================================================== */
  var store = null;
  var pending = [];
  var ui = { supplier: '', month: '' };
  var seq = 0;

  function uid() { return 'bl' + Date.now().toString(36) + (seq++).toString(36); }

  function loadStore() {
    var pa = window.parcAuto, s = pa && pa.data && pa.data.blRecap;
    if (!s) { try { s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { s = null; } }
    if (!s) s = { records: [], config: { suppliers: {} } };
    s.records = s.records || [];
    s.config = s.config || {};
    s.config.suppliers = s.config.suppliers || {};
    Object.keys(DEFAULT_SUPPLIERS).forEach(function (k) {
      if (!s.config.suppliers[k]) s.config.suppliers[k] = JSON.parse(JSON.stringify(DEFAULT_SUPPLIERS[k]));
    });
    return s;
  }
  function saveStore() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch (e) { }
    var pa = window.parcAuto;
    if (pa && pa.data) {
      pa.data.blRecap = store;
      if (typeof pa.saveData === 'function') { try { pa.saveData(); } catch (e) { } }
    }
  }
  function supCfg(name) {
    var c = store.config.suppliers;
    if (!c[name]) c[name] = { commande: '', marche: 0, base: 0, debut: '', fin: '' };
    return c[name];
  }
  function fleetSet() {
    var set = new Set(), pa = window.parcAuto;
    ((pa && pa.data && pa.data.vehicles) || []).forEach(function (v) {
      if (v && v.matricule) set.add(String(v.matricule).trim());
    });
    return set;
  }
  function vehicleModel(mat) {
    var pa = window.parcAuto, v = pa && pa.data && (pa.data.vehicles || []).find(function (x) { return x.matricule === mat; });
    return v ? (v.modele || v.marque || '') : '';
  }

  /* ======================================================================
   * 3) SCAN : fichier → canvas(s) → OCR → parsing
   * ==================================================================== */
  var worker = null, workerPromise = null, progressCb = null;

  function getWorker() {
    if (worker) return Promise.resolve(worker);
    if (workerPromise) return workerPromise;
    if (typeof Tesseract === 'undefined') return Promise.reject(new Error('Tesseract non chargé — vérifiez la connexion.'));
    workerPromise = Tesseract.createWorker('fra', 1, {
      logger: function (m) { if (progressCb && m && m.status === 'recognizing text') progressCb(m.progress || 0); }
    }).then(function (w) { worker = w; return w; });
    return workerPromise;
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Chargement impossible : ' + src)); };
      document.head.appendChild(s);
    });
  }
  function ensurePdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return loadScript(PDFJS_BASE + 'pdf.min.js').then(function () {
      var lib = window.pdfjsLib;
      return fetch(PDFJS_BASE + 'pdf.worker.min.js').then(function (r) { return r.text(); }).then(function (code) {
        lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
        return lib;
      }).catch(function () {
        lib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
        return lib;
      });
    });
  }

  function fileToCanvas(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 2600, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); res(c);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Image illisible : ' + file.name)); };
      img.src = url;
    });
  }

  // PDF → liste de { canvas, textLines|null } (une entrée par page)
  async function pdfToPages(file) {
    var lib = await ensurePdfJs();
    var pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    var pages = [], n = Math.min(pdf.numPages, 20);
    for (var p = 1; p <= n; p++) {
      var page = await pdf.getPage(p);
      var v1 = page.getViewport({ scale: 1 });
      var k = Math.min(3, 2200 / v1.width), vp = page.getViewport({ scale: k });
      var c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      var tl = null;
      try {
        var tc = await page.getTextContent(), items = [];
        tc.items.forEach(function (it) {
          if (!it.str || !it.str.trim()) return;
          var x = it.transform[4], y = vp.height - it.transform[5] * k, h = Math.abs(it.transform[3]) * k || 10;
          items.push({ text: it.str.trim(), x0: x * k, x1: (x + (it.width || 0)) * k, y0: y - h, y1: y });
        });
        if (items.length > 15) tl = items;
      } catch (e) { }
      pages.push({ canvas: c, textItems: tl });
    }
    return pages;
  }

  function linesFromItems(items) {
    items.sort(function (a, b) { return a.y1 - b.y1 || a.x0 - b.x0; });
    var lines = [];
    items.forEach(function (it) {
      var last = lines[lines.length - 1];
      if (last && Math.abs(last.y - it.y1) < 4) { last.words.push(it); }
      else lines.push({ y: it.y1, words: [it] });
    });
    lines.forEach(function (l) { l.words.sort(function (a, b) { return a.x0 - b.x0; }); });
    return lines;
  }

  function ocrToStruct(data) {
    var lines = [];
    var srcLines = data.lines;
    if (!srcLines || !srcLines.length) {
      srcLines = [];
      (data.blocks || []).forEach(function (b) { (b.paragraphs || []).forEach(function (p) { (p.lines || []).forEach(function (l) { srcLines.push(l); }); }); });
    }
    (srcLines || []).forEach(function (l) {
      lines.push({
        words: (l.words || []).map(function (w) {
          var b = w.bbox || {};
          return { text: w.text || '', x0: b.x0 || 0, y0: b.y0 || 0, x1: b.x1 || 0, y1: b.y1 || 0, conf: w.confidence };
        })
      });
    });
    if (!lines.length) {
      lines = String(data.text || '').split('\n').map(function (s) {
        return { words: s.split(/\s+/).filter(Boolean).map(function (t) { return { text: t, x0: 0, y0: 0, x1: 0, y1: 0 }; }) };
      });
    }
    return { text: data.text || '', lines: lines };
  }

  // 2e passe ciblée : la case « matricule » de la ligne D.M.C (souvent ignorée par la 1re lecture)
  async function rescueMatricule(w, canvas, struct) {
    var line = null;
    for (var i = 0; i < struct.lines.length; i++) {
      var tx = struct.lines[i].words.map(function (x) { return x.text; }).join(' ');
      if (/D\.?\s*M\.?\s*C/i.test(tx)) { line = struct.lines[i]; break; }
    }
    if (!line) return '';
    var ws = line.words.filter(function (x) { return x.x1 > x.x0 && (x.conf == null || x.conf > 10) && x.text.length > 1; });
    if (!ws.length) return '';
    var y0 = Math.min.apply(null, ws.map(function (x) { return x.y0; })) - 8;
    var y1 = Math.max.apply(null, ws.map(function (x) { return x.y1; })) + 8;
    var x0 = Math.max.apply(null, ws.map(function (x) { return x.x1; })) + 4;
    if (x0 > canvas.width - 60) x0 = Math.round(canvas.width * 0.8);
    var cw = canvas.width - x0, ch = y1 - y0;
    if (cw < 40 || ch < 8) return '';
    var c = document.createElement('canvas');
    c.width = cw * 3; c.height = ch * 3;
    var g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(canvas, x0, Math.max(0, y0), cw, ch, 0, 0, c.width, c.height);
    try {
      await w.setParameters({ tessedit_char_whitelist: '0123456789-', tessedit_pageseg_mode: '7' });
      var r = await w.recognize(c);
      var m = /(\d{2})\s*-?\s*(\d{6})/.exec(normText(r.data.text));
      return m ? m[1] + '-' + m[2] : '';
    } catch (e) { return ''; }
    finally {
      try { await w.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: '3' }); } catch (e) { }
    }
  }

  function thumbOf(canvas) {
    var k = 240 / canvas.width, c = document.createElement('canvas');
    c.width = 240; c.height = Math.round(canvas.height * k);
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.55);
  }

  async function scanCanvas(canvas, textItems, label, setStatus) {
    var struct;
    if (textItems && /livraison/i.test(textItems.map(function (i) { return i.text; }).join(' '))) {
      struct = { lines: linesFromItems(textItems) };
      struct.text = struct.lines.map(function (l) { return l.words.map(function (w) { return w.text; }).join(' '); }).join('\n');
    } else {
      setStatus('Chargement du moteur OCR…');
      var w = await getWorker();
      progressCb = function (p) { setStatus('Lecture OCR de ' + label + ' — ' + Math.round(p * 100) + ' %'); };
      var res = await w.recognize(canvas);
      progressCb = null;
      struct = ocrToStruct(res.data);
      var fleet0 = fleetSet();
      if (!findMatricule(struct.text, fleet0).value) {
        setStatus('Recherche du matricule…');
        var mm = await rescueMatricule(w, canvas, struct);
        if (mm) struct.text += '\nMatricule: ' + mm;
      }
    }
    var rec = parseBL(struct, fleetSet());
    return { rec: rec, text: struct.text, thumb: thumbOf(canvas) };
  }

  async function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var st = document.getElementById('blrc-status');
    function setStatus(msg, err) { if (st) { st.textContent = msg || ''; st.style.color = err ? '#b91c1c' : 'var(--secondary)'; } }
    var added = 0;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      try {
        var isPdf = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
        var pages;
        setStatus('Préparation de ' + f.name + '…');
        if (isPdf) pages = await pdfToPages(f);
        else pages = [{ canvas: await fileToCanvas(f), textItems: null }];
        for (var p = 0; p < pages.length; p++) {
          var label = f.name + (pages.length > 1 ? ' (p.' + (p + 1) + ')' : '');
          var r = await scanCanvas(pages[p].canvas, pages[p].textItems, label, setStatus);
          pending.push({ id: uid(), file: label, thumb: r.thumb, ocr: r.text, rec: r.rec });
          added++;
          renderPending();
        }
      } catch (e) {
        console.error(e);
        setStatus('❌ ' + f.name + ' : ' + (e && e.message ? e.message : e), true);
        return;
      }
    }
    setStatus('✅ ' + added + ' BL lu(s) — vérifiez les champs puis cliquez « Ajouter au récap ».');
  }

  /* ======================================================================
   * 4) UI
   * ==================================================================== */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt(n) {
    if (n == null || n === '' || isNaN(n)) return '';
    return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  function fmtDate(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }
  function monthOf(iso) { return iso ? iso.slice(0, 7) : ''; }
  function monthLabel(ym) { return ym ? MOIS[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4) : 'Sans date'; }
  function monthSheet(ym) { return ym.slice(5, 7) + '-' + ym.slice(0, 4); }
  function el(id) { return document.getElementById(id); }

  function suppliersKnown() {
    var s = {};
    Object.keys(store.config.suppliers).forEach(function (k) { s[k] = 1; });
    store.records.forEach(function (r) { if (r.fournisseur) s[r.fournisseur] = 1; });
    return Object.keys(s);
  }

  function buildTab() {
    var root = el('tab-bl-recap');
    if (!root || root.getAttribute('data-blrc') === '1') return;
    root.setAttribute('data-blrc', '1');
    root.innerHTML =
      '<style>' +
      '#tab-bl-recap .blrc-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}' +
      '#tab-bl-recap .blrc-btn{font-size:13px;padding:9px 16px;border:none;border-radius:8px;cursor:pointer;font-weight:600;color:#fff;}' +
      '#tab-bl-recap .blrc-btn.sec{background:#fff;color:var(--secondary);border:1px solid var(--border);}' +
      '#tab-bl-recap .blrc-btn:hover{opacity:.9;}' +
      '#tab-bl-recap .blrc-drop{border:2px dashed #cbd5e1;border-radius:12px;padding:18px;text-align:center;color:var(--secondary);font-size:13px;margin:12px 0;background:#f8fafc;transition:all .2s;}' +
      '#tab-bl-recap .blrc-drop.over{border-color:#ef6c00;background:#fff7ed;}' +
      '#tab-bl-recap .blrc-card{display:flex;gap:14px;border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:12px;background:#fff;flex-wrap:wrap;}' +
      '#tab-bl-recap .blrc-thumb{width:120px;border-radius:8px;border:1px solid var(--border);cursor:zoom-in;align-self:flex-start;}' +
      '#tab-bl-recap .blrc-grid{flex:1;min-width:260px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;}' +
      '#tab-bl-recap .blrc-grid label{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--secondary);display:block;margin-bottom:2px;}' +
      '#tab-bl-recap input,#tab-bl-recap select{width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:inherit;background:#fff;color:var(--text);box-sizing:border-box;}' +
      '#tab-bl-recap .blrc-warn{font-size:11px;color:#92400e;background:#fef3c7;border-radius:6px;padding:3px 8px;display:inline-block;margin:2px 4px 0 0;}' +
      '#tab-bl-recap .blrc-ok{font-size:11px;color:#065f46;background:#d1fae5;border-radius:6px;padding:3px 8px;display:inline-block;margin:2px 4px 0 0;}' +
      '#tab-bl-recap .blrc-chips{display:flex;gap:5px;flex-wrap:wrap;margin:10px 0;}' +
      '#tab-bl-recap .blrc-chip{font-size:11px;padding:4px 11px;border:1px solid var(--border);border-radius:20px;background:#fff;color:var(--secondary);cursor:pointer;}' +
      '#tab-bl-recap .blrc-chip.active{background:var(--primary);color:#fff;border-color:var(--primary);}' +
      '#tab-bl-recap table{width:100%;border-collapse:collapse;font-size:12px;min-width:880px;}' +
      '#tab-bl-recap th{padding:8px 6px;text-align:center;font-size:10px;text-transform:uppercase;color:var(--secondary);border-bottom:2px solid var(--border);background:#f8fafc;}' +
      '#tab-bl-recap td{padding:4px;border-bottom:1px solid #eef2f7;}' +
      '#tab-bl-recap td input{padding:5px 6px;}' +
      '#tab-bl-recap .blrc-tot{max-width:430px;margin:16px 0 0 auto;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;font-size:13px;}' +
      '#tab-bl-recap .blrc-tot div{display:flex;justify-content:space-between;padding:7px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;}' +
      '#tab-bl-recap .blrc-tot div.g{background:#92d050;}' +
      '#tab-bl-recap .blrc-cfg{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:8px 0 4px;}' +
      '#tab-bl-recap .blrc-cfg label{font-size:10px;text-transform:uppercase;color:var(--secondary);display:block;margin-bottom:2px;}' +
      '#tab-bl-recap details summary{cursor:pointer;font-size:11px;color:var(--secondary);margin-top:6px;}' +
      '#tab-bl-recap pre{white-space:pre-wrap;font-size:10px;max-height:160px;overflow:auto;background:#f1f5f9;padding:8px;border-radius:6px;}' +
      '</style>' +
      '<div class="card">' +
      '  <div class="card-header"><div class="card-title">📋 Récap Bons de Livraison — scan automatique</div>' +
      '    <div style="font-size:12px;color:var(--secondary);">Scannez un BL (photo ou PDF) : matricule, désignation, n° BL, date et montant TTC sont lus et ajoutés au récap. N° PO et N° APPEL restent à saisir.</div></div>' +
      '  <div class="blrc-row">' +
      '    <button class="blrc-btn" style="background:#ef6c00;" id="blrc-btn-cam">📸 Scanner un BL</button>' +
      '    <button class="blrc-btn" style="background:#1E3A5F;" id="blrc-btn-file">📁 Importer image / PDF</button>' +
      '    <input type="file" id="blrc-in-cam" accept="image/*" capture="environment" style="display:none;">' +
      '    <input type="file" id="blrc-in-file" accept="image/*,application/pdf,.pdf" multiple style="display:none;">' +
      '  </div>' +
      '  <div class="blrc-drop" id="blrc-drop">…ou glissez-déposez vos BL (JPG, PNG, PDF) ici</div>' +
      '  <div id="blrc-status" style="font-size:12px;color:var(--secondary);min-height:18px;"></div>' +
      '  <div id="blrc-pending"></div>' +
      '</div>' +
      '<div class="card" style="margin-top:16px;">' +
      '  <div class="card-header" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:center;">' +
      '    <div class="card-title">📑 Récap fournisseur</div>' +
      '    <div class="blrc-row">' +
      '      <button class="blrc-btn" style="background:#10b981;" id="blrc-exp-month">⬇️ Export Excel du mois</button>' +
      '      <button class="blrc-btn" style="background:#1E3A5F;" id="blrc-exp-all">⬇️ Export Excel (tous les mois)</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="blrc-row"><label style="font-size:11px;font-weight:600;color:var(--secondary);">Fournisseur</label><select id="blrc-sup" style="max-width:300px;"></select>' +
      '    <button class="blrc-btn" style="background:#ef6c00;" id="blrc-add-sup">➕ Ajouter un fournisseur</button>' +
      '    <button class="blrc-btn sec" id="blrc-del-sup" title="Supprime la fiche marché (les BL sont conservés)">🗑 Supprimer la fiche</button></div>' +
      '  <div id="blrc-newsup" style="display:none;border:1px solid var(--border);border-radius:10px;padding:12px;margin-top:10px;background:#f8fafc;">' +
      '    <div class="blrc-cfg">' +
      '      <div><label>Nom du fournisseur *</label><input type="text" id="blrc-n-nom" placeholder="Ex: Ste VEGA SUD"></div>' +
      '      <div><label>Commande ouverte n°</label><input type="text" id="blrc-n-cmd"></div>' +
      '      <div><label>Total marché (DT)</label><input type="number" step="0.001" id="blrc-n-marche"></div>' +
      '      <div><label>Début du marché</label><input type="date" id="blrc-n-debut"></div>' +
      '      <div><label>Fin du marché</label><input type="date" id="blrc-n-fin"></div>' +
      '      <div><label>Engagement antérieur (DT)</label><input type="number" step="0.001" id="blrc-n-base" value="0"></div>' +
      '    </div>' +
      '    <div class="blrc-row" style="margin-top:10px;"><button class="blrc-btn" style="background:#10b981;" id="blrc-n-ok">💾 Enregistrer le fournisseur</button>' +
      '    <button class="blrc-btn sec" id="blrc-n-cancel">Annuler</button></div>' +
      '  </div>' +
      '  <div class="blrc-chips" id="blrc-chips"></div>' +
      '  <div class="blrc-cfg" id="blrc-cfg"></div>' +
      '  <div style="overflow-x:auto;margin-top:10px;"><table><thead><tr>' +
      '    <th>Véhicule Matricule</th><th style="min-width:230px;">Désignation / article</th><th>N° PO</th><th>N° APPEL</th><th>Bon de livraison n°</th><th>Date BL</th><th>Mtt BL</th><th></th>' +
      '  </tr></thead><tbody id="blrc-tbody"></tbody></table></div>' +
      '  <div class="blrc-tot" id="blrc-tot"></div>' +
      '</div>' +
      '<datalist id="blrc-sup-list"></datalist>';

    el('blrc-btn-cam').onclick = function () { el('blrc-in-cam').click(); };
    el('blrc-btn-file').onclick = function () { el('blrc-in-file').click(); };
    ['blrc-in-cam', 'blrc-in-file'].forEach(function (id) {
      el(id).onchange = function (e) { var fl = e.target.files; handleFiles(fl).then(function () { e.target.value = ''; }); };
    });
    var drop = el('blrc-drop');
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { handleFiles(e.dataTransfer.files); });

    el('blrc-sup').onchange = function () { ui.supplier = this.value; ui.month = ''; renderRecap(); };
    el('blrc-add-sup').onclick = function () { el('blrc-newsup').style.display = 'block'; el('blrc-n-nom').focus(); };
    el('blrc-n-cancel').onclick = function () { el('blrc-newsup').style.display = 'none'; };
    el('blrc-n-ok').onclick = function () {
      var nom = el('blrc-n-nom').value.trim();
      if (!nom) { alert('Saisissez le nom du fournisseur.'); return; }
      var d0 = el('blrc-n-debut').value, d1 = el('blrc-n-fin').value;
      if (d0 && d1 && d1 <= d0) { alert('La fin du marché doit être postérieure au début.'); return; }
      store.config.suppliers[nom] = {
        commande: el('blrc-n-cmd').value.trim(), marche: toNum(el('blrc-n-marche').value) || 0,
        base: toNum(el('blrc-n-base').value) || 0, debut: d0, fin: d1
      };
      ui.supplier = nom; ui.month = '';
      ['nom', 'cmd', 'marche', 'debut', 'fin'].forEach(function (k) { el('blrc-n-' + k).value = ''; });
      el('blrc-n-base').value = '0'; el('blrc-newsup').style.display = 'none';
      saveStore(); renderRecap(); renderPending();
    };
    el('blrc-del-sup').onclick = function () {
      if (!ui.supplier || !store.config.suppliers[ui.supplier]) { alert('Aucune fiche à supprimer pour ce fournisseur.'); return; }
      if (!confirm('Supprimer la fiche marché de « ' + ui.supplier + ' » ? Les BL déjà enregistrés sont conservés.')) return;
      delete store.config.suppliers[ui.supplier];
      saveStore(); ui.supplier = ''; renderRecap();
    };
    el('blrc-exp-month').onclick = function () { exportExcel(false); };
    el('blrc-exp-all').onclick = function () { exportExcel(true); };

    // délégation : cartes en attente
    var pend = el('blrc-pending');
    pend.addEventListener('input', function (e) {
      var t = e.target, id = t.getAttribute('data-id'), f = t.getAttribute('data-f');
      if (!id || !f) return;
      var it = pending.find(function (x) { return x.id === id; });
      if (!it) return;
      it.rec[f] = (f === 'montant') ? toNum(t.value) : t.value;
    });
    pend.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (b) {
        var id = b.getAttribute('data-id'), act = b.getAttribute('data-act');
        if (act === 'add') addPending(id);
        else if (act === 'drop') { pending = pending.filter(function (x) { return x.id !== id; }); renderPending(); }
        else if (act === 'all') addAllPending();
        return;
      }
      if (e.target.classList.contains('blrc-thumb')) {
        var it = pending.find(function (x) { return x.id === e.target.getAttribute('data-id'); });
        if (it) { var w = window.open(''); if (w) w.document.write('<img src="' + it.thumb + '" style="max-width:100%">'); }
      }
    });

    // délégation : tableau récap
    var tb = el('blrc-tbody');
    tb.addEventListener('change', function (e) {
      var t = e.target, id = t.getAttribute('data-id'), f = t.getAttribute('data-f');
      if (!id || !f) return;
      var r = store.records.find(function (x) { return x.id === id; });
      if (!r) return;
      r[f] = (f === 'montant') ? toNum(t.value) : t.value;
      if (f === 'matricule') {
        var fx = fixAgainstFleet(t.value.trim(), fleetSet()); r.matricule = fx.value;
      }
      saveStore(); renderRecap();
    });
    tb.addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]');
      if (!b) return;
      if (!confirm('Supprimer cette ligne du récap ?')) return;
      store.records = store.records.filter(function (x) { return x.id !== b.getAttribute('data-del'); });
      saveStore(); renderRecap();
    });
    el('blrc-cfg').addEventListener('change', function (e) {
      var f = e.target.getAttribute('data-c');
      if (!f || !ui.supplier) return;
      var c = supCfg(ui.supplier);
      c[f] = (f === 'commande') ? e.target.value.trim() : (f === 'debut' || f === 'fin') ? e.target.value : (toNum(e.target.value) || 0);
      saveStore(); renderRecap();
    });
  }

  function renderPending() {
    var box = el('blrc-pending');
    if (!box) return;
    if (!pending.length) { box.innerHTML = ''; return; }
    var dupSet = {};
    store.records.forEach(function (r) { dupSet[(r.fournisseur || '') + '|' + r.bl] = 1; });
    var fleet = fleetSet();
    var html = '<div class="blrc-row" style="justify-content:space-between;margin:8px 0;"><strong style="font-size:13px;">À vérifier (' + pending.length + ')</strong>' +
      '<button class="blrc-btn" style="background:#10b981;" data-act="all">✔ Tout ajouter au récap</button></div>';
    pending.forEach(function (it) {
      var r = it.rec, warns = (r._warn || []).slice();
      if (r.bl && dupSet[(r.fournisseur || '') + '|' + r.bl]) warns.push('⚠ BL déjà présent dans le récap');
      var known = r.matricule && fleet.has(r.matricule);
      var badges = warns.map(function (w) { return '<span class="blrc-warn">' + esc(w) + '</span>'; }).join('');
      if (known) badges += '<span class="blrc-ok">Véhicule du parc' + (vehicleModel(r.matricule) ? ' · ' + esc(vehicleModel(r.matricule)) : '') + '</span>';
      else if (r.matricule && fleet.size) badges += '<span class="blrc-warn">Matricule absent du parc</span>';
      html += '<div class="blrc-card">' +
        '<img class="blrc-thumb" src="' + it.thumb + '" data-id="' + it.id + '" title="Agrandir">' +
        '<div style="flex:1;min-width:260px;">' +
        '<div style="font-size:11px;color:var(--secondary);margin-bottom:6px;">📄 ' + esc(it.file) + '</div>' +
        '<div class="blrc-grid">' +
        fld(it, 'matricule', 'Véhicule matricule', 'text') +
        fld(it, 'fournisseur', 'Fournisseur', 'text', 'blrc-sup-list') +
        fld(it, 'bl', 'Bon de livraison n°', 'text') +
        fld(it, 'dateBL', 'Date BL', 'date') +
        fld(it, 'montant', 'Mtt BL (TTC)', 'number') +
        '</div>' +
        '<div style="margin-top:8px;"><label style="font-size:10px;text-transform:uppercase;color:var(--secondary);">Désignation / article</label>' +
        '<input type="text" data-id="' + it.id + '" data-f="designation" value="' + esc(r.designation) + '"></div>' +
        '<div>' + badges + '</div>' +
        '<div class="blrc-row" style="margin-top:8px;">' +
        '<button class="blrc-btn" style="background:#10b981;" data-act="add" data-id="' + it.id + '">✔ Ajouter au récap</button>' +
        '<button class="blrc-btn sec" data-act="drop" data-id="' + it.id + '">✖ Ignorer</button></div>' +
        '<details><summary>Texte lu par l\'OCR</summary><pre>' + esc(it.ocr) + '</pre></details>' +
        '</div></div>';
    });
    box.innerHTML = html;
    el('blrc-sup-list').innerHTML = suppliersKnown().map(function (s) { return '<option value="' + esc(s) + '">'; }).join('');
  }
  function fld(it, f, label, type, list) {
    var v = it.rec[f];
    if (f === 'montant') v = v == null ? '' : v;
    return '<div><label>' + label + '</label><input type="' + type + '"' + (type === 'number' ? ' step="0.001"' : '') +
      (list ? ' list="' + list + '"' : '') + ' data-id="' + it.id + '" data-f="' + f + '" value="' + esc(v == null ? '' : v) + '"></div>';
  }

  function addPending(id, silent) {
    var it = pending.find(function (x) { return x.id === id; });
    if (!it) return false;
    var r = it.rec;
    if (!r.dateBL) { alert('Renseignez la date du BL avant d\'ajouter (elle détermine le mois du récap).'); return false; }
    if (r.montant == null) { alert('Renseignez le montant du BL avant d\'ajouter.'); return false; }
    var fx = fixAgainstFleet((r.matricule || '').trim(), fleetSet());
    var dupIdx = store.records.findIndex(function (x) { return r.bl && x.bl === r.bl && (x.fournisseur || '') === (r.fournisseur || ''); });
    if (dupIdx >= 0) {
      if (silent || !confirm('Le BL n° ' + r.bl + ' existe déjà dans le récap. Le remplacer ?')) return false;
      var old = store.records[dupIdx];
      store.records.splice(dupIdx, 1);
      r._keepPo = { po: old.po, appel: old.appel };
    }
    store.records.push({
      id: uid(), matricule: fx.value, designation: r.designation || '', fournisseur: (r.fournisseur || '').trim(),
      po: (r._keepPo && r._keepPo.po) || '', appel: (r._keepPo && r._keepPo.appel) || '',
      bl: r.bl || '', dateBL: r.dateBL, montant: r.montant
    });
    pending = pending.filter(function (x) { return x.id !== id; });
    ui.supplier = (r.fournisseur || '').trim() || ui.supplier;
    ui.month = monthOf(r.dateBL);
    saveStore();
    if (!silent) { renderPending(); renderRecap(); }
    return true;
  }
  function addAllPending() {
    var ids = pending.map(function (x) { return x.id; }), n = 0;
    ids.forEach(function (id) { if (addPending(id, true)) n++; });
    renderPending(); renderRecap();
    var st = el('blrc-status');
    if (st) st.textContent = n + ' BL ajouté(s) au récap' + (pending.length ? ' — ' + pending.length + ' à compléter (date / montant manquants ou doublons).' : '.');
  }

  /* ---- Totaux ---- */
  function calc(sup, ym) {
    var cfg = supCfg(sup), total = 0, prev = Number(cfg.base) || 0;
    store.records.forEach(function (r) {
      if ((r.fournisseur || '') !== sup) return;
      var m = monthOf(r.dateBL);
      if (m === ym) total += Number(r.montant) || 0;
      else if (m < ym && (!cfg.debut || r.dateBL >= cfg.debut)) prev += Number(r.montant) || 0;
    });
    var eng = total + prev, marche = Number(cfg.marche) || 0;
    var out = { total: total, prev: prev, eng: eng, marche: marche, taux: marche ? eng / marche : 0, reste: marche - eng, commande: cfg.commande || '', debut: cfg.debut || '', fin: cfg.fin || '', jours: null, tempsPct: null };
    if (cfg.debut && cfg.fin) {
      var d0 = Date.parse(cfg.debut), d1 = Date.parse(cfg.fin), now = Date.now();
      if (d1 > d0) {
        out.tempsPct = Math.max(0, Math.min(1, (now - d0) / (d1 - d0)));
        out.jours = Math.ceil((d1 - now) / 86400000);
      }
    }
    return out;
  }

  function renderRecap() {
    if (!el('blrc-sup')) return;
    var sups = suppliersKnown();
    if (!ui.supplier || sups.indexOf(ui.supplier) < 0) {
      var withData = store.records.length ? (store.records[store.records.length - 1].fournisseur || '') : '';
      ui.supplier = withData || sups[0] || '';
    }
    el('blrc-sup').innerHTML = sups.map(function (s) { return '<option value="' + esc(s) + '"' + (s === ui.supplier ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
      (store.records.some(function (r) { return !r.fournisseur; }) ? '<option value=""' + (ui.supplier === '' ? ' selected' : '') + '>(sans fournisseur)</option>' : '');
    var months = {};
    store.records.forEach(function (r) { if ((r.fournisseur || '') === ui.supplier) months[monthOf(r.dateBL)] = 1; });
    var ml = Object.keys(months).sort();
    if (ml.indexOf(ui.month) < 0) ui.month = ml.length ? ml[ml.length - 1] : '';
    el('blrc-chips').innerHTML = ml.length ? ml.map(function (m) {
      return '<span class="blrc-chip' + (m === ui.month ? ' active' : '') + '" data-m="' + m + '">' + monthLabel(m) + '</span>';
    }).join('') : '<span style="font-size:12px;color:var(--secondary);">Aucun BL enregistré pour ce fournisseur — scannez un bon de livraison ci-dessus.</span>';
    Array.prototype.forEach.call(el('blrc-chips').querySelectorAll('.blrc-chip'), function (c) {
      c.onclick = function () { ui.month = c.getAttribute('data-m'); renderRecap(); };
    });

    var cfg = supCfg(ui.supplier);
    el('blrc-cfg').innerHTML = ui.supplier ?
      '<div><label>Commande ouverte n°</label><input type="text" data-c="commande" value="' + esc(cfg.commande) + '"></div>' +
      '<div><label>Début du marché</label><input type="date" data-c="debut" value="' + esc(cfg.debut || '') + '"></div>' +
      '<div><label>Fin du marché</label><input type="date" data-c="fin" value="' + esc(cfg.fin || '') + '"></div>' +
      '<div><label>Total marché (DT)</label><input type="number" step="0.001" data-c="marche" value="' + esc(cfg.marche) + '"></div>' +
      '<div><label>Engagement antérieur au 1er mois suivi (DT)</label><input type="number" step="0.001" data-c="base" value="' + esc(cfg.base) + '"></div>' : '';

    var rows = store.records.filter(function (r) { return (r.fournisseur || '') === ui.supplier && monthOf(r.dateBL) === ui.month; })
      .sort(function (a, b) { return (a.dateBL || '').localeCompare(b.dateBL || '') || String(a.bl).localeCompare(String(b.bl)); });
    var fleet = fleetSet();
    el('blrc-tbody').innerHTML = rows.length ? rows.map(function (r) {
      var bad = r.matricule && fleet.size && !fleet.has(r.matricule);
      return '<tr>' +
        '<td><input data-id="' + r.id + '" data-f="matricule" value="' + esc(r.matricule) + '" style="text-align:center;font-weight:600;' + (bad ? 'border-color:#f59e0b;' : '') + '" title="' + esc(vehicleModel(r.matricule)) + '"></td>' +
        '<td><input data-id="' + r.id + '" data-f="designation" value="' + esc(r.designation) + '" title="' + esc(r.designation) + '"></td>' +
        '<td><input data-id="' + r.id + '" data-f="po" value="' + esc(r.po) + '" placeholder="à saisir" style="text-align:center;background:#fffbeb;"></td>' +
        '<td><input data-id="' + r.id + '" data-f="appel" value="' + esc(r.appel) + '" placeholder="à saisir" style="text-align:center;background:#fffbeb;"></td>' +
        '<td><input data-id="' + r.id + '" data-f="bl" value="' + esc(r.bl) + '" style="text-align:center;"></td>' +
        '<td><input type="date" data-id="' + r.id + '" data-f="dateBL" value="' + esc(r.dateBL) + '"></td>' +
        '<td><input type="number" step="0.001" data-id="' + r.id + '" data-f="montant" value="' + esc(r.montant) + '" style="text-align:right;font-weight:600;"></td>' +
        '<td><button class="blrc-btn sec" style="padding:4px 8px;" data-del="' + r.id + '" title="Supprimer">🗑</button></td></tr>';
    }).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--secondary);padding:18px;">—</td></tr>';

    if (ui.month) {
      var c = calc(ui.supplier, ui.month);
      el('blrc-tot').innerHTML =
        '<div><span>Total Récap</span><span>' + fmt(c.total) + '</span></div>' +
        '<div><span>Engagement précédente</span><span>' + fmt(c.prev) + '</span></div>' +
        '<div><span>Total engagement</span><span>' + fmt(c.eng) + '</span></div>' +
        '<div><span>Total Marché</span><span>' + fmt(c.marche) + '</span></div>' +
        '<div class="g"><span>Taux d\'avancement</span><span>' + (c.taux * 100).toFixed(0) + ' %</span></div>' +
        '<div' + (c.debut ? '' : ' style="border-bottom:none;"') + '><span>Reste de budget</span><span style="color:' + (c.reste < 0 ? '#dc2626' : 'inherit') + '">' + fmt(c.reste) + '</span></div>' +
        (c.debut ? '<div' + (c.tempsPct == null ? ' style="border-bottom:none;"' : '') + '><span>Période du marché</span><span>' + fmtDate(c.debut) + ' → ' + (c.fin ? fmtDate(c.fin) : '…') + '</span></div>' : '') +
        (c.tempsPct != null ? '<div style="border-bottom:none;"><span>Temps écoulé / jours restants</span><span>' + (c.tempsPct * 100).toFixed(0) + ' % · ' + (c.jours >= 0 ? c.jours + ' j' : 'échu') + '</span></div>' : '');
      var out = rows.filter(function (r) { return (c.debut && r.dateBL < c.debut) || (c.fin && r.dateBL > c.fin); }).length;
      if (out) el('blrc-tot').innerHTML += '<div style="background:#fef3c7;color:#92400e;border-bottom:none;font-size:11px;">⚠ ' + out + ' BL hors période du marché</div>';
    } else el('blrc-tot').innerHTML = '';
  }

  /* ======================================================================
   * 5) EXPORT EXCEL — mise en page du modèle MODEL_RECAP.xlsx
   * ==================================================================== */
  function xlDate(iso) { return iso ? new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))) : null; }

  function buildSheet(wb, sup, ym, name) {
    var ws = wb.addWorksheet(name);
    var rows = store.records.filter(function (r) { return (r.fournisseur || '') === sup && monthOf(r.dateBL) === ym; })
      .sort(function (a, b) { return (a.dateBL || '').localeCompare(b.dateBL || '') || String(a.bl).localeCompare(String(b.bl)); });
    var c = calc(sup, ym), cfg = supCfg(sup);
    var thin = { style: 'thin' }, med = { style: 'medium' }, hair = { style: 'hair' };
    [0.3, 16, 40, 16, 16, 20, 15, 14].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });

    ws.mergeCells('B1:C1'); ws.getCell('B1').value = sup + ' ';
    ws.mergeCells('B2:C2'); ws.getCell('B2').value = 'Commande ouverte n°:' + (cfg.commande || '');
    var dates = rows.map(function (r) { return r.dateBL; }).sort();
    ws.mergeCells('B3:C3'); ws.getCell('B3').value = dates.length ? fmtDate(dates[0]) + ' ---- ' + fmtDate(dates[dates.length - 1]) : '';
    if (cfg.debut || cfg.fin) {
      ws.mergeCells('B4:C4'); ws.getCell('B4').value = 'Marché : ' + fmtDate(cfg.debut || '') + ' → ' + fmtDate(cfg.fin || '');
      ws.getCell('B4').font = { name: 'Calibri', size: 10, bold: true }; ws.getCell('B4').alignment = { horizontal: 'left' };
    }
    ['B1', 'B2', 'B3'].forEach(function (a) { ws.getCell(a).font = { name: 'Calibri', size: 12, bold: true }; ws.getCell(a).alignment = { horizontal: 'left' }; });
    var g3 = ws.getCell('G3');
    g3.value = xlDate(ym + '-01'); g3.numFmt = 'mmm-yy';
    g3.font = { name: 'Calibri', size: 12, bold: true }; g3.alignment = { horizontal: 'center' };
    g3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };

    var heads = ['Véhicule Matricule', 'designiation /article ', 'N° PO', 'N° APPEL', 'Bon de livraison n°', 'date BL', 'Mtt BL'];
    heads.forEach(function (h, i) {
      var cell = ws.getCell(6, i + 2);
      cell.value = h; cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: med, bottom: med, left: i === 0 ? med : hair, right: i === 6 ? med : hair };
    });

    var last = Math.max(15, 6 + rows.length);
    for (var r = 7; r <= last; r++) {
      var rec = rows[r - 7];
      var vals = rec ? [rec.matricule, rec.designation, rec.po || null, rec.appel || null,
      (/^\d+$/.test(rec.bl || '') ? Number(rec.bl) : (rec.bl || null)), xlDate(rec.dateBL), rec.montant] : [null, null, null, null, null, null, null];
      vals.forEach(function (v, i) {
        var cell = ws.getCell(r, i + 2);
        cell.value = v;
        cell.font = { name: 'Calibri', size: 10, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: i === 1 };
        cell.border = { left: i === 0 ? med : hair, right: i === 6 ? med : hair, bottom: r === last ? med : undefined };
        if (i === 5) cell.numFmt = 'dd/mm/yyyy';
        if (i === 6) cell.numFmt = '#,##0.000';
      });
    }

    var t0 = last + 3, lab = [['Total Récap', null], ['engagement précedente', c.prev], ['Total engagement', null], ['Total Marché', c.marche], ["Taux d'avancement", null], ['Reste de budget', null]];
    var fml = [
      { formula: 'SUM(H7:H' + last + ')', result: c.total },
      c.prev,
      { formula: 'SUM(H' + t0 + ':H' + (t0 + 1) + ')', result: c.eng },
      c.marche,
      { formula: 'IF(H' + (t0 + 3) + '=0,0,H' + (t0 + 2) + '/H' + (t0 + 3) + ')', result: c.taux },
      { formula: 'H' + (t0 + 3) + '-H' + (t0 + 2), result: c.reste }
    ];
    lab.forEach(function (l, i) {
      var row = t0 + i;
      ws.mergeCells('C' + row + ':G' + row);
      var lc = ws.getCell('C' + row), vc = ws.getCell('H' + row);
      lc.value = l[0]; vc.value = fml[i];
      lc.font = vc.font = { name: 'Arial', size: 10, bold: true };
      lc.alignment = { horizontal: 'left' };
      vc.numFmt = i === 4 ? '0%' : '#,##0.000;[Red]#,##0.000';
      [lc, vc].forEach(function (x) { x.border = { top: thin, bottom: thin, left: thin, right: thin }; });
      if (i === 4) [lc, vc].forEach(function (x) { x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } }; });
    });
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    return ws;
  }

  async function exportExcel(all) {
    if (typeof ExcelJS === 'undefined') { alert('Librairie ExcelJS non disponible — vérifiez votre connexion.'); return; }
    if (!ui.supplier && !store.records.length) { alert('Le récap est vide.'); return; }
    var sup = ui.supplier;
    var months = {};
    store.records.forEach(function (r) { if ((r.fournisseur || '') === sup && r.dateBL) months[monthOf(r.dateBL)] = 1; });
    var ml = all ? Object.keys(months).sort() : (ui.month ? [ui.month] : []);
    if (!ml.length) { alert('Aucun mois à exporter pour ce fournisseur.'); return; }
    var wb = new ExcelJS.Workbook();
    wb.creator = 'DRT Sfax — Parc Auto';
    ml.forEach(function (m) { buildSheet(wb, sup, m, monthSheet(m)); });
    var buf = await wb.xlsx.writeBuffer();
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    var tag = (sup || 'BL').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
    a.download = 'RECAP_' + tag + '_' + (all ? 'tous_les_mois' : monthSheet(ml[0])) + '.xlsx';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ======================================================================
   * 6) INITIALISATION & branchement navigation
   * ==================================================================== */
  function init() {
    store = loadStore();
    buildTab();
    renderPending();
    renderRecap();
  }

  function hook() {
    var orig = window.showTab;
    window.showTab = function (name) {
      if (typeof orig === 'function') orig.apply(this, arguments);
      if (name === 'bl-recap') {
        var bc = document.getElementById('breadcrumb-current');
        if (bc) bc.textContent = 'Récap Bons de Livraison';
        init();
      }
    };
  }

  var api = { parseBL: parseBL, findBL: findBL, findDate: findDate, findAmount: findAmount, findMatricule: findMatricule, findDesignation: findDesignation, detectSupplier: detectSupplier };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  window.blRecap = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
})();
