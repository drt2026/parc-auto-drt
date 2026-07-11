/* ============================================================
   BLOC ADDITIF — MODULE CONSOMMATION GROUPES ÉLECTROGÈNES
   Fichier : groupe_electrogene.js
   Stockage : même Gist que l'app (this.data.groupeElectrogene)
   Accès protégé par mot de passe — 5 utilisateurs seulement :
   ZO-2026, HF-2026, SL-2026, AJ-2026, KK-2026 (Kamel Ksibi)
   Principe identique au Suivi Carburant : saisie mensuelle par
   site, report automatique du restant du mois précédent.
   À inclure dans admin.html ET index.html après demande_travaux_v2.js :
   <script src="groupe_electrogene.js?v=1"></script>
   ============================================================ */

(function () {
  'use strict';

  // ── Table des utilisateurs autorisés (mot de passe → nom) ──
  // Accès STRICTEMENT limité à ces 5 comptes, indépendant du
  // module Demande de Travaux / Suivi Carburant.
  const GE_USERS = {
    'ZO-2026': 'Zied Ouledabdallah',
    'HF-2026': 'Hanen Feki',
    'SL-2026': 'Sabeur Louhichi',
    'AJ-2026': 'Aref Jarraya',
    'KK-2026': 'Kamel Ksibi'
  };

  // ── Table des sites (SITE, PUISSANCE kVA, N° CARTE AGILIS) ──
  const GE_SITES = [
    { site: 'Agareb',         puiss: 60,  carte: '742 054787 01 055 06' },
    { site: 'Bir Ali',        puiss: 60,  carte: '742 054787 01 054 07' },
    { site: 'Sekhira',        puiss: 27,  carte: '742 054787 01 038 08' },
    { site: 'Cité Bahri',     puiss: 60,  carte: '742 054787 01 059 02' },
    { site: 'Cité Habib',     puiss: 135, carte: '742 054787 01 056 05' },
    { site: 'El Ain',         puiss: 135, carte: '742 054787 01 035 01' },
    { site: 'El Amra',        puiss: 40,  carte: '742 054787 01 046 08' },
    { site: 'Essebei',        puiss: 135, carte: '742 054787 01 057 04' },
    { site: 'Sedra',          puiss: 135, carte: '742 054787 01 058 03' },
    { site: 'Tyna',           puiss: 40,  carte: '742 054787 01 036 00' },
    { site: 'Mahres',         puiss: 90,  carte: '742 054787 01 037 09' },
    { site: 'Ghraiba',        puiss: 40,  carte: '742 054787 01 039 07' },
    { site: 'HABENA',         puiss: 130, carte: '742 054787 01 060 09' },
    { site: 'Hencha',         puiss: 27,  carte: '742 054787 01 047 07' },
    { site: 'Manzel Chaker',  puiss: 40,  carte: '742 054787 01 040 04' },
    { site: 'Sfax Mobile',    puiss: 27,  carte: '742 054787 01 053 08' },
    { site: 'Mz Kammoun',     puiss: 130, carte: '742 054787 01 049 05' },
    { site: 'Sakiet Ezzit',   puiss: 130, carte: '742 054787 01 048 06' },
    { site: 'SFAX GARE 1',    puiss: 500, carte: '742 054787 01 033 03' },
    { site: 'Sfax Eljadida',  puiss: 200, carte: '742 054787 01 051 00' },
    { site: 'Sfax Nord',      puiss: 500, carte: '742 054787 01 052 09' },
    { site: 'Sfax Sud',       puiss: 250, carte: '742 054787 01 050 01' },
    { site: 'Sidi Salah',     puiss: 60,  carte: '742 054787 01 044 00' },
    { site: 'Nakta',          puiss: 30,  carte: '742 054787 01 062 07' },
    { site: 'Kseksa',         puiss: 40,  carte: '742 054787 01 061 08' },
    { site: 'Hzag',           puiss: 27,  carte: '742 054787 01 045 09' },
    { site: 'Khazzanet',      puiss: 20,  carte: '742 054787 01 041 03' },
    { site: 'Sakiet Edayer',  puiss: 40,  carte: '742 054787 01 042 02' },
    { site: 'SFAX GARE 2',    puiss: 500, carte: '742 054787 01 034 02' },
    { site: 'Jebeniana',      puiss: 90,  carte: '742 054787 01 043 01' }
  ];

  const GE_MOIS = [
    { key: '2026-01', label: 'Janvier 2026',  sheet: 'Janv26' },
    { key: '2026-02', label: 'Février 2026',  sheet: 'Fev26' },
    { key: '2026-03', label: 'Mars 2026',     sheet: 'Mars26' },
    { key: '2026-04', label: 'Avril 2026',    sheet: 'Avril26' },
    { key: '2026-05', label: 'Mai 2026',      sheet: 'Mai26' },
    { key: '2026-06', label: 'Juin 2026',     sheet: 'Juin26' },
    { key: '2026-07', label: 'Juillet 2026',  sheet: 'Juillet26' },
    { key: '2026-08', label: 'Août 2026',     sheet: 'Aout26' },
    { key: '2026-09', label: 'Septembre 2026',sheet: 'Septembre26' },
    { key: '2026-10', label: 'Octobre 2026',  sheet: 'Octobre26' },
    { key: '2026-11', label: 'Novembre 2026', sheet: 'Novembre26' },
    { key: '2026-12', label: 'Décembre 2026', sheet: 'Decembre26' }
  ];

  const GE_SESSION_KEY = 'ge_sess_v1';
  const GE_SESSION_TTL = 8 * 3600 * 1000;

  function geGetSess() {
    try {
      var s = JSON.parse(sessionStorage.getItem(GE_SESSION_KEY) || 'null');
      return s && Date.now() < s.e ? s : null;
    } catch (e) { return null; }
  }
  function geSetSess(nom) {
    sessionStorage.setItem(GE_SESSION_KEY, JSON.stringify({ e: Date.now() + GE_SESSION_TTL, nom: nom }));
  }
  function geDelSess() { sessionStorage.removeItem(GE_SESSION_KEY); }

  function geGetData() {
    var pa = window.parcAuto;
    if (!pa || !pa.data) return null;
    if (!pa.data.groupeElectrogene) pa.data.groupeElectrogene = [];
    return pa.data;
  }
  function geSaveData() {
    var pa = window.parcAuto;
    if (pa && typeof pa.saveData === 'function') pa.saveData();
  }
  function geList() { var d = geGetData(); return d ? d.groupeElectrogene : []; }

  function geMoisIndex(key) { for (var i = 0; i < GE_MOIS.length; i++) if (GE_MOIS[i].key === key) return i; return -1; }

  function geNum(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function geFmt(n) { n = geNum(n); return (Math.round(n * 1000) / 1000).toLocaleString('fr-FR'); }

  // ── Calcule les valeurs dérivées d'une saisie ──
  function geCompute(entry) {
    var chargeMoisPrecDinar = geNum(entry.chargeMoisPrecDinar);
    var chargeMoisPrecLitre = geNum(entry.chargeMoisPrecLitre);
    var chargeCoursDinar    = geNum(entry.chargeCoursDinar);
    var chargeCoursLitre    = geNum(entry.chargeCoursLitre);
    var sortieDinar         = geNum(entry.sortieDinar);
    var sortieLitre         = geNum(entry.sortieLitre);
    var situMoisPrecL       = geNum(entry.situMoisPrecL);
    var ravitL              = geNum(entry.ravitL);
    var nbrH                = geNum(entry.nbrH);
    var consH               = geNum(entry.consH);

    var totalChargeDinar = chargeMoisPrecDinar + chargeCoursDinar;
    var totalChargeLitre = chargeMoisPrecLitre + chargeCoursLitre;
    var restantCarteDinar = totalChargeDinar - sortieDinar;
    var restantCarteLitre = totalChargeLitre - sortieLitre;
    var totalGazoil = situMoisPrecL + ravitL;
    var consMois = nbrH * consH;
    var restantGazoil = totalGazoil - consMois;

    return {
      totalChargeDinar: totalChargeDinar, totalChargeLitre: totalChargeLitre,
      restantCarteDinar: restantCarteDinar, restantCarteLitre: restantCarteLitre,
      totalGazoil: totalGazoil, consMois: consMois, restantGazoil: restantGazoil
    };
  }

  // ── Report automatique depuis le mois précédent (comme Suivi Carburant) ──
  function gePrevValues(site, moisKey) {
    var idx = geMoisIndex(moisKey);
    if (idx <= 0) return { chargeMoisPrecDinar: 0, chargeMoisPrecLitre: 0, situMoisPrecL: 0 };
    var prevKey = GE_MOIS[idx - 1].key;
    var list = geList();
    var prev = list.find(function (e) { return e.site === site && e.mois === prevKey; });
    if (!prev) return { chargeMoisPrecDinar: 0, chargeMoisPrecLitre: 0, situMoisPrecL: 0 };
    var c = geCompute(prev);
    return {
      chargeMoisPrecDinar: c.restantCarteDinar,
      chargeMoisPrecLitre: c.restantCarteLitre,
      situMoisPrecL: c.restantGazoil
    };
  }

  function geGetEntry(site, moisKey) {
    return geList().find(function (e) { return e.site === site && e.mois === moisKey; });
  }

  function geSaveEntry(site, moisKey, fields, saisiPar) {
    var data = geGetData();
    if (!data) return false;
    var list = data.groupeElectrogene;
    var prev = gePrevValues(site, moisKey);
    var existing = geGetEntry(site, moisKey);
    var payload = {
      site: site, mois: moisKey,
      chargeMoisPrecDinar: prev.chargeMoisPrecDinar,
      chargeMoisPrecLitre: prev.chargeMoisPrecLitre,
      chargeCoursDinar: geNum(fields.chargeCoursDinar),
      chargeCoursLitre: geNum(fields.chargeCoursLitre),
      sortieDinar: geNum(fields.sortieDinar),
      sortieLitre: geNum(fields.sortieLitre),
      situMoisPrecL: prev.situMoisPrecL,
      ravitL: geNum(fields.ravitL),
      nbrH: geNum(fields.nbrH),
      consH: geNum(fields.consH),
      saisiPar: saisiPar || '', dateSaisie: new Date().toISOString()
    };
    if (existing) {
      Object.keys(payload).forEach(function (k) { existing[k] = payload[k]; });
    } else {
      list.push(payload);
    }
    geSaveData();
    // Recalage en cascade : si des mois suivants existent déjà, leur report change.
    geCascadeRecompute(site, moisKey);
    return true;
  }

  // Si un mois est modifié, les mois suivants déjà saisis pour ce site doivent
  // recevoir le nouveau report — on met juste à jour leurs valeurs "précédentes"
  // stockées (le reste de la saisie utilisateur est conservé).
  function geCascadeRecompute(site, fromMoisKey) {
    var idx = geMoisIndex(fromMoisKey);
    if (idx === -1) return;
    var data = geGetData();
    if (!data) return;
    var list = data.groupeElectrogene;
    var changed = false;
    for (var i = idx + 1; i < GE_MOIS.length; i++) {
      var key = GE_MOIS[i].key;
      var entry = list.find(function (e) { return e.site === site && e.mois === key; });
      if (!entry) break; // pas de saisie plus loin, rien à recaler
      var prev = gePrevValues(site, key);
      if (entry.chargeMoisPrecDinar !== prev.chargeMoisPrecDinar ||
          entry.chargeMoisPrecLitre !== prev.chargeMoisPrecLitre ||
          entry.situMoisPrecL !== prev.situMoisPrecL) {
        entry.chargeMoisPrecDinar = prev.chargeMoisPrecDinar;
        entry.chargeMoisPrecLitre = prev.chargeMoisPrecLitre;
        entry.situMoisPrecL = prev.situMoisPrecL;
        changed = true;
      }
    }
    if (changed) geSaveData();
  }

  function geDeleteEntry(site, moisKey) {
    var data = geGetData();
    if (!data) return;
    data.groupeElectrogene = data.groupeElectrogene.filter(function (e) { return !(e.site === site && e.mois === moisKey); });
    geSaveData();
    geCascadeRecompute(site, moisKey);
  }

  // ══════════════════════════════════════════════════════════
  // STYLES
  // ══════════════════════════════════════════════════════════
  function injectGEStyles() {
    if (document.getElementById('ge-styles')) return;
    var css = document.createElement('style');
    css.id = 'ge-styles';
    css.textContent = `
      #ge-open-btn { position:fixed; right:18px; bottom:18px; z-index:9997; background:linear-gradient(135deg,#1A1A2E,#16213E);
        color:#fff; border:none; border-radius:30px; padding:13px 18px; font-size:13px; font-weight:700; cursor:pointer;
        box-shadow:0 6px 18px rgba(0,0,0,.25); display:flex; align-items:center; gap:7px; font-family:inherit; }
      #ge-overlay { position:fixed; inset:0; background:rgba(15,23,42,.6); display:none; align-items:center; justify-content:center;
        z-index:9998; padding:14px; }
      #ge-overlay.open { display:flex; }
      #ge-modal { background:#fff; border-radius:16px; width:100%; max-width:980px; max-height:92vh; overflow:hidden;
        display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.35); font-family:inherit; }
      .ge-hd { background:linear-gradient(135deg,#1A1A2E,#16213E); color:#fff; padding:16px 20px; display:flex;
        justify-content:space-between; align-items:center; }
      .ge-hd h2 { margin:0; font-size:17px; font-weight:800; }
      .ge-hd p { margin:2px 0 0; font-size:12px; color:#cbd5e1; }
      .ge-x { background:rgba(255,255,255,.12); border:none; color:#fff; width:32px; height:32px; border-radius:9px;
        cursor:pointer; font-size:15px; }
      .ge-bd { padding:18px 20px; overflow:auto; }
      .ge-input { width:100%; box-sizing:border-box; padding:10px 12px; border:1.5px solid #e2e8f0; border-radius:9px;
        font-size:14px; outline:none; font-family:inherit; }
      .ge-btn { padding:11px 16px; border:none; border-radius:10px; font-size:13.5px; font-weight:700; cursor:pointer;
        font-family:inherit; }
      .ge-btn-primary { background:linear-gradient(135deg,#ED7D31,#c96420); color:#fff; }
      .ge-btn-sec { background:#EFF6FF; color:#1d4ed8; }
      .ge-err { color:#dc2626; font-size:12.5px; min-height:16px; margin:6px 0 2px; }
      .ge-table { width:100%; border-collapse:collapse; font-size:12.5px; }
      .ge-table th, .ge-table td { border:1px solid #e2e8f0; padding:6px 7px; text-align:center; white-space:nowrap; }
      .ge-table th { background:#f1f5f9; font-weight:700; color:#334155; position:sticky; top:0; }
      .ge-table td.ge-ro { background:#f8fafc; color:#64748b; }
      .ge-table input { width:66px; padding:4px 5px; border:1px solid #cbd5e1; border-radius:5px; font-size:12.5px;
        text-align:center; font-family:inherit; }
      .ge-site-name { text-align:left !important; font-weight:600; color:#1e293b; }
      .ge-scroll-wrap { overflow-x:auto; border:1px solid #e2e8f0; border-radius:10px; }
      .ge-save-row-btn { padding:5px 9px; font-size:11px; border:none; border-radius:6px; background:#16a34a; color:#fff;
        cursor:pointer; font-weight:700; }
      .ge-toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:14px; align-items:center; }
      #ge-nav-item { display:flex; align-items:center; gap:8px; cursor:pointer; }
    `;
    document.head.appendChild(css);
  }

  // ══════════════════════════════════════════════════════════
  // ÉCRAN DE SAISIE (utilisateur autorisé)
  // ══════════════════════════════════════════════════════════
  function geRenderSaisieTable(moisKey, container) {
    var prevLabel = geMoisIndex(moisKey) > 0 ? GE_MOIS[geMoisIndex(moisKey) - 1].label : null;
    var rowsHtml = GE_SITES.map(function (s) {
      var entry = geGetEntry(s.site, moisKey);
      var prev = gePrevValues(s.site, moisKey);
      var c = geCompute(entry || { chargeMoisPrecDinar: prev.chargeMoisPrecDinar, chargeMoisPrecLitre: prev.chargeMoisPrecLitre,
        situMoisPrecL: prev.situMoisPrecL, chargeCoursDinar: entry ? entry.chargeCoursDinar : 0,
        chargeCoursLitre: entry ? entry.chargeCoursLitre : 0, sortieDinar: entry ? entry.sortieDinar : 0,
        sortieLitre: entry ? entry.sortieLitre : 0, ravitL: entry ? entry.ravitL : 0,
        nbrH: entry ? entry.nbrH : 0, consH: entry ? entry.consH : 0 });
      var safeSite = s.site.replace(/"/g, '&quot;');
      return '<tr data-site="' + safeSite + '">' +
        '<td class="ge-site-name">' + s.site + '<br><span style="font-weight:400;color:#94a3b8;font-size:10.5px">' + s.puiss + ' kVA</span></td>' +
        '<td class="ge-ro">' + geFmt(prev.chargeMoisPrecDinar) + ' DT<br>' + geFmt(prev.chargeMoisPrecLitre) + ' L</td>' +
        '<td><input type="number" step="any" class="ge-f-chargeCoursDinar" value="' + (entry ? entry.chargeCoursDinar : '') + '" placeholder="DT"></td>' +
        '<td><input type="number" step="any" class="ge-f-chargeCoursLitre" value="' + (entry ? entry.chargeCoursLitre : '') + '" placeholder="L"></td>' +
        '<td><input type="number" step="any" class="ge-f-sortieDinar" value="' + (entry ? entry.sortieDinar : '') + '" placeholder="DT"></td>' +
        '<td><input type="number" step="any" class="ge-f-sortieLitre" value="' + (entry ? entry.sortieLitre : '') + '" placeholder="L"></td>' +
        '<td class="ge-ro">' + geFmt(c.restantCarteDinar) + ' DT<br>' + geFmt(c.restantCarteLitre) + ' L</td>' +
        '<td class="ge-ro">' + geFmt(prev.situMoisPrecL) + ' L</td>' +
        '<td><input type="number" step="any" class="ge-f-ravitL" value="' + (entry ? entry.ravitL : '') + '" placeholder="L"></td>' +
        '<td><input type="number" step="any" class="ge-f-nbrH" value="' + (entry ? entry.nbrH : '') + '" placeholder="h"></td>' +
        '<td><input type="number" step="any" class="ge-f-consH" value="' + (entry ? entry.consH : '') + '" placeholder="L/h"></td>' +
        '<td class="ge-ro">' + geFmt(c.consMois) + ' L</td>' +
        '<td class="ge-ro" style="font-weight:700">' + geFmt(c.restantGazoil) + ' L</td>' +
        '<td><button class="ge-save-row-btn" data-site="' + safeSite + '">💾</button></td>' +
        '</tr>';
    }).join('');

    container.innerHTML =
      '<div class="ge-scroll-wrap"><table class="ge-table"><thead><tr>' +
      '<th rowspan="2">Site</th>' +
      '<th rowspan="2">Charge mois<br>précédent' + (prevLabel ? '<br><span style="font-weight:400">(' + prevLabel + ')</span>' : '') + '</th>' +
      '<th colspan="2">Charge cours du mois</th>' +
      '<th colspan="2">Sortie</th>' +
      '<th rowspan="2">Restant carte</th>' +
      '<th rowspan="2">Sit. mois<br>précédent (L)</th>' +
      '<th rowspan="2">Ravit. (L)</th>' +
      '<th rowspan="2">Nbr-H<br>marche/mois</th>' +
      '<th rowspan="2">Cons/H (L)</th>' +
      '<th rowspan="2">Cons/mois (L)</th>' +
      '<th rowspan="2">Restant<br>gazoil (L)</th>' +
      '<th rowspan="2"></th>' +
      '</tr><tr><th>DT</th><th>L</th><th>DT</th><th>L</th></tr></thead><tbody>' +
      rowsHtml + '</tbody></table></div>';

    container.querySelectorAll('.ge-save-row-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr');
        var site = btn.getAttribute('data-site');
        var fields = {
          chargeCoursDinar: tr.querySelector('.ge-f-chargeCoursDinar').value,
          chargeCoursLitre: tr.querySelector('.ge-f-chargeCoursLitre').value,
          sortieDinar: tr.querySelector('.ge-f-sortieDinar').value,
          sortieLitre: tr.querySelector('.ge-f-sortieLitre').value,
          ravitL: tr.querySelector('.ge-f-ravitL').value,
          nbrH: tr.querySelector('.ge-f-nbrH').value,
          consH: tr.querySelector('.ge-f-consH').value
        };
        var sess = geGetSess();
        geSaveEntry(site, moisKey, fields, sess ? sess.nom : 'Utilisateur GE');
        geRenderSaisieTable(moisKey, container);
        var flag = document.getElementById('ge-save-flag');
        if (flag) { flag.textContent = '✅ Saisie enregistrée — ' + site; setTimeout(function () { flag.textContent = ''; }, 2500); }
      });
    });
  }

  function geOpenSaisieScreen() {
    var sess = geGetSess();
    document.getElementById('ge-sc-login').style.display = 'none';
    document.getElementById('ge-sc-saisie').style.display = '';
    document.getElementById('ge-user-label').textContent = sess ? sess.nom : '';
    var sel = document.getElementById('ge-mois-select');
    if (!sel.options.length) {
      GE_MOIS.forEach(function (m) {
        var o = document.createElement('option'); o.value = m.key; o.textContent = m.label; sel.appendChild(o);
      });
      var now = new Date();
      var currentKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      sel.value = geMoisIndex(currentKey) !== -1 ? currentKey : GE_MOIS[0].key;
    }
    geRenderSaisieTable(sel.value, document.getElementById('ge-table-wrap'));
    sel.onchange = function () { geRenderSaisieTable(sel.value, document.getElementById('ge-table-wrap')); };
  }

  function injectGERoleButton() {
    if (document.getElementById('ge-role-btn')) return;
    var container = document.querySelector('.role-buttons');
    if (container) {
      var btn = document.createElement('button');
      btn.className = 'role-btn ge-role-btn';
      btn.id = 'ge-role-btn';
      btn.innerHTML =
        '<div class="role-btn-icon">⚡</div>' +
        '<div class="role-btn-text">' +
        '<span class="role-title">Groupe Électrogène</span>' +
        '<span class="role-desc">Consommation carburant — accès restreint</span>' +
        '</div>' +
        '<span class="role-arrow">›</span>';
      btn.addEventListener('click', geOpenModal);
      container.appendChild(btn);
      return;
    }
    // Repli : bouton flottant si le conteneur .role-buttons n'est pas trouvé
    var openBtn = document.createElement('button');
    openBtn.id = 'ge-open-btn';
    openBtn.innerHTML = '⚡ Groupe Électrogène';
    openBtn.addEventListener('click', geOpenModal);
    document.body.appendChild(openBtn);
  }

  function initGEUserModal() {
    if (document.getElementById('ge-overlay')) return;
    injectGEStyles();
    injectGERoleButton();

    var ov = document.createElement('div');
    ov.id = 'ge-overlay';
    ov.innerHTML =
      '<div id="ge-modal" role="dialog" aria-modal="true" aria-label="Consommation Groupes Électrogènes">' +
      '<div class="ge-hd"><div><h2>⚡ Consommation Groupes Électrogènes</h2><p>Parc Auto DRT Sfax — Accès restreint</p></div>' +
      '<button class="ge-x" id="ge-close">✕</button></div>' +
      '<div class="ge-bd">' +
      '<div id="ge-sc-login">' +
      '<p style="color:#64748b;font-size:13px;margin:0 0 14px">Entrez le mot de passe pour accéder à la saisie de consommation carburant des groupes électrogènes.</p>' +
      '<div class="ge-err" id="ge-login-err"></div>' +
      '<input type="password" id="ge-pwd" class="ge-input" placeholder="Mot de passe" autocomplete="current-password" style="margin-bottom:12px">' +
      '<button class="ge-btn ge-btn-primary" id="ge-login-btn" style="width:100%">Se connecter</button>' +
      '</div>' +
      '<div id="ge-sc-saisie" style="display:none">' +
      '<div class="ge-toolbar">' +
      '<span style="font-size:13px;color:#334155">👤 <b id="ge-user-label"></b></span>' +
      '<select id="ge-mois-select" class="ge-input" style="max-width:220px"></select>' +
      '<span id="ge-save-flag" style="font-size:12.5px;color:#16a34a;font-weight:600"></span>' +
      '<button class="ge-btn ge-btn-primary" id="ge-user-export-btn" style="margin-left:auto">📤 Exporter Excel</button>' +
      '<span id="ge-user-status" style="font-size:12px;color:#16a34a;font-weight:600"></span>' +
      '<button class="ge-btn ge-btn-sec" id="ge-logout-btn">Se déconnecter</button>' +
      '</div>' +
      '<div id="ge-table-wrap"></div>' +
      '</div>' +
      '</div></div>';
    document.body.appendChild(ov);

    document.getElementById('ge-close').addEventListener('click', function () { ov.classList.remove('open'); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('open'); });

    function doLogin() {
      var pwd = document.getElementById('ge-pwd').value.trim();
      var nom = GE_USERS[pwd];
      var err = document.getElementById('ge-login-err');
      if (!nom) { err.textContent = 'Mot de passe incorrect ou non autorisé.'; return; }
      err.textContent = '';
      geSetSess(nom);
      document.getElementById('ge-pwd').value = '';
      geOpenSaisieScreen();
    }
    document.getElementById('ge-login-btn').addEventListener('click', doLogin);
    document.getElementById('ge-pwd').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    document.getElementById('ge-logout-btn').addEventListener('click', function () {
      if (!confirm('Se déconnecter ?')) return;
      geDelSess();
      document.getElementById('ge-sc-saisie').style.display = 'none';
      document.getElementById('ge-sc-login').style.display = '';
    });
    document.getElementById('ge-user-export-btn').addEventListener('click', geExportExcel);
  }

  function geOpenModal() {
    initGEUserModal();
    var ov = document.getElementById('ge-overlay');
    var sess = geGetSess();
    if (sess) geOpenSaisieScreen();
    else {
      document.getElementById('ge-sc-saisie').style.display = 'none';
      document.getElementById('ge-sc-login').style.display = '';
    }
    ov.classList.add('open');
    setTimeout(function () { var el = document.getElementById('ge-pwd'); if (el && !sess) el.focus(); }, 80);
  }
  window.openGroupeElectrogeneModal = geOpenModal;

  // ══════════════════════════════════════════════════════════
  // ONGLET ADMIN — vue d'ensemble + import/export
  // ══════════════════════════════════════════════════════════
  // ── Palette DRT Sfax (identique au helper ttExportStyledExcel d'admin.html) ──
  var GE_NAVY     = 'FF1E3A5F';
  var GE_ORANGE   = 'FFEF6C00';
  var GE_BAND     = 'FFF1F5F9';
  var GE_WHITE    = 'FFFFFFFF';
  var GE_TOTAL_BG = 'FFFCE4D6';
  var GE_RED_BG   = 'FFFEE2E2';
  var GE_RED_FONT = 'FFDC2626';
  var GE_BORDER_THIN  = { style: 'thin', color: { argb: 'FFCCCCCC' } };
  var GE_BORDER_LIGHT = { style: 'thin', color: { argb: 'FFE0E0E0' } };
  var GE_BORDER_MED   = { style: 'medium', color: { argb: 'FF1E3A5F' } };

  // Charge ExcelJS depuis plusieurs miroirs CDN si non déjà présent
  // (déjà chargé globalement dans admin.html — chargement à la demande sur index.html)
  function geLoadExcelJS(cb) {
    if (window.ExcelJS) { cb(); return; }
    var mirrors = [
      'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
      'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
      'https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js'
    ];
    var i = 0;
    (function tryNext() {
      if (window.ExcelJS) { cb(); return; }
      if (i >= mirrors.length) { cb(new Error('Librairie ExcelJS indisponible (réseau).')); return; }
      var s = document.createElement('script');
      s.src = mirrors[i++];
      s.onload = function () { cb(); };
      s.onerror = tryNext;
      document.head.appendChild(s);
    })();
  }

  function geSetStatusAll(msg, isErr) {
    ['ge-admin-status', 'ge-user-status'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.textContent = msg; el.style.color = isErr ? '#dc2626' : '#16a34a'; }
    });
  }

  // ── Applique les bordures + style de base à une cellule de la feuille de mois ──
  function geStyleDataCell(cell, isLeft, isEven) {
    cell.font = cell.font || { size: 9 };
    cell.alignment = { horizontal: isLeft ? 'left' : 'center', vertical: 'middle' };
    cell.border = { top: GE_BORDER_LIGHT, bottom: GE_BORDER_LIGHT, left: GE_BORDER_LIGHT, right: GE_BORDER_LIGHT };
    if (!cell.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? GE_WHITE : GE_BAND } };
  }

  // ── Construit une feuille mensuelle stylée (titre, en-têtes fusionnés, données, total) ──
  function geBuildMonthSheet(wb, m) {
    var ws = wb.addWorksheet(m.sheet, { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
    ws.columns = [
      { width: 18 }, { width: 10 }, { width: 22 },
      { width: 11 }, { width: 10 }, { width: 11 }, { width: 10 },
      { width: 11 }, { width: 10 }, { width: 11 }, { width: 10 },
      { width: 11 }, { width: 10 },
      { width: 13 }, { width: 10 }, { width: 13 },
      { width: 12 }, { width: 10 }, { width: 12 }, { width: 14 }
    ];
    var nCols = 20;

    ws.mergeCells(1, 1, 1, nCols);
    var t = ws.getCell(1, 1);
    t.value = 'SITUATION GAZOIL — GROUPES ÉLECTROGÈNES — ' + m.label.toUpperCase();
    t.font = { bold: true, color: { argb: GE_WHITE }, size: 13 };
    t.alignment = { horizontal: 'center', vertical: 'middle' };
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GE_NAVY } };
    ws.getRow(1).height = 26;

    ws.mergeCells(2, 1, 2, nCols);
    var st = ws.getCell(2, 1);
    st.value = 'DRT Sfax — Parc Auto  |  Chef de Parc : Hamdi Ben Aouicha  |  Généré le ' + new Date().toLocaleDateString('fr-FR');
    st.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
    st.alignment = { horizontal: 'center' };
    ws.getRow(2).height = 16;

    var headerDefs = [
      { label: 'SITE', col: 1 }, { label: 'PUISS (kVA)', col: 2 }, { label: 'N° CARTE AGILIS', col: 3 },
      { label: 'CHARGE MOIS PRECEDENT', col: 4, span: 2 },
      { label: 'CHARGE COURS DU MOIS', col: 6, span: 2 },
      { label: 'TOTAL CHARGE', col: 8, span: 2 },
      { label: 'SORTIE', col: 10, span: 2 },
      { label: 'RESTANT CARTE', col: 12, span: 2 },
      { label: 'SIT-MOIS-PREC (L)', col: 14 }, { label: 'RAVIT (L)', col: 15 },
      { label: 'TOTAL GAZOIL (L)', col: 16 }, { label: 'Nbr-H MARCHE/MOIS', col: 17 },
      { label: 'CONS/H (L)', col: 18 }, { label: 'CONS/MOIS (L)', col: 19 },
      { label: 'RESTANT GAZOIL (L)', col: 20 }
    ];
    headerDefs.forEach(function (h) {
      if (h.span) ws.mergeCells(3, h.col, 3, h.col + h.span - 1);
      else ws.mergeCells(3, h.col, 4, h.col);
      var c = ws.getCell(3, h.col);
      c.value = h.label;
      c.font = { bold: true, color: { argb: GE_WHITE }, size: 9.5 };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GE_ORANGE } };
    });
    [4, 6, 8, 10, 12].forEach(function (col) {
      ['DINAR', 'LITRE'].forEach(function (lbl, i) {
        var c = ws.getCell(4, col + i);
        c.value = lbl;
        c.font = { bold: true, color: { argb: GE_WHITE }, size: 8.5 };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GE_NAVY } };
      });
    });
    ws.getRow(3).height = 26;
    ws.getRow(4).height = 16;
    for (var cc = 1; cc <= nCols; cc++) {
      [3, 4].forEach(function (rr) {
        ws.getCell(rr, cc).border = { top: GE_BORDER_THIN, bottom: GE_BORDER_THIN, left: GE_BORDER_THIN, right: GE_BORDER_THIN };
      });
    }

    var numFmtByCol = { 4: '#,##0.000', 5: '#,##0.00', 6: '#,##0.000', 7: '#,##0.00', 8: '#,##0.000', 9: '#,##0.00',
      10: '#,##0.000', 11: '#,##0.00', 12: '#,##0.000', 13: '#,##0.00', 14: '#,##0.00', 15: '#,##0.00',
      16: '#,##0.00', 17: '#,##0.00', 18: '#,##0.00', 19: '#,##0.00', 20: '#,##0.00' };

    var totals = {};
    for (var tc = 4; tc <= 20; tc++) totals[tc] = 0;

    GE_SITES.forEach(function (s, idx) {
      var entry = geGetEntry(s.site, m.key);
      var prev = gePrevValues(s.site, m.key);
      var c = geCompute(entry || { chargeMoisPrecDinar: prev.chargeMoisPrecDinar, chargeMoisPrecLitre: prev.chargeMoisPrecLitre, situMoisPrecL: prev.situMoisPrecL });
      var d = entry || {};
      var vals = [
        s.site, s.puiss, s.carte,
        prev.chargeMoisPrecDinar, prev.chargeMoisPrecLitre,
        geNum(d.chargeCoursDinar), geNum(d.chargeCoursLitre),
        c.totalChargeDinar, c.totalChargeLitre,
        geNum(d.sortieDinar), geNum(d.sortieLitre),
        c.restantCarteDinar, c.restantCarteLitre,
        prev.situMoisPrecL, geNum(d.ravitL), c.totalGazoil,
        geNum(d.nbrH), geNum(d.consH), c.consMois, c.restantGazoil
      ];
      var row = ws.getRow(5 + idx);
      vals.forEach(function (v, ci) {
        var col = ci + 1;
        var cell = row.getCell(col);
        cell.value = v;
        geStyleDataCell(cell, col === 1, idx % 2 === 0);
        if (numFmtByCol[col]) cell.numFmt = numFmtByCol[col];
        if (col >= 4 && col !== 18) totals[col] += v;
      });
      if (c.restantCarteDinar < 0 || c.restantCarteLitre < 0) {
        [12, 13].forEach(function (col) {
          row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GE_RED_BG } };
          row.getCell(col).font = { size: 9, bold: true, color: { argb: GE_RED_FONT } };
        });
      }
      if (c.restantGazoil < 0) {
        row.getCell(20).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GE_RED_BG } };
        row.getCell(20).font = { size: 9, bold: true, color: { argb: GE_RED_FONT } };
      }
    });

    var totalRowIdx = 5 + GE_SITES.length;
    var trow = ws.getRow(totalRowIdx);
    ws.mergeCells(totalRowIdx, 1, totalRowIdx, 3);
    trow.getCell(1).value = 'TOTAL';
    for (var col = 4; col <= 20; col++) {
      var cell = trow.getCell(col);
      if (col === 18) { cell.value = ''; } else { cell.value = totals[col]; cell.numFmt = numFmtByCol[col]; }
    }
    for (var col2 = 1; col2 <= 20; col2++) {
      var cell2 = trow.getCell(col2);
      cell2.font = { bold: true, size: 9.5, color: { argb: GE_NAVY } };
      cell2.alignment = { horizontal: col2 === 1 ? 'left' : 'center', vertical: 'middle' };
      cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GE_TOTAL_BG } };
      cell2.border = { top: GE_BORDER_MED, bottom: GE_BORDER_MED, left: GE_BORDER_THIN, right: GE_BORDER_THIN };
    }
    trow.height = 20;
  }

  // ── Construit la feuille de récapitulatif annuel (consommation par site x mois) ──
  function geBuildRecapSheet(wb) {
    var recap = wb.addWorksheet('Récap Annuel', { views: [{ state: 'frozen', ySplit: 3, xSplit: 1 }] });
    var nColsR = 1 + GE_MOIS.length + 1;
    recap.columns = [{ width: 20 }].concat(GE_MOIS.map(function () { return { width: 11 }; })).concat([{ width: 14 }]);

    recap.mergeCells(1, 1, 1, nColsR);
    var rt = recap.getCell(1, 1);
    rt.value = 'RÉCAPITULATIF ANNUEL — CONSOMMATION GAZOIL (L) — GROUPES ÉLECTROGÈNES';
    rt.font = { bold: true, color: { argb: GE_WHITE }, size: 13 };
    rt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GE_NAVY } };
    rt.alignment = { horizontal: 'center', vertical: 'middle' };
    recap.getRow(1).height = 26;

    recap.mergeCells(2, 1, 2, nColsR);
    var rst = recap.getCell(2, 1);
    rst.value = 'DRT Sfax — Parc Auto  |  Chef de Parc : Hamdi Ben Aouicha  |  Généré le ' + new Date().toLocaleDateString('fr-FR');
    rst.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
    rst.alignment = { horizontal: 'center' };
    recap.getRow(2).height = 16;

    var hRow = recap.getRow(3);
    hRow.getCell(1).value = 'SITE';
    GE_MOIS.forEach(function (m, i) { hRow.getCell(2 + i).value = m.label.split(' ')[0]; });
    hRow.getCell(nColsR).value = 'TOTAL ANNUEL';
    for (var c = 1; c <= nColsR; c++) {
      var cel = hRow.getCell(c);
      cel.font = { bold: true, color: { argb: GE_WHITE }, size: 9.5 };
      cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GE_ORANGE } };
      cel.alignment = { horizontal: 'center', vertical: 'middle' };
      cel.border = { top: GE_BORDER_THIN, bottom: GE_BORDER_THIN, left: GE_BORDER_THIN, right: GE_BORDER_THIN };
    }
    hRow.height = 18;

    var colTotals = {};
    for (var ct = 2; ct <= nColsR; ct++) colTotals[ct] = 0;

    GE_SITES.forEach(function (s, idx) {
      var r = recap.getRow(4 + idx);
      r.getCell(1).value = s.site;
      var rowTotal = 0;
      GE_MOIS.forEach(function (m, mi) {
        var entry = geGetEntry(s.site, m.key);
        var v = entry ? geCompute(entry).consMois : 0;
        var cell = r.getCell(2 + mi);
        cell.value = v;
        cell.numFmt = '#,##0';
        rowTotal += v;
        colTotals[2 + mi] += v;
      });
      var lastCell = r.getCell(nColsR);
      lastCell.value = rowTotal;
      lastCell.numFmt = '#,##0';
      lastCell.font = { bold: true, size: 9 };
      colTotals[nColsR] += rowTotal;
      for (var c2 = 1; c2 <= nColsR; c2++) geStyleDataCell(r.getCell(c2), c2 === 1, idx % 2 === 0);
    });

    var totalRowR = 4 + GE_SITES.length;
    var trR = recap.getRow(totalRowR);
    trR.getCell(1).value = 'TOTAL';
    for (var c3 = 2; c3 <= nColsR; c3++) { trR.getCell(c3).value = colTotals[c3]; trR.getCell(c3).numFmt = '#,##0'; }
    for (var c4 = 1; c4 <= nColsR; c4++) {
      var cel2 = trR.getCell(c4);
      cel2.font = { bold: true, size: 9.5, color: { argb: GE_NAVY } };
      cel2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GE_TOTAL_BG } };
      cel2.alignment = { horizontal: c4 === 1 ? 'left' : 'center', vertical: 'middle' };
      cel2.border = { top: GE_BORDER_MED, bottom: GE_BORDER_MED, left: GE_BORDER_THIN, right: GE_BORDER_THIN };
    }
    trR.height = 20;
  }

  async function geBuildStyledWorkbook() {
    var wb = new window.ExcelJS.Workbook();
    wb.creator = 'DRT Sfax — Parc Auto';
    wb.created = new Date();
    geBuildRecapSheet(wb);
    GE_MOIS.forEach(function (m) { geBuildMonthSheet(wb, m); });

    var buf = await wb.xlsx.writeBuffer();
    var blob = new Blob([buf], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'consommation_groupes_electrogenes_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function geExportExcel() {
    geSetStatusAll('⏳ Génération du fichier Excel…', false);
    geLoadExcelJS(function (err) {
      if (err) { geSetStatusAll('❌ Impossible de charger la librairie Excel.', true); return; }
      geBuildStyledWorkbook().then(function () {
        geSetStatusAll('✅ Export généré (13 feuilles : Récap + 12 mois).', false);
      }).catch(function (e) {
        console.error('[GE export]', e);
        geSetStatusAll('❌ Erreur export — ' + e.message, true);
      });
    });
  }

  function geImportExcel(evt) {
    var file = evt.target.files[0];
    if (!file) return;
    var status = document.getElementById('ge-admin-status');
    if (status) status.textContent = '⏳ Lecture du fichier…';

    function afterLibLoaded() {
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var wb = window.XLSX.read(e.target.result, { type: 'array' });
          var data = geGetData();
          if (!data) { if (status) status.textContent = '❌ Application non prête, réessayez.'; return; }
          var list = data.groupeElectrogene;

          var num = function (v) { if (v === '' || v == null || v === '-') return 0; var n = parseFloat(v); return isNaN(n) ? 0 : n; };
          var findCol = function (row, regex) {
            for (var i = 0; i < row.length; i++) { if (regex.test(String(row[i] || '').replace(/\s+/g, ' '))) return i; }
            return -1;
          };

          var monthsDone = 0, rowsImported = 0;
          var sheetByKey = {};
          GE_MOIS.forEach(function (m) { sheetByKey[m.sheet.toLowerCase()] = m.key; });

          wb.SheetNames.forEach(function (sheetName) {
            var moisKey = sheetByKey[sheetName.trim().toLowerCase()];
            if (!moisKey) return; // ignore Recapitulatif_Annuel et autres onglets non reconnus

            var sheet = wb.Sheets[sheetName];
            var rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            if (!rows.length) return;

            var headerRowIdx = -1, headerRow = null;
            for (var hr = 0; hr < Math.min(rows.length, 6); hr++) {
              if (rows[hr].some(function (c) { return /^SITE$/i.test(String(c || '').trim()); })) { headerRowIdx = hr; headerRow = rows[hr]; break; }
            }
            if (headerRowIdx === -1) return;

            var iSite = findCol(headerRow, /^SITE$/i);
            var iChargePrec = findCol(headerRow, /CHARGE MOIS PRECEDENT/i);
            var iChargeCours = findCol(headerRow, /CHARGE COURS DU MOIS/i);
            var iSortie = findCol(headerRow, /^SORTIE$/i);
            var iSitPrec = findCol(headerRow, /SIT-MOIS-PREC/i);
            var iRavit = findCol(headerRow, /RAVIT/i);
            var iNbrH = findCol(headerRow, /Nbr-H/i);
            var iConsH = findCol(headerRow, /CONS\/H/i);

            monthsDone++;
            for (var r = headerRowIdx + 2; r < rows.length; r++) {
              var row = rows[r];
              var siteName = String(row[iSite] || '').trim();
              if (!siteName || /^TOTAL$/i.test(siteName)) continue;
              var matchSite = GE_SITES.find(function (s) { return s.site.toLowerCase() === siteName.toLowerCase(); });
              if (!matchSite) continue;

              var payload = {
                site: matchSite.site, mois: moisKey,
                chargeMoisPrecDinar: iChargePrec !== -1 ? num(row[iChargePrec]) : 0,
                chargeMoisPrecLitre: iChargePrec !== -1 ? num(row[iChargePrec + 1]) : 0,
                chargeCoursDinar: iChargeCours !== -1 ? num(row[iChargeCours]) : 0,
                chargeCoursLitre: iChargeCours !== -1 ? num(row[iChargeCours + 1]) : 0,
                sortieDinar: iSortie !== -1 ? num(row[iSortie]) : 0,
                sortieLitre: iSortie !== -1 ? num(row[iSortie + 1]) : 0,
                situMoisPrecL: iSitPrec !== -1 ? num(row[iSitPrec]) : 0,
                ravitL: iRavit !== -1 ? num(row[iRavit]) : 0,
                nbrH: iNbrH !== -1 ? num(row[iNbrH]) : 0,
                consH: iConsH !== -1 ? num(row[iConsH]) : 0,
                saisiPar: 'Import Excel (admin)', dateSaisie: new Date().toISOString()
              };

              var existing = list.find(function (e) { return e.site === matchSite.site && e.mois === moisKey; });
              if (existing) { Object.keys(payload).forEach(function (k) { existing[k] = payload[k]; }); }
              else { list.push(payload); }
              rowsImported++;
            }
          });

          geSaveData();
          if (status) {
            status.textContent = monthsDone
              ? '✅ ' + rowsImported + ' saisie(s) importée(s) sur ' + monthsDone + ' mois détecté(s).'
              : '❌ Aucun onglet mensuel reconnu (attendu : Janv26, Fev26, … Decembre26).';
          }
          geRenderAdminTable();
          evt.target.value = '';
        } catch (err) {
          console.error('[GE import]', err);
          if (status) status.textContent = '❌ Erreur de lecture du fichier — ' + err.message;
        }
      };
      reader.readAsArrayBuffer(file);
    }

    if (window.XLSX) { afterLibLoaded(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = afterLibLoaded;
    s.onerror = function () { if (status) status.textContent = '❌ Impossible de charger la librairie Excel.'; };
    document.head.appendChild(s);
  }

  function geRenderAdminTable() {
    var wrap = document.getElementById('ge-admin-table-wrap');
    if (!wrap) return;
    var moisSel = document.getElementById('ge-admin-mois-select');
    var moisKey = moisSel ? moisSel.value : GE_MOIS[0].key;

    var rowsHtml = GE_SITES.map(function (s) {
      var entry = geGetEntry(s.site, moisKey);
      var prev = gePrevValues(s.site, moisKey);
      var c = geCompute(entry || { chargeMoisPrecDinar: prev.chargeMoisPrecDinar, chargeMoisPrecLitre: prev.chargeMoisPrecLitre, situMoisPrecL: prev.situMoisPrecL });
      var d = entry || {};
      return '<tr>' +
        '<td class="ge-site-name">' + s.site + '</td>' +
        '<td>' + geFmt(prev.chargeMoisPrecDinar) + ' DT / ' + geFmt(prev.chargeMoisPrecLitre) + ' L</td>' +
        '<td>' + geFmt(d.chargeCoursDinar || 0) + ' DT / ' + geFmt(d.chargeCoursLitre || 0) + ' L</td>' +
        '<td>' + geFmt(d.sortieDinar || 0) + ' DT / ' + geFmt(d.sortieLitre || 0) + ' L</td>' +
        '<td>' + geFmt(c.restantCarteDinar) + ' DT / ' + geFmt(c.restantCarteLitre) + ' L</td>' +
        '<td>' + geFmt(prev.situMoisPrecL) + ' L</td>' +
        '<td>' + geFmt(d.ravitL || 0) + ' L</td>' +
        '<td>' + geFmt(d.nbrH || 0) + '</td>' +
        '<td>' + geFmt(d.consH || 0) + '</td>' +
        '<td>' + geFmt(c.consMois) + ' L</td>' +
        '<td style="font-weight:700">' + geFmt(c.restantGazoil) + ' L</td>' +
        '<td>' + (entry ? (entry.saisiPar || '') : '') + '</td>' +
        (entry ? '<td><button class="ge-admin-del-btn" data-site="' + s.site.replace(/"/g,'&quot;') + '" style="background:#fee2e2;color:#b91c1c;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px">🗑</button></td>' : '<td></td>') +
        '</tr>';
    }).join('');

    wrap.innerHTML =
      '<div class="ge-scroll-wrap"><table class="ge-table"><thead><tr>' +
      '<th>Site</th><th>Charge mois préc.</th><th>Charge cours</th><th>Sortie</th><th>Restant carte</th>' +
      '<th>Sit. mois préc.</th><th>Ravit.</th><th>Nbr-H</th><th>Cons/H</th><th>Cons/mois</th>' +
      '<th>Restant gazoil</th><th>Saisi par</th><th></th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';

    wrap.querySelectorAll('.ge-admin-del-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var site = btn.getAttribute('data-site');
        if (!confirm('Supprimer la saisie de ' + site + ' pour ce mois ?\n⚠️ Action irréversible.')) return;
        geDeleteEntry(site, moisKey);
        geRenderAdminTable();
      });
    });
  }

  function initGEAdminTab() {
    injectGEStyles();

    // ── Nav item (même mécanisme que "Suivi Carburant" : data-nav + clic
    //    direct sur parcAuto.showTab, pour ne pas dépendre du wrapper
    //    showTab() propre à admin.html qui ignore les onglets inconnus) ──
    function injectNavItem() {
      var navItems = document.querySelectorAll('.nav-item[data-nav]');
      if (!navItems.length) { setTimeout(injectNavItem, 500); return; }
      if (document.querySelector('.nav-item[data-nav="groupeElectrogene"]')) return;

      var refNav = document.querySelector('.nav-item[data-nav="carburant"]')
        || document.querySelector('.nav-item[data-nav="travaux"]')
        || navItems[navItems.length - 1];
      var navItem = document.createElement('div');
      navItem.className = 'nav-item';
      navItem.setAttribute('data-nav', 'groupeElectrogene');
      navItem.innerHTML = '<span class="nav-icon">⚡</span><span class="nav-label">Groupes Électrogènes</span>';
      refNav.parentNode.insertBefore(navItem, refNav.nextSibling);

      navItem.addEventListener('click', function () {
        if (window.parcAuto && typeof window.parcAuto.showTab === 'function') {
          window.parcAuto.showTab('groupeElectrogene');
        }
        geRenderAdminTable();
      });
    }

    // ── Contenu de l'onglet (inséré une fois, comme tab-carburant) ──
    function injectTabContent() {
      if (document.getElementById('tab-groupeElectrogene')) return;
      var tabContainer = document.getElementById('tab-carburant')
        || document.querySelector('.tab-content')
        || document.querySelector('#tab-dashboard')
        || document.querySelector('[id^="tab-"]');
      if (!tabContainer) { setTimeout(injectTabContent, 500); return; }

      var tabEl = document.createElement('div');
      tabEl.id = 'tab-groupeElectrogene';
      tabEl.className = 'tab-content';
      tabEl.innerHTML =
        '<div class="tr2-admin-header"><h2>⚡ Consommation Groupes Électrogènes</h2></div>' +
        '<div class="ge-toolbar">' +
        '<select id="ge-admin-mois-select" class="ge-input" style="max-width:220px"></select>' +
        '<button class="ge-btn ge-btn-sec" id="ge-admin-import-btn">📥 Importer Excel (12 mois)</button>' +
        '<input type="file" id="ge-admin-import-file" accept=".xlsx,.xls" style="display:none">' +
        '<button class="ge-btn ge-btn-primary" id="ge-admin-export-btn">📤 Exporter Excel</button>' +
        '<span id="ge-admin-status" style="font-size:12.5px;color:#16a34a;font-weight:600"></span>' +
        '</div>' +
        '<div id="ge-admin-table-wrap"></div>';
      tabContainer.parentNode.insertBefore(tabEl, tabContainer.nextSibling);

      var sel = document.getElementById('ge-admin-mois-select');
      GE_MOIS.forEach(function (m) { var o = document.createElement('option'); o.value = m.key; o.textContent = m.label; sel.appendChild(o); });
      sel.addEventListener('change', geRenderAdminTable);

      document.getElementById('ge-admin-import-btn').addEventListener('click', function () { document.getElementById('ge-admin-import-file').click(); });
      document.getElementById('ge-admin-import-file').addEventListener('change', geImportExcel);
      document.getElementById('ge-admin-export-btn').addEventListener('click', geExportExcel);

      geRenderAdminTable();
    }

    injectNavItem();
    injectTabContent();

    // ── Patch showTab (composé avec le patch existant, sans le remplacer) ──
    function patchShowTabGE() {
      var pa = window.parcAuto;
      if (!pa || typeof pa.showTab !== 'function') { setTimeout(patchShowTabGE, 500); return; }
      var prevShowTab = pa.showTab.bind(pa);
      pa.showTab = function (tabName) {
        prevShowTab(tabName);
        var bc = document.getElementById('breadcrumb-current');
        var tab = document.getElementById('tab-groupeElectrogene');
        if (tabName === 'groupeElectrogene') {
          if (bc) bc.textContent = 'Groupes Électrogènes';
          if (tab) tab.classList.add('active');
          geRenderAdminTable();
        }
      };
    }
    patchShowTabGE();
  }

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════
  function init() {
    var isAdmin = !!document.querySelector('.nav-item[data-nav]') || window.location.href.includes('admin');
    if (isAdmin) {
      initGEAdminTab();
    } else {
      initGEUserModal();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
/* FIN BLOC ADDITIF — groupe_electrogene.js */
