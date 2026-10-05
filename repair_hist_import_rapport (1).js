/**
 * ============================================================
 *  REPAIR_HIST_IMPORT_RAPPORT.JS — Import des RAPPORTS ANNUELS
 *  depuis le classeur "RAPPORT 2025-2026" avec ses 2 feuilles :
 *    - "depenses anciennes" : dépenses par véhicule et par année (2020 → 2025)
 *    - "STAT CSC"           : utilisateur (chauffeur) + données CSC / parc de chaque véhicule
 *
 *  Alimente le RAPPORT ANNUEL (rapport_annuel.js, rapport_global.js) :
 *    - dépenses  -> "parcAutoRepairHist_v1" (+ compteurs vidange/chaîne/accident/lavage/joint/pneus)
 *    - CSC / parc -> "parcAutoCscHist_v1" + pa.data.cscHistData (même enregistrement que csc_rapport.js)
 *
 *  Les dépenses sont écrites dans le MÊME stockage que le bouton existant
 *  "Importer Excel (historique)" (localStorage "parcAutoRepairHist_v1", même
 *  structure) : le tableau de bord, l'export Excel et le PowerPoint des
 *  rapports annuels les affichent donc sans aucune modification.
 *
 *  Module 100% additif :
 *   - ne modifie AUCUNE fonction existante (handleRepairHistImport, dashboard…)
 *   - ajoute son propre bouton à côté de "Importer Excel (historique)"
 *
 *  À inclure dans admin.html APRÈS repair_rapport.js :
 *  <script src="repair_hist_import_rapport.js?v=1"></script>
 * ============================================================
 */
