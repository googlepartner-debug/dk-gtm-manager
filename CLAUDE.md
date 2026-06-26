# DK GTM Manager — Instructions Claude Code

Outil interne Digital Keys. Déploiement batch de tags/variables/déclencheurs GTM sur plusieurs containers.  
Stack : React + Vite + TypeScript + Tailwind v4 + Zustand. Projet perso, dissocié de Digital Keys entreprise.

## Contexte rapide

- **Pas de GCP OAuth pour l'instant** — toutes les features fonctionnent avec `gtm-static.ts` (données statiques réelles)
- **Store pattern** : `fetchAccounts(token?: string)` — si pas de token → fallback statique
- **Tailwind v4** : config dans `src/index.css` via `@theme`, pas de `tailwind.config.ts`
- **Types GTM** : tout dans `src/types/gtm.ts` — GTMTag, GTMVariable, GTMTrigger, GTMParameter

## Structure clé

```
src/data/gtm-static.ts        — données statiques (~160 comptes, 47 containers PFS)
src/data/gtm-entity-types.ts  — types d'entités GTM avec définitions de champs
src/store/gtm-store.ts        — store Zustand principal
src/components/diff/          — DiffView + GA4CoverageMatrix
src/components/packages/      — EntityDrawer (drawer GTM-like)
wiki/                         — documentation vivante du projet
JOURNAL.md                    — historique des sessions
```

## Règles de travail

- Ne jamais créer de `tailwind.config.ts` — config dans `index.css`
- Ne jamais ajouter de mock OAuth ou de `VITE_GOOGLE_CLIENT_ID` sans demande explicite
- Conserver le pattern token optionnel dans le store
- Pas d'emoji dans le code ou les composants
- Composants UI : Button, Badge, Combobox — réutiliser, ne pas recréer
- Après chaque feature significative : ajouter une entrée dans `JOURNAL.md`

## Second-brain (documentation automatique)

Ce projet utilise `/second-brain` pour maintenir `JOURNAL.md` et `wiki/` à jour.  
La skill est définie dans `.claude/commands/second-brain.md`.

<!-- hooks:
SessionStart: /loop 1h /second-brain
-->
