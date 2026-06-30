/* ============================================================
   BLOC ADDITIF — MODULE DEMANDE DE TRAVAUX v2
   Fichier : demande_travaux_v2.js
   Stockage : même Gist que l'app (this.data.demandesTravaux)
   Côté utilisateur : formulaire protégé par mot de passe
   Côté admin     : onglet dédié avec validation / rejet / export
   À inclure dans admin.html ET index.html après app.js :
   <script src="demande_travaux_v2.js"></script>
   ============================================================ */

(function () {
  'use strict';

  // ── Table des utilisateurs (mot de passe → nom complet) ──
  const TRAVAUX_USERS = {
    'KM-2026':  'Kais Mejdoub',
    'KMS-2026': 'Karim Mestiri',
    'ZO-2026':  'Zied Ouledabdallah',
    'HMZ-2026': 'Hichem Mzid',
    'MA-2026':  'Mourad Ammar',
    'ZJ-2026':  'Zaher Jemni',
    'BC-2026':  'Bassem Chaari',
    'ABJ-2026': 'Anis Ben Jemaa',
    'AJ-2026':  'Aref Jarraya',
    'SL-2026':  'Sabeur Louhichi',
    'MK-2026':  'Makram Makhlouf',
    'AWS-2026': 'Abdelwaheb Saadaoui',
    'WM-2026':  'Walid Masmoudi',
    'HA-2026':  'Hichem Abdelmoula',
    'WB-2026':  'Wissem Bouguecha',
    'ST-2026':  'Salma Trigui',
    'FK-2026':  'Fakher Krichen',
    'JG-2026':  'Jesser Gharbi',
    'FBS-2026': 'Fethi Ben Salem',
    'SC-2026':  'Sami Chaari',
    'HF-2026':  'Hanen Feki',
    'NB-2026':  'Nabil Ben Jemaa'
  };
  // ── Table des véhicules autorisés par utilisateur (mot de passe → matricules) ──
  const TRAVAUX_USER_VEHICLES = {
    'KM-2026':  ['17-349945','17-349213','17-354454','17-355702','17-357079','17-368832'],
    'KMS-2026': ['17-349945','17-349213','17-354454','17-355702','17-357079','17-368832'],
    'ZO-2026':  ['17-353430','17-357146','17-349212','17-355884','17-371048'],
    'HMZ-2026': ['17-351899'],
    'MA-2026':  ['17-357077'],
    'ZJ-2026':  ['17-370280','17-370309','17-368829','17-368834','17-367822','17-357079','17-355695','17-355697','17-355700','17-355703','17-355556','17-355557','17-351511','17-351301','17-349624','17-349762','17-344534'],
    'BC-2026':  ['17-345137','17-346875','17-346876','17-351255','17-355699','17-355704','17-357075','17-357143','17-357144','17-357148','17-368820','17-367821','17-368831','17-370279'],
    'ABJ-2026': ['17-344532','17-346799','17-349623','17-349763','17-351512','17-354453','17-355455','17-355558','17-355698','17-355701','17-355705','17-367818','17-367819','17-368830','17-370281'],
    'AJ-2026':  ['17-351890','17-354452','17-354455','17-354456','17-355456','17-355555','17-355696','17-356835','17-357074','17-357078','17-357145','17-357149','17-368833','17-363395','17-369453','17-370307','17-370308'],
    'SL-2026':  ['17-351890','17-354452','17-354456','17-368833','17-370308'],
    'MK-2026':  ['17-357149','17-370307'],
    'AWS-2026': ['17-369453'],
    'WM-2026':  ['17-357074'],
    'HA-2026':  ['17-349945','17-349213','17-354454','17-355702','17-357079','17-368832'],
    'WB-2026':  ['17-349935'],
    'ST-2026':  ['17-351435','17-348917','17-351401'],
    'FK-2026':  ['17-351401'],
    'JG-2026':  ['17-370280','17-370309','17-368829','17-368834','17-367822','17-357079','17-355695','17-355697','17-355700','17-355703','17-355556','17-355557','17-351511','17-351301','17-349624','17-349762','17-344534'],
    'FBS-2026': ['17-344532','17-346799','17-349623','17-349763','17-351512','17-354453','17-355455','17-355558','17-355698','17-355701','17-355705','17-367818','17-367819','17-368830','17-370281'],
    'SC-2026':  ['17-345137','17-346875','17-346876','17-351255','17-355699','17-355704','17-357075','17-357143','17-357144','17-357148','17-368820','17-367821','17-368831','17-370279'],
    'HF-2026':  ['17-349212','17-357146','17-371048','17-353430','17-356884'],
    'NB-2026':  ['17-356842']
  };

  // ── Résoudre la liste des véhicules selon le nom d'utilisateur ──
  // (cherche d'abord par mot de passe par défaut, fallback via nom)
  function getVehiclesForUser(nom) {
    // Chercher la clé (mot de passe par défaut) correspondant au nom
    for (var pwd in TRAVAUX_USERS) {
      if (TRAVAUX_USERS[pwd] === nom && TRAVAUX_USER_VEHICLES[pwd]) {
        return TRAVAUX_USER_VEHICLES[pwd];
      }
    }
    return null; // null = pas de restriction (accès libre)
  }

  // BLOC ADDITIF — Récupérer la marque/modèle d'un véhicule depuis parcAuto.data.vehicles
  function getMarqueFromMat(mat) {
    try {
      var pa = window.parcAuto;
      var veh = pa && pa.data && pa.data.vehicles;
      if (!veh || !mat) return '';
      var norm = function(s) { return String(s||'').trim().toUpperCase().replace(/[\s\-]/g,''); };
      var matN = norm(mat);
      var found = veh.find(function(v) { return norm(v.matricule||'') === matN; });
      return found ? (found.modele || '') : '';
    } catch(e) { return ''; }
  }

  // Remplir le champ Marque selon le matricule sélectionné/saisi
  function syncMarqueField(mat) {
    var marqEl = document.getElementById('tr2-marq');
    if (!marqEl) return;
    if (!mat) { marqEl.value = ''; return; }
    var marque = getMarqueFromMat(mat);
    marqEl.value = marque || '';
  }
  // FIN BLOC ADDITIF

  // ── Mettre à jour le champ matricule selon les véhicules autorisés ──
  function updateMatriculeField(nom) {
    var matEl = document.getElementById('tr2-mat');
    if (!matEl) return;
    var vehicles = getVehiclesForUser(nom);
    if (!vehicles || vehicles.length === 0) {
      // Pas de restriction → champ texte libre
      if (matEl.tagName === 'SELECT') {
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.id   = 'tr2-mat';
        inp.placeholder = 'Ex: 17-353430';
        inp.style.cssText = matEl.style.cssText;
        inp.className = matEl.className;
        matEl.parentNode.replaceChild(inp, matEl);
        matEl = inp;
      }
      // BLOC ADDITIF — auto-remplir marque même en saisie libre
      matEl.addEventListener('input', function() { syncMarqueField(this.value); });
      matEl.addEventListener('change', function() { syncMarqueField(this.value); });
      // FIN BLOC ADDITIF
      return;
    }
    // Remplacer par un <select> si ce n'est pas déjà le cas
    if (matEl.tagName !== 'SELECT') {
      var sel = document.createElement('select');
      sel.id = 'tr2-mat';
      sel.style.cssText = matEl.style.cssText || '';
      sel.className = matEl.className || '';
      matEl.parentNode.replaceChild(sel, matEl);
      matEl = sel;
    }
    // Remplir les options
    matEl.innerHTML = '<option value="">— Sélectionnez un véhicule —</option>' +
      vehicles.map(function(v){
        var marq = getMarqueFromMat(v);
        var label = v + (marq ? '  —  ' + marq : '');
        return '<option value="' + v + '">' + label + '</option>';
      }).join('');
    // Appliquer le style CSS des champs formulaire
    matEl.style.width = '100%';
    matEl.style.boxSizing = 'border-box';
    matEl.style.padding = '10px 13px';
    matEl.style.border = '1.5px solid #e2e8f0';
    matEl.style.borderRadius = '9px';
    matEl.style.fontSize = '14px';
    matEl.style.color = '#1e293b';
    matEl.style.background = '#f8fafc';
    matEl.style.outline = 'none';
    matEl.style.fontFamily = 'inherit';
    // BLOC ADDITIF — auto-remplir marque au changement de sélection
    matEl.addEventListener('change', function() { syncMarqueField(this.value); });
    // Si une valeur est déjà présélectionnée, synchroniser immédiatement
    if (matEl.value) syncMarqueField(matEl.value);
    // FIN BLOC ADDITIF
  }

  // BLOC ADDITIF — Division et Subdivision par employé
  const TRAVAUX_USER_INFO = {
    'Kais Mejdoub':         { division: 'Division commerciale',            subdivision: 'Commerciale' },
    'Karim Mestiri':        { division: 'Division commerciale',            subdivision: 'Subdivision vente ACTELs' },
    'Zied Ouledabdallah':   { division: 'DAAF',                            subdivision: 'Division Affaires Financières' },
    'Hichem Mzid':          { division: 'RH',                              subdivision: 'RH' },
    'Mourad Ammar':         { division: 'Division clientèle',              subdivision: 'Division clientèle' },
    'Zaher Jemni':          { division: 'Division clientèle',              subdivision: 'CSC Sfax Nord' },
    'Bassem Chaari':        { division: 'Division clientèle',              subdivision: 'CSC Sfax Medina' },
    'Anis Ben Jemaa':       { division: 'Division clientèle',              subdivision: 'CSC Sfax Sud' },
    'Aref Jarraya':         { division: 'Division de réseaux',             subdivision: 'Division de réseaux' },
    'Sabeur Louhichi':      { division: 'Division de réseaux',             subdivision: 'ROC' },
    'Makram Makhlouf':      { division: 'Division de réseaux',             subdivision: 'Transport' },
    'Abdelwaheb Saadaoui':  { division: 'Division de réseaux',             subdivision: 'Subdivision déploiement' },
    'Walid Masmoudi':       { division: 'Division de réseaux',             subdivision: 'Subdivision déploiement' },
    'Hichem Abdelmoula':    { division: 'Division commerciale',            subdivision: 'Subdivision vente entreprise' },
    'Wissem Bouguecha':     { division: 'Centre logistique du sud',        subdivision: 'Centre logistique du sud' },
    'Salma Trigui':         { division: 'Direction centrale zone sud',     subdivision: 'Direction centrale zone sud' },
    'Fakher Krichen':       { division: 'Direction centrale zone sud',     subdivision: 'Division commerciale zone Sud' },
    'Jesser Gharbi':        { division: 'Division clientèle',              subdivision: 'CSC Sfax Nord' },
    'Fethi Ben Salem':      { division: 'Division clientèle',              subdivision: 'CSC Sfax Sud' },
    'Sami Chaari':          { division: 'Division clientèle',              subdivision: 'CSC Sfax Medina' },
    'Hanen Feki':           { division: 'DAAF',                            subdivision: 'Subdivision des moyens' },
    'Nabil Ben Jemaa':      { division: 'DRT Sfax',                        subdivision: 'DRT Sfax' }
  };
  // FIN BLOC ADDITIF

  const SESSION_KEY   = 'tr_sess_v2';
  const SESSION_TTL   = 8 * 3600 * 1000;

  // ── Table des validateurs (mot de passe → nom complet) ───
  // BLOC ADDITIF — Compte Validateur
  const VALIDATEUR_USERS = {
    'HF-VALID-2026': 'Hanen Feki',
    'ZO-VALID-2026': 'Zied Ouledabdallah'
  };
  // Titre/fonction de chaque validateur
  const VALIDATEUR_TITRES = {
    'Hanen Feki':        'Chef Subdivision Moyens',
    'Zied Ouledabdallah': 'Chef Division Affaires Financières'
  };
  function getTitreValidateur(nom) {
    return VALIDATEUR_TITRES[nom] || 'Validateur';
  }
  const VALID_SESS_KEY = 'tr_valid_sess_v2';
  const VALID_SESS_TTL = 4 * 3600 * 1000; // 4h

  function getValidSess()  { try { var s = JSON.parse(sessionStorage.getItem(VALID_SESS_KEY)||'null'); return s && Date.now() < s.e ? s : null; } catch(e){ return null; } }
  function setValidSess(nom) { sessionStorage.setItem(VALID_SESS_KEY, JSON.stringify({ e: Date.now() + VALID_SESS_TTL, nom: nom })); }
  function delValidSess()  { sessionStorage.removeItem(VALID_SESS_KEY); }
  // FIN BLOC ADDITIF — Compte Validateur

  // BLOC ADDITIF — Compte Chef Garage
  const CHEF_GARAGE_USERS = {
    'CG-2026': 'Hamdi Ben Aouicha'
  };
  const CHEF_GARAGE_TITRE = 'Chef de Parc';
  const CG_SESS_KEY  = 'tr_cg_sess_v2';
  const CG_SESS_TTL  = 8 * 3600 * 1000;
  function getCGSess()  { try { var s = JSON.parse(sessionStorage.getItem(CG_SESS_KEY)||'null'); return s && Date.now() < s.e ? s : null; } catch(e){ return null; } }
  function setCGSess(nom) { sessionStorage.setItem(CG_SESS_KEY, JSON.stringify({ e: Date.now() + CG_SESS_TTL, nom: nom })); }
  function delCGSess()  { sessionStorage.removeItem(CG_SESS_KEY); }
  function resolveCG(pwd) {
    var data = getData();
    if (data && data.chefGaragePasswords) {
      for (var n in data.chefGaragePasswords) { if (data.chefGaragePasswords[n] === pwd) return n; }
    }
    var defNom = CHEF_GARAGE_USERS[pwd];
    if (defNom) {
      if (data && data.chefGaragePasswords && data.chefGaragePasswords[defNom] !== undefined) return null;
      return defNom;
    }
    return null;
  }
  // FIN BLOC ADDITIF — Compte Chef Garage

  // ── Utilitaires session ───────────────────────────────────
  function getSess()  { try { var s = JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null'); return s && Date.now() < s.e ? s : null; } catch(e){ return null; } }
  function setSess(nom)  { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ e: Date.now() + SESSION_TTL, nom: nom })); }
  function delSess()  { sessionStorage.removeItem(SESSION_KEY); }

  // ── Accès données via parcAuto ────────────────────────────
  function getData() {
    var pa = window.parcAuto;
    if (!pa || !pa.data) return null;
    if (!pa.data.demandesTravaux) pa.data.demandesTravaux = [];
    return pa.data;
  }

  function saveData() {
    var pa = window.parcAuto;
    if (pa && typeof pa.saveData === 'function') pa.saveData();
  }

  // ── Bip d'alerte 3 BIP × 3 FOIS ────────────────────────────
  // Contexte audio unique partagé — créé lors du premier clic utilisateur
  // pour contourner la restriction Android (autoplay policy)
  var _tr2AudioCtx = null;
  function _getAudioCtx() {
    try {
      if (!_tr2AudioCtx || _tr2AudioCtx.state === 'closed') {
        _tr2AudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      // Android : le contexte démarre en "suspended" → le résumer
      if (_tr2AudioCtx.state === 'suspended') {
        _tr2AudioCtx.resume();
      }
      return _tr2AudioCtx;
    } catch(e) { return null; }
  }

  // Pré-chauffer le contexte au premier clic sur n'importe quel bouton
  // (obligatoire sur Android Chrome pour débloquer l'audio)
  document.addEventListener('click', function() { _getAudioCtx(); }, { once: true });
  document.addEventListener('touchend', function() { _getAudioCtx(); }, { once: true });

  // BLOC ADDITIF — S'assurer que les toasts restent visibles au-dessus des modals Demande de Travaux
  (function ensureToastAboveModals() {
    var style = document.createElement('style');
    style.textContent = '.toast-container { z-index: 9999 !important; }';
    document.head.appendChild(style);
  })();
  // FIN BLOC ADDITIF

  function bipAlert3(type) {
    var ctx = _getAudioCtx();
    if (!ctx) return;
    var freq   = type === 'valid' ? 880 : 660;
    var bipDur = 0.12;  // durée d'un bip (s)
    var bipGap = 0.18;  // silence entre bips dans une séquence
    var seqGap = 650;   // pause entre séquences (ms)
    var seq    = 0;
    function playSeq() {
      if (seq >= 3) return;
      seq++;
      // Résumer si suspendu (Android peut le re-suspendre)
      if (ctx.state === 'suspended') ctx.resume();
      var t = ctx.currentTime;
      for (var i = 0; i < 3; i++) {
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        var s = t + i * (bipDur + bipGap);
        gain.gain.setValueAtTime(0, s);
        gain.gain.linearRampToValueAtTime(0.5, s + 0.01);
        gain.gain.linearRampToValueAtTime(0, s + bipDur);
        osc.start(s);
        osc.stop(s + bipDur + 0.02);
      }
      if (seq < 3) setTimeout(playSeq, seqGap);
    }
    playSeq();
  }

  // ── Gestion mots de passe personnalisés (stockés dans Gist) ──
  // Principe : data.travauxPasswords = { 'Nom Complet': 'nouveauMdp', ... }
  // data.validateurPasswords = { 'Nom Complet': 'nouveauMdp', ... }
  // Si un mdp personnalisé existe → il prime sur le mdp par défaut du code

  function resolveUser(pwd, defaultTable, customKey) {
    // 1. Chercher dans les mots de passe personnalisés (Gist)
    var data = getData();
    if (data && data[customKey]) {
      var customs = data[customKey]; // { 'Nom': 'mdp' }
      for (var nom in customs) {
        if (customs[nom] === pwd) return nom;
      }
    }
    // 2. Fallback : mots de passe par défaut du code
    //    MAIS seulement si aucun mdp personnalisé n'existe pour cet utilisateur
    var nomParDefaut = defaultTable[pwd];
    if (nomParDefaut) {
      // Vérifier si cet utilisateur a déjà un mdp personnalisé → si oui, le mdp par défaut est désactivé
      if (data && data[customKey] && data[customKey][nomParDefaut] !== undefined) {
        return null; // mdp par défaut remplacé
      }
      return nomParDefaut;
    }
    return null;
  }

  function changePassword(nom, newPwd, customKey) {
    var data = getData();
    if (!data) return false;
    if (!data[customKey]) data[customKey] = {};
    data[customKey][nom] = newPwd;
    saveData();
    return true;
  }

  // ── Modal changement de mot de passe (partagée) ──────────
  function showChangePwdModal(nom, customKey, onSuccess) {
    // Supprimer si déjà présent
    var old = document.getElementById('tr2-chpwd-overlay');
    if (old) old.parentNode.removeChild(old);

    var el = document.createElement('div');
    el.id = 'tr2-chpwd-overlay';
    el.style.cssText = 'display:flex;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);align-items:center;justify-content:center;';
    el.innerHTML =
      '<div style="background:#fff;border-radius:16px;width:min(420px,94vw);box-shadow:0 20px 60px rgba(0,0,0,.25);animation:tr2Up .25s cubic-bezier(.22,1,.36,1);">' +
        '<div style="background:linear-gradient(135deg,#003087,#1a4a9a);border-radius:16px 16px 0 0;padding:18px 22px;display:flex;justify-content:space-between;align-items:center;">' +
          '<div>' +
            '<div style="color:#fff;font-size:16px;font-weight:700;">🔑 Changer mon mot de passe</div>' +
            '<div style="color:#94a3b8;font-size:12px;margin-top:2px;">👤 ' + nom + '</div>' +
          '</div>' +
          '<button id="tr2-chpwd-close" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px;">✕</button>' +
        '</div>' +
        '<div style="padding:22px;">' +
          '<div id="tr2-chpwd-err" style="display:none;background:#FEE2E2;color:#991b1b;border-radius:8px;padding:9px 13px;font-size:13px;margin-bottom:14px;"></div>' +
          '<div id="tr2-chpwd-ok" style="display:none;background:#D1FAE5;color:#065f46;border-radius:8px;padding:9px 13px;font-size:13px;margin-bottom:14px;text-align:center;font-weight:700;"></div>' +
          '<div style="margin-bottom:13px;">' +
            '<label style="display:block;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Nouveau mot de passe <span style="color:#E2701A">*</span></label>' +
            '<input type="password" id="tr2-chpwd-new" placeholder="Minimum 6 caractères" style="width:100%;box-sizing:border-box;padding:10px 13px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:14px;outline:none;font-family:inherit;">' +
          '</div>' +
          '<div style="margin-bottom:18px;">' +
            '<label style="display:block;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Confirmer le mot de passe <span style="color:#E2701A">*</span></label>' +
            '<input type="password" id="tr2-chpwd-conf" placeholder="Répétez le nouveau mot de passe" style="width:100%;box-sizing:border-box;padding:10px 13px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:14px;outline:none;font-family:inherit;">' +
          '</div>' +
          '<button id="tr2-chpwd-save" style="width:100%;padding:13px;background:linear-gradient(135deg,#E2701A,#c05a10);color:#fff;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;">💾 Enregistrer</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    function closeChPwd() { el.parentNode && el.parentNode.removeChild(el); }
    document.getElementById('tr2-chpwd-close').addEventListener('click', closeChPwd);
    el.addEventListener('click', function(e){ if (e.target === el) closeChPwd(); });

    // Focus
    setTimeout(function(){ var i = document.getElementById('tr2-chpwd-new'); if(i) i.focus(); }, 100);

    function doSave() {
      var errEl = document.getElementById('tr2-chpwd-err');
      var okEl  = document.getElementById('tr2-chpwd-ok');
      var newP  = (document.getElementById('tr2-chpwd-new')  || {}).value || '';
      var confP = (document.getElementById('tr2-chpwd-conf') || {}).value || '';

      errEl.style.display = 'none';
      okEl.style.display  = 'none';

      if (newP.length < 6) {
        errEl.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
        errEl.style.display = 'block'; return;
      }
      if (newP !== confP) {
        errEl.textContent = 'Les deux mots de passe ne correspondent pas.';
        errEl.style.display = 'block'; return;
      }

      var ok = changePassword(nom, newP, customKey);
      if (ok) {
        okEl.textContent = '✅ Mot de passe modifié avec succès !';
        okEl.style.display = 'block';
        document.getElementById('tr2-chpwd-new').value  = '';
        document.getElementById('tr2-chpwd-conf').value = '';
        if (typeof onSuccess === 'function') onSuccess();
        setTimeout(closeChPwd, 1800);
      } else {
        errEl.textContent = 'Erreur : application non prête. Réessayez.';
        errEl.style.display = 'block';
      }
    }

    document.getElementById('tr2-chpwd-save').addEventListener('click', doSave);
    [document.getElementById('tr2-chpwd-new'), document.getElementById('tr2-chpwd-conf')].forEach(function(inp) {
      if (inp) inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') doSave(); });
    });
  }

  // Numéro séquentiel
  function nextNumero() {
    var data = getData();
    if (!data) return 'DT-' + Date.now().toString().slice(-6);
    var year  = new Date().getFullYear();
    var demandes = (data.demandesTravaux || []);
    var max = 0;
    demandes.forEach(function(d) {
      var m = d.numero && d.numero.match(/DT-\d{4}-(\d+)/);
      if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
    });
    return 'DT-' + year + '-' + String(max + 1).padStart(3, '0');
  }

  // ── CSS global ───────────────────────────────────────────
  var css = document.createElement('style');
  css.textContent = `
    /* ── overlay / modal ── */
    #tr2-overlay { display:none; position:fixed; inset:0; z-index:9100;
      background:rgba(0,0,0,0.55); backdrop-filter:blur(4px);
      align-items:center; justify-content:center; }
    #tr2-overlay.open { display:flex; }
    #tr2-modal { background:#fff; border-radius:20px; width:min(560px,95vw);
      max-height:93vh; overflow-y:auto;
      box-shadow:0 24px 64px rgba(0,0,0,0.22);
      animation:tr2Up .28s cubic-bezier(.22,1,.36,1); }
    @keyframes tr2Up { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
    .tr2-hd { background:linear-gradient(135deg,#1A1A2E,#16213E);
      border-radius:20px 20px 0 0; padding:22px 26px;
      display:flex; align-items:center; justify-content:space-between; }
    .tr2-hd h2 { color:#fff; margin:0; font-size:17px; font-weight:700; }
    .tr2-hd p  { color:#94a3b8; margin:2px 0 0; font-size:12px; }
    .tr2-x { background:rgba(255,255,255,.13); border:none; color:#fff;
      width:32px; height:32px; border-radius:50%; cursor:pointer;
      font-size:17px; display:flex; align-items:center; justify-content:center; }
    .tr2-x:hover { background:rgba(255,255,255,.22); }
    .tr2-bd { padding:22px 26px; }
    /* ── champs ── */
    .tr2-f { margin-bottom:14px; }
    .tr2-f label { display:block; font-size:11px; font-weight:700; color:#374151;
      text-transform:uppercase; letter-spacing:.5px; margin-bottom:5px; }
    .tr2-f label em { color:#E67E22; font-style:normal; }
    .tr2-f input,.tr2-f textarea,.tr2-f select {
      width:100%; box-sizing:border-box; padding:10px 13px;
      border:1.5px solid #e2e8f0; border-radius:9px; font-size:14px;
      color:#1e293b; background:#f8fafc; outline:none; font-family:inherit;
      transition:border-color .2s; }
    .tr2-f input:focus,.tr2-f textarea:focus,.tr2-f select:focus { border-color:#E67E22; background:#fff; }
    .tr2-f input.err,.tr2-f textarea.err { border-color:#C0392B; }
    .tr2-f textarea { resize:vertical; min-height:80px; }
    .tr2-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    @media(max-width:460px){ .tr2-row{grid-template-columns:1fr;} }
    /* ── boutons ── */
    .tr2-btn { width:100%; padding:13px; border:none; border-radius:11px;
      font-size:15px; font-weight:700; cursor:pointer; transition:opacity .2s,transform .15s; margin-top:6px; }
    .tr2-btn:hover:not(:disabled){ opacity:.88; transform:translateY(-1px); }
    .tr2-btn:disabled { opacity:.45; cursor:not-allowed; }
    .tr2-btn-primary { background:linear-gradient(135deg,#E67E22,#d35400); color:#fff; }
    .tr2-btn-sec { background:#f1f5f9; color:#374151; }
    /* ── messages ── */
    .tr2-err { background:#FDECEA; color:#C0392B; border-radius:8px;
      padding:9px 13px; font-size:13px; margin-bottom:12px; display:none; }
    .tr2-err.show { display:block; }
    /* ── succès ── */
    .tr2-ok { text-align:center; padding:16px 0; }
    .tr2-ok .ic { font-size:52px; margin-bottom:10px; }
    .tr2-ok h3  { color:#1e293b; font-size:17px; margin:0 0 5px; }
    .tr2-ok p   { color:#64748b; font-size:13px; margin:0 0 16px; }
    .tr2-num  { display:inline-block; background:#E67E22; color:#fff;
      padding:4px 18px; border-radius:20px; font-size:13px; font-weight:700; margin-bottom:14px; }

    /* ── onglet admin ── */
    #tab-travaux { display:none; }
    #tab-travaux.active { display:block; }
    .tr2-admin-header { display:flex; align-items:center; justify-content:space-between;
      flex-wrap:wrap; gap:12px; margin-bottom:20px; }
    .tr2-admin-header h2 { margin:0; font-size:20px; font-weight:700; color:#1e293b; }
    .tr2-stats-bar { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px; }
    .tr2-stat-card { flex:1; min-width:110px; background:#fff; border-radius:12px;
      padding:14px 18px; border:1px solid #e2e8f0; text-align:center; }
    .tr2-stat-card .num { font-size:26px; font-weight:800; }
    .tr2-stat-card .lbl { font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:.5px; }
    .tr2-stat-card.pending .num { color:#E67E22; }
    .tr2-stat-card.valid   .num { color:#27AE60; }
    .tr2-stat-card.reject  .num { color:#C0392B; }
    .tr2-stat-card.total   .num { color:#1A1A2E; }

    /* ── filtre ── */
    .tr2-filter-bar { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; align-items:center; }
    .tr2-filter-btn { padding:6px 14px; border-radius:20px; border:1.5px solid #e2e8f0;
      background:#fff; font-size:12px; font-weight:600; cursor:pointer; transition:all .2s; }
    .tr2-filter-btn.active { border-color:#1A1A2E; background:#1A1A2E; color:#fff; }
    .tr2-search { flex:1; min-width:180px; padding:7px 13px; border:1.5px solid #e2e8f0;
      border-radius:20px; font-size:13px; outline:none; }
    .tr2-search:focus { border-color:#E67E22; }

    /* ── table ── */
    .tr2-table-wrap { overflow-x:auto; border-radius:12px; border:1px solid #e2e8f0; }
    .tr2-table { width:100%; border-collapse:collapse; font-size:13px; }
    .tr2-table th { background:#1A1A2E; color:#fff; padding:11px 14px;
      text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.5px; white-space:nowrap; }
    .tr2-table td { padding:11px 14px; border-bottom:1px solid #f1f5f9;
      vertical-align:middle; }
    .tr2-table tr:last-child td { border-bottom:none; }
    .tr2-table tr:hover td { background:#fafbfc; }
    .tr2-badge { display:inline-block; padding:3px 10px; border-radius:20px;
      font-size:11px; font-weight:700; white-space:nowrap; }
    .tr2-badge.en-attente { background:#FEF3E2; color:#92400e; }
    .tr2-badge.validee    { background:#D1FAE5; color:#065f46; }
    .tr2-badge.rejetee    { background:#FEE2E2; color:#991b1b; }
    /* ── actions ── */
    .tr2-action-btns { display:flex; gap:6px; flex-wrap:nowrap; }
    .tr2-act { padding:5px 10px; border:none; border-radius:7px;
      font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap; transition:opacity .2s; }
    .tr2-act:hover { opacity:.8; }
    .tr2-act-detail  { background:#EFF6FF; color:#1d4ed8; }
    .tr2-act-valid   { background:#D1FAE5; color:#065f46; }
    .tr2-act-reject  { background:#FEE2E2; color:#991b1b; }
    .tr2-empty { text-align:center; padding:40px; color:#94a3b8; font-size:14px; }

    /* ── modale détail ── */
    #tr2-detail-overlay { display:none; position:fixed; inset:0; z-index:9200;
      background:rgba(0,0,0,0.5); backdrop-filter:blur(3px);
      align-items:center; justify-content:center; }
    #tr2-detail-overlay.open { display:flex; }
    #tr2-detail-modal { background:#fff; border-radius:16px; width:min(520px,94vw);
      max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,.2);
      animation:tr2Up .22s cubic-bezier(.22,1,.36,1); }
    .tr2-detail-hd { background:linear-gradient(135deg,#1A1A2E,#16213E);
      border-radius:16px 16px 0 0; padding:18px 22px;
      display:flex; justify-content:space-between; align-items:center; }
    .tr2-detail-hd h3 { color:#fff; margin:0; font-size:16px; }
    .tr2-detail-bd { padding:20px 22px; }
    .tr2-info-row { display:flex; padding:10px 0; border-bottom:1px solid #f1f5f9; gap:12px; }
    .tr2-info-row:last-child { border-bottom:none; }
    .tr2-info-lbl { min-width:140px; font-size:11px; text-transform:uppercase;
      letter-spacing:.5px; color:#64748b; font-weight:600; padding-top:2px; }
    .tr2-info-val { font-size:14px; color:#1e293b; font-weight:500; flex:1; }
    .tr2-nature-box { background:#FEF3E2; border-left:4px solid #E67E22;
      border-radius:0 8px 8px 0; padding:14px 16px; margin:14px 0; }
    .tr2-nature-box .lbl { font-size:11px; text-transform:uppercase; color:#92400e; font-weight:700; }
    .tr2-nature-box .val { font-size:14px; color:#1e293b; margin-top:6px; line-height:1.6; }
    .tr2-comment-box { background:#f8fafc; border-radius:9px; padding:10px 13px;
      font-size:13px; color:#1e293b; border:1.5px solid #e2e8f0; width:100%;
      box-sizing:border-box; min-height:70px; resize:vertical; font-family:inherit; outline:none; }
    .tr2-comment-box:focus { border-color:#E67E22; }
    .tr2-detail-actions { display:flex; gap:10px; padding:0 22px 20px; flex-wrap:wrap; }
    .tr2-det-btn { flex:1; padding:11px; border:none; border-radius:10px;
      font-size:14px; font-weight:700; cursor:pointer; transition:opacity .2s; }
    .tr2-det-btn:hover { opacity:.85; }
    .tr2-det-valid  { background:#27AE60; color:#fff; }
    .tr2-det-reject { background:#C0392B; color:#fff; }
    .tr2-det-close  { background:#f1f5f9; color:#374151; }
    /* BLOC ADDITIF — Impression */
    .tr2-det-print  { background:#1A1A2E; color:#fff; }
    .tr2-det-capture { background:#2563eb; color:#fff; }
    @media print {
      body > *:not(#tr2-print-frame) { display:none !important; }
      #tr2-print-frame { display:block !important; position:fixed; inset:0; background:#fff; z-index:99999; }
    }

    /* ── badge nav ── */
    .tr2-nav-badge { display:inline-block; background:#E67E22; color:#fff;
      border-radius:10px; font-size:10px; font-weight:700;
      padding:1px 6px; margin-left:6px; vertical-align:middle; }

    /* ── export btn ── */
    .tr2-export-btn { padding:8px 16px; background:#27AE60; color:#fff; border:none;
      border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; transition:opacity .2s; }
    .tr2-export-btn:hover { opacity:.85; }

    /* ── BLOC ADDITIF — Interface Validateur ── */
    #tr2v-overlay { display:none; position:fixed; inset:0; z-index:9300;
      background:rgba(0,0,0,0.6); backdrop-filter:blur(5px);
      align-items:center; justify-content:center; }
    #tr2v-overlay.open { display:flex; }
    #tr2v-modal { background:#fff; border-radius:20px; width:min(680px,97vw);
      max-height:95vh; overflow-y:auto;
      box-shadow:0 28px 72px rgba(0,0,0,0.28);
      animation:tr2Up .28s cubic-bezier(.22,1,.36,1); }
    .tr2v-hd { background:linear-gradient(135deg,#1A1A2E,#2d4a7a);
      border-radius:20px 20px 0 0; padding:20px 26px;
      display:flex; align-items:center; justify-content:space-between; }
    .tr2v-hd h2 { color:#fff; margin:0; font-size:17px; font-weight:700; }
    .tr2v-hd p  { color:#94a3b8; margin:2px 0 0; font-size:12px; }
    .tr2v-x { background:rgba(255,255,255,.13); border:none; color:#fff;
      width:32px; height:32px; border-radius:50%; cursor:pointer;
      font-size:17px; display:flex; align-items:center; justify-content:center; }
    .tr2v-x:hover { background:rgba(255,255,255,.22); }
    .tr2v-bd { padding:20px 24px; }
    .tr2v-user-bar { display:flex; align-items:center; justify-content:space-between;
      background:#EFF6FF; border-radius:10px; padding:10px 16px; margin-bottom:18px; }
    .tr2v-user-bar span { color:#1d4ed8; font-weight:600; font-size:13px; }
    .tr2v-logout { background:#FEE2E2; color:#991b1b; border:none; border-radius:7px;
      padding:5px 11px; font-size:12px; font-weight:600; cursor:pointer; }
    .tr2v-logout:hover { opacity:.8; }
    .tr2v-stats { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
    .tr2v-stat { flex:1; min-width:90px; text-align:center; border-radius:10px;
      padding:12px 8px; border:1px solid #e2e8f0; }
    .tr2v-stat .n { font-size:24px; font-weight:800; }
    .tr2v-stat .l { font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:.5px; }
    .tr2v-stat.pending .n { color:#E67E22; }
    .tr2v-stat.valid   .n { color:#27AE60; }
    .tr2v-stat.reject  .n { color:#C0392B; }
    .tr2v-stat.total   .n { color:#1A1A2E; }
    .tr2v-empty { text-align:center; padding:40px 20px; color:#94a3b8; font-size:14px; }
    .tr2v-card { background:#fff; border:1.5px solid #e2e8f0; border-radius:12px;
      margin-bottom:12px; overflow:hidden; transition:border-color .2s; }
    .tr2v-card:hover { border-color:#cbd5e1; }
    .tr2v-card-hd { display:flex; align-items:center; justify-content:space-between;
      padding:12px 16px; background:#f8fafc; border-bottom:1px solid #f1f5f9; gap:8px; flex-wrap:wrap; }
    .tr2v-card-num  { font-weight:800; color:#1A1A2E; font-size:14px; }
    .tr2v-card-date { font-size:12px; color:#64748b; }
    .tr2v-card-body { padding:14px 16px; }
    .tr2v-card-row  { display:grid; grid-template-columns:1fr 1fr; gap:8px 16px; margin-bottom:8px; }
    @media(max-width:460px){ .tr2v-card-row{grid-template-columns:1fr;} }
    .tr2v-lbl { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#64748b; font-weight:600; margin-bottom:2px; }
    .tr2v-val { font-size:13px; color:#1e293b; font-weight:500; }
    .tr2v-nat  { background:#FEF3E2; border-left:4px solid #E67E22;
      border-radius:0 8px 8px 0; padding:10px 14px; margin:10px 0; }
    .tr2v-nat .l { font-size:10px; text-transform:uppercase; color:#92400e; font-weight:700; }
    .tr2v-nat .v { font-size:13px; color:#1e293b; margin-top:4px; line-height:1.5; }
    .tr2v-actions { display:flex; gap:8px; padding:0 16px 14px; flex-wrap:wrap; }
    .tr2v-btn-ok  { flex:1; padding:9px; background:#27AE60; color:#fff; border:none;
      border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; transition:opacity .2s; }
    .tr2v-btn-ko  { flex:1; padding:9px; background:#C0392B; color:#fff; border:none;
      border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; transition:opacity .2s; }
    .tr2v-btn-ok:hover,.tr2v-btn-ko:hover { opacity:.85; }
    .tr2v-btn-ok:disabled,.tr2v-btn-ko:disabled { opacity:.4; cursor:default; }
    .tr2v-treated { background:#f8fafc; border-radius:7px; padding:8px 12px;
      font-size:12px; font-style:italic; color:#64748b; }
    .tr2v-badge-ok { display:inline-block; background:#D1FAE5; color:#065f46;
      border-radius:20px; padding:3px 10px; font-size:11px; font-weight:700; }
    .tr2v-badge-ko { display:inline-block; background:#FEE2E2; color:#991b1b;
      border-radius:20px; padding:3px 10px; font-size:11px; font-weight:700; }
    .tr2v-badge-wait { display:inline-block; background:#FEF3E2; color:#92400e;
      border-radius:20px; padding:3px 10px; font-size:11px; font-weight:700; }
    .tr2v-filter-bar { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; }
    .tr2v-fb { padding:5px 12px; border-radius:20px; border:1.5px solid #e2e8f0;
      background:#fff; font-size:12px; font-weight:600; cursor:pointer; transition:all .2s; }
    .tr2v-fb.active { border-color:#1A1A2E; background:#1A1A2E; color:#fff; }
    /* reject textarea */
    .tr2v-reject-wrap { background:#FEF2F2; border-radius:10px; padding:12px 14px; margin-bottom:8px; }
    .tr2v-reject-wrap label { font-size:11px; font-weight:700; color:#991b1b;
      text-transform:uppercase; letter-spacing:.5px; display:block; margin-bottom:6px; }
    .tr2v-reject-txt { width:100%; box-sizing:border-box; padding:8px 11px;
      border:1.5px solid #FECACA; border-radius:8px; font-size:13px;
      font-family:inherit; resize:vertical; min-height:60px; outline:none; }
    .tr2v-reject-txt:focus { border-color:#C0392B; }
    /* floating open button (index.html) */
    /* ── Barre fixe bas : Validateur + Chef Garage ── */
    #tr2-bottom-bar {
      position:fixed; bottom:0; left:0; right:0; z-index:8997;
      background:#fff; border-top:1px solid #e2e8f0;
      display:flex; align-items:center; gap:8px;
      padding:8px 10px 10px; }
    #tr2v-open-btn {
      flex:1; height:44px;
      background:linear-gradient(135deg,#1A1A2E,#2d4a7a); color:#fff;
      border:none; border-radius:12px;
      font-size:12px; font-weight:700; cursor:pointer;
      display:flex; align-items:center; justify-content:center; gap:7px;
      position:relative; transition:opacity .2s,transform .15s; }
    #tr2v-open-btn:hover { opacity:.92; transform:scale(1.02); }
    #tr2v-open-btn .badge {
      position:absolute; top:-6px; right:-5px;
      background:#E67E22; color:#fff; border-radius:10px;
      font-size:10px; padding:1px 6px; font-weight:800;
      border:2px solid #fff; }
    /* ── bouton déconnexion demandeur ── */
    .tr2-logout-btn { width:100%; padding:11px; border:none; border-radius:11px;
      font-size:14px; font-weight:700; cursor:pointer; transition:opacity .2s,transform .15s;
      margin-top:6px; background:#FEE2E2; color:#991b1b; }
    .tr2-logout-btn:hover { opacity:.88; transform:translateY(-1px); }

    /* ── Écran Historique Validateur ── */
    #tr2v-sc-historique { display:none; }
    .tr2v-hist-back-bar { display:flex; align-items:center; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
    .tr2v-hist-back-btn { display:flex; align-items:center; gap:6px; padding:8px 16px;
      background:#1A1A2E; color:#fff; border:none; border-radius:10px;
      font-size:13px; font-weight:700; cursor:pointer; transition:opacity .2s; }
    .tr2v-hist-back-btn:hover { opacity:.85; }
    .tr2v-hist-title { font-size:16px; font-weight:800; color:#1e293b; }
    .tr2v-hist-filter-bar { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; }
    .tr2v-hist-fb { padding:5px 12px; border-radius:20px; border:1.5px solid #e2e8f0;
      background:#fff; font-size:12px; font-weight:600; cursor:pointer; transition:all .2s; }
    .tr2v-hist-fb.active { border-color:#1A1A2E; background:#1A1A2E; color:#fff; }

    /* FIN BLOC ADDITIF — Interface Validateur */

    /* BLOC ADDITIF — Interface Chef Garage */
    #tr2cg-overlay { display:none; position:fixed; inset:0; z-index:9400;
      background:rgba(0,0,0,0.65); backdrop-filter:blur(5px);
      align-items:center; justify-content:center; }
    #tr2cg-overlay.open { display:flex; }
    #tr2cg-modal { background:#fff; border-radius:20px; width:min(700px,97vw);
      max-height:95vh; overflow-y:auto;
      box-shadow:0 28px 72px rgba(0,0,0,0.28);
      animation:tr2Up .28s cubic-bezier(.22,1,.36,1); }
    .tr2cg-hd { background:linear-gradient(135deg,#064e3b,#065f46);
      border-radius:20px 20px 0 0; padding:20px 26px;
      display:flex; align-items:center; justify-content:space-between; }
    .tr2cg-hd h2 { color:#fff; margin:0; font-size:17px; font-weight:700; }
    .tr2cg-hd p  { color:#6ee7b7; margin:2px 0 0; font-size:12px; }
    .tr2cg-x { background:rgba(255,255,255,.13); border:none; color:#fff;
      width:32px; height:32px; border-radius:50%; cursor:pointer;
      font-size:17px; display:flex; align-items:center; justify-content:center; }
    .tr2cg-x:hover { background:rgba(255,255,255,.22); }
    .tr2cg-bd { padding:20px 24px; }
    .tr2cg-user-bar { display:flex; align-items:center; justify-content:space-between;
      background:#ECFDF5; border-radius:10px; padding:10px 16px; margin-bottom:16px; }
    .tr2cg-user-bar span { color:#065f46; font-weight:700; font-size:13px; }
    .tr2cg-logout { background:#FEE2E2; color:#991b1b; border:none; border-radius:7px;
      padding:5px 11px; font-size:12px; font-weight:600; cursor:pointer; }
    .tr2cg-stats { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
    .tr2cg-stat { flex:1; min-width:90px; text-align:center; border-radius:10px;
      padding:12px 8px; border:1px solid #e2e8f0; }
    .tr2cg-stat .n { font-size:24px; font-weight:800; }
    .tr2cg-stat .l { font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:.5px; }
    .tr2cg-stat.total  .n { color:#064e3b; }
    .tr2cg-stat.new    .n { color:#E67E22; }
    .tr2cg-stat.done   .n { color:#27AE60; }
    .tr2cg-filter-bar { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; }
    .tr2cg-fb { padding:5px 12px; border-radius:20px; border:1.5px solid #e2e8f0;
      background:#fff; font-size:12px; font-weight:600; cursor:pointer; transition:all .2s; }
    .tr2cg-fb.active { border-color:#064e3b; background:#064e3b; color:#fff; }
    .tr2cg-card { background:#fff; border:1.5px solid #e2e8f0; border-radius:12px;
      margin-bottom:10px; overflow:hidden; }
    .tr2cg-card.new-card { border-color:#E67E22; }
    .tr2cg-card-hd { display:flex; align-items:center; gap:8px; flex-wrap:wrap;
      padding:11px 16px; background:#f8fafc; border-bottom:1px solid #f1f5f9; }
    .tr2cg-card-body { padding:12px 16px; }
    .tr2cg-card-row { display:grid; grid-template-columns:1fr 1fr; gap:8px 16px; margin-bottom:8px; }
    @media(max-width:460px){ .tr2cg-card-row{grid-template-columns:1fr;} }
    .tr2cg-lbl { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#64748b; font-weight:600; margin-bottom:2px; }
    .tr2cg-val { font-size:13px; color:#1e293b; font-weight:500; }
    .tr2cg-nat { background:#FEF3E2; border-left:4px solid #E67E22;
      border-radius:0 8px 8px 0; padding:10px 14px; margin:8px 0; }
    .tr2cg-obs { background:#EFF6FF; border-left:4px solid #3b82f6;
      border-radius:0 8px 8px 0; padding:10px 14px; margin:8px 0; }
    .tr2cg-done-btn { background:#ECFDF5; color:#065f46; border:1.5px solid #6ee7b7;
      border-radius:8px; padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer; }
    .tr2cg-done-btn.done { background:#D1FAE5; border-color:#34d399; }
    /* BLOC ADDITIF — Observation & Réponse Chef Garage */
    .tr2cg-rep-btn { background:linear-gradient(135deg,#7c3aed,#6d28d9); color:#fff;
      border:none; border-radius:8px; padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer; margin-left:6px; }
    .tr2cg-rep-btn:hover { opacity:.88; }
    .tr2cg-cgobs { background:#F3E8FF; border-left:4px solid #7c3aed;
      border-radius:0 8px 8px 0; padding:10px 14px; margin:8px 0; }
    #tr2cg-obs-modal { display:none; position:fixed; inset:0; z-index:9600;
      background:rgba(0,0,0,.6); backdrop-filter:blur(4px);
      align-items:center; justify-content:center; }
    #tr2cg-obs-modal.open { display:flex; }
    #tr2cg-obs-box { background:#fff; border-radius:16px; width:min(520px,96vw);
      padding:26px; box-shadow:0 24px 60px rgba(0,0,0,.25);
      animation:tr2Up .25s cubic-bezier(.22,1,.36,1); }
    .tr2-cgr-badge { display:inline-block; background:#7c3aed; color:#fff;
      border-radius:12px; padding:2px 9px; font-size:11px; font-weight:700; margin-left:6px; }
    /* FIN BLOC ADDITIF */
    #tr2cg-open-btn {
      flex:1; height:44px;
      background:linear-gradient(135deg,#064e3b,#065f46); color:#fff;
      border:none; border-radius:12px;
      font-size:12px; font-weight:700; cursor:pointer;
      display:flex; align-items:center; justify-content:center; gap:7px;
      position:relative; transition:opacity .2s,transform .15s; }
    #tr2cg-open-btn:hover { opacity:.92; transform:scale(1.02); }
    #tr2cg-open-btn .badge {
      position:absolute; top:-6px; right:-5px;
      background:#E67E22; color:#fff; border-radius:10px;
      font-size:10px; padding:1px 6px; font-weight:800;
      border:2px solid #fff; }
    /* FIN BLOC ADDITIF — Interface Chef Garage */
  `;
  document.head.appendChild(css);

  // ══════════════════════════════════════════════════════════
  // PARTIE 1 — FORMULAIRE UTILISATEUR (index.html)
  // ══════════════════════════════════════════════════════════
  function initUserForm() {
    // Injecter la modal formulaire
    var overlayEl = document.createElement('div');
    overlayEl.id = 'tr2-overlay';
    overlayEl.innerHTML = `
      <div id="tr2-modal" role="dialog" aria-modal="true" aria-label="Demande de Travaux">
        <div class="tr2-hd">
          <div>
            <h2>🔧 Demande de Travaux</h2>
            <p>Parc Auto DRT Sfax — Tunisie Telecom</p>
          </div>
          <button class="tr2-x" id="tr2-close" aria-label="Fermer">✕</button>
        </div>
        <div class="tr2-bd">

          <!-- Écran login -->
          <div id="tr2-sc-login">
            <div style="text-align:center;padding:10px 0 18px">
              <div style="font-size:44px;margin-bottom:10px">🔒</div>
              <h3 style="color:#1e293b;font-size:16px;font-weight:700;margin:0 0 4px">Accès restreint</h3>
              <p style="color:#64748b;font-size:13px;margin:0 0 20px">Entrez le mot de passe pour accéder</p>
            </div>
            <div class="tr2-err" id="tr2-login-err"></div>
            <div class="tr2-f">
              <label>Mot de passe <em>*</em></label>
              <input type="password" id="tr2-pwd" placeholder="••••••••••" autocomplete="current-password">
            </div>
            <button class="tr2-btn tr2-btn-primary" id="tr2-login-btn">Accéder</button>
          </div>

          <!-- Écran formulaire -->
          <div id="tr2-sc-form" style="display:none">
            <div class="tr2-err" id="tr2-form-err"></div>
            <div class="tr2-row">
              <div class="tr2-f">
                <label>Nom du demandeur <em>*</em></label>
                <input type="text" id="tr2-nom" placeholder="Rempli automatiquement" readonly style="background:#f1f5f9;color:#374151;cursor:default;">
              </div>
              <div class="tr2-f">
                <label>Division <em>*</em></label>
                <input type="text" id="tr2-div" placeholder="Ex: Division Réseau">
              </div>
            </div>
            <div class="tr2-row">
              <div class="tr2-f">
                <label>Subdivision <em>*</em></label>
                <input type="text" id="tr2-subdiv" placeholder="Ex: Subdivision Sfax Nord">
              </div>
              <div class="tr2-f"></div>
            </div>
            <div class="tr2-row">
              <div class="tr2-f">
                <label>Matricule véhicule <em>*</em></label>
                <input type="text" id="tr2-mat" placeholder="Ex: 17-353430">
              </div>
              <div class="tr2-f">
                <label>Marque <em>*</em></label>
                <input type="text" id="tr2-marq" placeholder="Rempli automatiquement" readonly
                  style="background:#f1f5f9;color:#374151;cursor:default;">
              </div>
            </div>
            <div class="tr2-row">
              <div class="tr2-f">
                <label>Date de la demande <em>*</em></label>
                <input type="date" id="tr2-date">
              </div>
              <div class="tr2-f">
                <label>Index kilométrique <em>*</em></label>
                <input type="number" id="tr2-km" placeholder="Ex: 45200" min="0">
              </div>
            </div>
            <div class="tr2-f">
              <label>Nature de l'intervention <em>*</em></label>
              <textarea id="tr2-nat" placeholder="Décrivez les travaux à effectuer…"></textarea>
            </div>
            <button class="tr2-btn tr2-btn-primary" id="tr2-submit-btn">📨 Soumettre la demande</button>
            <button class="tr2-btn tr2-btn-sec" id="tr2-lock-btn" style="margin-top:6px">🔒 Verrouiller</button>
            <button class="tr2-btn tr2-btn-sec" id="tr2-chpwd-btn" style="margin-top:6px;background:#EFF6FF;color:#1d4ed8;">🔑 Changer mon mot de passe</button>
            <button class="tr2-btn tr2-btn-sec" id="tr2-hist-btn" style="margin-top:6px;background:#F3E8FF;color:#6b21a8;">📁 Historique de mes demandes</button>
            <button class="tr2-logout-btn" id="tr2-form-logout-btn">🚪 Se déconnecter</button>
          </div>

          <!-- Écran succès -->
          <div id="tr2-sc-ok" style="display:none">
            <div class="tr2-ok">
              <div class="ic">✅</div>
              <h3>Demande soumise !</h3>
              <div class="tr2-num" id="tr2-num-ok"></div>
              <p>Votre demande a été enregistrée et sera traitée par le chef de parc.</p>
              <button class="tr2-btn tr2-btn-primary" id="tr2-new-btn">➕ Nouvelle demande</button>
            </div>
          </div>

          <!-- Écran notification statut (BLOC ADDITIF) -->
          <div id="tr2-sc-notif" style="display:none">
            <div class="tr2-hd" style="border-radius:0">
              <div><h2>📋 Mes Demandes</h2><p id="tr2-notif-user">—</p></div>
              <button class="tr2-x" id="tr2-notif-close" aria-label="Fermer">✕</button>
            </div>
            <div class="tr2-bd" id="tr2-notif-list"></div>
            <div style="padding:0 26px 20px;display:flex;gap:8px;flex-direction:column">
              <button class="tr2-btn tr2-btn-primary" id="tr2-notif-new-btn">➕ Nouvelle demande</button>
              <!-- BLOC ADDITIF — Bouton Actualiser -->
              <button class="tr2-btn" id="tr2-notif-refresh-btn" style="background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;margin-top:0">🔄 Actualiser</button>
              <!-- FIN BLOC ADDITIF -->
              <button class="tr2-btn" id="tr2-notif-back-btn" style="background:#f1f5f9;color:#374151;margin-top:0">⬅️ Retour au formulaire</button>
              <button class="tr2-btn" id="tr2-notif-clear-btn" style="background:#FEE2E2;color:#991b1b;margin-top:0">🗑️ Effacer l'historique</button>
              <button class="tr2-logout-btn" id="tr2-notif-logout-btn">🚪 Se déconnecter</button>
            </div>
          </div>

        </div>
      </div>`;
    document.body.appendChild(overlayEl);

    function trScreen(n) {
      document.getElementById('tr2-sc-login').style.display = n==='login' ? '' : 'none';
      document.getElementById('tr2-sc-form').style.display  = n==='form'  ? '' : 'none';
      document.getElementById('tr2-sc-ok').style.display    = n==='ok'    ? '' : 'none';
      document.getElementById('tr2-sc-notif').style.display = n==='notif' ? '' : 'none';
    }

    // ── Rendu écran notification demandeur ────────────────────
    var _notifSelected = null; // id de la demande sélectionnée

    function renderNotifScreen(nom) {
      var data = getData();
      var demandes = (data && data.demandesTravaux)
        ? data.demandesTravaux.filter(function(d){ return d.nomDemandeur === nom; }).slice().reverse()
        : [];
      document.getElementById('tr2-notif-user').textContent = '👤 ' + nom;
      var listEl = document.getElementById('tr2-notif-list');
      if (!demandes.length) {
        listEl.innerHTML = '<p style="color:#64748b;font-size:13px;text-align:center;padding:10px 0">Aucune demande pour le moment.</p>';
        return;
      }

      // Déterminer si le validateur est connecté (peut valider)
      var validSess = getValidSess ? getValidSess() : null;
      var isValidateur = !!validSess;

      listEl.innerHTML = demandes.map(function(d) {
        var isOk  = d.statut === 'VALIDÉE';
        var isKo  = d.statut === 'REJETÉE';
        var isPending = d.statut === 'EN ATTENTE';
        var bg    = isOk ? '#D1FAE5' : isKo ? '#FEE2E2' : '#FEF3E2';
        var color = isOk ? '#065f46' : isKo ? '#991b1b' : '#92400e';
        var icon  = isOk ? '✅' : isKo ? '❌' : '⏳';
        var label = isOk ? 'Validée' : isKo ? 'Rejetée' : 'En attente';
        var extra = '';
        if ((isOk || isKo) && d.validePar) extra += '<div style="font-size:11px;color:#64748b;margin-top:3px">Par : ' + d.validePar + (d.dateTraitement ? ' — ' + formatDate(d.dateTraitement) : '') + '</div>';
        // BLOC ADDITIF — Réponse Chef Garage visible par le demandeur
        if (d.cgReponse) extra += '<div style="background:#EDE9FE;border-left:3px solid #7c3aed;border-radius:0 6px 6px 0;padding:7px 11px;margin-top:7px;font-size:12px;"><span style=\"font-weight:700;color:#5b21b6;\">🏗️ Chef de Garage :</span> <span style=\"color:#1e293b;\">' + d.cgReponse + '</span></div>';
        // FIN BLOC ADDITIF
        if (isKo && d.commentaire) extra += '<div style="font-size:12px;color:#991b1b;margin-top:4px;background:#FEE2E2;padding:6px 10px;border-radius:7px">💬 ' + d.commentaire + '</div>';

        var isSelected = _notifSelected === d.id;

        // Panel validateur inline (uniquement si sélectionnée + validateur connecté + en attente)
        var validPanel = '';
        if (isSelected && isValidateur && isPending) {
          validPanel =
            '<div id="tr2-notif-valid-panel-' + d.id + '" style="margin-top:10px;border-top:1.5px solid ' + color + '44;padding-top:10px">' +
              '<div style="font-size:11px;font-weight:700;color:#1A1A2E;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">⚡ Action validateur — ' + validSess.nom + '</div>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                '<button id="tr2-notif-vok-' + d.id + '" style="flex:1;padding:8px;background:#27AE60;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">✅ Valider</button>' +
                '<button id="tr2-notif-vko-' + d.id + '" style="flex:1;padding:8px;background:#FEE2E2;color:#991b1b;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">❌ Rejeter</button>' +
              '</div>' +
              '<div id="tr2-notif-reject-wrap-' + d.id + '" style="display:none;margin-top:8px;background:#FEF2F2;border-radius:9px;padding:10px">' +
                '<label style="font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px">Motif de rejet (optionnel)</label>' +
                '<textarea id="tr2-notif-rtxt-' + d.id + '" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1.5px solid #FECACA;border-radius:7px;font-size:13px;font-family:inherit;resize:vertical;min-height:55px;outline:none" placeholder="Précisez le motif…"></textarea>' +
                '<button id="tr2-notif-rconf-' + d.id + '" style="margin-top:7px;width:100%;padding:8px;background:#C0392B;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">❌ Confirmer le rejet</button>' +
              '</div>' +
            '</div>';
        }

        // Indicateur "cliquer pour détails" si validateur connecté et en attente
        var clickHint = '';
        if (isValidateur && isPending && !isSelected) {
          clickHint = '<div style="font-size:10px;color:#1A1A2E88;margin-top:6px;text-align:right">👆 Cliquez pour valider / rejeter</div>';
        }

        var selectedStyle = isSelected
          ? 'border:2px solid ' + color + ';box-shadow:0 4px 16px ' + color + '33;'
          : 'border:1.5px solid ' + color + '33;';

        return '<div data-notif-id="' + d.id + '" style="' + selectedStyle + 'border-radius:11px;padding:12px 14px;margin-bottom:10px;background:' + bg + '22;cursor:pointer;transition:box-shadow .2s,border .15s">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
            '<span style="font-weight:800;font-size:14px;color:#1A1A2E">' + (d.numero||'—') + '</span>' +
            '<span style="background:' + bg + ';color:' + color + ';border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700">' + icon + ' ' + label + '</span>' +
            '<button id="tr2-notif-print-' + d.id + '" style="background:#003087;color:#fff;border:none;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">🖨️</button>' +
          '</div>' +
          '<div style="font-size:12px;color:#64748b;margin-bottom:4px">' + formatDate(d.dateDemande) + ' — ' + (d.matricule||'') + ' ' + (d.marque||'') + '</div>' +
          '<div style="font-size:13px;color:#374151;line-height:1.4">' + (d.natureIntervention||'') + '</div>' +
          extra + clickHint + validPanel +
        '</div>';
      }).join('');

      // ── Événements clic sur les cartes ──────────────────────
      demandes.forEach(function(d) {
        var card = listEl.querySelector('[data-notif-id="' + d.id + '"]');
        if (!card) return;

        // Bouton impression
        var btnPrintNotif = document.getElementById('tr2-notif-print-' + d.id);
        if (btnPrintNotif) btnPrintNotif.addEventListener('click', function(e) {
          e.stopPropagation();
          printDemandeShared(d);
        });

        // Clic sur la carte → sélectionner / désélectionner
        card.addEventListener('click', function(e) {
          // Ne pas déclencher si clic sur un bouton dans la carte
          if (e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA') return;
          _notifSelected = (_notifSelected === d.id) ? null : d.id;
          renderNotifScreen(nom);
        });

        // Actions validateur
        if (!isValidateur || d.statut !== 'EN ATTENTE') return;

        var btnOk = document.getElementById('tr2-notif-vok-' + d.id);
        var btnKo = document.getElementById('tr2-notif-vko-' + d.id);
        var rWrap = document.getElementById('tr2-notif-reject-wrap-' + d.id);
        var rConf = document.getElementById('tr2-notif-rconf-' + d.id);

        if (btnOk) btnOk.addEventListener('click', function(e) {
          e.stopPropagation();
          notifValidaterAction(d.id, 'VALIDÉE', '', nom);
        });

        if (btnKo) btnKo.addEventListener('click', function(e) {
          e.stopPropagation();
          if (rWrap) rWrap.style.display = rWrap.style.display === 'none' ? '' : 'none';
          if (btnOk) btnOk.disabled = rWrap && rWrap.style.display !== 'none';
        });

        if (rConf) rConf.addEventListener('click', function(e) {
          e.stopPropagation();
          var motif = (document.getElementById('tr2-notif-rtxt-' + d.id) || {}).value || '';
          notifValidaterAction(d.id, 'REJETÉE', motif, nom);
        });
      });
    }

    // ── Action valider/rejeter depuis l'écran notif ──────────
    function notifValidaterAction(id, newStatut, comment, nom) {
      // BLOC ADDITIF — SYNCHRO : on relit le serveur avant d'écrire la décision,
      // pour ne pas écraser une demande/réponse arrivée entretemps d'un autre poste.
      function doAction() {
        var data = getData();
        if (!data) return;
        var d = (data.demandesTravaux || []).find(function(x){ return x.id === id; });
        if (!d) return;
        d.statut         = newStatut;
        d.commentaire    = comment || d.commentaire || '';
        d.dateTraitement = new Date().toISOString();
        var sess = getValidSess ? getValidSess() : null;
        d.validePar      = sess ? sess.nom : 'Validateur';
        d.valideParTitre = sess ? getTitreValidateur(sess.nom) : '';
        saveData();
        _notifSelected = null;
        if (window.parcAuto && typeof window.parcAuto.showToast === 'function') {
          window.parcAuto.showToast(
            newStatut === 'VALIDÉE' ? '✅ Demande ' + (d.numero||'') + ' validée' : '❌ Demande ' + (d.numero||'') + ' rejetée',
            newStatut === 'VALIDÉE' ? 'success' : 'error'
          );
        }
        renderNotifScreen(nom);
      }
      if (typeof window._tr2FetchAndInject === 'function') {
        window._tr2FetchAndInject(doAction);
      } else {
        doAction();
      }
      // FIN BLOC ADDITIF
    }

    // Invalider les anciennes sessions sans nom utilisateur
    (function() {
      var sess = getSess();
      if (sess && !sess.nom) delSess();
    })();

    window.openTravauxModal = function() {
      document.getElementById('tr2-overlay').classList.add('open');
      var sess = getSess();
      if (sess) {
        document.getElementById('tr2-date').value = new Date().toISOString().slice(0,10);
        if (sess.nom) document.getElementById('tr2-nom').value = sess.nom;
        // BLOC ADDITIF — Pré-remplir division/subdivision à l'ouverture
        var _oi = TRAVAUX_USER_INFO[sess.nom] || {};
        var _od = document.getElementById('tr2-div');
        var _os = document.getElementById('tr2-subdiv');
        if (_od && _oi.division)    { _od.value = _oi.division;    _od.readOnly = true; _od.style.background = '#f1f5f9'; _od.style.color = '#374151'; }
        if (_os && _oi.subdivision) { _os.value = _oi.subdivision; _os.readOnly = true; _os.style.background = '#f1f5f9'; _os.style.color = '#374151'; }
        // FIN BLOC ADDITIF
        // BLOC ADDITIF — Restreindre le champ matricule aux véhicules autorisés (session existante)
        updateMatriculeField(sess.nom);
        // FIN BLOC ADDITIF
        // Vérifier si le demandeur a des demandes existantes → afficher statuts
        var data = getData();
        var hasPrev = data && data.demandesTravaux && data.demandesTravaux.some(function(d){ return d.nomDemandeur === sess.nom; });
        if (hasPrev) {
          renderNotifScreen(sess.nom);
          trScreen('notif');
        } else {
          trScreen('form');
          setTimeout(function(){ document.getElementById('tr2-mat').focus(); }, 100);
        }
      } else {
        trScreen('login');
        document.getElementById('tr2-pwd').value = '';
        document.getElementById('tr2-login-err').classList.remove('show');
        setTimeout(function(){ document.getElementById('tr2-pwd').focus(); }, 100);
      }
    };

    window.closeTravauxModal = function() {
      document.getElementById('tr2-overlay').classList.remove('open');
    };

    // Fermer
    document.getElementById('tr2-close').addEventListener('click', window.closeTravauxModal);
    document.getElementById('tr2-overlay').addEventListener('click', function(e) {
      if (e.target.id === 'tr2-overlay') window.closeTravauxModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && document.getElementById('tr2-overlay').classList.contains('open'))
        window.closeTravauxModal();
    });

    // Login
    function doLogin() {
      var pwd = document.getElementById('tr2-pwd').value.trim();
      var err = document.getElementById('tr2-login-err');
      var nom = resolveUser(pwd, TRAVAUX_USERS, 'travauxPasswords');
      if (nom) {
        setSess(nom);
        err.classList.remove('show');
        document.getElementById('tr2-date').value = new Date().toISOString().slice(0,10);
        document.getElementById('tr2-nom').value = nom;
        // BLOC ADDITIF — Pré-remplir division et subdivision
        var _info = TRAVAUX_USER_INFO[nom] || {};
        var _divEl    = document.getElementById('tr2-div');
        var _subdivEl = document.getElementById('tr2-subdiv');
        if (_divEl    && _info.division)    { _divEl.value    = _info.division;    _divEl.readOnly    = true; _divEl.style.background    = '#f1f5f9'; _divEl.style.color = '#374151'; }
        if (_subdivEl && _info.subdivision) { _subdivEl.value = _info.subdivision; _subdivEl.readOnly = true; _subdivEl.style.background = '#f1f5f9'; _subdivEl.style.color = '#374151'; }
        // FIN BLOC ADDITIF
        // BLOC ADDITIF — Restreindre le champ matricule aux véhicules autorisés
        updateMatriculeField(nom);
        // FIN BLOC ADDITIF
        trScreen('form');
        setTimeout(function(){ document.getElementById('tr2-mat').focus(); }, 100);
      } else {
        err.textContent = 'Mot de passe incorrect. Veuillez réessayer.';
        err.classList.add('show');
        document.getElementById('tr2-pwd').value = '';
      }
    }
    document.getElementById('tr2-login-btn').addEventListener('click', doLogin);
    document.getElementById('tr2-pwd').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') doLogin();
    });

    // Verrouiller
    document.getElementById('tr2-lock-btn').addEventListener('click', function() {
      delSess(); trScreen('login');
      document.getElementById('tr2-pwd').value = '';
    });

    // 🚪 Déconnexion depuis écran formulaire
    document.getElementById('tr2-form-logout-btn').addEventListener('click', function() {
      if (!confirm('Se déconnecter ? Vous devrez entrer votre mot de passe à nouveau.')) return;
      delSess();
      document.getElementById('tr2-pwd').value = '';
      document.getElementById('tr2-login-err').classList.remove('show');
      trScreen('login');
      setTimeout(function(){ document.getElementById('tr2-pwd').focus(); }, 100);
    });

    // 🚪 Déconnexion depuis écran "Mes Demandes"
    document.getElementById('tr2-notif-logout-btn').addEventListener('click', function() {
      if (!confirm('Se déconnecter ? Vous devrez entrer votre mot de passe à nouveau.')) return;
      delSess();
      document.getElementById('tr2-pwd').value = '';
      document.getElementById('tr2-login-err').classList.remove('show');
      trScreen('login');
      setTimeout(function(){ document.getElementById('tr2-pwd').focus(); }, 100);
    });

    // Changer mot de passe utilisateur
    document.getElementById('tr2-chpwd-btn').addEventListener('click', function() {
      var sess = getSess();
      if (!sess || !sess.nom) return;
      showChangePwdModal(sess.nom, 'travauxPasswords');
    });

    // 📁 Bouton Historique depuis l'écran formulaire
    document.getElementById('tr2-hist-btn').addEventListener('click', function() {
      var sess = getSess();
      if (sess && sess.nom) {
        renderNotifScreen(sess.nom);
        trScreen('notif');
      }
    });

    // BLOC ADDITIF — Polling demandeur : détecte validation/réponse chef garage
    var _demPollPrev = {};
    var _demPollFirstRun = true;
    setInterval(function() {
      try {
      var sess = getSess();
      if (!sess || !sess.nom) return;
      if (typeof window._tr2FetchAndInject !== 'function') return;
      window._tr2FetchAndInject(function() {
        var data = getData();
        var mesDemandes = (data && data.demandesTravaux||[]).filter(function(d){ return d.nomDemandeur===sess.nom; });
        var changed = false;
        var lastChangeMsg = '';
        mesDemandes.forEach(function(d) {
          var prev = _demPollPrev[d.id] || {};
          // Changement de statut (ignoré au tout premier passage pour éviter un faux positif)
          if (!_demPollFirstRun && prev.statut && prev.statut !== d.statut) {
            changed = true;
            if (d.statut === 'VALIDÉE') lastChangeMsg = '✅ Demande ' + d.numero + ' validée par ' + (d.validateur||'le validateur');
            else if (d.statut === 'REJETÉE') lastChangeMsg = '❌ Demande ' + d.numero + ' rejetée';
            else lastChangeMsg = 'ℹ️ Demande ' + d.numero + ' mise à jour';
            bipAlert3(d.statut === 'VALIDÉE' ? 'valid' : 'new');
          }
          // Nouvelle réponse chef garage
          if (!_demPollFirstRun && prev.cgReponse !== undefined && prev.cgReponse !== d.cgReponse && d.cgReponse) {
            changed = true;
            lastChangeMsg = '🔧 Nouvelle réponse du Chef Garage sur ' + d.numero;
            bipAlert3('new');
          }
          _demPollPrev[d.id] = { statut: d.statut, cgReponse: d.cgReponse };
        });
        _demPollFirstRun = false;
        if (changed) {
          // BLOC ADDITIF — rafraîchir l'écran quel que soit l'écran actif (form ou notif)
          var notifScreen = document.getElementById('tr2-sc-notif');
          var isNotifVisible = notifScreen && notifScreen.style.display !== 'none';
          if (isNotifVisible) {
            renderNotifScreen(sess.nom);
          }
          // Toast visuel, visible même si l'utilisateur est sur le formulaire ou ailleurs dans l'app
          if (window.parcAuto && typeof window.parcAuto.showToast === 'function' && lastChangeMsg) {
            window.parcAuto.showToast(lastChangeMsg, 'success');
          }
          // FIN BLOC ADDITIF
        }
      });
      } catch(e) { console.warn('[TR2 poll demandeur]', e); }
    }, 15000);
    // FIN BLOC ADDITIF — Polling demandeur

    // Boutons écran notification (BLOC ADDITIF)
    document.getElementById('tr2-notif-close').addEventListener('click', window.closeTravauxModal);

        // ⬅️ Bouton Retour au formulaire depuis l'historique
    document.getElementById('tr2-notif-back-btn').addEventListener('click', function() {
      trScreen('form');
      setTimeout(function(){ document.getElementById('tr2-div').focus(); }, 100);
    });

    // BLOC ADDITIF — Bouton Actualiser (rechargement forcé depuis Gist/localStorage)
    document.getElementById('tr2-notif-refresh-btn').addEventListener('click', function() {
      var btn = document.getElementById('tr2-notif-refresh-btn');
      var sess = getSess();
      if (!sess || !sess.nom) return;

      // Animation pendant le chargement
      btn.disabled = true;
      btn.textContent = '⏳ Chargement…';

      var pa = window.parcAuto;

      function afterRefresh(fromGist) {
        renderNotifScreen(sess.nom);
        btn.disabled = false;
        btn.textContent = '🔄 Actualiser';
        if (pa && typeof pa.showToast === 'function') {
          pa.showToast(fromGist ? '✅ Données actualisées depuis le serveur' : '✅ Données actualisées (local)', 'success');
        }
      }

      function refreshFromLocalStorage() {
        try {
          var raw = localStorage.getItem('parcAutoData_v3');
          if (raw) {
            var parsed = JSON.parse(raw);
            if (pa && pa.data && parsed && parsed.demandesTravaux) {
              pa.data.demandesTravaux = parsed.demandesTravaux;
            }
          }
        } catch(e) {}
        afterRefresh(false);
      }

      // Chercher l'URL du Worker dans toutes les propriétés connues de parcAuto
      var workerUrl = null;
      if (pa) {
        workerUrl = pa.WORKER_URL || pa.workerUrl || pa._workerUrl || pa.apiUrl || pa.API_URL || null;
        // Chercher aussi dans la config globale
        if (!workerUrl && window.PARC_CONFIG) {
          workerUrl = window.PARC_CONFIG.workerUrl || window.PARC_CONFIG.WORKER_URL || null;
        }
        // Dernière tentative : parcourir les clés de parcAuto pour trouver une URL workers.dev
        if (!workerUrl) {
          Object.keys(pa).forEach(function(k) {
            if (!workerUrl && typeof pa[k] === 'string' && pa[k].includes('workers.dev')) {
              workerUrl = pa[k];
            }
          });
        }
      }

      if (workerUrl) {
        var sep = workerUrl.includes('?') ? '&' : '?';
        fetch(workerUrl + sep + '_nc=' + Date.now(), { cache: 'no-store' })
          .then(function(r) { return r.json(); })
          .then(function(freshData) {
            if (pa && pa.data && freshData) {
              if (freshData.demandesTravaux) pa.data.demandesTravaux = freshData.demandesTravaux;
              // Sync localStorage aussi
              try {
                var stored = JSON.parse(localStorage.getItem('parcAutoData_v3') || '{}');
                stored.demandesTravaux = freshData.demandesTravaux || stored.demandesTravaux;
                localStorage.setItem('parcAutoData_v3', JSON.stringify(stored));
              } catch(e) {}
            }
            afterRefresh(true);
          })
          .catch(function() { refreshFromLocalStorage(); });
      } else {
        refreshFromLocalStorage();
      }
    });
    // FIN BLOC ADDITIF — Bouton Actualiser

    // Effacer l'historique
    document.getElementById('tr2-notif-clear-btn').addEventListener('click', function() {
      var sess = getSess();
      if (!sess || !sess.nom) return;
      if (!confirm('Supprimer toutes vos demandes de l\'historique ? Cette action est irréversible.')) return;
      var data = getData();
      if (!data) return;
      data.demandesTravaux = (data.demandesTravaux || []).filter(function(d) {
        return d.nomDemandeur !== sess.nom;
      });
      saveData();
      _notifSelected = null;
      renderNotifScreen(sess.nom);
      if (window.parcAuto && typeof window.parcAuto.showToast === 'function') {
        window.parcAuto.showToast('🗑️ Historique effacé', 'info');
      }
    });

    document.getElementById('tr2-notif-new-btn').addEventListener('click', function() {
      var sess = getSess();
      ['tr2-div','tr2-subdiv','tr2-marq','tr2-km','tr2-nat'].forEach(function(id) {
        document.getElementById(id).value = '';
      });
      // Réinitialiser le matricule (recréer select ou vider)
      var matEl = document.getElementById('tr2-mat');
      if (matEl) matEl.value = matEl.tagName === 'SELECT' ? '' : '';
      document.getElementById('tr2-nom').value = sess && sess.nom ? sess.nom : '';
      document.getElementById('tr2-date').value = new Date().toISOString().slice(0,10);
      document.getElementById('tr2-form-err').classList.remove('show');
      if (sess && sess.nom) updateMatriculeField(sess.nom);
      trScreen('form');
      setTimeout(function(){ document.getElementById('tr2-div').focus(); }, 100);
    });

    // Soumettre
    document.getElementById('tr2-submit-btn').addEventListener('click', function() {
      var ids  = ['tr2-nom','tr2-div','tr2-subdiv','tr2-mat','tr2-marq','tr2-date','tr2-km','tr2-nat'];
      var vals = {};
      var ok   = true;
      ids.forEach(function(id) {
        var el = document.getElementById(id);
        var v  = el.value.trim();
        if (!v) { el.classList.add('err'); ok = false; }
        else      el.classList.remove('err');
        vals[id] = v;
      });
      var errEl = document.getElementById('tr2-form-err');
      if (!ok) {
        errEl.textContent = 'Tous les champs sont obligatoires.';
        errEl.classList.add('show');
        return;
      }
      errEl.classList.remove('show');

      // Attendre que parcAuto soit prêt
      var waitCount = 0;
      function trySubmit() {
        var data = getData();
        if (!data && waitCount < 20) { waitCount++; setTimeout(trySubmit, 300); return; }
        if (!data) {
          errEl.textContent = 'Application non prête. Rechargez la page.';
          errEl.classList.add('show');
          return;
        }
        // BLOC ADDITIF — Vérification sécurité : le matricule doit être autorisé pour cet utilisateur
        var sessCheck = getSess();
        if (sessCheck && sessCheck.nom) {
          var allowedVehicles = getVehiclesForUser(sessCheck.nom);
          if (allowedVehicles && allowedVehicles.length > 0) {
            var matSaisi = vals['tr2-mat'];
            if (allowedVehicles.indexOf(matSaisi) === -1) {
              errEl.textContent = '⛔ Véhicule non autorisé. Vous ne pouvez soumettre une demande que pour vos véhicules assignés.';
              errEl.classList.add('show');
              return;
            }
          }
        }
        // FIN BLOC ADDITIF
        // BLOC ADDITIF — SYNCHRO : récupérer les données fraîches du serveur juste avant
        // d'écrire, pour ne pas écraser une demande/validation faite entretemps par
        // quelqu'un d'autre (corrige la désynchronisation demandeur ↔ validateur).
        function doPush() {
          var freshData = getData() || data;
          if (!freshData.demandesTravaux) freshData.demandesTravaux = [];
          var num = nextNumero();
          var demande = {
            id:                 'dt_' + Date.now(),
            numero:             num,
            nomDemandeur:       vals['tr2-nom'],
            division:           vals['tr2-div'],
            subdivision:        vals['tr2-subdiv'],
            matricule:          vals['tr2-mat'],
            marque:             vals['tr2-marq'],
            dateDemande:        vals['tr2-date'],
            indexKm:            vals['tr2-km'],
            natureIntervention: vals['tr2-nat'],
            statut:             'EN ATTENTE',
            dateCreation:       new Date().toISOString(),
            commentaire:        ''
          };
          freshData.demandesTravaux.push(demande);
          saveData();
          bipAlert3('new'); // 🔔 bip × 3 nouvelle demande
          document.getElementById('tr2-num-ok').textContent = 'N° ' + num;
          // Afficher l'écran succès puis rediriger vers notif après 2s
          trScreen('ok');
          setTimeout(function() {
            var s = getSess();
            if (s && s.nom) { renderNotifScreen(s.nom); trScreen('notif'); }
          }, 2200);
        }
        if (typeof window._tr2FetchAndInject === 'function') {
          window._tr2FetchAndInject(doPush);
        } else {
          doPush();
        }
        // FIN BLOC ADDITIF
      }
      trySubmit();
    });

    // Nouvelle demande (depuis écran succès)
    document.getElementById('tr2-new-btn').addEventListener('click', function() {
      ['tr2-div','tr2-subdiv','tr2-marq','tr2-km','tr2-nat'].forEach(function(id) {
        var el = document.getElementById(id);
        el.value = '';
        // BLOC ADDITIF — remettre les champs division/subdivision en lecture seule si session active
        if (id === 'tr2-div' || id === 'tr2-subdiv') {
          var sessR = getSess();
          var infoR = sessR ? (TRAVAUX_USER_INFO[sessR.nom] || {}) : {};
          var valR  = id === 'tr2-div' ? infoR.division : infoR.subdivision;
          if (valR) { el.value = valR; el.readOnly = true; el.style.background = '#f1f5f9'; el.style.color = '#374151'; }
          else      { el.readOnly = false; el.style.background = ''; el.style.color = ''; }
        }
        // FIN BLOC ADDITIF
      });
      // Réinitialiser le champ matricule selon les droits
      var sess = getSess();
      var matEl = document.getElementById('tr2-mat');
      if (matEl) matEl.value = matEl.tagName === 'SELECT' ? '' : '';
      document.getElementById('tr2-nom').value = sess && sess.nom ? sess.nom : '';
      document.getElementById('tr2-date').value = new Date().toISOString().slice(0,10);
      document.getElementById('tr2-form-err').classList.remove('show');
      if (sess && sess.nom) updateMatriculeField(sess.nom);
      trScreen('form');
      setTimeout(function(){ document.getElementById('tr2-div').focus(); }, 100);
    });
  }

  // ══════════════════════════════════════════════════════════
  // PARTIE 2 — TABLEAU DE BORD ADMIN (admin.html)
  // ══════════════════════════════════════════════════════════
  function initAdminTab() {

    // ── Injecter l'onglet dans la navigation sidebar ────────
    function injectNavItem() {
      var navItems = document.querySelectorAll('.nav-item[data-nav]');
      if (!navItems.length) { setTimeout(injectNavItem, 500); return; }

      // Ne pas injecter deux fois
      if (document.querySelector('.nav-item[data-nav="travaux"]')) return;

      var lastNav = navItems[navItems.length - 1];
      var navItem = document.createElement('div');
      navItem.className = 'nav-item';
      navItem.setAttribute('data-nav', 'travaux');
      navItem.innerHTML = `<span class="nav-icon">🔧</span>
        <span class="nav-label">Demandes Travaux<span class="tr2-nav-badge" id="tr2-nav-badge" style="display:none">0</span></span>`;
      lastNav.parentNode.insertBefore(navItem, lastNav.nextSibling);

      navItem.addEventListener('click', function() {
        if (window.parcAuto && typeof window.parcAuto.showTab === 'function') {
          window.parcAuto.showTab('travaux');
        }
        renderAdminTab();
      });
    }

    // ── Injecter le contenu de l'onglet ────────────────────
    function injectTabContent() {
      if (document.getElementById('tab-travaux')) return;
      var tabContainer = document.querySelector('.tab-content')
        || document.querySelector('#tab-dashboard')
        || document.querySelector('[id^="tab-"]');
      if (!tabContainer) { setTimeout(injectTabContent, 500); return; }

      var tabEl = document.createElement('div');
      tabEl.id        = 'tab-travaux';
      tabEl.className = 'tab-content';
      tabEl.innerHTML = `
        <div class="tr2-admin-header">
          <h2>🔧 Demandes de Travaux</h2>
          <button class="tr2-export-btn" id="tr2-export-btn">📊 Exporter Excel</button>
        </div>

        <div class="tr2-stats-bar" id="tr2-stats-bar">
          <div class="tr2-stat-card total">
            <div class="num" id="tr2-st-total">0</div>
            <div class="lbl">Total</div>
          </div>
          <div class="tr2-stat-card pending">
            <div class="num" id="tr2-st-pending">0</div>
            <div class="lbl">En attente</div>
          </div>
          <div class="tr2-stat-card valid">
            <div class="num" id="tr2-st-valid">0</div>
            <div class="lbl">Validées</div>
          </div>
          <div class="tr2-stat-card reject">
            <div class="num" id="tr2-st-reject">0</div>
            <div class="lbl">Rejetées</div>
          </div>
        </div>

        <div class="tr2-filter-bar">
          <button class="tr2-filter-btn active" data-filter="TOUS">Toutes</button>
          <button class="tr2-filter-btn" data-filter="EN ATTENTE">⏳ En attente</button>
          <button class="tr2-filter-btn" data-filter="VALIDÉE">✅ Validées</button>
          <button class="tr2-filter-btn" data-filter="REJETÉE">❌ Rejetées</button>
          <input type="text" class="tr2-search" id="tr2-search" placeholder="🔍 Rechercher…">
        </div>

        <div class="tr2-table-wrap">
          <table class="tr2-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Date</th>
                <th>Demandeur</th>
                <th>Division</th>
                <th>Subdivision</th>
                <th>Matricule</th>
                <th>Marque</th>
                <th>Km</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="tr2-tbody"></tbody>
          </table>
        </div>`;
      tabContainer.parentNode.insertBefore(tabEl, tabContainer.nextSibling);

      // Filtres
      var currentFilter = 'TOUS';
      tabEl.querySelectorAll('.tr2-filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          tabEl.querySelectorAll('.tr2-filter-btn').forEach(function(b){ b.classList.remove('active'); });
          btn.classList.add('active');
          currentFilter = btn.dataset.filter;
          renderTable(currentFilter, document.getElementById('tr2-search').value);
        });
      });
      document.getElementById('tr2-search').addEventListener('input', function() {
        renderTable(currentFilter, this.value);
      });

      // Export Excel
      document.getElementById('tr2-export-btn').addEventListener('click', exportExcel);
    }

    // ── Rendu du tableau ────────────────────────────────────
    var _currentFilter = 'TOUS';
    var _currentSearch = '';

    function renderTable(filter, search) {
      _currentFilter = filter || 'TOUS';
      _currentSearch = search || '';
      var data = getData();
      var demandes = (data && data.demandesTravaux) ? data.demandesTravaux.slice().reverse() : [];

      if (_currentFilter !== 'TOUS') {
        demandes = demandes.filter(function(d) { return d.statut === _currentFilter; });
      }
      if (_currentSearch.trim()) {
        var q = _currentSearch.trim().toLowerCase();
        demandes = demandes.filter(function(d) {
          return (d.numero||'').toLowerCase().includes(q)
            || (d.nomDemandeur||'').toLowerCase().includes(q)
            || (d.matricule||'').toLowerCase().includes(q)
            || (d.division||'').toLowerCase().includes(q)
            || (d.marque||'').toLowerCase().includes(q);
        });
      }

      var tbody = document.getElementById('tr2-tbody');
      if (!tbody) return;

      if (!demandes.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="tr2-empty">Aucune demande trouvée</td></tr>';
        return;
      }

      tbody.innerHTML = demandes.map(function(d) {
        var badgeCls = d.statut === 'VALIDÉE' ? 'validee' : d.statut === 'REJETÉE' ? 'rejetee' : 'en-attente';
        var badgeTxt = d.statut === 'VALIDÉE' ? '✅ Validée' : d.statut === 'REJETÉE' ? '❌ Rejetée' : '⏳ En attente';
        var km = parseInt(d.indexKm||0).toLocaleString('fr-FR');
        var actions = d.statut === 'EN ATTENTE'
          ? `<div class="tr2-action-btns">
               <button class="tr2-act tr2-act-detail" data-id="${d.id}">👁 Voir</button>
               <button class="tr2-act tr2-act-valid"  data-id="${d.id}">✅</button>
               <button class="tr2-act tr2-act-reject" data-id="${d.id}">❌</button>
             </div>`
          : `<button class="tr2-act tr2-act-detail" data-id="${d.id}">👁 Voir</button>`;
        return `<tr>
          <td><strong style="color:#E67E22">${d.numero||'-'}</strong></td>
          <td style="white-space:nowrap">${formatDate(d.dateDemande)}</td>
          <td>${d.nomDemandeur||'-'}</td>
          <td>${d.division||'-'}</td>
          <td>${d.subdivision||'-'}</td>
          <td><strong>${d.matricule||'-'}</strong></td>
          <td>${d.marque||'-'}</td>
          <td style="white-space:nowrap">${km} km</td>
          <td><span class="tr2-badge ${badgeCls}">${badgeTxt}</span></td>
          <td>${actions}</td>
        </tr>`;
      }).join('');

      // Events boutons
      tbody.querySelectorAll('.tr2-act-detail').forEach(function(btn) {
        btn.addEventListener('click', function() { openDetail(btn.dataset.id); });
      });
      tbody.querySelectorAll('.tr2-act-valid').forEach(function(btn) {
        btn.addEventListener('click', function() { changeStatut(btn.dataset.id, 'VALIDÉE', ''); });
      });
      tbody.querySelectorAll('.tr2-act-reject').forEach(function(btn) {
        btn.addEventListener('click', function() { openDetail(btn.dataset.id, 'reject'); });
      });
    }

    function renderStats() {
      var data = getData();
      var demandes = (data && data.demandesTravaux) ? data.demandesTravaux : [];
      var pending = demandes.filter(function(d){ return d.statut === 'EN ATTENTE'; }).length;
      var valid   = demandes.filter(function(d){ return d.statut === 'VALIDÉE'; }).length;
      var reject  = demandes.filter(function(d){ return d.statut === 'REJETÉE'; }).length;

      setText('tr2-st-total',   demandes.length);
      setText('tr2-st-pending', pending);
      setText('tr2-st-valid',   valid);
      setText('tr2-st-reject',  reject);

      // Badge nav
      var badge = document.getElementById('tr2-nav-badge');
      if (badge) {
        badge.style.display = pending > 0 ? '' : 'none';
        badge.textContent   = pending;
      }
    }

    function setText(id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = val;
    }

    function renderAdminTab() {
      renderStats();
      renderTable(_currentFilter, _currentSearch);
    }

    // ── Modale détail ───────────────────────────────────────
    var detailOverlay = document.createElement('div');
    detailOverlay.id = 'tr2-detail-overlay';
    detailOverlay.innerHTML = `
      <div id="tr2-detail-modal">
        <div class="tr2-detail-hd">
          <h3 id="tr2-detail-titre">Détail de la demande</h3>
          <button class="tr2-x" id="tr2-detail-close">✕</button>
        </div>
        <div class="tr2-detail-bd" id="tr2-detail-bd"></div>
        <div class="tr2-detail-actions" id="tr2-detail-actions"></div>
      </div>`;
    document.body.appendChild(detailOverlay);

    document.getElementById('tr2-detail-close').addEventListener('click', function() {
      detailOverlay.classList.remove('open');
    });
    detailOverlay.addEventListener('click', function(e) {
      if (e.target === detailOverlay) detailOverlay.classList.remove('open');
    });

    function openDetail(id, mode) {
      var data = getData();
      var d = (data && data.demandesTravaux || []).find(function(x){ return x.id === id; });
      if (!d) return;

      document.getElementById('tr2-detail-titre').textContent = 'Demande ' + (d.numero||'');

      var km = parseInt(d.indexKm||0).toLocaleString('fr-FR');
      var statutHtml = d.statut === 'VALIDÉE'
        ? '<span class="tr2-badge validee">✅ Validée</span>'
        : d.statut === 'REJETÉE'
        ? '<span class="tr2-badge rejetee">❌ Rejetée</span>'
        : '<span class="tr2-badge en-attente">⏳ En attente</span>';

      document.getElementById('tr2-detail-bd').innerHTML = `
        <div class="tr2-info-row"><div class="tr2-info-lbl">Demandeur</div><div class="tr2-info-val">${d.nomDemandeur||'-'}</div></div>
        <div class="tr2-info-row"><div class="tr2-info-lbl">Division</div><div class="tr2-info-val">${d.division||'-'}</div></div>
        <div class="tr2-info-row"><div class="tr2-info-lbl">Subdivision</div><div class="tr2-info-val">${d.subdivision||'-'}</div></div>
        <div class="tr2-info-row"><div class="tr2-info-lbl">Matricule</div><div class="tr2-info-val"><strong>${d.matricule||'-'}</strong></div></div>
        <div class="tr2-info-row"><div class="tr2-info-lbl">Marque</div><div class="tr2-info-val">${d.marque||'-'}</div></div>
        <div class="tr2-info-row"><div class="tr2-info-lbl">Date demande</div><div class="tr2-info-val">${formatDate(d.dateDemande)}</div></div>
        <div class="tr2-info-row"><div class="tr2-info-lbl">Index km</div><div class="tr2-info-val">${km} km</div></div>
        <div class="tr2-info-row"><div class="tr2-info-lbl">Statut</div><div class="tr2-info-val">${statutHtml}</div></div>
        <div class="tr2-nature-box">
          <div class="lbl">Nature de l'intervention</div>
          <div class="val">${d.natureIntervention||'-'}</div>
        </div>
        ${d.commentaire ? `<div class="tr2-info-row"><div class="tr2-info-lbl">Commentaire</div><div class="tr2-info-val">${d.commentaire}</div></div>` : ''}
        ${d.statut === 'EN ATTENTE' ? `
          <div class="tr2-f" style="margin-top:12px">
            <label>Commentaire (optionnel)</label>
            <textarea class="tr2-comment-box" id="tr2-comment-input" placeholder="Ajouter un commentaire…"></textarea>
          </div>` : ''}`;

      var actionsEl = document.getElementById('tr2-detail-actions');
      if (d.statut === 'EN ATTENTE') {
        actionsEl.innerHTML = `
          <button class="tr2-det-btn tr2-det-valid"  id="tr2-det-valid-btn">✅ Valider</button>
          <button class="tr2-det-btn tr2-det-reject" id="tr2-det-reject-btn">❌ Rejeter</button>
          <button class="tr2-det-btn tr2-det-print"   id="tr2-det-print-btn">🖨️ Imprimer</button>
          <button class="tr2-det-btn tr2-det-capture" id="tr2-det-capture-btn">📸 Image</button>
          <button class="tr2-det-btn tr2-det-close"   id="tr2-det-close-btn">Fermer</button>`;
        document.getElementById('tr2-det-valid-btn').addEventListener('click', function() {
          var comment = (document.getElementById('tr2-comment-input')||{}).value || '';
          changeStatut(id, 'VALIDÉE', comment);
          detailOverlay.classList.remove('open');
        });
        document.getElementById('tr2-det-reject-btn').addEventListener('click', function() {
          var comment = (document.getElementById('tr2-comment-input')||{}).value || '';
          changeStatut(id, 'REJETÉE', comment);
          detailOverlay.classList.remove('open');
        });
        document.getElementById('tr2-det-close-btn').addEventListener('click', function() {
          detailOverlay.classList.remove('open');
        });
        document.getElementById('tr2-det-print-btn').addEventListener('click', function() { printDemandeShared(d); });
        document.getElementById('tr2-det-capture-btn').addEventListener('click', function() { captureDemande(d); });
        // Focus automatique si mode rejet
        if (mode === 'reject') {
          setTimeout(function() {
            var ci = document.getElementById('tr2-comment-input');
            if (ci) ci.focus();
          }, 150);
        }
      } else {
        actionsEl.innerHTML = `
          <button class="tr2-det-btn tr2-det-print"   id="tr2-det-print-btn">🖨️ Imprimer</button>
          <button class="tr2-det-btn tr2-det-capture" id="tr2-det-capture-btn">📸 Image</button>
          <button class="tr2-det-btn tr2-det-close"   id="tr2-det-close-btn">Fermer</button>`;
        document.getElementById('tr2-det-close-btn').addEventListener('click', function() {
          detailOverlay.classList.remove('open');
        });
        document.getElementById('tr2-det-capture-btn').addEventListener('click', function() { captureDemande(d); });
        var printBtnClosed = document.getElementById('tr2-det-print-btn');
        if (printBtnClosed) printBtnClosed.addEventListener('click', function() { printDemandeShared(d); });
      }

      detailOverlay.classList.add('open');
    }

    // BLOC ADDITIF — Capture JPEG de la demande
    function captureDemande(d) {
      // Charger html2canvas si pas déjà chargé
      function doCapture() {
        var km = parseInt(d.indexKm||0).toLocaleString('fr-FR');
        var statutColor = d.statut === 'VALIDÉE' ? '#27AE60' : d.statut === 'REJETÉE' ? '#C0392B' : '#E67E22';
        var statutLabel = d.statut === 'VALIDÉE' ? '✅ Validée' : d.statut === 'REJETÉE' ? '❌ Rejetée' : '⏳ En attente';
        var now = new Date();
        var dateImpression = now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});

        // Créer un div temporaire hors écran pour le rendu
        var wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:700px;background:#fff;padding:24px;font-family:Arial,sans-serif;color:#1e293b;z-index:-1;';
        wrap.innerHTML =
          '<div style="background:#1A1A2E;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:space-between;margin-bottom:0;">' +
            '<div><div style="font-size:18px;font-weight:700;margin-bottom:3px;">🔧 Demande de Travaux</div><div style="font-size:11px;opacity:.7;">Parc Auto DRT Sfax — Tunisie Telecom</div></div>' +
            '<div style="background:#E67E22;color:#fff;padding:5px 16px;border-radius:20px;font-size:13px;font-weight:700;">' + (d.numero||'') + '</div>' +
          '</div>' +
          '<div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;margin-bottom:16px;">' +
            '<div style="display:flex;border-bottom:1px solid #f1f5f9;">' +
              '<div style="flex:1;padding:10px 14px;"><div style="font-size:9px;text-transform:uppercase;color:#94a3b8;letter-spacing:.5px;margin-bottom:2px;">Demandeur</div><div style="font-size:13px;font-weight:600;">' + (d.nomDemandeur||'-') + '</div></div>' +
              '<div style="flex:1;padding:10px 14px;"><div style="font-size:9px;text-transform:uppercase;color:#94a3b8;letter-spacing:.5px;margin-bottom:2px;">Division</div><div style="font-size:13px;font-weight:600;">' + (d.division||'-') + '</div></div>' +
            '</div>' +
            '<div style="display:flex;border-bottom:1px solid #f1f5f9;">' +
              '<div style="flex:1;padding:10px 14px;"><div style="font-size:9px;text-transform:uppercase;color:#94a3b8;letter-spacing:.5px;margin-bottom:2px;">Matricule</div><div style="font-size:13px;font-weight:600;">' + (d.matricule||'-') + '</div></div>' +
              '<div style="flex:1;padding:10px 14px;"><div style="font-size:9px;text-transform:uppercase;color:#94a3b8;letter-spacing:.5px;margin-bottom:2px;">Marque</div><div style="font-size:13px;font-weight:600;">' + (d.marque||'-') + '</div></div>' +
            '</div>' +
            '<div style="display:flex;border-bottom:1px solid #f1f5f9;">' +
              '<div style="flex:1;padding:10px 14px;"><div style="font-size:9px;text-transform:uppercase;color:#94a3b8;letter-spacing:.5px;margin-bottom:2px;">Date demande</div><div style="font-size:13px;font-weight:600;">' + formatDate(d.dateDemande) + '</div></div>' +
              '<div style="flex:1;padding:10px 14px;"><div style="font-size:9px;text-transform:uppercase;color:#94a3b8;letter-spacing:.5px;margin-bottom:2px;">Index km</div><div style="font-size:13px;font-weight:600;">' + km + ' km</div></div>' +
            '</div>' +
            '<div style="display:flex;">' +
              '<div style="flex:1;padding:10px 14px;"><div style="font-size:9px;text-transform:uppercase;color:#94a3b8;letter-spacing:.5px;margin-bottom:2px;">Statut</div><div style="font-size:13px;font-weight:700;color:' + statutColor + ';">' + statutLabel + '</div></div>' +
              '<div style="flex:1;padding:10px 14px;"><div style="font-size:9px;text-transform:uppercase;color:#94a3b8;letter-spacing:.5px;margin-bottom:2px;">Date création</div><div style="font-size:13px;font-weight:600;">' + formatDate(d.dateCreation) + '</div></div>' +
            '</div>' +
          '</div>' +
          '<div style="background:#FEF3E2;border-left:4px solid #E67E22;padding:12px 16px;margin-bottom:16px;">' +
            '<div style="font-size:9px;text-transform:uppercase;color:#92400e;font-weight:700;margin-bottom:4px;">Nature de l\'intervention</div>' +
            '<div style="font-size:13px;line-height:1.6;">' + (d.natureIntervention||'-') + '</div>' +
          '</div>' +
          (d.commentaire ? '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:16px;"><div style="font-size:9px;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Commentaire / Décision</div><div style="font-size:13px;">' + d.commentaire + '</div></div>' : '') +
          '<div style="text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;">Généré le ' + dateImpression + '<br>Parc Auto DRT Sfax — Tunisie Telecom — Direction Régionale de Sfax</div>';

        document.body.appendChild(wrap);

        html2canvas(wrap, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(function(canvas) {
          document.body.removeChild(wrap);
          var link = document.createElement('a');
          link.download = 'DT-' + (d.numero||d.id||'demande') + '.jpg';
          link.href = canvas.toDataURL('image/jpeg', 0.95);
          link.click();
        }).catch(function(err) {
          document.body.removeChild(wrap);
          console.error('Capture error:', err);
          alert('Erreur lors de la capture. Utilisez Imprimer à la place.');
        });
      }

      // Charger html2canvas si nécessaire
      if (typeof html2canvas === 'undefined') {
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = doCapture;
        s.onerror = function() { alert('Impossible de charger html2canvas. Vérifiez votre connexion.'); };
        document.head.appendChild(s);
      } else {
        doCapture();
      }
    }

    // BLOC ADDITIF — Impression demande (sans popup)
    function printDemande(d) {
      var km = parseInt(d.indexKm||0).toLocaleString('fr-FR');
      var statutColor = d.statut === 'VALIDÉE' ? '#27AE60' : d.statut === 'REJETÉE' ? '#C0392B' : '#E67E22';
      var statutLabel = d.statut === 'VALIDÉE' ? '✅ Validée' : d.statut === 'REJETÉE' ? '❌ Rejetée' : '⏳ En attente';
      var now = new Date();
      var dateImpression = now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});

      // Supprimer ancienne frame si existante
      var old = document.getElementById('tr2-print-frame');
      if (old) old.parentNode.removeChild(old);

      // Créer un div caché qui s'affiche uniquement à l\'impression
      var frame = document.createElement('div');
      frame.id = 'tr2-print-frame';
      frame.style.cssText = 'display:none;';
      frame.innerHTML =
        '<style id="tr2-print-style">' +
        '@media print {' +
          'body > *:not(#tr2-print-frame) { display:none !important; }' +
          '#tr2-print-frame { display:block !important; }' +
          '.tr2-pg { font-family:Arial,sans-serif; color:#1e293b; max-width:700px; margin:0 auto; padding:24px; }' +
          '.tr2-ph { background:#1A1A2E; color:#fff; padding:20px 24px; border-radius:10px 10px 0 0; display:flex; align-items:center; justify-content:space-between; margin-bottom:0; }' +
          '.tr2-ph h1 { font-size:18px; margin:0 0 3px; }' +
          '.tr2-ph p  { font-size:11px; opacity:.7; margin:0; }' +
          '.tr2-pnum { background:#E67E22; color:#fff; padding:5px 16px; border-radius:20px; font-size:13px; font-weight:700; }' +
          '.tr2-psec { border:1px solid #e2e8f0; border-radius:0 0 10px 10px; overflow:hidden; margin-bottom:16px; }' +
          '.tr2-prow { display:flex; border-bottom:1px solid #f1f5f9; }' +
          '.tr2-prow:last-child { border-bottom:none; }' +
          '.tr2-pcell { flex:1; padding:10px 14px; }' +
          '.tr2-plbl { font-size:9px; text-transform:uppercase; color:#94a3b8; letter-spacing:.5px; margin-bottom:2px; }' +
          '.tr2-pval { font-size:13px; font-weight:600; }' +
          '.tr2-pnat { background:#FEF3E2; border-left:4px solid #E67E22; padding:12px 16px; margin-bottom:16px; }' +
          '.tr2-pnat .l { font-size:9px; text-transform:uppercase; color:#92400e; font-weight:700; margin-bottom:4px; }' +
          '.tr2-pnat .v { font-size:13px; line-height:1.6; }' +
          '.tr2-pcom { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; margin-bottom:16px; }' +
          '.tr2-pst  { display:inline-block; padding:3px 12px; border-radius:20px; font-size:11px; font-weight:700; }' +
          '.tr2-pfoot { text-align:center; font-size:9px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:12px; }' +
        '}' +
        '</style>' +
        '<div class="tr2-pg">' +
          '<div class="tr2-ph">' +
            '<div><h1>🔧 Demande de Travaux</h1><p>Parc Auto DRT Sfax — Tunisie Telecom</p></div>' +
            '<div class="tr2-pnum">' + (d.numero||'') + '</div>' +
          '</div>' +
          '<div class="tr2-psec">' +
            '<div class="tr2-prow">' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Demandeur</div><div class="tr2-pval">' + (d.nomDemandeur||'-') + '</div></div>' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Division</div><div class="tr2-pval">' + (d.division||'-') + '</div></div>' +
            '</div>' +
            '<div class="tr2-prow">' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Subdivision</div><div class="tr2-pval">' + (d.subdivision||'-') + '</div></div>' +
              '<div class="tr2-pcell"></div>' +
            '</div>' +
            '<div class="tr2-prow">' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Matricule véhicule</div><div class="tr2-pval">' + (d.matricule||'-') + '</div></div>' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Marque</div><div class="tr2-pval">' + (d.marque||'-') + '</div></div>' +
            '</div>' +
            '<div class="tr2-prow">' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Date de la demande</div><div class="tr2-pval">' + formatDate(d.dateDemande) + '</div></div>' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Index kilométrique</div><div class="tr2-pval">' + km + ' km</div></div>' +
            '</div>' +
            '<div class="tr2-prow">' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Statut</div><div class="tr2-pval"><span class="tr2-pst" style="background:' + statutColor + '22;color:' + statutColor + ';border:1px solid ' + statutColor + '44">' + statutLabel + '</span></div></div>' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Date création</div><div class="tr2-pval">' + formatDate(d.dateCreation) + '</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="tr2-pnat"><div class="l">Nature de l\'intervention demandée</div><div class="v">' + (d.natureIntervention||'-') + '</div></div>' +
          (d.commentaire ? '<div class="tr2-pcom"><div class="tr2-plbl">Commentaire / Décision</div><div style="font-size:13px;margin-top:4px">' + d.commentaire + '</div></div>' : '') +
          '<div class="tr2-pfoot">Imprimé le ' + dateImpression + '<br>Parc Auto DRT Sfax — Tunisie Telecom — Direction Régionale de Sfax</div>' +
        '</div>';

      document.body.appendChild(frame);

      // Utiliser iframe pour contourner le blocage de window.print()
      var iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999;';
      iframe.srcdoc = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
        'body{font-family:Arial,sans-serif;color:#1e293b;margin:0;padding:24px;}' +
        '.tr2-pg{max-width:700px;margin:0 auto;}' +
        '.tr2-ph{background:#1A1A2E;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:space-between;}' +
        '.tr2-ph h1{font-size:18px;margin:0 0 3px;}' +
        '.tr2-ph p{font-size:11px;opacity:.7;margin:0;}' +
        '.tr2-pnum{background:#E67E22;color:#fff;padding:5px 16px;border-radius:20px;font-size:13px;font-weight:700;}' +
        '.tr2-psec{border:1px solid #e2e8f0;border-radius:0 0 10px 10px;overflow:hidden;margin-bottom:16px;}' +
        '.tr2-prow{display:flex;border-bottom:1px solid #f1f5f9;}' +
        '.tr2-prow:last-child{border-bottom:none;}' +
        '.tr2-pcell{flex:1;padding:10px 14px;}' +
        '.tr2-plbl{font-size:9px;text-transform:uppercase;color:#94a3b8;letter-spacing:.5px;margin-bottom:2px;}' +
        '.tr2-pval{font-size:13px;font-weight:600;}' +
        '.tr2-pnat{background:#FEF3E2;border-left:4px solid #E67E22;padding:12px 16px;margin-bottom:16px;}' +
        '.tr2-pnat .l{font-size:9px;text-transform:uppercase;color:#92400e;font-weight:700;margin-bottom:4px;}' +
        '.tr2-pnat .v{font-size:13px;line-height:1.6;}' +
        '.tr2-pcom{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:16px;}' +
        '.tr2-pst{display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;}' +
        '.tr2-pfoot{text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;}' +
        '.no-print{text-align:center;margin-bottom:16px;}' +
        '.print-btn{background:#1A1A2E;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;cursor:pointer;margin-right:8px;}' +
        '.close-btn{background:#f1f5f9;color:#374151;border:none;padding:10px 28px;border-radius:8px;font-size:14px;cursor:pointer;}' +
        '@media print{.no-print{display:none!important;}}' +
        '</style></head><body>' +
        '<div class="no-print">' +
          '<button class="print-btn" onclick="window.print()">\uD83D\uDDA8\uFE0F Lancer l\'impression</button>' +
          '<button class="close-btn" onclick="parent.document.getElementById(\'tr2-iframe-wrap\').remove()">✕ Fermer</button>' +
        '</div>' +
        '<div class="tr2-pg">' +
          '<div class="tr2-ph">' +
            '<div><h1>🔧 Demande de Travaux</h1><p>Parc Auto DRT Sfax — Tunisie Telecom</p></div>' +
            '<div class="tr2-pnum">' + (d.numero||'') + '</div>' +
          '</div>' +
          '<div class="tr2-psec">' +
            '<div class="tr2-prow">' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Demandeur</div><div class="tr2-pval">' + (d.nomDemandeur||'-') + '</div></div>' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Division</div><div class="tr2-pval">' + (d.division||'-') + '</div></div>' +
            '</div>' +
            '<div class="tr2-prow">' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Subdivision</div><div class="tr2-pval">' + (d.subdivision||'-') + '</div></div>' +
              '<div class="tr2-pcell"></div>' +
            '</div>' +
            '<div class="tr2-prow">' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Matricule</div><div class="tr2-pval">' + (d.matricule||'-') + '</div></div>' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Marque</div><div class="tr2-pval">' + (d.marque||'-') + '</div></div>' +
            '</div>' +
            '<div class="tr2-prow">' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Date demande</div><div class="tr2-pval">' + formatDate(d.dateDemande) + '</div></div>' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Index km</div><div class="tr2-pval">' + km + ' km</div></div>' +
            '</div>' +
            '<div class="tr2-prow">' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Statut</div><div class="tr2-pval"><span class="tr2-pst" style="background:' + statutColor + '22;color:' + statutColor + '">' + statutLabel + '</span></div></div>' +
              '<div class="tr2-pcell"><div class="tr2-plbl">Date création</div><div class="tr2-pval">' + formatDate(d.dateCreation) + '</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="tr2-pnat"><div class="l">Nature de l\'intervention</div><div class="v">' + (d.natureIntervention||'-') + '</div></div>' +
          (d.commentaire ? '<div class="tr2-pcom"><div class="tr2-plbl">Commentaire</div><div style="font-size:13px;margin-top:4px">' + d.commentaire + '</div></div>' : '') +
          '<div class="tr2-pfoot">Imprimé le ' + dateImpression + ' — Parc Auto DRT Sfax — Tunisie Telecom</div>' +
        '</div></body></html>';

      // Wrapper pour pouvoir fermer
      var wrap = document.createElement('div');
      wrap.id = 'tr2-iframe-wrap';
      wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;';
      wrap.appendChild(iframe);
      document.body.appendChild(wrap);

      // Nettoyer le div caché
      var f = document.getElementById('tr2-print-frame');
      if (f) f.parentNode.removeChild(f);
    }
    // FIN BLOC ADDITIF — Impression

    function changeStatut(id, newStatut, comment) {
      // BLOC ADDITIF — SYNCHRO : on relit le serveur avant d'écrire la décision,
      // pour ne pas écraser une demande arrivée entretemps d'un autre poste.
      function doAction() {
        var data = getData();
        if (!data) return;
        var d = (data.demandesTravaux || []).find(function(x){ return x.id === id; });
        if (!d) return;
        d.statut      = newStatut;
        d.commentaire = comment || d.commentaire || '';
        d.dateTraitement = new Date().toISOString();
        saveData();
        renderAdminTab();

        // Toast
        var msg = newStatut === 'VALIDÉE' ? '✅ Demande validée' : '❌ Demande rejetée';
        if (window.parcAuto && typeof window.parcAuto.showToast === 'function') {
          window.parcAuto.showToast(msg, newStatut === 'VALIDÉE' ? 'success' : 'error');
        }
      }
      if (typeof window._tr2FetchAndInject === 'function') {
        window._tr2FetchAndInject(doAction);
      } else {
        doAction();
      }
      // FIN BLOC ADDITIF
    }

    // ── Export Excel ────────────────────────────────────────
    function exportExcel() {
      var data = getData();
      var demandes = (data && data.demandesTravaux) ? data.demandesTravaux : [];
      if (!demandes.length) {
        if (window.parcAuto && typeof window.parcAuto.showToast === 'function')
          window.parcAuto.showToast('Aucune demande à exporter', 'error');
        return;
      }

      // Construction CSV avec BOM UTF-8
      var bom = '\uFEFF';
      var header = ['N°','Date demande','Demandeur','Division','Subdivision','Matricule','Marque','Index km','Nature intervention','Statut','Commentaire','Date création','Date traitement'];
      var rows = demandes.slice().reverse().map(function(d) {
        return [
          d.numero||'',
          d.dateDemande||'',
          d.nomDemandeur||'',
          d.division||'',
          d.subdivision||'',
          d.matricule||'',
          d.marque||'',
          d.indexKm||'',
          '"' + (d.natureIntervention||'').replace(/"/g,'""') + '"',
          d.statut||'',
          '"' + (d.commentaire||'').replace(/"/g,'""') + '"',
          formatDate(d.dateCreation),
          d.dateTraitement ? formatDate(d.dateTraitement) : ''
        ].join(';');
      });

      var csv = bom + header.join(';') + '\n' + rows.join('\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href     = url;
      a.download = 'demandes_travaux_' + new Date().toISOString().slice(0,10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    }

    // ── Patch showTab pour inclure travaux ──────────────────
    function patchShowTab() {
      var pa = window.parcAuto;
      if (!pa) { setTimeout(patchShowTab, 500); return; }
      var origShowTab = pa.showTab.bind(pa);
      pa.showTab = function(tabName) {
        origShowTab(tabName);
        // Ajouter le titre dans breadcrumb
        var bc = document.getElementById('breadcrumb-current');
        if (tabName === 'travaux' && bc) bc.textContent = 'Demandes de Travaux';
        if (tabName === 'travaux') {
          var tab = document.getElementById('tab-travaux');
          if (tab) tab.classList.add('active');
          renderAdminTab();
        } else {
          var tab2 = document.getElementById('tab-travaux');
          if (tab2) tab2.classList.remove('active');
        }
      };

      // Patch renderAll pour mettre à jour le badge
      var origRenderAll = pa.renderAll.bind(pa);
      pa.renderAll = function() {
        origRenderAll();
        renderStats();
        if (pa.currentTab === 'travaux') renderTable(_currentFilter, _currentSearch);
      };
    }

    // Init
    injectNavItem();
    injectTabContent();
    patchShowTab();

    // Mise à jour badge au démarrage
    setTimeout(renderStats, 2000);
  }

  // ── Utilitaires ──────────────────────────────────────────
  function formatDate(str) {
    if (!str) return '-';
    try {
      var d = new Date(str);
      if (isNaN(d)) return str;
      return d.toLocaleDateString('fr-FR');
    } catch(e) { return str; }
  }

  // ── Logo Tunisie Telecom (image réelle base64) ──
  var TT_LOGO_SVG = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACoCAMAAABt9SM9AAACQFBMVEX////7qS3m01VWLHwpqZrtI34ZuaDt62T3kD1nvmT6vSgjYKzZXHUaRoNsK4bWIyoaq93mRpkyqeD19ffvPzeAxWT5nV8UerZbM4X3sTX4xTMQSIMtmpl3LYslmLzyaDxBU30wolzs7vPwUC4wvKW1OYkADVsAIGHb3+iYpr8KLmkaN27//PnpJS6yt8aQm7QYh05BpmYAN3pPYIc1a7FhFX60ncCElLKyLIRvfZwAG2AAUqb9/e98xXru1FSmirTsAHQAFl4AAFev4dic284AcbIAezgpt23D4t6h2biastV0wmTu+vj6twDBPI34mTnQj7b0ezn36vL71+bwvL1+PJH2psT44eL71tUAAE3O090UM2yfwdpsoMotiblUxK+H1MYhnK1/urrB3NweiLTP5/NWqKen0M+KyewYmc4Vh8AhpKoRkZC94PNNmm3K4NQrkndfsXwVm02Lxp9nvuhBpmNju7AZtGbG47/e79toir9wvlCl1JcAS6NYf7l2y5yW0JNaxIldv3Kmx12/yVD5+MqHvdPUz1js6lfx744fqswmrYCVxV8faZrN03Hr2W3086oVYJPu8YLUfEn848H4ulX53IvjE0iZNIjkI2H92sP7ymFkQoX84al3W5OJcqLvOxBHEnH2paPyWVb7yo3dsMz5oGq+W5nOPZHubqzZQUb2hknth7j5n2WJT5rJdarvS4zqpKbfY2fTAAf0jHr7wKHkwNbteratdK7mfoX3pZH1nb7WY3ThSnjhhZbppbFimfYTAAALD0lEQVR4nO2cjV8T9x3HT57UAgb4gZQKQg7hLglJ1BQhYWoCo1jFpyMkIWirXe187DZna6ur3dauddo9dOsmdm7yMKcoVSAWiU/91/b9/e4hd8cF9tpLjVy+b14E7n6XmN/79fl973vh5XEcgiAIgiAIgiAIgiAIgiAIgiAIgiAIgiAIgiDIsoP07+jp6fkx0NPT35/rd/MSQ44cOPhWiZ63D/WgMCvEncd7e2t7i0pMvH1oB8n1e3u5IAfeAlNA72GzrJKikvp3foK+NEBVrcK7JlNAScnJk+Ar12/y5eDIwV7NVW3tBpMqKquovv7kyfd+ivWLO1q1vuLY8VrFV+8Jk6oiaq+egvE6UlUFsgDwxWStl01tKFJhm/WyrpPv7cj1G84hp6qoLGaroqKK+dKFKiOrqF7hjfd/luv3nCuOHpNlKbZowGpPGFQpspRo1W/cuDFfdR2tYhzT26q4ZOVKsfX+xo35qktxVVVhkFVhLYsuxJ9vVHjjF/mm61SVynqDLWtZJZorp9PZ13c6v3RlXDFZmq2qw3pXmbZrQz3z5GSu+pzO059+nOspvDD4KpOs9ZZFS9eiOp0ZVyDLedr5y3xpU89klWVYhxs0Nn2wifGB4orpejMvdO18nWk6xRMruB1U1Ic7+rl+FdImQ/r7uTfPqiFbXfNRrmfy/OG7SkuPV53JOk5lHco6qspaXVNTc36r7UvXOZBVWspnHQdZH2Z/tiyLqqKc/5W912LyE1DVdS77ASCrJ/solaWqorbO23otXqC56tqZ/YCeoqJFLpk/PatTVWPztSh+spSsosVkfbyasmvXLr0u265FuWItIuudxWT1b12tQ3V2vsae4SKlpbIswston7AT1iUcOUOb+B1q06A9T978aLUV4Oz8r+0YrgNdsq3S12VKtYh9ofSml3QdaYl2Efibvr7fWppi1Hz2+crf5WZCz5NzpUY2u9SRL9ROXnet48zIyurpq8+/LNi2beXKi7//UW6m9NwgJlflJlnU1glN1uXTmqytFp52ffUZ9bStoKBgJXDRbuESuwyqyq1kXVI/cbjszC5LCRQVVaDIsl24dnYZVOllubRLaiVYl+FqWetO9bLkQBXoWKlw8aKdwnWwy6BKL6uj/F3F1glZltPZd1Zrz7dqlVyXJ7Mrm4XrglGVQdbmzV8zXXQdbmCuDLJ2LQzUQld2qlzkgsmVQRZs/oFFiwZrk5M2C6qstj9mEWV2xcLVlqPpPVt4k6oFssrXQbhgHULBYn2VJutP1qIsXNkmXLxJ1UJZTNfhost9faw1UGedXdZCV1TXn20QLrF0nQm9LHlPefnX6y/TSv5lQcG2JWVZugJbf1n+4RILXzUxtkUd2z6m7isc/Gtd3Yo6YMU3ymDb3+qseS0Lu/+eoyk+O/jCwjUNa/S0Z2S1K7saRiqvVO9ftXfv3hU6WSusqXvFit2vfJPlHSwjQBboWlzWSMut4qsOb/P+VcC3ymBWWZa2dv/DDs0WuWa2ZZY10tKyp7K42AG2qK6lZa2wcPXPHE3vGfOvwkKjLqOshpY9LS2VTJbDWw26NFlr9/6vtuwRK8r1sUKjLr2shhFQBa5A1hWQBbZGo8pg21q6KPdaGzO6Wv6VXWWLKkvVpZMFKxC4RV1B0XI4qr3VJlmysIXGdKpes0FlV/FlZBWaZO3rpK72sGCxdeiwlLXKKmKZWNmgGdUQdbKYLrOsSp0sR3Uqi6wFEbNfrCjXCg2sab+ujjBZqitatIDUuDLYdmeBLGPEbBcryvaxQpMuSRmhsm5psq4yWd4JZbBtQu67shqrs12sgKRZ1th15Y9hIIsWLEWWvA4dqbQ82NbY3LyILuDfdosV5Zo5WSM3b0gUkKVzpchypCaicQqVZa1rLeU/8VzP67mwxVjiGxpGWjplZFeqrCuKLe/oaCo1OtqssN/gaO3a79jj97me1XOCKLJepR9ANDRQWS0tN2/SDmtSL4sWrdvslAjQbl7lTsaRgk1jRWHRGttCCBHbqSwaqrkbnZ17KqUp5mpaIoSbDKccjvh4ygvdlpdCs8Xy1dh4R29q7XffLv1vLlsIC9a169z2u/N3B+cH7+3b13nv3s0bsUpwFZuCUE3HBqaLp2dmU/Fxx/hTh3d2fKJ6PF3deP/h/YcPQZZB1/d2LOwZWLTWDHLz7dL2u9I8N0D2zd0YGJibIpMDkhQLF4djA+FpkmibjaehukdnuWg6KknRNJfg4pxsS9Vl4xUoQ64VQrHSZEmwCOFLmqyUHnBTc5Isa4qUxWcS4/GZGSkaHa0msxPx8cQoN5oYH21sVHXZegUqJGmtkmUNqrIq57gpkHUj9kiVFZuZBVnRmfHETKqaTFBZXq45I6u50eYrUGFLuyxLnJvjFVkPpqSYNCnFJieLmaxJbip9Ow6y0rPjbemJeDSaSMeruea4Kqv5od1XoMo82BLvts9Lc3M35zpv7Is9ikkDlXOTDwYGaLKmYuHwo4GB2Wj6diIeTUXj6YlEYmI26k14Z+Sa1Xw/X1RB2RpsaKBrsb29HZrRzluVKsXhMJwO6UM4fDUF3UMKHlIpbzV8e1PsC5qH5sZErmfwIpEaVJTPsCoN7bvhikduTL0ao/mlChB1sjKupp/oZV3RudJspW5Hl351uyEONigXO7pYPXlcNp2RdVXvSrYF19W5fuM5QRpsZ7Ju6RZgGZAJV9jgCmzlqyqA0HPiyB59qSorM+gyyvLmryoK9Fst+qo+/bjMoOtKxpXXO5vXqoDkXcP570mZhla0mKpUdTrfzoAWkFhxOCOrTMcTpWjJpUpa+qXyAemRpktbhZouhwNMjedPs740JDbN+nb9KlTWogOX30IGpsBX2Owq/QOaskaae/Q0swwfP/0hgXVqcSSJ/d1LQk8IgiAIgiAIYiuIKHKcKGa9VVLS78p+G6XlDi8aN3lOt4OIdIcBcUjguaYhn8VLwdEi7++OiBZj9iDQndRt8R6Pf8ivbcLvHo/RltgKOwIRK1kdQy6hySW47Suro0k/NxIMJj0ZET5PMhjM3BU+6UsuJguODgRtLYtbcId8knXQ3x1cTBY72m9PWXI1IvLdjvhkkuj2GlGO4fytVrKILxj0acfZTxY1wq9jswoIdKJ+oTviocWLbxIWzjUYksuYpaykp7u7OxSgv3aEgvaSRc9+JBJJQi1nWppCMG9Xq8cVEGgp5z3KyUzfHARbFVkRvSzRR+0mhYhf9Akh+t/TO1ptIkuUs+BrdROOuAWDLNIE8mCnj8oKsbkST2tmzposQ7I6hoLseJZMFi3byAoOddAfMDnqBSakkyW6h6EoNQmujCzeM5yJlrUsusUFu9mQr9VOsmB5yf1UIOQnyZDbxSeH3T6ehxpFkxXy83wg5CK8qCarKdTBq/e7C0b8ULx5AsuQJCNUVigIe4UAnxQ8Ij3EFwnAeEfEHrJEtyAnJeAODbvd7lb4FkIej8dNl5FPiAx7PMPDdFupWb5QRPAoDEOB98HBw244wg2R80fcHo/gFgQ33UNxu+lxgl1khViySJMQDDQFkn548AWbKLTmJGHnsJttqk0q3aXhgpOetsFzpIOO+Q2HMDo4v3t42cuikuhPnwDBYF0TfSD0jtTKAR1wNpTvR515UuYe1aYN9kzjIey1CF2uL3JezwdfqxDw+YLDrS6LQZL0N0XcSYuRPMUlQPPYLfitxoh7KBRc9qvnWcL7/H5fljXiyzaAIAiCIAiCIAiCIAiCIAiCIAiCIAiCIAiCIAiCIAiCIAiCIMj/w38BQ/0egRlagm0AAAAASUVORK5CYII=" width="80" height="55" style="object-fit:contain;display:block;" alt="Tunisie Telecom" />';

  // ── Fonction d'impression partagée (utilisateur + validateur + admin) ──
  function printDemandeShared(d) {
    var km = parseInt(d.indexKm||0).toLocaleString('fr-FR');
    var isOk  = d.statut === 'VALIDÉE';
    var isKo  = d.statut === 'REJETÉE';
    var statutColor = isOk ? '#27AE60' : isKo ? '#C0392B' : '#E67E22';
    var statutBg    = isOk ? '#D1FAE5' : isKo ? '#FEE2E2' : '#FEF3E2';
    var statutLabel = isOk ? '✅ DEMANDE VALIDÉE' : isKo ? '❌ DEMANDE REJETÉE' : '⏳ EN ATTENTE';
    var now = new Date();
    var dateImpression = now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});

    // Bandeau statut final (visible seulement si validée ou rejetée)
    var statutBanner = (isOk || isKo)
      ? '<div style="background:' + statutBg + ';border:2.5px solid ' + statutColor + ';border-radius:10px;padding:14px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">' +
          '<div>' +
            '<div style="font-size:18px;font-weight:900;color:' + statutColor + ';letter-spacing:1px;">' + statutLabel + '</div>' +
            (d.validePar ? '<div style="font-size:12px;color:#374151;margin-top:3px;">Par : <strong>' + d.validePar + '</strong>' + (d.valideParTitre || getTitreValidateur(d.validePar) ? ' <span style=\"color:#64748b;font-size:11px;\">(' + (d.valideParTitre || getTitreValidateur(d.validePar)) + ')</span>' : '') + (d.dateTraitement ? '  —  Le ' + formatDate(d.dateTraitement) : '') + '</div>' : '') +
            (isKo && d.commentaire ? '<div style="font-size:12px;color:#991b1b;margin-top:4px;">Motif : ' + d.commentaire + '</div>' : '') +
          '</div>' +
          '<div style="font-size:40px;line-height:1;">' + (isOk ? '✅' : '❌') + '</div>' +
        '</div>'
      : '';

    var iframeContent = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
      'body{font-family:Arial,sans-serif;color:#1e293b;margin:0;padding:24px;}' +
      '.pg{max-width:720px;margin:0 auto;}' +
      '.entete{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:#003087;border-radius:10px 10px 0 0;margin-bottom:0;}' +
      '.entete-centre{text-align:center;flex:1;}' +
      '.entete-titre{font-size:16px;font-weight:900;color:#fff;letter-spacing:.5px;}' +
      '.entete-sous{font-size:11px;color:#94a3b8;margin-top:3px;}' +
      '.entete-num{background:#E2701A;color:#fff;padding:5px 16px;border-radius:20px;font-size:13px;font-weight:800;white-space:nowrap;}' +
      '.sous-entete{background:#E2701A;color:#fff;text-align:center;padding:6px;font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:16px;border-radius:0 0 6px 6px;}' +
      '.sec{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:14px;}' +
      '.row{display:flex;border-bottom:1px solid #f1f5f9;}' +
      '.row:last-child{border-bottom:none;}' +
      '.cell{flex:1;padding:9px 13px;}' +
      '.lbl{font-size:9px;text-transform:uppercase;color:#94a3b8;letter-spacing:.5px;margin-bottom:2px;}' +
      '.val{font-size:13px;font-weight:600;}' +
      '.nat-box{background:#FEF3E2;border-left:4px solid #E2701A;padding:12px 16px;margin-bottom:14px;border-radius:0 8px 8px 0;}' +
      '.nat-box .l{font-size:9px;text-transform:uppercase;color:#92400e;font-weight:700;margin-bottom:4px;}' +
      '.nat-box .v{font-size:13px;line-height:1.6;}' +
      '.foot{text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:4px;}' +
      '.no-print{text-align:center;margin-bottom:16px;}' +
      '.pbtn{background:#003087;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;cursor:pointer;margin-right:8px;font-weight:700;}' +
      '.cbtn{background:#f1f5f9;color:#374151;border:none;padding:10px 28px;border-radius:8px;font-size:14px;cursor:pointer;}' +
      '@media print{.no-print{display:none!important;}}' +
      '</style></head><body>' +

      '<div class="no-print">' +
        '<button class="pbtn" onclick="window.print()">🖨️ Imprimer</button>' +
        '<button class="cbtn" onclick="parent.document.getElementById(\'tr2-prt-wrap\').remove()">✕ Fermer</button>' +
      '</div>' +

      '<div class="pg">' +
        // En-tête avec logo
        '<div class="entete">' +
          '<div>' + TT_LOGO_SVG + '</div>' +
          '<div class="entete-centre">' +
            '<div class="entete-titre">🔧 DEMANDE DE TRAVAUX</div>' +
            '<div class="entete-sous">Tunisie Telecom — Direction Régionale Sfax</div>' +
          '</div>' +
          '<div class="entete-num">' + (d.numero||'') + '</div>' +
        '</div>' +
        '<div class="sous-entete">PARC AUTO DRT SFAX</div>' +

        // Bandeau statut (si validée/rejetée)
        statutBanner +

        // Informations
        '<div class="sec">' +
          '<div class="row">' +
            '<div class="cell"><div class="lbl">Demandeur</div><div class="val">' + (d.nomDemandeur||'-') + '</div></div>' +
            '<div class="cell"><div class="lbl">Division</div><div class="val">' + (d.division||'-') + '</div></div>' +
          '</div>' +
          '<div class="row">' +
            '<div class="cell"><div class="lbl">Subdivision</div><div class="val">' + (d.subdivision||'-') + '</div></div>' +
            '<div class="cell"></div>' +
          '</div>' +
          '<div class="row">' +
            '<div class="cell"><div class="lbl">Matricule véhicule</div><div class="val">' + (d.matricule||'-') + '</div></div>' +
            '<div class="cell"><div class="lbl">Marque</div><div class="val">' + (d.marque||'-') + '</div></div>' +
          '</div>' +
          '<div class="row">' +
            '<div class="cell"><div class="lbl">Date de la demande</div><div class="val">' + formatDate(d.dateDemande) + '</div></div>' +
            '<div class="cell"><div class="lbl">Index kilométrique</div><div class="val">' + km + ' km</div></div>' +
          '</div>' +
          (!isOk && !isKo ? '<div class="row"><div class="cell"><div class="lbl">Statut</div><div class="val" style="color:' + statutColor + ';font-weight:700;">⏳ En attente de validation</div></div></div>' : '') +
        '</div>' +

        '<div class="nat-box"><div class="l">Nature de l\'intervention demandée</div><div class="v">' + (d.natureIntervention||'-') + '</div></div>' +

        (isKo && d.commentaire ? '<div style="background:#FEE2E2;border-left:4px solid #C0392B;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:14px;"><div style="font-size:9px;text-transform:uppercase;color:#991b1b;font-weight:700;margin-bottom:4px;">❌ Motif de rejet</div><div style="font-size:13px;color:#1e293b;">' + d.commentaire + '</div></div>' : '') +
        (d.cgReponse ? '<div style="background:#EDE9FE;border-left:4px solid #7c3aed;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:14px;"><div style="font-size:9px;text-transform:uppercase;color:#5b21b6;font-weight:700;margin-bottom:4px;">&#127959; Réponse Chef de Garage</div><div style="font-size:13px;color:#1e293b;">' + d.cgReponse + '</div></div>' : '') +

        '<div style="display:flex;gap:12px;margin-bottom:14px;">' +
          '<div style="flex:1;border:1px solid ' + statutColor + ';border-radius:8px;padding:12px 14px;min-height:70px;background:' + statutBg + '22;">' +
            '<div style="font-size:9px;text-transform:uppercase;color:' + statutColor + ';font-weight:700;margin-bottom:6px;">' + (d.valideParTitre || (d.validePar ? getTitreValidateur(d.validePar) : 'Visa Approbateur')) + '</div>' +
            (d.validePar ? '<div style="font-size:12px;font-weight:600;color:#1e293b;">' + d.validePar + '</div>' : '<div style="font-size:11px;color:#94a3b8;font-style:italic;">En attente</div>') +
          '</div>' +
          '<div style="flex:1;border:1.5px solid #e2e8f0;border-radius:8px;padding:10px 14px;min-height:70px;">' +
            '<div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:6px;">Signature et cachet du demandeur</div>' +
            (d.signatureDataUrl ? '<img src="' + d.signatureDataUrl + '" style="max-width:100%;max-height:60px;display:block;margin-top:4px;" alt="Signature"/>' : '<div style="font-size:11px;color:#e53e3e;font-style:italic;font-weight:700;margin-top:4px;">OBLIGATOIRE</div>') +
          '</div>' +
        '</div>' +

        '<div class="foot">Imprimé le ' + dateImpression + ' — Parc Auto DRT Sfax — Tunisie Telecom — Direction Régionale Sfax</div>' +
      '</div></body></html>';

    // Supprimer wrapper précédent si existant
    var old = document.getElementById('tr2-prt-wrap');
    if (old) old.parentNode.removeChild(old);

    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999;';
    iframe.srcdoc = iframeContent;

    var wrap = document.createElement('div');
    wrap.id = 'tr2-prt-wrap';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;';
    wrap.appendChild(iframe);
    document.body.appendChild(wrap);
  }

  // ══════════════════════════════════════════════════════════
  // BLOC ADDITIF — INTERFACE VALIDATEUR (index.html)
  // Deux mots de passe pour Hamdi / Admin DRT
  // Accessible via bouton flottant + modale dédiée
  // ══════════════════════════════════════════════════════════
  // BLOC ADDITIF — tr2FetchAndInject : fonction partagée (validateur + chef garage)
  function tr2FetchAndInject(cb) {
    var pa = window.parcAuto;
    var workerUrl = null;
    if (pa) {
      workerUrl = pa.WORKER_URL || pa.workerUrl || pa._workerUrl || pa.apiUrl || pa.API_URL || null;
      if (!workerUrl && window.PARC_CONFIG) workerUrl = window.PARC_CONFIG.workerUrl || window.PARC_CONFIG.WORKER_URL || null;
      if (!workerUrl) { try { Object.keys(pa).forEach(function(k){ if (!workerUrl && typeof pa[k]==='string' && pa[k].includes('workers.dev')) workerUrl=pa[k]; }); } catch(e){} }
    }
    function inject(freshData) {
      if (pa && pa.data && freshData && freshData.demandesTravaux) {
        pa.data.demandesTravaux = freshData.demandesTravaux;
        try { var s=JSON.parse(localStorage.getItem('parcAutoData_v3')||'{}'); s.demandesTravaux=freshData.demandesTravaux; localStorage.setItem('parcAutoData_v3',JSON.stringify(s)); } catch(e){}
      }
      if (cb) cb();
    }
    function fromLS() {
      try { var r=localStorage.getItem('parcAutoData_v3'); if(r){var p=JSON.parse(r); if(pa&&pa.data&&p&&p.demandesTravaux) pa.data.demandesTravaux=p.demandesTravaux; } } catch(e){}
      if (cb) cb();
    }
    if (workerUrl) {
      fetch(workerUrl+(workerUrl.includes('?')?'&':'?')+'_nc='+Date.now(),{cache:'no-store'})
        .then(function(r){return r.json();}).then(inject).catch(fromLS);
    } else { fromLS(); }
  }
  // FIN BLOC ADDITIF — tr2FetchAndInject partagée
  // BLOC ADDITIF — exposer globalement pour éviter tout problème de scope/cache
  window._tr2FetchAndInject = tr2FetchAndInject;
  // FIN BLOC ADDITIF

  function initValidateurInterface() {
    // Ne pas injecter si déjà présent
    if (document.getElementById('tr2v-overlay')) return;

    // ── Bouton flottant ─────────────────────────────────────
    var openBtn = document.createElement('button');
    openBtn.id = 'tr2v-open-btn';
    openBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d=\"M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7L12 2z\"/><polyline points=\"9 12 11.5 14.5 15.5 10.5\"/></svg> Validateur <span class="badge" id="tr2v-float-badge" style="display:none">0</span>';
    var _tr2BottomBar = document.getElementById('tr2-bottom-bar');
    if (!_tr2BottomBar) { _tr2BottomBar = document.createElement('div'); _tr2BottomBar.id = 'tr2-bottom-bar'; document.body.appendChild(_tr2BottomBar); }
    _tr2BottomBar.appendChild(openBtn);

    // ── Modale principale ───────────────────────────────────
    var ov = document.createElement('div');
    ov.id = 'tr2v-overlay';
    ov.innerHTML = `
      <div id="tr2v-modal" role="dialog" aria-modal="true" aria-label="Interface Validateur">

        <!-- Écran login -->
        <div id="tr2v-sc-login">
          <div class="tr2v-hd">
            <div><h2>🛡️ Espace Validateur</h2><p>Parc Auto DRT Sfax — Accès restreint</p></div>
            <button class="tr2v-x" id="tr2v-close-login" aria-label="Fermer">✕</button>
          </div>
          <div class="tr2v-bd">
            <div style="text-align:center;padding:8px 0 20px">
              <div style="font-size:50px;margin-bottom:10px">🔐</div>
              <h3 style="color:#1e293b;font-size:16px;font-weight:700;margin:0 0 4px">Accès Validateur</h3>
              <p style="color:#64748b;font-size:13px;margin:0 0 20px">Entrez votre mot de passe pour accéder à l'interface de validation</p>
            </div>
            <div class="tr2-err" id="tr2v-login-err"></div>
            <div class="tr2-f">
              <label>Mot de passe <em style="color:#E67E22">*</em></label>
              <input type="password" id="tr2v-pwd" placeholder="••••••••••••" autocomplete="current-password">
            </div>
            <button class="tr2-btn tr2-btn-primary" id="tr2v-login-btn" style="margin-top:8px">🔓 Accéder</button>
          </div>
        </div>

        <!-- Écran validateur -->
        <div id="tr2v-sc-main" style="display:none">
          <div class="tr2v-hd">
            <div><h2>🛡️ Validation Demandes Travaux</h2><p id="tr2v-hd-sub">Parc Auto DRT Sfax</p></div>
            <button class="tr2v-x" id="tr2v-close-main" aria-label="Fermer">✕</button>
          </div>
          <div class="tr2v-bd">
            <div class="tr2v-user-bar">
              <span id="tr2v-user-name">—</span>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <!-- BLOC ADDITIF — Bouton Actualiser validateur -->
                <button class="tr2v-logout" id="tr2v-refresh-btn" style="background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;">🔄 Actualiser</button>
                <!-- FIN BLOC ADDITIF -->
                <button class="tr2v-logout" id="tr2v-historique-btn" style="background:#F3E8FF;color:#6b21a8">📁 Historique</button>
                <button class="tr2v-logout" id="tr2v-chpwd-btn" style="background:#EFF6FF;color:#1d4ed8">🔑 Mot de passe</button>
                <button class="tr2v-logout" id="tr2v-export-btn" style="background:#D1FAE5;color:#065f46">📊 Excel</button>
                <button class="tr2v-logout" id="tr2v-logout-btn">🔒 Déconnecter</button>
              </div>
            </div>
            <div class="tr2v-stats" id="tr2v-stats"></div>
            <div id="tr2v-list"></div>
          </div>
        </div>

        <!-- Écran Historique -->
        <div id="tr2v-sc-historique" style="display:none">
          <div class="tr2v-hd">
            <div><h2>📁 Historique des Décisions</h2><p>Demandes traitées — Parc Auto DRT Sfax</p></div>
            <button class="tr2v-x" id="tr2v-close-hist" aria-label="Fermer">✕</button>
          </div>
          <div class="tr2v-bd">
            <div class="tr2v-hist-back-bar">
              <button class="tr2v-hist-back-btn" id="tr2v-back-btn">⬅️ Retour aux demandes en attente</button>
              <span class="tr2v-hist-title" id="tr2v-hist-count"></span>
              <button id="tr2v-hist-del-btn" style="margin-left:auto;background:#FEE2E2;color:#991b1b;border:none;border-radius:10px;padding:7px 13px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap;">🗑️ Supprimer l'historique</button>
            </div>
            <div class="tr2v-hist-filter-bar" id="tr2v-hist-filter-bar">
              <button class="tr2v-hist-fb active" data-hf="TOUS">Toutes</button>
              <button class="tr2v-hist-fb" data-hf="VALIDÉE">✅ Validées</button>
              <button class="tr2v-hist-fb" data-hf="REJETÉE">❌ Rejetées</button>
            </div>
            <div id="tr2v-hist-list"></div>
          </div>
        </div>

      </div>`;
    document.body.appendChild(ov);

    // ── Helpers écran ────────────────────────────────────────
    function vScreen(n) {
      document.getElementById('tr2v-sc-login').style.display      = n === 'login'      ? '' : 'none';
      document.getElementById('tr2v-sc-main').style.display       = n === 'main'       ? '' : 'none';
      document.getElementById('tr2v-sc-historique').style.display = n === 'historique' ? '' : 'none';
    }

    function closeModal() {
      document.getElementById('tr2v-overlay').classList.remove('open');
    }

    // ── Ouvrir ───────────────────────────────────────────────
    openBtn.addEventListener('click', function() {
      document.getElementById('tr2v-overlay').classList.add('open');
      var sess = getValidSess();
      if (sess) {
        document.getElementById('tr2v-user-name').textContent = '👤 ' + sess.nom;
        document.getElementById('tr2v-hd-sub').textContent = 'Connecté : ' + sess.nom;
        _vFilter = 'EN ATTENTE';
        vScreen('main');
        renderValidList(_vFilter);
        renderValidStats();
      } else {
        vScreen('login');
        document.getElementById('tr2v-pwd').value = '';
        document.getElementById('tr2v-login-err').classList.remove('show');
        setTimeout(function(){ document.getElementById('tr2v-pwd').focus(); }, 100);
      }
    });

    // ── Fermer ───────────────────────────────────────────────
    document.getElementById('tr2v-close-login').addEventListener('click', closeModal);
    document.getElementById('tr2v-close-main').addEventListener('click', closeModal);
    document.getElementById('tr2v-close-hist').addEventListener('click', closeModal);
    document.getElementById('tr2v-overlay').addEventListener('click', function(e) {
      if (e.target.id === 'tr2v-overlay') closeModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && document.getElementById('tr2v-overlay').classList.contains('open'))
        closeModal();
    });

    // ── Login validateur ─────────────────────────────────────
    function doValidLogin() {
      var pwd = document.getElementById('tr2v-pwd').value.trim();
      var err = document.getElementById('tr2v-login-err');
      var nom = resolveUser(pwd, VALIDATEUR_USERS, 'validateurPasswords');
      if (nom) {
        setValidSess(nom);
        err.classList.remove('show');
        document.getElementById('tr2v-user-name').textContent = '👤 ' + nom;
        document.getElementById('tr2v-hd-sub').textContent = 'Connecté : ' + nom;
        _vFilter = 'EN ATTENTE';
        vScreen('main');
        renderValidList(_vFilter);
        renderValidStats();
      } else {
        err.textContent = 'Mot de passe incorrect.';
        err.classList.add('show');
        document.getElementById('tr2v-pwd').value = '';
        setTimeout(function(){ document.getElementById('tr2v-pwd').focus(); }, 50);
      }
    }
    document.getElementById('tr2v-login-btn').addEventListener('click', doValidLogin);
    document.getElementById('tr2v-pwd').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') doValidLogin();
    });

    // ── Déconnexion ──────────────────────────────────────────
    document.getElementById('tr2v-logout-btn').addEventListener('click', function() {
      delValidSess();
      vScreen('login');
      document.getElementById('tr2v-pwd').value = '';
    });

    // BLOC ADDITIF — Bouton Actualiser validateur
    document.getElementById('tr2v-refresh-btn').addEventListener('click', function() {
      var btn = document.getElementById('tr2v-refresh-btn');
      var sess = getValidSess();
      if (!sess) return;
      btn.disabled = true;
      btn.textContent = '⏳ Chargement…';
      window._tr2FetchAndInject(function() {
        renderValidStats();
        renderValidList(_vFilter);
        btn.disabled = false;
        btn.textContent = '🔄 Actualiser';
        bipAlert3('valid');
        if (window.parcAuto && typeof window.parcAuto.showToast === 'function')
          window.parcAuto.showToast('✅ Données actualisées', 'success');
      });
    });
    // FIN BLOC ADDITIF — Bouton Actualiser validateur

    // ── Changer mot de passe validateur ─────────────────────
    document.getElementById('tr2v-chpwd-btn').addEventListener('click', function() {
      var sess = getValidSess();
      if (!sess || !sess.nom) return;
      showChangePwdModal(sess.nom, 'validateurPasswords');
    });

    // ── Export Excel validateur ──────────────────────────────
    document.getElementById('tr2v-export-btn').addEventListener('click', function() {
      var data = getData();
      var demandes = (data && data.demandesTravaux) ? data.demandesTravaux : [];
      if (!demandes.length) {
        if (window.parcAuto && typeof window.parcAuto.showToast === 'function')
          window.parcAuto.showToast('Aucune demande à exporter', 'error');
        return;
      }
      var bom = '\uFEFF';
      var header = ['N°','Date demande','Demandeur','Division','Subdivision','Matricule','Marque','Index km','Nature intervention','Statut','Motif rejet/commentaire','Validé par','Date création','Date traitement'];
      var rows = demandes.slice().reverse().map(function(d) {
        return [
          d.numero||'',
          d.dateDemande||'',
          d.nomDemandeur||'',
          d.division||'',
          d.subdivision||'',
          d.matricule||'',
          d.marque||'',
          d.indexKm||'',
          '"' + (d.natureIntervention||'').replace(/"/g,'""') + '"',
          d.statut||'',
          '"' + (d.commentaire||'').replace(/"/g,'""') + '"',
          d.validePar||'',
          formatDate(d.dateCreation),
          d.dateTraitement ? formatDate(d.dateTraitement) : ''
        ].join(';');
      });
      var csv = bom + header.join(';') + '\n' + rows.join('\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href     = url;
      a.download = 'validation_travaux_' + new Date().toISOString().slice(0,10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    });

    // ── Filtre (EN ATTENTE uniquement sur écran principal) ───
    var _vFilter = 'EN ATTENTE'; // par défaut : en attente
    var _histFilter = 'TOUS';

    // ── Bouton Historique ────────────────────────────────────
    document.getElementById('tr2v-historique-btn').addEventListener('click', function() {
      _histFilter = 'TOUS';
      vScreen('historique');
      // ✅ CORRECTION : délai pour laisser le DOM se mettre à jour (display:none → display:block)
      setTimeout(function() {
        // Forcer le reflow du parent pour s'assurer que l'élément est visible
        var histScreen = document.getElementById('tr2v-sc-historique');
        if (histScreen) {
          histScreen.style.display = 'block';
          void histScreen.offsetHeight; // force reflow
        }
        renderHistoriqueList(_histFilter);
      }, 100);
    });

    // ── Bouton Retour depuis Historique ──────────────────────
    document.getElementById('tr2v-back-btn').addEventListener('click', function() {
      _vFilter = 'EN ATTENTE';
      vScreen('main');
      renderValidList(_vFilter);
      renderValidStats();
    });

    // ── Supprimer l'historique (Validateur) ─────────────────
    document.getElementById('tr2v-hist-del-btn').addEventListener('click', function() {
      var data = getData();
      if (!data || !data.demandesTravaux) return;
      var traitees = data.demandesTravaux.filter(function(d){ return d.statut !== 'EN ATTENTE'; });
      if (!traitees.length) {
        if (window.parcAuto && typeof window.parcAuto.showToast === 'function')
          window.parcAuto.showToast('Aucune demande traitée à supprimer', 'info');
        return;
      }
      if (!confirm('Supprimer les ' + traitees.length + ' demande(s) traitée(s) de l\'historique ?\n⚠️ Cette action est irréversible.')) return;
      data.demandesTravaux = data.demandesTravaux.filter(function(d){ return d.statut === 'EN ATTENTE'; });
      saveData();
      if (window.parcAuto && typeof window.parcAuto.showToast === 'function')
        window.parcAuto.showToast('🗑️ Historique supprimé (' + traitees.length + ' entrée(s))', 'info');
      renderHistoriqueList(_histFilter);
      renderValidStats();
    });

    // ── Filtres Historique ───────────────────────────────────
    document.getElementById('tr2v-hist-filter-bar').querySelectorAll('.tr2v-hist-fb').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.getElementById('tr2v-hist-filter-bar').querySelectorAll('.tr2v-hist-fb')
          .forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        _histFilter = btn.dataset.hf;
        renderHistoriqueList(_histFilter);
      });
    });

    // ── Rendu Historique (validées + rejetées) ───────────────
    function renderHistoriqueList(filter) {
      var data = getData();
      var all = (data && data.demandesTravaux) ? data.demandesTravaux.slice().reverse() : [];
      // Exclure EN ATTENTE
      var demandes = all.filter(function(d){ return d.statut !== 'EN ATTENTE'; });
      if (filter && filter !== 'TOUS') {
        demandes = demandes.filter(function(d){ return d.statut === filter; });
      }

      var countEl = document.getElementById('tr2v-hist-count');
      if (countEl) countEl.textContent = demandes.length + ' demande(s) traitée(s)';

      var list = document.getElementById('tr2v-hist-list');
      if (!list) {
        console.error('[TR2V] ERREUR : tr2v-hist-list introuvable');
        return;
      }
      // ✅ S'assurer que le parent est visible avant d'écrire
      var histScreen = document.getElementById('tr2v-sc-historique');
      if (histScreen) {
        histScreen.style.display = 'block';
        void histScreen.offsetHeight;
      }
      if (!demandes.length) {
        list.innerHTML = '<div class="tr2v-empty">📭 Aucune demande traitée' + (filter && filter !== 'TOUS' ? ' dans cette catégorie' : '') + '</div>';
        return;
      }

      list.innerHTML = demandes.map(function(d) {
        var badgeHtml = d.statut === 'VALIDÉE'
          ? '<span class="tr2v-badge-ok">✅ Validée</span>'
          : '<span class="tr2v-badge-ko">❌ Rejetée</span>';

        var infoTraitement = '<div class="tr2v-treated">' +
          (d.commentaire ? '💬 ' + d.commentaire : (d.statut === 'VALIDÉE' ? '✅ Demande validée' : '❌ Demande rejetée')) +
          (d.dateTraitement ? ' — le ' + formatDate(d.dateTraitement) : '') +
          (d.validePar ? ' par <strong>' + d.validePar + '</strong>' : '') +
        '</div>';

        return '<div class="tr2v-card" id="hist-card-' + d.id + '">' +
          '<div class="tr2v-card-hd">' +
            '<span class="tr2v-card-num">' + (d.numero||'—') + '</span>' +
            badgeHtml +
            '<span class="tr2v-card-date">' + formatDate(d.dateDemande) + '</span>' +
            '<button id="tr2v-hist-print-' + d.id + '" style="background:#003087;color:#fff;border:none;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">🖨️ Imprimer</button>' +
          '</div>' +
          '<div class="tr2v-card-body">' +
            '<div class="tr2v-card-row">' +
              '<div><div class="tr2v-lbl">Demandeur</div><div class="tr2v-val">' + (d.nomDemandeur||'—') + '</div></div>' +
              '<div><div class="tr2v-lbl">Division</div><div class="tr2v-val">' + (d.division||'—') + '</div></div>' +
            '</div>' +
            '<div class="tr2v-card-row">' +
              '<div><div class="tr2v-lbl">Matricule</div><div class="tr2v-val">' + (d.matricule||'—') + '</div></div>' +
              '<div><div class="tr2v-lbl">Marque / Km</div><div class="tr2v-val">' + (d.marque||'—') + (d.indexKm ? ' — ' + d.indexKm + ' km' : '') + '</div></div>' +
            '</div>' +
            '<div class="tr2v-nat"><div class="l">Nature de l\'intervention</div><div class="v">' + (d.natureIntervention||'—') + '</div></div>' +
            (d.cgReponse ? '<div style="background:#EDE9FE;border-left:3px solid #7c3aed;border-radius:0 7px 7px 0;padding:8px 12px;margin:6px 0;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#5b21b6;font-weight:700;margin-bottom:3px;">🏗️ Réponse Chef de Garage</div><div style="font-size:13px;color:#1e293b;">' + d.cgReponse + '</div></div>' : '') +
          '</div>' +
          infoTraitement +
        '</div>';
      }).join('');

      // Attacher boutons impression
      demandes.forEach(function(d) {
        var btnPrint = document.getElementById('tr2v-hist-print-' + d.id);
        if (btnPrint) btnPrint.addEventListener('click', function() { printDemandeShared(d); });
      });
    }

    // ── Stats ────────────────────────────────────────────────
    function renderValidStats() {
      var data = getData();
      var demandes = (data && data.demandesTravaux) ? data.demandesTravaux : [];
      var total   = demandes.length;
      var pending = demandes.filter(function(d){ return d.statut === 'EN ATTENTE'; }).length;
      var valid   = demandes.filter(function(d){ return d.statut === 'VALIDÉE'; }).length;
      var reject  = demandes.filter(function(d){ return d.statut === 'REJETÉE'; }).length;

      document.getElementById('tr2v-stats').innerHTML =
        '<div class="tr2v-stat total"><div class="n">' + total   + '</div><div class="l">Total</div></div>' +
        '<div class="tr2v-stat pending"><div class="n">' + pending + '</div><div class="l">En attente</div></div>' +
        '<div class="tr2v-stat valid"><div class="n">' + valid   + '</div><div class="l">Validées</div></div>' +
        '<div class="tr2v-stat reject"><div class="n">' + reject  + '</div><div class="l">Rejetées</div></div>';

      // Badge bouton flottant
      var badge = document.getElementById('tr2v-float-badge');
      if (badge) {
        badge.style.display = pending > 0 ? '' : 'none';
        badge.textContent = pending;
      }
    }

    // ── Liste des demandes (EN ATTENTE uniquement) ───────────
    function renderValidList(filter) {
      var data = getData();
      var demandes = (data && data.demandesTravaux) ? data.demandesTravaux.slice().reverse() : [];
      // Toujours filtrer : seules les EN ATTENTE s'affichent ici
      demandes = demandes.filter(function(d){ return d.statut === 'EN ATTENTE'; });

      var list = document.getElementById('tr2v-list');
      if (!demandes.length) {
        list.innerHTML = '<div class="tr2v-empty">✅ Aucune demande en attente — <button onclick="document.getElementById(\'tr2v-historique-btn\').click()" style="background:#F3E8FF;color:#6b21a8;border:none;border-radius:8px;padding:6px 14px;font-size:13px;font-weight:700;cursor:pointer;margin-top:8px">📁 Voir l\'historique</button></div>';
        return;
      }

      list.innerHTML = demandes.map(function(d) {
        var badgeHtml = '<span class="tr2v-badge-wait">⏳ En attente</span>';

        var actionsHtml =
          // Champ Observation pour le validateur
          '<div style="background:#EFF6FF;border-radius:10px;padding:12px 14px;margin-bottom:10px;border:1.5px solid #BFDBFE;">' +
            '<label style="font-size:11px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px;">📝 Observation / Remarque (optionnel)</label>' +
            '<textarea class="tr2v-reject-txt" id="obs-' + d.id + '" style="border-color:#BFDBFE;background:#fff;" placeholder="Ajoutez une observation, remarque ou instruction…"></textarea>' +
          '</div>' +
          '<div class="tr2v-reject-wrap" id="rw-' + d.id + '" style="display:none">' +
            '<label>Motif de rejet (optionnel)</label>' +
            '<textarea class="tr2v-reject-txt" id="rtxt-' + d.id + '" placeholder="Précisez le motif de rejet…"></textarea>' +
            '<button class="tr2v-btn-ko" style="margin-top:8px;width:100%" id="rconf-' + d.id + '" data-id="' + d.id + '">❌ Confirmer le rejet</button>' +
          '</div>' +
          '<div class="tr2v-actions">' +
            '<button class="tr2v-btn-ok" data-id="' + d.id + '" id="vok-' + d.id + '">✅ Valider</button>' +
            '<button class="tr2v-btn-ko" data-id="' + d.id + '" id="vko-' + d.id + '" style="background:#f1f5f9;color:#374151">❌ Rejeter</button>' +
          '</div>';

        return '<div class="tr2v-card" id="card-' + d.id + '">' +
          '<div class="tr2v-card-hd">' +
            '<span class="tr2v-card-num">' + (d.numero||'—') + '</span>' +
            badgeHtml +
            '<span class="tr2v-card-date">' + formatDate(d.dateDemande) + '</span>' +
            '<button id="tr2v-print-' + d.id + '" style="background:#003087;color:#fff;border:none;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">🖨️ Imprimer</button>' +
          '</div>' +
          '<div class="tr2v-card-body">' +
            '<div class="tr2v-card-row">' +
              '<div><div class="tr2v-lbl">Demandeur</div><div class="tr2v-val">' + (d.nomDemandeur||'—') + '</div></div>' +
              '<div><div class="tr2v-lbl">Division</div><div class="tr2v-val">' + (d.division||'—') + '</div></div>' +
            '</div>' +
            '<div class="tr2v-card-row">' +
              '<div><div class="tr2v-lbl">Matricule</div><div class="tr2v-val">' + (d.matricule||'—') + '</div></div>' +
              '<div><div class="tr2v-lbl">Marque / Km</div><div class="tr2v-val">' + (d.marque||'—') + (d.indexKm ? ' — ' + d.indexKm + ' km' : '') + '</div></div>' +
            '</div>' +
            '<div class="tr2v-nat"><div class="l">Nature de l\'intervention</div><div class="v">' + (d.natureIntervention||'—') + '</div></div>' +
            (d.cgReponse ? '<div style="background:#EDE9FE;border-left:3px solid #7c3aed;border-radius:0 7px 7px 0;padding:8px 12px;margin:6px 0;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#5b21b6;font-weight:700;margin-bottom:3px;">🏗️ Réponse Chef de Garage</div><div style="font-size:13px;color:#1e293b;">' + d.cgReponse + '</div></div>' : '') +
          '</div>' +
          actionsHtml +
        '</div>';
      }).join('');

      // Attacher les événements
      demandes.forEach(function(d) {
        // Bouton impression
        var btnPrint = document.getElementById('tr2v-print-' + d.id);
        if (btnPrint) btnPrint.addEventListener('click', function() { printDemandeShared(d); });

        // Valider — récupère aussi l'observation
        var btnOk = document.getElementById('vok-' + d.id);
        if (btnOk) btnOk.addEventListener('click', function() {
          var observation = (document.getElementById('obs-' + d.id) || {}).value || '';
          validaterAction(d.id, 'VALIDÉE', observation);
        });

        // Rejeter — afficher textarea
        var btnKo = document.getElementById('vko-' + d.id);
        if (btnKo) btnKo.addEventListener('click', function() {
          var rw = document.getElementById('rw-' + d.id);
          if (rw) { rw.style.display = rw.style.display === 'none' ? '' : 'none'; }
          if (btnOk) { btnOk.disabled = rw.style.display !== 'none'; }
        });

        // Confirmer rejet — récupère observation + motif
        var btnConf = document.getElementById('rconf-' + d.id);
        if (btnConf) btnConf.addEventListener('click', function() {
          var observation = (document.getElementById('obs-' + d.id) || {}).value || '';
          var motif = (document.getElementById('rtxt-' + d.id) || {}).value || '';
          var fullComment = observation ? (observation + (motif ? '\n---\nMotif rejet : ' + motif : '')) : motif;
          validaterAction(d.id, 'REJETÉE', fullComment);
        });
      });
    }

    // ── Action valider / rejeter ─────────────────────────────
    function validaterAction(id, newStatut, comment) {
      // BLOC ADDITIF — SYNCHRO : on relit le serveur avant d'écrire la décision,
      // pour ne pas écraser une demande arrivée entretemps d'un autre poste.
      function doAction() {
        var data = getData();
        if (!data) return;
        var d = (data.demandesTravaux || []).find(function(x){ return x.id === id; });
        if (!d) return;
        d.statut           = newStatut;
        d.commentaire      = comment || d.commentaire || '';
        d.dateTraitement   = new Date().toISOString();
        var sess = getValidSess();
        d.validePar        = sess ? sess.nom : 'Validateur';
        d.valideParTitre   = sess ? getTitreValidateur(sess.nom) : '';
        // BLOC ADDITIF — notifier Chef Garage (reset flag lu)
        if (newStatut === 'VALIDÉE') { d.cgLu = false; d.cgTraite = false; }
        // FIN BLOC ADDITIF
        saveData();
        bipAlert3('valid'); // 🔔 bip × 3 validation/rejet

        if (window.parcAuto && typeof window.parcAuto.showToast === 'function') {
          window.parcAuto.showToast(
            newStatut === 'VALIDÉE' ? '✅ Demande ' + (d.numero||'') + ' validée' : '❌ Demande ' + (d.numero||'') + ' rejetée',
            newStatut === 'VALIDÉE' ? 'success' : 'error'
          );
        }
        renderValidStats();
        // ✅ Basculer automatiquement vers l'historique après validation/rejet
        _histFilter = newStatut; // afficher directement le bon filtre
        vScreen('historique');
        // Mettre à jour le bouton actif dans la barre de filtre historique
        document.getElementById('tr2v-hist-filter-bar').querySelectorAll('.tr2v-hist-fb').forEach(function(b){
          b.classList.toggle('active', b.dataset.hf === _histFilter);
        });
        // ✅ Délai pour laisser le DOM se mettre à jour
        setTimeout(function() {
          var histScreen = document.getElementById('tr2v-sc-historique');
          if (histScreen) {
            histScreen.style.display = 'block';
            void histScreen.offsetHeight;
          }
          renderHistoriqueList(_histFilter);
        }, 100);
      }
      if (typeof window._tr2FetchAndInject === 'function') {
        window._tr2FetchAndInject(doAction);
      } else {
        doAction();
      }
      // FIN BLOC ADDITIF
    }

    // ── Mise à jour badge au démarrage ───────────────────────
    setTimeout(renderValidStats, 2500);

    // BLOC ADDITIF — Polling validateur avec fetch Gist + alerte sonore
    var _vPollLastCount = -1;
    setInterval(function() {
      try {
      // BLOC ADDITIF — ne poller / biper que si une session validateur est active sur cet appareil
      if (!getValidSess()) { _vPollLastCount = -1; return; }
      if (typeof window._tr2FetchAndInject !== 'function') return;
      window._tr2FetchAndInject(function() {
        var data = getData();
        var pendingCount = (data && data.demandesTravaux||[]).filter(function(d){ return d.statut==='EN ATTENTE'; }).length;
        if (_vPollLastCount >= 0 && pendingCount > _vPollLastCount) {
          bipAlert3('new');
          var vOverlay = document.getElementById('tr2v-overlay');
          if (vOverlay && vOverlay.classList.contains('open')) {
            var vSess = getValidSess();
            if (vSess) renderValidList('EN ATTENTE');
          }
        }
        _vPollLastCount = pendingCount;
        renderValidStats();
      });
      } catch(e) { console.warn('[TR2 poll validateur]', e); }
    }, 15000);
    // FIN BLOC ADDITIF — Polling validateur
  }
  // FIN BLOC ADDITIF — INTERFACE VALIDATEUR

  // ══════════════════════════════════════════════════════════
  // BLOC ADDITIF — INTERFACE CHEF GARAGE
  // ══════════════════════════════════════════════════════════
  function initChefGarageInterface() {

    // ── Bouton flottant ──────────────────────────────────────
    var cgBtn = document.createElement('button');
    cgBtn.id = 'tr2cg-open-btn';
    cgBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.07 4.93a10 10 0 0 1 0 14.14\"/><path d=\"M4.93 4.93a10 10 0 0 0 0 14.14\"/><path d=\"M15.54 8.46a5 5 0 0 1 0 7.07\"/><path d=\"M8.46 8.46a5 5 0 0 0 0 7.07\"/></svg> Chef Garage <span class="badge" id="tr2cg-badge" style="display:none">0</span>';
    var _tr2Bar2 = document.getElementById('tr2-bottom-bar');
    if (!_tr2Bar2) { _tr2Bar2 = document.createElement('div'); _tr2Bar2.id = 'tr2-bottom-bar'; document.body.appendChild(_tr2Bar2); }
    _tr2Bar2.appendChild(cgBtn);

    // ── Modal Chef Garage ────────────────────────────────────
    var cgOverlay = document.createElement('div');
    cgOverlay.id = 'tr2cg-overlay';
    cgOverlay.innerHTML =
      '<div id="tr2cg-modal" role="dialog" aria-modal="true">' +
        '<div class="tr2cg-hd">' +
          '<div><h2>🏗️ Chef de Garage</h2><p id="tr2cg-user-lbl">Parc Auto DRT Sfax</p></div>' +
          '<button class="tr2cg-x" id="tr2cg-close">✕</button>' +
        '</div>' +
        '<div class="tr2cg-bd">' +

          // ── Écran Login Chef Garage ──
          '<div id="tr2cg-sc-login">' +
            '<div style="text-align:center;padding:10px 0 18px">' +
              '<div style="font-size:44px;margin-bottom:10px">🏗️</div>' +
              '<h3 style="color:#1e293b;font-size:16px;font-weight:700;margin:0 0 4px">Espace Chef de Garage</h3>' +
              '<p style="color:#64748b;font-size:13px;margin:0 0 20px">Accès aux demandes validées</p>' +
            '</div>' +
            '<div id="tr2cg-login-err" style="display:none;background:#FEE2E2;color:#991b1b;border-radius:8px;padding:9px 13px;font-size:13px;margin-bottom:12px;"></div>' +
            '<div style="margin-bottom:14px;">' +
              '<label style="display:block;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Mot de passe</label>' +
              '<input type="password" id="tr2cg-pwd" placeholder="••••••••••" autocomplete="current-password" style="width:100%;box-sizing:border-box;padding:10px 13px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:14px;outline:none;font-family:inherit;">' +
            '</div>' +
            '<button style="width:100%;padding:13px;background:linear-gradient(135deg,#064e3b,#065f46);color:#fff;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;" id="tr2cg-login-btn">🚪 Accéder</button>' +
          '</div>' +

          // ── Écran Principal Chef Garage ──
          '<div id="tr2cg-sc-main" style="display:none;">' +
            '<div class="tr2cg-user-bar">' +
              '<span>👷 <span id="tr2cg-nom-bar">—</span> — Chef de Parc</span>' +
              '<button class="tr2cg-logout" id="tr2cg-logout-btn">🚪 Déconnecter</button>' +
            '</div>' +
            '<div class="tr2cg-stats">' +
              '<div class="tr2cg-stat total"><div class="n" id="tr2cg-st-total">0</div><div class="l">Reçues</div></div>' +
              '<div class="tr2cg-stat new"><div class="n" id="tr2cg-st-new">0</div><div class="l">Nouvelles</div></div>' +
              '<div class="tr2cg-stat done"><div class="n" id="tr2cg-st-done">0</div><div class="l">Traitées</div></div>' +
            '</div>' +
            '<div class="tr2cg-filter-bar">' +
              '<button class="tr2cg-fb active" data-cgf="TOUS">Toutes</button>' +
              '<button class="tr2cg-fb" data-cgf="NOUVEAU">🟠 Nouvelles</button>' +
              '<button class="tr2cg-fb" data-cgf="TRAITÉ">✅ Traitées</button>' +
            '</div>' +
            '<div id="tr2cg-list"></div>' +
          '</div>' +

        '</div>' +
      '</div>';
    document.body.appendChild(cgOverlay);

    // BLOC ADDITIF — Modal Observation + Réponse Chef Garage
    var cgObsModal = document.createElement('div');
    cgObsModal.id = 'tr2cg-obs-modal';
    cgObsModal.innerHTML =
      '<div id="tr2cg-obs-box">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
          '<h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b;">✍️ Observation & Réponse</h3>' +
          '<button id="tr2cg-obs-close" style="background:#f1f5f9;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:16px;">✕</button>' +
        '</div>' +
        '<div id="tr2cg-obs-deminfo" style="background:#f8fafc;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#374151;"></div>' +
        '<div style="margin-bottom:14px;">' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">📝 Observation du Chef de Garage</label>' +
          '<textarea id="tr2cg-obs-text" rows="4" placeholder="Saisissez votre observation sur cette demande…" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;font-family:inherit;resize:vertical;outline:none;"></textarea>' +
        '</div>' +
        '<div style="margin-bottom:18px;">' +
          '<label style="display:block;font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">💬 Réponse (visible demandeur + validateurs)</label>' +
          '<textarea id="tr2cg-rep-text" rows="3" placeholder="Réponse envoyée au demandeur et aux validateurs…" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #c4b5fd;border-radius:9px;font-size:13px;font-family:inherit;resize:vertical;outline:none;"></textarea>' +
        '</div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
          '<button id="tr2cg-obs-cancel" style="background:#f1f5f9;color:#374151;border:none;border-radius:9px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;">Annuler</button>' +
          '<button id="tr2cg-obs-save" style="background:linear-gradient(135deg,#064e3b,#065f46);color:#fff;border:none;border-radius:9px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;">💾 Enregistrer & Envoyer</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(cgObsModal);

    var _cgObsCurrentId = null;

    function openCGObsModal(dem) {
      _cgObsCurrentId = dem.id;
      var info = document.getElementById('tr2cg-obs-deminfo');
      if (info) info.innerHTML =
        '<strong>' + (dem.numero||'—') + '</strong> — ' + (dem.nomDemandeur||'—') +
        ' &nbsp;|&nbsp; Matricule : <strong>' + (dem.matricule||'—') + '</strong>' +
        ' &nbsp;|&nbsp; Validé par : <strong>' + (dem.validePar||'—') + '</strong>';
      var obsEl = document.getElementById('tr2cg-obs-text');
      var repEl = document.getElementById('tr2cg-rep-text');
      if (obsEl) obsEl.value = dem.cgObservation || '';
      if (repEl) repEl.value = dem.cgReponse || '';
      cgObsModal.classList.add('open');
      setTimeout(function(){ if (obsEl) obsEl.focus(); }, 100);
    }

    function closeCGObsModal() {
      cgObsModal.classList.remove('open');
      _cgObsCurrentId = null;
    }

    document.getElementById('tr2cg-obs-close').addEventListener('click', closeCGObsModal);
    document.getElementById('tr2cg-obs-cancel').addEventListener('click', closeCGObsModal);
    cgObsModal.addEventListener('click', function(e){ if (e.target === cgObsModal) closeCGObsModal(); });

    document.getElementById('tr2cg-obs-save').addEventListener('click', function() {
      if (!_cgObsCurrentId) return;
      var idToSave = _cgObsCurrentId;
      var obsVal = (document.getElementById('tr2cg-obs-text') || {}).value || '';
      var repVal = (document.getElementById('tr2cg-rep-text') || {}).value || '';
      // BLOC ADDITIF — SYNCHRO : on relit le serveur avant d'écrire la réponse.
      function doAction() {
        var data = getData();
        var dem = (data && data.demandesTravaux || []).find(function(x){ return x.id === idToSave; });
        if (!dem) return;
        dem.cgObservation = obsVal.trim();
        dem.cgReponse     = repVal.trim();
        dem.cgReponsePar  = 'Chef de Parc';
        dem.cgReponseDate = new Date().toISOString();
        saveData();
        closeCGObsModal();
        renderCGList(_cgFilter);
        if (window.parcAuto && typeof window.parcAuto.showToast === 'function') {
          window.parcAuto.showToast('✅ Observation et réponse enregistrées', 'success');
        }
        bipAlert3('valid'); // son confirmation réponse enregistrée
      }
      if (typeof window._tr2FetchAndInject === 'function') {
        window._tr2FetchAndInject(doAction);
      } else {
        doAction();
      }
      // FIN BLOC ADDITIF
    });
    // FIN BLOC ADDITIF — Modal Observation + Réponse Chef Garage

    // ── Navigation écrans ────────────────────────────────────
    function cgScreen(n) {
      document.getElementById('tr2cg-sc-login').style.display = n === 'login' ? '' : 'none';
      document.getElementById('tr2cg-sc-main').style.display  = n === 'main'  ? '' : 'none';
    }

    // ── Stats + badge ────────────────────────────────────────
    function renderCGStats() {
      var data = getData();
      var all = (data && data.demandesTravaux || []).filter(function(d){ return d.statut === 'VALIDÉE'; });
      var newCount = all.filter(function(d){ return !d.cgLu; }).length;
      var doneCount = all.filter(function(d){ return d.cgTraite; }).length;
      var stTotal = document.getElementById('tr2cg-st-total');
      var stNew   = document.getElementById('tr2cg-st-new');
      var stDone  = document.getElementById('tr2cg-st-done');
      if (stTotal) stTotal.textContent = all.length;
      if (stNew)   stNew.textContent   = newCount;
      if (stDone)  stDone.textContent  = doneCount;
      // Badge flottant
      var badge = document.getElementById('tr2cg-badge');
      if (badge) {
        badge.textContent = newCount;
        badge.style.display = newCount > 0 ? 'inline-block' : 'none';
      }
    }

    // ── Rendu liste demandes validées ───────────────────────
    var _cgFilter = 'TOUS';

    function renderCGList(filter) {
      _cgFilter = filter || 'TOUS';
      var data = getData();
      var all = (data && data.demandesTravaux || [])
        .filter(function(d){ return d.statut === 'VALIDÉE'; })
        .slice().reverse();
      var demandes = all;
      if (_cgFilter === 'NOUVEAU') demandes = all.filter(function(d){ return !d.cgLu; });
      if (_cgFilter === 'TRAITÉ')  demandes = all.filter(function(d){ return !!d.cgTraite; });
      var list = document.getElementById('tr2cg-list');
      if (!list) return;
      if (!demandes.length) {
        list.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#94a3b8;font-size:14px;">📭 Aucune demande' + (_cgFilter !== 'TOUS' ? ' dans cette catégorie' : ' validée pour le moment') + '</div>';
        return;
      }

      // Marquer comme lues
      demandes.forEach(function(d) {
        if (!d.cgLu) {
          d.cgLu = true;
          // pas de saveData ici pour ne pas spammer — on sauve à la fin
        }
      });
      saveData();
      renderCGStats();

      list.innerHTML = demandes.map(function(d) {
        var isNew  = !d.cgTraite;
        var km     = parseInt(d.indexKm||0).toLocaleString('fr-FR');
        var obsHtml = d.commentaire
          ? '<div class="tr2cg-obs"><div class="tr2cg-lbl" style="color:#1d4ed8;">💬 Observation du validateur</div><div style="font-size:13px;color:#1e293b;margin-top:4px;">' + d.commentaire + '</div></div>'
          : '';
        // BLOC ADDITIF — observation chef garage + réponse
        var cgObsHtml = d.cgObservation
          ? '<div class="tr2cg-cgobs"><div class="tr2cg-lbl" style="color:#7c3aed;">🏗️ Observation Chef de Garage</div><div style="font-size:13px;color:#1e293b;margin-top:4px;">' + d.cgObservation + '</div></div>'
          : '';
        var cgRepHtml = d.cgReponse
          ? '<div style="background:#EDE9FE;border-left:4px solid #7c3aed;border-radius:0 8px 8px 0;padding:10px 14px;margin:8px 0;">' +
              '<div class="tr2cg-lbl" style="color:#5b21b6;">💬 Réponse Chef de Garage</div>' +
              '<div style="font-size:13px;color:#1e293b;margin-top:4px;line-height:1.5;">' + d.cgReponse + '</div>' +
              '<div style="font-size:10px;color:#94a3b8;margin-top:4px;">' + formatDate(d.cgReponseDate) + '</div>' +
            '</div>'
          : '';
        var sigHtml = '';
        // FIN BLOC ADDITIF
        var traiteBadge = d.cgTraite
          ? '<span style="background:#D1FAE5;color:#065f46;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;">✅ Traité</span>'
          : '<span style="background:#FEF3E2;color:#92400e;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;">🟠 Nouveau</span>';
        return '<div class="tr2cg-card' + (isNew && !d.cgTraite ? ' new-card' : '') + '" id="cgcard-' + d.id + '">' +
          '<div class="tr2cg-card-hd">' +
            '<span style="font-weight:800;color:#064e3b;font-size:14px;">' + (d.numero||'—') + '</span>' +
            '<span class="tr2v-badge-ok">✅ Validée</span>' +
            traiteBadge +
            '<span style="font-size:12px;color:#64748b;flex:1;text-align:right;">' + formatDate(d.dateTraitement||d.dateDemande) + '</span>' +
            '<button id="tr2cg-print-' + d.id + '" style="background:#003087;color:#fff;border:none;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">🖨️</button>' +
          '</div>' +
          '<div class="tr2cg-card-body">' +
            '<div class="tr2cg-card-row">' +
              '<div><div class="tr2cg-lbl">Demandeur</div><div class="tr2cg-val">' + (d.nomDemandeur||'—') + '</div></div>' +
              '<div><div class="tr2cg-lbl">Division / Subdivision</div><div class="tr2cg-val">' + (d.division||'—') + ' / ' + (d.subdivision||'—') + '</div></div>' +
            '</div>' +
            '<div class="tr2cg-card-row">' +
              '<div><div class="tr2cg-lbl">Matricule</div><div class="tr2cg-val">' + (d.matricule||'—') + '</div></div>' +
              '<div><div class="tr2cg-lbl">Marque / Km</div><div class="tr2cg-val">' + (d.marque||'—') + ' — ' + km + ' km</div></div>' +
            '</div>' +
            '<div class="tr2cg-card-row">' +
              '<div><div class="tr2cg-lbl">Validé par</div><div class="tr2cg-val">' + (d.validePar||'—') + '</div></div>' +
              '<div><div class="tr2cg-lbl">Date validation</div><div class="tr2cg-val">' + formatDate(d.dateTraitement) + '</div></div>' +
            '</div>' +
            '<div class="tr2cg-nat"><div class="tr2cg-lbl">Nature de l\'intervention</div><div style="font-size:13px;color:#1e293b;margin-top:4px;line-height:1.5;">' + (d.natureIntervention||'—') + '</div></div>' +
            obsHtml +
            cgObsHtml +
            cgRepHtml +
            sigHtml +
            '<div style="margin-top:10px;display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;">' +
              '<button class="tr2cg-rep-btn" id="tr2cg-obs-btn-' + d.id + '">✍️ Observation / Répondre' + (d.cgReponse ? '<span class="tr2-cgr-badge">✓</span>' : '') + '</button>' +
              '<button class="tr2cg-done-btn' + (d.cgTraite ? ' done' : '') + '" id="tr2cg-done-' + d.id + '" data-id="' + d.id + '">' + (d.cgTraite ? '✅ Traité' : '🔧 Marquer traité') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      // Événements
      demandes.forEach(function(d) {
        var btnPrint = document.getElementById('tr2cg-print-' + d.id);
        if (btnPrint) btnPrint.addEventListener('click', function() { printDemandeShared(d); });
        // BLOC ADDITIF — bouton Observation/Répondre
        var btnObs = document.getElementById('tr2cg-obs-btn-' + d.id);
        if (btnObs) btnObs.addEventListener('click', (function(dem) {
          return function() {
            // Recharger l'objet frais depuis getData()
            var fresh = (getData().demandesTravaux || []).find(function(x){ return x.id === dem.id; }) || dem;
            openCGObsModal(fresh);
          };
        })(d));
        // FIN BLOC ADDITIF
        var btnDone = document.getElementById('tr2cg-done-' + d.id);
        if (btnDone) btnDone.addEventListener('click', function() {
          // BLOC ADDITIF — SYNCHRO : on relit le serveur avant de basculer le statut.
          function doAction() {
            var data2 = getData();
            var dem = (data2 && data2.demandesTravaux || []).find(function(x){ return x.id === d.id; });
            if (dem) {
              dem.cgTraite = !dem.cgTraite;
              saveData();
              renderCGList(_cgFilter);
              renderCGStats();
            }
          }
          if (typeof window._tr2FetchAndInject === 'function') {
            window._tr2FetchAndInject(doAction);
          } else {
            doAction();
          }
          // FIN BLOC ADDITIF
        });
      });
    }

    // ── Login ────────────────────────────────────────────────
    function doCGLogin() {
      var pwd = (document.getElementById('tr2cg-pwd') || {}).value || '';
      var nom = resolveCG(pwd.trim());
      var errEl = document.getElementById('tr2cg-login-err');
      if (nom) {
        setCGSess(nom);
        errEl.style.display = 'none';
        document.getElementById('tr2cg-nom-bar').textContent = nom;
        cgScreen('main');
        renderCGStats();
        renderCGList('TOUS');
      } else {
        errEl.textContent = 'Mot de passe incorrect.';
        errEl.style.display = 'block';
        document.getElementById('tr2cg-pwd').value = '';
      }
    }

    // ── Ouverture modal ──────────────────────────────────────
    cgBtn.addEventListener('click', function() {
      cgOverlay.classList.add('open');
      var sess = getCGSess();
      if (sess) {
        document.getElementById('tr2cg-nom-bar').textContent = sess.nom;
        cgScreen('main');
        renderCGStats();
        renderCGList('TOUS');
      } else {
        cgScreen('login');
        document.getElementById('tr2cg-pwd').value = '';
        document.getElementById('tr2cg-login-err').style.display = 'none';
        setTimeout(function(){ document.getElementById('tr2cg-pwd').focus(); }, 120);
      }
    });

    document.getElementById('tr2cg-close').addEventListener('click', function() { cgOverlay.classList.remove('open'); });
    cgOverlay.addEventListener('click', function(e){ if (e.target === cgOverlay) cgOverlay.classList.remove('open'); });

    document.getElementById('tr2cg-login-btn').addEventListener('click', doCGLogin);
    document.getElementById('tr2cg-pwd').addEventListener('keydown', function(e){ if (e.key === 'Enter') doCGLogin(); });

    document.getElementById('tr2cg-logout-btn').addEventListener('click', function() {
      if (!confirm('Se déconnecter de l\'espace Chef Garage ?')) return;
      delCGSess();
      cgScreen('login');
      document.getElementById('tr2cg-pwd').value = '';
    });

    // ── Filtres ──────────────────────────────────────────────
    cgOverlay.querySelectorAll('.tr2cg-fb').forEach(function(btn) {
      btn.addEventListener('click', function() {
        cgOverlay.querySelectorAll('.tr2cg-fb').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        renderCGList(btn.dataset.cgf);
      });
    });

    // ── Polling badge toutes les 10s ─────────────────────────
    var _cgPollLastNew = -1;
    setInterval(function() {
      try {
      // BLOC ADDITIF — ne poller / biper que si une session chef garage est active sur cet appareil
      if (!getCGSess()) { _cgPollLastNew = -1; return; }
      if (typeof window._tr2FetchAndInject !== 'function') return;
      window._tr2FetchAndInject(function() {
        var data = getData();
        var newCount = (data && data.demandesTravaux||[]).filter(function(d){ return d.statut==='VALIDÉE' && !d.cgLu; }).length;
        if (_cgPollLastNew >= 0 && newCount > _cgPollLastNew) {
          bipAlert3('new');
          var cgo = document.getElementById('tr2cg-overlay');
          if (cgo && cgo.classList.contains('open')) {
            var cgs = getCGSess();
            if (cgs) renderCGList(_cgFilter);
          }
        }
        _cgPollLastNew = newCount;
        renderCGStats();
      });
      } catch(e) { console.warn('[TR2 poll chef garage]', e); }
    }, 15000);
    setTimeout(renderCGStats, 3000);
  }
  // FIN BLOC ADDITIF — INTERFACE CHEF GARAGE

  // ══════════════════════════════════════════════════════════
  // INIT — détecter le contexte (admin ou user)
  // ══════════════════════════════════════════════════════════
  function init() {
    var isAdmin = !!document.querySelector('.nav-item[data-nav]')
               || window.location.href.includes('admin');

    if (isAdmin) {
      initAdminTab();
    }

    // Formulaire utilisateur (index.html) — bouton déjà dans index.html
    if (document.getElementById('tr2-overlay') === null) {
      initUserForm();
    }

    // Interface validateur (index.html uniquement)
    if (!isAdmin) {
      initValidateurInterface();
      // BLOC ADDITIF — Interface Chef Garage
      initChefGarageInterface();
      // FIN BLOC ADDITIF
    }
  }

  // BLOC ADDITIF — stub global anticipé (évite ReferenceError si clic avant DOMContentLoaded)
  if (typeof window.openTravauxModal !== 'function') {
    window.openTravauxModal = function() {
      // init() n'a pas encore tourné → on attend et on réessaie
      var attempts = 0;
      var retry = setInterval(function() {
        attempts++;
        var overlay = document.getElementById('tr2-overlay');
        if (overlay) {
          clearInterval(retry);
          overlay.classList.add('open');
        } else if (attempts > 20) {
          clearInterval(retry);
          console.warn('[TravauxV2] tr2-overlay introuvable après init');
        }
      }, 100);
    };
  }
  // FIN BLOC ADDITIF

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
/* FIN BLOC ADDITIF — demande_travaux_v2.js */
