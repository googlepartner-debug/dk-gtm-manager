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
