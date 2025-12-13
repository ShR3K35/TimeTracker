# Captures d'écran - TGD Time Tracker

Ce dossier contient les captures d'écran de l'application pour la documentation.

## Comment générer les captures d'écran

### Prérequis
1. Avoir l'application lancée en mode développement ou production
2. Avoir configuré les APIs Jira et Tempo
3. Avoir quelques données de test (sessions, tâches)

### Liste des captures à prendre

#### 1. Configuration (config-view.png)
- Ouvrir l'application pour la première fois
- Afficher l'écran de configuration
- **Dimensions recommandées** : 600x700px
- **À capturer** : Formulaire avec les champs Jira et Tempo

#### 2. Vue Timer - État actif (timer-active.png)
- Démarrer un chronomètre sur une tâche
- Attendre quelques minutes pour avoir un temps significatif (ex: 00:15:30)
- **Dimensions recommandées** : 600x500px
- **À capturer** :
  - Tâche en cours (TGD-1234 - titre)
  - Chronomètre en cours
  - Boutons "Changer de tâche" et "Arrêter"

#### 3. Vue Timer - État vide (timer-empty.png)
- Arrêter le chronomètre
- **Dimensions recommandées** : 600x400px
- **À capturer** : État "Aucune tâche active" avec bouton de sélection

#### 4. Sélecteur de tâches (task-selector.png)
- Ouvrir l'onglet "Tâches"
- S'assurer d'avoir des tâches récentes affichées
- **Dimensions recommandées** : 700x600px
- **À capturer** :
  - Barre de recherche
  - Liste des tâches récentes avec icônes et badges

#### 5. Recherche de tâches (task-search.png)
- Effectuer une recherche (ex: "API" ou "TGD-1234")
- **Dimensions recommandées** : 700x600px
- **À capturer** : Résultats de recherche

#### 6. Feuilles de temps (timesheet-view.png)
- Ouvrir l'onglet "Feuilles de temps"
- Avoir au moins 2-3 jours avec des sessions
- **Dimensions recommandées** : 800x700px
- **À capturer** :
  - Liste des journées avec dates, heures, statuts
  - Badge d'ajustement si applicable
  - Boutons d'action

#### 7. Détail d'une journée (timesheet-detail.png)
- Cliquer sur "Voir détail" d'une journée
- **Dimensions recommandées** : 800x700px
- **À capturer** : Sessions détaillées avec durées

#### 8. Notification Windows (notification.png)
- Attendre ou simuler une notification après 60 minutes
- **Dimensions recommandées** : capture de la notification Windows
- **À capturer** : Toast notification avec question et boutons

#### 9. System Tray (system-tray.png)
- Faire un clic droit sur l'icône dans la barre des tâches
- **Dimensions recommandées** : capture du menu contextuel
- **À capturer** : Menu avec options (Ouvrir, État, Quitter)

#### 10. Vue complète (main-window.png)
- Capture de la fenêtre complète avec navigation visible
- **Dimensions recommandées** : 600x500px
- **À capturer** : En-tête avec navigation + contenu

## Outils recommandés

### Windows
- **Snipping Tool** (Outil Capture d'écran) - Intégré à Windows
  - Raccourci : `Win + Shift + S`
- **Greenshot** - Gratuit, très pratique
- **ShareX** - Open source, très complet

### Paramètres de capture
- **Format** : PNG (pour la qualité)
- **Résolution** : Native (pas de zoom)
- **Fond** : Utiliser l'application sur fond clair Windows

## Nommage des fichiers

Suivre cette convention :
```
[section]-[description]-[etat?].png

Exemples :
- config-view.png
- timer-active.png
- timer-empty.png
- task-selector.png
- task-search-results.png
- timesheet-view.png
- timesheet-detail.png
- notification.png
- system-tray-menu.png
```

## Post-traitement

### Optionnel mais recommandé :
1. **Anonymisation** : Flouter les données sensibles si nécessaire
2. **Annotations** : Ajouter des flèches ou légendes si besoin
3. **Redimensionnement** : Optimiser la taille pour le web (max 1200px de largeur)
4. **Compression** : Utiliser TinyPNG ou similaire pour réduire la taille

## Mise à jour de la documentation

Après avoir généré les captures :
1. Placer les fichiers dans `docs/screenshots/`
2. Vérifier que les chemins dans README.md et GUIDE.md sont corrects
3. Commit et push les images
