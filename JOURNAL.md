# Journal — DK GTM Manager

Outil interne Digital Keys. Déploiement batch de tags/variables/déclencheurs GTM sur plusieurs containers simultanément. Projet perso dissocié de l'entité Digital Keys.

---

## 2026-06-25

**Bootstrap du projet**

Initialisation du projet React+Vite+TypeScript+Tailwind v4+Zustand. Charte DK appliquée (Manrope, violet `hsl(267 100% 59%)`, yellow, prune). PRD v1.4 défini.

Stack retenue : SPA frontend only, pas de backend. GCP OAuth prévu mais pas encore configuré — toutes les features doivent fonctionner sans token.

**Données statiques GTM**

Création de `src/data/gtm-static.ts` avec les vraies données MCP : ~160 comptes GTM, 47 containers PerfectStay. Le store Zustand charge ces données quand `accessToken` est null (fallback statique). Quand OAuth sera configuré, le même store bascule automatiquement sur l'API live.

**Combobox recherchable**

Remplacement du `<select>` natif pour la sélection de compte par un composant `Combobox` custom : input de recherche filtré, click-outside handler, compteur de résultats. 160 comptes navigables sans scroll aveugle.

**Tri containers par dernière publication**

Ajout d'un toggle "Dernière publication / A–Z" sur la page Containers. Tri par fingerprint GTM (timestamp Unix ms). Important : le fingerprint ne se met à jour qu'à la publication d'une version, pas aux édits workspace — libellé corrigé de "Modifié" → "Publié" pour refléter la réalité.

---

## 2026-06-26

**Éditeur de packages GTM-like**

Refonte complète de PackagesPage. Avant : textarea JSON brut. Après : interface calquée sur GTM avec :
- Tabs Tags / Variables / Déclencheurs
- Liste d'entités avec icônes de type, badges de statut, actions hover (éditer/supprimer)
- Drawer slide-in depuis la droite (pattern GTM) avec :
  - Sélection de type en grille groupée par catégorie (si nouvelle entité)
  - Champs typés par type d'entité (text, textarea monospace, boolean toggle, select, params-list)
  - Section Déclenchement pour les tags (checkboxes depuis les triggers du package)
- Import/export JSON conservé pour power users

Types supportés : GA4 Event, HTML custom, Google Ads Conversion, Floodlight, Image pixel / DL Variable, Constante, Custom JS, URL, Cookie, Auto-Event / Page Vue, DOM Ready, Window Loaded, Custom Event, Clic, Liens, Scroll Depth.

Helpers `paramsToForm` / `formToParams` pour la conversion bidirectionnelle GTMParameter ↔ formulaire.

**Filtre GA4 cross-containers dans DiffView**

Barre de chips par `event_name` au-dessus des panels de diff. Filtre tous les containers simultanément sur l'event_name (lit le paramètre GTM, indépendant du nom du tag). Containers sans match grisés à 30%. Bouton "Sélectionner les X correspondances" par panel.

**Notes d'écarts de couverture**

Panneau warning dans DiffView listant les entités présentes dans certains containers mais absentes d'autres (new vs unchanged/modified). Affiché seulement avec ≥2 containers. Identifie les incohérences de couverture avant déploiement.

**Matrice de couverture GA4**

Nouveau composant `GA4CoverageMatrix` intégré dans la page Déployer (toggle Entités | Couverture GA4) :
- Tableau matrix : lignes = event_names, colonnes = containers sélectionnés
- Cellules colorées : vert (présent), orange (à mettre à jour), rouge (absent), gris (hors package)
- Score de couverture global en %
- Bouton "Sélectionner X absents" pour cocher tous les tags manquants d'un clic
- Clic sur cellule rouge = sélection directe du tag pour déploiement

**Intégration second-brain**

Création de `.second-brain.json` à la racine. Init git du projet. Plugin marketplace `second-brain@digitalkeys` non disponible — câblage manuel via `.claude/commands/second-brain.md` + `CLAUDE.md` + cron horaire à `:23`. Push changelog désactivé (`pushEnabled: false`) sur décision explicite — second-brain local uniquement.

---

## 2026-06-26 (suite)

**Contrainte identifiée : filtre GA4 sans OAuth**

Le filtre event_name dans DiffView (chips) n'est pas utilisable sans GCP OAuth car il n'y a pas de données de tags réels dans les containers — uniquement ce qui est dans le package. Deux améliorations décidées :
1. Barre de recherche event_name dans PackagesPage — filtre les tags du package par event_name (fonctionne sans OAuth)
2. Remplacement des chips par un input texte dans DiffView — meilleure UX quand OAuth sera disponible

La matrice de couverture GA4 et le filtre DiffView restent dépendants de l'OAuth pour avoir de la vraie donnée container.

---

## 2026-06-26 (suite 2) — Page Monitoring complète

**Correctif navigation Zustand**

Bug identifié : `window.location.assign()` dans ContainersPage et PackagesPage provoquait un rechargement complet de la page, réinitialisant tout le store Zustand. Les containers sélectionnés disparaissaient en arrivant sur DeployPage. Corrigé par remplacement avec `useNavigate` de React Router — navigation SPA sans rechargement.

Second correctif : la barre de recherche dans PackagesPage était conditionnée à `currentList.length > 0`, la rendant invisible sur un package vide. Condition supprimée.

**Page Monitoring — Matrice de couverture**

Nouvelle page `/dashboard/monitoring` avec matrice cross-containers. Principe : colonnes = containers sélectionnés (mock : Turkish, Air France, Corsair, Iberia, Swiss), lignes = entités, cellules = présent/absent coloré.

Quatre onglets :
- **Tags** : filtrable par catégorie (GA4, Kameleoon, Google Ads, Meta Pixel, TikTok, Hotjar, AB Tasty, Floodlight, HTML Custom). La rowKey des events GA4 est l'`event_name` (ex : `add_to_cart`) indépendamment du nom du tag, permettant de détecter les noms variés entre containers.
- **Déclencheurs** : même matrice par type (pageview, customEvent, click, scrollDepth…)
- **Variables** : même matrice par type (v, c, jsm, u, k, aev)
- **Paramètres envoyés** : onglet dédié aux events GA4 — sélecteur d'event en chips (default : purchase), matrice paramètre × container. Cellules : vert = valeur identique partout, orange = valeurs différentes entre containers, rouge = paramètre absent du tag, gris = tag absent du container.

Badge "noms variés" sur les lignes où le même event est tracké sous des noms différents selon les containers.

**Renommage groupé**

