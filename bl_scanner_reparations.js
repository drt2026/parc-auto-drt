/* ==========================================================================
   BLOC ADDITIF — Scanner OCR "Bon de Livraison" pour import direct des
   Réparations (Parc Auto DRT Sfax).
   ==========================================================================
   Principe : on ne touche à AUCUNE logique existante de #repair-form. Ce
   module se contente d'injecter un bouton "📷 Scanner BL" dans l'onglet
   Réparations, d'extraire les champs par OCR (Tesseract.js déjà chargé dans
   admin.html), d'afficher un écran de vérification/correction, puis — pour
   chaque ligne validée — de REMPLIR le formulaire réel #repair-form et de
   déclencher son submit normal. Toute la logique de sauvegarde, de mise à
   jour des échéances, etc. reste donc exactement celle déjà en place.

   Formats de BL reconnus automatiquement (détection par mots-clés d'en-tête,
   un seul parseur commun sert de repli pour tout autre garage) :
     • IDEAL AUTO SFAX  — table Code/Désignation/Qte/Prix HT/Remise/TVA/Total HT
                           matricule ← "Commande N°" (ex : 17-349212)
     • SOREM (SPAIE)    — table Ord/Réf.Produit/Libellé/Qté/P.Unit.HT/Uté/
                           Net HT/TVA%/Net TTC ; matricule ← "Série NN-NNNNNN" ;
                           kilométrage ← "COMPTEUR: ... KM"
     • VEGA SUD (Ford)  — table Code Article/Désignation/Qté/Prix Uni./R(%)/
                           TVA/Montant HT ; matricule ← motif "NN-NNNNNN" trouvé
                           dans l'en-tête véhicule ; kilométrage ← colonne "... KM"
     • Générique        — repli sur le parseur "table à code" (fonctionne pour
                           la plupart des BL avec une colonne Total HT en fin
                           de ligne)

   Champs extraits automatiquement, quel que soit le format détecté :
     1. Matricule véhicule   (motif "NN-NNNNNN" utilisé par les 4 fournisseurs)
     2. N° Bon de Livraison  ← "Bon de Livraison N°" / "Bon Livraison N°"
     3. Date du BL
     4. Kilométrage          ← si présent sur le bon (préremplit le champ requis)
     5. Désignation + Quantité + Montant HT de chaque ligne
     6. Total HT du BL       ← sert de contrôle (Total HT / Net HT / Total)
   ========================================================================== */
