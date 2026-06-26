# Features différées — DK GTM Manager

## Actions déclencheurs — Synchroniser (action 2 du PRD)

**Description** : depuis l'onglet Déclencheurs du TagDrawer, aligner les triggers d'un ou plusieurs containers cibles sur ceux d'un container de référence. Mode Remplacer : le cible finit identique à la référence. Détection des triggers sémantiquement équivalents avant création (éviter les doublons).
**Dépend de** : GCP OAuth pour l'exécution. La planification (queue) peut être développée sans OAuth.
**État** : PRD v1.1 validé. L'action "Retirer" (action 1) est implémentée. Synchroniser = prochaine étape.
**Voir** : `PRD_TriggerActions.md` section 2.2.

## Panneau "Actions déclencheurs" dans le header

**Description** : bouton dans le header MonitoringPage (`pendingTriggerOps.length > 0`) qui ouvre un panneau listant les opérations en queue (type, tag, containers impactés, détail des étapes). Boutons : supprimer une opération, tout effacer, appliquer (OAuth requis).
**État** : bouton badge visible implémenté — panneau slide-in pas encore construit.

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
