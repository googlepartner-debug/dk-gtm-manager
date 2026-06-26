# Monitoring — DK GTM Manager

Page `/dashboard/monitoring`. Objectif : visualiser la présence et le contenu de chaque entité GTM (tags, déclencheurs, variables) à travers plusieurs containers simultanément.

## Cinq onglets

### Tags
- Matrice : lignes = tags (rowKey = `event_name` pour les tags GA4, nom du tag pour les autres), colonnes = containers
- Filtre par catégorie : GA4, Google Ads, Floodlight, Kameleoon, AB Tasty, Meta Pixel, TikTok, Hotjar, HTML Custom
- Détection de catégorie pour les tags HTML : scan du contenu du paramètre `html`
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

## Données

Actuellement sur `src/data/monitoring-mock.ts` (5 containers simulés avec écarts intentionnels).
Passage aux données live : appeler `listTagsFull` / `listVariablesFull` / `listTriggersFull` après GCP OAuth, remplacer `MONITORING_MOCK` par le résultat. Voir [[deferred-features]].
