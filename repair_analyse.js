/**
 * ============================================================
 *  REPAIR_ANALYSE.JS — Analyse Réparations : Véhicule · Division · CSC
 *  DRT Sfax — Parc Auto
 *
 *  Croise les deux sources déjà importées dans l'application :
 *    - "Historique dépenses" (localStorage parcAutoRepairHist_v1)
 *        { "2025": { "17-123456": {matricule, chauffeur, marque, division,
 *                                  subdivision, montant, nbVidange, nbAccident} } }
 *    - "STAT CSC" (pa.data.cscHistData / parcAutoCscHist_v1)
 *        { vehicles:[{matricule, modele, subdivision, montants:{année:montant}}] }
 *
 *  Apporte :
 *    - Vue PAR VÉHICULE  : toutes les années côte à côte, variation, % budget,
 *                          cumul %, alertes (coût élevé / hausse), fiche détail
 *    - Vue PAR DIVISION  : totaux par année, variation, détail véhicules + CSC
 *    - Vue PAR CSC       : totaux par année, variation, détail véhicules + divisions
 *    - Vue DIVISION × CSC: matrice croisée avec carte de chaleur
 *    - Filtres (années, division, CSC, recherche), tri sur chaque colonne
 *    - Contrôle de cohérence entre les deux sources
 *    - Constats clés automatiques (écran + PowerPoint)
 *    - Export Excel multi-feuilles aux couleurs TT (ExcelJS)
 *    - Export PowerPoint (PptxGenJS) : constats, évolution, division, CSC, matrice, top 10, alertes
 *    - Copie cloud de l'historique dépenses (repli si localStorage vide)
 *
 *  Module 100% additif : ne modifie AUCUNE fonction existante.
 *  À inclure dans admin.html APRÈS csc_rapport.js :
 *    <script src="repair_analyse.js?v=1"></script>
 * ============================================================
 */
