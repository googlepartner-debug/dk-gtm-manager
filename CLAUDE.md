# DK GTM Manager — Instructions Claude Code

Outil interne Digital Keys. Déploiement batch de tags/variables/déclencheurs GTM sur plusieurs containers.  
Stack : React + Vite + TypeScript + Tailwind v4 + Zustand. Projet perso, dissocié de Digital Keys entreprise.

## Contexte rapide

- **GCP OAuth opérationnel depuis le 2026-07-02** (projet GCP `gtm-wbncv54-ngq1n`, `.env.local` avec `VITE_GOOGLE_CLIENT_ID`) — login Google fonctionnel, guards `RequireAuth` sur `/dashboard/*`. `gtm-static.ts` reste le fallback quand pas de token — ne pas casser ce pattern
- **Profils multi-consultants** (`useProfileStore`) : le compte Google `googlepartner@digitalkeys.fr` est partagé entre consultants DK — chaque profil a son propre namespace localStorage (`dk_gtm_monitoring_v1_${profileId}`). Toujours passer par le profil actif, jamais écrire en dur dans `localStorage`
- **Store pattern** : `fetchAccounts(token?: string)` — si pas de token → fallback statique
- **Tailwind v4** : config dans `src/index.css` via `@theme`, pas de `tailwind.config.ts`
- **Types GTM** : tout dans `src/types/gtm.ts` — GTMTag, GTMVariable, GTMTrigger, GTMParameter

## Structure clé

```
src/data/gtm-static.ts        — données statiques (~160 comptes, 47 containers PFS)
src/data/gtm-entity-types.ts  — types d'entités GTM avec définitions de champs
src/data/official-params.ts   — définitions officielles params GA4/Matomo/Piano (EventsPage)
src/data/package-templates.ts — templates de packages prêts à l'emploi (GA4 Ecommerce Standard, etc.)
src/store/gtm-store.ts        — store Zustand principal
src/store/profile-store.ts    — store profils multi-consultants
src/lib/auth.ts                — OAuth Google (scopes GTM + openid email profile)
src/lib/event-chain.ts         — calcul chaîne event → trigger → variables (EventsPage)
src/pages/EventsPage.tsx       — dashboard drill-down score événements (Absent/Trigger manquant/Variables manquantes/Complet)
src/pages/ContextePage.tsx     — analyse container + timeline versions
src/components/diff/          — DiffView + GA4CoverageMatrix
src/components/packages/      — EntityDrawer (drawer GTM-like)
src/components/monitoring/    — 5 onglets (Tags/Déclencheurs/Variables/Paramètres/Nettoyage) + DistributionTab/RecommendationsTab
src/components/events/        — EventChainDrawer
wiki/                         — documentation vivante du projet
JOURNAL.md                    — historique des sessions
```

## Règles de travail

- Ne jamais créer de `tailwind.config.ts` — config dans `index.css`
- Ne jamais casser le pattern token optionnel dans le store (fallback `gtm-static.ts` toujours dispo si pas de token)
- Pas d'emoji dans le code ou les composants
- Composants UI : Button, Badge, Combobox — réutiliser, ne pas recréer
- Après chaque feature significative : ajouter une entrée dans `JOURNAL.md`

## Second-brain (documentation automatique)

Ce projet utilise `/second-brain` pour maintenir `JOURNAL.md` et `wiki/` à jour.  
La skill est définie dans `.claude/commands/second-brain.md`.

<!-- hooks:
SessionStart: /loop 1h /second-brain
-->