(function () {
  'use strict';

  var NAVY = '#1E3A5F', ORANGE = '#EF6C00';

  function el(id) { return document.getElementById(id); }

  /* ───────────────────────── 1. Normalisation des montants ───────────────
     Certaines lignes du BL sont imprimées/scannées avec le séparateur
     décimal "mangé" par l'OCR (ex: "72957" au lieu de "72.957"). Comme tous
     les montants de ce type de BL comportent 3 décimales, on les réinsère
     quand aucun séparateur n'est détecté. */
  function normalizeAmount(tok) {
    if (tok == null) return null;
    var s = String(tok).replace(/,/g, '.').trim();
    if (/\./.test(s)) { var n0 = parseFloat(s); return isNaN(n0) ? null : n0; }
    if (/^\d{4,6}$/.test(s)) return parseFloat(s.slice(0, -3) + '.' + s.slice(-3));
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  /* ───────────────────────── 2. Détection du format de BL ────────────────
     On identifie le fournisseur par des mots-clés distinctifs de son
     en-tête. Ceci ne sert qu'à choisir le bon parseur de lignes ; toutes
     les autres informations (matricule, date, total, km) sont extraites
     par des motifs génériques qui fonctionnent sur les 3 modèles connus. */
  function detectFormat(text) {
    if (/SOREM|SAV\s*No|SPAIE/i.test(text)) return 'sorem';
    if (/VEGA\s*SUD|Alpha\s*Ford|BON\s*LIV\s*RAISON|MAT\.?\s*FISCAL/i.test(text)) return 'vegasud';
    if (/IDEAL\s*AUTO|SIAS/i.test(text)) return 'ideal';
    return 'generique';
  }
  function formatLabel(f) {
    return { sorem: 'SOREM', vegasud: 'VEGA SUD (Ford)', ideal: 'IDEAL AUTO SFAX' }[f] || '';
  }

  /* Lignes ignorées lors du parsing (en-têtes, pieds de page, coordonnées) —
     commun aux 4 modèles de BL rencontrés. */
  var skipRe = /Bon\s*(?:de\s*)?Livraison|BON\s*LIV\s*RAISON|SOCIETE|SIAS|SOREM|STE DE REPARATION|STE VEGA SUD|Agent officiel|Alpha Ford|IVECO|HELI|NEW HOLLAND|SPAIE|Ventes Pi[eè]ces|Service apr[eè]s vente|e-mail|Rue |T[ée]l\.?\s*:|TEL\s*:|FAX|Fax\s*:|T\s*\.?\s*V\s*\.?\s*A|Code client|TUNISIE TELECOM|Commande\s*N|Code\s+D[ée]signation|Code\s*Article|R[ée]f\.?\s*Produit|Libell[ée]\s|[TF]ot[ao][lI]\s*HT\.?\s*\d|Net\s*HT\.?\s*[:.]?\s*\d|Arr[êe]t[ée]|Remis\s*[àa]|Signature|^SFAX$|Client\s*:|SAV\s*No|S[ée]rie\s*\d|COMPTEUR|Ord\s+R[ée]f|Qte\s+Prix|Qt[ée]\/U\.T|D\.M\.C|MAT\.\s*FISCAL|V[ée]hicule|Chauffeur|R[ée]f\.\s*Origine|O\.R\.\s*N|Edit[ée]\s*le|Adresse|Si[eè]ge Social|Pour toute reclamation|SARL au capital|Banque|\bRIB\b|MF\s*:|RC\s*:|PAGE|Edition effectuee|Concessionnaire|www\.|Cachet et Signature|CENT |Trente|NET A PAYER|Total\s*TVA|Total\s*:/i;

  /* Retire les groupes entre parenthèses (mentions légales type "(ART 47)")
     AVANT tokenisation, pour ne pas polluer la détection des colonnes
     numériques d'une ligne. */
  function tokenizeLine(line) {
    var clean = line.replace(/\([^)]*\)/g, ' ').replace(/[\[\]!|]/g, ' ').replace(/\s+/g, ' ').trim();
    return clean ? clean.split(' ') : [];
  }
  var NUM_TOKEN_RE = /^(?:\d+[.,]?\d*|\d*[.,]\d+)$/;

  /* ─── Parseur générique "table à code" ───────────────────────────────
     Couvre IDEAL AUTO SFAX, VEGA SUD/Ford et, en repli, tout BL présentant
     une ligne "code article + désignation + colonnes numériques + total HT
     en dernière colonne". La quantité = 1er nombre après le code, le
     montant de la ligne = dernier nombre de la ligne. */
  function parseLinesCodedTable(lines) {
    var out = [];
    lines.forEach(function (line) {
      if (skipRe.test(line)) return;
      var tokens = tokenizeLine(line);
      if (tokens.length < 3) return;
      var code = tokens[0];
      var numIdxs = [];
      for (var i = 1; i < tokens.length; i++) { if (NUM_TOKEN_RE.test(tokens[i])) numIdxs.push(i); }
      if (numIdxs.length < 2) return;
      var qteIdx = numIdxs[0];
      var totalIdx = numIdxs[numIdxs.length - 1];
      if (totalIdx <= qteIdx) return;
      var designation = tokens.slice(1, qteIdx).join(' ');
      if (!designation) return;
      var qte = parseFloat(tokens[qteIdx].replace(',', '.'));
      if (isNaN(qte)) qte = 1;
      var total = normalizeAmount(tokens[totalIdx]);
      var prix = numIdxs.length >= 3 ? normalizeAmount(tokens[numIdxs[1]]) : null;
      if (total == null) return;
      out.push({ code: code, designation: designation, qte: qte, prixHT: prix, totalHT: total, include: true });
    });
    return out;
  }

  /* ─── Parseur dédié SOREM ─────────────────────────────────────────────
     Colonnes : Ord | Réf.Produit (souvent vide) | Libellé | Qté | P.Unit.HT
     | Uté (souvent vide) | Net HT | TVA% | Net TTC. On retient le Net HT
     (3ᵉ valeur numérique en partant de la fin) comme montant de la ligne,
     pour rester cohérent avec les montants HT des autres formats. */
  function parseLinesSorem(lines) {
    var out = [];
    lines.forEach(function (line) {
      if (skipRe.test(line)) return;
      var tokens = tokenizeLine(line);
      if (tokens.length < 3) return;
      if (!/^\d{1,2}$/.test(tokens[0])) return; // colonne "Ord"
      var numIdxs = [];
      for (var i = 1; i < tokens.length; i++) { if (NUM_TOKEN_RE.test(tokens[i])) numIdxs.push(i); }
      if (numIdxs.length < 3) return;
      var qtePos = numIdxs.length >= 5 ? numIdxs.length - 5 : 0;
      var netHtPos = numIdxs.length - 3;
      if (netHtPos <= qtePos) netHtPos = numIdxs.length - 1;
      var qteIdx = numIdxs[qtePos];
      var netHtIdx = numIdxs[netHtPos];
      var designation = tokens.slice(1, qteIdx).join(' ');
      if (!designation) return;
      var qte = parseFloat(tokens[qteIdx].replace(',', '.'));
      if (isNaN(qte)) qte = 1;
      var netHt = normalizeAmount(tokens[netHtIdx]);
      if (netHt == null) return;
      out.push({ code: '', designation: designation, qte: qte, prixHT: null, totalHT: netHt, include: true });
    });
    return out;
  }

  /* ─── Champs d'en-tête : motifs communs aux 4 fournisseurs ─────────── */
  function extractBLNumero(text) {
    // Tolère l'espacement des lettres parfois introduit par l'OCR sur les
    // titres stylisés ("BON LIV RAISON" au lieu de "BON LIVRAISON").
    var m = text.match(/B\s*o\s*n\s*(?:d\s*e\s*)?\s*L\s*i\s*v\s*r\s*a\s*i\s*s\s*o\s*n\s*N\s*[°o]?\s*[:.]?\s*[^\d]{0,6}(\d{4,10})/i);
    return m ? m[1] : null;
  }
  function extractDate(text) {
    var m = text.match(/Date\s*(?:du)?\s*[:\s]*?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i);
    if (!m) m = text.match(/\bDu\s+\S{2,6}\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i);
    if (!m) m = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (!m) return null;
    var d = m[1].padStart(2, '0'), mo = m[2].padStart(2, '0');
    var y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + mo + '-' + d;
  }
  function extractMatricule(text) {
    // 1) champ explicite "Commande N°" (IDEAL AUTO SFAX)
    var m = text.match(/Commande\s*N[°o]?\s*[:.]?\s*(\d{1,3})[\-\s]+(\d{3,7})/i);
    if (m) return m[1] + '-' + m[2];
    // 2) champ explicite "Série NN-NNNNNN" (SOREM)
    m = text.match(/S[ée]rie\s*[:.]?\s*(\d{1,3})[\-\s]+(\d{3,7})/i);
    if (m) return m[1] + '-' + m[2];
    // 3) repli générique : motif "NN-NNNNNN" utilisé comme identifiant
    //    véhicule sur tous les BL rencontrés (ex : VEGA SUD/Ford)
    m = text.match(/\b(\d{2})[\-\s](\d{5,7})\b/);
    if (m) return m[1] + '-' + m[2];
    return null;
  }
  function extractKm(text) {
    // Lookbehind : le nombre ne doit pas être collé à une lettre/chiffre
    // précédent (évite de capturer la fin d'un code véhicule type "BT50").
    var m = text.match(/(?<![A-Za-zÀ-ÿ0-9])(\d[\d\s]{3,8})\s*KM\b/i);
    if (!m) return null;
    var digits = m[1].replace(/\s+/g, '');
    return digits || null;
  }
  function extractTotal(text) {
    // "Total HT" (IDEAL AUTO SFAX) — tolère les confusions OCR "Fotal"/"TotaI"
    var reTotal = /[TF]ot[ao][lI]\s*HT\.?\s*[:.]?\s*(\d+[.,]\d{1,3})\b/gi;
    var mt, last = null;
    while ((mt = reTotal.exec(text)) !== null) last = mt[1];
    if (last) return normalizeAmount(last);
    // "Net HT" (SOREM)
    var reNet = /Net\s*HT\.?\s*[:.]?\s*(\d+[.,]\d{1,3})\b/gi;
    last = null;
    while ((mt = reNet.exec(text)) !== null) last = mt[1];
    if (last) return normalizeAmount(last);
    // "Total :" isolé, jamais "Total TVA :" (VEGA SUD/Ford)
    var mTot = text.match(/Total\s*:\s*(\d+[.,]\d{1,3})/i);
    if (mTot) return normalizeAmount(mTot[1]);
    return null;
  }

  /* ───────────────────────── 3. Parsing du texte OCR brut ───────────────── */
  function parseBL(raw) {
    var text = String(raw || '').replace(/\r/g, '');
    var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var format = detectFormat(text);

    var result = {
      blNumero: extractBLNumero(text),
      matricule: extractMatricule(text),
      date: extractDate(text),
      km: extractKm(text),
      totalHT: extractTotal(text),
      fournisseur: formatLabel(format),
      lignes: format === 'sorem' ? parseLinesSorem(lines) : parseLinesCodedTable(lines)
    };

    return result;
  }

  /* ───────────────────────── 4. Correspondance matricule ─────────────────
     Le champ #repair-matricule est une liste déroulante déjà peuplée par
     l'application. On cherche l'option dont la valeur ou le texte contient
     le matricule détecté par OCR (même logique que pour le Stock Pneus). */
  function matchMatriculeOption(rawMatricule) {
    var select = el('repair-matricule');
    if (!select || !rawMatricule) return null;
    var target = String(rawMatricule).replace(/\s+/g, '');
    var options = Array.prototype.slice.call(select.options);
    var found = options.find(function (o) {
      var v = (o.value || '').replace(/\s+/g, '');
      var t = (o.textContent || '').replace(/\s+/g, '');
      return v === target || t.indexOf(target) !== -1 || v.indexOf(target) !== -1;
    });
    return found ? found.value : null;
  }

  /* ───────────────────────── 5. OCR (Tesseract.js) + PDF (PDF.js) ───────
     Un fichier PDF peut contenir plusieurs BL (un par page, ou plusieurs
     BL scannés à la suite) : chaque page est rendue en image puis passée
     à l'OCR séparément, ce qui alimente une file (queue) de BL à valider
     un par un dans l'écran de révision. On peut aussi sélectionner
     plusieurs photos à la fois : chacune est traitée comme une page. */
  function ensureTesseract(cb) {
    if (window.Tesseract) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = cb;
    s.onerror = function () { setStatus('❌ Impossible de charger le moteur OCR (Tesseract). Vérifiez la connexion internet.', 'error'); };
    document.head.appendChild(s);
  }

  function ensurePDFJS(cb) {
    if (window.pdfjsLib) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.js';
    s.onload = function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.js';
      cb();
    };
    s.onerror = function () { setStatus('❌ Impossible de charger le moteur PDF. Vérifiez la connexion internet.', 'error'); };
    document.head.appendChild(s);
  }

  /* Rend chaque page d'un PDF en image PNG (dataURL) — nécessaire car
     Tesseract.js n'analyse que des images, pas des PDF directement. */
  function pdfToImages(dataUrl, cb) {
    ensurePDFJS(function () {
      window.pdfjsLib.getDocument({ url: dataUrl }).promise.then(function (pdf) {
        var pages = [];
        var n = pdf.numPages;
        function renderPage(i) {
          if (i > n) { cb(pages); return; }
          setStatus('⏳ Préparation de la page ' + i + ' / ' + n + '…', 'info');
          pdf.getPage(i).then(function (page) {
            var viewport = page.getViewport({ scale: 2.2 }); // résolution correcte pour l'OCR
            var canvas = document.createElement('canvas');
            canvas.width = viewport.width; canvas.height = viewport.height;
            var ctx = canvas.getContext('2d');
            page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
              pages.push(canvas.toDataURL('image/png'));
              renderPage(i + 1);
            });
          });
        }
        renderPage(1);
      }).catch(function (err) {
        console.error(err);
        setStatus('❌ Impossible de lire ce PDF (fichier corrompu ou protégé).', 'error');
        cb([]);
      });
    });
  }

  /* Point d'entrée : accepte un FileList (une ou plusieurs images et/ou
     PDF). Convertit tout en une liste plate d'images (dataURL), une par
     page/photo, dans l'ordre de sélection. */
  function processFiles(fileList) {
    var files = Array.prototype.slice.call(fileList);
    if (!files.length) return;
    setStatus('⏳ Préparation des documents (' + files.length + ' fichier(s))…', 'info');

    var results = new Array(files.length);
    var remaining = files.length;

    function checkDone() {
      remaining--;
      if (remaining > 0) return;
      var flat = [];
      results.forEach(function (arr) { if (arr && arr.length) flat = flat.concat(arr); });
      if (!flat.length) { setStatus('❌ Aucune page exploitable trouvée dans les fichiers sélectionnés.', 'error'); return; }
      ocrQueue(flat);
    }

    files.forEach(function (file, idx) {
      var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
      var reader = new FileReader();
      reader.onerror = function () { results[idx] = []; checkDone(); };
      if (isPdf) {
        reader.onload = function (e) { pdfToImages(e.target.result, function (pages) { results[idx] = pages; checkDone(); }); };
      } else {
        reader.onload = function (e) { results[idx] = [e.target.result]; checkDone(); };
      }
      reader.readAsDataURL(file);
    });
  }

  var blQueue = [];      // file(s) de BL analysés, en attente de validation
  var blQueueIndex = 0;

  /* ───────────────────────── 5bis. Prétraitement image (contraste) ──────
     Certains BL (papier pâle, impression matricielle légère — ex. SOREM)
     sont mal lus par l'OCR même en bonne résolution. On applique un
     traitement niveaux de gris + étirement d'histogramme (contraste)
     avant l'OCR : neutre sur une photo déjà nette, mais redonne du
     contraste aux photocopies/papiers délavés. N'affecte que l'image
     envoyée à Tesseract — aucune logique de parsing n'est modifiée. */
  function preprocessDataUrl(dataUrl, opts, cb) {
    opts = opts || {};
    var img = new Image();
    img.onload = function () {
      var scale = opts.scale || 1;
      var canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var d = imgData.data;
        var n = d.length / 4;
        var gray = new Uint8ClampedArray(n);
        for (var i = 0; i < n; i++) {
          gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
        }
        // Étirement d'histogramme : on ignore les 0.5% de pixels les plus
        // extrêmes de chaque côté pour ne pas se faire fausser par du bruit.
        var sorted = Array.prototype.slice.call(gray).sort(function (a, b) { return a - b; });
        var lo = sorted[Math.floor(n * 0.005)] || 0;
        var hi = sorted[Math.ceil(n * 0.995) - 1] || 255;
        if (hi <= lo) { hi = lo + 1; }
        var threshold = opts.binarize ? (lo + (hi - lo) * (opts.thresholdRatio || 0.6)) : null;
        for (var j = 0; j < n; j++) {
          var v = (gray[j] - lo) * 255 / (hi - lo);
          if (v < 0) v = 0; if (v > 255) v = 255;
          if (threshold != null) v = v > ((threshold - lo) * 255 / (hi - lo)) ? 255 : 0;
          d[j * 4] = d[j * 4 + 1] = d[j * 4 + 2] = v;
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (e) {
        console.error('Prétraitement image ignoré :', e);
      }
      cb(canvas.toDataURL('image/png'));
    };
    img.onerror = function () { cb(dataUrl); }; // en cas d'échec, on retombe sur l'image d'origine
    img.src = dataUrl;
  }

  /* Lance l'OCR séquentiellement sur chaque image de la file, construit
     un BL analysé par page, puis ouvre l'écran de révision sur le 1er.
     Si la 1ère passe (contraste doux) ne détecte aucune ligne d'article,
     on retente automatiquement avec un contraste plus fort + agrandissement
     (utile sur les BL très pâles) avant d'abandonner cette page. */
  function ocrQueue(dataUrls) {
    ensureTesseract(function () {
      blQueue = [];
      var i = 0;
      function recognizeAndParse(dataUrl, cb) {
        Tesseract.recognize(dataUrl, 'fra', { tessedit_pageseg_mode: '4' })
          .then(function (res) {
            var raw = (res && res.data && res.data.text) || '';
            cb(parseBL(raw));
          })
          .catch(function (err) { console.error(err); cb(null); });
      }
      function next() {
        if (i >= dataUrls.length) {
          if (!blQueue.length) { setStatus('❌ Aucun BL exploitable détecté sur ces pages.', 'error'); return; }
          blQueueIndex = 0;
          showQueueItem(0);
          return;
        }
        setStatus('⏳ Analyse OCR — page ' + (i + 1) + ' / ' + dataUrls.length + ' (peut prendre 10–20 s chacune)…', 'info');
        preprocessDataUrl(dataUrls[i], { scale: 1 }, function (enhancedUrl) {
          recognizeAndParse(enhancedUrl, function (parsed) {
            if (parsed && parsed.lignes.length > 0) { blQueue.push(parsed); i++; next(); return; }
            // Repli : contraste renforcé + agrandissement, pour les BL très pâles
            setStatus('⏳ Page ' + (i + 1) + ' peu lisible — nouvel essai avec contraste renforcé…', 'info');
            preprocessDataUrl(dataUrls[i], { scale: 1.6, binarize: true, thresholdRatio: 0.65 }, function (strongUrl) {
              recognizeAndParse(strongUrl, function (parsed2) {
                blQueue.push((parsed2 && parsed2.lignes.length > 0) ? parsed2 : (parsed || parsed2 || { blNumero: null, matricule: null, date: null, km: null, totalHT: null, fournisseur: '', lignes: [] }));
                i++; next();
              });
            });
          });
        });
      }
      next();
    });
  }

  /* Affiche l'élément n° idx de la file dans l'écran de révision, avec
     une barre de navigation Précédent/Suivant si plusieurs BL sont en
     attente (cas d'un PDF multi-pages ou d'un lot de photos). */
  function showQueueItem(idx) {
    blQueueIndex = idx;
    renderPreview(blQueue[idx]);
    var nav = el('bl-scan-queue-nav');
    if (blQueue.length > 1) {
      nav.style.display = 'flex';
      el('bl-scan-queue-label').textContent = 'BL ' + (idx + 1) + ' / ' + blQueue.length;
      el('bl-scan-prev-btn').disabled = idx === 0;
      el('bl-scan-next-btn').disabled = idx === blQueue.length - 1;
    } else {
      nav.style.display = 'none';
    }
  }

  /* ───────────────────────── 6. Interface (modal) ─────────────────────── */
  function injectStylesAndModal() {
    if (el('bl-scan-modal')) return;

    var style = document.createElement('style');
    style.textContent =
      '.bl-scan-overlay{display:none;position:fixed;inset:0;z-index:9998;background:rgba(15,23,42,0.55);align-items:center;justify-content:center;padding:16px;}' +
      '.bl-scan-overlay.open{display:flex;}' +
      '.bl-scan-modal{background:#fff;border-radius:16px;width:min(880px,96vw);max-height:92vh;overflow:auto;box-shadow:0 24px 64px rgba(0,0,0,0.25);}' +
      '.bl-scan-header{background:' + NAVY + ';color:#fff;padding:18px 22px;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center;}' +
      '.bl-scan-header h3{margin:0;font-size:16px;font-weight:800;}' +
      '.bl-scan-close{background:transparent;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;}' +
      '.bl-scan-body{padding:20px 22px;}' +
      '.bl-scan-status{font-size:13px;padding:10px 12px;border-radius:8px;margin-bottom:14px;}' +
      '.bl-scan-headfields{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px;}' +
      '.bl-scan-headfields label{display:block;font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;}' +
      '.bl-scan-headfields input,.bl-scan-headfields select{width:100%;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;}' +
      '.bl-scan-table{width:100%;border-collapse:collapse;font-size:12.5px;}' +
      '.bl-scan-table th{background:#f1f5f9;color:#334155;text-align:left;padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;}' +
      '.bl-scan-table td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;}' +
      '.bl-scan-table input[type=text],.bl-scan-table input[type=number]{width:100%;padding:5px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:12.5px;}' +
      '.bl-scan-total-badge{background:#fff7ed;border:1px solid ' + ORANGE + ';color:#9a3412;padding:8px 12px;border-radius:8px;font-size:12.5px;font-weight:700;margin:12px 0;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;}' +
      '.bl-scan-actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;}' +
      '.bl-scan-btn{padding:10px 18px;border-radius:8px;border:none;font-weight:700;font-size:13px;cursor:pointer;}' +
      '.bl-scan-btn-primary{background:' + ORANGE + ';color:#fff;}' +
      '.bl-scan-btn-secondary{background:#f1f5f9;color:#334155;}' +
      '.bl-scan-btn:disabled{opacity:.5;cursor:not-allowed;}';
    document.head.appendChild(style);

    var overlay = document.createElement('div');
    overlay.className = 'bl-scan-overlay';
    overlay.id = 'bl-scan-modal';
    overlay.innerHTML =
      '<div class="bl-scan-modal">' +
        '<div class="bl-scan-header"><h3>📷 Scanner un Bon de Livraison</h3><button class="bl-scan-close" id="bl-scan-close-btn">&times;</button></div>' +
        '<div class="bl-scan-body">' +
          '<div class="bl-scan-status" id="bl-scan-status" style="display:none;"></div>' +
          '<div id="bl-scan-upload-zone">' +
            '<p style="font-size:13px;color:#64748b;margin-bottom:12px;">Prenez une photo, importez une ou plusieurs images, ou un PDF (chaque page sera traitée comme un BL séparé). Matricule, désignations et montants seront extraits automatiquement — à vérifier avant import.</p>' +
            '<input type="file" id="bl-scan-file-input" accept="image/*,application/pdf" capture="environment" multiple style="display:none;">' +
            '<button class="bl-scan-btn bl-scan-btn-primary" id="bl-scan-pick-btn">📷 Choisir photo(s) / PDF</button>' +
          '</div>' +
          '<div id="bl-scan-review" style="display:none;">' +
            '<div id="bl-scan-queue-nav" style="display:none;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;">' +
              '<button class="bl-scan-btn bl-scan-btn-secondary" id="bl-scan-prev-btn" style="padding:6px 12px;">◀ Précédent</button>' +
              '<span id="bl-scan-queue-label" style="font-weight:800;font-size:12.5px;color:' + NAVY + ';"></span>' +
              '<button class="bl-scan-btn bl-scan-btn-secondary" id="bl-scan-next-btn" style="padding:6px 12px;">Suivant ▶</button>' +
            '</div>' +
            '<div class="bl-scan-headfields">' +
              '<div><label>Véhicule (matricule)</label><select id="bl-scan-matricule"></select></div>' +
              '<div><label>N° Bon de Livraison</label><input type="text" id="bl-scan-blnum"></div>' +
              '<div><label>Date</label><input type="date" id="bl-scan-date"></div>' +
              '<div><label>Kilométrage *</label><input type="number" id="bl-scan-km" placeholder="Requis pour l\'import"></div>' +
            '</div>' +
            '<div class="bl-scan-total-badge">' +
              '<span>💰 Total HT imprimé sur le BL : <span id="bl-scan-total-bl">—</span> DT</span>' +
              '<span>➕ Somme des lignes cochées : <span id="bl-scan-total-lignes">0.000</span> DT</span>' +
            '</div>' +
            '<div style="overflow-x:auto;">' +
              '<table class="bl-scan-table">' +
                '<thead><tr><th></th><th>Désignation</th><th>Qté</th><th>Total HT (DT)</th></tr></thead>' +
                '<tbody id="bl-scan-lines-body"></tbody>' +
              '</table>' +
            '</div>' +
            '<div class="bl-scan-actions">' +
              '<button class="bl-scan-btn bl-scan-btn-primary" id="bl-scan-import-btn">✅ Importer les lignes cochées</button>' +
              '<button class="bl-scan-btn bl-scan-btn-secondary" id="bl-scan-rescan-btn">🔄 Rescanner</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    el('bl-scan-close-btn').addEventListener('click', closeModal);
    el('bl-scan-pick-btn').addEventListener('click', function () { el('bl-scan-file-input').click(); });
    el('bl-scan-file-input').addEventListener('change', function (evt) {
      var files = evt.target.files;
      evt.target.value = '';
      if (files && files.length) processFiles(files);
    });
    el('bl-scan-prev-btn').addEventListener('click', function () { if (blQueueIndex > 0) showQueueItem(blQueueIndex - 1); });
    el('bl-scan-next-btn').addEventListener('click', function () { if (blQueueIndex < blQueue.length - 1) showQueueItem(blQueueIndex + 1); });
    el('bl-scan-rescan-btn').addEventListener('click', function () {
      el('bl-scan-review').style.display = 'none';
      el('bl-scan-upload-zone').style.display = 'block';
      el('bl-scan-queue-nav').style.display = 'none';
      blQueue = []; blQueueIndex = 0;
      setStatus('', null);
    });
  }

  function setStatus(text, type) {
    var box = el('bl-scan-status');
    if (!box) return;
    if (!text) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    if (type === 'success') { box.style.background = '#f0fdf4'; box.style.color = '#065f46'; box.style.border = '1px solid #10b981'; }
    else if (type === 'error') { box.style.background = '#fef2f2'; box.style.color = '#991b1b'; box.style.border = '1px solid #ef4444'; }
    else { box.style.background = '#eff6ff'; box.style.color = '#1e40af'; box.style.border = '1px solid #bfdbfe'; }
    box.textContent = text;
  }

  var currentParsed = null;

  function renderPreview(parsed) {
    currentParsed = parsed;
    el('bl-scan-upload-zone').style.display = 'none';
    el('bl-scan-review').style.display = 'block';

    // Champ matricule : proposer la correspondance détectée dans la liste réelle
    var select = el('bl-scan-matricule');
    var sourceSelect = el('repair-matricule');
    select.innerHTML = sourceSelect ? sourceSelect.innerHTML : '<option value="">—</option>';
    var matched = matchMatriculeOption(parsed.matricule);
    if (matched) select.value = matched;
    else if (parsed.matricule) {
      var opt = document.createElement('option');
      opt.value = parsed.matricule; opt.textContent = parsed.matricule + ' (non reconnu — à vérifier)';
      select.insertBefore(opt, select.firstChild);
      select.value = parsed.matricule;
    }

    el('bl-scan-blnum').value = parsed.blNumero || '';
    el('bl-scan-date').value = parsed.date || '';
    var kmField = el('bl-scan-km');
    if (kmField && parsed.km && !kmField.value) kmField.value = parsed.km;
    el('bl-scan-total-bl').textContent = parsed.totalHT != null ? parsed.totalHT.toFixed(3) : '—';

    var tbody = el('bl-scan-lines-body');
    tbody.innerHTML = '';
    parsed.lignes.forEach(function (ligne, idx) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="checkbox" data-idx="' + idx + '" class="bl-line-chk" checked></td>' +
        '<td><input type="text" data-idx="' + idx + '" class="bl-line-desig" value="' + ligne.designation.replace(/"/g, '&quot;') + '"></td>' +
        '<td><input type="number" step="0.001" data-idx="' + idx + '" class="bl-line-qte" value="' + ligne.qte + '" style="width:70px;"></td>' +
        '<td><input type="number" step="0.001" data-idx="' + idx + '" class="bl-line-total" value="' + ligne.totalHT.toFixed(3) + '" style="width:90px;"></td>';
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('input').forEach(function (inp) { inp.addEventListener('input', updateLignesTotal); });
    updateLignesTotal();

    var fournisseurTxt = parsed.fournisseur ? ' — format ' + parsed.fournisseur + ' détecté' : '';
    if (parsed.lignes.length === 0) {
      setStatus('⚠️ Aucune ligne d\'article détectée automatiquement' + fournisseurTxt + ' — vérifiez la netteté de la photo ou ajoutez les lignes manuellement après import.', 'error');
    } else {
      setStatus('✅ ' + parsed.lignes.length + ' ligne(s) détectée(s)' + fournisseurTxt + ' — vérifiez avant import (le total du BL sert de contrôle).', 'success');
    }
  }

  function updateLignesTotal() {
    var sum = 0;
    document.querySelectorAll('.bl-line-chk').forEach(function (chk) {
      if (chk.checked) {
        var idx = chk.getAttribute('data-idx');
        var totInp = document.querySelector('.bl-line-total[data-idx="' + idx + '"]');
        var v = totInp ? parseFloat(totInp.value) : 0;
        if (!isNaN(v)) sum += v;
      }
    });
    el('bl-scan-total-lignes').textContent = sum.toFixed(3);
  }

  /* ───────────────────────── 7. Import réel — réutilise #repair-form ────
     Pour chaque ligne cochée, on remplit le vrai formulaire de réparation
     puis on déclenche son submit habituel : aucune logique de sauvegarde,
     de mise à jour d'échéance, etc. n'est dupliquée ou contournée. */
  function importLignes() {
    if (!currentParsed) return;
    var matricule = el('bl-scan-matricule').value;
    var blNum = el('bl-scan-blnum').value.trim();
    var date = el('bl-scan-date').value;
    var km = el('bl-scan-km').value;

    if (!matricule) { setStatus('❌ Sélectionnez un véhicule avant d\'importer.', 'error'); return; }
    if (!date) { setStatus('❌ Renseignez la date avant d\'importer.', 'error'); return; }
    if (!km) { setStatus('❌ Le kilométrage est requis par le formulaire de réparation.', 'error'); return; }

    var lignesAImporter = [];
    document.querySelectorAll('.bl-line-chk').forEach(function (chk) {
      if (!chk.checked) return;
      var idx = chk.getAttribute('data-idx');
      var desig = document.querySelector('.bl-line-desig[data-idx="' + idx + '"]').value.trim();
      var total = parseFloat(document.querySelector('.bl-line-total[data-idx="' + idx + '"]').value);
      if (!desig || isNaN(total)) return;
      lignesAImporter.push({ designation: desig, montant: total });
    });

    if (!lignesAImporter.length) { setStatus('❌ Aucune ligne cochée à importer.', 'error'); return; }

    var repairForm = el('repair-form');
    if (!repairForm) { setStatus('❌ Formulaire de réparation introuvable.', 'error'); return; }

    var i = 0;
    setStatus('⏳ Import de ' + lignesAImporter.length + ' ligne(s) en cours…', 'info');

    function importNext() {
      if (i >= lignesAImporter.length) {
        var hasNext = blQueueIndex < blQueue.length - 1;
        setStatus('✅ ' + lignesAImporter.length + ' réparation(s) importée(s) depuis le BL' + (blNum ? ' n°' + blNum : '') + '.' + (hasNext ? ' Passage au BL suivant…' : ''), 'success');
        if (typeof window.showTab === 'function') window.showTab('repairs');
        if (hasNext) {
          setTimeout(function () { showQueueItem(blQueueIndex + 1); }, 1200);
        } else {
          setTimeout(closeModal, 1400);
        }
        return;
      }
      var ligne = lignesAImporter[i];
      el('repair-matricule').value = matricule;
      el('repair-type').value = 'Réparation';
      el('repair-date').value = date;
      el('repair-km').value = km;
      var suffix = (blNum ? ' — BL n°' + blNum : '') + (currentParsed.fournisseur ? ' (' + currentParsed.fournisseur + ')' : '');
      el('repair-designation').value = ligne.designation + suffix;
      el('repair-montant').value = ligne.montant;
      var chauffeurEl = el('repair-chauffeur'); if (chauffeurEl) chauffeurEl.value = '';
      var nvEl = el('repair-next-vidange'); if (nvEl) nvEl.value = '';
      var ncEl = el('repair-next-chaine'); if (ncEl) ncEl.value = '';
      var nvisEl = el('repair-next-visite'); if (nvisEl) nvisEl.value = '';

      if (typeof repairForm.requestSubmit === 'function') repairForm.requestSubmit();
      else repairForm.dispatchEvent(new Event('submit', { cancelable: true }));

      i++;
      setTimeout(importNext, 350); // laisse le temps à la logique existante de traiter chaque soumission
    }
    importNext();
  }

  function openModal() {
    injectStylesAndModal();
    el('bl-scan-modal').classList.add('open');
    el('bl-scan-upload-zone').style.display = 'block';
    el('bl-scan-review').style.display = 'none';
    el('bl-scan-queue-nav').style.display = 'none';
    blQueue = []; blQueueIndex = 0;
    setStatus('', null);
    if (!el('bl-scan-import-btn').dataset.bound) {
      el('bl-scan-import-btn').addEventListener('click', importLignes);
      el('bl-scan-import-btn').dataset.bound = '1';
    }
  }
  function closeModal() {
    var m = el('bl-scan-modal');
    if (m) m.classList.remove('open');
    currentParsed = null;
    blQueue = []; blQueueIndex = 0;
  }
  window.openBLScanner = openModal;

  /* ───────────────────────── 8. Injection du bouton ──────────────────── */
  function injectButton() {
    if (el('bl-scan-open-btn')) return;
    var repairsTab = el('tab-repairs');
    if (!repairsTab) return;
    // On cible l'en-tête de la carte "Historique des réparations" (celle qui contient le bouton "➕ Nouvelle")
    var newBtn = Array.prototype.find.call(repairsTab.querySelectorAll('button'), function (b) {
      return /Nouvelle/i.test(b.textContent) && /showTab\('add-repair'\)/.test(b.getAttribute('onclick') || '');
    });
    if (!newBtn || !newBtn.parentElement) return;
    var scanBtn = document.createElement('button');
    scanBtn.className = 'btn btn-primary';
    scanBtn.id = 'bl-scan-open-btn';
    scanBtn.style.background = NAVY;
    scanBtn.textContent = '📷 Scanner BL';
    scanBtn.addEventListener('click', openModal);
    newBtn.parentElement.insertBefore(scanBtn, newBtn);
  }

  function init() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (el('tab-repairs')) { injectButton(); clearInterval(iv); }
      if (tries > 40) clearInterval(iv);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
/* ==========================================================================
   FIN BLOC ADDITIF — Scanner OCR "Bon de Livraison"
   ========================================================================== */
