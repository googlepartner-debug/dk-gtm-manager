# Monitoring — DK GTM Manager

Page `/dashboard/monitoring`. Objectif : visualiser la présence et le contenu de chaque entité GTM (tags, déclencheurs, variables) à travers plusieurs containers simultanément.

## Quatre onglets

### Tags
- Matrice : lignes = tags (rowKey = `event_name` pour les tags GA4, nom du tag pour les autres), colonnes = containers
- Filtre par catégorie : GA4, Google Ads, Floodlight, Kameleoon, AB Tasty, Meta Pixel, TikTok, Hotjar, HTML Custom
- Détection de catégorie pour les tags HTML : scan du contenu du paramètre `html`
- Badge "noms variés" si le même event est tracké sous des noms différents selon les containers
- Clic sur une ligne → RenameDrawer

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
