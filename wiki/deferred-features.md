# Features différées — DK GTM Manager

## Cleaning — variables/triggers non référencés

**Description** : outil de nettoyage post-audit pour détecter les variables et triggers GTM qui ne sont utilisés dans aucun tag (triggers) ou aucun tag/trigger (variables). Interface listant les entités orphelines avec possibilité de planifier leur suppression.
**Dépend de** : GCP OAuth pour l'exécution. Détection fonctionnelle sur mock.
**État** : demandé, non encore implementé. À placer en onglet Monitoring ou page dédiée `/dashboard/cleaning`.

## Monitoring live — scan des containers réels

**Description** : la page Monitoring fonctionne actuellement sur des données mock (`monitoring-mock.ts`). L'objectif est de scanner les vrais containers GTM sélectionnés pour alimenter la matrice de couverture et la comparaison de contenu.
**Dépend de** : GCP OAuth + `listTagsFull` / `listVariablesFull` / `listTriggersFull` dans `gtm-api.ts`.
**État actuel** : page Monitoring complète (Tags / Déclencheurs / Variables / Paramètres envoyés), renommage groupé queue, actions déclencheurs queue, comparaison de contenu Custom JS — tout fonctionnel sur mock. Bouton "Scanner" désactivé avec tooltip "GCP OAuth requis".
**Quand** : même déblocage que GCP OAuth global. Voir [[auth-strategy]].

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
