/* ============================================
   PARC AUTO DRT SFAX - LOGIQUE JAVASCRIPT
   AVEC SYNCHRONISATION CLOUD JSONBIN.IO
   ============================================ */

// ============================================
// CONFIGURATION JSONBIN.IO
// ============================================
// REMPLACE CES VALEURS APRÈS AVOIR CRÉÉ TON COMPTE JSONBIN.IO
const JSONBIN_CONFIG = {
  // Ton API Key (Master Key) de jsonbin.io
  API_KEY: '$2a$10$F1db60DDgpDtxyVMJJlPg.twFuf0nscnFDLXJtunPSitrBZAJoq9y',
  // L'ID de ton Bin (fichier JSON cloud)
  BIN_ID: 'TON_BIN_ID_ICI',
  // URL de base de l'API
  BASE_URL: 'https://api.jsonbin.io/v3/b'
};

// ============================================
// DONNÉES PAR DÉFAUT
// ============================================
const DEFAULT_DATA = {
  vehicles: [
    {
      id: 'v1',
      matricule: '123 TU 4567',
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
      matricule: '456 TU 7890',
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
      matricule: '789 TU 1234',
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
      matricule: '321 TU 5678',
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
      matricule: '654 TU 9012',
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
      matricule: '123 TU 4567',
      chauffeur: 'Ahmed Ben Ali',
      type: 'Vidange',
      designation: 'Vidange complète + filtre à huile',
      date: '2026-04-15',
      km: 45000,
      montant: 185.50,
      nextVidange: 50000,
      nextChaine: 55000,
      nextVisite: '2026-08-15'
    },
    {
      id: 'r2',
      matricule: '456 TU 7890',
      chauffeur: 'Mohamed Trabelsi',
      type: 'Réparation',
      designation: 'Remplacement plaquettes de frein avant',
      date: '2026-05-10',
      km: 67500,
      montant: 320.00,
      nextVidange: 70000,
      nextChaine: 75000,
      nextVisite: '2026-07-20'
    },
    {
      id: 'r3',
      matricule: '321 TU 5678',
      chauffeur: 'Sami Jebali',
      type: 'Visite Technique',
      designation: 'Contrôle technique annuel',
      date: '2026-05-20',
      km: 89000,
      montant: 45.00,
      nextVidange: 90000,
      nextChaine: 95000,
      nextVisite: '2027-05-20'
    },
    {
      id: 'r4',
      matricule: '123 TU 4567',
      chauffeur: 'Ahmed Ben Ali',
      type: 'Pneumatique',
      designation: 'Remplacement 4 pneus Michelin',
      date: '2026-03-10',
      km: 44000,
      montant: 680.00,
      nextVidange: 50000,
      nextChaine: 55000,
      nextVisite: '2026-08-15'
    }
  ],
  settings: {
    alerteVidange: 1000,
    alerteChaine: 1000,
    alerteVisite: 7,
    entreprise: 'DRT Sfax'
  },
  currentUser: null,
  userVehicle: null
};

