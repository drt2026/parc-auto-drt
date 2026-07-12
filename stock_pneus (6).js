/* ==========================================================================
   STOCK PNEUS — Parc Auto DRT Sfax — Tunisie Telecom
   Module additif, autonome. N'altère aucun autre fichier/fonction.
   Alimente window.parcAuto.data.stockPneus = { references:[], mouvements:[] }
   ========================================================================== */
(function () {
  'use strict';

  // ── Accès données via parcAuto (même pattern que demande_travaux_v2.js) ──
  function getData() {
    var pa = window.parcAuto;
    if (!pa || !pa.data) return null;
    if (!pa.data.stockPneus) pa.data.stockPneus = { references: [], mouvements: [] };
    if (!pa.data.stockPneus.references) pa.data.stockPneus.references = [];
    if (!pa.data.stockPneus.mouvements) pa.data.stockPneus.mouvements = [];
    return pa.data;
  }
  function saveData() {
    var pa = window.parcAuto;
    if (pa && typeof pa.saveData === 'function') pa.saveData();
  }
  function getVehicles() {
    var pa = window.parcAuto;
    return (pa && pa.data && Array.isArray(pa.data.vehicles)) ? pa.data.vehicles : [];
  }
  function getVehicleByMat(mat) {
    return getVehicles().find(function (v) { return v.matricule === mat || v.immat === mat; }) || null;
  }
  function toast(msg, type) {
    var pa = window.parcAuto;
    if (pa && typeof pa.showToast === 'function') { pa.showToast(msg, type); return; }
    alert(msg);
  }
  function uid() { return 'pn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function fmtDateFr(iso) {
    if (!iso) return '—';
    var p = String(iso).split('-');
    return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : iso;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  var POSITIONS = ['Avant Gauche', 'Avant Droit', 'Arrière Gauche', 'Arrière Droit', 'Secours'];

  // ── Calculs stock ──────────────────────────────────────────────────────
  function computeStock(refId) {
    var data = getData(); if (!data) return 0;
    var total = 0;
    data.stockPneus.mouvements.forEach(function (m) {
      if (m.referenceId !== refId) return;
      total += (m.type === 'ENTREE') ? m.quantite : -m.quantite;
    });
    return total;
  }
  function getRef(refId) {
    var data = getData(); if (!data) return null;
    return data.stockPneus.references.find(function (r) { return r.id === refId; }) || null;
  }

  // ── Injection de l'onglet (UI complète) ───────────────────────────────
  function injectTab() {
    var tab = document.getElementById('tab-pneus');
    if (!tab || tab.dataset.pneusBuilt) return;
    tab.dataset.pneusBuilt = '1';

    var css = document.createElement('style');
    css.textContent = `
      #tab-pneus .pn-tabs { display:flex; gap:8px; margin-bottom:18px; flex-wrap:wrap; }
      #tab-pneus .pn-tabbtn { padding:9px 16px; border-radius:10px; border:1.5px solid #e2e8f0;
        background:#fff; color:var(--secondary,#64748b); font-weight:600; font-size:13px; cursor:pointer; }
      #tab-pneus .pn-tabbtn.active { background:var(--primary); color:#fff; border-color:var(--primary); }
      #tab-pneus .pn-view { display:none; }
      #tab-pneus .pn-view.active { display:block; }
      #tab-pneus .pn-stock-badge { display:inline-block; padding:3px 10px; border-radius:8px; font-weight:700; font-size:12.5px; }
      #tab-pneus .pn-stock-ok   { background:#d1fae5; color:#065f46; }
      #tab-pneus .pn-stock-low  { background:#fee2e2; color:#991b1b; }
      #tab-pneus .pn-mv-entree  { color:#065f46; font-weight:700; }
      #tab-pneus .pn-mv-sortie  { color:#991b1b; font-weight:700; }
      #tab-pneus .pn-err { display:none; background:#fee2e2; color:#991b1b; border:1.5px solid #fca5a5;
        border-radius:10px; padding:10px 14px; font-size:13px; margin-bottom:14px; }
      #tab-pneus .pn-err.show { display:block; }
      #tab-pneus .pn-modal-overlay { display:none; position:fixed; inset:0; background:rgba(15,23,42,.55);
        z-index:9400; align-items:center; justify-content:center; padding:16px; }
      #tab-pneus .pn-modal-overlay.active { display:flex; }
      #tab-pneus .pn-modal { background:#fff; border-radius:16px; width:min(520px,96vw); max-height:92vh;
        overflow-y:auto; padding:22px; box-shadow:0 20px 60px rgba(0,0,0,.3); }
      #tab-pneus .pn-modal h3 { margin:0 0 16px; font-size:17px; color:var(--primary); }
      #tab-pneus .pn-field { margin-bottom:13px; }
      #tab-pneus .pn-field label { display:block; font-size:12.5px; font-weight:600; color:#475569; margin-bottom:5px; }
      #tab-pneus .pn-field input, #tab-pneus .pn-field select, #tab-pneus .pn-field textarea {
        width:100%; padding:9px 11px; border:1.5px solid #e2e8f0; border-radius:9px; font-size:14px; font-family:inherit; box-sizing:border-box; }
      #tab-pneus .pn-modal-actions { display:flex; gap:10px; margin-top:18px; }
    `;
    document.head.appendChild(css);

    tab.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🛞 Stock Pneus — DRT Sfax</div>
            <div class="card-subtitle">Catalogue, entrées/sorties et affectation par véhicule</div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-secondary" id="pn-btn-newref">➕ Nouvelle Référence</button>
            <button class="btn btn-success" id="pn-btn-entree">📥 Entrée Stock</button>
            <button class="btn btn-danger" id="pn-btn-sortie">📤 Sortie (Montage)</button>
            <button class="btn btn-primary" id="pn-btn-export">📊 Exporter Excel</button>
            <button class="btn btn-secondary" id="pn-btn-import">📥 Importer Historique</button>
            <input type="file" id="pn-import-input" accept=".xlsx" style="display:none">
          </div>
        </div>

        <div class="pn-tabs">
          <button class="pn-tabbtn active" data-pnview="stock">📦 Stock actuel</button>
          <button class="pn-tabbtn" data-pnview="vehicules">🚗 Par véhicule</button>
          <button class="pn-tabbtn" data-pnview="historique">📜 Historique des mouvements</button>
        </div>

        <!-- Vue Stock actuel -->
        <div class="pn-view active" id="pn-view-stock">
          <div class="search-box" style="margin-bottom:14px;max-width:340px;">
            <span>🔍</span>
            <input type="text" id="pn-search-stock" placeholder="Rechercher une référence...">
          </div>
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead><tr>
                <th>Référence / Dimension</th><th>Marque</th><th>Stock actuel</th><th>Seuil alerte</th>
                <th></th>
              </tr></thead>
              <tbody id="pn-stock-tbody"></tbody>
            </table>
          </div>
        </div>

        <!-- Vue Par véhicule -->
        <div class="pn-view" id="pn-view-vehicules">
          <div class="search-box" style="margin-bottom:14px;max-width:340px;">
            <span>🔍</span>
            <input type="text" id="pn-search-veh" placeholder="Rechercher un matricule...">
          </div>
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead><tr>
                <th>Matricule</th><th>Position</th><th>Référence</th><th>Date de pose</th>
                <th>Km à la pose</th><th>Km actuel véhicule</th>
              </tr></thead>
              <tbody id="pn-veh-tbody"></tbody>
            </table>
          </div>
        </div>

        <!-- Vue Historique -->
        <div class="pn-view" id="pn-view-historique">
          <div class="search-box" style="margin-bottom:14px;max-width:340px;">
            <span>🔍</span>
            <input type="text" id="pn-search-hist" placeholder="Rechercher (référence, matricule, fournisseur...)">
          </div>
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead><tr>
                <th>Date</th><th>Type</th><th>Référence</th><th>Quantité</th><th>Matricule</th>
                <th>Position</th><th>Fournisseur</th><th>P.U. (DT)</th><th>Observations</th>
              </tr></thead>
              <tbody id="pn-hist-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal Nouvelle Référence -->
      <div class="pn-modal-overlay" id="pn-modal-ref">
        <div class="pn-modal">
          <h3>➕ Nouvelle Référence</h3>
          <div class="pn-err" id="pn-ref-err"></div>
          <div class="pn-field"><label>Dimension / Référence *</label>
            <input type="text" id="pn-ref-dim" placeholder="Ex: 175/65 R14"></div>
          <div class="pn-field"><label>Marque</label>
            <input type="text" id="pn-ref-marque" placeholder="Ex: Michelin"></div>
          <div class="pn-field"><label>Seuil d'alerte (quantité minimale)</label>
            <input type="number" id="pn-ref-seuil" value="4" min="0"></div>
          <div class="pn-modal-actions">
            <button class="btn btn-success" id="pn-ref-save" style="flex:1">💾 Enregistrer</button>
            <button class="btn btn-secondary" id="pn-ref-cancel">Annuler</button>
          </div>
        </div>
      </div>

      <!-- Modal Entrée Stock -->
      <div class="pn-modal-overlay" id="pn-modal-entree">
        <div class="pn-modal">
          <h3>📥 Entrée Stock (Achat)</h3>
          <div class="pn-err" id="pn-entree-err"></div>
          <div class="pn-field"><label>Référence *</label>
            <select id="pn-entree-ref"></select></div>
          <div class="pn-field"><label>Quantité *</label>
            <input type="number" id="pn-entree-qte" min="1" value="1"></div>
          <div class="pn-field"><label>Prix unitaire (DT)</label>
            <input type="number" id="pn-entree-pu" min="0" step="0.001"></div>
          <div class="pn-field"><label>Fournisseur</label>
            <input type="text" id="pn-entree-fourn" placeholder="Ex: Sfax Pneus"></div>
          <div class="pn-field"><label>Date *</label>
            <input type="date" id="pn-entree-date"></div>
          <div class="pn-field"><label>Observations</label>
            <input type="text" id="pn-entree-obs"></div>
          <div class="pn-modal-actions">
            <button class="btn btn-success" id="pn-entree-save" style="flex:1">💾 Enregistrer</button>
            <button class="btn btn-secondary" id="pn-entree-cancel">Annuler</button>
          </div>
        </div>
      </div>

      <!-- Modal Sortie Stock (Montage) -->
      <div class="pn-modal-overlay" id="pn-modal-sortie">
        <div class="pn-modal">
          <h3>📤 Sortie Stock (Montage sur véhicule)</h3>
          <div class="pn-err" id="pn-sortie-err"></div>
          <div class="pn-field"><label>Référence * <span id="pn-sortie-dispo" style="font-weight:400;color:#64748b;"></span></label>
            <select id="pn-sortie-ref"></select></div>
          <div class="pn-field"><label>Matricule véhicule *</label>
            <select id="pn-sortie-mat"></select></div>
          <div class="pn-field">
            <label><input type="checkbox" id="pn-sortie-4roues" style="width:auto;vertical-align:middle;margin-right:6px;">Monter sur les 4 positions (4 pneus)</label>
          </div>
          <div class="pn-field" id="pn-sortie-pos-wrap"><label>Position *</label>
            <select id="pn-sortie-pos"></select></div>
          <div class="pn-field"><label>Km actuel du véhicule (à la pose)</label>
            <input type="number" id="pn-sortie-km" min="0"></div>
          <div class="pn-field"><label>Date *</label>
            <input type="date" id="pn-sortie-date"></div>
          <div class="pn-field"><label>Observations</label>
            <input type="text" id="pn-sortie-obs"></div>
          <div class="pn-modal-actions">
            <button class="btn btn-danger" id="pn-sortie-save" style="flex:1">💾 Enregistrer</button>
            <button class="btn btn-secondary" id="pn-sortie-cancel">Annuler</button>
          </div>
        </div>
      </div>

      <!-- Modal Résultat Import Excel (BLOC ADDITIF — Import historique) -->
      <div class="pn-modal-overlay" id="pn-modal-import">
        <div class="pn-modal" style="width:min(680px,96vw)">
          <h3>📥 Résultat de l'import</h3>
          <div id="pn-import-summary" style="font-size:14px;margin-bottom:12px;"></div>
          <div id="pn-import-skipped" style="max-height:280px;overflow-y:auto;background:#f8fafc;
            border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:12.5px;"></div>
          <div class="pn-modal-actions">
            <button class="btn btn-secondary" id="pn-import-close" style="flex:1">Fermer</button>
          </div>
        </div>
      </div>
      <!-- FIN BLOC ADDITIF — Import historique -->
    `;

    POSITIONS.forEach(function (p) {
      var opt = document.createElement('option'); opt.value = p; opt.textContent = p;
      document.getElementById('pn-sortie-pos').appendChild(opt);
    });

    wireEvents();
    renderAll();
  }

  // ── Câblage des événements ─────────────────────────────────────────────
  function wireEvents() {
    document.querySelectorAll('#tab-pneus .pn-tabbtn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#tab-pneus .pn-tabbtn').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('#tab-pneus .pn-view').forEach(function (v) { v.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById('pn-view-' + btn.dataset.pnview).classList.add('active');
      });
    });

    document.getElementById('pn-search-stock').addEventListener('input', function () { renderStockTable(this.value); });
    document.getElementById('pn-search-veh').addEventListener('input', function () { renderVehiculeView(this.value); });
    document.getElementById('pn-search-hist').addEventListener('input', function () { renderHistorique(this.value); });

    document.getElementById('pn-btn-export').addEventListener('click', exportPneusExcel);

    // BLOC ADDITIF — Import Excel (historique kardex "Tableau Gestion de Stock")
    document.getElementById('pn-btn-import').addEventListener('click', function () {
      document.getElementById('pn-import-input').click();
    });
    document.getElementById('pn-import-input').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) importPneusExcel(file);
      e.target.value = '';
    });
    document.getElementById('pn-import-close').addEventListener('click', function () {
      document.getElementById('pn-modal-import').classList.remove('active');
    });
    // FIN BLOC ADDITIF

    // Nouvelle référence
    document.getElementById('pn-btn-newref').addEventListener('click', function () {
      document.getElementById('pn-ref-dim').value = '';
      document.getElementById('pn-ref-marque').value = '';
      document.getElementById('pn-ref-seuil').value = '4';
      document.getElementById('pn-ref-err').classList.remove('show');
      document.getElementById('pn-modal-ref').classList.add('active');
    });
    document.getElementById('pn-ref-cancel').addEventListener('click', function () {
      document.getElementById('pn-modal-ref').classList.remove('active');
    });
    document.getElementById('pn-ref-save').addEventListener('click', function () {
      var err = document.getElementById('pn-ref-err');
      var dim = document.getElementById('pn-ref-dim').value.trim();
      if (!dim) { err.textContent = 'La dimension / référence est obligatoire.'; err.classList.add('show'); return; }
      var data = getData(); if (!data) return;
      var doublon = data.stockPneus.references.find(function (r) { return r.dimension.toLowerCase() === dim.toLowerCase(); });
      if (doublon) { err.textContent = 'Cette référence existe déjà.'; err.classList.add('show'); return; }
      data.stockPneus.references.push({
        id: uid(), dimension: dim,
        marque: document.getElementById('pn-ref-marque').value.trim(),
        seuilAlerte: parseInt(document.getElementById('pn-ref-seuil').value, 10) || 0,
        prixUnitaireDefaut: null
      });
      saveData();
      document.getElementById('pn-modal-ref').classList.remove('active');
      renderAll();
      toast('Référence ajoutée : ' + dim, 'success');
    });

    // Entrée stock
    document.getElementById('pn-btn-entree').addEventListener('click', function () {
      fillRefSelect('pn-entree-ref');
      document.getElementById('pn-entree-qte').value = 1;
      document.getElementById('pn-entree-pu').value = '';
      document.getElementById('pn-entree-fourn').value = '';
      document.getElementById('pn-entree-date').value = todayISO();
      document.getElementById('pn-entree-obs').value = '';
      document.getElementById('pn-entree-err').classList.remove('show');
      document.getElementById('pn-modal-entree').classList.add('active');
    });
    document.getElementById('pn-entree-cancel').addEventListener('click', function () {
      document.getElementById('pn-modal-entree').classList.remove('active');
    });
    document.getElementById('pn-entree-save').addEventListener('click', function () {
      var err = document.getElementById('pn-entree-err');
      var data = getData(); if (!data) return;
      var refId = document.getElementById('pn-entree-ref').value;
      var qte = parseInt(document.getElementById('pn-entree-qte').value, 10);
      var date = document.getElementById('pn-entree-date').value;
      if (!refId) { err.textContent = 'Sélectionnez une référence (créez-en une si besoin).'; err.classList.add('show'); return; }
      if (!qte || qte <= 0) { err.textContent = 'La quantité doit être supérieure à 0.'; err.classList.add('show'); return; }
      if (!date) { err.textContent = 'La date est obligatoire.'; err.classList.add('show'); return; }
      var pu = document.getElementById('pn-entree-pu').value === '' ? null : parseFloat(document.getElementById('pn-entree-pu').value);
      data.stockPneus.mouvements.push({
        id: uid(), date: date, referenceId: refId, type: 'ENTREE', quantite: qte,
        prixUnitaire: pu, fournisseur: document.getElementById('pn-entree-fourn').value.trim(),
        matricule: null, position: null, km: null,
        observations: document.getElementById('pn-entree-obs').value.trim(),
        saisiPar: 'Admin', dateSaisie: new Date().toISOString()
      });
      var ref = getRef(refId);
      if (ref && pu != null) ref.prixUnitaireDefaut = pu;
      saveData();
      document.getElementById('pn-modal-entree').classList.remove('active');
      renderAll();
      toast('Entrée enregistrée : +' + qte + ' (' + (ref ? ref.dimension : '') + ')', 'success');
    });

    // Sortie stock (montage)
    document.getElementById('pn-btn-sortie').addEventListener('click', function () {
      fillRefSelect('pn-sortie-ref');
      fillMatriculeList();
      document.getElementById('pn-sortie-mat').value = '';
      document.getElementById('pn-sortie-4roues').checked = false;
      document.getElementById('pn-sortie-pos-wrap').style.display = '';
      document.getElementById('pn-sortie-km').value = '';
      document.getElementById('pn-sortie-date').value = todayISO();
      document.getElementById('pn-sortie-obs').value = '';
      document.getElementById('pn-sortie-err').classList.remove('show');
      updateSortieDispo();
      document.getElementById('pn-modal-sortie').classList.add('active');
    });
    document.getElementById('pn-sortie-ref').addEventListener('change', updateSortieDispo);
    document.getElementById('pn-sortie-4roues').addEventListener('change', function () {
      document.getElementById('pn-sortie-pos-wrap').style.display = this.checked ? 'none' : '';
    });
    document.getElementById('pn-sortie-cancel').addEventListener('click', function () {
      document.getElementById('pn-modal-sortie').classList.remove('active');
    });
    document.getElementById('pn-sortie-save').addEventListener('click', function () {
      var err = document.getElementById('pn-sortie-err');
      var data = getData(); if (!data) return;
      var refId = document.getElementById('pn-sortie-ref').value;
      var mat = document.getElementById('pn-sortie-mat').value.trim();
      var date = document.getElementById('pn-sortie-date').value;
      var quatreRoues = document.getElementById('pn-sortie-4roues').checked;
      var kmRaw = document.getElementById('pn-sortie-km').value;
      var km = kmRaw === '' ? null : parseFloat(kmRaw);
      var obs = document.getElementById('pn-sortie-obs').value.trim();

      if (!refId) { err.textContent = 'Sélectionnez une référence.'; err.classList.add('show'); return; }
      if (!mat) { err.textContent = 'Le matricule du véhicule est obligatoire.'; err.classList.add('show'); return; }
      if (!date) { err.textContent = 'La date est obligatoire.'; err.classList.add('show'); return; }

      var qteNeeded = quatreRoues ? 4 : 1;
      var dispo = computeStock(refId);
      // BLOC ADDITIF — impossible de sortir plus que le stock disponible
      if (qteNeeded > dispo) {
        err.textContent = '❌ Stock insuffisant : ' + dispo + ' disponible(s) pour ' + qteNeeded + ' demandé(s). Vérifiez la référence ou faites d\'abord une entrée.';
        err.classList.add('show');
        return;
      }
      // FIN BLOC ADDITIF

      var positions = quatreRoues ? ['Avant Gauche', 'Avant Droit', 'Arrière Gauche', 'Arrière Droit'] : [document.getElementById('pn-sortie-pos').value];
      positions.forEach(function (pos) {
        data.stockPneus.mouvements.push({
          id: uid(), date: date, referenceId: refId, type: 'SORTIE', quantite: 1,
          prixUnitaire: null, fournisseur: null,
          matricule: mat, position: pos, km: km,
          observations: obs, saisiPar: 'Admin', dateSaisie: new Date().toISOString()
        });
      });
      saveData();
      document.getElementById('pn-modal-sortie').classList.remove('active');
      renderAll();
      toast((quatreRoues ? '4 pneus montés' : '1 pneu monté') + ' sur ' + mat, 'success');
    });
  }

  function updateSortieDispo() {
    var refId = document.getElementById('pn-sortie-ref').value;
    var el = document.getElementById('pn-sortie-dispo');
    if (!refId) { el.textContent = ''; return; }
    el.textContent = '(' + computeStock(refId) + ' en stock)';
  }

  function fillRefSelect(selectId) {
    var data = getData(); if (!data) return;
    var sel = document.getElementById(selectId);
    sel.innerHTML = '<option value="">— Choisir —</option>' + data.stockPneus.references
      .slice().sort(function (a, b) { return a.dimension.localeCompare(b.dimension); })
      .map(function (r) { return '<option value="' + r.id + '">' + esc(r.dimension) + (r.marque ? ' — ' + esc(r.marque) : '') + '</option>'; })
      .join('');
  }
  function fillMatriculeList() {
    var sel = document.getElementById('pn-sortie-mat');
    var vehicles = getVehicles().slice().sort(function (a, b) {
      return (a.matricule || a.immat || '').localeCompare(b.matricule || b.immat || '');
    });
    sel.innerHTML = '<option value="">— Choisir un véhicule —</option>' + vehicles.map(function (v) {
      var mat = v.matricule || v.immat || '';
      if (!mat) return '';
      var marque = v.marque || v.modele || '';
      return '<option value="' + esc(mat) + '">' + esc(mat) + (marque ? ' — ' + esc(marque) : '') + '</option>';
    }).join('');
  }

  // ── Rendu des vues ──────────────────────────────────────────────────────
  function renderAll() {
    renderStockTable('');
    renderVehiculeView('');
    renderHistorique('');
  }

  function renderStockTable(search) {
    var data = getData(); if (!data) return;
    var tbody = document.getElementById('pn-stock-tbody');
    if (!tbody) return;
    var q = (search || '').toLowerCase();
    var refs = data.stockPneus.references.filter(function (r) {
      return !q || r.dimension.toLowerCase().indexOf(q) !== -1 || (r.marque || '').toLowerCase().indexOf(q) !== -1;
    });
    if (!refs.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px;">Aucune référence. Cliquez sur "➕ Nouvelle Référence" pour commencer.</td></tr>';
      return;
    }
    tbody.innerHTML = refs.slice().sort(function (a, b) { return a.dimension.localeCompare(b.dimension); }).map(function (r) {
      var stock = computeStock(r.id);
      var low = stock <= (r.seuilAlerte || 0);
      return '<tr>' +
        '<td style="font-weight:600">' + esc(r.dimension) + '</td>' +
        '<td>' + esc(r.marque || '—') + '</td>' +
        '<td><span class="pn-stock-badge ' + (low ? 'pn-stock-low' : 'pn-stock-ok') + '">' + stock + (low ? ' ⚠️' : '') + '</span></td>' +
        '<td>' + (r.seuilAlerte || 0) + '</td>' +
        '<td><button class="btn btn-secondary" style="padding:5px 12px;font-size:12px" onclick="StockPneus.deleteRef(\'' + r.id + '\')">🗑️</button></td>' +
        '</tr>';
    }).join('');
  }

  function renderVehiculeView(search) {
    var data = getData(); if (!data) return;
    var tbody = document.getElementById('pn-veh-tbody');
    if (!tbody) return;
    var q = (search || '').toLowerCase();

    // Dernière sortie par (matricule, position)
    var current = {};
    data.stockPneus.mouvements
      .filter(function (m) { return m.type === 'SORTIE'; })
      .sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); })
      .forEach(function (m) {
        var key = m.matricule + '||' + m.position;
        current[key] = m; // le dernier écrase le précédent → pneu actuellement monté
      });

    var rows = Object.keys(current).map(function (k) { return current[k]; })
      .filter(function (m) { return !q || (m.matricule || '').toLowerCase().indexOf(q) !== -1; })
      .sort(function (a, b) {
        if (a.matricule !== b.matricule) return (a.matricule || '').localeCompare(b.matricule || '');
        return POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position);
      });

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px;">Aucun montage enregistré pour l\'instant.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (m) {
      var ref = getRef(m.referenceId);
      var veh = getVehicleByMat(m.matricule);
      var kmActuel = veh && veh.km != null ? veh.km : null;
      return '<tr>' +
        '<td style="font-weight:600">' + esc(m.matricule) + '</td>' +
        '<td>' + esc(m.position || '—') + '</td>' +
        '<td>' + esc(ref ? ref.dimension : '—') + '</td>' +
        '<td>' + fmtDateFr(m.date) + '</td>' +
        '<td>' + (m.km != null ? m.km : '—') + '</td>' +
        '<td>' + (kmActuel != null ? kmActuel : '—') + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderHistorique(search) {
    var data = getData(); if (!data) return;
    var tbody = document.getElementById('pn-hist-tbody');
    if (!tbody) return;
    var q = (search || '').toLowerCase();
    var rows = data.stockPneus.mouvements.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    if (q) {
      rows = rows.filter(function (m) {
        var ref = getRef(m.referenceId);
        var hay = [ref ? ref.dimension : '', m.matricule, m.fournisseur, m.observations].join(' ').toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    }
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:24px;">Aucun mouvement enregistré.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (m) {
      var ref = getRef(m.referenceId);
      return '<tr>' +
        '<td>' + fmtDateFr(m.date) + '</td>' +
        '<td class="' + (m.type === 'ENTREE' ? 'pn-mv-entree' : 'pn-mv-sortie') + '">' + (m.type === 'ENTREE' ? '📥 Entrée' : '📤 Sortie') + '</td>' +
        '<td>' + esc(ref ? ref.dimension : '—') + '</td>' +
        '<td>' + (m.type === 'ENTREE' ? '+' : '-') + m.quantite + '</td>' +
        '<td>' + esc(m.matricule || '—') + '</td>' +
        '<td>' + esc(m.position || '—') + '</td>' +
        '<td>' + esc(m.fournisseur || '—') + '</td>' +
        '<td>' + (m.prixUnitaire != null ? m.prixUnitaire.toFixed(3) : '—') + '</td>' +
        '<td>' + esc(m.observations || '') + '</td>' +
        '</tr>';
    }).join('');
  }

  // ── Suppression d'une référence (uniquement si aucun mouvement lié) ────
  function deleteRef(refId) {
    var data = getData(); if (!data) return;
    var used = data.stockPneus.mouvements.some(function (m) { return m.referenceId === refId; });
    if (used) {
      toast('Impossible de supprimer : des mouvements existent déjà pour cette référence.', 'error');
      return;
    }
    if (!confirm('Supprimer définitivement cette référence ?')) return;
    data.stockPneus.references = data.stockPneus.references.filter(function (r) { return r.id !== refId; });
    saveData();
    renderAll();
  }

  // ── Export Excel (ExcelJS, style cohérent avec le reste de l'appli) ────
  function exportPneusExcel() {
    var data = getData(); if (!data) { toast('Application non prête.', 'error'); return; }
    function build() {
      var wb = new window.ExcelJS.Workbook();
      wb.creator = 'Parc Auto DRT Sfax — Tunisie Telecom';

      // Onglet 1 : Stock actuel
      var ws1 = wb.addWorksheet('Stock actuel', { views: [{ state: 'frozen', ySplit: 1 }] });
      ws1.columns = [{ width: 26 }, { width: 18 }, { width: 14 }, { width: 14 }];
      var h1 = ws1.addRow(['Référence / Dimension', 'Marque', 'Stock actuel', 'Seuil alerte']);
      styleHeaderRow(h1);
      data.stockPneus.references.forEach(function (r) {
        var row = ws1.addRow([r.dimension, r.marque || '', computeStock(r.id), r.seuilAlerte || 0]);
        styleDataRow(row);
      });

      // Onglet 2 : Historique des mouvements — même logique "Kardex" que le tableau
      // manuel original (groupé par référence, avec un solde "Reste" qui se met à jour
      // ligne après ligne), pour retrouver exactement le même repère visuel.
      var ws2 = wb.addWorksheet('Historique mouvements', { views: [{ state: 'frozen', ySplit: 1 }] });
      ws2.columns = [
        { width: 22 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 10 }, { width: 10 }, { width: 10 },
        { width: 10 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 26 }
      ];
      var h2 = ws2.addRow(['Référence', 'Date', 'Matricule', 'Position', 'Entrée', 'Sortie', 'Reste', 'Quantité', 'P.U. (DT)', 'Total (DT)', 'Fournisseur', 'Observations']);
      styleHeaderRow(h2);

      var refsTriees = data.stockPneus.references.slice().sort(function (a, b) { return a.dimension.localeCompare(b.dimension); });
      refsTriees.forEach(function (ref) {
        var mvs = data.stockPneus.mouvements
          .filter(function (m) { return m.referenceId === ref.id; })
          .sort(function (a, b) { return (a.date || '').localeCompare(b.date || '') || (a.dateSaisie || '').localeCompare(b.dateSaisie || ''); });
        var reste = 0;
        mvs.forEach(function (m) {
          reste += (m.type === 'ENTREE') ? m.quantite : -m.quantite;
          var total = (m.prixUnitaire != null) ? (m.prixUnitaire * m.quantite) : '';
          var row = ws2.addRow([
            ref.dimension, m.date, m.matricule || '', m.position || '',
            m.type === 'ENTREE' ? m.quantite : '', m.type === 'SORTIE' ? m.quantite : '',
            reste, m.quantite, m.prixUnitaire != null ? m.prixUnitaire : '', total,
            m.fournisseur || '', m.observations || ''
          ]);
          styleDataRow(row);
        });
        // Ligne non renseignée s'il n'y a encore aucun mouvement pour cette référence
        if (!mvs.length) {
          var emptyRow = ws2.addRow([ref.dimension, '', '', '', '', '', 0, '', '', '', '', '(aucun mouvement)']);
          styleDataRow(emptyRow);
        }
      });

      // Onglet des mouvements bruts (une ligne par mouvement, non groupée) — utile pour filtrer/trier librement
      var ws2b = wb.addWorksheet('Mouvements (liste brute)', { views: [{ state: 'frozen', ySplit: 1 }] });
      ws2b.columns = [{ width: 12 }, { width: 10 }, { width: 22 }, { width: 10 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 12 }, { width: 26 }];
      var h2b = ws2b.addRow(['Date', 'Type', 'Référence', 'Quantité', 'Matricule', 'Position', 'Fournisseur', 'P.U. (DT)', 'Observations']);
      styleHeaderRow(h2b);
      data.stockPneus.mouvements.slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); }).forEach(function (m) {
        var ref = getRef(m.referenceId);
        var row = ws2b.addRow([
          m.date, m.type, ref ? ref.dimension : '', m.type === 'ENTREE' ? m.quantite : -m.quantite,
          m.matricule || '', m.position || '', m.fournisseur || '', m.prixUnitaire || '', m.observations || ''
        ]);
        styleDataRow(row);
      });

      // Onglet 3 : Pneus actuellement montés (par véhicule)
      var ws3 = wb.addWorksheet('Par véhicule', { views: [{ state: 'frozen', ySplit: 1 }] });
      ws3.columns = [{ width: 14 }, { width: 16 }, { width: 22 }, { width: 12 }, { width: 12 }, { width: 16 }];
      var h3 = ws3.addRow(['Matricule', 'Position', 'Référence', 'Date de pose', 'Km à la pose', 'Km actuel véhicule']);
      styleHeaderRow(h3);
      var current = {};
      data.stockPneus.mouvements.filter(function (m) { return m.type === 'SORTIE'; })
        .sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); })
        .forEach(function (m) { current[m.matricule + '||' + m.position] = m; });
      Object.keys(current).map(function (k) { return current[k]; })
        .sort(function (a, b) { return (a.matricule || '').localeCompare(b.matricule || ''); })
        .forEach(function (m) {
          var ref = getRef(m.referenceId);
          var veh = getVehicleByMat(m.matricule);
          var row = ws3.addRow([m.matricule, m.position, ref ? ref.dimension : '', m.date, m.km || '', (veh && veh.km) || '']);
          styleDataRow(row);
        });

      wb.xlsx.writeBuffer().then(function (buffer) {
        var blob = new Blob([buffer], { type: 'application/octet-stream' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'stock_pneus_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      });
    }
    if (window.ExcelJS) { build(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
    s.onload = build;
    document.head.appendChild(s);
  }
  function styleHeaderRow(row) {
    row.height = 26;
    row.eachCell(function (cell) {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  }
  function styleDataRow(row) {
    row.eachCell(function (cell) {
      cell.font = { name: 'Calibri', size: 10 };
      cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    });
  }

  // ── BLOC ADDITIF — Import Excel historique (format "Tableau Gestion de Stock") ──
  // Colonnes attendues (à partir de la ligne d'en-tête) :
  // A:Référence (P)  B:Matricule  C:Date  D:ENTRÉE  E:Sortie  F:Reste  G:Quantite  H:P-U  I:Taux
  // Chaque bloc de lignes commence quand la colonne A contient un texte (la référence/dimension).
  var MOIS_FR = { 'jan':1,'janv':1,'fev':2,'fév':2,'fevr':2,'mar':3,'mars':3,'avr':4,'avril':4,
    'mai':5,'juin':6,'jun':6,'jul':7,'juil':7,'juillet':7,'aou':8,'aout':8,'août':8,
    'sep':9,'sept':9,'oct':10,'nov':11,'dec':12,'déc':12 };

  function parseImportDate(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString().slice(0, 10);
    var s = String(val).trim().replace(/[`'"]/g, '');
    if (!s) return null;
    // Formats numériques DD/MM/YYYY ou DD-MM-YYYY (tolère jour/année mal saisis)
    var m = s.match(/^(\d{1,3})[\/\-](\d{1,2})[\/\-](\d{2,6})$/);
    if (m) {
      var d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = m[3];
      if (d > 31) d = parseInt(String(d).slice(0, 2), 10); // ex: "240" → "24"
      y = y.length > 4 ? y.slice(0, 4) : y; // ex: "20223" → "2022"
      y = y.length === 2 ? '20' + y : y;
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
        return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      }
      return null;
    }
    // Formats avec mois en lettres : "12-dec-18"
    m = s.match(/^(\d{1,2})[\/\-\s]([a-zA-Zéû]{3,})[\/\-\s](\d{2,4})$/);
    if (m) {
      var d2 = parseInt(m[1], 10);
      var moKey = m[2].toLowerCase().slice(0, 4);
      var mo2 = MOIS_FR[moKey] || MOIS_FR[m[2].toLowerCase().slice(0, 3)];
      var y2 = m[3].length === 2 ? '20' + m[3] : m[3];
      if (mo2 && d2 >= 1 && d2 <= 31) {
        return y2 + '-' + String(mo2).padStart(2, '0') + '-' + String(d2).padStart(2, '0');
      }
    }
    return null;
  }

  // Retrouve le matricule complet (ex: "17-349945") à partir d'un numéro brut (ex: 349945)
  function matchVehicleMatricule(raw) {
    if (raw == null || raw === '') return null;
    var s = String(raw).trim();
    if (!/^\d+$/.test(s)) return null; // texte non numérique (nom de fournisseur…) → pas un matricule
    var found = getVehicles().find(function (v) {
      var mat = String(v.matricule || v.immat || '');
      return mat === s || mat === '17-' + s || mat.slice(-s.length) === s;
    });
    return found ? (found.matricule || found.immat) : ('17-' + s);
  }

  function findOrCreateRef(dimension) {
    var data = getData(); if (!data) return null;
    var dim = String(dimension).trim();
    var existing = data.stockPneus.references.find(function (r) { return r.dimension.trim().toLowerCase() === dim.toLowerCase(); });
    if (existing) return existing;
    var ref = { id: uid(), dimension: dim, marque: '', seuilAlerte: 4, prixUnitaireDefaut: null };
    data.stockPneus.references.push(ref);
    return ref;
  }

  function importPneusExcel(file) {
    var data = getData(); if (!data) { toast('Application non prête.', 'error'); return; }
    function run() {
      var reader = new FileReader();
      reader.onload = function () {
        var wb = new window.ExcelJS.Workbook();
        wb.xlsx.load(reader.result).then(function () {
          var ws = wb.worksheets[0];
          var headerRow = null;
          for (var r = 1; r <= ws.rowCount; r++) {
            var c1 = ws.getRow(r).getCell(1).value;
            if (String(c1 || '').trim().toLowerCase().indexOf('référence') === 0) { headerRow = r; break; }
          }
          if (!headerRow) { toast("Fichier non reconnu : en-tête 'Référence (P)' introuvable.", 'error'); return; }

          // Protection anti-doublon : un import précédent laisse des mouvements marqués
          // saisiPar:'Import Excel'. Les rejouer sans les retirer d'abord aurait pour effet
          // de cumuler (ex: 3 imports = stock x3). On demande confirmation puis on les
          // remplace au lieu de les additionner.
          var anciens = data.stockPneus.mouvements.filter(function (m) { return m.saisiPar === 'Import Excel'; });
          if (anciens.length) {
            var ok = confirm(
              'Un import historique a déjà été effectué (' + anciens.length + ' mouvement(s) marqué(s) "Import Excel").\n' +
              'Relancer l\'import va REMPLACER ces mouvements par ceux du fichier chargé maintenant (pour éviter de les cumuler).\n' +
              'Les mouvements saisis manuellement dans l\'appli ne sont pas touchés.\n\nContinuer ?'
            );
            if (!ok) { toast('Import annulé.', 'error'); return; }
            data.stockPneus.mouvements = data.stockPneus.mouvements.filter(function (m) { return m.saisiPar !== 'Import Excel'; });
          }

          var currentRef = null, added = 0, entrees = 0, sorties = 0, refsCreated = 0, skipped = [];
          var refsBefore = data.stockPneus.references.length;

          for (var row = headerRow + 1; row <= ws.rowCount; row++) {
            var rw = ws.getRow(row);
            var a = rw.getCell(1).value, b = rw.getCell(2).value, c = rw.getCell(3).value,
                d = rw.getCell(4).value, e = rw.getCell(5).value, h = rw.getCell(8).value;

            if (a && String(a).trim()) {
              currentRef = findOrCreateRef(a);
              refsCreated++;
            }
            if (!currentRef) continue;

            var dateVal = c, entreeVal = d, sortieVal = e;
            // Décalage de colonne détecté sur certaines lignes historiques : la date se
            // retrouve dans la colonne ENTRÉE (D) — dans ce cas on la réaffecte.
            if (!(dateVal instanceof Date) && (entreeVal instanceof Date)) {
              dateVal = entreeVal; entreeVal = null;
            }

            var dateISO = parseImportDate(dateVal);
            var hasEntree = typeof entreeVal === 'number' && entreeVal > 0;
            var hasSortie = typeof sortieVal === 'number' && sortieVal > 0;

            if (!hasEntree && !hasSortie) {
              if (entreeVal != null || sortieVal != null) {
                skipped.push('Ligne ' + row + ' : valeur ENTRÉE/Sortie non numérique (' + JSON.stringify([entreeVal, sortieVal]) + ')');
              }
              continue;
            }
            if (dateVal != null && !dateISO) {
              skipped.push('Ligne ' + row + ' : date non reconnue (« ' + dateVal + ' »), mouvement importé sans date');
            }

            if (hasEntree) {
              data.stockPneus.mouvements.push({
                id: uid(), date: dateISO || '', referenceId: currentRef.id, type: 'ENTREE',
                quantite: entreeVal, prixUnitaire: (typeof h === 'number' ? h : null), fournisseur: '',
                matricule: null, position: null, km: null,
                observations: 'Import historique' + (dateVal != null && !dateISO ? ' (date d\'origine: ' + dateVal + ')' : ''),
                saisiPar: 'Import Excel', dateSaisie: new Date().toISOString()
              });
              added++; entrees++;
            }
            var bIsEntreeMarker = typeof b === 'string' && b.trim().toUpperCase() === 'ENTREE';
            if (hasSortie && bIsEntreeMarker) {
              // Erreur de saisie connue dans le fichier historique : la quantité d'une
              // entrée de stock a été tapée dans la colonne Sortie, avec "ENTREE" comme
              // repère dans la colonne Matricule. On la réoriente en entrée plutôt que de
              // créer une fausse sortie vers un "véhicule" nommé ENTREE.
              data.stockPneus.mouvements.push({
                id: uid(), date: dateISO || '', referenceId: currentRef.id, type: 'ENTREE',
                quantite: sortieVal, prixUnitaire: (typeof h === 'number' ? h : null), fournisseur: '',
                matricule: null, position: null, km: null,
                observations: 'Import historique (colonne Sortie corrigée en Entrée — repère "ENTREE" détecté)' +
                  (dateVal != null && !dateISO ? ' (date d\'origine: ' + dateVal + ')' : ''),
                saisiPar: 'Import Excel', dateSaisie: new Date().toISOString()
              });
              added++; entrees++;
              skipped.push('Ligne ' + row + ' : quantité trouvée en colonne Sortie avec repère "ENTREE" en Matricule — importée comme ENTRÉE (colonne corrigée automatiquement)');
            } else if (hasSortie) {
              var bIsDate = (b instanceof Date && !isNaN(b.getTime()));
              var matMatched = bIsDate ? null : matchVehicleMatricule(b);
              var matriculeFinal = matMatched || (bIsDate ? null : (b != null ? String(b).trim() : null));
              if (bIsDate) {
                skipped.push('Ligne ' + row + ' : la colonne Matricule contient une date (Excel a mal interprété la saisie) — mouvement importé sans matricule, à corriger manuellement');
              } else if (matriculeFinal && !matMatched && !/^\d+$/.test(matriculeFinal)) {
                skipped.push('Ligne ' + row + ' : matricule « ' + matriculeFinal + ' » non reconnu dans le parc (véhicule externe ou nom d\'entreprise ?) — importé tel quel');
              }
              var kmNote = (typeof h === 'string' && /\d/.test(h)) ? h : null;
              data.stockPneus.mouvements.push({
                id: uid(), date: dateISO || '', referenceId: currentRef.id, type: 'SORTIE',
                quantite: sortieVal, prixUnitaire: null, fournisseur: null,
                matricule: matriculeFinal, position: null,
                km: kmNote ? parseInt(kmNote.replace(/\D/g, ''), 10) || null : null,
                observations: 'Import historique' + (dateVal != null && !dateISO ? ' (date d\'origine: ' + dateVal + ')' : ''),
                saisiPar: 'Import Excel', dateSaisie: new Date().toISOString()
              });
              added++; sorties++;
            }
          }

          saveData();
          renderAll();

          var refsAfter = data.stockPneus.references.length;
          document.getElementById('pn-import-summary').innerHTML =
            '✅ <strong>' + added + '</strong> mouvement(s) importé(s) — ' + entrees + ' entrée(s), ' + sorties + ' sortie(s).<br>' +
            '📦 ' + (refsAfter - refsBefore) + ' nouvelle(s) référence(s) créée(s) (' + refsAfter + ' au total).' +
            (skipped.length ? '<br>⚠️ ' + skipped.length + ' ligne(s) ignorée(s) ou à vérifier (voir liste ci-dessous).' : '<br>🎉 Aucune ligne ignorée.');
          document.getElementById('pn-import-skipped').innerHTML = skipped.length
            ? skipped.map(function (s) { return esc(s); }).join('<br>')
            : '<span style="color:#94a3b8">—</span>';
          document.getElementById('pn-modal-import').classList.add('active');
          toast(added + ' mouvement(s) importé(s)', 'success');
        }).catch(function (err) {
          console.error(err);
          toast('Erreur de lecture du fichier Excel : ' + err.message, 'error');
        });
      };
      reader.readAsArrayBuffer(file);
    }
    if (window.ExcelJS) { run(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
    s.onload = run;
    document.head.appendChild(s);
  }
  // FIN BLOC ADDITIF — Import Excel historique

  // ── API publique minimale (utilisée par les boutons inline du tableau) ─
  window.StockPneus = { deleteRef: deleteRef };

  // ── Initialisation : attendre que #tab-pneus existe dans le DOM ────────
  function init() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (document.getElementById('tab-pneus')) { injectTab(); clearInterval(iv); }
      else if (tries > 60) clearInterval(iv);
    }, 250);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
