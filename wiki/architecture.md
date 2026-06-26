# Architecture — DK GTM Manager

## Stack

- **React 18 + Vite** — SPA, pas de SSR
- **TypeScript** — strict, zéro `any`
- **Tailwind v4** — config via `@theme` dans `src/index.css` (pas de `tailwind.config.ts`)
- **Zustand** — store global unique `useGTMStore` + `useAuthStore`
- **React Router** — routing côté client, basepath `/dashboard/`

## Structure `src/`

```
src/
  components/
    diff/          — DiffView, GA4CoverageMatrix
    layout/        — Sidebar, Header
    packages/      — EntityDrawer
    ui/            — Button, Badge, Combobox
  data/
    gtm-static.ts  — données réelles MCP (~160 comptes, 47 containers PFS)
    gtm-entity-types.ts — définitions des types GTM avec champs de formulaire
  lib/
    auth.ts        — helpers OAuth Google
    gtm-api.ts     — appels API GTM (requiert accessToken)
    gtm-diff.ts    — calcul de diff entre package et état GTM live
    storage.ts     — localStorage pour packages et historique
  pages/
    Dashboard.tsx  — loader initial, appel fetchAccounts
    ContainersPage.tsx — sélection compte + containers, combobox, tri
    PackagesPage.tsx   — éditeur GTM-like (tabs + drawer)
    DeployPage.tsx     — workflow diff → matrix → deploy
    HistoryPage.tsx    — historique des déploiements
  store/
    auth-store.ts  — accessToken, user
    gtm-store.ts   — accounts, containers, packages, diffs, deploy
  types/
    gtm.ts         — tous les types GTM + DeploymentPackage + DiffEntity
```

## Patterns clés

**Token optionnel** : `fetchAccounts(token?: string)` — si pas de token, charge `STATIC_ACCOUNTS`. Même pattern pour `selectAccount`. Permet d'utiliser l'app sans GCP OAuth.

**Fallback statique** : `gtm-static.ts` contient les vraies données récupérées via MCP GTM. Temporaire jusqu'à GCP OAuth.

**Storage** : packages et historique dans localStorage via `src/lib/storage.ts`. Pas de backend.

Voir [[auth-strategy]] pour le plan OAuth. Voir [[deployment-flow]] pour le workflow complet.