// ============================================
// UTILISATEURS ADMIN
// ============================================
const ADMIN_USERS = [
  { email: 'admin@drt.tn', password: 'admin123', role: 'admin', name: 'Administrateur' }
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

  // Vérifier si la config JSONBin est valide
  isCloudConfigured() {
    return JSONBIN_CONFIG.API_KEY !== '$2a$10$VOTRE_CLE_API_ICI' && 
           JSONBIN_CONFIG.BIN_ID !== 'VOTRE_BIN_ID_ICI';
  }

  // Lire les données depuis JSONBin.io
  async readFromCloud() {
    if (!this.isCloudConfigured()) return null;

    try {
      const response = await fetch(`${JSONBIN_CONFIG.BASE_URL}/${JSONBIN_CONFIG.BIN_ID}/latest`, {
        method: 'GET',
        headers: {
          'X-Master-Key': JSONBIN_CONFIG.API_KEY,
          'X-Bin-Meta': 'false'
        }
      });

      if (!response.ok) {
        console.warn('Erreur lecture cloud:', response.status);
        return null;
      }

      const result = await response.json();
      return result.record || result;
    } catch (e) {
      console.warn('Erreur connexion cloud:', e);
      return null;
    }
  }

  // Écrire les données sur JSONBin.io
  async writeToCloud() {
    if (!this.isCloudConfigured()) return false;

    try {
      const response = await fetch(`${JSONBIN_CONFIG.BASE_URL}/${JSONBIN_CONFIG.BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': JSONBIN_CONFIG.API_KEY
        },
        body: JSON.stringify(this.data)
      });

      if (!response.ok) {
        console.warn('Erreur écriture cloud:', response.status);
        return false;
      }

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
      }
    }

    // Fallback sur localStorage
    try {
      const saved = localStorage.getItem('parcAutoData');
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
      localStorage.setItem('parcAutoData', JSON.stringify(this.data));
    } catch (e) {
      console.warn('Erreur sauvegarde localStorage:', e);
    }

    // Sauvegarder sur le cloud (si configuré)
    if (this.isCloudConfigured()) {
      const success = await this.writeToCloud();
      if (success) {
        this.showSyncStatus('synced');
        this.showToast('☁️ Données sauvegardées sur le cloud', 'success');
      } else {
        this.showSyncStatus('error');
        this.showToast('❌ Erreur sauvegarde cloud', 'error');
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

    // Synchronisation périodique pour les utilisateurs
    if (this.data.currentUser && this.data.currentUser.role === 'user') {
      this.startAutoSync();
    }
  }

  // Synchronisation automatique toutes les 30 secondes pour les utilisateurs
  startAutoSync() {
    if (!this.isCloudConfigured()) return;

    setInterval(async () => {
      const cloudData = await this.readFromCloud();
      if (cloudData && JSON.stringify(cloudData) !== JSON.stringify(this.data)) {
        this.data = cloudData;
        this.renderUserVehicleDetail();
        this.showToast('🔄 Données mises à jour depuis le cloud', 'success');
      }
    }, 30000); // Toutes les 30 secondes
  }

  // ============================================
  // PAGE D'ACCUEIL
  // ============================================
  initHomePage() {
    // Les boutons sont gérés par onclick dans le HTML
  }

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
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 500);
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

      // Recharger les données depuis le cloud pour avoir les dernières
      if (this.isCloudConfigured()) {
        const cloudData = await this.readFromCloud();
        if (cloudData && cloudData.vehicles) {
          this.data = cloudData;
        }
      }

      const vehicle = this.data.vehicles.find(v => 
        v.matricule.toUpperCase().replace(/\s+/g, ' ').trim() === 
        matriculeInput.replace(/\s+/g, ' ').trim()
      );

      if (vehicle) {
        this.data.currentUser = { role: 'user', name: vehicle.chauffeur || 'Utilisateur' };
        this.data.userVehicle = vehicle.matricule;
        await this.saveData();
        this.showToast('Véhicule trouvé ! Redirection...', 'success');

        setTimeout(() => {
          document.getElementById('login-user').style.display = 'none';
          document.getElementById('user-interface').style.display = 'block';
          this.renderUserVehicleDetail();
          this.startAutoSync();
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
    const vehicle = {
      id: id || 'v' + Date.now(),
      matricule: document.getElementById('vehicle-matricule').value.trim().toUpperCase(),
      modele: document.getElementById('vehicle-modele').value.trim(),
      chauffeur: document.getElementById('vehicle-chauffeur').value.trim(),
      km: parseInt(document.getElementById('vehicle-km').value) || 0,
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
      km: parseInt(document.getElementById('repair-km').value) || 0,
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
      entreprise: document.getElementById('setting-entreprise').value.trim() || 'DRT Sfax'
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

          <div style="text-align:center;padding-top:16px;border-top:1px solid var(--border);margin-top:16px;">
            <p style="font-size:12px;color:var(--secondary);">☁️ Données synchronisées avec le cloud • Mise à jour automatique</p>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================
  // SYNCHRONISATION
  // ============================================
  async syncNow() {
    this.showSyncStatus('syncing');

    // Recharger depuis le cloud
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

    // Fallback local
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
    a.download = `parc-auto-backup-${new Date().toISOString().split('T')[0]}.json`;
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
  const data = JSON.parse(localStorage.getItem('parcAutoData') || '{}');
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
  const data = JSON.parse(localStorage.getItem('parcAutoData') || '{}');
  data.currentUser = null;
  data.userVehicle = null;
  localStorage.setItem('parcAutoData', JSON.stringify(data));
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
