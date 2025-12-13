# Guide de développement - TGD Time Tracker

## Architecture de l'application

### Vue d'ensemble

L'application est construite avec Electron, qui permet de créer des applications desktop cross-platform avec des technologies web (HTML, CSS, JavaScript/TypeScript).

```
┌─────────────────────────────────────────────────────┐
│                   Electron App                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────┐    ┌──────────────────┐    │
│  │   Main Process    │◄──►│ Renderer Process │    │
│  │   (Node.js)       │    │   (React + UI)   │    │
│  │                   │    │                  │    │
│  │ - Database        │    │ - Components     │    │
│  │ - Services        │    │ - Views          │    │
│  │ - Timer           │    │ - Styles         │    │
│  │ - System Tray     │    │                  │    │
│  └───────────────────┘    └──────────────────┘    │
│         ▲                                          │
│         │                                          │
│         ▼                                          │
│  ┌───────────────────┐                            │
│  │  External APIs    │                            │
│  │  - Jira REST      │                            │
│  │  - Tempo API      │                            │
│  └───────────────────┘                            │
└─────────────────────────────────────────────────────┘
```

### Processus Electron

#### Main Process (Backend)

Le main process est responsable de :
- Gestion des fenêtres et du system tray
- Accès à la base de données SQLite
- Appels aux APIs externes (Jira, Tempo)
- Gestion du timer et des notifications
- Logique métier (ajustement des temps)

**Fichiers principaux :**
- `src/main/main.ts` : Point d'entrée, gestion des fenêtres
- `src/main/database/schema.ts` : Schéma et accès base de données
- `src/main/services/` : Services métier

#### Renderer Process (Frontend)

Le renderer process gère l'interface utilisateur :
- Affichage des composants React
- Interaction utilisateur
- Communication avec le main process via IPC

**Fichiers principaux :**
- `src/renderer/App.tsx` : Application principale
- `src/renderer/components/` : Composants UI
- `src/renderer/types/` : Définitions TypeScript

#### Preload Script

Le preload script (`src/main/preload.ts`) expose de manière sécurisée l'API du main process au renderer via `contextBridge`.

## Services

### DatabaseManager

Gère toutes les opérations sur la base de données SQLite.

**Tables :**
- `Configuration` : Paramètres application
- `WorkSession` : Sessions de travail
- `DailySummary` : Résumés journaliers
- `RecentIssue` : Cache des tâches récentes

**Méthodes principales :**
```typescript
getConfig(key: string): string | null
setConfig(key: string, value: string): void
createWorkSession(session): number
updateWorkSession(id, updates): void
getWorkSessionsByDate(date): WorkSession[]
```

### JiraService

Interface avec l'API REST Jira v3.

**Méthodes principales :**
```typescript
getCurrentUser(): Promise<User>
searchIssues(jql: string): Promise<JiraSearchResponse>
getIssue(issueKey: string): Promise<JiraIssue>
getRecentIssues(projectKey: string): Promise<JiraIssue[]>
```

### TempoService

Interface avec l'API Tempo Timesheets v4.

**Méthodes principales :**
```typescript
createWorklog(worklog: TempoWorklog): Promise<TempoWorklogResponse>
updateWorklog(id, worklog): Promise<TempoWorklogResponse>
getWorklogs(startDate, endDate): Promise<TempoWorklogResponse[]>
```

### TimerService

Gère le chronomètre et les événements associés.

**Événements émis :**
- `started` : Chronomètre démarré
- `stopped` : Chronomètre arrêté
- `tick` : Chaque seconde
- `notification-required` : Notification à afficher

**Méthodes principales :**
```typescript
startTimer(issueKey, issueTitle, issueType): number
stopTimer(): void
getState(): TimerState
```

### AdjustmentService

Calcule et applique les ajustements de temps pour respecter la limite de 7h30/jour.

**Méthodes principales :**
```typescript
analyzePendingDays(): DailyAdjustment[]
adjustDaySessions(date, sessions, totalMinutes): DailyAdjustment
applyAdjustments(adjustments): void
```

## Communication IPC

### De Renderer vers Main

Utilisation de `ipcRenderer.invoke()` pour les appels asynchrones :

```typescript
// Dans le renderer
const result = await window.electronAPI.timer.start(issueKey, issueTitle, issueType);

// Dans le main
ipcMain.handle('timer:start', async (_, issueKey, issueTitle, issueType) => {
  const sessionId = this.timerService.startTimer(issueKey, issueTitle, issueType);
  return { sessionId };
});
```

### De Main vers Renderer

Utilisation de `webContents.send()` pour les événements :

```typescript
// Dans le main
this.mainWindow?.webContents.send('timer:started', data);

// Dans le renderer (via preload)
ipcRenderer.on('timer:started', (_, data) => callback(data));
```

