/* ============================================
   PARC AUTO DRT SFAX - LOGIQUE JAVASCRIPT
   AVEC SYNCHRONISATION CLOUD JSONBIN.IO
   ============================================ */

// ============================================
// CONFIGURATION JSONBIN.IO
// ============================================
// ⚠️ SÉCURITÉ: Déplacez ces clés dans des variables d'environnement en production
const JSONBIN_CONFIG = {
  API_KEY: '$2a$10$F1db60DDgpDtxyVMJJlPg.twFuf0nscnFDLXJtunPSitrBZAJoq9y',
  BIN_ID: '6a1b534221f9ee59d29efd76',  // Ton Bin ID
  BASE_URL: 'https://api.jsonbin.io/v3/b'
};

// ============================================
// DONNÉES PAR DÉFAUT
// ============================================
const DEFAULT_DATA = {
  vehicles: [
    {
      id: 'v1',
      matricule: '17-356835',
      modele: 'Peugeot 301',
      chauffeur: 'Ahmed Ben Ali',
      km: 45230,
      prochaineVidange: 50000,
      prochaineChaine: 55000,
      prochaineVisite: '2026-08-15',
      statut: 'actif'
    },
    {
      id: 'v2',
      matricule: '17-123456',
      modele: 'Renault Symbol',
      chauffeur: 'Mohamed Trabelsi',
      km: 67890,
      prochaineVidange: 70000,
      prochaineChaine: 75000,
      prochaineVisite: '2026-07-20',
      statut: 'actif'
    },
    {
      id: 'v3',
      matricule: '17-999999',
      modele: 'Hyundai Accent',
      chauffeur: 'Karim Gharbi',
      km: 32100,
      prochaineVidange: 35000,
      prochaineChaine: 40000,
      prochaineVisite: '2026-09-01',
      statut: 'actif'
    },
    {
      id: 'v4',
      matricule: '17-111111',
      modele: 'Volkswagen Polo',
      chauffeur: 'Sami Jebali',
      km: 89100,
      prochaineVidange: 90000,
      prochaineChaine: 95000,
      prochaineVisite: '2026-06-30',
      statut: 'alerte'
    },
    {
      id: 'v5',
      matricule: '17-222222',
      modele: 'Fiat Tipo',
      chauffeur: 'Nabil Mejri',
      km: 12300,
      prochaineVidange: 15000,
      prochaineChaine: 20000,
      prochaineVisite: '2026-10-10',
      statut: 'actif'
    }
  ],
  repairs: [
    {
      id: 'r1',
      matricule: '17-356835',
      chauffeur: 'Ahmed Ben Ali',
      type: 'Vidange',
      designation: 'Vidange complète + filtre à huile',
      date: '2026-04-15',
      km: 45000,
      montant: 185.50
    },
    {
      id: 'r2',
      matricule: '17-123456',
      chauffeur: 'Mohamed Trabelsi',
      type: 'Réparation',
      designation: 'Remplacement plaquettes de frein avant',
      date: '2026-05-10',
      km: 67500,
      montant: 320.00
    },
    {
      id: 'r3',
      matricule: '17-111111',
      chauffeur: 'Sami Jebali',
      type: 'Visite Technique',
      designation: 'Contrôle technique annuel',
      date: '2026-05-20',
      km: 89000,
      montant: 45.00
    },
    {
      id: 'r4',
      matricule: '17-356835',
      chauffeur: 'Ahmed Ben Ali',
      type: 'Pneumatique',
      designation: 'Remplacement 4 pneus Michelin',
      date: '2026-03-10',
      km: 44000,
      montant: 680.00
    }
  ],
  settings: {
    alerteVidange: 1000,
    alerteChaine: 1000,
    alerteVisite: 7,
    entreprise: 'Tunisie Telecom'
  },
  currentUser: null,
  userVehicle: null
};

// ============================================
// UTILISATEURS ADMIN
// ============================================
const ADMIN_USERS = [
  { email: 'admin@drt.tn', password: 'DRT@Sfax2026', role: 'admin', name: 'Administrateur' }
];

// ============================================
// CLASSE PRINCIPALE
// ============================================
class ParcAutoApp {
  constructor() {
    this.data = null;
    this.currentTab = 'dashboard';
    this.alertFilter = 'all';
    this.isCloudSync = false;
    this.init();
  }

  // ============================================
  // SYNCHRONISATION CLOUD JSONBIN.IO
  // ============================================

  isCloudConfigured() {
    return JSONBIN_CONFIG.API_KEY && JSONBIN_CONFIG.API_KEY.length > 20 && JSONBIN_CONFIG.BIN_ID;
  }

  // Lire les données depuis JSONBin.io (avec clé API pour Private Bin)
  async readFromCloud() {
    if (!this.isCloudConfigured()) {
      console.log('Cloud non configuré');
      return null;
    }

    try {
      console.log('Lecture du cloud...');
      const response = await fetch(`${JSONBIN_CONFIG.BASE_URL}/${JSONBIN_CONFIG.BIN_ID}/latest`, {
        method: 'GET',
        headers: {
          'X-Master-Key': JSONBIN_CONFIG.API_KEY
        }
      });

      if (!response.ok) {
        console.warn('Erreur lecture cloud:', response.status, response.statusText);
        return null;
      }

      const result = await response.json();
      console.log('✅ Données cloud reçues');
      return result.record || result;
    } catch (e) {
      console.warn('Erreur connexion cloud:', e);
      return null;
    }
  }

