# Features différées — DK GTM Manager

## Cleaning — variables/triggers non référencés

**Description** : outil de nettoyage post-audit pour détecter les variables et triggers GTM qui ne sont utilisés dans aucun tag (triggers) ou aucun tag/trigger (variables). Interface listant les entités orphelines avec possibilité de planifier leur suppression.
**État : implémenté et exécutable en live** — onglet Nettoyage (5ème onglet MonitoringPage). Queue `DeletionOperation[]` dans le store. `applyDeletions` publie réellement (DELETE → createVersion → publishVersion) depuis le 2026-07-02, avec historique de déploiement et notification d'erreurs de publication.

## Monitoring live — scan des containers réels

**État : implémenté (2026-07 avec OAuth).** `useGTMStore.scanMonitoring(token)` scanne les vrais containers GTM par batch de `MONITORING_BATCH_SIZE = 40` (bouton "Scanner (N)" / "Scanner la suite (N)" dans MonitoringPage). `monitoring-mock.ts` reste utilisé comme données de démo/fallback quand aucun scan n'a été lancé, mais la matrice de couverture, la comparaison de contenu, le nettoyage d'orphelins et les actions déclencheurs fonctionnent désormais sur données live.
**Reste à vérifier** : robustesse sur de très gros comptes (>40 containers), gestion d'erreurs partielles de batch.

## GCP OAuth

**État : opérationnel depuis le 2026-07-02.** Voir [[auth-strategy]] (mis à jour).

## Usage tracking

**Description** : système de suivi des connexions et usages de l'outil (qui utilise quoi, quand, depuis où).
**Option A** : Google Sheets via API (léger, lisible)
**Option B** : Supabase (plus robuste si multi-utilisateurs)
**Pourquoi différé** : outil solo pour l'instant, pas de besoin urgent.

## Rollback button

**Description** : dans HistoryPage, bouton pour re-déployer une version précédente sur des containers (revenir en arrière).
**État** : pas encore implémenté. OAuth n'est plus le blocage (API GTM live disponible) — reste à construire l'UI et le flow de rollback.
**Défini dans** : PRD v1.4.

## DataLayer Mapping — Phase B (collecteur → Supabase)

**Description** : le tag collecteur (`gtm-tag/dl-mapping-collector.html`) est écrit mais pas encore déployé ; le schéma Supabase (5 tables, voir [[datalayer-mapping]] et `PRD_DataLayerMapping.md` §9) est conçu mais pas encore créé.
**État** : pas encore implémenté. Phase A (localStorage, mock data) fonctionne indépendamment et ne bloque pas dessus.
**Note** : le bookmarklet envisagé initialement pour cette phase a été abandonné au profit du collecteur temps réel.

## Workspace-level last-modified

**Description** : afficher la vraie date de dernière modification (niveau workspace) plutôt que la date de dernière publication (fingerprint container). Nécessite `workspaces.list` par container.
**État** : pas encore implémenté. OAuth disponible, reste à câbler l'appel `workspaces.list`.
**Note** : le libellé "Publié" dans ContainersPage est volontairement exact — ne pas remettre "Modifié" sans avoir la vraie donnée.