(function () {
  'use strict';

  const root = (typeof window !== 'undefined') ? window : globalThis;
  if (root.__repairHistImportRapportLoaded) return;
  root.__repairHistImportRapportLoaded = true;

  const KEY = 'parcAutoRepairHist_v1';   // identique à repair_rapport.js

  /* ── Helpers ─────────────────────────────────────────────── */
  const str = (v) => String(v === null || v === undefined ? '' : v).trim();
  const normPlate = (s) => str(s).replace(/\s+/g, '');                 // "17-355 555" -> "17-355555"
  const num = (v) => { const n = parseFloat(String(v === null || v === undefined ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
  const int = (v) => parseInt(v) || 0;

  function readTable(ws) {
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    let h = raw.findIndex(r => r.some(c => /immatriculation/i.test(str(c))));
    if (h < 0) return null;
    const headers = raw[h].map(str);
    const col = (patterns) => { for (const p of patterns) { const i = headers.findIndex(x => p.test(x)); if (i >= 0) return i; } return -1; };
    const years = [];
    headers.forEach((x, i) => { const n = parseInt(x); if (/^\d{4}$/.test(x) && n >= 2000 && n <= 2100) years.push({ year: n, idx: i }); });
    return { headers, rows: raw.slice(h + 1), col, years };
  }

  /* ── Données CSC (feuille STAT CSC) — même structure que csc_rapport.js ── */
  const CSC_KEY = 'parcAutoCscHist_v1';
  function normalizeCscLabel(raw) {
    if (!raw) return 'Non renseigné';
    return String(raw).replace(/\s+/g, ' ').trim().replace(/^C\s*S\s*C\b/i, 'CSC');
  }
  function buildCsc(wb, existing) {
    const name = wb.SheetNames.find(n => /^stat(\s|$)/i.test(n.trim()));
    if (!name) return null;
    const T = readTable(wb.Sheets[name]);
    if (!T || !T.years.length) return null;
    const c = {
      mat: T.col([/immatriculation/i]), mod: T.col([/mod[eè]le/i]), ene: T.col([/[eé]nergie/i]),
      sub: T.col([/subdivision/i]), anc: T.col([/anciennet/i]), gen: T.col([/^genre$/i]), sit: T.col([/situation/i])
    };
    if (c.mat < 0 || c.sub < 0) return null;
    const data = { vehicles: ((existing && existing.vehicles) || []).map(v => Object.assign({}, v, { montants: Object.assign({}, v.montants) })), years: [] };
    const by = {};
    data.vehicles.forEach(v => { v.matricule = normPlate(v.matricule); by[v.matricule] = v; });   // fusionne aussi les anciennes plaques "17-355 555"
    const val = (r, i) => (i >= 0 && r[i] !== '' && r[i] !== undefined) ? r[i] : null;
    let nb = 0;
    T.rows.forEach(r => {
      const m = normPlate(r[c.mat]);
      if (!m || /^immat|^total/i.test(m)) return;
      let rec = by[m];
      if (!rec) {
        rec = { matricule: m, modele: val(r, c.mod), energie: val(r, c.ene), subdivision: normalizeCscLabel(val(r, c.sub)),
                anciennete: val(r, c.anc), genre: val(r, c.gen), situation: val(r, c.sit), montants: {} };
        by[m] = rec; data.vehicles.push(rec);
      } else {
        rec.subdivision = normalizeCscLabel(val(r, c.sub) || rec.subdivision);
        if (val(r, c.mod)) rec.modele = val(r, c.mod);
        if (val(r, c.sit)) rec.situation = val(r, c.sit);
      }
      T.years.forEach(y => { const v = r[y.idx]; rec.montants[String(y.year)] = (typeof v === 'number') ? v : (parseFloat(v) || 0); });
      nb++;
    });
    const ys = {}; data.vehicles.forEach(v => Object.keys(v.montants).forEach(y => { ys[y] = true; }));
    data.years = Object.keys(ys).sort();
    return { name: name, data: data, nbRows: nb, nbVehicles: data.vehicles.length };
  }

  /* ── Lecture des 2 feuilles → entrées par année (fonction pure, testable) ── */
  function buildEntries(wb, existing) {
    existing = existing || {};
    const nameDep = wb.SheetNames.find(n => /d[ée]penses?\s*anciennes?/i.test(n));
    const nameStat = wb.SheetNames.find(n => /^stat(\s|$)/i.test(n.trim()));
    if (!nameDep) return { error: 'Feuille "depenses anciennes" introuvable' };

    const D = readTable(wb.Sheets[nameDep]);
    if (!D || !D.years.length) return { error: 'Feuille "depenses anciennes" : colonnes Immatriculation / années introuvables' };

    const iImmat = D.col([/immatriculation/i]);
    const iMarque = D.col([/marque/i]), iGenre = D.col([/genre/i]);
    const iDiv = D.col([/^division$/i, /division/i]), iSub = D.col([/subdivision/i]), iAnc = D.col([/anciennet/i]);
    const iVid = D.col([/nb\s*vidange/i]), iCha = D.col([/nb\s*chaine/i]), iAcc = D.col([/nb\s*accident/i]);
    const iLav = D.col([/^(nb\s*)?lavage/i]), iJoi = D.col([/joint/i]), iPne = D.col([/pneumatique|^nb\s*pneu/i]);
    const lastYear = Math.max.apply(null, D.years.map(y => y.year));

    // Feuille STAT : utilisateur (chauffeur) + montants pour contrôle croisé
    const users = new Map();       // plaque -> utilisateur
    const statRows = new Map();    // plaque -> ligne (pour comparer les montants)
    let S = null;
    if (nameStat) {
      S = readTable(wb.Sheets[nameStat]);
      if (S) {
        const sI = S.col([/immatriculation/i]), sU = S.col([/utilisateur|chauffeur/i]);
        S.rows.forEach(r => {
          const p = normPlate(r[sI]); if (!p || /^immat/i.test(p)) return;
          statRows.set(p, r);
          if (sU >= 0 && str(r[sU])) users.set(p, str(r[sU]).replace(/\s+/g, ' '));
        });
      }
    }

    const out = {};                // année -> { plaque -> entrée }
    D.years.forEach(y => { out[y.year] = {}; });
    const plates = new Set();
    const warnings = { renamed: [], mismatches: [], statOnly: [], noUser: [] };
    const skippedLeadingZero = {};

    D.rows.forEach(r => {
      const rawP = str(r[iImmat]);
      const p = normPlate(rawP);
      if (!p || /^immat|^total/i.test(p)) return;
      if (rawP !== p) warnings.renamed.push(rawP + ' → ' + p);
      plates.add(p);

      // 1ère année avec une dépense : avant, le véhicule n'était pas encore dans le parc
      const sorted = D.years.slice().sort((a, b) => a.year - b.year);
      const first = sorted.find(y => num(r[y.idx]) !== 0);

      sorted.forEach(y => {
        if (!first || y.year < first.year) { skippedLeadingZero[y.year + '|' + p] = true; return; }
        // Les compteurs (vidanges, chaînes, accidents) du fichier correspondent à l'année la plus récente (2025)
        const isLast = y.year === lastYear;
        const prev = (existing[String(y.year)] || {})[p] || {};
        const prevChauf = prev.chauffeur && prev.chauffeur !== '—' ? prev.chauffeur : '';
        out[y.year][p] = {
          matricule: p,
          chauffeur: users.get(p) || prevChauf || '—',
          marque: iMarque >= 0 ? str(r[iMarque]) : '—',
          genre: iGenre >= 0 ? str(r[iGenre]) : '',
          division: iDiv >= 0 ? str(r[iDiv]) : '—',
          subdivision: iSub >= 0 ? str(r[iSub]) : '',
          anciennete: iAnc >= 0 ? str(r[iAnc]) : '',
          montant: +num(r[y.idx]).toFixed(2),
          nbVidange: isLast && iVid >= 0 ? int(r[iVid]) : 0,
          nbChaine: isLast && iCha >= 0 ? int(r[iCha]) : 0,
          nbAccident: isLast && iAcc >= 0 ? int(r[iAcc]) : 0,
          nbLavage: isLast && iLav >= 0 ? int(r[iLav]) : 0,
          nbJointCulasse: isLast && iJoi >= 0 ? int(r[iJoi]) : 0,
          nbPneumatique: isLast && iPne >= 0 ? int(r[iPne]) : 0
        };
      });
    });

    // Contrôle croisé avec la feuille STAT
    if (S) {
      const sYears = S.years;
      statRows.forEach((r, p) => {
        if (!plates.has(p)) { warnings.statOnly.push(p); return; }
        sYears.forEach(sy => {
          const e = (out[sy.year] || {})[p];
          if (!e) return;
          const a = num(r[sy.idx]);
          if (Math.abs(a - e.montant) > 0.01) warnings.mismatches.push(p + ' ' + sy.year + ' : depenses=' + e.montant + ' / STAT=' + a);
        });
      });
      plates.forEach(p => { if (statRows.has(p) && !users.has(p)) warnings.noUser.push(p); });
    }

    return {
      sheets: { dep: nameDep, stat: nameStat || null },
      years: D.years.map(y => y.year).sort(),
      lastYear: lastYear,
      entries: out,
      vehicles: plates.size,
      withUser: Array.from(plates).filter(p => users.has(p)).length,
      skippedLeadingZero: skippedLeadingZero,
      warnings: warnings
    };
  }

  /* ── Fusion dans le stockage existant (sans doublons de plaque) ── */
  function mergeInto(store, res) {
    const stats = { written: 0, removedDup: 0 };
    res.years.forEach(year => {
      const y = String(year);
      const target = store[y] || {};
      const normIndex = {};
      Object.keys(target).forEach(k => { normIndex[normPlate(k)] = k; });

      // nettoyage : ancienne entrée "17-355 555" ou entrée à 0 avant l'arrivée du véhicule (anciens imports)
      Object.keys(res.entries[year]).forEach(p => {
        const old = normIndex[p];
        if (old && old !== p) { delete target[old]; stats.removedDup++; }
      });
      Object.keys(res.skippedLeadingZero).forEach(k => {
        const [sy, p] = k.split('|');
        if (sy !== y) return;
        const old = normIndex[p];
        if (old && target[old] && (target[old].montant || 0) === 0) { delete target[old]; stats.removedDup++; }
      });

      Object.keys(res.entries[year]).forEach(p => { target[p] = res.entries[year][p]; stats.written++; });
      store[y] = target;
    });
    return stats;
  }

  /* Enregistrement CSC : identique à saveCscHistData de csc_rapport.js (localStorage + pa.data + synchro cloud) */
  function saveCsc(data) {
    localStorage.setItem(CSC_KEY, JSON.stringify(data));
    try {
      const pa = root.parcAuto;
      if (pa && pa.data) { pa.data.cscHistData = data; if (typeof pa.saveData === 'function') pa.saveData(); }
    } catch (e) { console.warn('[Rapport import] synchro cloud CSC échouée:', e); }
  }
  function refreshCscUi(data) {
    try {
      const sel = document.getElementById('csc-hist-year-select');
      if (sel) {
        sel.innerHTML = '';
        const all = document.createElement('option'); all.value = 'all'; all.textContent = 'Toutes années (cumulé)'; sel.appendChild(all);
        (data.years || []).forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; sel.appendChild(o); });
        sel.value = 'all';
      }
      if (typeof root.renderCscHistDashboard === 'function') root.renderCscHistDashboard();
      if (typeof root.renderCscEvolutionChart === 'function') root.renderCscEvolutionChart();
    } catch (e) { console.warn('[Rapport import] rafraîchissement CSC:', e); }
  }

  /* ── Import depuis le navigateur ─────────────────────────── */
  function handleRapportImport(evt) {
    const file = evt.target.files[0];
    if (!file) return;
    const status = document.getElementById('repair-hist-import-status');
    const say = (t) => { if (status) status.textContent = t; };
    if (typeof XLSX === 'undefined') { say('❌ Librairie Excel non chargée. Rafraîchissez la page.'); evt.target.value = ''; return; }

    say('⏳ Lecture du fichier...');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        let store = {};
        try { store = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (x) { store = {}; }

        const res = buildEntries(wb, store);
        if (res.error) { say('❌ ' + res.error); return; }
        let cscExisting = null;
        try { cscExisting = JSON.parse(localStorage.getItem(CSC_KEY)); } catch (x) { cscExisting = null; }
        try { const pa0 = root.parcAuto; if (pa0 && pa0.data && pa0.data.cscHistData && (pa0.data.cscHistData.vehicles || []).length) cscExisting = pa0.data.cscHistData; } catch (x) { /* ignore */ }
        const csc = buildCsc(wb, cscExisting);

        const w = res.warnings;
        const tot = res.years.map(y => y + ' : ' + Object.keys(res.entries[y]).length + ' véh. — ' +
          Object.values(res.entries[y]).reduce((s, e) => s + e.montant, 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' DT');
        const msg =
          'Import des rapports annuels\n\n' +
          '• Feuille dépenses : « ' + res.sheets.dep + ' »\n' +
          '• Feuille STAT : ' + (res.sheets.stat ? '« ' + res.sheets.stat + ' » (' + res.withUser + ' utilisateurs reportés comme chauffeur' + (csc ? ' ; ' + csc.nbVehicles + ' véhicules pour la section CSC / parc du rapport annuel)' : ')') : 'NON TROUVÉE — chauffeurs et section CSC non renseignés') + '\n\n' +
          res.vehicles + ' véhicules, années ' + res.years[0] + ' à ' + res.years[res.years.length - 1] + ' :\n   ' + tot.join('\n   ') + '\n\n' +
          '• Compteurs vidanges / chaînes / accidents : rattachés à ' + res.lastYear + ' uniquement\n' +
          '• Années à 0 avant la 1ère dépense d\'un véhicule : ignorées (véhicule pas encore au parc)\n' +
          (w.renamed.length ? '• Matricule corrigé (espace retiré) : ' + w.renamed.join(', ') + '\n' : '') +
          (w.mismatches.length ? '• Montants différents entre les 2 feuilles (« depenses anciennes » retenue) : ' + w.mismatches.length + '\n   ' + w.mismatches.slice(0, 8).join('\n   ') + (w.mismatches.length > 8 ? '\n   …' : '') + '\n' : '') +
          (w.statOnly.length ? '• Dans STAT mais absent de « depenses anciennes » : ' + w.statOnly.join(', ') + ' (importé dans la section CSC seulement, pas dans les dépenses)\n' : '') +
          '\nLes données de ces années seront mises à jour. Continuer ?';
        if (!confirm(msg)) { say('Import annulé'); return; }

        const stats = mergeInto(store, res);
        localStorage.setItem(KEY, JSON.stringify(store));
        if (csc) saveCsc(csc.data);
        say('✅ ' + stats.written + ' lignes de dépenses (' + res.years.length + ' années, ' + res.vehicles + ' véhicules)' + (csc ? ' + ' + csc.nbVehicles + ' véhicules CSC' : ''));

        const sel = document.getElementById('repair-hist-year-select');
        if (sel) {
          res.years.forEach(yr => { if (![].some.call(sel.options, o => o.value == yr)) { const o = document.createElement('option'); o.value = yr; o.textContent = yr; sel.appendChild(o); } });
          sel.value = res.lastYear;
        }
        if (typeof root.renderRepairHistDashboard === 'function') root.renderRepairHistDashboard();
        if (csc) refreshCscUi(csc.data);
      } catch (err) {
        console.error(err);
        say('❌ Erreur de lecture — ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    evt.target.value = '';
  }

  /* ── Bouton (injecté à côté de "Importer Excel (historique)") ── */
  function injectButton() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('repair-rapport-file-input')) return;
    const anchor = document.querySelector('button[onclick*="repair-hist-file-input"]');
    if (!anchor) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'repair-rapport-file-input';
    input.accept = '.xlsx,.xls,.xlsm';
    input.style.display = 'none';
    input.addEventListener('change', handleRapportImport);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-success';
    btn.id = 'btn-repair-rapport-import';
    btn.textContent = '📥 Importer rapports annuels (dépenses + STAT)';
    btn.title = 'Classeur RAPPORT avec les feuilles "depenses anciennes" et "STAT CSC"';
    btn.addEventListener('click', () => input.click());

    anchor.insertAdjacentElement('afterend', btn);
    anchor.insertAdjacentElement('afterend', input);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectButton);
    else injectButton();
  }

  root.handleRapportImport = handleRapportImport;
  root.__repairHistImportRapport = { buildEntries: buildEntries, mergeInto: mergeInto, buildCsc: buildCsc };
})();