  // Écrire les données sur JSONBin.io
  async writeToCloud() {
    if (!this.isCloudConfigured()) {
      console.log('Cloud non configuré');
      return false;
    }

    try {
      console.log('Écriture sur le cloud...');
      const response = await fetch(`${JSONBIN_CONFIG.BASE_URL}/${JSONBIN_CONFIG.BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': JSONBIN_CONFIG.API_KEY
        },
        body: JSON.stringify(this.data)
      });

      if (!response.ok) {
        console.warn('Erreur écriture cloud:', response.status, response.statusText);
        return false;
      }

      console.log('✅ Données sauvegardées sur le cloud');
      return true;
    } catch (e) {
      console.warn('Erreur écriture cloud:', e);
      return false;
    }
  }

  // ============================================
  // CHARGEMENT / SAUVEGARDE
  // ============================================
  async loadData() {
    // Essayer d'abord le cloud
    if (this.isCloudConfigured()) {
      this.showToast('☁️ Connexion au cloud...', 'info');
      const cloudData = await this.readFromCloud();

      if (cloudData && cloudData.vehicles) {
        this.isCloudSync = true;
        this.showToast('✅ Données synchronisées depuis le cloud', 'success');
        return cloudData;
      } else {
        this.showToast('⚠️ Cloud indisponible, mode local', 'warning');
      }
    }

    // Fallback sur localStorage
    try {
      const saved = localStorage.getItem('parcAutoData_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_DATA, ...parsed };
      }
    } catch (e) {
      console.warn('Erreur chargement localStorage:', e);
    }

    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  async saveData() {
    // Sauvegarder en local
    try {
      localStorage.setItem('parcAutoData_v3', JSON.stringify(this.data));
    } catch (e) {
      console.warn('Erreur sauvegarde localStorage:', e);
    }

    // Sauvegarder sur le cloud
    if (this.isCloudConfigured()) {
      const success = await this.writeToCloud();
      if (success) {
        this.showSyncStatus('synced');
        this.showToast('☁️ Données sauvegardées sur le cloud', 'success');
      } else {
        this.showSyncStatus('error');
        this.showToast('❌ Erreur cloud - sauvegarde locale', 'error');
      }
    } else {
      this.showSyncStatus('synced');
    }
  }

  // ============================================
  // INITIALISATION
  // ============================================
  async init() {
    this.data = await this.loadData();
    this.initHomePage();
    this.initAdminLogin();
    this.initUserLogin();
    this.initNavigation();
    this.initForms();
    this.initSearch();
    this.renderAll();
    // Activer les notifications push
    registerPushNotifications();

    if (this.data.currentUser && this.data.currentUser.role === 'user') {
      this.startAutoSync();
    }
  }

  startAutoSync() {
    if (!this.isCloudConfigured()) return;

    setInterval(async () => {
      const cloudData = await this.readFromCloud();
      if (cloudData && JSON.stringify(cloudData) !== JSON.stringify(this.data)) {
        this.data = cloudData;
        this.renderUserVehicleDetail();
        this.showToast('🔄 Données mises à jour depuis le cloud', 'success');
      }
    }, 30000);
  }

  // ============================================
  // PAGE D'ACCUEIL
  // ============================================
  initHomePage() {}

  // ============================================
  // LOGIN ADMIN
  // ============================================
  initAdminLogin() {
    const form = document.getElementById('admin-login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-email').value.trim();
      const password = document.getElementById('admin-password').value;

      const user = ADMIN_USERS.find(u => u.email === email && u.password === password);

      if (user) {
        this.data.currentUser = { email: user.email, role: user.role, name: user.name };
        this.data.userVehicle = null;
        await this.saveData();
        this.showToast('Connexion administrateur réussie', 'success');
        setTimeout(() => { window.location.href = 'admin.html'; }, 500);
      } else {
        this.showToast('Email ou mot de passe incorrect', 'error');
      }
    });
  }

  // ============================================
  // LOGIN UTILISATEUR (Matricule seul)
  // ============================================
  initUserLogin() {
    const form = document.getElementById('user-login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const matriculeInput = document.getElementById('user-matricule').value.trim().toUpperCase();

      // Recharger les données depuis le cloud
      if (this.isCloudConfigured()) {
        const cloudData = await this.readFromCloud();
        if (cloudData && cloudData.vehicles) {
          this.data = cloudData;
        }
      }

      const vehicle = this.data.vehicles.find(v => {
        const dbMat = v.matricule.toUpperCase().replace(/[\s-]/g, '').trim();
        const inputMat = matriculeInput.replace(/[\s-]/g, '').trim();
        return dbMat === inputMat;
      });

      if (vehicle) {
        this.data.currentUser = { role: 'user', name: vehicle.chauffeur || 'Utilisateur' };
        this.data.userVehicle = vehicle.matricule;
        await this.saveData();
        this.showToast('Véhicule trouvé ! Redirection...', 'success');

        // Déclencher la voix ici (dans le handler utilisateur) pour contourner la restriction navigateur
        if (window.speechSynthesis) {
          window._tipsVoiceReady = true;
          window.speechSynthesis.cancel(); // reset
        }
        // Extraire le prénom uniquement (premier mot du nom)
        const fullName = vehicle.chauffeur || 'Utilisateur';
        const prenom = fullName.split(' ')[0];
        const matricule = vehicle.matricule;
        const modele = vehicle.modele || 'véhicule';

        // Formater le matricule avec espaces: 17-356835 -> 17- 356 835
        function formatMatriculeVoix(mat) {
          const parts = mat.split('-');
          if (parts.length === 2) {
            const prefix = parts[0];
            const nums = parts[1];
            // Groupe par 3 chiffres
            const grouped = nums.match(/.{1,3}/g).join(' ');
            return prefix + '- ' + grouped;
          }
          return mat;
        }
        const matriculeFormate = formatMatriculeVoix(matricule);

        const speakWelcome = (callback) => {
          if (!window.speechSynthesis) { callback(); return; }
          const msg = `Bienvenue ${prenom}, vous êtes dans l'interface de votre véhicule ${modele} ${matriculeFormate}.`;
          const utter = new SpeechSynthesisUtterance(msg);
          utter.lang  = 'fr-FR';
          utter.rate  = 0.80;
          utter.pitch = 0.85;
          const voices = window.speechSynthesis.getVoices();
          // Essayer de trouver une voix différente (plus grave/masculine)
          const frVoice = voices.find(v => v.lang === 'fr-FR' && v.name.toLowerCase().includes('male')) 
                       || voices.find(v => v.lang === 'fr-FR' && v.name.toLowerCase().includes('homme'))
                       || voices.find(v => v.lang === 'fr-FR')
                       || voices.find(v => v.lang.startsWith('fr'));
          if (frVoice) utter.voice = frVoice;
          utter.onend   = () => callback();
          utter.onerror = () => callback();
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utter);
        };

        setTimeout(() => {
          document.getElementById('login-user').style.display = 'none';
          if (typeof showTips === 'function') {
            showTips(() => {
              document.getElementById('user-interface').style.display = 'block';
              this.renderUserVehicleDetail();
              this.startAutoSync();
              // Message de bienvenue vocal après les conseils, puis alertes
              const vehicle = this.data.vehicles.find(v => v.matricule === matricule);
              const userAlerts = vehicle ? this.getAlerts().filter(a => a.vehicle.id === vehicle.id) : [];
              speakWelcome(() => {
                if (userAlerts.length > 0) {
                  setTimeout(() => this.speakAlerts(userAlerts), 800);
                }
              });
            });
          } else {
            document.getElementById('user-interface').style.display = 'block';
            this.renderUserVehicleDetail();
            this.startAutoSync();
            // Message de bienvenue puis alertes
            const vehicle2 = this.data.vehicles.find(v => v.matricule === matricule);
            const userAlerts2 = vehicle2 ? this.getAlerts().filter(a => a.vehicle.id === vehicle2.id) : [];
            speakWelcome(() => {
              if (userAlerts2.length > 0) {
                setTimeout(() => this.speakAlerts(userAlerts2), 800);
              }
            });
          }
        }, 500);
      } else {
        this.showToast('Matricule non trouvé. Vérifiez votre saisie.', 'error');
      }
    });
  }

  // ============================================
  // NAVIGATION (Admin)
  // ============================================
  initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-nav]');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.dataset.nav;
        this.showTab(tab);
      });
    });
  }

  showTab(tabName) {
    document.querySelectorAll('.nav-item[data-nav]').forEach(item => {
      item.classList.toggle('active', item.dataset.nav === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.toggle('active', tab.id === `tab-${tabName}`);
    });

    const breadcrumb = document.getElementById('breadcrumb-current');
    if (breadcrumb) {
      const titles = {
        dashboard: 'Tableau de bord',
        vehicles: 'Parc Véhicules',
        alerts: 'Alertes',
        repairs: 'Historique Réparations',
        'add-repair': 'Nouvelle Intervention',
        settings: 'Paramètres'
      };
      breadcrumb.textContent = titles[tabName] || tabName;
    }

    this.currentTab = tabName;
    this.renderAll();
  }

  // ============================================
  // FORMULAIRES
  // ============================================
  initForms() {
    const vehicleForm = document.getElementById('vehicle-form');
    if (vehicleForm) {
      vehicleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveVehicle();
      });
    }

    const repairForm = document.getElementById('repair-form');
    if (repairForm) {
      repairForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveRepair();
      });
    }

    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSettings();
      });
    }
  }

  // ============================================
  // RECHERCHE
  // ============================================
  initSearch() {
    const searchVehicles = document.getElementById('search-vehicles');
    if (searchVehicles) {
      searchVehicles.addEventListener('input', () => this.renderVehiclesTable());
    }

    const searchRepairs = document.getElementById('search-repairs');
    if (searchRepairs) {
      searchRepairs.addEventListener('input', () => this.renderRepairsTable());
    }
  }

  // ============================================
  // RENDU GLOBAL
  // ============================================
  renderAll() {
    this.updateAlertCounts();
    this.renderStats();
    this.renderVehiclesTable();
    this.renderAlertsTable();
    this.renderRepairsTable();
    this.renderDashboardAlerts();
    this.renderDashboardRepairs();
    this.populateVehicleSelect();
    this.loadSettings();
  }

  // ============================================
  // STATISTIQUES
  // ============================================
  renderStats() {
    const container = document.getElementById('stats-container');
    if (!container) return;

    const totalVehicles = this.data.vehicles.length;
    const activeVehicles = this.data.vehicles.filter(v => v.statut === 'actif').length;
    const alertVehicles = this.getAlerts().length;
    const totalRepairs = this.data.repairs.length;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue">🚗</div>
        <div class="stat-info">
          <h3>${totalVehicles}</h3>
          <p>Véhicules total</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">✅</div>
        <div class="stat-info">
          <h3>${activeVehicles}</h3>
          <p>Véhicules actifs</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">🔧</div>
        <div class="stat-info">
          <h3>${totalRepairs}</h3>
          <p>Interventions</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">🚨</div>
        <div class="stat-info">
          <h3>${alertVehicles}</h3>
          <p>Alertes actives</p>
        </div>
      </div>
    `;
  }

  // ============================================
  // ALERTES
  // ============================================
  getAlerts() {
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const settings = this.data.settings;

    this.data.vehicles.forEach(v => {
      if (v.prochaineVidange && v.km >= v.prochaineVidange - settings.alerteVidange) {
        const kmRestant = v.prochaineVidange - v.km;
        alerts.push({
          vehicle: v,
          type: 'Vidange',
          detail: kmRestant <= 0 ? `DÉPASSÉE de ${Math.abs(kmRestant).toLocaleString()} km` : `${kmRestant.toLocaleString()} km restants`,
          priority: kmRestant <= 0 ? 'urgent' : 'warning',
          rawValue: kmRestant
        });
      }

      if (v.prochaineChaine && v.km >= v.prochaineChaine - settings.alerteChaine) {
        const kmRestant = v.prochaineChaine - v.km;
        alerts.push({
          vehicle: v,
          type: 'Kit Chaîne',
          detail: kmRestant <= 0 ? `DÉPASSÉE de ${Math.abs(kmRestant).toLocaleString()} km` : `${kmRestant.toLocaleString()} km restants`,
          priority: kmRestant <= 0 ? 'urgent' : 'warning',
          rawValue: kmRestant
        });
      }

      if (v.prochaineVisite) {
        const visiteDate = new Date(v.prochaineVisite);
        visiteDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.ceil((visiteDate - today) / (1000 * 60 * 60 * 24));
        if (daysDiff <= settings.alerteVisite) {
          alerts.push({
            vehicle: v,
            type: 'Visite Technique',
            detail: daysDiff < 0 ? `DÉPASSÉE de ${Math.abs(daysDiff)} jours` : `${daysDiff} jours restants`,
            priority: daysDiff < 0 ? 'urgent' : 'warning',
            rawValue: daysDiff
          });
        }
      }
    });

    return alerts;
  }

  updateAlertCounts() {
    const alerts = this.getAlerts();
    const navBadge = document.getElementById('nav-alert-count');
    if (navBadge) {
      navBadge.textContent = alerts.length;
      navBadge.style.display = alerts.length > 0 ? 'inline-flex' : 'none';
    }

    const notifDot = document.getElementById('notif-dot');
    if (notifDot) {
      notifDot.style.display = alerts.length > 0 ? 'block' : 'none';
    }

    const navVehicleCount = document.getElementById('nav-vehicle-count');
    if (navVehicleCount) {
      navVehicleCount.textContent = this.data.vehicles.length;
    }
  }

  renderAlertsTable() {
    const tbody = document.getElementById('alerts-table-body');
    if (!tbody) return;

    let alerts = this.getAlerts();

    if (this.alertFilter !== 'all') {
      alerts = alerts.filter(a => a.priority === this.alertFilter);
    }

    if (alerts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--secondary);"><div style="font-size:40px;margin-bottom:8px;">✅</div><strong>Aucune alerte</strong><br><span style="font-size:13px;">Tous les véhicules sont à jour</span></td></tr>`;
      return;
    }

    tbody.innerHTML = alerts.map(a => `
      <tr>
        <td><strong>${a.vehicle.matricule}</strong></td>
        <td>${a.vehicle.chauffeur || '-'}</td>
        <td><span class="badge badge-${a.priority === 'urgent' ? 'danger' : 'warning'}">${a.priority === 'urgent' ? 'URGENT' : 'AVERTISSEMENT'}</span></td>
        <td>${a.type}</td>
        <td>${a.detail}</td>
        <td>${a.vehicle.km.toLocaleString()} km</td>
      </tr>
    `).join('');
  }

  renderDashboardAlerts() {
    const tbody = document.getElementById('dashboard-alerts-body');
    if (!tbody) return;

    const alerts = this.getAlerts().slice(0, 5);

    if (alerts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--secondary);"><div style="font-size:32px;margin-bottom:8px;">✅</div>Aucune alerte active</td></tr>`;
      return;
    }

    tbody.innerHTML = alerts.map(a => `
      <tr>
        <td><strong>${a.vehicle.matricule}</strong></td>
        <td>${a.vehicle.chauffeur || '-'}</td>
        <td><span class="badge badge-${a.priority === 'urgent' ? 'danger' : 'warning'}">${a.type}</span></td>
        <td>${a.detail}</td>
        <td>${a.vehicle.km.toLocaleString()} km</td>
      </tr>
    `).join('');
  }

  // ============================================
  // VÉHICULES
  // ============================================
  renderVehiclesTable() {
    const tbody = document.getElementById('vehicles-table-body');
    if (!tbody) return;

    const search = document.getElementById('search-vehicles')?.value.toLowerCase() || '';
    let vehicles = this.data.vehicles;

    if (search) {
      vehicles = vehicles.filter(v =>
        v.matricule.toLowerCase().includes(search) ||
        v.modele.toLowerCase().includes(search) ||
        (v.chauffeur && v.chauffeur.toLowerCase().includes(search))
      );
    }

    if (vehicles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--secondary);"><div style="font-size:40px;margin-bottom:8px;">🚗</div><strong>Aucun véhicule</strong><br><span style="font-size:13px;">Ajoutez un véhicule pour commencer</span></td></tr>`;
      return;
    }

    tbody.innerHTML = vehicles.map(v => {
      const alerts = this.getAlerts().filter(a => a.vehicle.id === v.id);
      const hasAlert = alerts.length > 0;
      const alertTypes = alerts.map(a => a.type).join(', ');

      return `
        <tr>
          <td><strong>${v.matricule}</strong></td>
          <td>${v.modele}</td>
          <td>${v.chauffeur || '-'}</td>
          <td>${v.km.toLocaleString()}</td>
          <td>${v.prochaineVidange ? v.prochaineVidange.toLocaleString() : '-'}</td>
          <td>${v.prochaineChaine ? v.prochaineChaine.toLocaleString() : '-'}</td>
          <td>${v.prochaineVisite || '-'}</td>
          <td><span class="badge badge-${hasAlert ? 'danger' : 'success'}">${hasAlert ? '⚠️ ' + alertTypes : '✅ OK'}</span></td>
          <td>
            <button class="action-btn edit" onclick="parcAuto.editVehicle('${v.id}')">✏️</button>
            <button class="action-btn delete" onclick="parcAuto.deleteVehicle('${v.id}')">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  openVehicleModal(vehicleId = null) {
    const modal = document.getElementById('vehicle-modal');
    const title = document.getElementById('vehicle-modal-title');
    const form = document.getElementById('vehicle-form');

    form.reset();
    document.getElementById('vehicle-id').value = '';

    if (vehicleId) {
      const v = this.data.vehicles.find(v => v.id === vehicleId);
      if (v) {
        title.textContent = 'Modifier Véhicule';
        document.getElementById('vehicle-id').value = v.id;
        document.getElementById('vehicle-matricule').value = v.matricule;
        document.getElementById('vehicle-modele').value = v.modele;
        document.getElementById('vehicle-chauffeur').value = v.chauffeur || '';
        document.getElementById('vehicle-km').value = v.km;
        document.getElementById('vehicle-vidange').value = v.prochaineVidange || '';
        document.getElementById('vehicle-chaine').value = v.prochaineChaine || '';
        document.getElementById('vehicle-visite').value = v.prochaineVisite || '';
      }
    } else {
      title.textContent = 'Nouveau Véhicule';
    }

    modal.classList.add('active');
  }

  async saveVehicle() {
    const id = document.getElementById('vehicle-id').value;
    const kmVal = parseInt(document.getElementById('vehicle-km').value) || 0;
    if (kmVal > 999999) {
      this.showToast('Kilometrage incoherent (max 999 999 km)', 'error');
      return;
    }
    const vehicle = {
      id: id || 'v' + Date.now(),
      matricule: document.getElementById('vehicle-matricule').value.trim().toUpperCase(),
      modele: document.getElementById('vehicle-modele').value.trim(),
      chauffeur: document.getElementById('vehicle-chauffeur').value.trim(),
      km: kmVal,
      prochaineVidange: parseInt(document.getElementById('vehicle-vidange').value) || null,
      prochaineChaine: parseInt(document.getElementById('vehicle-chaine').value) || null,
      prochaineVisite: document.getElementById('vehicle-visite').value || null,
      statut: 'actif'
    };

    if (id) {
      const index = this.data.vehicles.findIndex(v => v.id === id);
      if (index !== -1) this.data.vehicles[index] = vehicle;
    } else {
      this.data.vehicles.push(vehicle);
    }

    await this.saveData();
    this.renderAll();
    closeModal('vehicle-modal');
    this.showToast(id ? 'Véhicule modifié avec succès' : 'Véhicule ajouté avec succès', 'success');
  }

  editVehicle(id) {
    this.openVehicleModal(id);
  }

  async deleteVehicle(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce véhicule ? Cette action est irréversible.')) return;
    this.data.vehicles = this.data.vehicles.filter(v => v.id !== id);
    await this.saveData();
    this.renderAll();
    this.showToast('Véhicule supprimé', 'success');
  }

  // ============================================
  // RÉPARATIONS
  // ============================================
  renderRepairsTable() {
    const tbody = document.getElementById('repairs-table-body');
    if (!tbody) return;

    const search = document.getElementById('search-repairs')?.value.toLowerCase() || '';
    let repairs = [...this.data.repairs].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (search) {
      repairs = repairs.filter(r =>
        r.matricule.toLowerCase().includes(search) ||
        r.type.toLowerCase().includes(search) ||
        r.designation.toLowerCase().includes(search)
      );
    }

    if (repairs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--secondary);"><div style="font-size:40px;margin-bottom:8px;">🔧</div><strong>Aucune intervention</strong><br><span style="font-size:13px;">Ajoutez une intervention pour commencer</span></td></tr>`;
      return;
    }

    tbody.innerHTML = repairs.map(r => `
      <tr>
        <td>${r.date}</td>
        <td><strong>${r.matricule}</strong></td>
        <td>${r.chauffeur || '-'}</td>
        <td><span class="badge badge-info">${r.type}</span></td>
        <td>${r.designation}</td>
        <td>${r.km.toLocaleString()}</td>
        <td>${r.montant ? r.montant.toFixed(2) + ' TND' : '-'}</td>
        <td>
          <button class="action-btn delete" onclick="parcAuto.deleteRepair('${r.id}')">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  renderDashboardRepairs() {
    const tbody = document.getElementById('dashboard-repairs-body');
    if (!tbody) return;

    const recent = [...this.data.repairs]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    if (recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--secondary);"><p>Aucune intervention récente</p></td></tr>`;
      return;
    }

    tbody.innerHTML = recent.map(r => `
      <tr>
        <td>${r.date}</td>
        <td><strong>${r.matricule}</strong></td>
        <td><span class="badge badge-info">${r.type}</span></td>
        <td>${r.designation}</td>
        <td>${r.montant ? r.montant.toFixed(2) + ' TND' : '-'}</td>
      </tr>
    `).join('');
  }

  populateVehicleSelect() {
    const select = document.getElementById('repair-matricule');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Sélectionner un véhicule</option>' +
      this.data.vehicles.map(v => `<option value="${v.matricule}">${v.matricule} - ${v.modele}</option>`).join('');
    select.value = currentValue;
  }

  async saveRepair() {
    const matricule = document.getElementById('repair-matricule').value;
    if (!matricule) {
      this.showToast('Veuillez sélectionner un véhicule', 'error');
      return;
    }

    const vehicle = this.data.vehicles.find(v => v.matricule === matricule);

    const repair = {
      id: 'r' + Date.now(),
      matricule: matricule,
      chauffeur: document.getElementById('repair-chauffeur').value.trim() || (vehicle ? vehicle.chauffeur : ''),
      type: document.getElementById('repair-type').value,
      date: document.getElementById('repair-date').value,
      km: kmVal,
      montant: parseFloat(document.getElementById('repair-montant').value) || 0,
      designation: document.getElementById('repair-designation').value.trim(),
      nextVidange: parseInt(document.getElementById('repair-next-vidange').value) || null,
      nextChaine: parseInt(document.getElementById('repair-next-chaine').value) || null,
      nextVisite: document.getElementById('repair-next-visite').value || null
    };

    if (vehicle) {
      vehicle.km = repair.km;
      if (repair.nextVidange) vehicle.prochaineVidange = repair.nextVidange;
      if (repair.nextChaine) vehicle.prochaineChaine = repair.nextChaine;
      if (repair.nextVisite) vehicle.prochaineVisite = repair.nextVisite;
    }

    this.data.repairs.push(repair);
    await this.saveData();
    this.renderAll();

    document.getElementById('repair-form').reset();
    this.showToast('Intervention enregistrée et véhicule mis à jour', 'success');
    this.showTab('repairs');
  }

  async deleteRepair(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette intervention ?')) return;
    this.data.repairs = this.data.repairs.filter(r => r.id !== id);
    await this.saveData();
    this.renderAll();
    this.showToast('Intervention supprimée', 'success');
  }

  // ============================================
  // PARAMÈTRES
  // ============================================
  loadSettings() {
    const s = this.data.settings;
    const elVidange = document.getElementById('setting-alerte-vidange');
    const elChaine = document.getElementById('setting-alerte-chaine');
    const elVisite = document.getElementById('setting-alerte-visite');
    const elEntreprise = document.getElementById('setting-entreprise');

    if (elVidange) elVidange.value = s.alerteVidange;
    if (elChaine) elChaine.value = s.alerteChaine;
    if (elVisite) elVisite.value = s.alerteVisite;
    if (elEntreprise) elEntreprise.value = s.entreprise;
  }

  async saveSettings() {
    this.data.settings = {
      alerteVidange: parseInt(document.getElementById('setting-alerte-vidange').value) || 1000,
      alerteChaine: parseInt(document.getElementById('setting-alerte-chaine').value) || 1000,
      alerteVisite: parseInt(document.getElementById('setting-alerte-visite').value) || 7,
      entreprise: document.getElementById('setting-entreprise').value.trim() || 'Tunisie Telecom'
    };
    await this.saveData();
    this.renderAll();
    this.showToast('Paramètres sauvegardés', 'success');
  }

  // ============================================
  // INTERFACE UTILISATEUR (Vue Véhicule)
  // ============================================
  renderUserVehicleDetail() {
    const container = document.getElementById('user-vehicle-detail');
    if (!container) return;

    const matricule = this.data.userVehicle;
    if (!matricule) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🚗</div><h3>Aucun véhicule sélectionné</h3></div>`;
      return;
    }

    const vehicle = this.data.vehicles.find(v => v.matricule === matricule);
    if (!vehicle) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><h3>Véhicule non trouvé</h3></div>`;
      return;
    }

    const alerts = this.getAlerts().filter(a => a.vehicle.id === vehicle.id);
    const repairs = this.data.repairs.filter(r => r.matricule === matricule)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const vidangeProgress = vehicle.prochaineVidange ? Math.min(100, (vehicle.km / vehicle.prochaineVidange) * 100) : 0;
    const chaineProgress = vehicle.prochaineChaine ? Math.min(100, (vehicle.km / vehicle.prochaineChaine) * 100) : 0;

    const today = new Date();
    today.setHours(0,0,0,0);
    let visiteDaysLeft = null;
    if (vehicle.prochaineVisite) {
      const visiteDate = new Date(vehicle.prochaineVisite);
      visiteDate.setHours(0,0,0,0);
      visiteDaysLeft = Math.ceil((visiteDate - today) / (1000 * 60 * 60 * 24));
    }

    container.innerHTML = `
      <div class="vehicle-detail-card">
        <div class="vehicle-detail-header">
          <div class="vehicle-icon-big">🚗</div>
          <h2>${vehicle.matricule}</h2>
          <p>${vehicle.modele} — ${vehicle.chauffeur || 'Chauffeur non assigné'}</p>
        </div>

        <div class="vehicle-detail-body">
          ${alerts.length > 0 ? `
          <div style="background:#fee2e2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:24px;">
            <div style="font-weight:700;color:#991b1b;margin-bottom:8px;">🚨 Alertes actives</div>
            ${alerts.map(a => `
              <div style="font-size:13px;color:#7f1d1d;padding:4px 0;">
                • <strong>${a.type}</strong>: ${a.detail}
              </div>
            `).join('')}
          </div>
          ` : ''}

          <div class="detail-section">
            <div class="detail-section-title">📊 Informations générales</div>
            <div class="detail-grid">
              <div class="detail-item">
                <div class="detail-item-label">Kilométrage actuel</div>
                <div class="detail-item-value">${vehicle.km.toLocaleString()} km</div>
              </div>
              <div class="detail-item">
                <div class="detail-item-label">Prochaine vidange</div>
                <div class="detail-item-value ${vidangeProgress >= 90 ? 'alert' : vidangeProgress >= 70 ? 'warning' : 'ok'}">${vehicle.prochaineVidange ? vehicle.prochaineVidange.toLocaleString() + ' km' : 'Non défini'}</div>
                ${vehicle.prochaineVidange ? `
                <div class="km-progress">
                  <div class="km-progress-bar">
                    <div class="km-progress-fill ${vidangeProgress >= 90 ? 'danger' : vidangeProgress >= 70 ? 'warning' : 'ok'}" style="width:${vidangeProgress}%"></div>
                  </div>
                  <div class="km-progress-text">${(vehicle.prochaineVidange - vehicle.km).toLocaleString()} km restants</div>
                </div>
                ` : ''}
              </div>
              <div class="detail-item">
                <div class="detail-item-label">Prochain kit chaîne</div>
                <div class="detail-item-value ${chaineProgress >= 90 ? 'alert' : chaineProgress >= 70 ? 'warning' : 'ok'}">${vehicle.prochaineChaine ? vehicle.prochaineChaine.toLocaleString() + ' km' : 'Non défini'}</div>
                ${vehicle.prochaineChaine ? `
                <div class="km-progress">
                  <div class="km-progress-bar">
                    <div class="km-progress-fill ${chaineProgress >= 90 ? 'danger' : chaineProgress >= 70 ? 'warning' : 'ok'}" style="width:${chaineProgress}%"></div>
                  </div>
                  <div class="km-progress-text">${(vehicle.prochaineChaine - vehicle.km).toLocaleString()} km restants</div>
                </div>
                ` : ''}
              </div>
              <div class="detail-item">
                <div class="detail-item-label">Prochaine visite technique</div>
                <div class="detail-item-value ${visiteDaysLeft !== null && visiteDaysLeft <= 7 ? 'alert' : visiteDaysLeft !== null && visiteDaysLeft <= 30 ? 'warning' : 'ok'}">${vehicle.prochaineVisite || 'Non définie'}</div>
                ${visiteDaysLeft !== null ? `
                <div class="km-progress-text" style="text-align:left;margin-top:4px;">
                  ${visiteDaysLeft < 0 ? `<span style="color:var(--danger);">Dépassée de ${Math.abs(visiteDaysLeft)} jours</span>` : `${visiteDaysLeft} jours restants`}
                </div>
                ` : ''}
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">🔧 Historique des interventions</div>
            ${repairs.length === 0 ? '<p style="color:var(--secondary);font-size:14px;">Aucune intervention enregistrée</p>' : ''}
            ${repairs.map(r => `
              <div class="repair-list-item">
                <div class="repair-icon">🔧</div>
                <div class="repair-info">
                  <h4>${r.type}</h4>
                  <p>${r.designation}</p>
                </div>
                <div class="repair-meta">
                  <div class="date">${r.date}</div>
                  <div class="amount">${r.montant ? r.montant.toFixed(2) + ' TND' : '-'}</div>
                  <div style="font-size:11px;color:var(--secondary);margin-top:2px;">${r.km.toLocaleString()} km</div>
                </div>
              </div>
            `).join('')}
          </div>

          <div style="text-align:center;padding-top:16px;border-top:1px solid var(--border);margin-top:16px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
            <button onclick="exportVehiclePDF('${matricule}')"
              style="background:linear-gradient(135deg,#ef4444,#f97316);color:#fff;border:none;border-radius:10px;padding:11px 24px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;">
              📄 Télécharger rapport PDF
            </button>
            <p style="font-size:12px;color:var(--secondary);width:100%;margin-top:4px;">☁️ Données synchronisées avec le cloud • Mise à jour automatique</p>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================
  // LECTURE VOCALE DES ALERTES
  // ============================================
  speakAlerts(alerts) {
    if (!window.speechSynthesis || !alerts || alerts.length === 0) return;

    // Formater les chiffres pour la lecture vocale (comme les conseils)
    const formatNumber = (num) => {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    };

    const alertTexts = alerts.map((a, i) => {
      let detailText = a.detail;
      // Formater les nombres dans le détail
      detailText = detailText.replace(/[\d,]+/g, (match) => {
        const num = parseInt(match.replace(/,/g, ''));
        return formatNumber(num);
      });
      return `Alerte ${i + 1}: ${a.type}. ${detailText}.`;
    });

    const fullText = `Attention! Vous avez ${alerts.length} alerte${alerts.length > 1 ? 's' : ''} active${alerts.length > 1 ? 's' : ''}. ` + alertTexts.join(' ');

    const utter = new SpeechSynthesisUtterance(fullText);
    utter.lang  = 'fr-FR';
    utter.rate  = 0.80;
    utter.pitch = 0.85;  // Même voix que le message de bienvenue
    utter.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang === 'fr-FR' && v.name.toLowerCase().includes('male')) 
                 || voices.find(v => v.lang === 'fr-FR' && v.name.toLowerCase().includes('homme'))
                 || voices.find(v => v.lang === 'fr-FR')
                 || voices.find(v => v.lang.startsWith('fr'));
    if (frVoice) utter.voice = frVoice;

    window.speechSynthesis.speak(utter);
  }


  // ============================================
  // SYNCHRONISATION
  // ============================================
  async syncNow() {
    this.showSyncStatus('syncing');

    if (this.isCloudConfigured()) {
      const cloudData = await this.readFromCloud();
      if (cloudData && cloudData.vehicles) {
        this.data = cloudData;
        this.renderAll();

        const userInterface = document.getElementById('user-interface');
        if (userInterface && userInterface.style.display !== 'none') {
          this.renderUserVehicleDetail();
        }

        this.showToast('☁️ Données synchronisées depuis le cloud', 'success');
        return;
      }
    }

    this.saveData();
    this.renderAll();
    this.showToast('Données synchronisées localement', 'success');
  }

  showSyncStatus(status) {
    const els = document.querySelectorAll('#sync-status .sync-status, .sync-mini');
    els.forEach(el => {
      if (el.classList.contains('sync-status')) {
        el.className = 'sync-status ' + status;
        if (status === 'synced') el.innerHTML = '🔄 Synchronisé';
        if (status === 'syncing') el.innerHTML = '⏳ Synchronisation...';
        if (status === 'error') el.innerHTML = '❌ Erreur';
      }
    });
  }

  // ============================================
  // IMPORT / EXPORT
  // ============================================
  exportData() {
    const dataStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parc-auto-drt-sfax-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Données exportées avec succès', 'success');
  }

  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (imported.vehicles && imported.repairs) {
            this.data = imported;
            await this.saveData();
            this.renderAll();
            this.showToast('Données importées avec succès', 'success');
          } else {
            throw new Error('Format invalide');
          }
        } catch (err) {
          this.showToast('Erreur lors de l\'importation', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ============================================
  // UTILITAIRES
  // ============================================
  showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// ============================================
// FONCTIONS GLOBALES
// ============================================
let parcAuto;

document.addEventListener('DOMContentLoaded', () => {
  parcAuto = new ParcAutoApp();
});

function showLogin(type) {
  document.getElementById('home-page').style.display = 'none';
  if (type === 'admin') {
    document.getElementById('login-admin').style.display = 'flex';
  } else {
    document.getElementById('login-user').style.display = 'flex';
  }
}

function goHome() {
  document.getElementById('login-admin').style.display = 'none';
  document.getElementById('login-user').style.display = 'none';
  document.getElementById('user-interface').style.display = 'none';
  document.getElementById('home-page').style.display = 'flex';
}

function checkAdmin() {
  const data = JSON.parse(localStorage.getItem('parcAutoData_v3') || '{}');
  if (!data.currentUser || data.currentUser.role !== 'admin') {
    window.location.href = 'index.html';
    return false;
  }
  const adminName = document.getElementById('admin-name');
  if (adminName && data.currentUser.name) {
    adminName.textContent = data.currentUser.name;
  }
  return true;
}

function logout() {
  const data = JSON.parse(localStorage.getItem('parcAutoData_v3') || '{}');
  data.currentUser = null;
  data.userVehicle = null;
  localStorage.setItem('parcAutoData_v3', JSON.stringify(data));
  window.location.href = 'index.html';
}

function showTab(tabName) {
  if (parcAuto) parcAuto.showTab(tabName);
}

function openVehicleModal() {
  if (parcAuto) parcAuto.openVehicleModal();
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
}

function syncNow() {
  if (parcAuto) parcAuto.syncNow();
}

function exportData() {
  if (parcAuto) parcAuto.exportData();
}

function importData() {
  if (parcAuto) parcAuto.importData();
}

function filterAlerts(type) {
  if (parcAuto) {
    parcAuto.alertFilter = type;
    parcAuto.renderAlertsTable();
  }
}

// ============================================
// 1. NOTIFICATIONS PUSH (Service Worker)
// ============================================
async function registerPushNotifications() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    console.log('✅ Service Worker enregistré');
    scheduleDailyAlertCheck();
  } catch(e) { console.warn('SW error:', e); }
}

function scheduleDailyAlertCheck() {
  // Vérifier les alertes au démarrage
  checkAndNotifyAlerts();
  // Puis toutes les heures
  setInterval(checkAndNotifyAlerts, 3600000);
}

function checkAndNotifyAlerts() {
  try {
    const raw = localStorage.getItem('parcAutoData_v3');
    if (!raw) return;
    const data = JSON.parse(raw);
    const today = new Date(); today.setHours(0,0,0,0);
    const settings = data.settings || { alerteVidange: 1000, alerteChaine: 1000, alerteVisite: 7 };
    let urgentCount = 0;
    const messages = [];

    (data.vehicles || []).forEach(v => {
      if (v.prochaineVidange && v.km >= v.prochaineVidange - settings.alerteVidange) {
        const rest = v.prochaineVidange - v.km;
        urgentCount++;
        messages.push(`${v.matricule}: Vidange ${rest <= 0 ? 'DÉPASSÉE' : 'dans ' + rest + ' km'}`);
      }
      if (v.prochaineVisite) {
        const d = new Date(v.prochaineVisite); d.setHours(0,0,0,0);
        const days = Math.ceil((d - today) / 86400000);
        if (days <= settings.alerteVisite) {
          urgentCount++;
          messages.push(`${v.matricule}: Visite technique ${days < 0 ? 'DÉPASSÉE' : 'dans ' + days + ' j'}`);
        }
      }
    });

    if (urgentCount > 0 && Notification.permission === 'granted') {
      new Notification('🚨 Parc Auto DRT Sfax', {
        body: `${urgentCount} alerte(s) active(s)\n${messages.slice(0,3).join('\n')}`,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        tag: 'parc-alert'
      });
    }
  } catch(e) { console.warn('Notification error:', e); }
}

// ============================================
// 2. EXPORT PDF RAPPORT VÉHICULE
// ============================================
function exportVehiclePDF(matricule) {
  const raw = localStorage.getItem('parcAutoData_v3');
  if (!raw) return;
  const data = JSON.parse(raw);
  const vehicle = data.vehicles.find(v => v.matricule === matricule);
  if (!vehicle) return;

  const repairs = (data.repairs || [])
    .filter(r => r.matricule === matricule)
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  const totalCost = repairs.reduce((s,r) => s + (r.montant || 0), 0);
  const today = new Date().toLocaleDateString('fr-FR');

  const html = `<!DOCTYPE html><html lang="fr"><head>
  <meta charset="UTF-8">
  <title>Rapport — ${vehicle.matricule}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color:#1e293b; background:#fff; padding:40px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:3px solid #ef4444; }
    .logo-block h1 { font-size:22px; font-weight:700; color:#1e293b; }
    .logo-block p { font-size:11px; color:#64748b; letter-spacing:1px; text-transform:uppercase; margin-top:2px; }
    .date-block { text-align:right; font-size:12px; color:#64748b; }
    .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; }
    .badge-red { background:#fee2e2; color:#991b1b; }
    .section { margin-bottom:28px; }
    .section-title { font-size:13px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid #e2e8f0; }
    .info-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
    .info-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; }
    .info-box label { font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; }
    .info-box span { display:block; font-size:16px; font-weight:700; color:#1e293b; margin-top:4px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th { background:#f1f5f9; color:#475569; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; padding:10px 12px; text-align:left; border-bottom:2px solid #e2e8f0; }
    td { padding:10px 12px; border-bottom:1px solid #f1f5f9; color:#1e293b; }
    tr:nth-child(even) td { background:#fafafa; }
    .total-row td { font-weight:700; background:#fef2f2; color:#991b1b; border-top:2px solid #fecaca; }
    .footer { margin-top:40px; padding-top:20px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; font-size:11px; color:#94a3b8; }
    .gradient-bar { height:4px; background:linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#a855f7); border-radius:2px; margin-bottom:32px; }
  </style></head><body>
  <div class="gradient-bar"></div>
  <div class="header">
    <div class="logo-block">
      <h1>🚗 Parc Auto DRT Sfax</h1>
      <p>Direction Régionale de Sfax — Tunisie Telecom</p>
    </div>
    <div class="date-block">
      <strong>RAPPORT D'ENTRETIEN</strong><br>
      Généré le ${today}<br>
      <span class="badge badge-red" style="margin-top:6px;">${vehicle.matricule}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Informations du véhicule</div>
    <div class="info-grid">
      <div class="info-box"><label>Matricule</label><span>${vehicle.matricule}</span></div>
      <div class="info-box"><label>Modèle</label><span>${vehicle.modele}</span></div>
      <div class="info-box"><label>Chauffeur</label><span>${vehicle.chauffeur || '—'}</span></div>
      <div class="info-box"><label>Kilométrage</label><span>${vehicle.km.toLocaleString()} km</span></div>
      <div class="info-box"><label>Prochaine vidange</label><span>${vehicle.prochaineVidange ? vehicle.prochaineVidange.toLocaleString() + ' km' : '—'}</span></div>
      <div class="info-box"><label>Visite technique</label><span>${vehicle.prochaineVisite || '—'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Historique des interventions (${repairs.length})</div>
    ${repairs.length === 0 ? '<p style="color:#94a3b8;font-size:13px;">Aucune intervention enregistrée.</p>' : `
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Désignation</th><th>Km</th><th>Montant</th></tr></thead>
      <tbody>
        ${repairs.map(r => `<tr>
          <td>${r.date}</td>
          <td><strong>${r.type}</strong></td>
          <td>${r.designation}</td>
          <td>${r.km.toLocaleString()} km</td>
          <td>${r.montant ? r.montant.toFixed(2) + ' TND' : '—'}</td>
        </tr>`).join('')}
        <tr class="total-row">
          <td colspan="4" style="text-align:right;">TOTAL COÛTS</td>
          <td>${totalCost.toFixed(2)} TND</td>
        </tr>
      </tbody>
    </table>`}
  </div>

  <div class="footer">
    <span>Parc Auto DRT Sfax — Tunisie Telecom</span>
    <span>Créé par Hamdi Ben Aouicha — Chef de Parc DRT Sfax</span>
    <span>Document généré le ${today}</span>
  </div>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

// ============================================
// 3. DOUBLE AUTHENTIFICATION OTP (Admin)
// ============================================
const OTP_CONFIG = {
  code: null,
  expiry: null,
  attempts: 0,
  maxAttempts: 3
};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function simulateSendOTP(email, otp) {
  // En production: appel API SMS/Email
  // Pour démo: afficher dans console + alerte discrète
  console.log(`📱 OTP pour ${email}: ${otp}`);
  // Stocker temporairement pour la démo
  sessionStorage.setItem('_demo_otp', otp);
}

function requestOTP(email) {
  const otp = generateOTP();
  OTP_CONFIG.code = otp;
  OTP_CONFIG.expiry = Date.now() + 5 * 60 * 1000; // 5 min
  OTP_CONFIG.attempts = 0;
  simulateSendOTP(email, otp);
  return otp;
}

function verifyOTP(inputCode) {
  if (!OTP_CONFIG.code || !OTP_CONFIG.expiry) return { ok: false, msg: 'Aucun code généré' };
  if (Date.now() > OTP_CONFIG.expiry) return { ok: false, msg: 'Code expiré. Recommencez.' };
  OTP_CONFIG.attempts++;
  if (OTP_CONFIG.attempts > OTP_CONFIG.maxAttempts) return { ok: false, msg: 'Trop de tentatives.' };
  if (inputCode.trim() === OTP_CONFIG.code) {
    OTP_CONFIG.code = null;
    return { ok: true };
  }
  return { ok: false, msg: `Code incorrect. ${OTP_CONFIG.maxAttempts - OTP_CONFIG.attempts} essai(s) restant(s).` };
}

