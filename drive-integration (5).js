/* ============================================================
   PARC AUTO DRT SFAX — MODULE GOOGLE DRIVE
   Intégration complète Google Drive API v3
   Stockage fichiers + Synchronisation temps réel
   ============================================================ */

// ============================================================
// CONFIGURATION GOOGLE DRIVE
// ============================================================
const DRIVE_CONFIG = {
  CLIENT_ID: '744399055234-kbn613ptlpp5bk8oeoda942ssn3352mm.apps.googleusercontent.com',
  API_KEY: 'AIzaSyC6xQNkemY1HD4AuvjAIR__2VUW43JgI5Q',
  SCOPES: 'https://www.googleapis.com/auth/drive',

  // Dossier racine dans Drive (sera créé automatiquement)
  ROOT_FOLDER_NAME: 'Parc Auto DRT Sfax',

  // Structure des sous-dossiers
  FOLDERS: {
    PHOTOS:       'Photos Véhicules',
    CARTES_GRISES:'Cartes Grises',
    DOCUMENTS:    'Documents & Contrats',
    RAPPORTS:     'Rapports & Exports',
    REPARATIONS:  'Factures Réparations',
    VISITES:      'Visites Techniques',
    ASSURANCES:   'Assurances',
    PRESENTATIONS:'Présentations PPT'
  },

  // Intervalle de synchronisation (ms) — 60 secondes
  SYNC_INTERVAL: 60000,
};

// ============================================================
// CLASSE PRINCIPALE DRIVE MANAGER
// ============================================================
class DriveManager {
  constructor() {
    this.isInitialized = false;
    this.isSignedIn = false;
    this.tokenClient = null;
    this.accessToken = null;
    this.rootFolderId = null;
    this.folderIds = {};
    this.syncTimer = null;
    this.fileCache = {};         // cache local des fichiers
    this.onSyncCallbacks = [];   // callbacks appelés après chaque sync
  }

  // ============================================================
  // 1. INITIALISATION & AUTHENTIFICATION
  // ============================================================

