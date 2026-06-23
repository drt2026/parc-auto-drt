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

  const TRAVAUX_PWD   = 'parcdrtsfax';
  const SESSION_KEY   = 'tr_sess_v2';
  const SESSION_TTL   = 8 * 3600 * 1000;

  // ── Utilitaires session ───────────────────────────────────
  function getSess()  { try { var s = JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null'); return s && Date.now() < s.e ? s : null; } catch(e){ return null; } }
  function setSess()  { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ e: Date.now() + SESSION_TTL })); }
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

    /* ── badge nav ── */
    .tr2-nav-badge { display:inline-block; background:#E67E22; color:#fff;
      border-radius:10px; font-size:10px; font-weight:700;
      padding:1px 6px; margin-left:6px; vertical-align:middle; }

    /* ── export btn ── */
    .tr2-export-btn { padding:8px 16px; background:#27AE60; color:#fff; border:none;
      border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; transition:opacity .2s; }
    .tr2-export-btn:hover { opacity:.85; }
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
                <input type="text" id="tr2-nom" placeholder="Prénom Nom">
              </div>
              <div class="tr2-f">
                <label>Division <em>*</em></label>
                <input type="text" id="tr2-div" placeholder="Ex: Division Réseau">
              </div>
            </div>
            <div class="tr2-row">
              <div class="tr2-f">
                <label>Matricule véhicule <em>*</em></label>
                <input type="text" id="tr2-mat" placeholder="Ex: 17-353430">
              </div>
              <div class="tr2-f">
                <label>Marque <em>*</em></label>
                <input type="text" id="tr2-marq" placeholder="Ex: Berlingo">
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

        </div>
      </div>`;
    document.body.appendChild(overlayEl);

    function trScreen(n) {
      document.getElementById('tr2-sc-login').style.display = n==='login' ? '' : 'none';
      document.getElementById('tr2-sc-form').style.display  = n==='form'  ? '' : 'none';
      document.getElementById('tr2-sc-ok').style.display    = n==='ok'    ? '' : 'none';
    }

    window.openTravauxModal = function() {
      document.getElementById('tr2-overlay').classList.add('open');
      if (getSess()) {
        document.getElementById('tr2-date').value = new Date().toISOString().slice(0,10);
        trScreen('form');
        setTimeout(function(){ document.getElementById('tr2-nom').focus(); }, 100);
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
      if (pwd === TRAVAUX_PWD) {
        setSess();
        err.classList.remove('show');
        document.getElementById('tr2-date').value = new Date().toISOString().slice(0,10);
        trScreen('form');
        setTimeout(function(){ document.getElementById('tr2-nom').focus(); }, 100);
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

    // Soumettre
    document.getElementById('tr2-submit-btn').addEventListener('click', function() {
      var ids  = ['tr2-nom','tr2-div','tr2-mat','tr2-marq','tr2-date','tr2-km','tr2-nat'];
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
        var num = nextNumero();
        var demande = {
          id:                 'dt_' + Date.now(),
          numero:             num,
          nomDemandeur:       vals['tr2-nom'],
          division:           vals['tr2-div'],
          matricule:          vals['tr2-mat'],
          marque:             vals['tr2-marq'],
          dateDemande:        vals['tr2-date'],
          indexKm:            vals['tr2-km'],
          natureIntervention: vals['tr2-nat'],
          statut:             'EN ATTENTE',
          dateCreation:       new Date().toISOString(),
          commentaire:        ''
        };
        data.demandesTravaux.push(demande);
        saveData();
        document.getElementById('tr2-num-ok').textContent = 'N° ' + num;
        trScreen('ok');
      }
      trySubmit();
    });

    // Nouvelle demande
    document.getElementById('tr2-new-btn').addEventListener('click', function() {
      ['tr2-nom','tr2-div','tr2-mat','tr2-marq','tr2-km','tr2-nat'].forEach(function(id) {
        document.getElementById(id).value = '';
      });
      document.getElementById('tr2-date').value = new Date().toISOString().slice(0,10);
      document.getElementById('tr2-form-err').classList.remove('show');
      trScreen('form');
      setTimeout(function(){ document.getElementById('tr2-nom').focus(); }, 100);
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
          <button class="tr2-det-btn tr2-det-close"  id="tr2-det-close-btn">Fermer</button>`;
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
        // Focus automatique si mode rejet
        if (mode === 'reject') {
          setTimeout(function() {
            var ci = document.getElementById('tr2-comment-input');
            if (ci) ci.focus();
          }, 150);
        }
      } else {
        actionsEl.innerHTML = `<button class="tr2-det-btn tr2-det-close" id="tr2-det-close-btn" style="width:100%">Fermer</button>`;
        document.getElementById('tr2-det-close-btn').addEventListener('click', function() {
          detailOverlay.classList.remove('open');
        });
      }

      detailOverlay.classList.add('open');
    }

    function changeStatut(id, newStatut, comment) {
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
      var header = ['N°','Date demande','Demandeur','Division','Matricule','Marque','Index km','Nature intervention','Statut','Commentaire','Date création','Date traitement'];
      var rows = demandes.slice().reverse().map(function(d) {
        return [
          d.numero||'',
          d.dateDemande||'',
          d.nomDemandeur||'',
          d.division||'',
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
/* FIN BLOC ADDITIF — demande_travaux_v2.js */