Clic sur une ligne Tags/Déclencheurs → drawer de renommage. Affiche le nom actuel dans chaque container, pré-sélectionne les containers à corriger (ceux dont le nom diffère de la cible). Le nom cible est pré-rempli avec le nom le plus fréquent. Les opérations sont empilées dans une queue Zustand (`pendingRenames: RenameOperation[]`) et visualisables dans un panneau latéral. Bouton "Appliquer" désactivé avec tooltip "GCP OAuth requis".

**Comparaison de contenu variables**

Clic sur une ligne Variables → nouveau drawer de comparaison de contenu (pas de renommage direct). Affiche le contenu de la variable dans chaque container, adapté au type :
- `jsm` (Custom JS) : bloc de code dark avec diff ligne par ligne (+/−) entre le contenu de référence et les variantes
- `c` (Constante) : valeur affichée inline (ex : EUR vs CHF)
- `v` (Data Layer) : chemin DL comparé
- `u`, `k` : composant URL / nom de cookie

Le drawer a un bouton "Renommer" pour standardiser les noms si nécessaire (contrainte : la comparaison ne fonctionne que si les variables portent exactement le même nom dans tous les containers).

**Données mock**

Fichier `src/data/monitoring-mock.ts` avec 5 containers réalistes (Turkish Airlines, Air France, Corsair, Iberia, Swiss) et des écarts intentionnels : currency hardcodée (`'EUR'`) chez Air France vs variable chez les autres, `item_country` présent dans `JS - ecommerce.items` chez TK et SWI mais absent chez COR, différences de nommage de variables (`Constante - GA4 ID` vs `Var - GA4 ID`), `Constante - Currency` = CHF chez Swiss vs EUR ailleurs.

---

## 2026-06-26 (suite 3) — TagDrawer unifié + actions déclencheurs

**Comparaison déclencheurs — sémantique, pas par nom**

La section de comparaison de déclencheurs initialement construite dans l'onglet "Paramètres envoyés" a été déplacée dans l'onglet Tags du TagDrawer. Décision UX : les déclencheurs concernent le tag, pas ses paramètres.

La comparaison est sémantique : deux déclencheurs sont considérés équivalents s'ils ont le même type et les mêmes conditions (clé `type::condition`), indépendamment de leur nom. Exemples : `DL - purchase` (Turkish) et `Custom Event - purchase` (Swiss) → même clé `customEvent::purchase` → identiques. Un `pageview` est identifié uniquement par son type (pas de conditions à comparer).

**TagDrawer unifié — 2 onglets**

`RenameDrawer` et `TagDetailDrawer` fusionnés en un seul composant `TagDrawer` avec deux onglets :
- **Déclencheurs** : cards par container avec liste des triggers liés, indicateur de cohérence (vert / rouge), point rouge sur l'onglet si incohérence détectée
- **Renommer** : formulaire de renommage groupé identique à l'ancien RenameDrawer

Badge "déclencheurs variés" ajouté dans la matrice de couverture Tags (à côté de "noms variés") — affiché si au moins deux containers ont des déclencheurs sémantiquement différents pour le même tag.

**PRD actions déclencheurs**

Document `PRD_TriggerActions.md` (v1.1) définissant deux actions à implémenter depuis l'onglet Déclencheurs du TagDrawer :
1. **Retirer** — retirer un trigger spécifique d'un tag dans un container donné
2. **Synchroniser** — aligner les déclencheurs d'un container sur ceux d'un container de référence (mode Remplacer : le container cible finit identique à la référence)