  /** Charger les scripts Google Identity Services + Drive API */
  async loadGoogleAPIs() {
    await this._loadScript('https://accounts.google.com/gsi/client');
    await this._loadScript('https://apis.google.com/js/api.js');
    await new Promise(resolve => gapi.load('client:picker', resolve));
    await gapi.client.init({ apiKey: DRIVE_CONFIG.API_KEY, discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'] });
    this.isInitialized = true;
    console.log('✅ Google APIs chargées');
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /** Initialiser le client OAuth2 */
  initTokenClient() {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: DRIVE_CONFIG.CLIENT_ID,
      scope: DRIVE_CONFIG.SCOPES,
      callback: (response) => {
        if (response.error) {
          console.error('Erreur OAuth:', response.error);
          this._notifyStatusChange('error', 'Erreur authentification Google');
          return;
        }
        this.accessToken = response.access_token;
        gapi.client.setToken({ access_token: this.accessToken });
        this.isSignedIn = true;
        this._notifyStatusChange('connected', 'Connecté à Google Drive');
        this._onSignIn();
      }
    });
  }

  /** Demander la connexion à l'utilisateur */
  async signIn() {
    if (!this.isInitialized) await this.loadGoogleAPIs();
    if (!this.tokenClient) this.initTokenClient();
    this.tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  /** Déconnexion */
  signOut() {
    if (this.accessToken) {
      google.accounts.oauth2.revoke(this.accessToken);
    }
    this.accessToken = null;
    this.isSignedIn = false;
    this.rootFolderId = null;
    this.folderIds = {};
    this.stopSync();
    this._notifyStatusChange('disconnected', 'Déconnecté de Google Drive');
  }

  /** Après connexion réussie */
  async _onSignIn() {
    await this._ensureFolderStructure();
    await this.syncAll();
    this.startAutoSync();
  }

  // ============================================================
  // 2. GESTION DES DOSSIERS
  // ============================================================

  /** Créer la structure de dossiers si elle n'existe pas */
  async _ensureFolderStructure() {
    // Dossier racine
    this.rootFolderId = await this._findOrCreateFolder(DRIVE_CONFIG.ROOT_FOLDER_NAME, 'root');
    // Sous-dossiers
    for (const [key, name] of Object.entries(DRIVE_CONFIG.FOLDERS)) {
      this.folderIds[key] = await this._findOrCreateFolder(name, this.rootFolderId);
    }
    // Sauvegarder les IDs localement
    localStorage.setItem('driveFolderIds', JSON.stringify({
      root: this.rootFolderId,
      ...this.folderIds
    }));
    console.log('✅ Structure dossiers Drive prête', this.folderIds);
  }

  async _findOrCreateFolder(name, parentId) {
    // Chercher d'abord
    const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
    const res = await gapi.client.drive.files.list({ q, fields: 'files(id,name)', spaces: 'drive' });
    const files = res.result.files;
    if (files && files.length > 0) return files[0].id;
    // Créer si absent
    const created = await gapi.client.drive.files.create({
      resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id'
    });
    return created.result.id;
  }

  // ============================================================
  // 3. UPLOAD DE FICHIERS
  // ============================================================

  /**
   * Uploader un fichier vers Drive
   * @param {File} file - L'objet File du navigateur
   * @param {string} folderKey - Clé du dossier (ex: 'PHOTOS', 'REPARATIONS')
   * @param {string} vehiculeMatricule - Matricule du véhicule pour nommage
   * @param {Function} onProgress - Callback progression (0-100)
   * @param {string} label - Étiquette optionnelle (ex: 'RECTO', 'VERSO', 'PPT')
   */
  async uploadFile(file, folderKey, vehiculeMatricule = '', onProgress = null, label = '') {
    if (!this.isSignedIn) throw new Error('Non connecté à Google Drive');
    const folderId = this.folderIds[folderKey];
    if (!folderId) throw new Error(`Dossier "${folderKey}" introuvable`);

    // Nommer le fichier avec matricule + label optionnel + timestamp
    const ext = file.name.split('.').pop();
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeMat = vehiculeMatricule.replace(/[^a-zA-Z0-9-]/g, '_');
    const labelPart = label ? `_${label}` : '';
    const fileName = vehiculeMatricule
      ? `${safeMat}${labelPart}_${ts}.${ext}`
      : `${ts}_${file.name}`;

    // Métadonnées
    const metadata = {
      name: fileName,
      parents: [folderId],
      description: `Véhicule: ${vehiculeMatricule} | Uploadé: ${new Date().toLocaleString('fr-FR')} | Original: ${file.name}`
    };

    // Upload multipart
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink,size,mimeType,createdTime');
      xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });
      }

