# EventsPage — dashboard drill-down (2026-07-06)

Route `/dashboard/events` (`src/pages/EventsPage.tsx`, 826 lignes).

## Principe

Score de complétude par event GA4, calculé via `computeEventChain` (`src/lib/event-chain.ts`), pour chaque container sélectionné. Quatre états (`ScoreDots` + `CoverageBar`) :

| Score | Label | Sens |
|-------|-------|------|
| 0 | Absent | le tag pour cet event n'existe pas dans le container |
| 1 | Trigger manquant | tag présent mais pas de déclencheur qui le lie |
| 2 | Variables manquantes | tag + trigger OK, mais des paramètres GA4 attendus (voir [[../src/data/official-params.ts]]) sont absents |
| 3 | Complet | tag + trigger + variables requises toutes présentes |

`resolveTagEventNames` gère les alias — un même event peut porter des noms de tag différents selon le container.

## Drill-down (3 niveaux)

- **Niveau 0** : liste des events, score par container
- **Niveau 1** : clic sur un event → liste des déclencheurs impliqués
- **Niveau 2** : clic sur un déclencheur → liste des variables, avec `actionQueue` pour planifier de lier/créer une variable manquante depuis un container source de référence (une croix retire l'action planifiée)

## Dépendances

- `src/data/official-params.ts` — définitions officielles GA4/Matomo/Piano (required/recommended/optional) utilisées pour déterminer les variables manquantes
- `src/components/events/EventChainDrawer.tsx` — drawer de détail d'un `EventChainStatus` (badges ✓/✗ par étape), accessible depuis `MonitoringPage`

## État

Fonctionne sur données Monitoring (mock ou live selon si `scanMonitoring` a été lancé — voir [[auth-strategy]]). L'exécution réelle des actions de la queue (`actionQueue`) suit le même statut que les autres queues du projet (Retirer/Synchroniser/Renommer) — planification uniquement pour l'instant, pas encore branchée sur une exécution API dédiée.
