# Monitoring — DK GTM Manager

Page `/dashboard/monitoring`. Objectif : visualiser la présence et le contenu de chaque entité GTM (tags, déclencheurs, variables) à travers plusieurs containers simultanément.

## Cinq onglets

### Tags
- Matrice : lignes = tags (rowKey = `event_name` pour les tags GA4, nom du tag pour les autres), colonnes = containers
- Filtre par catégorie : GA4, Google Ads, Floodlight, Kameleoon, AB Tasty, Meta Pixel, TikTok, LinkedIn, Pinterest, Snapchat, Microsoft Ads, Microsoft Clarity, Piano, Matomo, Hotjar, Criteo, CMP, Consent Mode, HTML Custom, Custom Template
- Détection de catégorie : `detectTagCategory()` dans `src/lib/gtm-matrix.ts` (partagé avec Distribution et l'export PDF) — types natifs GTM en premier (dont les types réels du compte de test, pas seulement ceux documentés : `sp`=Remarketing, `gclidw`=Conversion Linker, `baut`=Microsoft UET, `googtag`=Google tag unifié GA4/Ads), puis cascade de mots-clés sur nom+code+référence de template pour les tags Custom HTML et Community Template (`cvt_...`, résolus via `customTemplate[]` scanné par container)
- Badge "noms variés" si le même event est tracké sous des noms différents selon les containers
- Badge "déclencheurs variés" si les triggers diffèrent sémantiquement entre containers (comparaison type+conditions, pas les noms)
- Clic sur une ligne → **TagDrawer** (2 onglets : Déclencheurs + Renommer)

### Déclencheurs
- Même matrice, catégorie = `type` GTM (pageview, customEvent, click, scrollDepth…)
- Clic sur une ligne → RenameDrawer

### Variables
- Même matrice, catégorie = `type` GTM (v, c, jsm, u, k, aev)
- Clic sur une ligne → VariableContentDrawer (pas de renommage direct)

### Paramètres envoyés
- Sélecteur d'event en chips (events GA4 détectés dans les containers), default = `purchase`
- Matrice : lignes = paramètres (clés), colonnes = containers
- Couleurs cellules :
  - Vert : valeur identique dans tous les containers qui ont le tag
  - Orange : valeur différente entre au moins deux containers
  - Rouge "Non envoyé" : tag présent dans le container, paramètre absent
  - Gris "Tag absent" : le tag GA4 pour cet event n'existe pas dans ce container
- Barre de couverture par container (% de paramètres envoyés)

### Nettoyage
- Détecte les entités orphelines (0 références) par container
- **Triggers orphelins** : non référencés dans aucun `firingTriggerId` / `blockingTriggerId`
- **Variables orphelines** : `{{nom}}` absent de tous les paramètres (tags + triggers + variables, récursif list/map)
- UI : sections Déclencheurs / Variables, groupement par container, checkboxes, "Planifier la suppression de N entités"
- Historique des suppressions (annulées / effectuées) avec bouton Annuler par op
- Badge count dans l'onglet (total orphelins cross-containers)
- `DeletionOperation` dans `src/types/gtm.ts` — store : `addDeletions`, `cancelDeletion`, `removeDeletion`, `clearDeletions`

## TagDrawer — onglet Déclencheurs

`TagDrawer` remplace `TagDetailDrawer` + `RenameDrawer` en un seul composant avec deux onglets.

**Onglet Déclencheurs** :
- Cards par container : état présent/absent, liste des triggers liés avec type badge + nom
- Comparaison sémantique : `triggerSemanticKey()` normalise par `type::condition` (customEvent → `customEvent::eventName`, pageview/domReady/windowLoaded → juste le type, click/scroll → `type::filterHash`)
- Point rouge sur l'onglet si incohérence détectée entre les containers ayant le tag
- **Action Retirer** : bouton visible au survol de chaque ligne trigger — queues une `TriggerOperation { kind: 'remove' }` dans le store. Badge `Planifié ×` cliquable pour annuler. Modal de confirmation si c'est le dernier trigger du tag dans ce container.
- **Action Synchroniser** : bouton "Synchroniser depuis une référence" (visible si incohérence) → vue de planification :
  - Sélecteur de container de référence avec preview de ses triggers
  - Aperçu diff par container cible : `−` retirer / `~` lier existant / `+` créer
  - Checkboxes, bouton "Planifier N synchronisation(s)" → queues `TriggerOperation { kind: 'sync' }`
- **Feedback visuel** : après planification, le drawer reflète l'état futur en temps réel — triggers barrés "à retirer", lignes vertes "à lier/créer", badge "Sync planifiée" sur la card header

**Onglet Renommer** : formulaire de renommage groupé (identique à l'ancien RenameDrawer).

## Actions déclencheurs — queue Zustand

`TriggerOperation` dans `src/types/gtm.ts` :
- `kind: 'remove' | 'sync'`
- `tagRowKey` + `tagCategory` : identifient le tag concerné
- `steps: TriggerOpStep[]` : une étape par container, avec `unlink[]` / `linkExisting[]` / `createAndLink[]`
- `status: 'pending' | 'applied' | 'failed' | 'cancelled'`
- Queue `pendingTriggerOps[]` dans le store — actions : `addTriggerOp`, `removeTriggerOp`, `cancelTriggerOp`, `clearTriggerOps`
- Bouton dans le header : visible même quand tout est annulé ("Historique déclencheurs") — panneau slide-in avec sections "En attente" + "Historique" (ops annulées/effectuées persistées)
- Le × dans le panneau annule (status → cancelled) — les ops ne disparaissent plus, elles restent en historique
- Exécution (PUT tag via API GTM) bloquée jusqu'à GCP OAuth

## SyncPlanView — ordre des containers cibles

Containers triés par priorité : **À synchroniser** (orange, action requise) → **Déjà identique** (vert) → **Tag absent** (gris, tout en bas). Tri sur `status` du diff calculé par `computeSyncDiff`.

## Icônes types de tag

`TagTypeIcon.tsx` : composant SVG inline par catégorie (cercle coloré + symbole blanc). Affiché dans les en-têtes de groupe de la matrice Tags. Tentative d'extraction des vraies icônes GTM (base64 SVGs dans `data-ng-src`) non aboutie — liste Angular virtualisée. Icônes maison conservées.

## Renommage groupé

`RenameOperation` dans `src/types/gtm.ts` :
- `rowKey` : clé de la ligne (event_name ou nom de l'entité)
- `category` : type/catégorie de l'entité
- Queue Zustand `pendingRenames[]` — persistée en mémoire, exécutée via API GTM post-OAuth
- Panneau "Plan de renommage" récapitulatif avec liste et bouton "Appliquer (OAuth requis)"

## Comparaison de contenu variables

`VariableContentDrawer` :
- Extrait le contenu principal selon le type : code JS (`javascript`), chemin DL (`name`), valeur constante (`value`), composant URL (`component`), nom cookie (`cookieName`)
- Référence = premier container ayant la variable
- Diff ligne par ligne pour `jsm` (Custom JS) : lignes ajoutées en orange/+, lignes supprimées en rouge/−
- Contrainte : comparaison uniquement entre variables portant le même nom exact

## Filtre containers

Dropdown multi-select dans le header MonitoringPage (bouton "Containers (N/N) ▾"). État partagé via `hiddenIds: Set<string>` — actif sur tous les onglets simultanément. Le dernier container actif ne peut pas être désélectionné. Violet quand filtrage actif, gris sinon.

## Nettoyage — modal de confirmation

Modal 640px redessinée : pills containers en header, tableau unifié par container (colonnes Type / Nom / Action), nom de version et description pré-remplis (modifiables). Bouton "Supprimer et publier" disponible en haut ET en bas de l'onglet.

## Données

Live depuis l'OAuth (2026-07-02) : `scanMonitoring` récupère par container tags/triggers/variables (fast-path via `getLiveVersion`, fallback workspace si jamais publié) + `customTemplate[]` + `gtagConfig[]`. `monitoring-mock.ts` reste le jeu de données de démo (5 containers avec écarts intentionnels), utilisé hors connexion.

## Onglet Distribution

`DistributionTab.tsx` : diagramme de flux tag → destination par plateforme, un diagramme par container (bouton d'agrandissement → vue plein écran).

- **Résolution de destination** : ID littéral, ou variable Constante résolue (affiche l'ID réel, pas le nom de variable), ou repli `gtag_config` pour un tag GA4 Config sans ID propre (mode auto-détection "Google tag lié" — ne fonctionne que si ce Google tag vit dans le container scanné, pas dans un container séparé), ou recherche générique par nom de clé de paramètre (`findIdLikeParamValue`) pour les tags sans code
- **Normalisation Google Ads** : `1059038729` et `AW-1059038729` reconnus comme la même destination
- **Regroupement** : plateformes à instance unique par page (Meta Pixel, TikTok, Pinterest, Snapchat, LinkedIn, Microsoft Ads, Microsoft Clarity) fusionnées en un seul nœud par container même si certains tags n'ont pas leur propre ID ; Conversion Linker et GA4 Config sans ID repliés dans le vrai nœud de la même plateforme plutôt que de former une branche "non détectée" isolée ; tri fixe par plateforme (mêmes plateformes groupées, même ordre entre containers)
- **CMP vs Consent Mode** : les tags de plateforme de consentement (CMP - Script, etc.) ont leur propre branche (vrai tiers) ; les signaux `gtag('consent', 'default'/'update', ...)` sont exclus du graphe (ils ne font que configurer GA4/Ads localement, aucun envoi à un tiers)
- **AlertBar** : divergence de couverture d'events GA4 entre containers, divergence de destinations par plateforme

## Onglet Recommandations

`RecommendationsTab.tsx` : moteur de règles générant des recommandations priorisées (critique/attention/info) par plateforme, à partir des données scannées.

- Règles historiques : Conversion Linker/Remarketing absent (reconnaît aussi les implémentations Custom HTML, pas seulement les types natifs), Enhanced Conversions non configurées, double page_view GA4, user_id absent sur events e-commerce, siteId Piano/Matomo non détecté
- **PII non hashée** : email/téléphone en clair détecté par plateforme (Google Ads, Meta, TikTok, Pinterest, Snapchat, LinkedIn, GA4) — sévérité critique si la plateforme n'a pas de hachage automatique documenté côté serveur, attention sinon (le risque est alors la visibilité en clair dans le container, pas le transport)
- **Qualité de mesure / double comptage** : même `conversionId`/Pixel ID dupliqué sur plusieurs tags actifs, double `fbq('init', ...)` Meta sur un même container, valeur/devise e-commerce codée en dur au lieu d'une variable Data Layer, couverture d'events GA4 inégale entre containers

## Paramètres GA4 imbriqués

Les paramètres d'un tag GA4 Event (currency, value, items, transaction_id…) ne sont pas des `tag.parameter` plats — GTM les imbrique dans une LIST/MAP, sous l'une de deux conventions réelles selon l'ancienneté du template GA4 : `eventParameters` (clés `name`/`value`) ou `eventSettingsTable` (clés `parameter`/`parameterValue`). `flattenGA4EventParams()` (`src/lib/ga4-event-params.ts`) aplatit les deux formes en un seul objet — utilisé partout où un paramètre GA4 event est lu (ParamMatrixTab, Recommandations, export PDF).