      xhr.onload = () => {
        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText);
          // Rendre le fichier accessible en lecture pour tous
          this._makePublicReadable(result.id);
          // Mettre en cache
          this._cacheFile(result, folderKey, vehiculeMatricule);
          resolve(result);
        } else {
          reject(new Error(`Upload échoué: ${xhr.status} ${xhr.responseText}`));
        }
      };
      xhr.onerror = () => reject(new Error('Erreur réseau lors de l\'upload'));
      xhr.send(form);
    });
  }

  /** Rendre un fichier lisible publiquement (pour affichage dans l'app) */
  async _makePublicReadable(fileId) {
    try {
      await gapi.client.drive.permissions.create({
        fileId,
        resource: { role: 'reader', type: 'anyone' }
      });
    } catch(e) {
      console.warn('Permission publique non définie:', e);
    }
  }

  // ============================================================
  // 4. LISTAGE & SYNCHRONISATION
  // ============================================================

  /** Lister tous les fichiers d'un dossier */
  async listFiles(folderKey, vehiculeMatricule = '') {
    if (!this.isSignedIn || !this.folderIds[folderKey]) return [];
    const folderId = this.folderIds[folderKey];

    let q = `'${folderId}' in parents and trashed=false`;
    if (vehiculeMatricule) {
      const safeMat = vehiculeMatricule.replace(/[^a-zA-Z0-9-]/g, '_');
      q += ` and name contains '${safeMat}'`;
    }

    try {
      const res = await gapi.client.drive.files.list({
        q,
        fields: 'files(id,name,webViewLink,webContentLink,thumbnailLink,size,mimeType,createdTime,description,modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 100,
        spaces: 'drive'
      });
      return res.result.files || [];
    } catch(e) {
      console.warn('Erreur listage fichiers:', e);
      return [];
    }
  }

  /** Synchroniser TOUS les fichiers depuis Drive vers le cache local */
  async syncAll() {
    if (!this.isSignedIn) return;
    console.log('🔄 Synchronisation Drive en cours...');
    this._notifyStatusChange('syncing', 'Synchronisation Drive...');

    try {
      for (const key of Object.keys(DRIVE_CONFIG.FOLDERS)) {
        const files = await this.listFiles(key);
        this.fileCache[key] = files;
      }
      // Sauvegarder le cache
      localStorage.setItem('driveFileCache', JSON.stringify({
        cache: this.fileCache,
        lastSync: new Date().toISOString()
      }));
      this._notifyStatusChange('synced', `Drive synchronisé — ${new Date().toLocaleTimeString('fr-FR')}`);
      // Appeler tous les callbacks
      this.onSyncCallbacks.forEach(cb => cb(this.fileCache));
      console.log('✅ Synchronisation Drive terminée');
    } catch(e) {
      console.warn('Erreur sync Drive:', e);
      this._notifyStatusChange('error', 'Erreur synchronisation Drive');
    }
  }

  /** Synchronisation automatique */
  startAutoSync() {
    this.stopSync();
    this.syncTimer = setInterval(() => this.syncAll(), DRIVE_CONFIG.SYNC_INTERVAL);
    console.log(`🔄 Auto-sync Drive activé (${DRIVE_CONFIG.SYNC_INTERVAL / 1000}s)`);
  }

  stopSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /** Enregistrer un callback appelé après chaque sync */
  onSync(callback) {
    this.onSyncCallbacks.push(callback);
  }

  // ============================================================
  // 5. SUPPRESSION
  // ============================================================

  async deleteFile(fileId) {
    if (!this.isSignedIn) throw new Error('Non connecté');
    await gapi.client.drive.files.delete({ fileId });
    // Retirer du cache
    for (const key of Object.keys(this.fileCache)) {
      this.fileCache[key] = (this.fileCache[key] || []).filter(f => f.id !== fileId);
    }
    localStorage.setItem('driveFileCache', JSON.stringify({ cache: this.fileCache, lastSync: new Date().toISOString() }));
  }

  // ============================================================
  // 6. GOOGLE PICKER (sélection de fichiers existants)
  // ============================================================

  openPicker(callback) {
    if (!this.isSignedIn) {
      alert('Veuillez vous connecter à Google Drive d\'abord');
      return;
    }
    const picker = new google.picker.PickerBuilder()
      .addView(new google.picker.DocsView()
        .setParent(this.rootFolderId)
        .setIncludeFolders(true))
      .setOAuthToken(this.accessToken)
      .setDeveloperKey(DRIVE_CONFIG.API_KEY)
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          callback(data.docs);
        }
      })
      .build();
    picker.setVisible(true);
  }

  // ============================================================
  // 7. HELPERS
  // ============================================================

  _cacheFile(fileData, folderKey, vehiculeMatricule) {
    if (!this.fileCache[folderKey]) this.fileCache[folderKey] = [];
    this.fileCache[folderKey].unshift({ ...fileData, _vehicule: vehiculeMatricule });
  }

  /** Obtenir les fichiers d'un véhicule depuis le cache */
  getVehicleFiles(matricule) {
    const result = {};
    const safeMat = matricule.replace(/[^a-zA-Z0-9-]/g, '_');
    for (const [key, files] of Object.entries(this.fileCache)) {
      result[key] = (files || []).filter(f => f.name && f.name.includes(safeMat));
    }
    return result;
  }

  /** Charger le cache depuis localStorage au démarrage */
  loadCacheFromStorage() {
    try {
      const raw = localStorage.getItem('driveFileCache');
      if (raw) {
        const stored = JSON.parse(raw);
        this.fileCache = stored.cache || {};
        return stored.lastSync;
      }
    } catch(e) {}
    return null;
  }

  /** Obtenir l'URL d'affichage direct (image) */
  getDisplayUrl(fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
  }

  /** Obtenir l'URL de téléchargement */
  getDownloadUrl(fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  /** Formater la taille de fichier */
  formatSize(bytes) {
    if (!bytes) return '—';
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(1) + ' Ko';
    return (kb / 1024).toFixed(1) + ' Mo';
  }

  _notifyStatusChange(status, message) {
    // Mettre à jour tous les indicateurs de statut Drive dans le DOM
    document.querySelectorAll('[data-drive-status]').forEach(el => {
      el.dataset.driveStatus = status;
      el.textContent = message;
    });
    document.querySelectorAll('[data-drive-dot]').forEach(dot => {
      dot.className = dot.className.replace(/\bdrive-\S+/g, '');
      dot.classList.add(`drive-${status}`);
    });
    // Déclencher un événement custom
    window.dispatchEvent(new CustomEvent('driveStatusChange', { detail: { status, message } }));
  }
}

