# Audit de l'application Parc Auto DRT Sfax — 04/11/2026

Méthode : lecture statique du dépôt `drt2026/parc-auto-drt` (clone anonyme), vérification de syntaxe de tous les `.js`, recherche de motifs (secrets, innerHTML, données), tests jsdom des nouveaux modules.
**Non fait** : exécution dans un vrai navigateur/téléphone, test du Worker en production (volontairement, pour ne pas toucher aux données réelles).
Les valeurs secrètes ne sont volontairement pas reproduites ici.

---

## 🔴 CRITIQUE — sécurité et données personnelles

### 1. Le dépôt est lisible sans identifiants et contient des secrets
Le clone anonyme du dépôt a fonctionné (je n'ai pas pu confirmer la visibilité via l'API GitHub, limite de débit atteinte). Ce qu'il contient :

| Élément | Où |
|---|---|
| Clé d'application `APP_KEY` (en-tête `X-App-Key`) | `app.js` ~L57 |
| Mot de passe admin par défaut, en clair | `app.js` ~L1385 (vérifié côté client L1837) |
| Mots de passe par défaut des comptes « travaux » (ex. `KM-2026`) | `demande_travaux_v2.js` L16, L45… |
| **159 numéros de CIN** du personnel + noms de chauffeurs | `demande_travaux_v2.js` |

### 2. Le Worker Cloudflare ne protège pas réellement les données
D'après `worker.js` L85-95 : la seule barrière est `X-App-Key`, une clé publique. Le contrôle d'origine n'est appliqué que **si l'en-tête `Origin` est présent** : un appel hors navigateur (curl, script) n'en envoie pas, et peut de toute façon le falsifier. Conséquence probable : toute personne qui lit le code peut lire et écraser le Gist de données. (Déduit du code, non testé.)

### 3. Connexion admin 100 % côté navigateur
Aucune vérification serveur : contourner l'écran de login ne demande qu'un peu de JavaScript.

### Actions recommandées (dans cet ordre)
1. **Changer** la clé `APP_KEY` (secret du Worker + `app.js`) et **tous** les mots de passe par défaut. L'historique Git garde les anciennes valeurs : changer est obligatoire même si on supprime les fichiers.
2. **Rendre le dépôt privé.** GitHub Pages sur dépôt privé demande un plan payant ; alternative gratuite : Cloudflare Pages (déjà ton écosystème Worker).
3. **Retirer les CIN du code** : les stocker dans les données du Gist (derrière authentification), puis purger l'historique (`git filter-repo` ou BFG).
4. **Authentification serveur** : le Worker vérifie identifiant/mot de passe (hash) et renvoie un jeton signé à durée limitée ; toutes les routes exigent ce jeton. Je peux l'implémenter sur demande, c'est le seul vrai correctif du point 2.

---

## 🟠 ÉLEVÉ — risque de perte ou de corruption de données

### 4. Fichier Gist > 1 Mo : lecture tronquée — ✅ corrigé (`worker.js`, à redéployer)
L'API GitHub coupe le contenu des fichiers > 1 Mo. Le Worker lisait `file.content` sans vérifier `truncated`. Les photos de sinistres (JPEG en base64 dans `pa.data`) font grossir la base ; passé 1 Mo, l'application aurait reçu un JSON invalide. Correctif : lecture via `raw_url` quand `truncated` est vrai.

### 5. Photos en base64 dans la base unique
Toute la base est écrite dans `localStorage` (limite ~5 Mo) ; en cas de dépassement, `saveData()` fait seulement un `console.warn` (`app.js` ~L1612) : **échec silencieux**. ✅ Atténuation ajoutée : `sante_donnees.js` affiche un bandeau dès 0,7 Mo avec les 3 plus grosses rubriques. Correctif de fond à prévoir : sortir les photos du JSON (fichiers séparés ou stockage objet).

### 6. Historique des dépenses non synchronisé — ✅ corrigé (`repair_analyse.js`)
`parcAutoRepairHist_v1` n'existait que dans `localStorage` : cache vidé ou autre appareil = historique perdu. Il est maintenant copié dans `pa.data.repairHistData` après chaque import/effacement, et restauré si le stockage local est vide.

### 7. Injection HTML (XSS) via données importées
~200 usages de `innerHTML` (`demande_travaux_v2.js` 59, `app.js` 29, `admin.html` 23, `repair_rapport.js` 15, `steg_suivi.js` 14, `stock_pneus.js` 13…). Une cellule Excel contenant du HTML s'exécuterait. ✅ Corrigé dans `repair_rapport.js` (4 emplacements) et dans le nouveau module. **Reste à faire** dans les autres fichiers.

---

## 🟡 MOYEN — performance et maintenance

8. **`index.html` pèse 1,6 Mo, dont 1,48 Mo d'images base64** (5 blocs) ; `demande_travaux_v2.js` 452 Ko avec un modèle Excel en base64. Chargement lent en 3G/4G. → extraire en fichiers `.png`/`.xlsx` mis en cache par le service worker.
9. **KPI « Moyenne / véhicule » sous-estimée** (`repair_rapport.js`, `renderRepairHistKPI`) : le dénominateur inclut les véhicules à 0 DT. Non modifié (cela change des chiffres déjà affichés) ; le nouveau module affiche la moyenne par véhicule *actif*.
10. **`showTab` redéfini dans 4 fichiers** (`bl_recap`, `bl_scanner_reparations`, `parc_drt_2026`, `repair_rapport`) et `window.onload` dans 2 (`bl_recap`, `demande_travaux_v2`). Fonctionne si chaque fichier chaîne l'ancienne version, mais fragile : **à vérifier**, je n'ai pas contrôlé chaque cas.
11. `sw.js` ne pré-cache que 8 fichiers : hors-ligne partiel tant que les autres modules n'ont pas été visités une fois en ligne.
12. **Non audité** : limitation du nombre de tentatives sur `/verify-otp`, code de `stock_pneus.js`, `steg_suivi.js`, `groupe_electrogene.js`.

---

## Livré avec cet audit
| Fichier | Changement |
|---|---|
| `repair_analyse.js` (nouveau) | analyse véhicule/division/CSC, constats auto, export Excel + PowerPoint, copie cloud de l'historique |
| `sante_donnees.js` (nouveau) | bandeau d'alerte sur le volume de données |
| `worker.js` | lecture des Gist > 1 Mo (à redéployer dans Cloudflare) |
| `repair_rapport.js` | échappement HTML (4 endroits) |
| `admin.html` | conteneur + 2 balises `<script>` |