## Composants React

### App.tsx

Composant racine qui gère la navigation entre les vues.

**États :**
- `currentView` : Vue active
- `isConfigured` : Configuration complète
- `timerState` : État du chronomètre

### ConfigurationView

Formulaire de configuration des APIs Jira et Tempo.

### TimerView

Affichage du chronomètre en cours avec les contrôles.

### TaskSelector

Recherche et sélection de tâches Jira.

### TimesheetView

Gestion des feuilles de temps et envoi vers Tempo.

## Base de données SQLite

### Schéma

```sql
CREATE TABLE Configuration (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE WorkSession (
  id INTEGER PRIMARY KEY,
  issue_key TEXT NOT NULL,
  issue_title TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration_seconds INTEGER DEFAULT 0,
  comment TEXT,
  status TEXT DEFAULT 'draft',
  tempo_worklog_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE DailySummary (
  id INTEGER PRIMARY KEY,
  date TEXT UNIQUE NOT NULL,
  total_minutes INTEGER NOT NULL,
  adjusted_minutes INTEGER,
  status TEXT DEFAULT 'pending',
  sent_at TEXT
);

CREATE TABLE RecentIssue (
  id INTEGER PRIMARY KEY,
  issue_key TEXT UNIQUE NOT NULL,
  issue_title TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  epic_key TEXT,
  last_used_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Emplacement

- **Windows** : `%APPDATA%/tgd-time-tracker/timetracker.db`
- **macOS** : `~/Library/Application Support/tgd-time-tracker/timetracker.db`
- **Linux** : `~/.config/tgd-time-tracker/timetracker.db`

## APIs externes

### Jira REST API v3

Documentation : https://developer.atlassian.com/cloud/jira/platform/rest/v3/

**Authentification :** Basic Auth (email + API token)

**Endpoints utilisés :**
- `GET /rest/api/3/myself` : Info utilisateur
- `GET /rest/api/3/search` : Recherche JQL
- `GET /rest/api/3/issue/{issueKey}` : Détails tâche

### Tempo Timesheets API v4

Documentation : https://tempo.io/doc/timesheets/api/rest/latest/

**Authentification :** Bearer token

**Endpoints utilisés :**
- `POST /4/worklogs` : Créer worklog
- `GET /4/worklogs/user` : Récupérer worklogs
- `PUT /4/worklogs/{id}` : Mettre à jour worklog

## Sécurité

### Stockage des credentials

⚠️ **Important** : Dans la version actuelle, les tokens API sont stockés en clair dans la base de données SQLite.

**Améliorations futures :**
- Utiliser Windows Credential Manager via `node-keytar`
- Chiffrement de la base de données SQLite
- Rotation automatique des tokens

### Context Isolation

L'application utilise `contextIsolation: true` pour séparer le contexte du main process et du renderer, empêchant l'accès direct aux APIs Node.js depuis le renderer.

## Tests

### Tests unitaires (à implémenter)

```bash
npm test
```

**Framework recommandé :** Jest + Testing Library

**À tester :**
- Services (Jira, Tempo, Timer, Adjustment)
- Composants React
- Logique d'ajustement des temps

### Tests d'intégration (à implémenter)

- Flux complet : sélection tâche → timer → validation → envoi Tempo
- Gestion des erreurs réseau
- Récupération après crash

## Build et Distribution

### Build de développement

```bash
npm run build
```

Compile TypeScript et crée les bundles dans `dist/`.

### Package Windows

```bash
npm run package:win
```

Crée un installateur NSIS dans `release/`.

**Configuration :** `package.json` → `build`

## Roadmap

### Fonctionnalités à implémenter

- [ ] Gestion sécurisée des credentials (Credential Manager)
- [ ] Mode hors-ligne avec queue de synchronisation
- [ ] Statistiques et rapports de temps
- [ ] Détection automatique d'inactivité
- [ ] Raccourcis clavier globaux
- [ ] Support multi-projets
- [ ] Export CSV des temps
- [ ] Tests unitaires et e2e

### Optimisations

- [ ] Réduire la taille du bundle
- [ ] Lazy loading des composants
- [ ] Cache intelligent des requêtes Jira
- [ ] Compression de la base de données

## Contribution

### Code Style

- **Langage** : TypeScript strict
- **Formatage** : Prettier (à configurer)
- **Linting** : ESLint (à configurer)
- **Commits** : Conventional Commits

### Pull Requests

1. Créer une branche feature
2. Implémenter les changements
3. Ajouter des tests
4. Créer une PR avec description détaillée

## Ressources

- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [React Documentation](https://react.dev/)
- [Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Tempo API](https://tempo.io/doc/timesheets/api/rest/latest/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