// ============================================================
// INSTANCE GLOBALE
// ============================================================
window.driveManager = new DriveManager();

// ============================================================
// COMPOSANT UI — UPLOAD WIDGET
// ============================================================
class DriveUploadWidget {
  /**
   * @param {HTMLElement} container - Conteneur DOM
   * @param {Object} options
   *   - matricule: matricule du véhicule
   *   - folderKey: 'PHOTOS' | 'REPARATIONS' | etc.
   *   - accept: types acceptés (ex: 'image/*')
   *   - multiple: boolean
   *   - onSuccess: callback(fileData)
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      matricule: '',
      folderKey: 'DOCUMENTS',
      accept: '*/*',
      multiple: true,
      onSuccess: null,
      ...options
    };
    this.render();
  }

  render() {
    const folderLabel = DRIVE_CONFIG.FOLDERS[this.options.folderKey] || this.options.folderKey;
    this.container.innerHTML = `
      <div class="drive-upload-widget" id="duw-${this.options.folderKey}">
        <div class="duw-dropzone" id="duw-drop-${this.options.folderKey}">
          <div class="duw-icon">☁️</div>
          <div class="duw-title">Déposer des fichiers ici</div>
          <div class="duw-sub">ou <label class="duw-browse" for="duw-input-${this.options.folderKey}">parcourir</label></div>
          <div class="duw-dest">→ ${folderLabel}</div>
          <input type="file" id="duw-input-${this.options.folderKey}"
            accept="${this.options.accept}"
            ${this.options.multiple ? 'multiple' : ''}
            style="display:none">
        </div>
        <div class="duw-progress-list" id="duw-list-${this.options.folderKey}"></div>
      </div>`;
    this._bindEvents();
  }

  _bindEvents() {
    const drop = document.getElementById(`duw-drop-${this.options.folderKey}`);
    const input = document.getElementById(`duw-input-${this.options.folderKey}`);

    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('dragover');
      this._handleFiles(Array.from(e.dataTransfer.files));
    });
    input.addEventListener('change', () => this._handleFiles(Array.from(input.files)));
    drop.addEventListener('click', (e) => {
      if (e.target.classList.contains('duw-browse')) return; // handled by label
      if (!window.driveManager.isSignedIn) {
        window.driveManager.signIn();
      }
    });
  }

  async _handleFiles(files) {
    if (!window.driveManager.isSignedIn) {
      await window.driveManager.signIn();
      return;
    }
    const list = document.getElementById(`duw-list-${this.options.folderKey}`);
    for (const file of files) {
      const itemId = `duw-item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      list.insertAdjacentHTML('beforeend', `
        <div class="duw-item" id="${itemId}">
          <div class="duw-item-name">${file.name}</div>
          <div class="duw-item-bar"><div class="duw-item-fill" style="width:0%"></div></div>
          <div class="duw-item-pct">0%</div>
        </div>`);
      try {
        const result = await window.driveManager.uploadFile(
          file,
          this.options.folderKey,
          this.options.matricule,
          (pct) => {
            const item = document.getElementById(itemId);
            if (item) {
              item.querySelector('.duw-item-fill').style.width = pct + '%';
              item.querySelector('.duw-item-pct').textContent = pct + '%';
            }
          }
        );
        const item = document.getElementById(itemId);
        if (item) {
          item.classList.add('done');
          item.querySelector('.duw-item-fill').style.width = '100%';
          item.querySelector('.duw-item-pct').textContent = '✓';
        }
        if (this.options.onSuccess) this.options.onSuccess(result);
      } catch(e) {
        const item = document.getElementById(itemId);
        if (item) { item.classList.add('error'); item.querySelector('.duw-item-pct').textContent = '✗'; }
        console.error('Erreur upload:', e);
      }
    }
  }
}

window.DriveUploadWidget = DriveUploadWidget;

// ============================================================
// COMPOSANT UI — GALERIE FICHIERS
// ============================================================
class DriveFileGallery {
  /**
   * @param {HTMLElement} container
   * @param {string} matricule - Matricule du véhicule à afficher
   */
  constructor(container, matricule) {
    this.container = container;
    this.matricule = matricule;
    this.render();
    // Se mettre à jour après chaque sync
    window.driveManager.onSync(() => this.render());
  }

  render() {
    const files = window.driveManager.getVehicleFiles(this.matricule);
    const totalFiles = Object.values(files).flat().length;

    if (totalFiles === 0) {
      this.container.innerHTML = `
        <div class="dfg-empty">
          <div style="font-size:32px">📂</div>
          <div>Aucun fichier Drive pour ce véhicule</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px">Utilisez le widget ci-dessous pour uploader</div>
        </div>`;
      return;
    }

    let html = '<div class="dfg-sections">';
    for (const [key, fileList] of Object.entries(files)) {
      if (!fileList.length) continue;
      const folderLabel = DRIVE_CONFIG.FOLDERS[key] || key;
      html += `<div class="dfg-section">
        <div class="dfg-section-title">📁 ${folderLabel} <span class="dfg-count">${fileList.length}</span></div>
        <div class="dfg-grid">`;
      for (const f of fileList) {
        const isImage = f.mimeType && f.mimeType.startsWith('image/');
        const isPDF = f.mimeType === 'application/pdf';
        const icon = isImage ? '🖼️' : isPDF ? '📄' : '📎';
        const thumb = isImage ? `<img src="${window.driveManager.getDisplayUrl(f.id)}" alt="${f.name}" class="dfg-thumb" onerror="this.style.display='none'">` : `<div class="dfg-icon">${icon}</div>`;

        html += `<div class="dfg-card" data-id="${f.id}">
          ${thumb}
          <div class="dfg-card-name">${f.name.replace(/_\d{4}-\d{2}-\d{2}T[^.]+/, '')}</div>
          <div class="dfg-card-meta">${window.driveManager.formatSize(parseInt(f.size))} · ${new Date(f.createdTime).toLocaleDateString('fr-FR')}</div>
          <div class="dfg-card-actions">
            <a href="${f.webViewLink}" target="_blank" class="dfg-btn dfg-view">👁 Voir</a>
            <a href="${window.driveManager.getDownloadUrl(f.id)}" download class="dfg-btn dfg-dl">⬇</a>
            <button class="dfg-btn dfg-del" onclick="driveManager.deleteFile('${f.id}').then(()=>this.closest('.dfg-card').remove())">🗑</button>
          </div>
        </div>`;
      }
      html += '</div></div>';
    }
    html += '</div>';
    this.container.innerHTML = html;
  }
}

window.DriveFileGallery = DriveFileGallery;

// ============================================================
// COMPOSANT UI — CARTE GRISE RECTO/VERSO
// ============================================================
class CarteGriseWidget {
  /**
   * Widget dédié à l'upload de la carte grise recto et verso.
   * Chaque face est uploadée avec le suffixe _RECTO ou _VERSO
   * dans le dossier CARTES_GRISES, ce qui évite tout conflit de nom
   * même si les deux fichiers portent le même nom original.
   *
   * @param {HTMLElement} container
   * @param {string} matricule - Matricule du véhicule (ex: "13-356835")
   * @param {Function} onSuccess - callback(side, fileData) appelé après chaque upload réussi
   */
  constructor(container, matricule, onSuccess = null) {
    this.container = container;
    this.matricule = matricule;
    this.onSuccess = onSuccess;
    this.uploaded = { RECTO: null, VERSO: null };
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="cgw-wrapper">
        <div class="cgw-title">
          <span style="font-size:18px;">🪪</span>
          Carte Grise — Recto &amp; Verso
          <span class="cgw-matricule">${this.matricule}</span>
        </div>
        <div class="cgw-sides">
          ${this._sideHTML('RECTO', '⬆️', 'Recto (face avant)')}
          ${this._sideHTML('VERSO', '⬇️', 'Verso (face arrière)')}
        </div>
        <div class="cgw-progress" id="cgw-progress-${this._id()}"></div>
      </div>`;
    this._bindSide('RECTO');
    this._bindSide('VERSO');
  }

  _id() { return this.matricule.replace(/[^a-zA-Z0-9]/g, '_'); }

  _sideHTML(side, emoji, label) {
    const id = this._id();
    return `
      <div class="cgw-side" id="cgw-side-${id}-${side}">
        <div class="cgw-side-label">${emoji} ${label}</div>
        <label class="cgw-dropzone" for="cgw-input-${id}-${side}">
          <div class="cgw-preview-wrap" id="cgw-preview-${id}-${side}">
            <div class="cgw-placeholder">
              <div style="font-size:32px;">📷</div>
              <div style="font-size:12px;color:#64748b;margin-top:6px;">Appuyer pour choisir</div>
            </div>
          </div>
          <input type="file" id="cgw-input-${id}-${side}"
            accept="image/*" capture="environment" style="display:none">
        </label>
        <div class="cgw-side-status" id="cgw-status-${id}-${side}">En attente</div>
      </div>`;
  }

  _bindSide(side) {
    const id = this._id();
    const input = document.getElementById(`cgw-input-${id}-${side}`);
    if (!input) return;
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      await this._uploadSide(side, file);
    });
  }

  async _uploadSide(side, file) {
    const id = this._id();
    const statusEl = document.getElementById(`cgw-status-${id}-${side}`);
    const previewWrap = document.getElementById(`cgw-preview-${id}-${side}`);

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      previewWrap.innerHTML = `<img src="${e.target.result}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;">`;
    };
    reader.readAsDataURL(file);

    if (!window.driveManager.isSignedIn) {
      if (statusEl) statusEl.textContent = '🔐 Connexion Google Drive requise…';
      await window.driveManager.signIn();
      if (!window.driveManager.isSignedIn) {
        if (statusEl) statusEl.textContent = '❌ Connexion annulée';
        return;
      }
    }

    if (statusEl) statusEl.textContent = '⬆️ Upload en cours…';

    try {
      const result = await window.driveManager.uploadFile(
        file,
        'CARTES_GRISES',
        this.matricule,
        (pct) => { if (statusEl) statusEl.textContent = `⬆️ ${pct}%`; },
        side   // ← label: 'RECTO' ou 'VERSO'
      );
      this.uploaded[side] = result;
      if (statusEl) {
        statusEl.textContent = `✅ ${side} uploadé`;
        statusEl.style.color = '#10b981';
      }
      if (this.onSuccess) this.onSuccess(side, result);

      // Badge sur la prévisualisation
      const badge = document.createElement('div');
      badge.style.cssText = 'position:absolute;top:4px;right:4px;background:#10b981;color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;';
      badge.textContent = side;
      previewWrap.style.position = 'relative';
      previewWrap.appendChild(badge);

    } catch(e) {
      if (statusEl) { statusEl.textContent = '❌ Erreur upload'; statusEl.style.color = '#ef4444'; }
      console.error(`Erreur upload carte grise ${side}:`, e);
    }
  }
}

