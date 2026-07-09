# Architecture — DK GTM Manager

## Stack

- **React 19 + Vite** — SPA, pas de SSR
- **TypeScript** — strict, zéro `any`
- **Tailwind v4** — config via `@theme` dans `src/index.css` (pas de `tailwind.config.ts`)
- **Zustand** — store global unique `useGTMStore` + `useAuthStore`
- **React Router** — routing côté client, basepath `/dashboard/`

## Structure `src/`

```
src/
  components/
    containers/    — BulkRenameModal (nomenclature + find/replace, queue ContainerRenameOperation)
    diff/          — DiffView, GA4CoverageMatrix
    layout/        — Sidebar, Header
    monitoring/    — RenameDrawer, VariableContentDrawer, TagDrawer, ParamMatrixTab, CleaningTab, DistributionTab, RecommendationsTab, BulkRenameModal
    packages/      — EntityDrawer (incl. trigger-ids-list pour tgg)
    ui/            — Button, Badge, Combobox, DKGTMLogo, FeedbackDrawer
  data/
    gtm-static.ts       — données réelles MCP (~160 comptes, 47 containers PFS)
    gtm-entity-types.ts — définitions des types GTM avec champs de formulaire
    monitoring-mock.ts  — 5 containers simulés (TK, AF, COR, IBE, SWI) avec écarts intentionnels
  lib/
    auth.ts             — helpers OAuth Google
    gtm-api.ts          — appels API GTM (requiert accessToken) : tags/triggers/variables/templates/gtag_config/versions
    gtm-diff.ts         — calcul de diff entre package et état GTM live + diffVersions (version publiée vs version publiée)
    gtm-matrix.ts       — détection de plateforme/catégorie partagée (Monitoring, Distribution, export PDF) — voir [[monitoring]]
    ga4-event-params.ts — flattenGA4EventParams() : aplatit les deux conventions réelles de paramètres GA4 Event (eventParameters / eventSettingsTable)
    export-monitoring.ts — génération du rapport HTML imprimable
    storage.ts          — localStorage pour packages et historique
  pages/
    Dashboard.tsx      — loader initial, appel fetchAccounts
    ContainersPage.tsx — sélection compte + containers, combobox, tri, bulk rename
    PackagesPage.tsx   — éditeur GTM-like (tabs + drawer)
    DeployPage.tsx     — workflow diff → matrix → deploy (nom auto, description)
    MonitoringPage.tsx — matrice couverture cross-containers (5 onglets + QuickCreatePanel)
    HistoryPage.tsx    — historique des déploiements
    ContextePage.tsx   — analyse container + timeline des versions
  store/
    auth-store.ts     — accessToken, user
    gtm-store.ts      — accounts, containers, packages, diffs, deploy, pendingRenames, pendingContainerRenames, applyPublishErrors
    profile-store.ts  — profils nommés (Ron, Tim, Juh…), namespace localStorage par profil
  types/
    gtm.ts         — tous les types GTM + DeploymentPackage + DiffEntity + RenameOperation + TriggerOperation + DeletionOperation + ContainerRenameOperation
```

## Patterns clés

**Token optionnel** : `fetchAccounts(token?: string)` — si pas de token, charge `STATIC_ACCOUNTS`. Même pattern pour `selectAccount`. Permet d'utiliser l'app sans GCP OAuth.

**Fallback statique** : `gtm-static.ts` contient les vraies données récupérées via MCP GTM. Temporaire jusqu'à GCP OAuth.

**Storage** : packages et historique dans localStorage via `src/lib/storage.ts`. Pas de backend.

**Rename queue** : `pendingRenames: RenameOperation[]` dans le store Zustand. Les opérations de renommage sont empilées en mémoire et seront exécutées via l'API GTM quand GCP OAuth sera configuré.

**Monitoring mock** : `monitoring-mock.ts` contient des données simulées avec écarts intentionnels pour rendre le monitoring utile sans OAuth. Remplacé par des données live dès que `listTagsFull` / `listVariablesFull` seront appelables avec token.

**Profils multi-utilisateurs** : `useProfileStore` (Zustand persist) gère les profils nommés. Chaque profil a un `id` UUID et `colorIndex`. Le localStorage du monitoring est namespaced `dk_gtm_monitoring_v1_${profileId}`. Page `/profile` pour créer/gérer les profils. Le profil actif est affiché dans le header.

**applyPublishErrors** : après `applyDeletions`, les erreurs de publish sont capturées dans `applyPublishErrors[]` (nom du container + message) et affichées en notification rouge dans CleaningTab.

**Publication unifiée** : `applyContainerQueue(token, containerId, {versionName, description})` regroupe pour UN container tous les types d'actions en attente (renommages, opérations déclencheurs, duplications tag/variable) et les publie en un seul workspace vierge + une seule version. Remplace l'ancien design de modales de publication par feature.

**Détection de types GTM natifs non-évidents** : plusieurs types de tags supposés (`awrk`, `clmb`, `gaawc`) se sont révélés faux sur le compte de test réel — les vrais types (`sp`, `gclidw`, `googtag`) sont acceptés en plus des types supposés partout où c'est pertinent (`gtm-matrix.ts`, `DistributionTab.tsx`, `RecommendationsTab.tsx`). Toujours vérifier une hypothèse de type/paramètre GTM sur des données réellement scannées (log ciblé) avant de coder dessus — la doc publique de l'API GTM est souvent incomplète ou absente sur ces détails.

Voir [[auth-strategy]] pour le plan OAuth. Voir [[deployment-flow]] pour le workflow complet. Voir [[monitoring]] pour la logique de la page Monitoring.
