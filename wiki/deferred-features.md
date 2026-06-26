# Features différées — DK GTM Manager

## Filtre GA4 sur données containers réelles

**Description** : pouvoir taper `add_to_cart` et voir quels tags dans les containers GTM sélectionnés trackent cet event — indépendamment du nom du tag.
**Dépend de** : GCP OAuth (lire les workspaces des containers).
**État actuel** : le filtre chips dans DiffView et la GA4CoverageMatrix existent mais ne fonctionnent que sur les données de diff post-analyse. Sans OAuth, seule la recherche dans le package local est disponible.

## GCP OAuth

**Pourquoi différé** : pas encore de projet GCP configuré, usage solo actuel couvert par données statiques.
**Quand** : quand les déploiements réels seront nécessaires.
**Ce qui bloque** : diff live, déploiement, matrice couverture GA4.
Voir [[auth-strategy]].

## Usage tracking

**Description** : système de suivi des connexions et usages de l'outil (qui utilise quoi, quand, depuis où).
**Option A** : Google Sheets via API (léger, lisible)
**Option B** : Supabase (plus robuste si multi-utilisateurs)
**Pourquoi différé** : outil solo pour l'instant, pas de besoin urgent.

## Rollback button

**Description** : dans HistoryPage, bouton pour re-déployer une version précédente sur des containers (revenir en arrière).
**Dépend de** : GCP OAuth (nécessite API GTM live).
**Défini dans** : PRD v1.4.

## Workspace-level last-modified

**Description** : afficher la vraie date de dernière modification (niveau workspace) plutôt que la date de dernière publication (fingerprint container). Nécessite `workspaces.list` par container.
**Dépend de** : GCP OAuth.
**Note** : le libellé "Publié" dans ContainersPage est volontairement exact — ne pas remettre "Modifié" sans avoir la vraie donnée.