window.CarteGriseWidget = CarteGriseWidget;

// ============================================================
// COMPOSANT UI — UPLOAD PRÉSENTATIONS PPT/PPTX
// ============================================================
class PresentationUploadWidget {
  /**
   * Widget d'upload pour fichiers PowerPoint (.ppt, .pptx).
   * Les fichiers sont stockés dans le dossier PRESENTATIONS de Drive.
   * Après upload, un lien "Voir dans Drive" est affiché pour
   * consulter ou modifier la présentation directement depuis Google Drive.
   *
   * @param {HTMLElement} container
   * @param {string} matricule - Matricule du véhicule (contexte)
   * @param {Function} onSuccess - callback(fileData)
   */
  constructor(container, matricule, onSuccess = null) {
    this.container = container;
    this.matricule = matricule;
    this.onSuccess = onSuccess;
    this.files = [];
    this.render();
    // Rafraîchir la liste après chaque sync Drive
    window.driveManager.onSync(() => this._refreshList());
  }

  render() {
    const id = this._id();
    this.container.innerHTML = `
      <div class="puw-wrapper">
        <div class="puw-header">
          <span style="font-size:20px;">📊</span>
          <span class="puw-title-text">Présentations PowerPoint</span>
          <label class="puw-add-btn" for="puw-input-${id}">
            ＋ Ajouter PPT
          </label>
          <input type="file" id="puw-input-${id}"
            accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            multiple style="display:none">
        </div>
        <div class="puw-list" id="puw-list-${id}">
          <div class="puw-empty">Aucune présentation — cliquez sur <strong>＋ Ajouter PPT</strong></div>
        </div>
        <div class="puw-progress" id="puw-progress-${id}"></div>
      </div>`;
    this._bindInput();
    this._refreshList();
  }

