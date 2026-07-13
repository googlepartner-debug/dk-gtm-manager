# Chantier UX/UI page par page

Démarré le 2026-07-14 à la demande de Ron : un vrai passage dédié par page plutôt qu'un vernis partout d'un coup. Ordre retenu (celui du workflow) : **Containers → Packages → Déployer → Monitoring → DataLayer Mapping → Plan de tracking**.

Méthode par page : audit heuristique (hiérarchie visuelle, densité d'info, action principale vs secondaire, états vides/erreur, accessibilité) → liste de points concrets → Ron choisit lesquels traiter → implémentation + vérification Playwright.

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

## Déployer, Monitoring, DataLayer Mapping, Plan de tracking — à venir

Pas encore commencés. Reprendre dans cet ordre au prochain "go" de Ron sur ce chantier.
