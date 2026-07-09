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
