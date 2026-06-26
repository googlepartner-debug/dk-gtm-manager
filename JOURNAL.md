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
