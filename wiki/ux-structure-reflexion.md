# Réflexion structure & user journey (démarrée 2026-07-16)

Discussion en cours avec Ron sur l'architecture de navigation de l'outil — **pas encore figée**, à reprendre avant de coder quoi que ce soit sur la nav. Partie d'une demande de refonte UX/UI ambitieuse ("une UX/UI de malade"), après un premier chantier de correctifs (`wiki/ux-audit-chantier.md`) jugé "hyper léger".

Voir aussi [[project_dkgtm_workflow_vision]] (mémoire) — la vision long terme de Ron (cadrage → implémentation → vérification → reporting) recoupe directement la carte à 4 niveaux ci-dessous.

## Étape 1 — Direction visuelle (traitée, artefacts publiés)

Deux artefacts produits (non encore portés dans le vrai code) :
- v2 : proposition initiale, jugée "trop sage" par Ron
- v3 : hero plein écran animé, maquette d'app en contexte (pas des composants isolés), motion réel (compteurs, pulse, marquee), **couleurs vérifiées en direct sur digitalkeys.fr** via Playwright (`getComputedStyle`, pas une capture devinée) :
  - Violet marque : `#9031ff` → `hsl(268 100% 60%)`
  - Violet CTA plus riche : `#8300e9` → `hsl(274 100% 46%)`
  - Prune profond : `#2c0039` → `hsl(286 100% 11%)` — réservé à UNE bande sombre de clôture, pas au contenu principal (c'est l'erreur corrigée en v3 : la card "47 containers actifs" était trop sombre)
  - Jaune : `#ffc928` → `hsl(45 100% 58%)`
  - Orange (alerte) : `#ffa600` → `hsl(39 100% 50%)` — remplace un orange-brun mal choisi
  - Lilas clair (accent énergie) : `#e3c0ff` → `hsl(273 100% 88%)`

**Prochaine étape si validé** : porter ces tokens dans `index.css` + composants partagés (`Button.tsx`, `Badge.tsx`, `Sidebar.tsx`, `Header.tsx`, un composant Table générique) avec vérification Playwright avant/après — mis en attente le temps de finir la réflexion structure ci-dessous, décidé par Ron le 2026-07-16 ("d'abord un tour structure/parcours").

## Étape 1 — Portage complet dans le code (2026-07-16, suite 3)

Ron a validé v3 ("go v3") puis demandé le "système complet", pas juste les couleurs. Le premier passage (couleur de hover uniquement) était insuffisant — l'artefact HTML de v3 a été relu directement (fichier sauvegardé par le fetch précédent, servi en local via un serveur HTTP temporaire puisque `file://` est bloqué et le navigateur Playwright n'est pas authentifié sur claude.ai) avec `getComputedStyle` sur le vrai DOM rendu, pas une lecture de texte. Ça a révélé un vrai système, pas 3 couleurs :

