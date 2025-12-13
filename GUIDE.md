# Guide d'installation et d'utilisation - TGD Time Tracker

## Installation

### Prérequis

- Node.js 18+ installé
- npm ou yarn
- Windows 10/11 (pour l'application finale)

### Étapes d'installation

1. **Installer les dépendances**

```bash
npm install
```

2. **Configuration des APIs**

Vous aurez besoin de :
- URL de votre instance Jira (ex: https://votre-domaine.atlassian.net)
- Email de votre compte Jira
- Token API Jira (obtenir sur https://id.atlassian.com/manage-profile/security/api-tokens)
- Token API Tempo (obtenir dans Tempo Settings → API Integration)
- Account ID Tempo (trouvable dans votre profil)

## Développement

### Lancer en mode développement

```bash
npm run dev
```

Cette commande lance deux processus :
- Le main process Electron (backend)
- Le renderer process avec Vite (frontend)

### Build de production

```bash
npm run build
```

### Créer l'installateur Windows

```bash
npm run package:win
```

L'installateur sera créé dans le dossier `release/`.

## Utilisation

### Première utilisation

1. **Configuration initiale**
   - Au premier lancement, l'application vous demande de configurer les connexions Jira et Tempo
   - Entrez vos informations d'API
   - L'application testera automatiquement la connexion

2. **Sélectionner une tâche**
   - Cliquez sur "Tâches" dans la navigation
   - Choisissez une tâche récente ou recherchez par clé (TGD-1234) ou mots-clés
   - Le chronomètre démarre automatiquement

3. **Suivi du temps**
   - Le chronomètre s'affiche avec le temps écoulé
   - Vous recevez une notification toutes les 60 minutes pour confirmer que vous travaillez toujours sur la tâche
   - Vous pouvez changer de tâche ou arrêter le chronomètre à tout moment

4. **Feuilles de temps**
   - Consultez vos feuilles de temps dans l'onglet "Feuilles de temps"
   - Les journées dépassant 7h30 sont automatiquement ajustées au prorata
   - Envoyez vos temps validés vers Tempo en un clic

### System Tray

L'application reste active dans la barre des tâches Windows. Vous pouvez :
- Cliquer sur l'icône pour ouvrir l'application
- Clic droit pour voir le menu contextuel avec :
  - État du chronomètre
  - Option pour ouvrir l'application
  - Quitter l'application

### Notifications

L'application utilise les notifications natives Windows :
- **Confirmation horaire** : Toutes les 60 minutes si un chronomètre est actif
  - Répondez "Oui, continuer" pour garder le chronomètre actif
  - Répondez "Non, arrêter" pour arrêter le chronomètre
  - Pas de réponse après 60 secondes = arrêt automatique

## Architecture technique

### Stack technologique

- **Electron** : Framework pour application desktop
- **TypeScript** : Langage principal
- **React** : Interface utilisateur
- **SQLite** : Base de données locale
- **Vite** : Build tool pour le renderer
- **better-sqlite3** : Driver SQLite synchrone
- **axios** : Client HTTP pour les APIs

### Structure du projet

```
TimeTracker/
├── src/
│   ├── main/              # Electron main process
│   │   ├── database/      # SQLite schema et queries
│   │   ├── services/      # Services (Jira, Tempo, Timer, Adjustment)
│   │   ├── main.ts        # Point d'entrée principal
│   │   └── preload.ts     # API bridge sécurisé
│   └── renderer/          # React frontend
│       ├── components/    # Composants React
│       ├── types/         # Définitions TypeScript
│       ├── App.tsx        # Application principale
│       └── index.tsx      # Point d'entrée renderer
├── dist/                  # Fichiers compilés
├── release/               # Installateurs
└── package.json
```

### Base de données locale

L'application utilise SQLite pour stocker :
- **Configuration** : Paramètres de l'application
- **WorkSession** : Sessions de travail avec durées
- **DailySummary** : Résumés par jour
- **RecentIssue** : Cache des tâches récentes

La base de données est stockée dans : `%APPDATA%/tgd-time-tracker/timetracker.db`

## Dépannage

### L'application ne se connecte pas à Jira

- Vérifiez que votre token API est valide
- Assurez-vous que l'URL de base Jira est correcte (incluant https://)
- Vérifiez votre connexion internet

### Les notifications ne s'affichent pas

- Vérifiez que les notifications Windows sont activées pour l'application
- Allez dans Paramètres Windows → Système → Notifications

### Le chronomètre s'arrête automatiquement

- Assurez-vous de répondre aux notifications de confirmation dans les 60 secondes
- Vérifiez que l'application n'est pas en mode veille

### Les temps ne s'envoient pas vers Tempo

- Vérifiez votre token API Tempo
- Assurez-vous d'avoir les droits d'écriture sur Tempo
- Vérifiez que l'Account ID est correct

## Support

Pour toute question ou problème :
1. Consultez le cahier des charges (README.md)
2. Vérifiez les logs de l'application (Console Developer Tools)
3. Contactez l'équipe de développement

## Licence

MIT License - Projet interne TGD @ Additi