(function () {
  'use strict';

  var root = (typeof window !== 'undefined') ? window : globalThis;
  if (root.__repairAnalyseLoaded) return;
  root.__repairAnalyseLoaded = true;

  var REPAIR_KEY = 'parcAutoRepairHist_v1';
  var CSC_KEY = 'parcAutoCscHist_v1';
  var NAVY = '#1E3A5F', ORANGE = '#EF6C00';
  var NONE_LABEL = 'Non renseigné';

  /* ══════════════════════════════════════════════════════════
   *  HELPERS
   * ══════════════════════════════════════════════════════════ */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(v) {
    var n = parseFloat(String(v === null || v === undefined ? '' : v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function normPlate(s) { return String(s || '').replace(/\s+/g, '').toUpperCase(); }
  function normKey(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function fmt(n) { return Math.round(n || 0).toLocaleString('fr-FR'); }
  function fmtDT(n) { return fmt(n) + ' DT'; }
  function pct(x, dec) { return (x * 100).toFixed(dec === undefined ? 1 : dec).replace('.', ',') + ' %'; }
  function isBlank(s) { s = String(s === null || s === undefined ? '' : s).trim(); return !s || s === '—' || s === '-'; }
  function normalizeCscLabel(raw) {
    if (isBlank(raw)) return NONE_LABEL;
    var s = String(raw).replace(/\s+/g, ' ').trim();
    return s.replace(/^C\s*S\s*C\b/i, 'CSC');
  }
  function normalizeDivLabel(raw) { return isBlank(raw) ? NONE_LABEL : String(raw).replace(/\s+/g, ' ').trim(); }

  /* ══════════════════════════════════════════════════════════
   *  SOURCES DE DONNÉES
   * ══════════════════════════════════════════════════════════ */
  function hasYears(o) {
    return !!o && typeof o === 'object' && Object.keys(o).some(function (y) { return /^\d{4}$/.test(y) && o[y] && Object.keys(o[y]).length; });
  }
  function readLocalRepair() {
    try { return JSON.parse(localStorage.getItem(REPAIR_KEY)) || {}; } catch (e) { return {}; }
  }
  /**
   * Historique dépenses : localStorage d'abord ; s'il est vide (nouvel appareil, cache vidé),
   * repli sur la copie cloud pa.data.repairHistData (voir pushRepairToCloud).
   */
  function getRepair() {
    var local = readLocalRepair();
    if (hasYears(local)) return local;
    try {
      var pa = root.parcAuto;
      var cloud = pa && pa.data && pa.data.repairHistData;
      if (hasYears(cloud)) {
        try { localStorage.setItem(REPAIR_KEY, JSON.stringify(cloud)); } catch (e) {}
        return cloud;
      }
    } catch (e) {}
    return local;
  }
  /**
   * Copie l'historique local vers le cloud (même mécanisme que cscHistData).
   * Appelée uniquement après un import ou un effacement : jamais au simple affichage,
   * pour qu'un appareil resté sur d'anciennes données n'écrase pas le cloud.
   */
  function pushRepairToCloud() {
    try {
      var pa = root.parcAuto;
      if (!pa || !pa.data || typeof pa.saveData !== 'function') return;
      var local = readLocalRepair();
      var prev = pa.data.repairHistData || null;
      if (JSON.stringify(prev) === JSON.stringify(hasYears(local) ? local : null)) return;
      if (!hasYears(local) && !prev) return;
      pa.data.repairHistData = hasYears(local) ? local : {};
      pa.saveData();
    } catch (e) { console.warn('[repair_analyse] sync cloud historique échouée:', e); }
  }
  function getCsc() {
    // Même ordre de priorité que csc_rapport.js
    try {
      var pa = root.parcAuto;
      if (pa && pa.data && pa.data.cscHistData && Array.isArray(pa.data.cscHistData.vehicles) && pa.data.cscHistData.vehicles.length)
        return pa.data.cscHistData;
    } catch (e) {}
    try {
      var main = JSON.parse(localStorage.getItem('parcAutoData_v3') || '{}');
      if (main.cscHistData && Array.isArray(main.cscHistData.vehicles) && main.cscHistData.vehicles.length)
        return main.cscHistData;
    } catch (e) {}
    try {
      var st = JSON.parse(localStorage.getItem(CSC_KEY));
      if (st && Array.isArray(st.vehicles)) return st;
    } catch (e) {}
    return { vehicles: [], years: [] };
  }

  /**
   * Fusionne les deux sources en un jeu de données unique, une entrée par véhicule.
   * Pour chaque année, la source des montants est :
   *   - véhicules / divisions : l'historique dépenses s'il couvre l'année, sinon STAT CSC
   *   - CSC                   : STAT CSC s'il couvre l'année, sinon l'historique dépenses
   */
  function buildDataset() {
    var rep = getRepair(), csc = getCsc();
    var repYears = Object.keys(rep).filter(function (y) { return /^\d{4}$/.test(y) && rep[y] && Object.keys(rep[y]).length; }).sort();
    var cscYearsSet = {};
    (csc.vehicles || []).forEach(function (v) { Object.keys(v.montants || {}).forEach(function (y) { cscYearsSet[y] = true; }); });
    var cscYears = Object.keys(cscYearsSet).sort();
    var yearsSet = {};
    repYears.concat(cscYears).forEach(function (y) { yearsSet[y] = true; });
    var years = Object.keys(yearsSet).sort();

    var map = {};
    function getV(plateKey, display) {
      if (!map[plateKey]) map[plateKey] = {
        key: plateKey, matricule: display || plateKey, chauffeur: '', marque: '', genre: '',
        division: '', repSub: '', cscLabel: '',
        repM: {}, cscM: {}, vid: {}, acc: {}
      };
      return map[plateKey];
    }
    function setIf(v, field, val) { if (!isBlank(val)) v[field] = String(val).trim(); }

    repYears.forEach(function (y) {              // années croissantes : la valeur la plus récente l'emporte
      Object.keys(rep[y]).forEach(function (id) {
        var e = rep[y][id] || {};
        var k = normPlate(e.matricule || id);
        if (!k) return;
        var v = getV(k, e.matricule || id);
        setIf(v, 'chauffeur', e.chauffeur); setIf(v, 'marque', e.marque); setIf(v, 'genre', e.genre);
        setIf(v, 'division', e.division); setIf(v, 'repSub', e.subdivision);
        v.repM[y] = (v.repM[y] || 0) + num(e.montant);
        v.vid[y] = e.nbVidange || 0; v.acc[y] = e.nbAccident || 0;
      });
    });
    (csc.vehicles || []).forEach(function (cv) {
      var k = normPlate(cv.matricule);
      if (!k) return;
      var v = getV(k, cv.matricule);
      if (!v.marque) setIf(v, 'marque', cv.modele);
      if (!isBlank(cv.subdivision)) v.cscLabel = normalizeCscLabel(cv.subdivision);
      Object.keys(cv.montants || {}).forEach(function (y) { v.cscM[y] = (v.cscM[y] || 0) + num(cv.montants[y]); });
    });

    var vehicles = Object.keys(map).map(function (k) {
      var v = map[k];
      v.divLabel = normalizeDivLabel(v.division);
      v.cscGroup = v.cscLabel || (/c\s*s\s*c/i.test(v.repSub) ? normalizeCscLabel(v.repSub) : NONE_LABEL);
      return v;
    });
    // Libellés canoniques : « division technique » et « Division Technique » s'affichent de la même façon
    var canonD = {}, canonC = {};
    vehicles.forEach(function (v) {
      var kd = normKey(v.divLabel), kc = normKey(v.cscGroup);
      if (!canonD[kd]) canonD[kd] = v.divLabel;
      if (!canonC[kc]) canonC[kc] = v.cscGroup;
    });
    vehicles.forEach(function (v) { v.divLabel = canonD[normKey(v.divLabel)]; v.cscGroup = canonC[normKey(v.cscGroup)]; });
    var repSet = {}, cscSet = {};
    repYears.forEach(function (y) { repSet[y] = true; });
    cscYears.forEach(function (y) { cscSet[y] = true; });
    return { vehicles: vehicles, years: years, repSet: repSet, cscSet: cscSet, repYears: repYears, cscYears: cscYears };
  }

  /* ══════════════════════════════════════════════════════════
   *  ÉTAT
   * ══════════════════════════════════════════════════════════ */
  var state = {
    view: 'vehicule', years: {}, yearsInit: false, division: '', csc: '', search: '',
    sort: {
      vehicule: { key: 'total', dir: -1 },
      division: { key: 'total', dir: -1 },
      csc: { key: 'total', dir: -1 }
    },
    open: {}
  };
  var DS = null;

  function selYears() { return DS.years.filter(function (y) { return state.years[y]; }); }
  function amtVeh(v, y) { return DS.repSet[y] ? (v.repM[y] || 0) : (v.cscM[y] || 0); }
  function amtCsc(v, y) { return DS.cscSet[y] ? (v.cscM[y] || 0) : (v.repM[y] || 0); }
  function sumSel(v, fn) { return selYears().reduce(function (s, y) { return s + fn(v, y); }, 0); }

  function filteredVehicles() {
    var q = normKey(state.search);
    return DS.vehicles.filter(function (v) {
      if (state.division && normKey(v.divLabel) !== state.division) return false;
      if (state.csc && normKey(v.cscGroup) !== state.csc) return false;
      if (q) {
        var hay = normKey([v.matricule, v.chauffeur, v.marque, v.divLabel, v.cscGroup].join(' '));
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /** Variation entre les deux dernières années sélectionnées. null si non calculable. */
  function variation(perYear) {
    var ys = selYears();
    if (ys.length < 2) return null;
    var cur = perYear[ys[ys.length - 1]] || 0, prev = perYear[ys[ys.length - 2]] || 0;
    if (prev <= 0) return null;
    return (cur - prev) / prev;
  }

  /**
   * Regroupe les véhicules (division ou CSC) et calcule totaux par année,
   * total sur la période, moyenne par véhicule, variation et part du budget.
   */
  function groupBy(vehs, labelFn, amtFn) {
    var m = {}, order = [];
    vehs.forEach(function (v) {
      var raw = labelFn(v), k = normKey(raw);
      if (!m[k]) { m[k] = { key: k, label: raw, vehs: [], perYear: {}, total: 0 }; order.push(k); }
      var g = m[k];
      g.vehs.push(v);
      DS.years.forEach(function (y) { g.perYear[y] = (g.perYear[y] || 0) + amtFn(v, y); });
    });
    var list = order.map(function (k) { return m[k]; });
    var grand = 0;
    list.forEach(function (g) {
      g.total = selYears().reduce(function (s, y) { return s + (g.perYear[y] || 0); }, 0);
      grand += g.total;
    });
    list.forEach(function (g) {
      g.nbVeh = g.vehs.length;
      g.nbActifs = g.vehs.filter(function (v) { return sumSel(v, amtFn) > 0; }).length;
      g.avg = g.nbVeh ? g.total / g.nbVeh : 0;
      g.var = variation(g.perYear);
      g.pct = grand > 0 ? g.total / grand : 0;
    });
    return { list: list, grand: grand };
  }

  function sortList(list, sortState, getters) {
    var key = sortState.key, dir = sortState.dir;
    var get = getters[key] || (key.indexOf('y:') === 0 ? function (r) { return r.perYear[key.slice(2)] || 0; } : getters.total);
    return list.slice().sort(function (a, b) {
      var x = get(a), y = get(b);
      if (typeof x === 'string' || typeof y === 'string') return String(x || '').localeCompare(String(y || ''), 'fr') * dir;
      x = (x === null || x === undefined) ? -Infinity : x; y = (y === null || y === undefined) ? -Infinity : y;
      return (x - y) * dir;
    });
  }

  /** Lignes "véhicule" enrichies pour la période sélectionnée. */
  function vehicleRows(vehs, amtFn, grandOverride) {
    var rows = vehs.map(function (v) {
      var perYear = {};
      DS.years.forEach(function (y) { perYear[y] = amtFn(v, y); });
      var total = selYears().reduce(function (s, y) { return s + perYear[y]; }, 0);
      return { v: v, perYear: perYear, total: total, var: variation(perYear) };
    });
    var grand = grandOverride !== undefined ? grandOverride : rows.reduce(function (s, r) { return s + r.total; }, 0);
    var ny = Math.max(selYears().length, 1);
    rows.forEach(function (r) { r.avgYear = r.total / ny; r.pct = grand > 0 ? r.total / grand : 0; });
    return { rows: rows, grand: grand };
  }

  function fleetAvgActive() {
    var vals = DS.vehicles.map(function (v) { return sumSel(v, amtVeh); }).filter(function (t) { return t > 0; });
    return vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : 0;
  }

  function vehicleStatus(r, fleetAvg) {
    var out = [];
    if (fleetAvg > 0 && r.total > 2 * fleetAvg) out.push({ t: '⚠️ Coût élevé', c: '#991B1B', bg: '#FEE2E2' });
    if (r.var !== null && r.var >= 0.5 && r.total > 0) out.push({ t: '📈 En hausse', c: '#9A3412', bg: '#FFEDD5' });
    return out;
  }

  /* ══════════════════════════════════════════════════════════
   *  RENDU — BRIQUES
   * ══════════════════════════════════════════════════════════ */
  function varCell(vr) {
    if (vr === null) return '<span style="color:#94a3b8;">—</span>';
    var up = vr > 0.0005, down = vr < -0.0005;
    var color = up ? '#B91C1C' : (down ? '#047857' : '#64748b');
    var arrow = up ? '▲' : (down ? '▼' : '■');
    return '<span style="color:' + color + ';font-weight:700;white-space:nowrap;">' + arrow + ' ' + (vr > 0 ? '+' : '') + pct(vr) + '</span>';
  }
  function badge(b) {
    return '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;margin:1px 2px 1px 0;color:' + b.c + ';background:' + b.bg + ';white-space:nowrap;">' + b.t + '</span>';
  }
  function th(label, key, sortState, extraStyle) {
    var active = sortState && sortState.key === key;
    var arrow = active ? (sortState.dir < 0 ? ' ▼' : ' ▲') : '';
    return '<th data-ra-sort="' + esc(key) + '" style="cursor:pointer;white-space:nowrap;' + (extraStyle || '') + '" title="Cliquer pour trier">' + esc(label) + arrow + '</th>';
  }
  function emptyMsg(cols, msg) {
    return '<tr><td colspan="' + cols + '" style="text-align:center;padding:24px;color:var(--secondary);">' + esc(msg) + '</td></tr>';
  }
  function barRow(label, value, max, right) {
    return '<div style="margin-bottom:6px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;"><span style="font-weight:600;">' + esc(label) + '</span><span style="color:var(--secondary);">' + esc(right) + '</span></div>' +
      '<div style="background:#f1f5f9;border-radius:6px;height:10px;overflow:hidden;"><div style="width:' + (max > 0 ? Math.max(value / max * 100, value > 0 ? 2 : 0) : 0) + '%;height:100%;background:linear-gradient(90deg,' + NAVY + ',' + ORANGE + ');border-radius:6px;"></div></div></div>';
  }
  function statCard(icon, color, value, label, small) {
    return '<div class="stat-card"><div class="stat-icon ' + color + '">' + icon + '</div><div class="stat-info"><h3' + (small ? ' style="font-size:15px;line-height:1.25;"' : '') + '>' + value + '</h3><p>' + label + '</p></div></div>';
  }

  /* ══════════════════════════════════════════════════════════
   *  RENDU — KPI
   * ══════════════════════════════════════════════════════════ */
  function renderKpi() {
    var el = document.getElementById('ra-kpi');
    if (!el) return;
    var vehs = filteredVehicles();
    var ys = selYears();
    if (!DS.vehicles.length || !ys.length) { el.innerHTML = ''; return; }
    var vr = vehicleRows(vehs, amtVeh);
    var actifs = vr.rows.filter(function (r) { return r.total > 0; });
    var avg = actifs.length ? vr.grand / actifs.length : 0;
    var perYearTotal = {};
    DS.years.forEach(function (y) { perYearTotal[y] = vehs.reduce(function (s, v) { return s + amtVeh(v, y); }, 0); });
    var fleetVar = variation(perYearTotal);
    var gd = groupBy(vehs, function (v) { return v.divLabel; }, amtVeh).list.sort(function (a, b) { return b.total - a.total; })[0];
    var gc = groupBy(vehs, function (v) { return v.cscGroup; }, amtCsc).list.sort(function (a, b) { return b.total - a.total; })[0];
    var topV = vr.rows.slice().sort(function (a, b) { return b.total - a.total; })[0];
    var periode = ys.length === 1 ? ys[0] : ys[0] + '–' + ys[ys.length - 1] + ' (' + ys.length + ' ans)';
    var html = '';
    html += statCard('💰', 'blue', fmtDT(vr.grand), 'Dépense totale — ' + esc(periode));
    html += statCard('🚗', 'green', actifs.length + ' / ' + vehs.length, 'Véhicules avec dépense');
    html += statCard('📊', 'orange', fmtDT(avg), 'Moyenne / véhicule actif');
    html += statCard('📈', fleetVar !== null && fleetVar > 0 ? 'red' : 'green', fleetVar === null ? '—' : ((fleetVar > 0 ? '+' : '') + pct(fleetVar)), 'Variation ' + (ys.length > 1 ? esc(ys[ys.length - 2]) + ' → ' + esc(ys[ys.length - 1]) : '(1 seule année)'));
    if (gd && gd.total > 0) html += statCard('🏢', 'blue', esc(gd.label), 'Division la + coûteuse — ' + pct(gd.pct, 0), true);
    if (gc && gc.total > 0) html += statCard('🏬', 'orange', esc(gc.label), 'CSC la + coûteuse — ' + pct(gc.pct, 0), true);
    if (topV && topV.total > 0) html += statCard('🏆', 'red', esc(topV.v.matricule), 'Véhicule le + coûteux — ' + fmtDT(topV.total), true);
    el.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════════
   *  RENDU — VUE PAR VÉHICULE
   * ══════════════════════════════════════════════════════════ */
  var VEH_GETTERS = {
    matricule: function (r) { return r.v.matricule; }, chauffeur: function (r) { return r.v.chauffeur; },
    marque: function (r) { return r.v.marque; }, division: function (r) { return r.v.divLabel; },
    csc: function (r) { return r.v.cscGroup; }, total: function (r) { return r.total; },
    avg: function (r) { return r.avgYear; }, var: function (r) { return r.var; }, pct: function (r) { return r.pct; }
  };
  function vehRowGetter(key) {
    return VEH_GETTERS[key] || null;
  }
  function sortVehRows(rows, ss) {
    var g = vehRowGetter(ss.key);
    var get = g || (ss.key.indexOf('y:') === 0 ? function (r) { return r.perYear[ss.key.slice(2)] || 0; } : VEH_GETTERS.total);
    return rows.slice().sort(function (a, b) {
      var x = get(a), y = get(b);
      if (typeof x === 'string' || typeof y === 'string') return String(x || '').localeCompare(String(y || ''), 'fr') * ss.dir;
      x = (x === null || x === undefined) ? -Infinity : x; y = (y === null || y === undefined) ? -Infinity : y;
      return (x - y) * ss.dir;
    });
  }

  function vehicleDetailHtml(r, ncols) {
    var v = r.v, ys = DS.years;
    var maxY = Math.max.apply(null, ys.map(function (y) { return r.perYear[y] || 0; }).concat([1]));
    var bars = ys.map(function (y) {
      var val = r.perYear[y] || 0;
      return barRow(y, val, maxY, fmtDT(val) + ((v.vid[y] || v.acc[y]) ? '  ·  🛠️ ' + (v.vid[y] || 0) + ' vidange(s)  ⚠️ ' + (v.acc[y] || 0) + ' accident(s)' : ''));
    }).join('');
    // Position dans le parc, par année
    var ranks = ys.map(function (y) {
      var vals = DS.vehicles.map(function (x) { return amtVeh(x, y); }).filter(function (a) { return a > 0; }).sort(function (a, b) { return b - a; });
      var mine = amtVeh(v, y);
      var pos = mine > 0 ? vals.indexOf(mine) + 1 : 0;
      return '<span style="margin-right:14px;">' + y + ' : ' + (pos ? '<strong>' + pos + '</strong>/' + vals.length : '—') + '</span>';
    }).join('');
    // Part dans sa division
    var divTotal = DS.vehicles.filter(function (x) { return normKey(x.divLabel) === normKey(v.divLabel); })
      .reduce(function (s, x) { return s + sumSel(x, amtVeh); }, 0);
    var share = divTotal > 0 ? r.total / divTotal : 0;
    return '<tr><td colspan="' + ncols + '" style="background:#f8fafc;padding:14px 18px;">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;">' +
      '<div><div style="font-weight:800;color:' + NAVY + ';margin-bottom:8px;">📅 Dépenses par année — ' + esc(v.matricule) + '</div>' + bars + '</div>' +
      '<div style="font-size:13px;line-height:1.7;"><div style="font-weight:800;color:' + NAVY + ';margin-bottom:8px;">📌 Repères</div>' +
      '<div>Chauffeur : <strong>' + esc(v.chauffeur || '—') + '</strong> · Marque : <strong>' + esc(v.marque || '—') + '</strong></div>' +
      '<div>Division : <strong>' + esc(v.divLabel) + '</strong> · CSC : <strong>' + esc(v.cscGroup) + '</strong></div>' +
      '<div>Total période : <strong>' + fmtDT(r.total) + '</strong> · Moyenne / an : <strong>' + fmtDT(r.avgYear) + '</strong></div>' +
      '<div>Part dans sa division : <strong>' + pct(share) + '</strong></div>' +
      '<div style="margin-top:6px;color:var(--secondary);">Rang dans le parc (par année) : ' + ranks + '</div></div></div></td></tr>';
  }

  function renderVehicleView() {
    var vehs = filteredVehicles();
    var ss = state.sort.vehicule, ys = DS.years, sel = selYears();
    var vr = vehicleRows(vehs, amtVeh);
    var rows = sortVehRows(vr.rows, ss);
    var fleetAvg = fleetAvgActive();
    var ncols = 8 + ys.length + 3;
    var head = '<tr><th>#</th>' + th('Matricule', 'matricule', ss) + th('Chauffeur', 'chauffeur', ss) + th('Marque', 'marque', ss) +
      th('Division', 'division', ss) + th('CSC', 'csc', ss) +
      ys.map(function (y) { return th(y, 'y:' + y, ss, 'text-align:right;' + (state.years[y] ? '' : 'opacity:.45;')); }).join('') +
      th('Total (DT)', 'total', ss, 'text-align:right;') + th('Moy. / an', 'avg', ss, 'text-align:right;') +
      th('Variation', 'var', ss) + th('% budget', 'pct', ss, 'text-align:right;') + '<th>Cumul %</th><th>Statut</th></tr>';
    var cum = 0;
    var body = rows.length ? rows.map(function (r, i) {
      var isOpen = !!state.open['v:' + r.v.key];
      cum += r.pct;
      var tr = '<tr data-ra-toggle="v:' + esc(r.v.key) + '" style="cursor:pointer;' + (i < 3 && r.total > 0 && ss.key === 'total' && ss.dir < 0 ? 'background:#fff7ed;' : '') + '">' +
        '<td><strong>' + (i + 1) + '</strong></td>' +
        '<td style="white-space:nowrap;">' + (isOpen ? '▾ ' : '▸ ') + '<strong>' + esc(r.v.matricule) + '</strong></td>' +
        '<td>' + esc(r.v.chauffeur || '—') + '</td><td>' + esc(r.v.marque || '—') + '</td>' +
        '<td>' + esc(r.v.divLabel) + '</td><td>' + esc(r.v.cscGroup) + '</td>' +
        ys.map(function (y) { return '<td style="text-align:right;' + (state.years[y] ? '' : 'opacity:.45;') + '">' + (r.perYear[y] ? fmt(r.perYear[y]) : '—') + '</td>'; }).join('') +
        '<td style="text-align:right;font-weight:800;">' + fmt(r.total) + '</td>' +
        '<td style="text-align:right;">' + fmt(r.avgYear) + '</td>' +
        '<td>' + varCell(r.var) + '</td>' +
        '<td style="text-align:right;">' + pct(r.pct) + '</td>' +
        '<td style="text-align:right;color:var(--secondary);">' + (ss.key === 'total' && ss.dir < 0 ? pct(Math.min(cum, 1), 0) : '—') + '</td>' +
        '<td>' + vehicleStatus(r, fleetAvg).map(badge).join('') + '</td></tr>';
      return tr + (isOpen ? vehicleDetailHtml(r, ncols) : '');
    }).join('') : emptyMsg(ncols, DS.vehicles.length ? 'Aucun véhicule ne correspond aux filtres' : 'Aucune donnée importée');

    var totRow = '';
    if (rows.length) {
      var totals = ys.map(function (y) { return rows.reduce(function (s, r) { return s + (r.perYear[y] || 0); }, 0); });
      totRow = '<tr style="background:' + NAVY + ';color:#fff;font-weight:800;"><td colspan="6">TOTAL — ' + rows.length + ' véhicule(s)</td>' +
        totals.map(function (t) { return '<td style="text-align:right;">' + fmt(t) + '</td>'; }).join('') +
        '<td style="text-align:right;">' + fmt(vr.grand) + '</td><td colspan="5"></td></tr>';
    }
    document.getElementById('ra-view').innerHTML =
      '<div style="font-size:12px;color:var(--secondary);margin-bottom:8px;">Cliquer sur une ligne pour ouvrir la fiche du véhicule · cliquer sur un en-tête pour trier · années grisées = exclues du total.</div>' +
      '<div style="overflow-x:auto;"><table class="data-table"><thead>' + head + '</thead><tbody>' + body + totRow + '</tbody></table></div>';
  }

  /* ══════════════════════════════════════════════════════════
   *  RENDU — VUES DIVISION / CSC (même structure)
   * ══════════════════════════════════════════════════════════ */
  var GRP_GETTERS = {
    label: function (g) { return g.label; }, nbVeh: function (g) { return g.nbVeh; },
    total: function (g) { return g.total; }, avg: function (g) { return g.avg; },
    var: function (g) { return g.var; }, pct: function (g) { return g.pct; }
  };

  function groupDetailHtml(g, ncols, kind, amtFn) {
    var vr = vehicleRows(g.vehs, amtFn, g.total);
    var rows = vr.rows.sort(function (a, b) { return b.total - a.total; });
    var otherLabelFn = kind === 'division' ? function (v) { return v.cscGroup; } : function (v) { return v.divLabel; };
    var other = groupBy(g.vehs, otherLabelFn, amtFn).list.sort(function (a, b) { return b.total - a.total; });
    var maxO = Math.max.apply(null, other.map(function (o) { return o.total; }).concat([1]));
    var otherTitle = kind === 'division' ? '🏬 Répartition par CSC' : '🏢 Répartition par division';
    var ys = DS.years;
    var vt = '<table class="data-table" style="font-size:12px;"><thead><tr><th>#</th><th>Matricule</th><th>Chauffeur</th><th>Marque</th><th>' + (kind === 'division' ? 'CSC' : 'Division') + '</th>' +
      ys.map(function (y) { return '<th style="text-align:right;">' + y + '</th>'; }).join('') +
      '<th style="text-align:right;">Total (DT)</th><th>Variation</th><th style="text-align:right;">% du groupe</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        return '<tr><td>' + (i + 1) + '</td><td><strong>' + esc(r.v.matricule) + '</strong></td><td>' + esc(r.v.chauffeur || '—') + '</td><td>' + esc(r.v.marque || '—') + '</td>' +
          '<td>' + esc(kind === 'division' ? r.v.cscGroup : r.v.divLabel) + '</td>' +
          ys.map(function (y) { return '<td style="text-align:right;">' + (r.perYear[y] ? fmt(r.perYear[y]) : '—') + '</td>'; }).join('') +
          '<td style="text-align:right;font-weight:700;">' + fmt(r.total) + '</td><td>' + varCell(r.var) + '</td><td style="text-align:right;">' + pct(r.pct) + '</td></tr>';
      }).join('') + '</tbody></table>';
    return '<tr><td colspan="' + ncols + '" style="background:#f8fafc;padding:14px 18px;">' +
      '<div style="display:grid;grid-template-columns:minmax(220px,1fr) 3fr;gap:20px;align-items:start;">' +
      '<div><div style="font-weight:800;color:' + NAVY + ';margin-bottom:8px;">' + otherTitle + '</div>' +
      other.map(function (o) { return barRow(o.label, o.total, maxO, fmtDT(o.total) + ' · ' + o.nbVeh + ' véh.'); }).join('') + '</div>' +
      '<div style="overflow-x:auto;"><div style="font-weight:800;color:' + NAVY + ';margin-bottom:8px;">🚗 Véhicules (' + rows.length + ')</div>' + vt + '</div>' +
      '</div></td></tr>';
  }

  function renderGroupView(kind) {
    var vehs = filteredVehicles();
    var isDiv = kind === 'division';
    var amtFn = isDiv ? amtVeh : amtCsc;
    var gr = groupBy(vehs, function (v) { return isDiv ? v.divLabel : v.cscGroup; }, amtFn);
    var ss = state.sort[kind], ys = DS.years;
    var list = sortList(gr.list, ss, GRP_GETTERS);
    var ncols = 6 + ys.length + 1;
    var head = '<tr>' + th(isDiv ? 'Division' : 'CSC', 'label', ss) + th('Nb véhicules', 'nbVeh', ss, 'text-align:right;') +
      ys.map(function (y) { return th(y, 'y:' + y, ss, 'text-align:right;' + (state.years[y] ? '' : 'opacity:.45;')); }).join('') +
      th('Total (DT)', 'total', ss, 'text-align:right;') + th('Moy. / véhicule', 'avg', ss, 'text-align:right;') +
      th('Variation', 'var', ss) + th('% budget', 'pct', ss, 'text-align:right;') + '<th style="min-width:110px;">Poids</th></tr>';
    var maxT = Math.max.apply(null, list.map(function (g) { return g.total; }).concat([1]));
    var body = list.length ? list.map(function (g) {
      var key = kind + ':' + g.key, isOpen = !!state.open[key];
      var tr = '<tr data-ra-toggle="' + esc(key) + '" style="cursor:pointer;">' +
        '<td style="white-space:nowrap;">' + (isOpen ? '▾ ' : '▸ ') + '<strong>' + esc(g.label) + '</strong></td>' +
        '<td style="text-align:right;">' + g.nbVeh + (g.nbActifs !== g.nbVeh ? ' <span style="color:var(--secondary);font-size:11px;">(' + g.nbActifs + ' actifs)</span>' : '') + '</td>' +
        ys.map(function (y) { return '<td style="text-align:right;' + (state.years[y] ? '' : 'opacity:.45;') + '">' + (g.perYear[y] ? fmt(g.perYear[y]) : '—') + '</td>'; }).join('') +
        '<td style="text-align:right;font-weight:800;">' + fmt(g.total) + '</td><td style="text-align:right;">' + fmt(g.avg) + '</td>' +
        '<td>' + varCell(g.var) + '</td><td style="text-align:right;">' + pct(g.pct) + '</td>' +
        '<td><div style="background:#f1f5f9;border-radius:6px;height:10px;overflow:hidden;"><div style="width:' + (g.total / maxT * 100) + '%;height:100%;background:linear-gradient(90deg,' + NAVY + ',' + ORANGE + ');"></div></div></td></tr>';
      return tr + (isOpen ? groupDetailHtml(g, ncols + 1, kind, amtFn) : '');
    }).join('') : emptyMsg(ncols + 1, DS.vehicles.length ? 'Aucune donnée pour ces filtres' : 'Aucune donnée importée');

    var totRow = '';
    if (list.length) {
      totRow = '<tr style="background:' + NAVY + ';color:#fff;font-weight:800;"><td>TOTAL</td><td style="text-align:right;">' + list.reduce(function (s, g) { return s + g.nbVeh; }, 0) + '</td>' +
        ys.map(function (y) { return '<td style="text-align:right;">' + fmt(list.reduce(function (s, g) { return s + (g.perYear[y] || 0); }, 0)) + '</td>'; }).join('') +
        '<td style="text-align:right;">' + fmt(gr.grand) + '</td><td colspan="4"></td></tr>';
    }
    document.getElementById('ra-view').innerHTML =
      '<div style="font-size:12px;color:var(--secondary);margin-bottom:8px;">Cliquer sur une ligne pour voir ' + (isDiv ? 'sa répartition par CSC et ses véhicules' : 'sa répartition par division et ses véhicules') + '.</div>' +
      '<div style="overflow-x:auto;"><table class="data-table"><thead>' + head + '</thead><tbody>' + body + totRow + '</tbody></table></div>';
  }

  /* ══════════════════════════════════════════════════════════
   *  RENDU — MATRICE DIVISION × CSC
   * ══════════════════════════════════════════════════════════ */
  function crossMatrix(vehs) {
    var divs = {}, cscs = {}, cell = {};
    vehs.forEach(function (v) {
      var dk = normKey(v.divLabel), ck = normKey(v.cscGroup);
      divs[dk] = v.divLabel; cscs[ck] = v.cscGroup;
      var k = dk + '||' + ck;
      cell[k] = (cell[k] || 0) + sumSel(v, amtVeh);
    });
    var dRows = Object.keys(divs).map(function (k) {
      var tot = 0; Object.keys(cscs).forEach(function (c) { tot += cell[k + '||' + c] || 0; });
      return { key: k, label: divs[k], total: tot };
    }).sort(function (a, b) { return b.total - a.total; });
    var cCols = Object.keys(cscs).map(function (k) {
      var tot = 0; Object.keys(divs).forEach(function (d) { tot += cell[d + '||' + k] || 0; });
      return { key: k, label: cscs[k], total: tot };
    }).sort(function (a, b) { return b.total - a.total; });
    var max = 0; Object.keys(cell).forEach(function (k) { if (cell[k] > max) max = cell[k]; });
    return { dRows: dRows, cCols: cCols, cell: cell, max: max, grand: dRows.reduce(function (s, d) { return s + d.total; }, 0) };
  }

  function renderCrossView() {
    var m = crossMatrix(filteredVehicles());
    if (!m.dRows.length) { document.getElementById('ra-view').innerHTML = '<p style="text-align:center;padding:24px;color:var(--secondary);">Aucune donnée importée</p>'; return; }
    var head = '<tr><th>Division \\ CSC</th>' + m.cCols.map(function (c) { return '<th style="text-align:right;">' + esc(c.label) + '</th>'; }).join('') + '<th style="text-align:right;">Total</th></tr>';
    var body = m.dRows.map(function (d) {
      return '<tr><td><strong>' + esc(d.label) + '</strong></td>' + m.cCols.map(function (c) {
        var val = m.cell[d.key + '||' + c.key] || 0;
        var a = m.max > 0 ? (val / m.max) : 0;
        return '<td style="text-align:right;background:rgba(239,108,0,' + (val > 0 ? (0.08 + a * 0.55).toFixed(2) : 0) + ');">' + (val ? fmt(val) : '—') + '</td>';
      }).join('') + '<td style="text-align:right;font-weight:800;">' + fmt(d.total) + '</td></tr>';
    }).join('');
    var foot = '<tr style="background:' + NAVY + ';color:#fff;font-weight:800;"><td>TOTAL</td>' + m.cCols.map(function (c) { return '<td style="text-align:right;">' + fmt(c.total) + '</td>'; }).join('') + '<td style="text-align:right;">' + fmt(m.grand) + '</td></tr>';
    document.getElementById('ra-view').innerHTML =
      '<div style="font-size:12px;color:var(--secondary);margin-bottom:8px;">Dépenses cumulées sur les années sélectionnées. Plus la case est foncée, plus la dépense est élevée.</div>' +
      '<div style="overflow-x:auto;"><table class="data-table"><thead>' + head + '</thead><tbody>' + body + foot + '</tbody></table></div>';
  }

  /* ══════════════════════════════════════════════════════════
   *  CONTRÔLE DE COHÉRENCE ENTRE LES DEUX SOURCES
   * ══════════════════════════════════════════════════════════ */
  function reconciliationHtml() {
    var notes = [];
    DS.years.forEach(function (y) {
      if (!(DS.repSet[y] && DS.cscSet[y])) return;
      var r = DS.vehicles.reduce(function (s, v) { return s + (v.repM[y] || 0); }, 0);
      var c = DS.vehicles.reduce(function (s, v) { return s + (v.cscM[y] || 0); }, 0);
      var diff = r - c;
      if (Math.abs(diff) > Math.max(1, 0.005 * Math.max(r, c)))
        notes.push(y + ' : historique ' + fmtDT(r) + ' vs STAT CSC ' + fmtDT(c) + ' (écart ' + (diff > 0 ? '+' : '') + fmt(diff) + ' DT)');
    });
    var onlyRep = 0, onlyCsc = 0;
    if (DS.repYears.length && DS.cscYears.length) {
      DS.vehicles.forEach(function (v) {
        var hasR = Object.keys(v.repM).length > 0, hasC = !!v.cscLabel || Object.keys(v.cscM).length > 0;
        if (hasR && !hasC) onlyRep++; else if (hasC && !hasR) onlyCsc++;
      });
      if (onlyRep) notes.push(onlyRep + ' véhicule(s) de l\'historique absent(s) du fichier STAT CSC (classés « ' + NONE_LABEL + ' »)');
      if (onlyCsc) notes.push(onlyCsc + ' véhicule(s) de STAT CSC absent(s) de l\'historique dépenses');
    }
    var missingSrc = [];
    if (!DS.repYears.length) missingSrc.push('l\'historique dépenses (division / marque / chauffeur indisponibles)');
    if (!DS.cscYears.length) missingSrc.push('le fichier STAT CSC (CSC repérée uniquement via la sous-division de l\'historique)');
    if (missingSrc.length && DS.vehicles.length) notes.push('Non importé : ' + missingSrc.join(' ; '));
    if (!notes.length) return '';
    return '<div style="background:#FFF3CD;border:1px solid #FDE68A;border-radius:8px;padding:10px 14px;font-size:12px;color:#92400E;margin-bottom:14px;">' +
      '<strong>🔎 Contrôle de cohérence des sources</strong><ul style="margin:6px 0 0 18px;padding:0;">' +
      notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>';
  }

  /* ══════════════════════════════════════════════════════════
   *  COQUE (CONTRÔLES) + RENDU GLOBAL
   * ══════════════════════════════════════════════════════════ */
  var TABS = [
    { id: 'vehicule', label: '🚗 Par véhicule' }, { id: 'division', label: '🏢 Par division' },
    { id: 'csc', label: '🏬 Par CSC' }, { id: 'cross', label: '🔀 Division × CSC' }
  ];

  function ensureRoot() {
    var el = document.getElementById('repair-analyse-root');
    if (el) return el;
    var tab = document.getElementById('tab-repairs');
    if (!tab) return null;
    el = document.createElement('div');
    el.id = 'repair-analyse-root';
    tab.appendChild(el);
    return el;
  }

  function buildShell() {
    var rootEl = ensureRoot();
    if (!rootEl) return false;
    if (document.getElementById('ra-card')) return true;
    rootEl.innerHTML =
      '<div class="card" id="ra-card">' +
      '<div class="card-header"><div><div class="card-title">🔎 Analyse Réparations — Véhicule · Division · CSC</div>' +
      '<div class="card-subtitle">Croise l\'historique dépenses et le fichier STAT CSC · filtres, tris, fiches détail et export Excel</div></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button class="btn btn-primary" data-ra-action="refresh">🔄 Actualiser</button>' +
      '<button class="btn btn-success" data-ra-action="export">⬇️ Exporter l\'analyse (Excel)</button>' +
      '<button class="btn btn-primary" style="background:#1E3A5F;" data-ra-action="export-pptx">📊 Exporter l\'analyse (PowerPoint)</button></div></div>' +
      '<div id="ra-controls"></div><div id="ra-recon"></div><div class="stats-grid" id="ra-kpi" style="margin-bottom:20px;"></div><div id="ra-insights"></div>' +
      '<div id="ra-tabs" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;"></div>' +
      '<div id="ra-view"></div></div>';
    return true;
  }

  function chipStyle(on) {
    return 'cursor:pointer;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:700;border:1px solid ' + (on ? NAVY : '#cbd5e1') +
      ';background:' + (on ? NAVY : '#fff') + ';color:' + (on ? '#fff' : '#334155') + ';';
  }

  function renderControls() {
    var el = document.getElementById('ra-controls');
    if (!el) return;
    var vehs = DS.vehicles;
    var divOpts = {}, cscOpts = {};
    vehs.forEach(function (v) { divOpts[normKey(v.divLabel)] = v.divLabel; cscOpts[normKey(v.cscGroup)] = v.cscGroup; });
    function opts(map, cur, all) {
      return '<option value="">' + all + '</option>' + Object.keys(map).sort(function (a, b) { return map[a].localeCompare(map[b], 'fr'); })
        .map(function (k) { return '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(map[k]) + '</option>'; }).join('');
    }
    el.innerHTML =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">' +
      '<span style="font-size:13px;font-weight:700;color:#1e293b;margin-right:4px;">Années :</span>' +
      (DS.years.length ? DS.years.map(function (y) { return '<button type="button" data-ra-year="' + y + '" style="' + chipStyle(state.years[y]) + '">' + y + '</button>'; }).join('')
        : '<span style="font-size:13px;color:var(--secondary);">Aucune donnée importée — utilisez les boutons d\'import ci-dessus.</span>') +
      (DS.years.length ? '<button type="button" data-ra-action="all-years" style="' + chipStyle(false) + 'border-style:dashed;">Toutes</button>' : '') +
      '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px;">' +
      '<select class="form-select" id="ra-division" style="max-width:240px;">' + opts(divOpts, state.division, 'Toutes les divisions') + '</select>' +
      '<select class="form-select" id="ra-csc" style="max-width:240px;">' + opts(cscOpts, state.csc, 'Toutes les CSC') + '</select>' +
      '<input type="search" class="form-input" id="ra-search" placeholder="🔍 Matricule, chauffeur, marque…" value="' + esc(state.search) + '" style="max-width:280px;">' +
      '<button type="button" class="btn" data-ra-action="reset-filters" style="background:#e2e8f0;color:#1e293b;">✕ Réinitialiser</button></div>';
  }

  function renderTabs() {
    var el = document.getElementById('ra-tabs');
    if (!el) return;
    el.innerHTML = TABS.map(function (t) {
      return '<button type="button" data-ra-tab="' + t.id + '" style="' + chipStyle(state.view === t.id).replace('999px', '8px') + '">' + t.label + '</button>';
    }).join('');
  }

  function renderBody() {
    renderKpi();
    renderInsights();
    if (!DS.vehicles.length) {
      document.getElementById('ra-view').innerHTML = '<p style="text-align:center;padding:30px;color:var(--secondary);">Importez d\'abord le fichier « historique dépenses » et/ou « STAT CSC » pour activer l\'analyse.</p>';
      return;
    }
    if (!selYears().length) {
      document.getElementById('ra-view').innerHTML = '<p style="text-align:center;padding:30px;color:var(--secondary);">Sélectionnez au moins une année.</p>';
      return;
    }
    if (state.view === 'vehicule') renderVehicleView();
    else if (state.view === 'division') renderGroupView('division');
    else if (state.view === 'csc') renderGroupView('csc');
    else renderCrossView();
  }

  function syncYears() {
    var next = {};
    DS.years.forEach(function (y) { next[y] = state.yearsInit ? (y in state.years ? state.years[y] : true) : true; });
    state.years = next; state.yearsInit = true;
    if (state.division && !DS.vehicles.some(function (v) { return normKey(v.divLabel) === state.division; })) state.division = '';
    if (state.csc && !DS.vehicles.some(function (v) { return normKey(v.cscGroup) === state.csc; })) state.csc = '';
  }

  function refresh() {
    if (!buildShell()) return;
    DS = buildDataset();
    syncYears();
    renderControls();
    document.getElementById('ra-recon').innerHTML = reconciliationHtml();
    renderTabs();
    renderBody();
  }

  /* ══════════════════════════════════════════════════════════
   *  EXPORT EXCEL (ExcelJS) — aux couleurs TT
   * ══════════════════════════════════════════════════════════ */
  var X = { navy: 'FF1E3A5F', orange: 'FFEF6C00', white: 'FFFFFFFF', band: 'FFF1F5F9', grp: 'FFDCE6F2', border: 'FFE0E0E0' };
  var FMT_MONEY = '#,##0.00', FMT_PCT = '0.0%', FMT_VAR = '+0.0%;-0.0%;0.0%';

  function addSheet(wb, name, title, headers, rows, o) {
    o = o || {};
    var ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 2, xSplit: o.freezeCols || 0 }] });
    var n = headers.length;
    ws.mergeCells(1, 1, 1, n);
    var t = ws.getCell(1, 1);
    t.value = title; t.font = { bold: true, color: { argb: X.white }, size: 13 };
    t.alignment = { horizontal: 'center', vertical: 'middle' };
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.navy } };
    ws.getRow(1).height = 28;
    var hr = ws.getRow(2);
    headers.forEach(function (h, i) {
      var c = hr.getCell(i + 1);
      c.value = h; c.font = { bold: true, color: { argb: X.white }, size: 10 };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.orange } };
      c.border = { top: { style: 'thin', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }, left: { style: 'thin', color: { argb: 'FFCCCCCC' } }, right: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
    });
    hr.height = 30;
    var idx = 0;
    rows.forEach(function (item) {
      var kind = Array.isArray(item) ? 'item' : (item.kind || 'item');
      var cells = Array.isArray(item) ? item : item.cells;
      var r = ws.getRow(3 + idx);
      cells.forEach(function (val, ci) {
        var c = r.getCell(ci + 1);
        c.value = (val === null || val === undefined) ? '' : val;
        c.font = { size: 9, bold: kind !== 'item', color: { argb: kind === 'total' ? X.white : 'FF1E293B' } };
        c.alignment = { horizontal: (typeof val === 'number') ? 'right' : 'left', vertical: 'middle' };
        c.border = { top: { style: 'thin', color: { argb: X.border } }, bottom: { style: 'thin', color: { argb: X.border } }, left: { style: 'thin', color: { argb: X.border } }, right: { style: 'thin', color: { argb: X.border } } };
        var bg = kind === 'total' ? X.navy : (kind === 'group' ? X.grp : (kind === 'sub' ? X.band : ((idx % 2) ? X.band : X.white)));
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        if (typeof val === 'number' && o.numFmts && o.numFmts[ci]) c.numFmt = o.numFmts[ci];
      });
      idx++;
    });
    (o.widths || []).forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    if (rows.length) ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2 + rows.filter(function (x) { return Array.isArray(x) || (x.kind || 'item') === 'item'; }).length, column: n } };
    return ws;
  }

  function buildWorkbook(ExcelLib) {
    var ys = DS.years, sel = selYears();
    var vehs = filteredVehicles();
    var wb = new ExcelLib.Workbook();
    wb.creator = 'DRT Sfax — Parc Auto';
    var today = new Date().toLocaleDateString('fr-FR');
    var periode = sel.length ? (sel.length === 1 ? sel[0] : sel[0] + '–' + sel[sel.length - 1]) : '';
    var filtres = [];
    if (state.division) filtres.push('Division : ' + (DS.vehicles.filter(function (v) { return normKey(v.divLabel) === state.division; })[0] || {}).divLabel);
    if (state.csc) filtres.push('CSC : ' + (DS.vehicles.filter(function (v) { return normKey(v.cscGroup) === state.csc; })[0] || {}).cscGroup);
    if (state.search) filtres.push('Recherche : « ' + state.search + ' »');
    var suffix = ' — ' + periode + ' — ' + today + ' — DRT SFAX';
    var yNum = ys.map(function () { return FMT_MONEY; });

    // ---- Synthèse ----
    var vr = vehicleRows(vehs, amtVeh);
    var gDiv = groupBy(vehs, function (v) { return v.divLabel; }, amtVeh);
    var gCsc = groupBy(vehs, function (v) { return v.cscGroup; }, amtCsc);
    var synth = [
      ['Période analysée', periode + ' (' + sel.length + ' année(s) : ' + sel.join(', ') + ')', ''],
      ['Filtres appliqués', filtres.length ? filtres.join(' · ') : 'Aucun', ''],
      ['Dépense totale (DT)', Math.round(vr.grand * 100) / 100, ''],
      ['Nombre de véhicules', vehs.length, ''],
      ['Véhicules avec dépense', vr.rows.filter(function (r) { return r.total > 0; }).length, '']
    ];
    var perYearTotal = {};
    ys.forEach(function (y) { perYearTotal[y] = vehs.reduce(function (s, v) { return s + amtVeh(v, y); }, 0); });
    synth.push({ kind: 'group', cells: ['Total par année', 'Montant (DT)', 'Variation / année précédente'] });
    ys.forEach(function (y, i) {
      var prev = i > 0 ? perYearTotal[ys[i - 1]] : 0;
      synth.push([y + (state.years[y] ? '' : ' (hors période)'), Math.round(perYearTotal[y] * 100) / 100, (i > 0 && prev > 0) ? (perYearTotal[y] - prev) / prev : '']);
    });
    var ws0 = addSheet(wb, 'Synthèse', 'SYNTHÈSE ANALYSE RÉPARATIONS' + suffix, ['Indicateur', 'Valeur', 'Variation'], synth,
      { widths: [34, 46, 28], numFmts: [null, FMT_MONEY, FMT_VAR] });
    ws0.getCell('B6').numFmt = '0'; ws0.getCell('B7').numFmt = '0';

    // ---- Par véhicule ----
    var vrows = sortVehRows(vr.rows, { key: 'total', dir: -1 });
    var cum = 0, fleetAvg = fleetAvgActive();
    var vHeaders = ['#', 'Matricule', 'Chauffeur', 'Marque', 'Division', 'CSC'].concat(ys, ['Total période (DT)', 'Moyenne / an (DT)', 'Variation', '% budget', 'Cumul %', 'Statut']);
    var vNum = [null, null, null, null, null, null].concat(yNum, [FMT_MONEY, FMT_MONEY, FMT_VAR, FMT_PCT, FMT_PCT, null]);
    var vOut = vrows.map(function (r, i) {
      cum += r.pct;
      return [i + 1, r.v.matricule, r.v.chauffeur, r.v.marque, r.v.divLabel, r.v.cscGroup]
        .concat(ys.map(function (y) { return Math.round((r.perYear[y] || 0) * 100) / 100; }),
          [Math.round(r.total * 100) / 100, Math.round(r.avgYear * 100) / 100, r.var === null ? '' : r.var, r.pct, Math.min(cum, 1),
            vehicleStatus(r, fleetAvg).map(function (b) { return b.t.replace(/^[^\wÀ-ÿ]+/, ''); }).join(' / ')]);
    });
    vOut.push({ kind: 'total', cells: ['', 'TOTAL', vrows.length + ' véhicules', '', '', ''].concat(ys.map(function (y) { return Math.round(vrows.reduce(function (s, r) { return s + (r.perYear[y] || 0); }, 0) * 100) / 100; }), [Math.round(vr.grand * 100) / 100, '', '', 1, '', '']) });
    addSheet(wb, 'Par véhicule', 'DÉPENSES RÉPARATIONS PAR VÉHICULE' + suffix, vHeaders, vOut,
      { widths: [5, 14, 24, 18, 26, 20].concat(ys.map(function () { return 12; }), [16, 15, 11, 10, 10, 22]), numFmts: vNum, freezeCols: 2 });

    // ---- Par division / par CSC ----
    function groupSheet(name, title, label, gr, amtFn, kind) {
      var list = sortList(gr.list, { key: 'total', dir: -1 }, GRP_GETTERS);
      var h = [label, 'Nb véhicules', 'Véhicules actifs'].concat(ys, ['Total période (DT)', 'Moyenne / véhicule (DT)', 'Variation', '% budget']);
      var nf = [null, '0', '0'].concat(yNum, [FMT_MONEY, FMT_MONEY, FMT_VAR, FMT_PCT]);
      var rows = list.map(function (g) {
        return [g.label, g.nbVeh, g.nbActifs].concat(ys.map(function (y) { return Math.round((g.perYear[y] || 0) * 100) / 100; }),
          [Math.round(g.total * 100) / 100, Math.round(g.avg * 100) / 100, g.var === null ? '' : g.var, g.pct]);
      });
      rows.push({ kind: 'total', cells: ['TOTAL', list.reduce(function (s, g) { return s + g.nbVeh; }, 0), list.reduce(function (s, g) { return s + g.nbActifs; }, 0)]
        .concat(ys.map(function (y) { return Math.round(list.reduce(function (s, g) { return s + (g.perYear[y] || 0); }, 0) * 100) / 100; }), [Math.round(gr.grand * 100) / 100, '', '', 1]) });
      addSheet(wb, name, title + suffix, h, rows, { widths: [32, 12, 12].concat(ys.map(function () { return 13; }), [17, 17, 11, 10]), numFmts: nf, freezeCols: 1 });

      // Détail : véhicules regroupés avec sous-total
      var dh = [label, 'Matricule', 'Chauffeur', 'Marque', kind === 'division' ? 'CSC' : 'Division'].concat(ys, ['Total période (DT)', 'Variation', '% du groupe']);
      var dn = [null, null, null, null, null].concat(yNum, [FMT_MONEY, FMT_VAR, FMT_PCT]);
      var drows = [];
      list.forEach(function (g) {
        var gv = vehicleRows(g.vehs, amtFn, g.total);
        drows.push({ kind: 'group', cells: [g.label, g.nbVeh + ' véhicule(s)', '', '', ''].concat(ys.map(function (y) { return Math.round((g.perYear[y] || 0) * 100) / 100; }), [Math.round(g.total * 100) / 100, g.var === null ? '' : g.var, g.pct]) });
        gv.rows.sort(function (a, b) { return b.total - a.total; }).forEach(function (r) {
          drows.push(['', r.v.matricule, r.v.chauffeur, r.v.marque, kind === 'division' ? r.v.cscGroup : r.v.divLabel]
            .concat(ys.map(function (y) { return Math.round((r.perYear[y] || 0) * 100) / 100; }), [Math.round(r.total * 100) / 100, r.var === null ? '' : r.var, r.pct]));
        });
      });
      addSheet(wb, 'Détail ' + name.replace('Par ', ''), 'DÉTAIL DES VÉHICULES PAR ' + label.toUpperCase() + suffix, dh, drows,
        { widths: [32, 14, 24, 18, 24].concat(ys.map(function () { return 12; }), [16, 11, 11]), numFmts: dn });
    }
    groupSheet('Par division', 'DÉPENSES RÉPARATIONS PAR DIVISION', 'Division', gDiv, amtVeh, 'division');
    groupSheet('Par CSC', 'DÉPENSES RÉPARATIONS PAR CSC', 'CSC', gCsc, amtCsc, 'csc');

    // ---- Division × CSC ----
    var m = crossMatrix(vehs);
    var mh = ['Division \\ CSC'].concat(m.cCols.map(function (c) { return c.label; }), ['Total (DT)']);
    var mrows = m.dRows.map(function (d) {
      return [d.label].concat(m.cCols.map(function (c) { return Math.round((m.cell[d.key + '||' + c.key] || 0) * 100) / 100; }), [Math.round(d.total * 100) / 100]);
    });
    mrows.push({ kind: 'total', cells: ['TOTAL'].concat(m.cCols.map(function (c) { return Math.round(c.total * 100) / 100; }), [Math.round(m.grand * 100) / 100]) });
    var wsm = addSheet(wb, 'Division x CSC', 'DÉPENSES DIVISION × CSC' + suffix, mh, mrows,
      { widths: [32].concat(m.cCols.map(function () { return 16; }), [16]), numFmts: [null].concat(m.cCols.map(function () { return FMT_MONEY; }), [FMT_MONEY]), freezeCols: 1 });
    // carte de chaleur
    m.dRows.forEach(function (d, ri) {
      m.cCols.forEach(function (c, ci) {
        var val = m.cell[d.key + '||' + c.key] || 0;
        if (val > 0 && m.max > 0) {
          var a = 0.12 + 0.7 * (val / m.max);
          var mix = function (base, tgt) { return Math.round(base + (tgt - base) * a); };
          var hex = function (n) { return ('0' + n.toString(16)).slice(-2).toUpperCase(); };
          wsm.getCell(3 + ri, 2 + ci).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex(mix(255, 239)) + hex(mix(255, 108)) + hex(mix(255, 0)) } };
        }
      });
    });
    return wb;
  }

  function exportExcel() {
    if (typeof ExcelJS === 'undefined') { alert('Librairie ExcelJS non disponible — vérifiez votre connexion.'); return; }
    if (!DS || !DS.vehicles.length) { alert('Aucune donnée à exporter. Importez d\'abord l\'historique dépenses et/ou STAT CSC.'); return; }
    if (!selYears().length) { alert('Sélectionnez au moins une année.'); return; }
    var wb = buildWorkbook(ExcelJS);
    var sel = selYears();
    var name = 'analyse_reparations_' + sel[0] + (sel.length > 1 ? '-' + sel[sel.length - 1] : '') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    wb.xlsx.writeBuffer().then(function (buf) {
      var blob = new Blob([buf], { type: 'application/octet-stream' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }).catch(function (err) { console.error(err); alert('Erreur lors de la génération : ' + err.message); });
  }


  /* ══════════════════════════════════════════════════════════
   *  CONSTATS AUTOMATIQUES (affichés à l'écran + dans le PowerPoint)
   * ══════════════════════════════════════════════════════════ */
  function computeInsights(vehs) {
    var out = [], ys = selYears();
    if (!vehs.length || !ys.length) return out;
    var vr = vehicleRows(vehs, amtVeh);
    if (vr.grand <= 0) return out;
    var gd = groupBy(vehs, function (v) { return v.divLabel; }, amtVeh).list;
    var gc = groupBy(vehs, function (v) { return v.cscGroup; }, amtCsc).list;
    var realD = gd.filter(function (g) { return g.label !== NONE_LABEL; }).sort(function (a, b) { return b.total - a.total; });
    var realC = gc.filter(function (g) { return g.label !== NONE_LABEL; }).sort(function (a, b) { return b.total - a.total; });

    var perYearTotal = {};
    DS.years.forEach(function (y) { perYearTotal[y] = vehs.reduce(function (s, v) { return s + amtVeh(v, y); }, 0); });
    var fv = variation(perYearTotal);
    if (fv !== null) {
      var a = ys[ys.length - 2], b = ys[ys.length - 1];
      out.push({ icon: fv > 0 ? '📈' : '📉', tone: fv > 0 ? 'warn' : 'ok',
        text: 'Les dépenses ' + (fv > 0 ? 'augmentent' : 'diminuent') + ' de ' + pct(Math.abs(fv)) + ' entre ' + a + ' (' + fmtDT(perYearTotal[a]) + ') et ' + b + ' (' + fmtDT(perYearTotal[b]) + ').' });
    }
    if (realD.length) out.push({ icon: '🏢', tone: 'info', text: 'La division « ' + realD[0].label + ' » concentre ' + pct(realD[0].pct, 0) + ' des dépenses (' + fmtDT(realD[0].total) + ') pour ' + realD[0].nbVeh + ' véhicule(s).' });
    if (realC.length) out.push({ icon: '🏬', tone: 'info', text: 'La CSC « ' + realC[0].label + ' » pèse ' + pct(realC[0].pct, 0) + ' du budget (' + fmtDT(realC[0].total) + ').' });

    // Concentration (Pareto)
    var sorted = vr.rows.filter(function (r) { return r.total > 0; }).sort(function (a, b) { return b.total - a.total; });
    var acc = 0, n80 = 0;
    for (var i = 0; i < sorted.length; i++) { acc += sorted[i].total; n80 = i + 1; if (acc >= 0.8 * vr.grand) break; }
    if (sorted.length >= 5) {
      var top5 = sorted.slice(0, 5).reduce(function (s, r) { return s + r.total; }, 0);
      out.push({ icon: '🎯', tone: 'warn', text: n80 + ' véhicule(s) sur ' + sorted.length + ' (' + pct(n80 / sorted.length, 0) + ') génèrent 80 % de la dépense ; les 5 plus coûteux représentent ' + pct(top5 / vr.grand, 0) + '.' });
    }
    // Plus forte hausse par division (base significative)
    var risers = realD.filter(function (g) { return g.var !== null && g.total >= 0.05 * vr.grand; }).sort(function (a, b) { return b.var - a.var; });
    if (risers.length && risers[0].var > 0.15) out.push({ icon: '🔺', tone: 'warn', text: 'Plus forte hausse : division « ' + risers[0].label + ' » (' + (risers[0].var > 0 ? '+' : '') + pct(risers[0].var, 0) + ' sur la dernière année).' });
    // Alertes
    var fleetAvg = fleetAvgActive();
    var high = vr.rows.filter(function (r) { return fleetAvg > 0 && r.total > 2 * fleetAvg; }).length;
    var rising = vr.rows.filter(function (r) { return r.var !== null && r.var >= 0.5 && r.total > 0; }).length;
    if (high || rising) out.push({ icon: '⚠️', tone: 'warn', text: high + ' véhicule(s) dépassent 2× la moyenne du parc (' + fmtDT(fleetAvg) + ') et ' + rising + ' sont en hausse de 50 % ou plus.' });
    // Qualité des données
    var noDiv = vehs.filter(function (v) { return v.divLabel === NONE_LABEL; }).length;
    var noCsc = vehs.filter(function (v) { return v.cscGroup === NONE_LABEL; }).length;
    if (noDiv || noCsc) out.push({ icon: '🧹', tone: 'info', text: 'Qualité des données : ' + noDiv + ' véhicule(s) sans division et ' + noCsc + ' sans CSC — à compléter pour fiabiliser les regroupements.' });
    return out;
  }

  function renderInsights() {
    var el = document.getElementById('ra-insights');
    if (!el) return;
    if (!DS.vehicles.length || !selYears().length) { el.innerHTML = ''; return; }
    var list = computeInsights(filteredVehicles());
    if (!list.length) { el.innerHTML = ''; return; }
    var bg = { warn: '#FFF7ED', ok: '#ECFDF5', info: '#EFF6FF' }, bd = { warn: '#FED7AA', ok: '#A7F3D0', info: '#BFDBFE' };
    el.innerHTML = '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin-bottom:18px;background:#fff;">' +
      '<div style="font-weight:800;color:' + NAVY + ';margin-bottom:8px;">💡 Constats clés (calculés automatiquement)</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:8px;">' +
      list.map(function (c) {
        return '<div style="font-size:13px;line-height:1.45;padding:8px 10px;border-radius:8px;background:' + bg[c.tone] + ';border:1px solid ' + bd[c.tone] + ';">' + c.icon + ' ' + esc(c.text) + '</div>';
      }).join('') + '</div></div>';
  }

  /* ══════════════════════════════════════════════════════════
   *  EXPORT POWERPOINT (PptxGenJS) — mêmes filtres / années que l'écran
   * ══════════════════════════════════════════════════════════ */
  var PP = { navy: '1E3A5F', midnight: '0F172A', ink: '1E293B', slate: '64748B', mist: 'E2E8F0', paper: 'FFFFFF', bg: 'F8FAFC', orange: 'EF6C00', green: '10B981', red: 'EF4444' };
  var PPTX_URLS = [
    'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
    'https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
    'https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'
  ];
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = src; sc.onload = resolve; sc.onerror = function () { reject(new Error('Chargement impossible : ' + src)); };
      document.head.appendChild(sc);
    });
  }
  function loadPptx() {
    if (root.PptxGenJS) return Promise.resolve(root.PptxGenJS);
    if (root.__pptxgenjsLoading) return root.__pptxgenjsLoading;
    root.__pptxgenjsLoading = (async function () {
      for (var i = 0; i < PPTX_URLS.length; i++) {
        try { await loadScript(PPTX_URLS[i]); if (root.PptxGenJS) return root.PptxGenJS; } catch (e) {}
      }
      root.__pptxgenjsLoading = null;
      throw new Error('Impossible de charger PptxGenJS (tous les miroirs ont échoué). Vérifiez la connexion internet.');
    })();
    return root.__pptxgenjsLoading;
  }

  function heatHex(a) { // blanc → orange
    function h(n) { return ('0' + Math.round(n).toString(16)).slice(-2).toUpperCase(); }
    return h(255 + (239 - 255) * a) + h(255 + (108 - 255) * a) + h(255 + (0 - 255) * a);
  }

  function buildPptx(Ctor) {
    var pres = new Ctor();
    pres.layout = 'LAYOUT_WIDE';
    pres.author = 'Parc Auto DRT Sfax';
    var ys = selYears(), vehs = filteredVehicles();
    var periode = ys.length === 1 ? ys[0] : ys[0] + '–' + ys[ys.length - 1];
    pres.title = 'Analyse Réparations ' + periode + ' — DRT Sfax';
    var today = new Date().toLocaleDateString('fr-FR');
    var filtres = [];
    if (state.division) filtres.push('Division : ' + (vehs[0] ? vehs[0].divLabel : ''));
    if (state.csc) filtres.push('CSC : ' + (vehs[0] ? vehs[0].cscGroup : ''));
    if (state.search) filtres.push('Recherche : « ' + state.search + ' »');

    var vr = vehicleRows(vehs, amtVeh);
    var gDiv = groupBy(vehs, function (v) { return v.divLabel; }, amtVeh);
    var gCsc = groupBy(vehs, function (v) { return v.cscGroup; }, amtCsc);
    var divList = gDiv.list.slice().sort(function (a, b) { return b.total - a.total; });
    var cscList = gCsc.list.slice().sort(function (a, b) { return b.total - a.total; });
    var actifs = vr.rows.filter(function (r) { return r.total > 0; });
    var perYearTotal = {};
    ys.forEach(function (y) { perYearTotal[y] = vehs.reduce(function (s, v) { return s + amtVeh(v, y); }, 0); });
    var page = 0;

    function frame(title, subtitle) {
      var sl = pres.addSlide();
      page++;
      sl.background = { color: PP.bg };
      sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 1.05, fill: { color: PP.navy }, line: { type: 'none' } });
      sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 1.05, w: 13.33, h: 0.06, fill: { color: PP.orange }, line: { type: 'none' } });
      sl.addText(title, { x: 0.6, y: 0.12, w: 12, h: 0.55, fontSize: 24, bold: true, color: PP.paper, fontFace: 'Cambria' });
      if (subtitle) sl.addText(subtitle, { x: 0.6, y: 0.62, w: 12, h: 0.35, fontSize: 12, color: 'CBD5E1', fontFace: 'Calibri' });
      sl.addText('DRT Sfax — Parc Auto · Analyse réparations ' + periode, { x: 0.6, y: 7.1, w: 8, h: 0.3, fontSize: 9, color: PP.slate, fontFace: 'Calibri' });
      sl.addText(String(page + 1), { x: 12.2, y: 7.1, w: 0.6, h: 0.3, fontSize: 9, color: PP.slate, align: 'right', fontFace: 'Calibri' });
      return sl;
    }
    function hdr(txt, right) { return { text: txt, options: { bold: true, color: PP.paper, fill: { color: PP.navy }, align: right ? 'right' : 'left', fontSize: 11 } }; }
    function cell(txt, o) { o = o || {}; return { text: String(txt), options: { fontSize: o.fs || 10.5, bold: !!o.bold, color: o.color || PP.ink, align: o.right ? 'right' : 'left', fill: { color: o.fill || PP.paper } } }; }
    function varTxt(v) { return v === null ? '—' : (v > 0 ? '▲ +' : (v < 0 ? '▼ ' : '■ ')) + pct(v); }
    function varColor(v) { return v === null ? PP.slate : (v > 0.0005 ? 'B91C1C' : (v < -0.0005 ? '047857' : PP.slate)); }

    /* 1 — Couverture */
    var s = pres.addSlide();
    s.background = { color: PP.midnight };
    s.addShape(pres.shapes.OVAL, { x: 9.6, y: -2.2, w: 6, h: 6, fill: { color: PP.navy }, line: { type: 'none' } });
    s.addShape(pres.shapes.OVAL, { x: 10.6, y: 4.6, w: 4.2, h: 4.2, fill: { color: PP.orange, transparency: 84 }, line: { type: 'none' } });
    s.addText('RÉPARATIONS & MAINTENANCE — DRT SFAX', { x: 0.7, y: 1.5, w: 10, h: 0.5, fontSize: 14, color: PP.orange, bold: true, charSpacing: 3, fontFace: 'Calibri' });
    s.addText('Analyse des dépenses de réparation', { x: 0.65, y: 2.05, w: 12, h: 1.1, fontSize: 42, color: PP.paper, bold: true, fontFace: 'Cambria' });
    s.addText('Par véhicule · par division · par CSC', { x: 0.7, y: 3.2, w: 10, h: 0.5, fontSize: 20, color: 'CBD5E1', fontFace: 'Calibri' });
    s.addText('Période ' + periode + ' · édité le ' + today + (filtres.length ? ' · ' + filtres.join(' · ') : ''), { x: 0.7, y: 3.75, w: 11, h: 0.4, fontSize: 13, color: '94A3B8', fontFace: 'Calibri' });
    s.addShape(pres.shapes.LINE, { x: 0.7, y: 4.4, w: 3.2, h: 0, line: { color: PP.orange, width: 2 } });
    [[fmt(vr.grand / 1000) + ' kDT', 'dépense totale'], [actifs.length + ' / ' + vehs.length, 'véhicules avec dépense'], [fmtDT(actifs.length ? vr.grand / actifs.length : 0), 'moyenne / véhicule actif']].forEach(function (c, i) {
      s.addText(c[0], { x: 0.7 + i * 3.6, y: 4.75, w: 3.4, h: 0.6, fontSize: 26, bold: true, color: PP.paper, fontFace: 'Cambria' });
      s.addText(c[1], { x: 0.7 + i * 3.6, y: 5.35, w: 3.4, h: 0.35, fontSize: 12, color: '94A3B8', fontFace: 'Calibri' });
    });

    /* 2 — Constats clés */
    var ins = computeInsights(vehs);
    s = frame('Constats clés', 'Lecture rapide de la période ' + periode);
    var tones = { warn: ['FFF7ED', 'FDBA74'], ok: ['ECFDF5', '6EE7B7'], info: ['EFF6FF', '93C5FD'] };
    ins.slice(0, 7).forEach(function (c, i) {
      var col = i % 2, row = Math.floor(i / 2), t = tones[c.tone] || tones.info;
      s.addShape(pres.shapes.RECTANGLE, { x: 0.6 + col * 6.2, y: 1.45 + row * 1.35, w: 6.0, h: 1.2, fill: { color: t[0] }, line: { color: t[1], width: 1 } });
      s.addText(c.icon + '  ' + c.text, { x: 0.75 + col * 6.2, y: 1.5 + row * 1.35, w: 5.7, h: 1.1, fontSize: 13, color: PP.ink, valign: 'middle', fontFace: 'Calibri' });
    });
    if (!ins.length) s.addText('Pas assez de données pour produire des constats.', { x: 0.6, y: 2, w: 12, h: 0.5, fontSize: 14, color: PP.slate });

    /* 3 — Évolution annuelle */
    var allYTotals = DS.years.map(function (y) { return Math.round(vehs.reduce(function (t, v) { return t + amtVeh(v, y); }, 0)); });
    s = frame('Évolution annuelle des dépenses', 'Total des réparations par année (DT) — toutes années disponibles');
    s.addChart(pres.charts.BAR, [{ name: 'Dépense (DT)', labels: DS.years, values: allYTotals }], {
      x: 0.6, y: 1.4, w: 8.2, h: 5.5, barDir: 'col', chartColors: [PP.navy], showValue: true, dataLabelFormatCode: '#,##0',
      dataLabelFontSize: 11, catAxisLabelFontSize: 12, valAxisLabelFontSize: 10, valAxisLabelFormatCode: '#,##0', valGridLine: { color: 'E2E8F0', size: 0.5 }, showLegend: false
    });
    var yrows = [[hdr('Année'), hdr('Total (DT)', true), hdr('Variation', true)]];
    DS.years.forEach(function (y, i) {
      var prev = i > 0 ? allYTotals[i - 1] : 0, cur = allYTotals[i], vv = (i > 0 && prev > 0) ? (cur - prev) / prev : null;
      yrows.push([cell(y + (state.years[y] ? '' : ' *'), { bold: true }), cell(fmt(cur), { right: true }), cell(varTxt(vv), { right: true, color: varColor(vv), bold: true })]);
    });
    s.addTable(yrows, { x: 9.1, y: 1.5, w: 3.7, colW: [1.1, 1.4, 1.2], rowH: 0.36, border: { type: 'solid', color: PP.mist, pt: 0.5 } });
    s.addText('* année hors période sélectionnée', { x: 9.1, y: 1.6 + 0.36 * (DS.years.length + 1), w: 3.7, h: 0.3, fontSize: 9, color: PP.slate, italic: true });

    /* 4 et 5 — Division / CSC */
    function groupSlide(titre, label, list, grand, icon) {
      var sl = frame(icon + ' ' + titre, 'Période ' + periode + ' · total ' + fmtDT(grand));
      var top = list.slice(0, 8);
      sl.addChart(pres.charts.BAR, [{ name: 'Dépense (DT)', labels: top.map(function (g) { return g.label; }).reverse(), values: top.map(function (g) { return Math.round(g.total); }).reverse() }], {
        x: 0.5, y: 1.35, w: 5.6, h: 5.6, barDir: 'bar', chartColors: [PP.orange], showValue: true, dataLabelFormatCode: '#,##0', dataLabelFontSize: 10,
        catAxisLabelFontSize: 10, valAxisHidden: true, valGridLine: { style: 'none' }, showLegend: false
      });
      var rows = [[hdr(label), hdr('Véh.', true), hdr('Total (DT)', true), hdr('Moy./véh.', true), hdr('Var.', true), hdr('%', true)]];
      list.slice(0, 11).forEach(function (g, i) {
        var f = i % 2 ? 'F1F5F9' : PP.paper;
        rows.push([cell(g.label, { bold: true, fill: f }), cell(g.nbVeh, { right: true, fill: f }), cell(fmt(g.total), { right: true, fill: f, bold: true }),
          cell(fmt(g.avg), { right: true, fill: f }), cell(varTxt(g.var), { right: true, fill: f, color: varColor(g.var), bold: true, fs: 9.5 }), cell(pct(g.pct, 0), { right: true, fill: f })]);
      });
      sl.addTable(rows, { x: 6.3, y: 1.45, w: 6.6, colW: [2.2, 0.55, 1.1, 1.0, 1.1, 0.65], rowH: 0.4, border: { type: 'solid', color: PP.mist, pt: 0.5 } });
      if (list.length > 11) sl.addText('+ ' + (list.length - 11) + ' autre(s) non affiché(s)', { x: 6.3, y: 1.55 + 0.4 * 12, w: 6, h: 0.3, fontSize: 9, color: PP.slate, italic: true });
    }
    groupSlide('Dépenses par division', 'Division', divList, gDiv.grand, '🏢');
    groupSlide('Dépenses par CSC', 'CSC', cscList, gCsc.grand, '🏬');

    /* 6 — Matrice Division × CSC */
    var m = crossMatrix(vehs);
    s = frame('Division × CSC', 'Dépenses cumulées sur la période (DT) — plus la case est orange, plus la dépense est élevée');
    var cols = m.cCols.slice(0, 6), dRows = m.dRows.slice(0, 10);
    var mrows = [[hdr('Division \\ CSC')].concat(cols.map(function (c) { return hdr(c.label, true); }), [hdr('Total', true)])];
    dRows.forEach(function (d) {
      mrows.push([cell(d.label, { bold: true })].concat(cols.map(function (c) {
        var val = m.cell[d.key + '||' + c.key] || 0, a = m.max > 0 ? 0.08 + 0.62 * (val / m.max) : 0;
        return cell(val ? fmt(val) : '—', { right: true, fill: val ? heatHex(a) : PP.paper });
      }), [cell(fmt(d.total), { right: true, bold: true, fill: 'E2E8F0' })]));
    });
    mrows.push([cell('TOTAL', { bold: true, fill: 'E2E8F0' })].concat(cols.map(function (c) { return cell(fmt(c.total), { right: true, bold: true, fill: 'E2E8F0' }); }), [cell(fmt(m.grand), { right: true, bold: true, fill: 'CBD5E1' })]));
    var cw = [2.8].concat(cols.map(function () { return (12.1 - 2.8 - 1.4) / Math.max(cols.length, 1); }), [1.4]);
    s.addTable(mrows, { x: 0.6, y: 1.5, w: 12.1, colW: cw, rowH: 0.42, border: { type: 'solid', color: PP.mist, pt: 0.5 } });
    if (m.cCols.length > 6 || m.dRows.length > 10) s.addText('Affichage limité aux 6 CSC et 10 divisions les plus coûteuses — le détail complet est dans l\'export Excel.', { x: 0.6, y: 6.7, w: 12, h: 0.3, fontSize: 9, color: PP.slate, italic: true });

    /* 7 — Top 10 véhicules */
    var top = vr.rows.slice().sort(function (a, b) { return b.total - a.total; }).slice(0, 10);
    s = frame('Top 10 des véhicules les plus coûteux', 'Période ' + periode + ' · ' + pct(top.reduce(function (t, r) { return t + r.total; }, 0) / (vr.grand || 1), 0) + ' du budget pour 10 véhicules');
    var trows = [[hdr('#'), hdr('Matricule'), hdr('Chauffeur'), hdr('Marque'), hdr('Division'), hdr('CSC'), hdr('Total (DT)', true), hdr('Var.', true), hdr('%', true)]];
    top.forEach(function (r, i) {
      var f = i < 3 ? 'FFF7ED' : (i % 2 ? 'F1F5F9' : PP.paper);
      trows.push([cell(i + 1, { bold: true, fill: f }), cell(r.v.matricule, { bold: true, fill: f }), cell(r.v.chauffeur || '—', { fill: f, fs: 9.5 }), cell(r.v.marque || '—', { fill: f, fs: 9.5 }),
        cell(r.v.divLabel, { fill: f, fs: 9.5 }), cell(r.v.cscGroup, { fill: f, fs: 9.5 }), cell(fmt(r.total), { right: true, bold: true, fill: f }),
        cell(varTxt(r.var), { right: true, fill: f, color: varColor(r.var), bold: true, fs: 9.5 }), cell(pct(r.pct, 1), { right: true, fill: f })]);
    });
    s.addTable(trows, { x: 0.5, y: 1.4, w: 12.3, colW: [0.4, 1.3, 2.2, 1.4, 2.2, 1.7, 1.2, 1.2, 0.7], rowH: 0.46, border: { type: 'solid', color: PP.mist, pt: 0.5 } });

    /* 8 — Véhicules en alerte */
    var fleetAvg = fleetAvgActive();
    var alerts = vr.rows.map(function (r) { return { r: r, st: vehicleStatus(r, fleetAvg) }; }).filter(function (x) { return x.st.length; })
      .sort(function (a, b) { return b.r.total - a.r.total; });
    s = frame('Véhicules à surveiller', 'Coût > 2× la moyenne du parc (' + fmtDT(fleetAvg) + ') ou hausse ≥ 50 % sur la dernière année — ' + alerts.length + ' véhicule(s)');
    var arows = [[hdr('Matricule'), hdr('Chauffeur'), hdr('Division'), hdr('CSC'), hdr('Total (DT)', true), hdr('Var.', true), hdr('Alerte')]];
    alerts.slice(0, 11).forEach(function (x, i) {
      var f = i % 2 ? 'F1F5F9' : PP.paper;
      arows.push([cell(x.r.v.matricule, { bold: true, fill: f }), cell(x.r.v.chauffeur || '—', { fill: f, fs: 9.5 }), cell(x.r.v.divLabel, { fill: f, fs: 9.5 }), cell(x.r.v.cscGroup, { fill: f, fs: 9.5 }),
        cell(fmt(x.r.total), { right: true, bold: true, fill: f }), cell(varTxt(x.r.var), { right: true, fill: f, color: varColor(x.r.var), bold: true, fs: 9.5 }),
        cell(x.st.map(function (b) { return b.t.replace(/^[^\wÀ-ÿ]+/, ''); }).join(' + '), { fill: f, fs: 9.5, color: '991B1B', bold: true })]);
    });
    if (alerts.length) s.addTable(arows, { x: 0.5, y: 1.4, w: 12.3, colW: [1.4, 2.4, 2.4, 1.9, 1.3, 1.3, 1.6], rowH: 0.44, border: { type: 'solid', color: PP.mist, pt: 0.5 } });
    else s.addText('Aucun véhicule en alerte sur la période.', { x: 0.6, y: 2, w: 12, h: 0.5, fontSize: 16, color: PP.slate });
    if (alerts.length > 11) s.addText('+ ' + (alerts.length - 11) + ' autre(s) — voir l\'export Excel.', { x: 0.5, y: 6.75, w: 8, h: 0.3, fontSize: 9, color: PP.slate, italic: true });
    return pres;
  }

  async function exportPptx(btn) {
    try {
      if (!DS || !DS.vehicles.length) { alert('Aucune donnée à exporter. Importez d\'abord l\'historique dépenses et/ou STAT CSC.'); return; }
      if (!selYears().length) { alert('Sélectionnez au moins une année.'); return; }
      if (btn) { btn.dataset.lbl = btn.innerHTML; btn.innerHTML = '⏳ Génération…'; btn.disabled = true; }
      var Ctor = await loadPptx();
      var pres = buildPptx(Ctor), sel = selYears();
      await pres.writeFile({ fileName: 'Analyse_Reparations_' + sel[0] + (sel.length > 1 ? '-' + sel[sel.length - 1] : '') + '_DRT_Sfax_' + new Date().toISOString().slice(0, 10) + '.pptx' });
    } catch (err) {
      console.error('[repair_analyse] PPTX:', err);
      alert('Erreur lors de la génération du PowerPoint : ' + (err && err.message ? err.message : err));
    } finally {
      if (btn && btn.dataset.lbl) { btn.innerHTML = btn.dataset.lbl; btn.disabled = false; }
    }
  }

  /* ══════════════════════════════════════════════════════════
   *  ÉVÉNEMENTS (délégation) + SYNCHRONISATION
   * ══════════════════════════════════════════════════════════ */
  function onClick(e) {
    var t = e.target;
    var el;
    if ((el = t.closest('[data-ra-action]'))) {
      var a = el.getAttribute('data-ra-action');
      if (a === 'refresh') refresh();
      else if (a === 'export') exportExcel();
      else if (a === 'export-pptx') exportPptx(el);
      else if (a === 'all-years') { DS.years.forEach(function (y) { state.years[y] = true; }); renderControls(); renderBody(); }
      else if (a === 'reset-filters') { state.division = ''; state.csc = ''; state.search = ''; renderControls(); renderBody(); }
      return;
    }
    if ((el = t.closest('[data-ra-year]'))) {
      var y = el.getAttribute('data-ra-year');
      state.years[y] = !state.years[y];
      renderControls(); renderBody(); return;
    }
    if ((el = t.closest('[data-ra-tab]'))) { state.view = el.getAttribute('data-ra-tab'); renderTabs(); renderBody(); return; }
    if ((el = t.closest('[data-ra-sort]'))) {
      var k = el.getAttribute('data-ra-sort'), ss = state.sort[state.view];
      if (!ss) return;
      if (ss.key === k) ss.dir = -ss.dir; else { ss.key = k; ss.dir = (/^(label|matricule|chauffeur|marque|division|csc)$/.test(k)) ? 1 : -1; }
      renderBody(); return;
    }
    if ((el = t.closest('[data-ra-toggle]'))) {
      var key = el.getAttribute('data-ra-toggle');
      state.open[key] = !state.open[key];
      renderBody();
    }
  }

  function bindEvents() {
    var card = document.getElementById('ra-card');
    if (!card || card.__raBound) return;
    card.__raBound = true;
    card.addEventListener('click', onClick);
    card.addEventListener('change', function (e) {
      if (e.target.id === 'ra-division') { state.division = e.target.value; renderBody(); }
      else if (e.target.id === 'ra-csc') { state.csc = e.target.value; renderBody(); }
    });
    var timer = null;
    card.addEventListener('input', function (e) {
      if (e.target.id !== 'ra-search') return;
      state.search = e.target.value;
      clearTimeout(timer);
      timer = setTimeout(renderBody, 150);
    });
  }

  /** Re-calcul automatique après un import : on surveille les messages de statut existants. */
  function watchImports() {
    if (typeof MutationObserver === 'undefined') return;
    ['repair-hist-import-status', 'csc-hist-import-status'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.__raWatched) return;
      el.__raWatched = true;
      new MutationObserver(function () {
        if (id === 'repair-hist-import-status' && /✅/.test(el.textContent || '')) pushRepairToCloud();
        setTimeout(refresh, 120);
      }).observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  function hookShowTab() {
    if (root.__repairAnalyseHooked) return;
    root.__repairAnalyseHooked = true;
    var prev = root.showTab;
    if (typeof prev !== 'function') return;
    root.showTab = function (tabName) {
      var r = prev.apply(this, arguments);
      if (tabName === 'repairs') setTimeout(refresh, 80);
      return r;
    };
  }

  function hookClear() {
    if (root.__repairAnalyseClearHooked || typeof root.clearRepairHistYear !== 'function') return;
    root.__repairAnalyseClearHooked = true;
    var prev = root.clearRepairHistYear;
    root.clearRepairHistYear = function () {
      var before = JSON.stringify(readLocalRepair());
      var r = prev.apply(this, arguments);
      if (JSON.stringify(readLocalRepair()) !== before) { pushRepairToCloud(); setTimeout(refresh, 80); }
      return r;
    };
  }

  function init() {
    if (!buildShell()) return;
    hookClear();
    bindEvents();
    watchImports();
    hookShowTab();
    refresh();
  }

  root.repairAnalyse = {
    refresh: refresh, exportExcel: exportExcel, exportPptx: exportPptx,
    _internals: { buildDataset: buildDataset, buildWorkbook: buildWorkbook, buildPptx: buildPptx, computeInsights: computeInsights, state: state, setDS: function (d) { DS = d; syncYears(); } }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);
  // Les modules d'import peuvent s'initialiser après nous : second passage de sécurité
  setTimeout(function () { watchImports(); hookShowTab(); hookClear(); }, 800);
})();
