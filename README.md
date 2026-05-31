# 🚗 Parc Auto DRT Sfax

Système professionnel de gestion du parc automobile de la DRT Sfax. Application web complète avec deux interfaces distinctes : **Administrateur** et **Utilisateur**.

---

## ✨ Fonctionnalités

### 🔐 Double Interface

#### Espace Administrateur
- **Authentification** par email + mot de passe
- Gestion complète du parc (CRUD véhicules)
- Enregistrement des interventions avec mise à jour auto des seuils
- Alertes configurables (vidange, chaîne, visite technique)
- Tableau de bord avec statistiques en temps réel
- Export / Import des données (JSON)

#### Espace Utilisateur
- **Accès simplifié** : saisie du matricule uniquement (pas de mot de passe)
- Vue détaillée de **son véhicule uniquement**
- Barres de progression visuelles pour les échéances
- Historique des interventions
- Alertes personnalisées pour son véhicule
- **Synchronisation automatique** avec les données admin

### 🚨 Alertes Intelligentes
- **Vidange** : alerte configurable en km avant échéance
- **Kit chaîne** : alerte configurable en km avant échéance
- **Visite technique** : alerte configurable en jours avant échéance
- Priorisation automatique : Avertissement → Urgent
- Barres de progression visuelles (vert/orange/rouge)

### 💾 Persistance & Synchronisation
- Stockage local (`localStorage`) — aucun serveur requis
- Les modifications admin sont **instantanément visibles** par les utilisateurs
- Export de sauvegarde JSON
- Import de données existantes

---

## 🚀 Déploiement sur GitHub Pages

### 1. Prérequis
Assurez-vous d'avoir ces 4 fichiers à la racine du dépôt :
```
parc-auto-drt/
├── index.html      # Page d'accueil + Login Admin/User
├── admin.html      # Interface d'administration
├── styles.css      # Styles professionnels
└── app.js          # Logique JavaScript complète
```

### 2. Pousser sur GitHub
```bash
git add index.html admin.html styles.css app.js
git commit -m "Mise à jour - Système Parc Auto DRT"
git push origin main
```

### 3. Activer GitHub Pages
1. Allez sur **Settings** → **Pages**
2. Source : **Deploy from a branch**
3. Branch : **main** / **root**
4. Cliquez sur **Save**
5. Attendez 1-2 minutes

---

## 🔑 Accès

### Administrateur
| Email | Mot de passe |
|-------|-------------|
| `admin@drt.tn` | `admin123` |

### Utilisateur (Matricule)
Saisissez simplement le matricule de votre véhicule :

| Matricule | Modèle | Chauffeur |
|-----------|--------|-----------|
| `123 TU 4567` | Peugeot 301 | Ahmed Ben Ali |
| `456 TU 7890` | Renault Symbol | Mohamed Trabelsi |
| `789 TU 1234` | Hyundai Accent | Karim Gharbi |
| `321 TU 5678` | Volkswagen Polo | Sami Jebali |
| `654 TU 9012` | Fiat Tipo | Nabil Mejri |

---

## 📱 Captures d'écran

### Page d'accueil
Écran de choix entre Espace Admin et Espace Utilisateur avec le logo DRT.

### Interface Admin
- Sidebar de navigation professionnelle
- Tableau de bord avec statistiques
- Gestion des véhicules en tableau
- Formulaire d'intervention avec mise à jour auto des seuils
- Paramètres d'alertes configurables

### Interface Utilisateur
- Vue détaillée du véhicule avec barres de progression
- Alertes visuelles (vert/orange/rouge)
- Historique des interventions chronologique
- Synchronisation en temps réel

---

## 🛠️ Technologies

- **HTML5** — Structure sémantique
- **CSS3** — Design responsive, variables CSS, animations
- **JavaScript vanilla** — Aucune dépendance externe
- **localStorage** — Persistance des données

---

## 📊 Données par défaut

5 véhicules pré-configurés avec alertes de démonstration pour tester immédiatement l'application.

---

## ⚠️ Notes

- Les données sont stockées dans le **localStorage du navigateur**
- Chaque appareil a ses propres données (pas de synchronisation entre appareils sans export/import)
- **Exportez régulièrement** vos données via Paramètres → Exporter
- L'application fonctionne **100% hors ligne** après le premier chargement

---

## 📧 Contact

**DRT Sfax** — Direction Régionale de Transport

---

*Développé pour la gestion professionnelle du parc automobile DRT Sfax*