  _id() { return (this.matricule || 'global').replace(/[^a-zA-Z0-9]/g, '_'); }

  _bindInput() {
    const input = document.getElementById(`puw-input-${this._id()}`);
    if (!input) return;
    input.addEventListener('change', async () => {
      const files = Array.from(input.files);
      for (const file of files) await this._uploadPPT(file);
      input.value = '';
    });
  }

  async _uploadPPT(file) {
    const id = this._id();
    const progressEl = document.getElementById(`puw-progress-${id}`);

    if (!window.driveManager.isSignedIn) {
      if (progressEl) progressEl.innerHTML = `<span style="color:#f97316;">🔐 Connexion Drive requise…</span>`;
      await window.driveManager.signIn();
      if (!window.driveManager.isSignedIn) return;
    }

    const itemId = `puw-item-${Date.now()}`;
    if (progressEl) {
      progressEl.innerHTML = `
        <div class="puw-upload-item" id="${itemId}">
          <span class="puw-file-icon">📊</span>
          <span class="puw-file-name">${file.name}</span>
          <span class="puw-file-pct" id="${itemId}-pct">0%</span>
        </div>`;
    }

    try {
      const result = await window.driveManager.uploadFile(
        file,
        'PRESENTATIONS',
        this.matricule,
        (pct) => {
          const pctEl = document.getElementById(`${itemId}-pct`);
          if (pctEl) pctEl.textContent = pct + '%';
        },
        'PPT'
      );
      const pctEl = document.getElementById(`${itemId}-pct`);
      if (pctEl) { pctEl.textContent = '✓'; pctEl.style.color = '#10b981'; }
      setTimeout(() => { if (progressEl) progressEl.innerHTML = ''; }, 3000);
      if (this.onSuccess) this.onSuccess(result);
      this._refreshList();
    } catch(e) {
      const pctEl = document.getElementById(`${itemId}-pct`);
      if (pctEl) { pctEl.textContent = '✗'; pctEl.style.color = '#ef4444'; }
      console.error('Erreur upload PPT:', e);
    }
  }

