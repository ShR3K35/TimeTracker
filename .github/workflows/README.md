# CI/CD Pipeline - TGD Time Tracker

Ce dossier contient les workflows GitHub Actions pour automatiser le build et le packaging de l'application.

## 📦 Workflow de Build

Le workflow `build.yml` se déclenche automatiquement sur :
- **Tous les push de branches** : Build avec nom de branche
- **Tous les tags** (format `v*`) : Build avec version du tag

### Fonctionnement

1. **Checkout du code**
2. **Installation de Node.js 20**
3. **Installation des dépendances** (`npm ci`)
4. **Build de l'application** (TypeScript + React)
5. **Packaging avec Electron Builder**
6. **Renommage des exécutables**
7. **Upload des artifacts**
8. **Création de release** (uniquement pour les tags)

## 🏷️ Naming des Exécutables

### Pour les branches

Format : `TGD-Time-Tracker-<nom-de-branche>-<type>.exe`

Exemples :
- Branche `main` → `TGD-Time-Tracker-main-Setup.exe` et `TGD-Time-Tracker-main-Portable.exe`
- Branche `feature/auth` → `TGD-Time-Tracker-feature-auth-Setup.exe`
- Branche `claude/time-management-system-01JTqgaEBr9hwV1NVxVjecur` → `TGD-Time-Tracker-claude-time-management-system-01JTqgaEBr9hwV1NVxVjecur-Setup.exe`

### Pour les tags

Format : `TGD-Time-Tracker-<type>.exe` (sans version dans le nom pour les tags)

Exemples :
- Tag `v1.0.0` → `TGD-Time-Tracker-Setup.exe` et `TGD-Time-Tracker-Portable.exe`
- Tag `v1.2.3` → `TGD-Time-Tracker-Setup.exe` et `TGD-Time-Tracker-Portable.exe`

> **Note** : Les caractères spéciaux dans les noms de branches sont remplacés par des tirets.

## 📥 Télécharger les Builds

### Via GitHub Actions

1. Allez sur l'onglet **Actions** du repository
2. Cliquez sur le workflow run souhaité
3. Scrollez jusqu'à la section **Artifacts**
4. Téléchargez l'artifact `TGD-Time-Tracker-<nom>`

### Via GitHub Releases (tags uniquement)

1. Allez sur l'onglet **Releases**
2. Sélectionnez la version souhaitée
3. Téléchargez l'exécutable depuis la section **Assets**

## 🔨 Types d'Exécutables Générés

### Setup (Installateur NSIS)
- **Nom** : `*-Setup.exe`
- **Description** : Installateur Windows complet
- **Fonctionnalités** :
  - Installation dans Program Files
  - Création de raccourcis (bureau + menu démarrer)
  - Désinstallation propre
  - Choix du répertoire d'installation

### Portable
- **Nom** : `*-Portable.exe`
- **Description** : Exécutable portable autonome
- **Fonctionnalités** :
  - Aucune installation requise
  - Lancement direct
  - Idéal pour clé USB

## 🚀 Créer une Release

Pour créer une nouvelle release avec exécutables :

```bash
# 1. Mettre à jour la version dans package.json
npm version patch  # ou minor, ou major

# 2. Créer et pousser le tag
git push origin v1.0.0

# 3. Le workflow build se déclenche automatiquement
# 4. Une release GitHub est créée avec les exécutables
```

## ⚙️ Configuration

### Variables d'Environnement

Aucune variable d'environnement ou secret n'est nécessaire. Le workflow utilise uniquement :
- `GITHUB_TOKEN` : Token automatique fourni par GitHub Actions
- `GITHUB_REF` : Référence Git (branche ou tag)

### Prérequis

- Repository sur GitHub
- GitHub Actions activé (activé par défaut)
- Permissions d'écriture pour les workflows

### Rétention des Artifacts

Les artifacts sont conservés pendant **90 jours** par défaut. Après ce délai, ils sont automatiquement supprimés.

## 🐛 Dépannage

### Le workflow échoue lors de l'installation des dépendances

**Problème** : `better-sqlite3` nécessite une compilation native

**Solution** : Le workflow utilise `windows-latest` avec les outils de build Windows. Vérifiez que les dépendances de `better-sqlite3` sont bien listées.

### Les exécutables ne se lancent pas

**Problème** : SQLite ou autres dépendances natives manquantes

**Solution** : Le workflow copie automatiquement `better-sqlite3/build/Release` dans les ressources de l'application via `extraResources` dans `package.json`.

### Le renommage des fichiers échoue

**Problème** : Noms de fichiers générés différents

**Solution** : Vérifiez que la version dans `package.json` est `1.0.0` (ou ajustez le script de renommage).

## 📊 Exemple de Run

```
Build and Package Application
├── Checkout code                     ✓
├── Setup Node.js                     ✓
├── Install dependencies              ✓ (2m 30s)
├── Build application                 ✓ (45s)
├── Package application               ✓ (3m 15s)
├── Determine naming strategy         ✓
├── Rename executables                ✓
│   ✓ Renamed installer to: TGD-Time-Tracker-main-Setup.exe
│   ✓ Renamed portable to: TGD-Time-Tracker-main-Portable.exe
├── Upload executable artifact        ✓
└── Create Release (skipped)          -

Total duration: 6m 45s
```

## 🔄 Modification du Workflow

Pour modifier le workflow :

1. Éditez `.github/workflows/build.yml`
2. Testez les changements sur une branche de test
3. Vérifiez les logs dans l'onglet Actions
4. Mergez dans main une fois validé

## 📝 Notes

- Le workflow s'exécute sur `windows-latest` pour compiler les dépendances natives Windows
- L'utilisation de `npm ci` au lieu de `npm install` garantit des builds reproductibles
- Le cache npm est activé pour accélérer les builds
- Les releases sont automatiquement créées pour les tags avec `softprops/action-gh-release`

## 🔗 Ressources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Electron Builder Documentation](https://www.electron.build/)
- [Actions Upload Artifact](https://github.com/actions/upload-artifact)
- [Actions Create Release](https://github.com/softprops/action-gh-release)
