/* ============================================
   BLOC ADDITIF — MODULE DEMANDE DE TRAVAUX
   Fichier : demande_travaux.js
   À inclure dans admin.html APRÈS app.js :
   <script src="demande_travaux.js"></script>
   ============================================ */

(function () {
  'use strict';

  // ── Config ───────────────────────────────────────────────
  const TRAVAUX_PASSWORD = 'parcdrtsfax';
  const WORKER_URL = 'https://wandering-sound-cd2f.drtsfaxparauto.workers.dev';
  const SESSION_KEY = 'travaux_session';
  const SESSION_TTL = 8 * 60 * 60 * 1000; // 8h

  // ── Injection CSS ─────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* ── Demande Travaux ── */
    #travaux-overlay {
      display:none; position:fixed; inset:0; z-index:9000;
      background:rgba(0,0,0,0.55); backdrop-filter:blur(4px);
      align-items:center; justify-content:center;
    }
    #travaux-overlay.open { display:flex; }

    #travaux-modal {
      background:#fff; border-radius:20px; width:min(560px,94vw);
      max-height:92vh; overflow-y:auto; box-shadow:0 24px 64px rgba(0,0,0,0.22);
      animation: trSlideUp .28s cubic-bezier(.22,1,.36,1);
    }
    @keyframes trSlideUp {
      from { opacity:0; transform:translateY(32px); }
      to   { opacity:1; transform:translateY(0); }
    }

    .tr-header {
      background:linear-gradient(135deg,#1A1A2E 0%,#16213E 100%);
      border-radius:20px 20px 0 0; padding:24px 28px;
      display:flex; align-items:center; justify-content:space-between;
    }
    .tr-header h2 { color:#fff; margin:0; font-size:18px; font-weight:700; }
    .tr-header p  { color:#94a3b8; margin:2px 0 0; font-size:12px; }
    .tr-close {
      background:rgba(255,255,255,.12); border:none; color:#fff;
      width:34px; height:34px; border-radius:50%; cursor:pointer;
      font-size:18px; display:flex; align-items:center; justify-content:center;
    }
    .tr-close:hover { background:rgba(255,255,255,.22); }

    .tr-body { padding:24px 28px; }

    /* Login screen */
    #tr-login { }
    .tr-lock-icon { text-align:center; font-size:48px; margin-bottom:12px; }
    .tr-login-title { text-align:center; color:#1e293b; font-size:16px; font-weight:700; margin:0 0 4px; }
    .tr-login-sub   { text-align:center; color:#64748b; font-size:13px; margin:0 0 20px; }

    .tr-field { margin-bottom:16px; }
    .tr-field label {
      display:block; font-size:12px; font-weight:600; color:#374151;
      text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px;
    }
    .tr-field label span.required { color:#E67E22; margin-left:2px; }
    .tr-field input, .tr-field textarea, .tr-field select {
      width:100%; box-sizing:border-box; padding:11px 14px;
      border:1.5px solid #e2e8f0; border-radius:10px; font-size:14px;
      color:#1e293b; background:#f8fafc; outline:none; transition:border-color .2s;
      font-family:inherit;
    }
    .tr-field input:focus, .tr-field textarea:focus, .tr-field select:focus {
      border-color:#E67E22; background:#fff;
    }
    .tr-field input.error, .tr-field textarea.error { border-color:#C0392B; }
    .tr-field textarea { resize:vertical; min-height:88px; }

    .tr-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    @media(max-width:480px){ .tr-row { grid-template-columns:1fr; } }

    .tr-btn {
      width:100%; padding:13px; border:none; border-radius:12px;
      font-size:15px; font-weight:700; cursor:pointer; transition:opacity .2s, transform .15s;
      margin-top:8px;
    }
    .tr-btn:hover:not(:disabled) { opacity:.88; transform:translateY(-1px); }
    .tr-btn:disabled { opacity:.45; cursor:not-allowed; }
    .tr-btn-primary { background:linear-gradient(135deg,#E67E22,#d35400); color:#fff; }
    .tr-btn-secondary { background:#f1f5f9; color:#374151; }

    .tr-error-msg {
      background:#FDECEA; color:#C0392B; border-radius:8px;
      padding:10px 14px; font-size:13px; margin-bottom:14px; display:none;
    }
    .tr-error-msg.show { display:block; }

    .tr-success {
      text-align:center; padding:20px 0;
    }
    .tr-success .tr-success-icon { font-size:52px; margin-bottom:12px; }
    .tr-success h3 { color:#1e293b; font-size:18px; margin:0 0 6px; }
    .tr-success p  { color:#64748b; font-size:13px; margin:0 0 20px; }
    .tr-num-badge {
      display:inline-block; background:#E67E22; color:#fff;
      padding:5px 18px; border-radius:20px; font-size:13px; font-weight:700;
      margin-bottom:18px;
    }

    .tr-divider { height:1px; background:#f1f5f9; margin:16px 0; }

    /* Bouton dans le menu admin */
    .nav-travaux-btn {
      display:flex; align-items:center; gap:10px; padding:10px 16px;
      background:linear-gradient(135deg,#E67E22,#d35400);
      border-radius:10px; color:#fff; font-size:13px; font-weight:600;
      cursor:pointer; border:none; width:100%; text-align:left;
      transition:opacity .2s; margin-top:4px;
    }
    .nav-travaux-btn:hover { opacity:.88; }
  `;
  document.head.appendChild(style);

  // ── Injection HTML ─────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'travaux-overlay';
  overlay.innerHTML = `
    <div id="travaux-modal" role="dialog" aria-modal="true" aria-label="Demande de Travaux">
      <div class="tr-header">
        <div>
          <h2>🔧 Demande de Travaux</h2>
          <p>Parc Auto DRT Sfax — Tunisie Telecom</p>
        </div>
        <button class="tr-close" id="tr-close-btn" aria-label="Fermer">✕</button>
      </div>
      <div class="tr-body">

        <!-- ① Écran Login -->
        <div id="tr-login">
          <div class="tr-lock-icon">🔒</div>
          <h3 class="tr-login-title">Accès restreint</h3>
          <p class="tr-login-sub">Entrez le mot de passe pour accéder aux demandes de travaux</p>
          <div class="tr-error-msg" id="tr-login-error"></div>
          <div class="tr-field">
            <label>Mot de passe <span class="required">*</span></label>
            <input type="password" id="tr-pwd-input" placeholder="••••••••••••" autocomplete="current-password">
          </div>
          <button class="tr-btn tr-btn-primary" id="tr-login-btn">Accéder</button>
        </div>

        <!-- ② Formulaire -->
        <div id="tr-form" style="display:none;">
          <div class="tr-error-msg" id="tr-form-error"></div>

          <div class="tr-row">
            <div class="tr-field">
              <label>Nom du demandeur <span class="required">*</span></label>
              <input type="text" id="tr-nom" placeholder="Prénom Nom" autocomplete="name">
            </div>
            <div class="tr-field">
              <label>Division <span class="required">*</span></label>
              <input type="text" id="tr-division" placeholder="Ex: Division Réseau">
            </div>
          </div>

          <div class="tr-row">
            <div class="tr-field">
              <label>Matricule véhicule <span class="required">*</span></label>
              <input type="text" id="tr-matricule" placeholder="Ex: 17-357078">
            </div>
            <div class="tr-field">
              <label>Marque <span class="required">*</span></label>
              <input type="text" id="tr-marque" placeholder="Ex: Berlingo, Kangoo…">
            </div>
          </div>

          <div class="tr-row">
            <div class="tr-field">
              <label>Date de la demande <span class="required">*</span></label>
              <input type="date" id="tr-date">
            </div>
            <div class="tr-field">
              <label>Index kilométrique <span class="required">*</span></label>
              <input type="number" id="tr-km" placeholder="Ex: 45200" min="0">
            </div>
          </div>

          <div class="tr-field">
            <label>Nature de l'intervention demandée <span class="required">*</span></label>
            <textarea id="tr-nature" placeholder="Décrivez les travaux à effectuer…"></textarea>
          </div>

          <div class="tr-divider"></div>
          <button class="tr-btn tr-btn-primary" id="tr-submit-btn">
            📨 Envoyer la demande
          </button>
          <button class="tr-btn tr-btn-secondary" id="tr-logout-btn" style="margin-top:8px;">
            🔒 Verrouiller
          </button>
        </div>

        <!-- ③ Succès -->
        <div id="tr-success" style="display:none;">
          <div class="tr-success">
            <div class="tr-success-icon">✅</div>
            <h3>Demande envoyée !</h3>
            <div class="tr-num-badge" id="tr-num-display"></div>
            <p>La demande a été transmise aux 4 collaborateurs du service matériels roulants.</p>
            <button class="tr-btn tr-btn-primary" id="tr-new-btn">➕ Nouvelle demande</button>
          </div>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // ── Session helpers ───────────────────────────────────────
  function getSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (s && Date.now() < s.expiry) return s;
    } catch {}
    return null;
  }
  function setSession() {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ expiry: Date.now() + SESSION_TTL }));
  }
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // ── Écrans ────────────────────────────────────────────────
  function showScreen(name) {
    document.getElementById('tr-login').style.display   = name === 'login'   ? '' : 'none';
    document.getElementById('tr-form').style.display    = name === 'form'    ? '' : 'none';
    document.getElementById('tr-success').style.display = name === 'success' ? '' : 'none';
  }

  function openModal() {
    overlay.classList.add('open');
    if (getSession()) {
      showScreen('form');
      document.getElementById('tr-nom').focus();
    } else {
      showScreen('login');
      document.getElementById('tr-pwd-input').value = '';
      document.getElementById('tr-login-error').classList.remove('show');
      document.getElementById('tr-pwd-input').focus();
    }
  }
  function closeModal() {
    overlay.classList.remove('open');
  }

  // ── Login ─────────────────────────────────────────────────
  function doLogin() {
    const pwd = document.getElementById('tr-pwd-input').value.trim();
    const err = document.getElementById('tr-login-error');
    if (pwd === TRAVAUX_PASSWORD) {
      setSession();
      err.classList.remove('show');
      // Pre-fill date
      document.getElementById('tr-date').value = new Date().toISOString().slice(0, 10);
      showScreen('form');
      document.getElementById('tr-nom').focus();
    } else {
      err.textContent = 'Mot de passe incorrect. Veuillez réessayer.';
      err.classList.add('show');
      document.getElementById('tr-pwd-input').value = '';
      document.getElementById('tr-pwd-input').focus();
    }
  }

  // ── Soumission ────────────────────────────────────────────
  async function submitDemande() {
    const fields = {
      nomDemandeur:       document.getElementById('tr-nom').value.trim(),
      division:           document.getElementById('tr-division').value.trim(),
      matricule:          document.getElementById('tr-matricule').value.trim(),
      marque:             document.getElementById('tr-marque').value.trim(),
      dateDemande:        document.getElementById('tr-date').value,
      indexKm:            document.getElementById('tr-km').value.trim(),
      natureIntervention: document.getElementById('tr-nature').value.trim(),
    };

    // Validation
    const ids = ['tr-nom','tr-division','tr-matricule','tr-marque','tr-date','tr-km','tr-nature'];
    let valid = true;
    ids.forEach(id => {
      const el = document.getElementById(id);
      const val = el.value.trim();
      if (!val) { el.classList.add('error'); valid = false; }
      else        el.classList.remove('error');
    });

    const errEl = document.getElementById('tr-form-error');
    if (!valid) {
      errEl.textContent = 'Tous les champs sont obligatoires. Veuillez les compléter.';
      errEl.classList.add('show');
      return;
    }
    errEl.classList.remove('show');

    const btn = document.getElementById('tr-submit-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Envoi en cours…';

    try {
      // Récupérer APP_KEY depuis window.parcAuto si disponible
      const appKey = (window.parcAuto && window.parcAuto.APP_KEY) || '';
      const headers = { 'Content-Type': 'application/json' };
      if (appKey) headers['X-App-Key'] = appKey;

      const resp = await fetch(`${WORKER_URL}/send-travaux`, {
        method: 'POST',
        headers,
        body: JSON.stringify(fields)
      });
      const data = await resp.json();

      if (!resp.ok || !data.ok) throw new Error(data.error || 'Erreur réseau');

      // Succès
      document.getElementById('tr-num-display').textContent = `N° ${data.numDemande}`;
      showScreen('success');

    } catch (err) {
      errEl.textContent = 'Erreur lors de l\'envoi : ' + err.message;
      errEl.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.textContent = '📨 Envoyer la demande';
    }
  }

  // ── Événements ────────────────────────────────────────────
  document.getElementById('tr-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  document.getElementById('tr-login-btn').addEventListener('click', doLogin);
  document.getElementById('tr-pwd-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  document.getElementById('tr-submit-btn').addEventListener('click', submitDemande);

  document.getElementById('tr-logout-btn').addEventListener('click', () => {
    clearSession();
    showScreen('login');
    document.getElementById('tr-pwd-input').value = '';
  });

  document.getElementById('tr-new-btn').addEventListener('click', () => {
    // Reset form
    ['tr-nom','tr-division','tr-matricule','tr-marque','tr-km','tr-nature']
      .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('tr-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('tr-form-error').classList.remove('show');
    showScreen('form');
    document.getElementById('tr-nom').focus();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  // ── Bouton d'accès dans le menu admin ─────────────────────
  // Cherche la nav admin existante et y injecte le bouton Demande de Travaux
  function injectNavButton() {
    // Essaie de trouver un conteneur nav sidebar ou menu admin
    const targets = [
      document.querySelector('.admin-nav'),
      document.querySelector('.sidebar-nav'),
      document.querySelector('.nav-menu'),
      document.querySelector('nav'),
      document.querySelector('.sidebar'),
    ];
    const container = targets.find(Boolean);

    const btn = document.createElement('button');
    btn.className = 'nav-travaux-btn';
    btn.setAttribute('aria-label', 'Ouvrir les demandes de travaux');
    btn.innerHTML = '🔧 Demande de Travaux';
    btn.addEventListener('click', openModal);

    if (container) {
      container.appendChild(btn);
    } else {
      // Fallback : bouton flottant en bas à droite
      btn.style.cssText = `
        position:fixed; bottom:80px; right:20px; z-index:8000;
        width:auto; padding:12px 20px; border-radius:50px;
        box-shadow:0 4px 20px rgba(230,126,34,.4);
      `;
      document.body.appendChild(btn);
    }
  }

  // Expose API publique
  window.demandeTravauxModule = { open: openModal, close: closeModal };

  // Injecter le bouton après chargement DOM complet
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNavButton);
  } else {
    injectNavButton();
  }

})();
/* FIN BLOC ADDITIF — demande_travaux.js */