- **6 couleurs strictement séparées marque/état** ("zéro dilution" — jamais confondre couleur de marque et couleur actionnable) : Violet `hsl(267 100% 59%)` et Prune `hsl(283 100% 11%)` déjà exacts dans le code (aucun changement nécessaire, cohérent avec le fait que le violet de marque avait déjà été sourcé depuis digitalkeys.fr). Signal/Succès/Alerte/Critique en revanche **différents** des tokens existants — teintes et luminosités changées, pas un simple ajustement.
- **Typographie** : hero 104px Manrope 800, h2 44px, JetBrains Mono partout où il y a un identifiant/version/timestamp/nom de variable (jamais utilisé jusqu'ici dans le code, tout était en Manrope).
- **Boutons** : padding 13px/22px, radius 11px, poids 800, transition `transform + box-shadow + background` 0.13s (lift au survol + feedback au clic).
- **Motion** : `pulse` 1.8s sur les statuts en direct (probable partout), `marquee`/`drift` réservés au hero/landing (pas pertinents pour l'app dense).

**Implémenté dans `index.css`** :
- `--color-success` (`hsl(152 62% 30%)`), `--color-warning` (`hsl(38 93% 40%)`), `--color-destructive` (`hsl(357 78% 48%)`) remplacés par les valeurs exactes v3 — cascade automatiquement à `Badge.tsx` (déjà écrit en `bg-success/10 text-success` etc., zéro changement de composant nécessaire) et à tout usage direct des tokens.
- Tokens `--color-score-0/1/2/3` (EventsPage, DistributionTab) réalignés sur les mêmes teintes critique/alerte/succès — sinon l'app aurait eu deux systèmes de rouge/vert différents cohabitant.
- `--font-mono: 'JetBrains Mono', ...` ajouté (import Google Fonts). **Piège Tailwind v4** : le token correct pour hooker l'utilitaire `font-mono` est `--font-mono`, pas `--font-family-mono` (qui n'existe pas comme nom reconnu) — première tentative silencieusement sans effet, corrigée après vérification Playwright (`getComputedStyle` sur un `.font-mono` réel). Une fois corrigé, les **24 fichiers qui utilisaient déjà `font-mono`** dans le code passent automatiquement en JetBrains Mono sans aucune modification — bascule gratuite à l'échelle de l'app.
- `--text-hero` (6.5rem/800/1.02) et `--text-h2` (2.75rem/800/1.1) ajoutés comme tokens Tailwind v4 (`--text-hero--font-weight`, `--text-hero--line-height`). **Pas encore utilisés nulle part** : Tailwind v4 est JIT — un token déclaré dans `@theme` ne génère la classe utilitaire que si elle apparaît littéralement dans un fichier source scanné. Rien dans l'app actuelle n'a de "gros chiffre" de type KPI hero (la carte "47 containers actifs" du mockup v3 est un nouveau composant qui n'existe pas encore) — les tokens sont prêts, l'utilisation viendra avec la construction de ce type de composant, hors scope du portage token-level.
- `.dk-pulse` (keyframe, `prefers-reduced-motion` respecté) et `.dk-lift` (lift + ombre au survol, `prefers-reduced-motion` respecté) ajoutés comme classes utilitaires manuelles (pas de JIT, toujours disponibles).

**Composants mis à jour** : `Button.tsx` — poids `font-extrabold` (800) partout, radius par taille (`sm` → `rounded-md`, `md` → `rounded-lg`, `lg` → `rounded-[11px]` + `px-[22px]`), variantes `primary`/`danger` avec `.dk-lift`. `ContainersPage.tsx` — badge `publicId` passé en `font-mono` (identifiant, cohérent avec la règle v3).

**Vérifié** : `tsc --noEmit` + `oxlint` propres. Playwright : bouton hero landing confirmé `font-weight: 800`, `border-radius: 11px`, `padding-left: 22px` ; `.font-mono` confirmé rendu en JetBrains Mono après correction du nom de token ; `.dk-pulse` confirmé avec la bonne durée/easing.

**Non fait dans cette passe** (scope volontairement limité au langage visuel token-level, pas à la reconstruction de pages) : les nouvelles cartes KPI hero du mockup (`CONTAINERS ACTIFS 47`, etc.) n'existent dans aucune page réelle — c'est une nouvelle UI à construire, pas un token à porter. L'application de `font-mono`/`dk-pulse`/`dk-lift` reste à généraliser au-delà des points déjà couverts (24 usages `font-mono` préexistants + 1 ajouté) si Ron veut une passe de repérage exhaustive des IDs/versions/timestamps encore en Manrope.

## Ré-audit échantillon avec les lentilles ux-foundations (2026-07-16, suite 4)

Ron a demandé de vérifier concrètement si repasser des pages déjà auditées (checklist accessibilité `ui-ux-pro-max`) avec les lentilles `ux-foundations` (hiérarchie visuelle, Hick's Law, Miller's Law, Refactoring UI) révèle des problèmes réels et pas déjà couverts. Un agent a lu `refactoring-ui-visual.md` + `yablonski-laws.md` et analysé `ContainersPage.tsx`, `PackagesPage.tsx`, `MonitoringPage.tsx`, trouvant 3 pistes.

**Vérification manuelle des 3 pistes — aucune ne survit** :
1. *"6 actions sans groupement sur Containers"* — faux à la lecture : le sort toggle est déjà dans son propre bloc bordé segmenté (`ContainersPage.tsx:189-211`), séparé des actions de sélection qui elle-mêmes n'apparaissent que conditionnellement (`selectedCount > 0`). Déjà groupé.
2. *"CTA sans hiérarchie sur Packages"* — faux à la lecture : `Button` sans prop `variant` défaut sur `primary` (violet plein) — "Nouveau package" (`PackagesPage.tsx:361`) est bien le seul en `primary`, les 3 autres sont explicitement `variant="secondary"` ou stylés en secondaire. La hiérarchie visuelle existe déjà.
3. *"Surcharge Miller's Law sur Monitoring (7 onglets + 12-16 catégories)"* — l'agent lui-même l'a présenté comme spéculatif ("risque de dépassement... si"), et les constantes citées (`TAG_CATEGORIES` etc.) ne sont même pas dans le fichier qu'il prétendait analyser (`MonitoringPage.tsx`) — probablement confondu avec un composant enfant, jamais vérifié.

**Conclusion, avec confiance plus haute qu'une simple supposition** : sur cet échantillon de 3 pages, le premier audit checklist-based n'a rien laissé de solide sur la table du point de vue hiérarchie/charge cognitive — les pages avaient déjà, par construction, des groupements et hiérarchies corrects même sans que ce soit nommé explicitement "Hick's Law" ou "Refactoring UI" au moment de l'audit. `ux-foundations` reste utile comme grille de lecture et pour justifier des choix a posteriori (utile face à Ron ou en présentation), mais **ne justifie pas de reprendre le chantier d'audit déjà fait** — il s'applique en avant, pas en rattrapage. Pas d'autre page repassée (échantillon jugé suffisant pour trancher la question).

## Étape 2 — Remise en question de la structure/navigation (en cours)

### Constat de départ
6 des 8 pages actuelles de la sidebar (Containers, Packages, Monitoring, Événements, Historique, Contexte) tournent en réalité sur le même référentiel (config GTM déclarée), juste avec des angles différents. Seules DataLayer Mapping (donnée réelle captée) et Plan de tracking (cadrage métier, croise les deux) sortent de ce référentiel.

### Carte à 4 niveaux (testée sur les 12 pages/onglets, tient bien)

1. **Diagnostiquer + corriger au fil de l'eau** — je vois un trou précis, je le comble sur place, sans quitter l'écran
   - Tags (onglet Monitoring) — créer un tag absent depuis un container référence
   - Événements — queue d'actions pour lier/créer une variable manquante
   - DataLayer Mapping (partiellement) — bouton "Créer dans GTM" quand une variable captée n'a pas d'équivalent GTM

2. **Diagnostiquer, vue d'ensemble** — je comprends l'état global, pas d'action directe ici
   - Paramètres envoyés (onglet Monitoring) — vue agrégée tous-events-ensemble (vs Événements qui est le même diagnostic en drill-down un-event-à-la-fois — **pas redondant, deux niveaux de zoom du même diagnostic**, un lien croisé entre les deux serait utile)
   - Distribution (onglet Monitoring) — quelles régies tierces reçoivent de la donnée via les tags GTM. **Effet "wow" confirmé sur toutes les démos.** Déjà interactif (vérifié avec Ron). Pistes d'amélioration non encore implémentées : volumétrie réelle par régie (30j), détection de doublons (lien possible avec les traces UA de Contexte), comparaison cross-container, "dernière activité" par régie, **export/partage comme livrable client** (piste jugée la plus intéressante commercialement par Ron)
   - Recommandations (onglet Monitoring) — consultée en fin de session, check final avant de considérer que c'est fait
   - Contexte — composition container + traces UA + consent + timeline versions
   - Historique — journal des déploiements ; le rollback attaché n'est ni "fil de l'eau" ni "masse", plutôt une action-filet-de-sécurité unique et lourde de conséquences

3. **Agir en masse** — opération groupée qui touche plusieurs containers d'un coup, plus rare, plus lourd de conséquences
   - Déclencheurs, Variables (onglets Monitoring) — renommage groupé
   - Nettoyage (onglet Monitoring) — suppression d'orphelins
   - Packages, Déployer — construction et publication

4. **Documenter/planifier** — définir une cible métier qui n'existe pas forcément encore dans la réalité GTM/dataLayer
   - Plan de tracking — statuts Planifié/Configuré/Implémenté calculés depuis les deux autres piliers

### Découverte importante — un chaînon manquant, pas juste un problème de rangement
Ron envisage que DataLayer Mapping puisse servir à **créer** des entrées de Plan de tracking (un event/variable réellement capté mais jamais documenté devient une nouvelle entrée du plan — "réalité → plan", complémentaire au sens existant "plan → réalité" où Plan de tracking lit `getEventCoverage()` de DataLayer Mapping pour son statut).

**Vérifié dans le vrai code (2026-07-16, pas dans les PRD)** : cette fonctionnalité **n'existe pas du tout aujourd'hui**.
- `datalayerStore.ts` et `trackingPlanStore.ts` ne s'importent pas mutuellement
- `TrackingPlanPage.tsx` lit `useDatalayerStore` uniquement en lecture (lignes 45, 50, 367, 370, 486) pour `getEventCoverage()` et la liste des clients — aucun appel à `addEvent()`
- Aucune fonction de conversion `DatalayerEvent` → `TrackingPlanEvent`
- Aucun bouton dans les composants de `datalayer-mapping/` qui créerait une entrée de plan

**Conclusion** : ce n'est pas un sujet de réorganisation de nav, c'est une fonctionnalité entière à construire — candidat fort pour la suite, indépendamment de la structure retenue. Noté ici pour ne pas le perdre, pas encore priorisé.

### Statut au 2026-07-16 (fin de session)
Carte à 4 niveaux validée par Ron sur les 12 pages/onglets testés. **Pas encore figée définitivement** — prochaine session : décider si on fige cette carte telle quelle ou si Ron identifie encore un cas limite, puis passer à l'esquisse concrète d'une nouvelle structure de nav (probablement groupée par catégorie plutôt qu'une liste plate de 8 items, sur le modèle des regroupements sidebar observés dans `Dribbble Projects/SKILL.md`). Seulement après ça : reprendre le portage de la direction visuelle v3 dans le vrai code.

Ron doit aussi fournir des références de livres UX/UI à lire (pas encore reçues au moment de la rédaction de cette note).

## Étape 2 — Figée et implémentée (2026-07-16, suite)

Ron a fourni les références de livres UX/UI (`~/.claude/skills/ux-foundations`, 9 livres, déjà intégré comme troisième source dans `wiki/ux-ui-reference.md`). Carte à 4 niveaux figée, traduite en nav groupée à partir des principes de `krug-usability.md` §Navigation (répondre à "quel site/où je suis/que puis-je faire" en un coup d'œil, rester dans 5-7 catégories max, faire correspondre les noms au modèle mental de l'utilisateur).

**Découpage retenu** — 2 groupes après ajustement de Ron (Packages rattaché à Config GTM plutôt qu'un 3e groupe "Publication" dédié — le CTA "Publier" reste de toute façon dans le header, donc un groupe entier pour une seule page était superflu) :
- **Config GTM** — Containers, Monitoring, Événements, Historique, Contexte, Packages (référentiel GTM déclaré : diagnostic, correction, construction)
- **Réalité & Plan** — DataLayer Mapping, Plan de tracking (donnée réellement captée + cadrage métier)

Libellés choisis par Ron parmi 3 propositions (Piloter/Aligner/Déployer, Diagnostiquer/Cadrer/Agir, ou libellés fonctionnels) : **Config GTM / Réalité & Plan**.

**Implémenté** dans `Sidebar.tsx` : `nav` (tableau plat) → `navGroups` (tableau de groupes avec `label` + `items`), rendu avec un header de section (`text-[11px] uppercase tracking-wide text-muted-fg/70`) au-dessus de chaque groupe. Routes inchangées, aucune régression de lien.

**Vérifié** : `tsc --noEmit` et `oxlint` propres. Test visuel via Playwright — pas de vrai token OAuth dispo en headless, donc exposition temporaire de `useAuthStore`/`useProfileStore` sur `window` dans `main.tsx` (retirée immédiatement après vérification, comme lors de l'audit Containers du 2026-07-14). Snapshot confirmé : 3 groupes avec les bons libellés et les bonnes pages dans chacun, aucun lien cassé.

**Prochaine étape** : reprendre le portage de la direction visuelle v3 dans le vrai code (Étape 1, ci-dessus — tokens couleur déjà vérifiés en direct sur digitalkeys.fr, jamais portés dans `index.css`).
