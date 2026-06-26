# Wiki Schema — DK GTM Manager

## Règles de maintenance

- Chaque page wiki couvre UN sujet. Titre = slug en kebab-case.
- Les liens inter-pages utilisent la syntaxe `[[slug]]`.
- `index.md` est la carte de navigation — mettre à jour à chaque nouvelle page.
- `JOURNAL.md` est append-only et immuable — ne jamais modifier les entrées passées.
- Les pages wiki sont synthétiques (décisions, état actuel, pourquoi) — pas de code.

## Sujets à couvrir

- `architecture` — stack, structure des dossiers, patterns clés
- `gtm-data-model` — comment les types GTM (Tag/Variable/Trigger/Parameter) sont modélisés
- `auth-strategy` — état OAuth, fallback statique, roadmap GCP
- `deployment-flow` — workflow complet sélection → diff → déploiement
- `design-system` — charte DK, tokens Tailwind v4, composants UI
- `deferred-features` — features planifiées mais non implémentées

## Quand mettre à jour

À chaque session : vérifier si une décision architecturale a changé, si une feature a été ajoutée, si un bug a été corrigé. Mettre à jour la page concernée et ajouter une entrée dans JOURNAL.md.