  _refreshList() {
    const id = this._id();
    const listEl = document.getElementById(`puw-list-${id}`);
    if (!listEl) return;

    const allFiles = window.driveManager.fileCache['PRESENTATIONS'] || [];
    const safeMat = (this.matricule || '').replace(/[^a-zA-Z0-9-]/g, '_');
    const files = this.matricule
      ? allFiles.filter(f => f.name && f.name.includes(safeMat))
      : allFiles;

    if (files.length === 0) {
      listEl.innerHTML = `<div class="puw-empty">Aucune présentation — cliquez sur <strong>＋ Ajouter PPT</strong></div>`;
      return;
    }

    listEl.innerHTML = files.map(f => `
      <div class="puw-file-row">
        <span class="puw-file-icon">📊</span>
        <div class="puw-file-info">
          <div class="puw-file-title">${f.name.replace(/_PPT_\d{4}-\d{2}-\d{2}T[^.]+/, '').replace(/_/g,' ')}</div>
          <div class="puw-file-meta">${window.driveManager.formatSize(parseInt(f.size))} · ${new Date(f.createdTime).toLocaleDateString('fr-FR')}</div>
        </div>
        <div class="puw-file-actions">
          <a href="${f.webViewLink}" target="_blank" class="puw-btn puw-btn-open" title="Ouvrir dans Drive">
            🔗 Drive
          </a>
          <a href="${window.driveManager.getDownloadUrl(f.id)}" download class="puw-btn puw-btn-dl" title="Télécharger">
            ⬇
          </a>
          <button class="puw-btn puw-btn-del" title="Supprimer"
            onclick="driveManager.deleteFile('${f.id}').then(()=>this.closest('.puw-file-row').remove())">
            🗑
          </button>
        </div>
      </div>`).join('');
  }
}

window.PresentationUploadWidget = PresentationUploadWidget;

console.log('✅ Module Drive chargé — Parc Auto DRT Sfax');
