# Référence UX/UI — dk-gtm-manager

Ce document fusionne les trois skills UX/UI disponibles pour ce projet en une seule doctrine applicable. **Toute modification UX/UI sur ce projet (nouvelle page, composant, refonte, retouche) doit s'y référer automatiquement — pas besoin de le redemander.**

Les trois skills sources :
- **`ui-ux-design`** (global, `~/.claude/skills/ux-ui-design/`) — principes de design, anti-patterns AI, process, pensé pour des projets marketing/grand public (benchmark concurrentiel, Refero, SEO). Une grande partie ne s'applique pas ici (outil interne B2B, pas de SERP à battre).
- **`ui-ux-pro-max`** (installé en projet, `.claude/skills/ui-ux-pro-max/`, CLI `scripts/search.py`) — checklist systématique de 99 règles UX priorisées (accessibilité, touch/interaction, layout, typo/couleur, animation, formulaires, navigation, charts). Déjà utilisé pour l'audit "chantier UX/UI page par page" (voir `wiki/ux-audit-chantier.md`, terminé 6/6 pages le 2026-07-14).
- **`ux-foundations`** (global, `~/.claude/skills/ux-foundations/`, ajouté le 2026-07-16) — bibliothèque de principes distillés de 9 livres de référence (Krug, Norman, Cooper, Refactoring UI, Yablonski, Greever, Everyday UX, Atomic Design, Weinschenk), + `data/ux-rules.csv` (345 règles filtrables par catégorie/sévérité). Apporte ce que `ui-ux-pro-max` ne couvre pas : le **pourquoi** psychologique/cognitif derrière une règle (utile pour justifier un choix face à Ron ou un futur relecteur), les lois UX nommées (Fitts, Hick, Jakob, Miller, Tesler), et la méthodologie de structuration en design system (Atomic Design — pertinent vu le nombre de composants partagés du projet : Button, Badge, Combobox, EntityDrawer…).

## Ordre de priorité (non négociable)

1. **Charte DK** (`CLAUDE.md`, palette violet `hsl(267 100% 59%)` + jaune + prune, Tailwind v4 via `@theme` dans `src/index.css`) — **toujours** la référence visuelle. Ne jamais laisser `ui-ux-pro-max --design-system` proposer une palette/typo alternative et l'appliquer telle quelle.
2. **`ui-ux-pro-max`** — checklist obligatoire pour tout ce qui est accessibilité/interaction/layout/formulaires/charts. C'est la partie qui s'applique le plus directement à un outil interne dense en données (dashboards, drawers, tableaux).
3. **`ux-foundations`** — à consulter dès qu'une décision structurelle ou de hiérarchie n'est pas tranchée par une simple règle de checklist : navigation/IA du site (`krug-usability.md` + `norman-affordances.md` — directement pertinent pour le chantier structure/nav en cours), design system (`frost-atomic-design.md`), justification d'un choix face à Ron (`greever-communication.md`), ou une loi UX nommée applicable à un cas précis (`yablonski-laws.md`). Utiliser la table de routing par tâche du `SKILL.md` plutôt que de tout charger.
4. **`ux-ui-design`** — seulement les sections génériques transposables à un outil B2B interne : philosophie (§1), typographie/espacement/contraste (§2-4), composants boutons/forms/cards/nav/modales (§6), animations (§7), anti-patterns AI (§8), accessibilité (§10), process avant/pendant/après (§11). **Ignorer** les sections benchmark concurrentiel 3 couches, Refero, banks marketing (§0.5, §1-3 du workflow obligatoire, §9 tendances grand public, §10 références inspirationnelles marketing) — non pertinentes pour un outil interne sans concurrence à dépasser.

## Ce que ça donne concrètement pour dk-gtm-manager

### Ce qui est déjà acquis (audit "chantier" du 2026-07-14, 6/6 pages)
Containers, Packages, Déployer, Monitoring, DataLayer Mapping, Plan de tracking ont chacune été auditées avec la checklist `ui-ux-pro-max` + un passage heuristique manuel (hiérarchie visuelle, densité d'info, action principale vs secondaire, états vides/erreur, accessibilité). Détail complet des corrections dans `wiki/ux-audit-chantier.md`. Point systémique corrigé : **aria-label sur tout bouton icon-only** (13 corrections au total sur l'ensemble des pages).

### Méthode standard pour TOUTE future modification UX/UI (pas seulement un "chantier" ponctuel)
1. **Audit heuristique rapide** avant de coder : hiérarchie visuelle, densité d'info, action principale vs secondaire, état vide/erreur, accessibilité (icon-only sans aria-label en particulier — c'est le bug le plus fréquent trouvé sur ce projet).
2. **Passage `ui-ux-pro-max`** pertinent à la zone touchée : `python .claude/skills/ui-ux-pro-max/scripts/search.py "<mot-clé>" --domain ux` (ou `--domain chart` pour un graphique, `--stack react` pour du spécifique React). Ne jamais lancer `--design-system` pour en tirer une palette — seulement les checklists factuelles (accessibilité, touch, layout, forms, charts, navigation).
3. **Si la décision est structurelle** (nav/IA, design system, arbitrage sans réponse checklist évidente) : charger le(s) fichier(s) `ux-foundations` pertinent(s) via la table de routing de son `SKILL.md` plutôt que deviner.
4. **Respecter la charte DK** (couleurs, composants Button/Badge/Combobox existants — ne pas recréer, cf. `CLAUDE.md`).
5. **Vérification Playwright** sur le golden path + l'état vide/erreur si applicable, avant de considérer que c'est fait.
6. **Journal** : si la modif est significative, entrée dans `JOURNAL.md` comme d'habitude.

### Anti-patterns à surveiller en priorité sur ce projet (fréquence trouvée lors de l'audit initial)
- Bouton icon-only sans `aria-label` — le bug le plus répété (13 occurrences trouvées et corrigées sur 6 pages)
- État vide sans action possible ("cul-de-sac" — ex. `TrackingPlanPage.tsx` avant correction)
- Priorité/statut encodé uniquement par une couleur sans `aria-label`/`role="img"` en complément
- CTA dupliqué avec un vocabulaire incohérent (ex. "Déployer" utilisé à la fois pour "naviguer vers l'étape suivante" et pour "publier réellement" — corrigé sur Containers/Packages)

## Où regarder en premier avant de redemander à l'utilisateur
- Composants déjà existants avant d'en recréer un : `src/components/` (Button, Badge, Combobox, EntityDrawer, DiffView, GA4CoverageMatrix…)
- `wiki/ux-audit-chantier.md` pour l'historique détaillé des corrections déjà faites (éviter de re-proposer un correctif déjà appliqué)
