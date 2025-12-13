# Documentation - TGD Time Tracker

Bienvenue dans la documentation du projet TGD Time Tracker.

## 📚 Documents disponibles

### Pour les utilisateurs

- **[GUIDE.md](../GUIDE.md)** - Guide complet d'installation et d'utilisation
  - Installation et configuration
  - Mode d'emploi détaillé
  - Aperçu visuel de l'application
  - Dépannage

- **[README.md](../README.md)** - Cahier des charges complet
  - Spécifications fonctionnelles
  - Spécifications techniques
  - Cas d'utilisation
  - Critères d'acceptation

### Pour les développeurs

- **[DEVELOPMENT.md](../DEVELOPMENT.md)** - Guide de développement
  - Architecture détaillée
  - Services et composants
  - APIs et intégrations
  - Tests et build

- **[WIREFRAMES.md](WIREFRAMES.md)** - Wireframes ASCII de l'interface
  - Maquettes textuelles de toutes les vues
  - Flux de navigation
  - Architecture des données

### Ressources visuelles

- **[screenshots/](screenshots/)** - Captures d'écran de l'application
  - Instructions pour générer les captures
  - Liste des captures à prendre
  - Conventions de nommage

## 🎨 Aperçu de l'interface

### Wireframes

Consultez [WIREFRAMES.md](WIREFRAMES.md) pour voir des représentations textuelles détaillées de l'interface.

### Captures d'écran

Les captures d'écran seront disponibles après le premier lancement de l'application. Pour les générer :

1. Lancez l'application en mode dev : `npm run dev`
2. Configurez les APIs Jira et Tempo
3. Utilisez l'application normalement
4. Suivez les instructions dans [screenshots/README.md](screenshots/README.md)

**Captures à générer :**
- ✅ Configuration (config-view.png)
- ✅ Timer actif (timer-active.png)
- ✅ Timer vide (timer-empty.png)
- ✅ Sélecteur de tâches (task-selector.png)
- ✅ Recherche de tâches (task-search-results.png)
- ✅ Feuilles de temps (timesheet-view.png)
- ✅ Détail journée (timesheet-detail.png)
- ✅ Notification Windows (notification.png)
- ✅ System tray (system-tray-menu.png)

## 🚀 Démarrage rapide

### Installation

```bash
# Cloner le repository
git clone <repository-url>
cd TimeTracker

# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev
```

### Configuration

Au premier lancement, configurez :
- URL Jira : `https://votre-domaine.atlassian.net`
- Email Jira : `votre.email@example.com`
- Token API Jira : Obtenir sur [Atlassian Security](https://id.atlassian.com/manage-profile/security/api-tokens)
- URL Tempo : `https://api.tempo.io/4`
- Token Tempo : Settings → API Integration dans Tempo
- Account ID : Trouvable dans votre profil Tempo

### Build

```bash
# Build de production
npm run build

# Package Windows
npm run package:win
```

## 📖 Structure de la documentation

```
docs/
├── README.md              # Ce fichier
├── WIREFRAMES.md          # Wireframes ASCII
└── screenshots/           # Captures d'écran
    ├── README.md          # Instructions
    ├── config-view.png
    ├── timer-active.png
    ├── task-selector.png
    └── ... (autres captures)
```

## 🔗 Liens utiles

### APIs et Documentation externe

- [Jira REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Tempo Timesheets API v4](https://tempo.io/doc/timesheets/api/rest/latest/)
- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [React Documentation](https://react.dev/)

### Obtenir les tokens

- [Jira API Token](https://id.atlassian.com/manage-profile/security/api-tokens)
- Tempo API Token : Dans Tempo → Settings → API Integration

## 🤝 Contribution

Pour contribuer au projet :

1. Créer une branche feature
2. Implémenter les changements
3. Ajouter/mettre à jour la documentation
4. Créer une pull request

## 📝 Notes de version

### Version 1.0.0 - Initiale

**Fonctionnalités implémentées :**
- ✅ Chronomètre automatique avec notifications
- ✅ Intégration Jira API v3
- ✅ Intégration Tempo API v4
- ✅ Ajustement automatique des temps (7h30 max)
- ✅ Base de données SQLite locale
- ✅ Interface React avec navigation
- ✅ System tray Windows
- ✅ Notifications natives

**À venir :**
- [ ] Tests unitaires et e2e
- [ ] Stockage sécurisé des credentials
- [ ] Mode hors-ligne
- [ ] Statistiques et rapports
- [ ] Support macOS/Linux

## 📄 Licence

MIT License - Projet interne TGD @ Additi

## 📞 Support

Pour toute question :
1. Consultez la documentation
2. Vérifiez les logs (Developer Tools)
3. Contactez l'équipe de développement

---

*Documentation générée le 13/12/2024*
