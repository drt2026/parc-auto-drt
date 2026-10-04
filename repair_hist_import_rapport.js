/**
 * ============================================================
 *  REPAIR_HIST_IMPORT_RAPPORT.JS — Import des RAPPORTS ANNUELS
 *  depuis le classeur "RAPPORT 2025-2026" avec ses 2 feuilles :
 *    - "depenses anciennes" : dépenses par véhicule et par année (2020 → 2025)
 *    - "STAT CSC"           : utilisateur (chauffeur) de chaque véhicule
 *
 *  Les données sont écrites dans le MÊME stockage que le bouton existant
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
          nbAccident: isLast && iAcc >= 0 ? int(r[iAcc]) : 0
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

        const w = res.warnings;
        const tot = res.years.map(y => y + ' : ' + Object.keys(res.entries[y]).length + ' véh. — ' +
          Object.values(res.entries[y]).reduce((s, e) => s + e.montant, 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' DT');
        const msg =
          'Import des rapports annuels\n\n' +
          '• Feuille dépenses : « ' + res.sheets.dep + ' »\n' +
          '• Feuille STAT : ' + (res.sheets.stat ? '« ' + res.sheets.stat + ' » (' + res.withUser + ' utilisateurs reportés comme chauffeur)' : 'NON TROUVÉE — chauffeurs non renseignés') + '\n\n' +
          res.vehicles + ' véhicules, années ' + res.years[0] + ' à ' + res.years[res.years.length - 1] + ' :\n   ' + tot.join('\n   ') + '\n\n' +
          '• Compteurs vidanges / chaînes / accidents : rattachés à ' + res.lastYear + ' uniquement\n' +
          '• Années à 0 avant la 1ère dépense d\'un véhicule : ignorées (véhicule pas encore au parc)\n' +
          (w.renamed.length ? '• Matricule corrigé (espace retiré) : ' + w.renamed.join(', ') + '\n' : '') +
          (w.mismatches.length ? '• Montants différents entre les 2 feuilles (« depenses anciennes » retenue) : ' + w.mismatches.length + '\n   ' + w.mismatches.slice(0, 8).join('\n   ') + (w.mismatches.length > 8 ? '\n   …' : '') + '\n' : '') +
          (w.statOnly.length ? '• Dans STAT mais absent de « depenses anciennes » (NON importé) : ' + w.statOnly.join(', ') + '\n' : '') +
          '\nLes données de ces années seront mises à jour. Continuer ?';
        if (!confirm(msg)) { say('Import annulé'); return; }

        const stats = mergeInto(store, res);
        localStorage.setItem(KEY, JSON.stringify(store));
        say('✅ ' + stats.written + ' lignes importées (' + res.years.length + ' années, ' + res.vehicles + ' véhicules)');

        const sel = document.getElementById('repair-hist-year-select');
        if (sel) {
          res.years.forEach(yr => { if (![].some.call(sel.options, o => o.value == yr)) { const o = document.createElement('option'); o.value = yr; o.textContent = yr; sel.appendChild(o); } });
          sel.value = res.lastYear;
        }
        if (typeof root.renderRepairHistDashboard === 'function') root.renderRepairHistDashboard();
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
  root.__repairHistImportRapport = { buildEntries: buildEntries, mergeInto: mergeInto };
})();