Décisions clés validées : Synchroniser = mode remplacement complet (pas d'ajout seul), détection des triggers sémantiquement équivalents avant création (pour éviter les doublons), deux panneaux séparés dans le header (renommages vs actions déclencheurs).

**Action Retirer — implémentée**

Première action du PRD déployée. Fonctionnement :
- Bouton `[Retirer]` visible au survol de chaque ligne trigger dans les cards de l'onglet Déclencheurs
- Clic → queues une `TriggerOperation` de kind `'remove'` dans le store Zustand (`pendingTriggerOps[]`)
- Si c'est le dernier trigger du tag dans ce container : modal de confirmation "Dernier déclencheur — ce tag sera désactivé"
- Déduplication : si l'opération est déjà planifiée pour ce tag + container + trigger, la ligne affiche le badge `Planifié` (orange) au lieu du bouton
- Badge dans le header MonitoringPage : "X action(s) déclencheur(s)" en rouge, visible dès qu'une opération est en queue

Nouveau type `TriggerOperation` dans `src/types/gtm.ts` avec steps `TriggerOpStep[]` modélisant chaque container impacté (unlink/linkExisting/createAndLink). Actions store : `addTriggerOp`, `removeTriggerOp`, `clearTriggerOps`.

L'exécution réelle (PUT sur le tag via API GTM) reste bloquée jusqu'à GCP OAuth — seule la planification est disponible.

---

## 2026-06-26 (suite 4) — Synchroniser, feedback visuel queue, correctifs

**Action Synchroniser — implémentée**

Deuxième action du PRD déployée depuis l'onglet Déclencheurs du TagDrawer. Accessible via le bouton orange "Synchroniser depuis une référence" (affiché uniquement si incohérence détectée).

Flow : sélecteur de container de référence (radio buttons avec liste de ses triggers) → aperçu par container cible avec diff en trois couleurs :
- Rouge `−` : trigger à retirer (présent dans le cible, absent de la référence)
- Bleu `~` : trigger à lier depuis l'existant (équivalent sémantique trouvé dans le container cible)
- Vert `+` : trigger à créer et lier (aucun équivalent sémantique dans le cible)

Checkboxes par container cible (auto-cochées sur les containers "à synchroniser"). Bouton "Planifier N synchronisation(s)" → queues une `TriggerOperation { kind: 'sync', steps: [...] }` avec toutes les cibles sélectionnées en un seul objet.

**Feedback visuel en temps réel dans le drawer**

Après planification d'une opération (remove ou sync), le drawer reflète immédiatement l'état futur :
- Retrait planifié : trigger barré, badge rouge "à retirer", opacité réduite — bouton Retirer masqué
- Sync planifiée : card header passe en orange avec badge "Sync planifiée", triggers à retirer barrés, nouvelles lignes vertes "à lier" / "à créer" ajoutées sous la liste existante
- Badge `Planifié ×` cliquable pour annuler un retrait individuel

**Panneau "Actions déclencheurs" (slide-in droite)**

Bouton dans le header MonitoringPage (rouge, visible si ops en queue) → drawer liste toutes les `TriggerOperation` pendantes : type (Retrait/Sync), tag, containers impactés avec détail des steps. Bouton × par opération, "Tout effacer", "Appliquer (OAuth requis)" désactivé.

**Correctifs**

- Drawer TagDrawer : `position: relative` dans le style inline écrasait le `fixed` de Tailwind → drawer s'insérais dans le flux DOM au lieu de se superposer. Supprimé.
- Triggers pageview colorés en rouge pour tous les tags sans exception → remplacé par `isSuspiciousPageview` (rouge uniquement si pageview coexiste avec d'autres triggers dans le même container).
- `onSync` déclaré dans le type TypeScript de TriggersTab mais absent du destructuring → TypeError à l'appel, page blanche. Corrigé.

---

## 2026-06-26 (suite 5) — Historique ops, Nettoyage, icônes, correctifs UX

**Historique des opérations dans le panneau "Actions déclencheurs"**

Le panneau affiche maintenant toutes les ops (pas seulement les pendantes). Le × dans le panneau annule (status → `cancelled`) au lieu de supprimer — les ops restent visibles en historique. Section "En attente" + section "Historique" (ops annulées grises, ops effectuées vertes). Bouton "Effacer" pour nettoyer l'historique. Le bouton header reste visible en gris même quand tout est annulé ("Historique déclencheurs"). Nouveau store action `cancelTriggerOp`.

**Onglet Nettoyage (5ème onglet Monitoring)**

Détecte les entités GTM orphelines (0 références) par container :
- **Triggers orphelins** : non référencés dans aucun `firingTriggerId` / `blockingTriggerId` de tag
- **Variables orphelines** : `{{nom}}` introuvable dans tous les paramètres (tags + triggers + variables, récursif sur list/map)

UI : sections Déclencheurs / Variables, groupement par container, checkboxes + "Planifier la suppression de N entités", historique des suppressions avec "Annuler" et "Appliquer (OAuth requis)". Badge count dans l'onglet. Nouveau type `DeletionOperation` + actions store `addDeletions` / `cancelDeletion` / `removeDeletion` / `clearDeletions`.

**Icônes SVG types de tag**

`TagTypeIcon.tsx` créé — cercles SVG colorés (brand colors) avec symboles blancs pour GA4, Google Ads, Floodlight, Kameleoon, AB Tasty, Meta Pixel, TikTok, Hotjar, HTML Custom. Affichés dans les en-têtes de groupe de la matrice (onglet Tags). Tentative d'extraction des vraies icônes GTM depuis le tag type picker (base64 SVGs dans `data-ng-src`) — liste virtualisée Angular, accès scope incomplet, non résolu. Icônes SVG maison conservées.

**Correctifs UX**

- Onglet Nettoyage : barre de catégories masquée (elle affichait `jsm, u, k` de l'onglet Variables précédent). `matrixKind` corrigé pour éviter `'cleaning'` comme kind de matrix.
- SyncPlanView sort order : containers "À synchroniser" en haut, "Déjà identique" avant-dernier, "Tag absent" tout en bas. Tri basé sur `status` du diff, pas sur le booléen global `consistent`.

---

## 2026-07-01 — Logo DK, renommage containers, Trigger Groups, Contexte

**Logo DK GTM Manager**

Composant `DKGTMLogo` SVG pur (pas d'image) : "DK" en violet `#9031ff` + "GTM" + sous-titre "MANAGER" optionnel. Trois tailles (sm/md/lg), deux variantes (dark/light pour fond sombre et sidebar). Logo intégré dans la sidebar (avec produit "MANAGER"), dans la header bar (compact, sans sous-titre), et dans la landing page DKrypt-style (grande taille, variant dark, avec subtitle).

La landing page a été refaite dans le style de DKrypt : fond très sombre, pills de features, carte preview fake à droite, badge "LE LAB" carreaux violet+jaune en footer.

**Renommage bulk containers et comptes**

Nouveau flux depuis ContainersPage : quand des containers sont sélectionnés, bouton "Renommer" apparaît. Ouvre `BulkRenameModal` avec deux modes :
- **Nomenclature** (défaut) : pattern avec 6 tokens `{name}`, `{publicId}`, `{client}`, `{env}`, `{lang}`, `{type}`. Champs custom renseignables, aperçu en temps réel avec override manuel par ligne. Option "Inclure le compte" pour renommer aussi l'account parent.
- **Rechercher / Remplacer** : remplacement textuel simple dans le nom existant.

Les opérations sont empilées en queue Zustand (`ContainerRenameOperation[]`) avec statut pending/applied/cancelled. Panneau plan en bas de page. Exécution réelle désactivée jusqu'à GCP OAuth.

**Trigger Groups (tgg)**

Nouveau type de déclencheur "Groupe de déclencheurs" dans le package builder. Se déclenche quand TOUS les déclencheurs sélectionnés ont été activés sur la même page. Dans `EntityDrawer`, ce type expose un champ `trigger-ids-list` : multi-select des triggers existants du package (excluant les autres tgg). Les noms sont stockés dans les paramètres GTM (résolution en IDs réels au moment du déploiement via l'API).

**Cellule absente → Créer**

Dans la matrice Monitoring (onglet Tags), hovering une cellule "Absent" change l'icône × en + et le label → "Créer". Clic ouvre un `QuickCreatePanel` : tag identifié, container cible, sélecteur de package, bouton "Ajouter au package" → crée un tag stub dans le package. L'utilisateur configure paramètres et déclencheurs ensuite dans PackagesPage.

**Publication — nom sans date, avec description**

Le nom de version auto-généré au déploiement est maintenant simplement le nom du package (pas de date — GTM l'affiche déjà). Un champ description est ajouté sous le nom ; si laissé vide, une description structurée est générée automatiquement (`DK GTM Manager · Package: X · N entités sur M containers`).

**Page Contexte**

Nouvelle route `/dashboard/contexte` avec entrée dans la sidebar. Deux onglets :
- **Analyse container** : sélecteur de container (parmi les 5 du mock), sections structurées sans grand texte — tags par catégorie avec barres de proportion, variables par type, déclencheurs, events dataLayer détectés, signaux de maturité (Consent Mode, lifetime GA4, Enhanced Conversions).
- **Timeline des versions** : 12 versions mock sur une timeline verticale, badges colorés par technologie, avec détection sémantique d'événements (implémentation Consent Mode, migration GA4, Google Ads, Piano Analytics, Floodlight).

---

## 2026-07-02 — GCP OAuth opérationnel

**Projet GCP**

Réutilisation du projet GCP `gtm-wbncv54-ngq1n` (renommé "LAB - DK GTM Manager"). Tag Manager API v2 activée. Écran de consentement OAuth configuré (externe, scopes tagmanager). Client ID OAuth créé pour Application Web avec origine `http://localhost:5173`.

**Câblage OAuth dans l'app**

- `.env.local` : `VITE_GOOGLE_CLIENT_ID` renseigné avec le vrai Client ID GCP
- `src/lib/auth.ts` : ajout des scopes `openid email profile` aux scopes GTM (nécessaire pour `fetchUserInfo` sur l'endpoint userinfo Google)
- `src/pages/Landing.tsx` : bouton branché sur `useAuthStore.login()` + feedback état chargement + affichage erreur
- `src/App.tsx` : guards de route `RequireAuth` ajoutés — `/dashboard/*` redirige vers `/` si non connecté, `/` redirige vers `/dashboard/containers` si déjà connecté

Le flow complet fonctionne : popup Google → scopes GTM → token → userinfo → dashboard. La déconnexion redirige automatiquement vers la landing via le guard.

---

## 2026-07-02 (suite) — Profils, nettoyage GTM live, UX monitoring

**Profils multi-consultants**

Problème : `googlepartner@digitalkeys.fr` est un compte Google partagé entre tous les consultants DK. Sans isolation, toutes les modifications (suppressions planifiées, containers scannés) seraient mélangées.

Solution : système de profils nommés. Au premier lancement, l'utilisateur crée son profil (Ron, Tim, Juh, etc.) et y accède à chaque session. Chaque profil a son propre namespace dans localStorage (`dk_gtm_monitoring_v1_${profileId}`). Store dédié `useProfileStore` dans `src/store/profile-store.ts`. Page `/profile` pour créer/sélectionner/supprimer des profils avec codes couleurs. Le profil actif est affiché en pill colorée dans le header, cliquable pour changer d'espace de travail.

Migration one-shot : au premier lancement après update, les données existantes (sans profil) sont migrées vers le profil par défaut.

**Nettoyage GTM — fix historique et erreurs de publication silencieuses**

Deux bugs dans le flow `applyDeletions` :

1. **Historique manquant** : `saveDeploymentRecord` n'était jamais appelé. Corrigé en construisant un `DeploymentResult[]` par container affecté (avec steps DELETE → createVersion → publishVersion) et en appelant `saveDeploymentRecord` + `set({ history: loadHistory() })` à la fin.

2. **Erreurs silencieuses** : `createVersion` et `publishVersion` échouaient sans notification visible (seulement `console.error`). Ajout de `applyPublishErrors: { containerName: string; error: string }[]` dans le store. Après apply, si des containers ont échoué, une notification rouge liste les noms + le premier message d'erreur (tronqué à 120 chars). L'utilisateur voit désormais "GTM API 403: …" au lieu de rien.

**Photo de profil Google**

Google CDN (`lh3.googleusercontent.com`) bloque les requêtes avec un header `Referer` — la photo apparaissait cassée. Fix : `referrerPolicy="no-referrer"` sur la balise `<img>` + fallback `onError` qui masque l'image et affiche l'initiale en dégradé violet si chargement échoue.

**Filtre containers dans le monitoring**

Ajout d'un dropdown multi-select "Containers (N/N) ▾" dans le header de MonitoringPage (avant le bouton Exporter). Active sur tous les onglets (état `hiddenIds: Set<string>` partagé). Fonctionnalités :
- Shortcuts "Tous" et "1 seul" (garde uniquement le container cliqué)
- Checkbox par container (nom + publicId)
- Dernier container actif ne peut pas être désélectionné (guard `isLast`)
- Bouton violet quand des containers sont masqués, gris sinon
- Click-outside ferme le dropdown (useRef + useEffect)

La demande initiale de chips dans le header a été rejetée — remplacée par ce dropdown.

**Onglet Nettoyage — améliorations UX**

- Bouton "Supprimer et publier (N)" ajouté **en haut** de l'onglet (en plus du bas) — accessible sans scroller
- Libellé changé de "Appliquer (N)" → "Supprimer et publier (N)" partout
- Modal de confirmation entièrement redessinée (640px, maxHeight 88vh) :
  - Header : pills containers (nom + publicId + badge `−N` rouge)
  - Corps : tableau unifié groupé par container — colonnes Type (badge couleur) / Nom (mono, tronqué) / Action ("Supprimé" badge rouge), alternance de fond par groupe
  - Champs pré-remplis : nom de version auto-généré (`Nettoyage — N variables, M déclencheurs — DD mois YYYY`) et description (une ligne par container avec liste des entités)
  - Modifiables avant confirmation
  - Footer : résumé comptage + Annuler + "Supprimer et publier" (désactivé si nom vide)

---

## 2026-07-03 — Correctif dates "il y a 56 ans" dans ContainersPage

**Bug fingerprint GTM — mauvaise conversion d'unité**

`ContainersPage` affichait "Publié il y a 56 ans" pour tous les containers. Cause : le store convertissait le `fingerprint` GTM (timestamp Unix en **secondes**, 10 chiffres, ex. `1750123456`) en millisecondes en le **divisant par 1 000 000** au lieu de le **multiplier par 1 000**.

`1750123456 / 1_000_000 = 1750 ms` → `new Date(1750)` = 1er janvier 1970 → "56 ans" ✓

Certains fingerprints GTM peuvent être en nanosecondes (19 chiffres, > 1e15). Fix : détection par magnitude :
```ts
const ms = raw > 1e15 ? raw / 1_000_000 : raw * 1_000;
```

Corrigé dans `src/store/gtm-store.ts` ligne de la boucle d'enrichissement des dates de publication.

---

## 2026-07-06 — EventsPage, ContextePage timeline, Distribution/Recommendations, templates

**Page Events — dashboard drill-down par score**

Nouvelle route `/dashboard/events` (826 lignes). Vue matricielle avec trois niveaux de drill-down :
- **Niveau 0** : liste des events GA4 avec score visuel (`ScoreDots` + `CoverageBar`) sur 4 états — Absent / Trigger manquant / Variables manquantes / Complet — calculés par container via `computeEventChain` (`src/lib/event-chain.ts`, résout aussi les alias de nom d'event avec `resolveTagEventNames`)
- **Niveau 1** : clic sur un event → détail par déclencheur
- **Niveau 2** : clic sur un déclencheur → détail par variable, avec queue d'actions (`actionQueue`) pour lier/créer des variables manquantes depuis un autre container source (croix rouge pour retirer une action planifiée)

Légende de couleur par score en pied de page, adaptée selon le niveau de drill affiché.

**ContextePage — timeline enrichie**

Page Contexte étoffée (498 lignes) : onglet Timeline avec 12 versions mock (`MOCK_VERSIONS`) allant de "Création du container" (2022) à "Consent Mode v2" (2024), classification technologique par tags (GA4, Google Ads, Floodlight, Piano, OneTrust...). Onglet Analyse container inchangé dans son principe (comptages tags/variables/déclencheurs par catégorie).

**Onglet Distribution (Monitoring)**

`DistributionTab.tsx` (617 lignes) : diagramme de flux tag → destination par plateforme (GA4, Piano, Matomo, Google Ads, Floodlight, Kameleoon, AB Tasty, Meta Pixel, TikTok, Hotjar, Criteo, Custom). Détecte les destinations pilotées par variable (Lookup Table multi-propriété) vs valeur en dur, et le nombre d'events envoyés par config.

**Onglet Recommandations (Monitoring)**

`RecommendationsTab.tsx` (420 lignes) : moteur de règles générant des recommandations priorisées (critique/attention/info) par plateforme (Google Ads, GA4, Piano, Matomo) à partir des données mock — ex. détecte les triggers pageview mal utilisés, remonte l'action corrective et les containers concernés.

**EventChainDrawer**

`src/components/events/EventChainDrawer.tsx` : drawer affichant le détail d'un `EventChainStatus` (tag/trigger/variables) pour un container donné, avec badges ✓/✗ par étape de la chaîne.

**Données et templates**

- `src/data/official-params.ts` : définitions officielles des paramètres GA4/Matomo/Piano (required/recommended/optional) utilisées pour scorer les variables manquantes dans EventsPage
- `src/data/package-templates.ts` : templates de packages prêts à l'emploi (ex. "GA4 Ecommerce Standard" — 5 events, variables DL, déclencheurs customEvent) sélectionnables depuis PackagesPage

**FeedbackDrawer**

`src/components/ui/FeedbackDrawer.tsx` : formulaire de retour utilisateur (catégorie feature/UX/bug/autre) qui génère un email pré-rempli (`mailto:`) plutôt qu'un backend dédié.

**Skills et assets**

Ajout de skills `.claude/skills/google-tagmanager` et `.claude/skills/ui-ux-pro-max`. Nouveaux assets `public/tag-types/` (logos GA4, Google Ads, Google Tag, LinkedIn, Matomo, Microsoft, Piano) pour remplacer progressivement les icônes SVG maison de `TagTypeIcon`.

**Dette de documentation**

Cette entrée couvre a posteriori le commit `7975908` (2026-07-06), qui regroupait plusieurs jours de travail non documentés au fur et à mesure. `CLAUDE.md` et le wiki (`auth-strategy.md`, `deferred-features.md`) ont été corrigés en même temps — ils décrivaient encore l'OAuth comme non configuré.

---

## 2026-07-09 — Publication unifiée, détection PII, Distribution fiabilisée sur données réelles

**Contexte** : première session de test intensif sur un compte réel (Noviscore, 4 containers) après la mise en ligne de l'OAuth. Beaucoup de bugs de détection découverts en confrontant les hypothèses de départ (types GTM natifs supposés, structure des paramètres) aux vraies données scannées — corrigés un par un par vérification empirique (log ciblé + confirmation utilisateur) plutôt que par supposition.

**Déploiement unifié**

Toutes les actions en attente issues de Monitoring (renommages, opérations déclencheurs, duplications de tag/variable) sont maintenant regroupées par container et publiées en un seul CTA "Publier" sur la page Déployer, via un workspace vierge dédié par container (`resolveBlankWorkspace`) plutôt qu'en écrivant dans le Workspace par défaut partagé entre consultants. Ancien design (modales de publication éparpillées par feature) supprimé.

**Packages — nouveaux flux**

- Diff entre deux versions publiées d'un même container → génération d'un nouveau package (les entités supprimées ne sont jamais auto-sélectionnées, le format package ne sait pas représenter une suppression)
- Duplication de variables entre containers (même mécanisme que la duplication de tags déjà existante)

**Recommandations — nouvelles règles**

- **PII non hashée** : détecte email/téléphone en clair dans les tags (Google Ads, Meta, TikTok, Pinterest, Snapchat, LinkedIn, GA4), sévérité ajustée selon que la plateforme documente un hachage automatique côté client (attention) ou l'exige manuellement côté serveur sans filet (critique) — recherché dans la documentation officielle de chaque plateforme avant implémentation, pas deviné
- **Qualité de mesure** : même `conversionId`/Pixel ID dupliqué sur plusieurs tags (double comptage), double `fbq('init', ...)` Meta, valeur/devise e-commerce codée en dur, couverture d'events GA4 inégale entre containers
- Règles "Conversion Linker absent" / "Remarketing absent" élargies pour reconnaître les implémentations Custom HTML, pas seulement les types natifs

**Détection de plateforme centralisée (`src/lib/gtm-matrix.ts`)**

Nouveau module partagé par Monitoring, Distribution et l'export PDF (avant : 3 implémentations séparées et désynchronisées). Points clés découverts en confrontant le code aux vraies données du compte de test :
- Les tags issus d'un Custom/Community Template (`type: "cvt_..."`) n'ont pas de corps HTML — leur plateforme réelle se déduit du nom + de la référence de galerie du template (`customTemplate[]`, désormais scanné et stocké par container), pas du code
- Plusieurs types "natifs" supposés se sont révélés faux pour ce compte : le Remarketing Google Ads est en réalité `sp` (pas `awrk`), le Conversion Linker est `gclidw` (pas `clmb`), Microsoft UET est `baut`. Les deux formes sont maintenant acceptées partout
- Le tag GA4 Configuration (`gaawc`) est remplacé sur les containers récents par un tag unifié `googtag` (bascule GTM de septembre 2023) — une seule ressource dont la plateforme réelle (GA4 ou Google Ads) dépend du préfixe de son `tagId` résolu
- Tolérance aux variantes de nommage sans séparateur ("GoogleAds", "MetaPixel") et au token "fb" isolé (convention agence)
- Nouvelles catégories : Microsoft Ads, Microsoft Clarity, CMP (plateforme de consentement — vrai tiers), distinctes de "Consent Mode" (signal `gtag('consent', ...)` qui ne fait que configurer GA4/Ads localement, n'envoie rien à un tiers)

**Paramètres GA4 (`src/lib/ga4-event-params.ts`)**

Les paramètres d'un tag GA4 Event (currency, value, items, transaction_id…) ne sont pas des paramètres plats — GTM les imbrique dans une structure LIST/MAP, et il existe **deux conventions réelles selon l'ancienneté du template** : `eventParameters` (clés `name`/`value`) et `eventSettingsTable` (clés `parameter`/`parameterValue`). `flattenGA4EventParams()` aplatit les deux formes ; tous les endroits qui lisaient ces paramètres à plat (ParamMatrixTab, Recommandations, export PDF) ont été corrigés. Alias `event_name`/`eventName` généralisé partout où il manquait.

**Distribution — fiabilisation de bout en bout**

- Résolution de variable Constante pour afficher l'ID réel (pixel/conversion) plutôt que le nom de la variable
- Fallback `gtag_config` (ressource API séparée) quand un tag GA4 Config n'a pas d'ID propre (mode auto-détection "Google tag lié") — ne fonctionne que si ce Google tag vit dans le même container scanné, pas s'il est dans un container séparé (limite connue, pas de solution retenue pour l'instant)
- Recherche générique par nom de clé de paramètre (`findIdLikeParamValue`) pour les tags sans code (templates et types natifs courts comme `sp`/`baut`) dont l'ID est dans un champ dédié
- Normalisation des ID Google Ads (`1059038729` vs `AW-1059038729` → même destination) et dédoublonnage par valeur résolue plutôt que par nom de variable
- Regroupement : plateformes à instance unique par page (Meta/TikTok/Pinterest/Snapchat/LinkedIn/Microsoft Ads/Clarity) fusionnées en un seul nœud même si certains tags n'ont pas leur propre ID ; Conversion Linker et GA4 Config sans ID repliés dans le vrai nœud de la même plateforme au lieu de former une branche "non détectée" isolée
- Tri fixe des nœuds par plateforme (mêmes plateformes groupées, même ordre d'un container à l'autre)
- Vue plein écran par container (bouton d'agrandissement)

**Logos**

Facebook/Meta Pixel, TikTok, Hotjar, Microsoft Clarity remplacés par les vrais logos (`public/tag-types/`), plus de cercles colorés génériques pour ces plateformes.

**Bugs de fiabilité corrigés**

- Badge "N planifiés" sur les lignes de la matrice Tags : comptait tous les renommages correspondant à la ligne sans filtrer sur le statut, donc des renommages déjà appliqués continuaient d'afficher "planifié" indéfiniment (corrigé à 3 endroits : badge de ligne, cellule, props passées aux drawers)
- `paused?: boolean` ajouté à `GTMTag` (champ réel de l'API absent du type)

---

## 2026-07-09 (suite) — Durcissement du déploiement, module DataLayer Mapping, polish UX

**Contexte** : revue croisée avec Gemini (via Ron) sur `dk-gtm-manager` et sur une proposition de nouveau module DataLayer Mapping. Plusieurs bugs de fond découverts en creusant les affirmations de Gemini plutôt qu'en les prenant pour acquises — dont un qui touchait le flux de déploiement principal, pas juste une fonctionnalité annexe.

**Bug de fond — résolution `firingTriggerId` absente partout**

Aucune résolution nom→ID de trigger n'existait dans le codebase : un tag avec un déclencheur lié envoyait littéralement le nom du trigger (ou l'ID d'un autre container) à l'API GTM du container cible. Corrigé à la racine :
- `ContainerDiff` expose désormais `existingTriggersByName` (calculé dans `computeContainerDiff`, `gtm-diff.ts`)
- `deploy()` (`gtm-store.ts`) résout chaque référence vers l'ID réel du container cible avant l'appel API, triggers upsertés dans la même passe que les tags qui les référencent
- `diffVersions` (Chantier A, réplication entre containers) normalise aussi les deux versions comparées pour rester cohérent

**Activation automatique des built-in variables**

Nouveau module `gtm-lib/gtm-builtin-variables.ts` : détecte les `{{Click URL}}`, `{{Page Path}}` etc. référencés par un package et les active dans le container cible avant l'upsert (2 nouvelles fonctions API `listEnabledBuiltInVariables`/`enableBuiltInVariables`). Sans ça, un trigger qui référence une variable native jamais activée dans un container déploie silencieusement, sans jamais se déclencher. Appliqué à la fois dans `deploy()` et dans `applyContainerQueue` (ce dernier ne l'avait jamais eu, alors que Monitoring l'utilise déjà en prod).

**Autres corrections de `deploy()`/`applyContainerQueue`**

- Ordre de suppression inversé (tag→variable→trigger) dans `applyDeletions`, symétrique à l'ordre de création
- `deploy()` réutilise désormais `resolveBlankWorkspace` (comme `applyContainerQueue`) au lieu de toujours créer un nouveau workspace — évite la limite des 3 workspaces GTM
- Validation de package avant déploiement (`package-validation.ts`) : détecte les `{{variable}}` fantômes (non déclarées dans le package, pas une variable native connue) et les valeurs suspectes en dur (ID numérique, domaine) — le piège "tag Turkish déployé chez Air France pointe encore vers le pixel/domaine de Turkish"
- Rate limiter et retry 429/503 : déjà présents dans `gtm-api.ts` (sliding-window 25 req/60s + backoff), pas un ajout de cette session — diagnostic initial erroné corrigé après lecture du code

**Messages d'erreur compréhensibles (`src/lib/gtm-errors.ts`)**

Les erreurs API GTM (401/403/404/429/502/503) s'affichaient en JSON brut Google directement dans l'UI. Nouveau helper `friendlyGtmError()` traduit en message actionnable, avec bouton "Se reconnecter" dédié sur 401 (relance le popup OAuth puis retente l'action). Appliqué à 6 points d'affichage : `ContainersPage`, `MonitoringPage`, `VersionDiffFlow`, `DiffView`, `DeployPage`, `CleaningTab`.

**Nouveau module : DataLayer Mapping (`src/features/datalayer-mapping/`)**

Nouvel onglet qui analyse le vrai dataLayer capturé sur un site (pas la config GTM déclarée) — taux de complétion par variable, anomalies de type GA4 (currency non-ISO, value en string), détection de variables sans équivalent GTM. Spec complète dans `PRD_DataLayerMapping.md` (nouveau, à la racine).

- Types (`datalayer.types.ts`), store Zustand persisté par profil (Phase A localStorage, mock data basé sur le cas réel Noviscore)
- Onglets Events (drill-down variable au clic, KPI en tête — pas d'onglet Dashboard séparé, jugé redondant pour 4 chiffres), Variables, Dictionnaire, Alertes
- **Bouton "Créer dans GTM"** : nouvelle queue `EntityCreationOperation`/`pendingEntityCreations` dans `gtm-store.ts`, publiée via `applyContainerQueue` (pas via le flux Package — mauvais choix initial corrigé après avoir réalisé qu'il n'y a qu'un seul container cible ici, pas de propagation multi-container à faire)
- **Plan Kanban par page** (`DatalayerKanbanPage.tsx`) : colonnes = pages/étapes du parcours plutôt qu'events isolés, cascade de classification `pageRouter.ts` (flag sémantique → regex URL → transversal >3 colonnes → bac à sable), Vue Master (agrégée multi-sites, badges de couverture + comparateur de structures) et Vue Partenaire (un site), Focus Mode (funnel e-commerce en surbrillance, ligne de flux qui casse si complétion <95%), tiroir latéral de détail (`EventDetailDrawer`) réutilisant le pattern déjà en place (`EventChainDrawer`/`TagDrawer`)
- **Collecteur** (`gtm-tag/dl-mapping-collector.html`) : tag GTM Custom HTML (pas Custom Template Sandboxed JS — le sandbox ne peut structurellement pas intercepter `dataLayer.push()` de façon vivante, erreur de conception dans la proposition initiale de Gemini). Override non-destructif de `.push`, anonymisation client-side avant tout envoi réseau, buffer+flush groupé (jamais un ping HTTP par event)
- Bookmarklet envisagé puis abandonné, remplacé par ce collecteur temps réel
- Schéma Supabase (Phase B, pas encore implémenté) revu deux fois : d'abord "pas d'historique brut" jugé insuffisant pour l'alerting (aucune notion temporelle), puis le calcul de volumétrie avec un vrai chiffre terrain (TK/PFS : 400K events GA4/jour) a invalidé l'hypothèse de conservation exhaustive du brut — direction retenue : rollup quotidien conservé indéfiniment (petit, indépendant du trafic) + échantillon plafonné par (site, event, jour) pour le brut plutôt qu'une fenêtre de rétention sur le trafic exhaustif

**Polish UX transverse**

- Case entière cliquable (pas juste le texte) sur les cellules event/trigger d'`EventsPage`
- `InfoTooltip` (nouveau composant partagé) : icône "i" compacte, popover au clic — ajoutée sur les 9 pages principales pour expliquer le rôle de chaque écran sans occuper d'espace permanent
- Uniformisation du pattern "Absente/Créer" (pilule rouge, icône ✕→+ au survol, repris de Monitoring) sur les matrices variables d'`EventsPage` et de DataLayer Mapping
- Modale de duplication (`QuickCreatePanel`, Monitoring) élargie 400px→480px
- Audit et correction des effets de hover manquants ou trop subtils (`hover:opacity-70` remplacé par de vrais changements de fond) sur une dizaine de boutons à travers l'app ; contrastes vérifiés au passage, pas de vrai risque blanc-sur-blanc trouvé malgré l'inquiétude initiale

---

## 2026-07-10 — Rollback implémenté, durcissement suppression, matrice de réversibilité

Suite à une conférence data (DAMA, gouvernance, data owner/steward, matrice de réversibilité) et une inquiétude légitime de Ron sur le risque de casse de données client via l'outil, audit de sécurité complet du code (pas seulement du PRD) puis trois chantiers.

**Audit préalable**

`deploy()` confirmé upsert-only (jamais de DELETE), workspaces jamais écrasés (`resolveBlankWorkspace`), publication auto jamais silencieuse. Seul vrai point de risque : les fonctions `deleteVariable/Trigger/Tag` dans `gtm-api.ts`, isolées à `CleaningTab.tsx` (Monitoring → Nettoyage) et déjà protégées par une modale de preview. Écart trouvé : le Rollback (§4.6 du PRD) était documenté mais jamais codé — tooltip mensonger dans `HistoryPage.tsx`.

**Rollback (§4.6)**

- `DeploymentResult.previousVersionId` : capturé via `getLiveVersion()` juste avant chaque `publishVersion()`, dans `deploy()`, `applyDeletions()` et `publishWorkspaceVersion()` (donc déploiements, suppressions ET renommages/duplications sont tous rollback-éligibles)
- `DeploymentRecord.autoPublish` (nouveau champ obligatoire) — seuls les déploiements auto-publiés sont éligibles au rollback (les manuels n'ont rien touché en live)
- Nouvelle action store `rollback(token, record)` : republie, container par container, la version qui était live avant le déploiement ; isolation des erreurs comme `deploy()` ; persiste `rolledBackAt`/`rollbackResults` via nouveau `updateDeploymentRecord()` dans `storage.ts`
- UI : `RollbackPanel` dans `HistoryPage.tsx` — double confirmation (bouton puis modale d'avertissement explicite), progress en temps réel par container, badge "Annulé le [date]" une fois fait
- Limite assumée et documentée : les containers sans version live antérieure (premier déploiement) ou les déploiements d'avant cette version n'ont pas de `previousVersionId` → rollback marqué "ignoré" avec message clair, pas d'échec silencieux

**Durcissement CleaningTab**

Modale de suppression déjà bien conçue (preview tableau, nom de version obligatoire) mais renforcée : saisie obligatoire du mot "SUPPRIMER" pour débloquer le bouton final, note de réassurance rappelant que l'action sera annulable depuis l'Historique une fois le Rollback en place.

**Piège tsc évité** : `npx tsc --noEmit` sans `-p tsconfig.app.json` ne vérifie rien du tout sur ce projet composite (root `tsconfig.json` a `files: []` + `references`) — retourne toujours exit 0 même avec de vraies erreurs de type. Toujours utiliser `npx tsc --noEmit -p tsconfig.app.json` pour ce repo.

**PRD v1.4**

Nouvelle §19 "Gouvernance & matrice de réversibilité" : rôles data owner (métiers) / data steward (DK), tableau action → réversible auto / manuel / non réversible, limites connues du rollback. Backlog renuméroté §19→§20.

**Allowlist de connexion temporaire**

Ron a demandé de restreindre l'accès à `googlepartner@digitalkeys.fr` uniquement, le temps de la validation interne (§12). Ajout de `ALLOWED_EMAILS`/`isEmailAllowed()` dans `auth.ts`, vérifié à deux endroits : au login (`auth-store.ts`, avec révocation du token Google si l'email n'est pas autorisé) et au chargement d'une session persistée (`loadAuthState()`, pour ne pas laisser un ancien état localStorage contourner un allowlist réduit après coup).

Ron a ensuite demandé une vraie protection, indépendante des permissions GTM ("je m'en fiche des gens qui ont accès aux containers GTM"). Le check `ALLOWED_EMAILS` a été signalé comme du théâtre de sécurité : 100% côté client, contournable en éditant le bundle JS ou le localStorage. Deux vraies options présentées : (A) écran de consentement OAuth GCP en type "Interne" (Google bloque tout compte hors `@digitalkeys.fr` avant même l'exécution du code — infalsifiable côté client, aucun code à écrire), (B) middleware Vercel Edge + vérification serveur de l'ID token + cookie de session signé (verrouille précisément `googlepartner@` mais ajoute une vraie surface backend, nécessite un déploiement Vercel réel pour tester). Ron a choisi (A) uniquement — guidé pour le réglage dans la console GCP du projet `gtm-wbncv54-ngq1n` (§9 du PRD mis à jour). `ALLOWED_EMAILS` conservé en complément, recommenté pour clarifier que ce n'est plus qu'un garde-fou de confort (évite qu'un autre consultant DK légitime utilise cet outil par erreur), pas la barrière de sécurité réelle.

Discussion annexe (pas de code) sur l'hébergement : sous-domaine `tracking-manager.digitalkeys.fr` proposé et validé — plus explicite que d'exposer "gtm" publiquement. Tentative de délégation du sous-domaine à Cloudflare via `Connect a domain` échouée ("root domain only" — le partial/CNAME setup est réservé aux plans Enterprise). Le domaine racine `digitalkeys.fr` ne migrera pas sur Cloudflare, donc retour à un CNAME direct chez l'hébergeur DNS actuel du domaine, pointé vers Vercel — Cloudflare n'apporte rien ici puisque Vercel gère déjà SSL/CDN. Note Vercel Hobby (gratuit) : CGU réservées à l'usage non-commercial, techniquement le plan Pro serait requis pour un outil d'agence — à trancher avant la démo PFS (§12).

**Publication groupée multi-containers + noms de version explicites**

Ron : la queue "Modifications en attente" (Déployer) ne publiait qu'un container à la fois, et le nom de version par défaut ("Déploiement — ...") ne disait pas ce qui avait changé.

- `buildActionPrefix()` (nouveau, `DeployPage.tsx`) : préfixe dynamique selon le type d'opération en attente sur le container (Renommage / Retrait déclencheur / Synchronisation déclencheur / Duplication tag / Duplication variable, combinables avec " + ") — remplace le générique "Déploiement". Logique extraite dans `buildQueueVersionMeta()`, partagée entre la carte individuelle et la publication groupée.
- Checkbox de sélection sur chaque `ContainerQueueCard`, "Tout sélectionner/désélectionner", bouton "Publier N containers →" en tête de section. Publication **séquentielle** (pas en parallèle : `applyContainerQueue` pose un état global `isApplyingContainerQueue`/`applyPublishErrors` partagé dans le store — des appels concurrents se marcheraient dessus) avec isolation des erreurs par container (même logique que `deploy()`), progress affiché en temps réel réutilisant `StepIcon`.
- Sélection par défaut = tous les containers ; se resynchronise sur "tout sélectionné" si le set de containers en attente change (nouveau container ajouté à la queue depuis Monitoring, ou un autre entièrement traité).

---

## 2026-07-13 — Focus Mode éditable, InfoTooltip en badge, veille concurrentielle (Trooper, Avo)

**`InfoTooltip` redesigné en badge**

Ron : voulait ce type de badge (comme "Annulé le [date]" dans HistoryPage) plutôt qu'un simple rond "i". Le composant (`src/components/ui/InfoTooltip.tsx`) garde le même comportement (popover au clic) mais le déclencheur est maintenant un vrai pill badge (icône + texte "À quoi sert cette page ?"), même langage visuel que `Badge.tsx`. Aucun changement d'API — les 9 pages qui l'utilisent n'ont pas eu à être touchées.

**Focus Mode (Plan Kanban) rendu configurable**

`FUNNEL_STEPS` était une constante en dur (`view_item_list, view_item, begin_checkout, purchase`) dans `DatalayerKanbanPage.tsx`. Ron voulait pouvoir modifier les events qui le composent.

- `DEFAULT_FUNNEL_STEPS` déplacé dans `constants/ga4Events.ts` comme fallback
- Nouveau `focusEvents: Record<clientId, string[]>` dans `datalayerStore.ts` (persisté par profil, même pattern que le reste du store), avec `getFocusEvents(clientId)` (retombe sur le défaut si rien de custom) et `setFocusEvents(clientId, events)`
- `purgeClient` nettoie aussi l'entrée `focusEvents` du client supprimé
- UI : bouton ⚙ à côté du toggle "⚡ Focus Mode", popover `FocusModeEditor` — réordonnancement (↑↓, pas de drag-and-drop, inutile pour une poignée d'étapes séquentielles), suppression, ajout par nom d'event tapé au clavier

**Veille concurrentielle : Trooper et Avo**

Ron a reçu le pitch de deux outils comparables et a demandé d'en extraire ce qui manque à dk-gtm-manager :

- **Trooper** (audit quotidien GA4/Piano sur BigQuery, consensus multi-algorithme anti-faux-positifs) → ajout de la §9.6 dans `PRD_DataLayerMapping.md` : déviation % vs moyenne glissante 7j (calcul manquant sur la table `datalayer_variable_daily` déjà prévue en Phase B), volumétrie d'événement comme signal indépendant de la complétion de paramètres (nécessite un rollup par event, pas seulement par variable), badge Anomaly/OK, réduction de faux positifs par conditions combinées plutôt qu'un vrai ensemble de modèles. Explicitement conçu pour ne dépendre d'aucun export BigQuery côté client (le collecteur maison reste la seule source universelle) — après discussion, BigQuery repositionné en option de recoupement V2 pour la volumétrie uniquement (plus fiable que le comptage client-side sur ce point précis : déjà dédupliqué/filtré des bots côté serveur GA4), pas une dépendance bloquante.
- **Avo** (tracking plan pour l'analytics produit, Plan→Implement→Verify) → ajout de la §21 dans `PRD_GTM_Manager.md` : audit automatique de naming convention (Digital Keys a déjà `Naming_Convention_GTM___GA4.csv` en référence statique, jamais fait respecter par l'outil), détection de quasi-doublons entre containers PFS. Le document d'étude fourni par Ron confirme aussi la direction générale (agent IA + source de vérité versionnée + review humaine + vérification post-déploiement) et le créneau agence (Avo ne committe jamais dans le repo/container du client, pensé pour des équipes produit internes). Backlog `PRD_GTM_Manager.md` §20 renuméroté (le v1.4 y était encore listé comme futur alors que déjà livré cette semaine — collision corrigée, "Partage de packages" décalé en v1.6).

**Discussion non actée : accès BigQuery pour les clients sans compte GCP**

Ron s'interroge sur un moyen simple de lier BigQuery aux propriétés GA4 clients (la plupart n'ont pas de compte GCP et se perdraient dans la Google Cloud Console) et sur le coût réel de BigQuery. Recherché et confirmé : l'export GA4→BigQuery est gratuit, BigQuery a un vrai palier gratuit (1 To requêtes/mois, 10 Go stockage/mois), mais un compte de facturation (CB) doit être attaché au projet GCP pour éviter le mode Sandbox (expiration des tables à 60 jours, inutilisable pour une baseline glissante). Piste proposée : DK possède le(s) projet(s) GCP avec sa propre facturation, ne demande que le rôle Editor sur la propriété GA4 du client (même niveau d'accès que ce qui est déjà demandé pour GTM) et fait le lien depuis son propre compte — le client ne touche jamais à Google Cloud Console. Pas encore documenté dans un PRD, discussion à trancher.
