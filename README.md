# Cahier des Charges
## Application de Suivi de Temps - TGD Time Tracker

[![Build Status](https://github.com/ShR3K35/TimeTracker/workflows/Build%20and%20Package%20Application/badge.svg)](https://github.com/ShR3K35/TimeTracker/actions)

---

## 1. Présentation du Projet

### 1.1 Contexte

Dans le cadre du projet TGD chez Additi, les membres de l'équipe doivent quotidiennement imputer leur temps de travail sur les différentes tâches et epics via Tempo (plugin Jira). Cette saisie manuelle est chronophage et sujette à des oublis ou approximations.

### 1.2 Objectif

Développer une application desktop Windows permettant de tracker automatiquement le temps passé sur les tâches Jira, avec un système de validation intelligent et une synchronisation vers Tempo.

### 1.3 Périmètre

L'application cible exclusivement l'environnement Windows et s'intègre avec l'instance Jira/Tempo du projet TGD.

---

## 2. Spécifications Fonctionnelles

### 2.1 Architecture Générale

| Composant | Description |
|-----------|-------------|
| Mode d'exécution | Application résidente en arrière-plan (system tray) |
| Interface | Fenêtre principale réduite + notifications système |
| Persistance | Base de données locale (SQLite recommandé) |
| Intégrations | API Jira, API Tempo |

### 2.2 Fonctionnalités Principales

#### 2.2.1 Gestion des Tâches

**Sélection d'une tâche**

L'utilisateur peut sélectionner une tâche de deux manières :

- **Liste des tâches récentes** : Affichage des tâches et epics sur lesquelles l'utilisateur a interagi récemment (issues assignées, commentées, mises à jour)
- **Recherche manuelle** : Champ de recherche permettant de trouver une tâche par sa clé (ex: TGD-1234) ou par mots-clés dans le titre

**Informations affichées par tâche**

- Clé Jira (ex: TGD-1234)
- Titre de la tâche
- Type (Task, Epic, Bug, Story...)
- Statut actuel
- Epic parent (si applicable)

#### 2.2.2 Chronomètre

**Démarrage**

- Le chronomètre démarre automatiquement à la sélection d'une tâche
- Un seul chronomètre peut être actif à la fois
- Affichage du temps écoulé en temps réel (HH:MM:SS)

**Arrêt**

Le chronomètre s'arrête dans les cas suivants :
- Sélection d'une nouvelle tâche (bascule automatique)
- Réponse négative à une notification de confirmation
- Absence de réponse à une notification (timeout 60 secondes)
- Arrêt manuel par l'utilisateur

**Persistance**

- Les sessions de travail sont enregistrées localement avec horodatage de début et fin
- En cas de crash ou fermeture inopinée, la dernière session en cours est marquée comme "à vérifier"

#### 2.2.3 Système de Notifications

**Notification de Confirmation Horaire**

- **Déclencheur** : Toutes les 60 minutes si un chronomètre est actif
- **Contenu** : "Travaillez-vous toujours sur [TGD-XXXX] - [Titre de la tâche] ?"
- **Actions disponibles** :
  - "Oui, continuer" → Le chronomètre continue
  - "Non, arrêter" → Le chronomètre s'arrête, l'utilisateur est invité à sélectionner une nouvelle tâche
- **Timeout** : 60 secondes sans réponse → Arrêt automatique du chronomètre
- **Comportement** : Notification native Windows (toast notification) avec son optionnel

**Autres Notifications**

- Rappel de démarrage le matin (configurable)
- Alerte si aucune tâche n'a été trackée depuis X heures (configurable)
- Confirmation d'envoi vers Tempo

#### 2.2.4 Ajustement Automatique des Temps

**Déclencheur**

Au lancement de l'application ou à la première saisie après une absence (weekend, jour férié, congé), le système analyse les feuilles de temps des jours précédents non validées.

**Règle de Calcul**

- Durée maximale par jour : **7h30** (450 minutes)
- Si le temps total d'une journée dépasse 7h30, les temps sont recalculés au prorata pour atteindre exactement 7h30

**Algorithme de Répartition**

```
Pour chaque journée non validée avec temps_total > 7h30 :
    coefficient = 450 / temps_total_minutes
    Pour chaque entrée de temps :
        nouveau_temps = temps_original × coefficient
        arrondir au quart d'heure le plus proche
    Ajuster si nécessaire pour obtenir exactement 7h30
```

**Affichage**

- Présentation claire du temps original vs temps ajusté
- Possibilité de modifier manuellement avant validation
- Indicateur visuel des journées ayant subi un ajustement

#### 2.2.5 Gestion des Feuilles de Temps

**Vue par Jour**

Affichage sous forme de liste des journées avec :
- Date
- Nombre d'heures total
- Statut : Brouillon / Prêt à envoyer / Envoyé
- Indicateur d'ajustement appliqué

**Détail d'une Journée**

Pour chaque journée, liste des entrées de temps :
- Tâche (clé + titre)
- Heure de début
- Heure de fin
- Durée
- Commentaire (optionnel, éditable)

**Actions**

- Éditer une entrée (modifier durée, ajouter commentaire)
- Supprimer une entrée
- Fusionner des entrées sur la même tâche
- Valider et envoyer vers Tempo

#### 2.2.6 Synchronisation Tempo

**Envoi des Temps**

- Sélection des journées à envoyer (multi-sélection possible)
- Aperçu avant envoi avec récapitulatif
- Envoi via API Tempo
- Gestion des erreurs avec retry automatique

**Format d'Envoi**

Pour chaque entrée :
- Issue Key
- Date
- Durée (en secondes ou format Tempo)
- Commentaire (optionnel)
- Account ID utilisateur

---

## 3. Spécifications Techniques

### 3.1 Stack Technologique Recommandée

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| Framework UI | Electron ou Tauri | Applications desktop cross-platform avec technologies web |
| Langage | TypeScript | Typage fort, maintenabilité |
| Base de données | SQLite | Légère, sans serveur, fichier local |
| Notifications | Windows Toast API | Intégration native Windows |
| HTTP Client | Axios ou Fetch | Appels API REST |

**Alternative native** : .NET WPF/WinUI si préférence pour une solution 100% Windows.

### 3.2 Intégrations API

#### API Jira (REST API v3)

**Endpoints utilisés**

| Endpoint | Usage |
|----------|-------|
| `GET /rest/api/3/search` | Recherche de tâches (JQL) |
| `GET /rest/api/3/issue/{issueKey}` | Détails d'une tâche |
| `GET /rest/api/3/myself` | Informations utilisateur connecté |

**Authentification** : API Token + Email (Basic Auth) ou OAuth 2.0

#### API Tempo Timesheets

**Endpoints utilisés**

| Endpoint | Usage |
|----------|-------|
| `POST /4/worklogs` | Création d'une entrée de temps |
| `GET /4/worklogs` | Récupération des temps existants |
| `PUT /4/worklogs/{id}` | Mise à jour d'une entrée |

**Authentification** : Tempo API Token

### 3.3 Modèle de Données Local

```
┌─────────────────────────────────────────────────────────┐
│ Configuration                                           │
├─────────────────────────────────────────────────────────┤
│ id (PK), key, value, updated_at                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ WorkSession                                             │
├─────────────────────────────────────────────────────────┤
│ id (PK), issue_key, issue_title, issue_type,            │
│ start_time, end_time, duration_seconds, comment,        │
│ status (draft/adjusted/sent), tempo_worklog_id,         │
│ created_at, updated_at                                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ DailySummary                                            │
├─────────────────────────────────────────────────────────┤
│ id (PK), date, total_minutes, adjusted_minutes,         │
│ status (pending/ready/sent), sent_at                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ RecentIssue                                             │
├─────────────────────────────────────────────────────────┤
│ id (PK), issue_key, issue_title, issue_type,            │
│ epic_key, last_used_at                                  │
└─────────────────────────────────────────────────────────┘
```

### 3.4 Sécurité

- Stockage sécurisé des tokens API (Windows Credential Manager)
- Pas de stockage en clair des identifiants
- Chiffrement de la base de données locale (optionnel mais recommandé)
- Validation des entrées utilisateur

---

## 4. Interface Utilisateur

### 4.1 Écran Principal (Mode Compact)

```
┌─────────────────────────────────────────────────────┐
│  TGD Time Tracker                          [─][□][×]│
├─────────────────────────────────────────────────────┤
│                                                     │
│  ▶ TGD-1234 - Intégration API Amazon DSP           │
│                                                     │
│              ┌──────────────┐                       │
│              │   02:34:17   │                       │
│              └──────────────┘                       │
│                                                     │
│  [Changer de tâche]         [Arrêter]              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.2 Sélecteur de Tâches

```
┌─────────────────────────────────────────────────────┐
│  Sélectionner une tâche                             │
├─────────────────────────────────────────────────────┤
│  🔍 [Rechercher...                              ]   │
├─────────────────────────────────────────────────────┤
│  Tâches récentes                                    │
│  ─────────────────────────────────────────────────  │
│  📋 TGD-1234  Intégration API Amazon DSP      Epic  │
│  🐛 TGD-1198  Fix worker GAM sync             Bug   │
│  📋 TGD-1156  Config alertes Grafana          Task  │
│  📋 TGD-1089  Migration VictoriaMetrics       Epic  │
│                                                     │
│  [Voir toutes les tâches assignées]                 │
└─────────────────────────────────────────────────────┘
```

### 4.3 Vue Feuilles de Temps

```
┌─────────────────────────────────────────────────────┐
│  Feuilles de temps                                  │
├─────────────────────────────────────────────────────┤
│  ☑ Lun 09/12  │ 7h30 │ ✓ Ajusté  │ Prêt           │
│  ☑ Mar 10/12  │ 7h30 │           │ Prêt           │
│  ☐ Mer 11/12  │ 6h15 │           │ Brouillon      │
│  ☐ Jeu 12/12  │ 4h30 │           │ En cours       │
├─────────────────────────────────────────────────────┤
│  [Voir détail]    [Ajuster]    [Envoyer à Tempo]   │
└─────────────────────────────────────────────────────┘
```

### 4.4 Notification de Confirmation

```
┌─────────────────────────────────────────────────────┐
│ 🕐 TGD Time Tracker                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Travaillez-vous toujours sur :                      │
│ TGD-1234 - Intégration API Amazon DSP ?             │
│                                                     │
│ Temps écoulé : 1h00                                 │
│                                                     │
│         [Oui, continuer]    [Non, arrêter]          │
│                                                     │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 45s restantes        │
└─────────────────────────────────────────────────────┘
```

---

## 5. Paramètres Configurables

| Paramètre | Valeur par défaut | Description |
|-----------|-------------------|-------------|
| `max_daily_hours` | 7.5 | Nombre d'heures max par jour |
| `notification_interval` | 60 | Intervalle de notification (minutes) |
| `notification_timeout` | 60 | Délai avant arrêt auto (secondes) |
| `jira_base_url` | - | URL de l'instance Jira |
| `jira_project_key` | TGD | Clé du projet Jira |
| `tempo_api_url` | - | URL de l'API Tempo |
| `recent_issues_count` | 10 | Nombre de tâches récentes affichées |
| `startup_with_windows` | true | Lancement au démarrage Windows |
| `morning_reminder` | 09:00 | Heure du rappel matinal |
| `sound_enabled` | true | Sons de notification |

---

## 6. Cas d'Utilisation

### 6.1 Journée Type

1. **08:30** - L'utilisateur démarre son PC, l'application se lance automatiquement
2. **08:35** - Notification de rappel : "Bonjour ! N'oubliez pas de démarrer votre suivi de temps"
3. **08:40** - L'utilisateur sélectionne TGD-1234 dans ses tâches récentes, le chrono démarre
4. **09:40** - Notification : "Travaillez-vous toujours sur TGD-1234 ?" → "Oui"
5. **10:30** - L'utilisateur change de tâche pour TGD-1156, le chrono bascule automatiquement
6. **11:30** - Notification → "Oui"
7. **12:30** - L'utilisateur arrête manuellement pour la pause déjeuner
8. **14:00** - L'utilisateur reprend sur TGD-1234
9. **15:00** - Notification → Pas de réponse pendant 60s → Chrono arrêté
10. **15:02** - L'utilisateur voit la notification d'arrêt, relance sur TGD-1198
11. **18:00** - Fin de journée, l'utilisateur consulte son résumé

### 6.2 Retour de Weekend

1. **Lundi 09:00** - L'application détecte que vendredi n'a pas été validé
2. L'application calcule : Vendredi = 8h45 trackées
3. Ajustement automatique : réduction proportionnelle à 7h30
4. Affichage : "Vendredi 06/12 - 8h45 → 7h30 (ajusté)"
5. L'utilisateur peut modifier manuellement si nécessaire
6. Validation et envoi vers Tempo

---

## 7. Gestion des Erreurs

| Situation | Comportement |
|-----------|--------------|
| Perte de connexion réseau | Stockage local, sync différée |
| API Jira indisponible | Mode hors-ligne, tâches en cache |
| API Tempo indisponible | File d'attente d'envoi, retry automatique |
| Crash application | Récupération de la session au redémarrage |
| Token expiré | Notification + redirection vers config |

---

## 8. Contraintes et Prérequis

### 8.1 Environnement Cible

- OS : Windows 10 / 11
- Mémoire : < 100 MB RAM en fonctionnement
- Stockage : < 50 MB
- Réseau : Accès HTTPS aux APIs Jira et Tempo

### 8.2 Prérequis Utilisateur

- Compte Jira avec accès au projet TGD
- Token API Jira personnel
- Token API Tempo personnel
- Droits de logging sur Tempo

---

## 9. Livrables

1. **Application** : Exécutable Windows (.exe) avec installateur
2. **Documentation** : Guide d'installation et d'utilisation
3. **Configuration** : Fichier de paramètres par défaut
4. **Code source** : Repository Git avec documentation technique

### 9.1 Builds Automatiques

L'application est automatiquement buildée via **GitHub Actions** à chaque push :

**📥 Télécharger un build**
- Allez sur [Actions](https://github.com/ShR3K35/TimeTracker/actions)
- Sélectionnez le workflow run de votre branche
- Téléchargez l'artifact dans la section **Artifacts**

**Types d'exécutables disponibles :**
- **Setup** (`*-Setup.exe`) : Installateur Windows avec raccourcis
- **Portable** (`*-Portable.exe`) : Exécutable autonome sans installation

**Naming :**
- **Branches** : `TGD-Time-Tracker-<nom-branche>-<type>.exe`
  - Ex: `TGD-Time-Tracker-main-Setup.exe`
- **Tags** : `TGD-Time-Tracker-<type>.exe`
  - Ex: `TGD-Time-Tracker-Setup.exe` (pour tag v1.0.0)

> Consultez [.github/workflows/README.md](.github/workflows/README.md) pour plus de détails sur la CI/CD.

---

## 10. Évolutions Futures (hors scope initial)

- Support macOS / Linux
- Détection automatique de la tâche active (intégration IDE)
- Intégration calendrier (pause automatique pendant les réunions)
- Rapports et statistiques de temps
- Mode équipe avec dashboard manager
- Widget desktop avec mini-chrono
- Raccourcis clavier globaux

---

## 11. Critères d'Acceptation

- [ ] L'application reste active en arrière-plan sans impact notable sur les performances
- [ ] Le chronomètre fonctionne avec précision (écart < 1 seconde/heure)
- [ ] Les notifications apparaissent à l'heure prévue avec timeout fonctionnel
- [ ] L'ajustement automatique calcule correctement les temps pour 7h30 max
- [ ] L'envoi vers Tempo crée les worklogs avec les bonnes informations
- [ ] Les données persistent après fermeture/redémarrage de l'application
- [ ] La recherche de tâches fonctionne par clé et par titre

---

*Document rédigé le 13/12/2024*  
*Version 1.0*
