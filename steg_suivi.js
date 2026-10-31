/* ============================================================
   SUIVI STEG — onglet additif de l'admin « Parc Auto DRT Sfax »
   Suivi des index et de la consommation d'électricité (compteurs BT)
   - Données initiales : steg_data.js (window.STEG_BASE), issues du classeur
     Suivi_INDEX_STEG_Dashboard.xlsx
   - Nouveaux relevés / paramètres : localStorage (clés steg_*), fusionnés aux données initiales
   - Mêmes règles de calcul que le classeur Excel (consommation mensualisée,
     statuts et alertes du « Contrôle du mois »)
   ============================================================ */
(function () {
  'use strict';
  if (window.StegSuivi) return;

  var LS_SAISIES = 'steg_index_saisies_v1';
  var LS_PARAMS = 'steg_params_v1';
  var LS_METERS = 'steg_compteurs_extra_v1';
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  var CATS = {
    ok:        { label: 'OK',                           badge: 'success', alert: 0 },
    attente:   { label: 'En attente de relevé',         badge: 'info',    alert: 0 },
    premier:   { label: 'Premier relevé (pas de base)', badge: 'info',    alert: 0 },
    hausse:    { label: 'Hausse anormale',              badge: 'warning', alert: 1 },
    baisse:    { label: 'Baisse anormale',              badge: 'warning', alert: 1 },
    nulle:     { label: 'Consommation nulle',           badge: 'warning', alert: 1 },
    inferieur: { label: 'Index inférieur au précédent', badge: 'danger',  alert: 1 },
    reprise:   { label: 'Reprise après un long arrêt',  badge: 'danger',  alert: 1 },
    sansrel:   { label: 'Sans relevé depuis plusieurs mois', badge: 'danger',  alert: 1 },
    aucun:     { label: 'Aucun relevé',                 badge: 'danger',  alert: 1 }
  };

  var S = { month: -1, district: '', cat: 'ALERTS', q: '', data: null, shell: false };
  var BULK = { district: '', q: '', vals: {} };

  /* calendrier ouvert : du 1er mois des données jusqu'à fin 2030 au minimum (année en cours + 3 sinon) */
  function buildMonths(startKey) {
    var y0 = parseInt(startKey.slice(0, 4), 10), m0 = parseInt(startKey.slice(5, 7), 10);
    var end = Math.max(2030, new Date().getFullYear() + 3), out = [];
    for (var y = y0; y <= end; y++) {
      for (var m = (y === y0 ? m0 : 1); m <= 12; m++) out.push(y + '-' + ('0' + m).slice(-2));
    }
    return out;
  }

  /* ---------- utilitaires ---------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n, d) {
    if (n == null || n === '' || isNaN(n)) return '–';
    return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d });
  }
  function pct(n) {
    if (n == null || isNaN(n)) return '–';
    return (n > 0 ? '+' : '') + (n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' %';
  }
  function mlabel(key, short) {
    var y = key.slice(0, 4), m = parseInt(key.slice(5, 7), 10) - 1;
    return (short ? MOIS_C[m] : MOIS[m]) + ' ' + y;
  }
  function readJSON(k, def) {
    try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch (e) { return def; }
  }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function getParams() {
    var p = JSON.parse(JSON.stringify((window.STEG_BASE && window.STEG_BASE.params) || {}));
    var o = readJSON(LS_PARAMS, {});
    for (var k in o) { if (o[k] !== undefined) p[k] = o[k]; }
    return p;
  }

  /* ---------- moteur de calcul (mêmes règles que le classeur) ---------- */
  function calcMeter(R, p) {
    var n = R.length, pos = [], last = -1, j;
    for (j = 0; j < n; j++) { if (R[j] != null) last = j; pos[j] = last; }
    var c = [];
    for (j = 0; j < n; j++) {
      c[j] = null;
      if (R[j] != null) {
        var pr = j > 0 ? pos[j - 1] : -1;
        if (pr >= 0 && !(R[j] < R[pr]) && (j - pr) <= p.maxGap) c[j] = (R[j] - R[pr]) / (j - pr);
      }
    }
    // les mois sans relevé reprennent la valeur du mois suivant (consommation répartie à parts égales)
    var conso = [], nxt = null;
    for (j = n - 1; j >= 0; j--) {
      if (R[j] != null) { nxt = c[j]; conso[j] = c[j]; } else { conso[j] = nxt; }
    }
    return { pos: pos, conso: conso };
  }

  function compute() {
    var B = window.STEG_BASE;
    if (!B) return null;
    var p = getParams();
    var sais = readJSON(LS_SAISIES, {});
    var months = buildMonths(B.months[0]);
    var N = months.length;
    var allC = B.compteurs.concat(readJSON(LS_METERS, []));
    var meters = allC.map(function (c) {
      var R = new Array(N);
      for (var i = 0; i < N; i++) R[i] = null;
      (B.index[c[0]] || []).forEach(function (r) { R[r[0]] = r[1]; });
      var added = sais[c[0]] || {};
      Object.keys(added).forEach(function (k) { R[+k] = added[k]; });
      var m = calcMeter(R, p);
      return { id: c[0], district: c[1], num: c[2], police: c[3], adr: c[4], obs: c[5], R: R, pos: m.pos, conso: m.conso, added: added };
    });
    var totals = [], cover = [], reads = [];
    for (var j = 0; j < N; j++) {
      var t = 0, cv = 0, rd = 0;
      meters.forEach(function (m) {
        if (typeof m.conso[j] === 'number') { t += m.conso[j]; cv++; }
        if (m.R[j] != null) rd++;
      });
      totals[j] = t; cover[j] = cv; reads[j] = rd;
    }
    var first = -1, lastR = -1;
    for (j = 0; j < N; j++) { if (reads[j] > 0) { if (first < 0) first = j; lastR = j; } }
    var def = -1;
    for (j = N - 1; j >= 0; j--) { if (cover[j] >= p.couverture * meters.length) { def = j; break; } }
    if (def < 0) def = lastR >= 0 ? lastR : 0;
    return { p: p, months: months, N: N, meters: meters, totals: totals, cover: cover, reads: reads, first: first, lastRead: lastR, def: def };
  }

  function stat(m, j, D) {
    var p = D.p, r = { m: m };
    r.E = m.R[j];
    var Np = j > 0 ? m.pos[j - 1] : -1;
    r.F = (r.E != null && Np >= 0) ? m.R[Np] : null;
    r.G = (r.E != null && Np >= 0) ? j - Np : null;
    r.H = (r.E != null && r.F != null && r.E >= r.F) ? r.E - r.F : null;
    r.I = typeof m.conso[j] === 'number' ? m.conso[j] : null;
    var s = 0, n = 0;
    for (var k = Math.max(0, j - 12); k <= j - 1; k++) { if (typeof m.conso[k] === 'number') { s += m.conso[k]; n++; } }
    r.J = (j > 0 && n > 0) ? s / n : null;
    r.K = (r.I != null && r.J != null && r.J !== 0) ? r.I / r.J - 1 : null;
    var cat, label = null;
    if (r.E != null) {
      if (Np < 0) cat = 'premier';
      else if (r.E < r.F) cat = 'inferieur';
      else if (j - Np > p.maxGap) { cat = 'reprise'; label = 'Reprise après ' + (j - Np) + ' mois'; }
      else if (r.I === 0 && (r.J || 0) > 0) cat = 'nulle';
      else if (r.K != null && r.K > p.hausse) cat = 'hausse';
      else if (r.K != null && r.K < -p.baisse) cat = 'baisse';
      else cat = 'ok';
    } else {
      var O = m.pos[j] >= 0 ? j - m.pos[j] : null;
      if (O == null) cat = 'aucun';
      else if (O > p.sansReleve) { cat = 'sansrel'; label = 'Sans relevé depuis ' + O + ' mois'; }
      else cat = 'attente';
    }
    r.cat = cat;
    r.label = label || CATS[cat].label;
    r.alert = CATS[cat].alert;
    return r;
  }

  function rowsFor(j) {
    return S.data.meters.map(function (m) { return stat(m, j, S.data); });
  }

  /* ---------- rendu ---------- */
  function root() { return document.getElementById('tab-steg'); }

  function css() {
    return '<style id="steg-css">' +
      '#tab-steg .steg-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap}' +
      '#tab-steg .steg-sel,#tab-steg .steg-inp{padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:#fff;font-size:14px;color:var(--text);max-width:100%}' +
      '#tab-steg .steg-note{font-size:12.5px;color:var(--secondary);margin-top:6px}' +
      '#tab-steg .stats-grid{grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:14px}' +
      '#tab-steg .stat-card{padding:14px;gap:12px}' +
      '#tab-steg .stat-icon{width:44px;height:44px;font-size:21px;flex-shrink:0}' +
      '#tab-steg .steg-grid2{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:20px}' +
      '#tab-steg .steg-wrap th,#tab-steg .steg-wrap td{padding:8px 10px;font-size:12.5px}' +
      '#tab-steg .steg-wrap td{white-space:nowrap}' +
      '@media(max-width:900px){#tab-steg .steg-grid2{grid-template-columns:1fr}}' +
      '#tab-steg .steg-bars{display:flex;align-items:flex-end;gap:6px;height:190px;padding-top:8px}' +
      '#tab-steg .steg-col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;min-width:0}' +
      '#tab-steg .steg-bar-i{width:100%;max-width:38px;border-radius:6px 6px 0 0;background:#93b4e6;min-height:2px}' +
      '#tab-steg .steg-col.cur .steg-bar-i{background:#1e3a5f}' +
      '#tab-steg .steg-val{font-size:10.5px;color:var(--secondary);margin-bottom:3px;white-space:nowrap}' +
      '#tab-steg .steg-lab{font-size:10.5px;color:var(--secondary);margin-top:5px;white-space:nowrap}' +
      '#tab-steg .steg-wrap{overflow:auto;max-height:560px;border:1px solid var(--border);border-radius:12px}' +
      '#tab-steg .steg-wrap table{min-width:1100px}' +
      '#tab-steg .steg-wrap table.steg-compact{min-width:0;width:100%}' +
      '#tab-steg .steg-wrap thead th{position:sticky;top:0;z-index:2;background:#f8fafc}' +
      '#tab-steg tr.steg-row{cursor:pointer}' +
      '#tab-steg .num{text-align:right;white-space:nowrap}' +
      '#tab-steg .up{color:#b45309;font-weight:600}#tab-steg .down{color:#1d4ed8;font-weight:600}' +
      '#steg-modal{position:fixed;inset:0;background:rgba(15,23,42,.55);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px}' +
      '#steg-modal.open{display:flex}' +
      '#steg-modal .box{background:#fff;border-radius:16px;max-width:760px;width:100%;max-height:92vh;overflow:auto;padding:22px;box-shadow:var(--shadow-lg)}' +
      '</style>';
  }

  function shell() {
    var el = root();
    if (!el) return false;
    el.innerHTML = css() +
      '<div class="card">' +
        '<div class="card-header" style="flex-wrap:wrap;gap:12px">' +
          '<div><div class="card-title">⚡ Suivi STEG — index et consommation</div>' +
          '<div class="card-subtitle" id="steg-sub"></div></div>' +
          '<div class="steg-bar">' +
            '<label for="steg-month" style="font-size:13px;color:var(--secondary)">Mois :</label>' +
            '<select id="steg-month" class="steg-sel" onchange="StegSuivi.setMonth(this.value)"></select>' +
          '</div>' +
        '</div>' +
        '<div class="steg-bar" style="margin-top:4px">' +
          '<button class="btn btn-primary btn-sm" onclick="StegSuivi.openBulk()">✍️ Saisir les index du mois</button>' +
          '<button class="btn btn-secondary btn-sm" onclick="StegSuivi.pickFile()">📤 Importer un fichier Excel</button>' +
          '<button class="btn btn-secondary btn-sm" onclick="StegSuivi.exportTemplate()">🧾 Modèle de saisie du mois</button>' +
          '<button class="btn btn-secondary btn-sm" onclick="StegSuivi.exportXlsx()">📥 Exporter le contrôle</button>' +
          '<button class="btn btn-secondary btn-sm" onclick="StegSuivi.exportAll()">💾 Sauvegarde complète</button>' +
          '<input type="file" id="steg-file" accept=".xlsx,.xls,.csv" style="display:none" onchange="StegSuivi.onFile(this)">' +
        '</div>' +
        '<div class="steg-note" id="steg-info"></div>' +
      '</div>' +
      '<div class="stats-grid" id="steg-kpis"></div>' +
      '<div class="steg-grid2">' +
        '<div class="card"><div class="card-header"><div class="card-title">📈 Consommation des 12 derniers mois (kWh)</div></div><div id="steg-chart"></div></div>' +
        '<div class="card"><div class="card-header"><div class="card-title">🗺️ Par district</div></div><div id="steg-districts"></div></div>' +
      '</div>' +
      '<div class="card"><div class="card-header"><div class="card-title">🗓️ Bilan par année</div></div><div id="steg-years"></div>' +
        '<div class="steg-note">Une année n’est complète que si ses 12 mois sont « consolidés » (au moins la couverture minimale de compteurs avec une consommation calculée). Cliquer sur une année pour afficher son dernier mois relevé.</div></div>' +
      '<div class="card">' +
        '<div class="card-header" style="flex-wrap:wrap;gap:12px"><div class="card-title" id="steg-ctrl-title">🔎 Contrôle du mois</div>' +
          '<div class="steg-bar">' +
            '<select id="steg-f-cat" class="steg-sel" onchange="StegSuivi.setFilter()"></select>' +
            '<select id="steg-f-dist" class="steg-sel" onchange="StegSuivi.setFilter()"></select>' +
            '<input id="steg-f-q" class="steg-inp" type="search" placeholder="N° compteur, police, adresse…" oninput="StegSuivi.setFilter()">' +
          '</div>' +
        '</div>' +
        '<div class="steg-note" id="steg-count" style="margin:0 0 10px"></div>' +
        '<div class="steg-wrap"><table class="data-table"><thead><tr>' +
          '<th>ID</th><th>District</th><th>N° compteur</th><th>Adresse / Site</th><th class="num">Index du mois</th><th class="num">Dernier index antérieur</th>' +
          '<th class="num">Mois écoulés</th><th class="num">Conso période (kWh)</th><th class="num">Conso mensualisée (kWh/mois)</th>' +
          '<th class="num">Moy. 12 mois</th><th class="num">Écart</th><th>Statut</th>' +
        '</tr></thead><tbody id="steg-tbody"></tbody></table></div>' +
      '</div>' +
      '<details class="card" id="steg-params"><summary style="cursor:pointer;font-weight:700">⚙️ Paramètres de contrôle</summary><div id="steg-params-body" style="margin-top:14px"></div></details>' +
      '<div id="steg-modal" onclick="if(event.target===this)StegSuivi.closeModal()"><div class="box" id="steg-modal-box"></div></div>';
    S.shell = true;
    return true;
  }

  function fillSelectors() {
    var D = S.data, sel = document.getElementById('steg-month'), h = '';
    var nowD = new Date(), nowIdx = D.months.indexOf(nowD.getFullYear() + '-' + ('0' + (nowD.getMonth() + 1)).slice(-2));
    var from = D.first >= 0 ? D.first : 0, to = Math.min(D.N - 1, Math.max(D.lastRead, D.def, nowIdx + 1)), curY = '';
    for (var j = to; j >= from; j--) {
      var yy = D.months[j].slice(0, 4);
      if (yy !== curY) { if (curY) h += '</optgroup>'; h += '<optgroup label="' + yy + '">'; curY = yy; }
      h += '<option value="' + j + '">' + esc(mlabel(D.months[j])) + '</option>';
    }
    if (curY) h += '</optgroup>';
    sel.innerHTML = h; sel.value = String(S.month);

    var cat = '<option value="ALERTS">Alertes à traiter</option><option value="ALL">Tous les compteurs</option>';
    Object.keys(CATS).forEach(function (k) { cat += '<option value="' + k + '">' + esc(CATS[k].label) + '</option>'; });
    document.getElementById('steg-f-cat').innerHTML = cat;
    document.getElementById('steg-f-cat').value = S.cat;

    var ds = {}; D.meters.forEach(function (m) { ds[m.district] = 1; });
    var dh = '<option value="">Tous les districts</option>';
    Object.keys(ds).sort().forEach(function (d) { dh += '<option value="' + esc(d) + '">' + esc(d) + '</option>'; });
    document.getElementById('steg-f-dist').innerHTML = dh;
    document.getElementById('steg-f-dist').value = S.district;
  }

  function kpiCard(icon, bg, label, value, sub) {
    return '<div class="stat-card"><div class="stat-icon" style="background:' + bg + '">' + icon + '</div>' +
      '<div><div class="stat-value" style="font-size:24px;font-weight:800">' + value + '</div>' +
      '<div class="stat-label" style="font-size:13px;color:var(--secondary)">' + label + '</div>' +
      '<div style="font-size:11.5px;color:var(--secondary);margin-top:2px">' + sub + '</div></div></div>';
  }

  function refreshAll() {
    var D = S.data, j = S.month, rows = rowsFor(j), p = D.p;
    var year = D.months[j].slice(0, 4);

    document.getElementById('steg-sub').textContent = 'DRT Sfax — compteurs basse tension, ' + D.meters.length + ' compteurs sur 5 districts';
    document.getElementById('steg-info').textContent = D.lastRead >= 0
      ? 'Dernier relevé enregistré : ' + mlabel(D.months[D.lastRead]) + '. Un mois est « consolidé » quand au moins ' + Math.round(p.couverture * 100) + ' % des compteurs ont une consommation calculée ; le mois affiché par défaut est le dernier mois consolidé.'
      : 'Aucun relevé enregistré.';

    // KPI
    var nb = D.meters.length, rel = D.reads[j], cur = D.totals[j];
    var prev = j > 0 ? D.totals[j - 1] : 0;
    var varia = (j === 0 || !prev) ? null : cur / prev - 1;
    var yearTot = 0; for (var k = 0; k < D.N; k++) { if (D.months[k].slice(0, 4) === year) yearTot += D.totals[k]; }
    var alerts = rows.filter(function (r) { return r.alert; }).length;
    var sansRel = rows.filter(function (r) { return r.cat === 'sansrel' || r.cat === 'aucun'; }).length;
    var cout = p.tarif ? ' · coût estimé ' + fmt(cur * p.tarif) + ' DT' : '';
    document.getElementById('steg-kpis').innerHTML =
      kpiCard('🔌', '#eff6ff', 'Compteurs suivis', fmt(nb), 'BT — 5 districts') +
      kpiCard('📝', '#f0fdf4', 'Relevés du mois', fmt(rel), 'sur ' + nb + ' compteurs (' + Math.round(rel / nb * 100) + ' %)') +
      kpiCard('⚡', '#fffbeb', 'Consommation du mois (kWh)', fmt(cur), 'couverture : ' + Math.round(D.cover[j] / nb * 100) + ' %' + cout) +
      kpiCard('📊', '#f5f3ff', 'Variation vs mois précédent', varia == null ? '–' : pct(varia), 'consommation mensualisée') +
      kpiCard('📅', '#ecfeff', 'Consommation de ' + year + ' (kWh)', fmt(yearTot), 'cumul ' + year + ' (mensualisé)') +
      kpiCard('🚨', '#fef2f2', 'Alertes à traiter', fmt(alerts), 'dont sans relevé : ' + sansRel);

    // graphique 12 mois
    var vals = [], labs = [], i0 = Math.max(0, j - 11), mx = 0;
    for (k = i0; k <= j; k++) { vals.push(D.totals[k]); labs.push(k); if (D.totals[k] > mx) mx = D.totals[k]; }
    var ch = '<div class="steg-bars">';
    vals.forEach(function (v, idx) {
      var hgt = mx ? Math.max(2, Math.round(v / mx * 140)) : 2;
      ch += '<div class="steg-col' + (labs[idx] === j ? ' cur' : '') + '" title="' + esc(mlabel(D.months[labs[idx]])) + ' : ' + fmt(v) + ' kWh">' +
        '<div class="steg-val">' + (v ? fmt(v / 1000) + ' k' : '–') + '</div><div class="steg-bar-i" style="height:' + hgt + 'px"></div>' +
        '<div class="steg-lab">' + esc(mlabel(D.months[labs[idx]], true).replace(/ 20(\d\d)$/, " '$1")) + '</div></div>';
    });
    document.getElementById('steg-chart').innerHTML = ch + '</div>';

    // districts
    var byD = {};
    rows.forEach(function (r) {
      var d = r.m.district, o = byD[d] || (byD[d] = { n: 0, rel: 0, conso: 0, al: 0 });
      o.n++; if (r.E != null) o.rel++; if (r.I != null) o.conso += r.I; o.al += r.alert;
    });
    var dh = '<div class="steg-wrap" style="max-height:none"><table class="data-table steg-compact"><thead><tr><th>District</th><th class="num">Compteurs</th><th class="num">Relevés</th><th class="num">kWh</th><th class="num">Alertes</th></tr></thead><tbody>';
    Object.keys(byD).sort().forEach(function (d) {
      var o = byD[d];
      dh += '<tr><td>' + esc(d) + '</td><td class="num">' + o.n + '</td><td class="num">' + o.rel + '</td><td class="num">' + fmt(o.conso) + '</td><td class="num">' + (o.al ? '<span class="badge badge-danger">' + o.al + '</span>' : '0') + '</td></tr>';
    });
    document.getElementById('steg-districts').innerHTML = dh + '</tbody></table></div>';

    renderYears();
    document.getElementById('steg-ctrl-title').textContent = '🔎 Contrôle du mois — ' + mlabel(D.months[j]);
    refreshTable(rows);
    renderParams();
  }

  function filtered(rows) {
    var q = S.q.trim().toLowerCase();
    return rows.filter(function (r) {
      if (S.cat === 'ALERTS' && !r.alert) return false;
      if (S.cat !== 'ALERTS' && S.cat !== 'ALL' && r.cat !== S.cat) return false;
      if (S.district && r.m.district !== S.district) return false;
      if (q) {
        var hay = (r.m.id + ' ' + r.m.num + ' ' + r.m.police + ' ' + r.m.adr + ' ' + r.m.district).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) {
      if (b.alert !== a.alert) return b.alert - a.alert;
      return a.m.id < b.m.id ? -1 : 1;
    });
  }

  function refreshTable(rows) {
    rows = rows || rowsFor(S.month);
    var list = filtered(rows), h = '';
    list.forEach(function (r) {
      var ecart = r.K == null ? '–' : '<span class="' + (r.K > 0 ? 'up' : r.K < 0 ? 'down' : '') + '">' + pct(r.K) + '</span>';
      h += '<tr class="steg-row" onclick="StegSuivi.openMeter(\'' + esc(r.m.id) + '\')">' +
        '<td>' + esc(r.m.id) + '</td><td>' + esc(r.m.district) + '</td><td style="white-space:nowrap">' + esc(r.m.num) + '</td><td>' + esc(r.m.adr || '—') + '</td>' +
        '<td class="num">' + fmt(r.E) + '</td><td class="num">' + fmt(r.F) + '</td><td class="num">' + (r.G == null ? '–' : r.G) + '</td>' +
        '<td class="num">' + fmt(r.H) + '</td><td class="num">' + fmt(r.I) + '</td><td class="num">' + fmt(r.J) + '</td><td class="num">' + ecart + '</td>' +
        '<td><span class="badge badge-' + CATS[r.cat].badge + '">' + esc(r.label) + '</span></td></tr>';
    });
    document.getElementById('steg-tbody').innerHTML = h || '<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--secondary)">Aucun compteur ne correspond à ce filtre.</td></tr>';
    document.getElementById('steg-count').textContent = list.length + ' compteur(s) affiché(s) sur ' + rows.length + ' — cliquer sur une ligne pour voir l’historique et saisir un index.';
  }

  /* ---------- paramètres ---------- */
  function renderParams() {
    var p = S.data.p;
    function row(id, label, v, step) {
      return '<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap"><label for="' + id + '" style="flex:1 1 320px;font-size:13px">' + label + '</label>' +
        '<input id="' + id + '" class="steg-inp" type="number" step="' + step + '" value="' + (v == null ? '' : v) + '" style="width:130px"></div>';
    }
    document.getElementById('steg-params-body').innerHTML =
      row('stp-hausse', 'Seuil de hausse anormale vs moyenne des 12 mois précédents (0,5 = +50 %)', p.hausse, 0.05) +
      row('stp-baisse', 'Seuil de baisse anormale vs moyenne des 12 mois précédents (0,5 = −50 %)', p.baisse, 0.05) +
      row('stp-sans', 'Alerte « sans relevé » au-delà de (mois)', p.sansReleve, 1) +
      row('stp-gap', 'Écart maximal entre deux relevés pour répartir la consommation (mois)', p.maxGap, 1) +
      row('stp-cov', 'Couverture minimale pour qu’un mois soit « consolidé » (0,5 = 50 %)', p.couverture, 0.05) +
      row('stp-tarif', 'Tarif moyen du kWh (DT) — facultatif, pour estimer le coût', p.tarif, 0.001) +
      '<button class="btn btn-primary btn-sm" onclick="StegSuivi.saveParams()">Appliquer</button> ' +
      '<button class="btn btn-secondary btn-sm" onclick="StegSuivi.resetParams()">Valeurs par défaut</button>';
  }

  /* ---------- fiche compteur + saisie ---------- */
  function openMeter(id) {
    var D = S.data, m = D.meters.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    var box = document.getElementById('steg-modal-box'); box.style.maxWidth = '760px';
    var to = Math.max(D.lastRead, S.month), from = Math.max(0, to - 23), h = '';
    for (var j = to; j >= from; j--) {
      var added = m.added[j] != null;
      if (m.R[j] == null && typeof m.conso[j] !== 'number') continue;
      h += '<tr><td>' + esc(mlabel(D.months[j])) + '</td><td class="num">' + fmt(m.R[j]) + '</td><td class="num">' + fmt(m.conso[j]) + '</td><td>' +
        (m.R[j] != null ? (added ? '<span class="badge badge-info">saisi ici</span> <a href="#" onclick="StegSuivi.removeReading(\'' + esc(id) + '\',' + j + ');return false" style="font-size:12px">supprimer</a>' : 'relevé') : '<span style="color:var(--secondary)">réparti</span>') + '</td></tr>';
    }
    var now = new Date(), nk = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);
    var def = D.months.indexOf(nk);
    if (def < 0) def = Math.min(D.N - 1, Math.max(S.month, D.lastRead));
    var opts = '';
    for (j = D.N - 1; j >= 0; j--) opts += '<option value="' + j + '"' + (j === def ? ' selected' : '') + '>' + esc(mlabel(D.months[j])) + '</option>';
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;gap:12px"><div><div style="font-size:18px;font-weight:800">' + esc(m.num) + ' <span style="font-weight:500;color:var(--secondary)">· ' + esc(m.id) + '</span></div>' +
      '<div class="steg-note">' + esc(m.district) + ' — ' + esc(m.adr || 'adresse non renseignée') + (m.police ? ' — police ' + esc(m.police) : '') + '</div>' +
      (m.obs ? '<div class="steg-note">📌 ' + esc(m.obs) + '</div>' : '') + '</div>' +
      '<button class="btn btn-secondary btn-sm" style="height:fit-content" onclick="StegSuivi.closeModal()">✕</button></div>' +
      '<div class="card" style="margin:16px 0;padding:16px;box-shadow:none"><div style="font-weight:700;margin-bottom:10px">Saisir un nouvel index</div>' +
      '<div class="steg-bar"><select id="stm-month" class="steg-sel">' + opts + '</select>' +
      '<input id="stm-index" class="steg-inp" type="number" min="0" step="1" placeholder="Index (kWh)" style="width:160px">' +
      '<button class="btn btn-primary btn-sm" onclick="StegSuivi.addReading(\'' + esc(id) + '\')">Enregistrer</button></div>' +
      '<div class="steg-note">Les index saisis sont conservés sur cet appareil et intégrés aux calculs. Penser à exporter régulièrement.</div></div>' +
      '<div style="font-weight:700;margin-bottom:8px">Historique (24 derniers mois)</div>' +
      '<div class="steg-wrap" style="max-height:320px"><table class="data-table steg-compact"><thead><tr><th>Mois</th><th class="num">Index</th><th class="num">Conso mensualisée (kWh)</th><th>Origine</th></tr></thead><tbody>' +
      (h || '<tr><td colspan="4" style="text-align:center;color:var(--secondary);padding:16px">Aucun relevé enregistré pour ce compteur.</td></tr>') + '</tbody></table></div>';
    document.getElementById('steg-modal').classList.add('open');
  }

  function addReading(id) {
    var j = parseInt(document.getElementById('stm-month').value, 10);
    var raw = document.getElementById('stm-index').value;
    var v = parseFloat(raw);
    if (raw === '' || isNaN(v) || v < 0) { alert('Saisir un index valide (nombre positif).'); return; }
    var m = S.data.meters.filter(function (x) { return x.id === id; })[0];
    var prevPos = j > 0 ? m.pos[j - 1] : -1;
    if (prevPos >= 0 && v < m.R[prevPos] && !confirm('Cet index (' + fmt(v) + ') est inférieur au précédent (' + fmt(m.R[prevPos]) + ', ' + mlabel(S.data.months[prevPos]) + '). Changement de compteur ou erreur de saisie ?\n\nEnregistrer quand même ?')) return;
    if (m.R[j] != null && !confirm('Un index existe déjà pour ' + mlabel(S.data.months[j]) + ' (' + fmt(m.R[j]) + '). Le remplacer ?')) return;
    var sais = readJSON(LS_SAISIES, {});
    (sais[id] = sais[id] || {})[j] = v;
    if (!writeJSON(LS_SAISIES, sais)) { alert('Enregistrement impossible sur cet appareil (stockage plein ou bloqué).'); return; }
    reload(j);
    openMeter(id);
  }

  function removeReading(id, j) {
    if (!confirm('Supprimer l’index saisi pour ' + mlabel(S.data.months[j]) + ' ?')) return;
    var sais = readJSON(LS_SAISIES, {});
    if (sais[id]) { delete sais[id][j]; if (!Object.keys(sais[id]).length) delete sais[id]; }
    writeJSON(LS_SAISIES, sais);
    reload(S.month);
    openMeter(id);
  }

  function reload(keepMonth) {
    S.data = compute();
    if (keepMonth != null && keepMonth >= 0 && keepMonth < S.data.N) S.month = keepMonth;
    fillSelectors();
    refreshAll();
  }

  /* ---------- export ---------- */
  function exportXlsx() {
    if (typeof XLSX === 'undefined') { alert('Bibliothèque Excel non chargée.'); return; }
    var D = S.data, j = S.month, rows = filtered(rowsFor(j));
    var aoa = [['ID', 'District', 'N° compteur', 'Police', 'Adresse / Site', 'Index du mois', 'Dernier index antérieur', 'Mois écoulés', 'Conso période (kWh)', 'Conso mensualisée (kWh/mois)', 'Moyenne 12 mois (kWh/mois)', 'Écart vs moyenne', 'Statut']];
    rows.forEach(function (r) {
      aoa.push([r.m.id, r.m.district, r.m.num, r.m.police, r.m.adr, r.E, r.F, r.G, r.H,
        r.I == null ? null : Math.round(r.I), r.J == null ? null : Math.round(r.J), r.K == null ? null : Math.round(r.K * 1000) / 1000, r.label]);
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [8, 12, 15, 11, 28, 13, 15, 11, 15, 18, 16, 12, 34].map(function (w) { return { wch: w }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contrôle ' + D.months[j]);
    XLSX.writeFile(wb, 'Suivi_STEG_controle_' + D.months[j] + '.xlsx');
  }


  /* ---------- bilan par année ---------- */
  function renderYears() {
    var D = S.data, nb = D.meters.length, nowY = new Date().getFullYear();
    var y0 = D.first >= 0 ? parseInt(D.months[D.first].slice(0, 4), 10) : nowY;
    var y1 = Math.max(D.lastRead >= 0 ? parseInt(D.months[D.lastRead].slice(0, 4), 10) : nowY, nowY);
    var dists = {}; D.meters.forEach(function (m) { dists[m.district] = 1; });
    var dl = Object.keys(dists).sort(), prev = null, h = '';
    h += '<div class="steg-wrap" style="max-height:none"><table class="data-table steg-compact"><thead><tr><th>Année</th><th class="num">Relevés</th><th class="num">Mois consolidés</th><th class="num">Conso (kWh)</th><th class="num">vs année préc.</th>';
    dl.forEach(function (d) { h += '<th class="num">' + esc(d) + '</th>'; });
    h += '</tr></thead><tbody>';
    var rows = [];
    for (var y = y0; y <= y1; y++) {
      var rel = 0, cons = 0, tot = 0, byD = {}, lastIdx = -1;
      for (var j = 0; j < D.N; j++) {
        if (parseInt(D.months[j].slice(0, 4), 10) !== y) continue;
        rel += D.reads[j]; tot += D.totals[j];
        if (D.cover[j] >= D.p.couverture * nb) cons++;
        if (D.reads[j] > 0) lastIdx = j;
      }
      D.meters.forEach(function (m) {
        for (var k = 0; k < D.N; k++) {
          if (parseInt(D.months[k].slice(0, 4), 10) === y && typeof m.conso[k] === 'number') byD[m.district] = (byD[m.district] || 0) + m.conso[k];
        }
      });
      rows.push({ y: y, rel: rel, cons: cons, tot: tot, byD: byD, last: lastIdx });
    }
    rows.forEach(function (r, i) {
      var p = i > 0 ? rows[i - 1].tot : 0;
      var v = p ? pct(r.tot / p - 1) : '–';
      var sel = S.data.months[S.month] && parseInt(S.data.months[S.month].slice(0, 4), 10) === r.y;
      h += '<tr class="steg-row" onclick="StegSuivi.goYear(' + r.y + ')"' + (sel ? ' style="background:#eff6ff"' : '') + '><td><b>' + r.y + '</b></td><td class="num">' + fmt(r.rel) + '</td>' +
        '<td class="num">' + (r.cons < 12 ? '<span class="up">' + r.cons + ' / 12</span>' : '12 / 12') + '</td><td class="num">' + fmt(r.tot) + '</td><td class="num">' + (r.cons < 12 || (i > 0 && rows[i - 1].cons < 12) ? '<span style="color:var(--secondary)">' + v + ' ⚠</span>' : v) + '</td>';
      dl.forEach(function (d) { h += '<td class="num">' + fmt(r.byD[d] || 0) + '</td>'; });
      h += '</tr>';
    });
    document.getElementById('steg-years').innerHTML = h + '</tbody></table></div>';
  }

  /* ---------- saisie groupée du mois ---------- */
  function bulkRows() {
    var D = S.data, j = S.month, q = BULK.q.trim().toLowerCase();
    return D.meters.filter(function (m) {
      if (BULK.district && m.district !== BULK.district) return false;
      if (q && (m.id + ' ' + m.num + ' ' + m.police + ' ' + m.adr).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function bulkTable() {
    var D = S.data, j = S.month, h = '';
    bulkRows().forEach(function (m) {
      var pp = j > 0 ? m.pos[j - 1] : -1;
      var prev = pp >= 0 ? fmt(m.R[pp]) + ' <span style="color:var(--secondary)">(' + esc(mlabel(D.months[pp], true)) + ')</span>' : '–';
      var cur = BULK.vals[m.id] !== undefined ? BULK.vals[m.id] : (m.R[j] != null ? m.R[j] : '');
      h += '<tr><td>' + esc(m.id) + '</td><td>' + esc(m.num) + '</td><td>' + esc((m.adr || '—').slice(0, 28)) + '</td><td class="num">' + prev + '</td>' +
        '<td class="num"><input class="steg-inp" type="number" min="0" step="1" style="width:120px;padding:5px 8px" value="' + esc(cur) + '" oninput="StegSuivi.bulkInput(\'' + esc(m.id) + '\',this.value)"></td></tr>';
    });
    return h || '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--secondary)">Aucun compteur.</td></tr>';
  }
  function openBulk() {
    var D = S.data;
    BULK = { district: '', q: '', vals: {} };
    var ds = {}; D.meters.forEach(function (m) { ds[m.district] = 1; });
    var dopt = '<option value="">Tous les districts</option>' + Object.keys(ds).sort().map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + '</option>'; }).join('');
    var box = document.getElementById('steg-modal-box');
    box.style.maxWidth = '980px';
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;gap:12px"><div><div style="font-size:18px;font-weight:800">✍️ Saisie des index — ' + esc(mlabel(D.months[S.month])) + '</div>' +
      '<div class="steg-note">Saisir l’index relevé pour chaque compteur (laisser vide les compteurs non relevés). Les index déjà enregistrés pour ce mois sont préremplis. Changer de mois depuis le tableau de bord.</div></div>' +
      '<button class="btn btn-secondary btn-sm" style="height:fit-content" onclick="StegSuivi.closeModal()">✕</button></div>' +
      '<div class="steg-bar" style="margin:12px 0"><select id="stb-dist" class="steg-sel" onchange="StegSuivi.bulkFilter()">' + dopt + '</select>' +
      '<input id="stb-q" class="steg-inp" type="search" placeholder="Rechercher…" oninput="StegSuivi.bulkFilter()">' +
      '<button class="btn btn-primary btn-sm" onclick="StegSuivi.bulkSave()">💾 Enregistrer les index saisis</button></div>' +
      '<div class="steg-wrap" style="max-height:55vh"><table class="data-table steg-compact"><thead><tr><th>ID</th><th>N° compteur</th><th>Adresse</th><th class="num">Dernier index antérieur</th><th class="num">Index du mois</th></tr></thead><tbody id="stb-body">' + bulkTable() + '</tbody></table></div>';
    document.getElementById('steg-modal').classList.add('open');
  }
  function bulkSave() {
    var D = S.data, j = S.month, sais = readJSON(LS_SAISIES, {}), n = 0, inf = 0, byId = {};
    D.meters.forEach(function (m) { byId[m.id] = m; });
    var todo = [];
    Object.keys(BULK.vals).forEach(function (id) {
      var raw = BULK.vals[id], m = byId[id];
      if (!m || raw === '' || raw == null) return;
      var v = parseFloat(raw);
      if (isNaN(v) || v < 0) return;
      if (m.R[j] === v) return;
      var pp = j > 0 ? m.pos[j - 1] : -1;
      if (pp >= 0 && v < m.R[pp]) inf++;
      todo.push([id, v]);
    });
    if (!todo.length) { alert('Aucun nouvel index à enregistrer.'); return; }
    if (inf && !confirm(inf + ' index sont inférieurs au précédent (changement de compteur ou erreur de saisie ?).\n\nEnregistrer quand même les ' + todo.length + ' index ?')) return;
    todo.forEach(function (t) { (sais[t[0]] = sais[t[0]] || {})[j] = t[1]; n++; });
    if (!writeJSON(LS_SAISIES, sais)) { alert('Enregistrement impossible sur cet appareil (stockage plein ou bloqué).'); return; }
    window.StegSuivi.closeModal();
    reload(j);
    alert(n + ' index enregistrés pour ' + mlabel(S.data.months[j]) + '.');
  }

  /* ---------- import / export Excel ---------- */
  function normNum(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
  function monthIdxFromHeader(v, D) {
    var y, m;
    if (typeof v === 'number' && v > 36526 && v < 80000) {
      var d = XLSX.SSF.parse_date_code(v); if (!d) return -1; y = d.y; m = d.m;
    } else if (v instanceof Date) {
      var w = new Date(v.getTime() + 12 * 3600 * 1000); y = w.getUTCFullYear(); m = w.getUTCMonth() + 1;
    } else if (typeof v === 'string' && /^\s*(\d{4})[-\/](\d{1,2})\s*$/.test(v)) {
      var mm = v.match(/^\s*(\d{4})[-\/](\d{1,2})\s*$/); y = +mm[1]; m = +mm[2];
    } else return -1;
    return D.months.indexOf(y + '-' + ('0' + m).slice(-2));
  }
  function importWorkbook(buf, fname) {
    if (typeof XLSX === 'undefined') { alert('Bibliothèque Excel non chargée.'); return; }
    var wb;
    try { wb = XLSX.read(buf, { type: 'array' }); } catch (e) { alert('Fichier illisible : ' + e.message); return; }
    var D = S.data, sais = readJSON(LS_SAISIES, {}), extras = readJSON(LS_METERS, []);
    var byId = {}, byNum = {}, byPol = {};
    D.meters.forEach(function (m) { byId[m.id.toUpperCase()] = m; byNum[normNum(m.num)] = m; if (m.police) byPol[normNum(m.police)] = m; });
    var rep = { added: 0, replaced: 0, same: 0, ignoredRows: 0, newMeters: 0, minI: 1e9, maxI: -1, mode: '' };
    function find(id, num, pol) {
      var m = null;
      if (id && byId[String(id).trim().toUpperCase()]) m = byId[String(id).trim().toUpperCase()];
      if (!m && num && byNum[normNum(num)]) m = byNum[normNum(num)];
      if (!m && pol && byPol[normNum(pol)]) m = byPol[normNum(pol)];
      return m;
    }
    function put(m, j, v) {
      if (typeof v === 'string') v = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
      if (typeof v !== 'number' || !isFinite(v) || v < 0 || j < 0) return;
      if (m.R[j] === v) { rep.same++; return; }
      if (m.R[j] != null) rep.replaced++; else rep.added++;
      (sais[m.id] = sais[m.id] || {})[j] = v; m.R[j] = v;
      if (j < rep.minI) rep.minI = j; if (j > rep.maxI) rep.maxI = j;
    }
    function sheetRows(ws) { return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }); }
    function colOf(hdr, re) { for (var c = 0; c < hdr.length; c++) { if (hdr[c] != null && re.test(String(hdr[c]))) return c; } return -1; }

    // 1) Feuille « Compteurs » : ajoute les compteurs absents
    var wc = wb.SheetNames.filter(function (n) { return /^compteurs$/i.test(n); })[0];
    if (wc) {
      var rc = sheetRows(wb.Sheets[wc]), hi = -1;
      for (var i = 0; i < Math.min(rc.length, 15); i++) { if (colOf(rc[i] || [], /^id$/i) >= 0 && colOf(rc[i], /compteur/i) >= 0) { hi = i; break; } }
      if (hi >= 0) {
        var h0 = rc[hi], cI = colOf(h0, /^id$/i), cD = colOf(h0, /district/i), cN = colOf(h0, /compteur/i), cP = colOf(h0, /police/i), cA = colOf(h0, /adresse/i), cO = colOf(h0, /observ/i);
        for (i = hi + 1; i < rc.length; i++) {
          var r = rc[i]; if (!r || !r[cI] || !r[cN]) continue;
          if (find(r[cI], r[cN], cP >= 0 ? r[cP] : null)) continue;
          var nm = { id: String(r[cI]).trim(), district: r[cD] || '', num: String(r[cN]), police: cP >= 0 && r[cP] ? String(r[cP]) : '', adr: cA >= 0 && r[cA] ? String(r[cA]) : '', obs: cO >= 0 && r[cO] ? String(r[cO]) : '', R: [], pos: [], conso: [], added: {} };
          for (var k = 0; k < D.N; k++) nm.R[k] = null;
          D.meters.push(nm); byId[nm.id.toUpperCase()] = nm; byNum[normNum(nm.num)] = nm; if (nm.police) byPol[normNum(nm.police)] = nm;
          extras.push([nm.id, nm.district, nm.num, nm.police, nm.adr, nm.obs]); rep.newMeters++;
        }
      }
    }
    // 2) Index : format large (Saisie_Index : une colonne par mois) ou modèle du mois (colonne « Index du mois »)
    var ws = null, wsName = wb.SheetNames.filter(function (n) { return /^saisie_index$/i.test(n); })[0];
    var done = false;
    if (wsName) {
      var rows = sheetRows(wb.Sheets[wsName]), hdrI = -1, mc = [];
      for (i = 0; i < Math.min(rows.length, 20); i++) {
        var cols = [];
        (rows[i] || []).forEach(function (v, c) { var ix = monthIdxFromHeader(v, D); if (ix >= 0) cols.push([c, ix]); });
        if (cols.length >= 3) { hdrI = i; mc = cols; break; }
      }
      if (hdrI >= 0) {
        var hd = rows[hdrI], cId = colOf(hd, /^id$/i), cNu = colOf(hd, /compteur/i), cPo = colOf(hd, /police/i);
        var anyKey = false, order = 0;
        for (i = hdrI + 1; i < rows.length; i++) { var rr = rows[i] || []; if ((cId >= 0 && rr[cId]) || (cNu >= 0 && rr[cNu])) { anyKey = true; break; } }
        for (i = hdrI + 1; i < rows.length; i++) {
          rr = rows[i] || [];
          var m = anyKey ? find(cId >= 0 ? rr[cId] : null, cNu >= 0 ? rr[cNu] : null, cPo >= 0 ? rr[cPo] : null) : D.meters[order];
          order++;
          if (!m) { if (rr.some(function (v, c) { return mc.some(function (x) { return x[0] === c && typeof v === 'number'; }); })) rep.ignoredRows++; continue; }
          mc.forEach(function (x) { if (rr[x[0]] != null && rr[x[0]] !== '') put(m, x[1], rr[x[0]]); });
        }
        rep.mode = 'classeur (une colonne par mois)'; done = true;
      }
    }
    if (!done) {
      for (var si = 0; si < wb.SheetNames.length && !done; si++) {
        var rows2 = sheetRows(wb.Sheets[wb.SheetNames[si]]), hi2 = -1;
        for (i = 0; i < Math.min(rows2.length, 15); i++) { if (colOf(rows2[i] || [], /^index( du mois)?$/i) >= 0 && (colOf(rows2[i], /^id$/i) >= 0 || colOf(rows2[i], /compteur/i) >= 0 || colOf(rows2[i], /police/i) >= 0)) { hi2 = i; break; } }
        if (hi2 < 0) continue;
        var h2 = rows2[hi2], cx = colOf(h2, /^index( du mois)?$/i), c1 = colOf(h2, /^id$/i), c2 = colOf(h2, /compteur/i), c3 = colOf(h2, /police/i), cMo = colOf(h2, /^mois$/i);
        for (i = hi2 + 1; i < rows2.length; i++) {
          var r2 = rows2[i] || []; if (r2[cx] == null || r2[cx] === '') continue;
          var m2 = find(c1 >= 0 ? r2[c1] : null, c2 >= 0 ? r2[c2] : null, c3 >= 0 ? r2[c3] : null);
          if (!m2) { rep.ignoredRows++; continue; }
          var jj = S.month; if (cMo >= 0 && r2[cMo] != null) { var t = monthIdxFromHeader(r2[cMo], D); if (t >= 0) jj = t; }
          put(m2, jj, r2[cx]);
        }
        rep.mode = 'modèle du mois (' + mlabel(D.months[S.month]) + ')'; done = true;
      }
    }
    if (!done && !rep.newMeters) { alert('Format non reconnu.\n\nUtiliser soit le classeur STEG (feuille « Saisie_Index », une colonne par mois), soit le « Modèle de saisie du mois » rempli.'); return; }
    var msg = 'Importation de « ' + fname + ' » — ' + (rep.mode || 'compteurs') + '\n\n' +
      rep.added + ' nouveaux index, ' + rep.replaced + ' index remplacés, ' + rep.same + ' inchangés' +
      (rep.ignoredRows ? ', ' + rep.ignoredRows + ' lignes ignorées (compteur introuvable)' : '') +
      (rep.newMeters ? '\n' + rep.newMeters + ' nouveaux compteurs ajoutés' : '') +
      (rep.maxI >= 0 ? '\nMois concernés : ' + mlabel(D.months[rep.minI]) + ' → ' + mlabel(D.months[rep.maxI]) : '') +
      '\n\nEnregistrer ?';
    if (!rep.added && !rep.replaced && !rep.newMeters) { alert('Aucun nouvel index à importer (tout est déjà enregistré).'); return; }
    if (!confirm(msg)) return;
    if (!writeJSON(LS_SAISIES, sais) || !writeJSON(LS_METERS, extras)) { alert('Enregistrement impossible sur cet appareil (stockage plein ou bloqué).'); return; }
    S.data = compute(); S.month = rep.maxI >= 0 ? rep.maxI : S.data.def; fillSelectors(); refreshAll();
  }
  function onFile(input) {
    var f = input.files && input.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () { importWorkbook(fr.result, f.name); input.value = ''; };
    fr.readAsArrayBuffer(f);
  }
  function serial(key) {
    var y = parseInt(key.slice(0, 4), 10), m = parseInt(key.slice(5, 7), 10) - 1;
    return Date.UTC(y, m, 1) / 86400000 + 25569;
  }
  function saveAoa(aoa, widths, sheet, file) {
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = widths.map(function (w) { return { wch: w }; });
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheet);
    XLSX.writeFile(wb, file); return ws;
  }
  function exportTemplate() {
    if (typeof XLSX === 'undefined') { alert('Bibliothèque Excel non chargée.'); return; }
    var D = S.data, j = S.month, aoa = [['ID', 'District', 'N° compteur', 'Police', 'Adresse / Site', 'Dernier index antérieur', 'Mois du dernier index', 'Index du mois']];
    D.meters.forEach(function (m) {
      var pp = j > 0 ? m.pos[j - 1] : -1;
      aoa.push([m.id, m.district, m.num, m.police, m.adr, pp >= 0 ? m.R[pp] : null, pp >= 0 ? D.months[pp] : null, m.R[j] != null ? m.R[j] : null]);
    });
    saveAoa(aoa, [8, 12, 15, 11, 28, 14, 12, 14], 'Saisie ' + D.months[j], 'Modele_saisie_STEG_' + D.months[j] + '.xlsx');
  }
  function exportAll() {
    if (typeof XLSX === 'undefined') { alert('Bibliothèque Excel non chargée.'); return; }
    var D = S.data, from = D.first >= 0 ? D.first : 0, to = Math.max(D.lastRead, from);
    var hdr = ['ID', 'District', 'N° compteur', 'Adresse / Site'], cols = [];
    for (var j = from; j <= to; j++) cols.push(j);
    var aoa = [hdr.concat(cols.map(function (j) { return { t: 'n', v: serial(D.months[j]), z: 'mmm-yy' }; }))];
    D.meters.forEach(function (m) { aoa.push([m.id, m.district, m.num, m.adr].concat(cols.map(function (j) { return m.R[j] != null ? m.R[j] : null; }))); });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [8, 12, 15, 28].concat(cols.map(function () { return 10; })).map(function (w) { return { wch: w }; });
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Saisie_Index');
    var cs = [['ID', 'District', 'N° compteur', 'Police (8 chiffres)', 'Adresse / Site', 'Observation']];
    D.meters.forEach(function (m) { cs.push([m.id, m.district, m.num, m.police, m.adr, m.obs]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cs), 'Compteurs');
    var d = new Date();
    XLSX.writeFile(wb, 'Sauvegarde_index_STEG_' + d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + '.xlsx');
  }

  /* ---------- API publique ---------- */
  window.StegSuivi = {
    render: function () {
      if (!window.STEG_BASE) { var el = root(); if (el) el.innerHTML = '<div class="card">Données STEG introuvables (steg_data.js non chargé).</div>'; return; }
      if (!S.shell || !document.getElementById('steg-month')) { if (!shell()) return; S.data = null; }
      var first = !S.data;
      S.data = compute();
      if (first || S.month < 0 || S.month >= S.data.N) S.month = S.data.def;
      fillSelectors();
      refreshAll();
    },
    setMonth: function (v) { S.month = parseInt(v, 10); refreshAll(); },
    setFilter: function () {
      S.cat = document.getElementById('steg-f-cat').value;
      S.district = document.getElementById('steg-f-dist').value;
      S.q = document.getElementById('steg-f-q').value;
      refreshTable();
    },
    openMeter: openMeter,
    closeModal: function () { document.getElementById('steg-modal').classList.remove('open'); },
    addReading: addReading,
    removeReading: removeReading,
    exportXlsx: exportXlsx,
    exportTemplate: exportTemplate,
    exportAll: exportAll,
    pickFile: function () { document.getElementById('steg-file').click(); },
    onFile: onFile,
    openBulk: openBulk,
    bulkInput: function (id, v) { BULK.vals[id] = v; },
    bulkFilter: function () {
      BULK.district = document.getElementById('stb-dist').value; BULK.q = document.getElementById('stb-q').value;
      document.getElementById('stb-body').innerHTML = bulkTable();
    },
    bulkSave: bulkSave,
    goYear: function (y) {
      var D = S.data, last = -1, any = -1;
      for (var j = 0; j < D.N; j++) { if (parseInt(D.months[j].slice(0, 4), 10) === y) { if (D.reads[j] > 0) last = j; if (any < 0) any = j; } }
      S.month = last >= 0 ? last : any; fillSelectors(); refreshAll();
    },
    saveParams: function () {
      function num(id) { var v = parseFloat(document.getElementById(id).value); return isNaN(v) ? null : v; }
      var o = { hausse: num('stp-hausse'), baisse: num('stp-baisse'), sansReleve: num('stp-sans'), maxGap: num('stp-gap'), couverture: num('stp-cov'), tarif: num('stp-tarif') };
      var base = window.STEG_BASE.params;
      if (o.hausse == null || o.baisse == null || o.sansReleve == null || o.maxGap == null || o.couverture == null || o.hausse < 0 || o.baisse < 0 || o.maxGap < 1 || o.couverture <= 0 || o.couverture > 1) {
        alert('Valeurs invalides : vérifier les seuils (positifs), l’écart maximal (≥ 1 mois) et la couverture (entre 0 et 1).'); return;
      }
      writeJSON(LS_PARAMS, o);
      reload(S.month);
    },
    resetParams: function () {
      try { localStorage.removeItem(LS_PARAMS); } catch (e) { /* ignore */ }
      reload(S.month);
    },
    /* pour tests */
    _compute: compute, _stat: function (m, j, D) { return stat(m, j, D); }
  };
})();
