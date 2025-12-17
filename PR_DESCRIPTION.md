# Ajout des fonctionnalités de favoris et raccourcis clavier

## Résumé

Cette PR ajoute deux nouvelles fonctionnalités majeures au TGD Time Tracker :
- **Système de tâches favorites** (maximum 10 tâches)
- **Raccourcis clavier configurables** pour lancer le chronomètre rapidement

## Fonctionnalités ajoutées

### 1. Tâches favorites
- Ajout/suppression de tâches favorites via un bouton étoile (★/☆)
- Affichage des tâches favorites en haut de la page de sélection
- Limite de 10 tâches favorites
- Stockage persistant en base de données SQLite

### 2. Raccourcis clavier configurables
- Configuration de raccourcis globaux (ex: Ctrl+F2, Alt+Shift+T)
- Interface dédiée dans le menu "Raccourcis"
- Activation/désactivation individuelle des raccourcis
- Lancement automatique du chronomètre via raccourci
- Notification système lors de l'activation
- Validation des raccourcis (disponibilité, format valide)

## Modifications techniques

### Backend (Main Process)
- `src/main/database/schema.ts` : Nouvelles tables `FavoriteTask` et `KeyboardShortcut` + méthodes CRUD
- `src/main/main.ts` : Intégration du `ShortcutService` et handlers IPC pour favorites/shortcuts
- `src/main/preload.ts` : Exposition des nouvelles API au renderer
- `src/main/services/shortcut.service.ts` : **Nouveau** - Service de gestion des raccourcis globaux avec EventEmitter

### Frontend (Renderer Process)
- `src/renderer/App.tsx` : Ajout de la vue "Raccourcis" dans la navigation
- `src/renderer/components/TaskSelector.tsx` : Gestion des favoris avec bouton étoile
- `src/renderer/components/TaskSelector.css` : Styles pour le bouton favori
- `src/renderer/components/ShortcutManager.tsx` : **Nouveau** - Interface de configuration des raccourcis
- `src/renderer/components/ShortcutManager.css` : **Nouveau** - Styles du gestionnaire
- `src/renderer/types/electron.d.ts` : Types TypeScript pour les nouvelles API

## Schéma de base de données

### Table FavoriteTask
```sql
CREATE TABLE FavoriteTask (
  id INTEGER PRIMARY KEY,
  issue_key TEXT NOT NULL UNIQUE,
  issue_title TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

### Table KeyboardShortcut
```sql
CREATE TABLE KeyboardShortcut (
  id INTEGER PRIMARY KEY,
  accelerator TEXT NOT NULL UNIQUE,
  issue_key TEXT NOT NULL,
  issue_title TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

## Test plan

- [ ] Tester l'ajout/suppression de tâches favorites
- [ ] Vérifier la limite de 10 favoris
- [ ] Tester l'affichage des favoris dans TaskSelector
- [ ] Créer un raccourci clavier (ex: Ctrl+F2)
- [ ] Tester l'activation du chronomètre via raccourci
- [ ] Vérifier la validation des raccourcis
- [ ] Tester l'activation/désactivation des raccourcis
- [ ] Vérifier la persistance après redémarrage

## Captures d'écran

### TaskSelector avec favoris
- Section "⭐ Tâches favorites" en haut de la page
- Bouton étoile sur chaque tâche récente

### ShortcutManager
- Liste des tâches favorites avec option de configuration
- Interface de capture de touches
- Résumé des raccourcis actifs

## Notes

- Les raccourcis sont globaux et fonctionnent même quand l'application est en arrière-plan
- Les raccourcis sont automatiquement désactivés à la fermeture de l'application
- Les favoris et raccourcis sont stockés localement dans SQLite

## Fichiers modifiés

- 10 fichiers modifiés
- 3 nouveaux fichiers créés
- +1134 lignes ajoutées
- -3 lignes supprimées
