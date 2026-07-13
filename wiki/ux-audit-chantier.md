# Chantier UX/UI page par page

Démarré le 2026-07-14 à la demande de Ron : un vrai passage dédié par page plutôt qu'un vernis partout d'un coup. Ordre retenu (celui du workflow) : **Containers → Packages → Déployer → Monitoring → DataLayer Mapping → Plan de tracking**.

Méthode par page : audit heuristique (hiérarchie visuelle, densité d'info, action principale vs secondaire, états vides/erreur, accessibilité) → liste de points concrets → Ron choisit lesquels traiter → implémentation + vérification Playwright.

**Méthode renforcée depuis le 2026-07-14 (suite)** : le skill `ui-ux-pro-max` (déjà installé dans `.claude/skills/ui-ux-pro-max/`, CLI Python `scripts/search.py`) est utilisé pour chaque page comme grille de relecture systématique — checklist de 99 règles UX priorisées (accessibilité, touch/interaction, layout responsive, typographie/couleur, animation, formulaires, navigation, charts). Les 4 pages déjà auditées (Containers/Packages/Déployer/Monitoring) ont été repassées avec cette grille en plus de l'audit heuristique initial. Important : le skill propose aussi des recommandations génériques de palette/typographie (`--design-system`) — **non utilisées telles quelles**, la charte DK (violet `hsl(267 100% 59%)`, jaune, prune, cf. `CLAUDE.md`) reste la référence ; seule la partie UX/accessibilité/interaction du skill s'applique.

## Passe accessibilité transversale (2026-07-14, via agent Explore + skill ui-ux-pro-max)

Règle "ARIA Labels" (sévérité High dans la checklist du skill) : tout élément interactif dont le seul contenu visible est une icône SVG doit avoir un `aria-label`, sinon il est invisible pour un lecteur d'écran. Un agent a scanné les 4 pages déjà auditées + leurs composants directs (Header, Sidebar, BulkRenameModal, EntityDrawer, DistributionTab, DiffView, GA4CoverageMatrix) — 9 boutons icône-seule trouvés sans `aria-label` (dont 1 faux positif écarté après vérification manuelle : le bouton "Proposer une amélioration" de la sidebar a bien un texte visible, l'agent avait lu seulement le bloc SVG). Un 9ème trouvé manuellement en plus (bouton retour de `PackagesPage.tsx` `PackageEditor`, pas détecté par l'agent). Total : 9 vrais correctifs appliqués (fermer modale/drawer ×5, retour ×2, retirer un renommage ×1, effacer un filtre ×1), tous avec un libellé français cohérent avec le reste de l'app. Vérifié via Playwright que le bouton de fermeture de la modale "Depuis un template" expose bien un nom accessible "Fermer".

## Containers — fait (2026-07-14)

Points traités (Ron a choisi "tout") :
- **Recherche/filtre containers** (`ContainersPage.tsx`) — champ de recherche par nom/ID public, affiché seulement au-delà de 5 containers (pas de bruit pour un petit compte). Compte "X résultat(s) sur Y" au-dessus de la liste filtrée.
- **État "session expirée" repensé** — remplace le petit encart rouge perdu en haut d'une page à 90% vide par un panneau centré pleine largeur (icône cadenas, titre, explication, CTA). Affiche le nom du dernier compte consulté quand disponible (`gtmStore.recentAccountName`, nouveau champ persisté dans `dk_gtm_recent` aux côtés de `accountId`/`containerIds`).
- **Header : séparateur entre profil DK et compte Google** (`Header.tsx`) — la pill de profil (espace de travail DK, plusieurs consultants partagent le même compte Google) et le bloc identité Google se ressemblaient trop visuellement l'un à côté de l'autre. Ajout d'un simple séparateur vertical (`w-px h-6 bg-border`), pas de refonte.
- **Fallback statique clarifié, pas corrigé** — `gtm-static.ts` (fallback sans token documenté dans `CLAUDE.md`) s'est avéré inatteignable en pratique : `RequireAuth` bloque tout `/dashboard/*` tant qu'`accessToken` est vide, donc `fetchAccounts`/`selectAccount` reçoivent toujours un vrai token dès qu'on voit la page. Décision de ne pas toucher au guard (changement de blast radius bien plus large que ce qui était demandé) — documenté dans `CLAUDE.md` comme point en attente d'une décision produit (vrai mode démo sans connexion vs vestige pré-OAuth à assumer).

**CTA "Publier" déplacé dans le header global (2026-07-14, retour utilisateur en cours de session)** — Ron a signalé deux problèmes après le premier passage : le mot "déploiement" dans le CTA de ContainersPage n'est pas approprié (on ne fait que naviguer vers l'étape suivante, rien n'est publié à ce stade), et le badge numérique à côté de "Déployer" dans la sidebar (`Sidebar.tsx`, `isDeploy && selectedCount > 0`) n'a pas sa place — un vrai CTA "Publier" en haut à droite du header global, comme le bouton Submit de GTM, est plus juste. Implémenté : badge retiré de la sidebar, bouton "Aller au déploiement →" retiré de `ContainersPage.tsx` (header ET bloc dupliqué en bas de la liste — gardé uniquement le texte informatif "X containers sélectionnés"), nouveau bouton "Publier [N]" dans `Header.tsx` (toujours visible dès qu'une sélection existe, peu importe la page consultée, navigue vers `/dashboard/deploy`).

**Entrée "Déployer" retirée de la sidebar** — dernier ajustement demandé par Ron : maintenant que "Publier" vit dans le header global, l'entrée `/dashboard/deploy` dans le menu de gauche faisait doublon. Retirée du tableau `nav` de `Sidebar.tsx`. La route `/dashboard/deploy` (`App.tsx`) reste intacte — seul point d'entrée restant : le CTA "Publier" du header.

## Packages — fait (2026-07-14)

Trois bugs réels trouvés (pas des choix de design — corrigés directement) :
- **Badge client vide/cassé** — le template "GA4 Ecommerce Standard" a `client: ''` dans `package-templates.ts`, ce qui affichait un badge violet vide dans la liste. `PackagesPage.tsx` cache maintenant le badge quand `pkg.client` est vide (protège aussi tout futur template dans le même cas).
- **Chemin de fichier qui fuitait dans une description utilisateur** — la carte du template "DataLayer Mapping — Collecteur" affichait littéralement un chemin de code (`src/features/datalayer-mapping/gtm-tag/dl-mapping-sheets-endpoint.gs.js`) dans le texte du picker. Raccourci, renvoie vers le PRD.
- **"+ Nouveau package" créait un package fantôme** — `openNew()` appelait `upsertPackage()` avant même que l'utilisateur ait rien saisi, donc un simple clic suivi d'un retour en arrière laissait un "Package sans nom" persisté dans la liste. Corrigé : le brouillon reste local (`setEditingPkg`) tant qu'aucune vraie modification n'a été faite — `PackageEditor` persiste lui-même dès le premier changement réel (déjà son comportement existant, juste plus déclenché prématurément). Testé via Playwright : clic + retour immédiat → rien dans la liste ; clic + saisie d'un nom + retour → le package apparaît bien.

Un point tranché avec Ron : le bouton "Déployer" sur chaque ligne de package (sélectionne le package + navigue vers `/deploy`) est renommé "Choisir" — même logique que Containers (le mot "déployer" ne doit désigner que l'action réelle de publication), mais gardé comme bouton dédié ici puisqu'il fait une vraie action (sélection du package), contrairement au CTA dupliqué de Containers qui a été supprimé.

## Déployer — fait (2026-07-14)

Deux bugs réels trouvés en injectant le vrai template GA4 Ecommerce Standard dans le store (pas de fausses données — le template existant) et en poussant jusqu'à l'étape "select" du flow :

1. **Faux positifs massifs sur `validatePackage()`** (`lib/package-validation.ts`) — un template sain (GA4 Ecommerce Standard) affichait 15 avertissements "domaine propre à un site" sur des valeurs comme `ecommerce.value`, `ecommerce.shipping`, `ecommerce.tax`, `ecommerce.coupon`. Cause : `DOMAIN_RE` matche n'importe quel `mot.mot`, et la notation pointée des variables dataLayer GA4 a exactement cette forme. Corrigé en exigeant que le dernier segment soit un vrai TLD (`REAL_TLDS`, nouvelle allowlist) avant de considérer que c'est un domaine.
2. **`{{_event}}` signalé comme référence fantôme** — ce n'est pas une variable créée par l'utilisateur, c'est le jeton interne que GTM insère automatiquement comme `arg0` dans toute condition de déclencheur Custom Event. Se déclenchait sur les 5 triggers du template (donc sur quasiment tout package GA4 standard). Corrigé en l'ajoutant à `ALWAYS_VALID_REFS`.

Après les deux corrections : le même template passe de 15 avertissements à 0, comme attendu pour un template déjà validé auparavant (bug pré-existant du 2026-07-13 sur les `firingTriggerId`, voir plus haut dans le journal).

**Point identifié, pas tranché** : "Modifications en attente" (renommages/opérations ad hoc depuis Monitoring) et "Déployer un package" (flow structuré avec diff) cohabitent empilés sur la même page `DeployPage.tsx`, chacun avec son propre CTA "Publier"/"Déployer" — deux modèles mentaux différents sous un seul vocabulaire. Réponse de Ron ambiguë sur la suite à donner — laissé en l'état, à retrancher si le sujet revient.

## Monitoring — fait (2026-07-14)

Page la plus volumineuse du chantier (~7100 lignes cumulées sur `MonitoringPage.tsx` + composants) — audit avec le vrai container de test (`seedTestContainer()`), en parcourant les 7 onglets (Tags/Déclencheurs/Variables/Paramètres envoyés/Distribution/Nettoyage/Recommandations).

Un bug réel trouvé et corrigé : **libellé dupliqué dans l'onglet Distribution** (`DistributionTab.tsx`) — un nœud "GA4 — Configuration" avec plusieurs events groupés dessous affichait "GA4" deux fois d'affilée (le badge plateforme en petit, puis le nom du tag juste en dessous, retombé sur `cfg.platform` par le fallback de regroupement ligne ~486 qui donne délibérément un libellé générique quand plusieurs tags/events sont fusionnés dans un même nœud). Corrigé en cachant la seconde ligne quand elle est strictement identique au badge du dessus, sans toucher à la logique de regroupement elle-même (qui a sa propre justification documentée en commentaire).

Le reste (Paramètres envoyés — matrice spec officielle GA4, Nettoyage — détection orphelins, Recommandations — règles Google Ads/GA4/Piano/Matomo) vérifié fonctionnel, pas de bug trouvé. Les 2 variables orphelines détectées (`DLV - ecommerce`, `DLV - event`) reflètent une incohérence dans les données du container de test lui-même (`test-container-mock.ts` déclare ces deux variables mais les tags référencent en fait `DLV - ecommerce.transaction_id` etc.) — comportement correct de l'outil, pas un bug, pas corrigé (tangent à l'audit UX, pas de conséquence utilisateur réelle).

## DataLayer Mapping, Plan de tracking — fait (2026-07-14)

Cinquième et sixième pages, auditées avec la méthode renforcée (skill `ui-ux-pro-max` + agent Explore dédié pour le scan aria-label) dès le départ.

**Aria-label** — 4 boutons icône-seule trouvés sans `aria-label` sur `DatalayerKanbanPage.tsx` (retirer une étape du Focus Mode), `VariableDrillDown.tsx` (retour, avait déjà un `title` mais pas d'`aria-label`), `EventDetailDrawer.tsx` (fermer le tiroir — aucune mitigation du tout), `TrackingPlanPage.tsx` (supprimer un screenshot, avait déjà un `title`). Tous corrigés.

**Cul-de-sac réel trouvé et corrigé sur Plan de tracking** — `TrackingPlanPage.tsx` affichait un simple texte "Sélectionne un client." sans aucune action possible quand `activeClientId` est vide, ce qui arrive systématiquement sur un profil neuf n'ayant jamais visité DataLayer Mapping avant (rien n'auto-charge de client depuis cette page). Contrairement au même message sur `DatalayerKanbanPage.tsx` (celui-là reste inoffensif : le vrai sélecteur client/site de `DataLayerMappingPage.tsx` est toujours visible juste au-dessus, et cette page a son propre effet `loadMockData()` au montage), ici c'était un vrai cul-de-sac. Remplacé par un état vide avec deux actions : "Aller choisir un client →" (renvoie vers DataLayer Mapping) et, si aucun client n'existe nulle part, "Charger un container de test" directement inline. Testé via Playwright avec un profil 100% vierge : la page était auparavant bloquée avec un simple texte, elle propose maintenant un vrai déblocage en un clic.

**Priorité en couleur seule, sans alternative accessible** — les cartes d'event en Vue Business (`TrackingPlanPage.tsx`) affichaient la priorité uniquement via un point coloré avec un `title` en fallback (non fiable pour les lecteurs d'écran). Ajouté `role="img"` + `aria-label` explicite ("Priorité : critique" etc.), sans changer le rendu visuel (le point reste discret, cohérent avec la densité voulue de cette vue).

## Statut : chantier terminé (6/6 pages)

Containers → Packages → Déployer → Monitoring → DataLayer Mapping → Plan de tracking, toutes auditées et corrigées. Deux points laissés volontairement ouverts pour une décision produit future de Ron : le fallback statique sans connexion (Containers, §CLAUDE.md) et la cohabitation "Modifications en attente"/"Déployer un package" sur une même page (Déployer).
