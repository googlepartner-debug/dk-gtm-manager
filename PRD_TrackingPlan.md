# PRD — Plan de tracking

**Version** : 0.1
**Date** : 2026-07-13
**Auteur** : Digital Keys
**Statut** : Brouillon — décisions de cadrage prises via questions/réponses, détails d'implémentation à valider avant dev

---

## 1. Contexte & problème

Tous les plans de tracking actuels (events/paramètres GA4/Piano attendus par site) vivent dans des Google Sheets ou fichiers Excel — format qui ne parle ni aux devs (pas de typage, pas de structure de données claire, copier-coller source d'erreurs) ni vraiment aux product owners (mur de colonnes techniques). Aucun lien avec la réalité : rien ne dit si un event planifié a été implémenté dans GTM, ni s'il fonctionne réellement en prod.

**Besoin** : remplacer le tableur par un module dans dk-gtm-manager, avec un format moderne et lisible par les deux publics (devs, product owners), et un **statut automatique** croisant le plan avec ce qui existe déjà dans l'outil (Monitoring = implémenté dans GTM, DataLayer Mapping = vérifié en prod réelle) — l'objectif est de faire un bon outil, pas de se comparer à la concurrence.

**Lien avec les modules existants** : ce n'est pas un troisième silo de données. Réutilise le même référentiel client/site que DataLayer Mapping (`clientId`/`siteId` = `containerId` GTM, PRD DataLayerMapping §3).

---

## 2. Décisions de cadrage (prises le 2026-07-13)

| Question | Décision |
|---|---|
| Granularité | **Un plan par client** (comme DataLayer Mapping), peut couvrir plusieurs sites/containers qui partagent le même datalayer |
| Synchronisation avec l'existant | **Reliée aux deux** : Dictionnaire DataLayer Mapping (donnée réelle captée) + scan Monitoring (config GTM live) → statut calculé, pas stocké |
| Partage / accès client | **Pas encore tranché** — à rediscuter une fois le modèle de données validé. v1 construit sans bloquer dessus (voir §7) |
| Backend | **Indépendant de la Phase B Supabase** (DataLayer Mapping) — n'attend pas cette infra. v1 en localStorage, même pattern que le reste de l'app |
| Import Gsheet/Excel | **Non pour v1** — création manuelle uniquement. Migration de l'existant à la main, au fil de l'eau |

---

## 3. Utilisateurs

| Phase | Utilisateur | Accès |
|---|---|---|
| v1 | Digital Keys uniquement | Interne, local (localStorage, par profil consultant) |
| Non tranché | Client final (PFS, Noviscore) | À décider — voir §7 |

---

## 4. Modèle de données (proposition)

Nouveau store `trackingPlanStore.ts`, même pattern que `datalayerStore.ts` (persisté par profil, `dk_tracking_plan_v1_${profileId}`). Réutilise `clientId` du référentiel DataLayer Mapping — pas de liste clients parallèle.

```ts
interface TrackingPlan {
  clientId: string;        // même référentiel que DatalayerClient
  createdAt: string;
  events: TrackingPlanEvent[];
}

interface TrackingPlanEvent {
  id: string;
  eventName: string;                // nom technique, ex. "purchase"
  businessName: string;             // libellé métier, ex. "Confirmation d'achat"
  description: string;              // langage clair : quoi, pourquoi, quand ça se déclenche
  category: 'ecommerce' | 'engagement' | 'generation_leads' | 'gaming' | 'custom';
  pageOrStep?: string;               // étape du parcours — pour regrouper façon Kanban par page (déjà en place, DatalayerKanbanPage)
  priority: 'critique' | 'important' | 'normal' | 'optionnel';
  owner?: string;                    // data owner métier responsable (paid/seo/merch/...) — voir note §5
  platforms: ('GA4' | 'Piano' | 'Matomo' | 'Ads')[];
  parameters: TrackingPlanParameter[];
  screenshots: TrackingPlanScreenshot[];
}

interface TrackingPlanParameter {
  id: string;
  key: string;              // chemin dataLayer, ex. "ecommerce.value" (notation wildcard pour tableaux, même convention que Variable Path existant)
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  exampleValue: string;
  description: string;      // sens métier en une phrase
}

interface TrackingPlanScreenshot {
  id: string;
  dataUrl: string;    // base64, redimensionné + recompressé en JPEG côté navigateur avant stockage (localStorage, pas de backend — voir §7)
  caption?: string;
  addedAt: string;
}
```

**Le statut n'est jamais stocké** — toujours recalculé en croisant trois sources (voir §5), pour ne jamais désynchroniser le plan de la réalité.

**Screenshots (2026-07-13)** : preuve/contexte de test attachée à un event (dataLayer réel observé en devtools, comportement du site). Redimensionnées (max 1600px) et recompressées en JPEG qualité 0.75 avant stockage (`utils/resizeImage.ts`) — un screenshot retina brut fait 3-5 Mo, ce qui viderait le quota localStorage (~5-10 Mo/origine) après une poignée d'events sans cette étape.

---

## 5. Cycle de vie — Planifié → Configuré → Implémenté

Inspiré du Plan → Implement → Verify d'Avo (étude du 2026-07-13) — une bonne idée reprise et adaptée, pas une tentative de se différencier d'eux. Elle est réalisable ici parce que dk-gtm-manager a déjà les deux briques nécessaires (Monitoring + Dictionnaire DataLayer Mapping) :

**Nommage revu le 2026-07-14** (retour utilisateur) : "Implémenté" doit désigner ce qu'un web analyst appelle réellement implémenté — un vrai `dataLayer.push()` détecté en prod, pas juste un tag GTM posé. D'où le renommage de l'étape intermédiaire en "Configuré".

| Statut | Condition | Source |
|---|---|---|
| **Planifié** | L'event existe dans le plan, rien d'autre | — |
| **Configuré** | Un tag/trigger correspondant à `eventName` existe dans au moins un container scanné | `monitoringData` (Monitoring, déjà scanné) |
| **Implémenté** | L'event est réellement capté dans le dataLayer, avec un taux de complétion ≥ seuil | `events`/`variables` du Dictionnaire (DataLayer Mapping) |

Affiché par site (comme les badges de couverture déjà en place dans le Kanban DataLayer Mapping : "✅ implémenté sur N containers", "🟡 configuré mais pas implémenté chez N partenaires", "⚪ planifié seulement").

**Note sur le champ `owner`** : c'est l'endroit concret où la distinction data owner (métier : paid/seo/merch, décide quoi tracker) / data steward (DK, opère et garantit la fiabilité technique) qu'on avait discutée devient un champ produit, pas juste un concept. Texte libre en v1, éventuellement une liste fermée plus tard si un vocabulaire commun émerge à l'usage.

---

## 6. Écrans (v1)

Nouvelle page `Plan de tracking` (nav principale, au même niveau que DataLayer Mapping).

- **Sélecteur client** (même composant que DataLayer Mapping) → si aucun plan n'existe pour ce client, bouton **"Nouveau plan"** = feuille vierge
- **Toggle Vue Dev / Vue Business** en tête de page :
  - **Vue Dev** : table dense — `eventName`, tous les paramètres à plat (key/type/required/example), mapping plateformes, statut. Objectif : un dev peut coder directement depuis cet écran, comme le "dataLayer à implémenter" déjà généré dans DataLayer Mapping.
  - **Vue Business** : cartes — `businessName` en avant, `description` en langage clair, priorité, owner, statut en badge coloré. Paramètres techniques masqués/repliés. Peut réutiliser la disposition Kanban par page déjà construite (`DatalayerKanbanPage`) si `pageOrStep` est renseigné.
- **Ajouter un event** : drawer (réutilise le pattern `EntityDrawer` déjà en place) — champs métier d'abord, section paramètres ensuite (ajout ligne par ligne)
- **Détail d'un event** (clic) : trois colonnes côte à côte — la spec du plan | ce qui existe dans GTM (lien vers Monitoring) | ce qui est réellement capté (lien vers Dictionnaire) — le diagnostic complet en un coup d'œil

---

## 7. Hors scope v1 / questions ouvertes

- **Accès client** : non tranché. Deux pistes identifiées à rediscuter — réutiliser le même login Google que GTM Manager (cohérent mais mélange déploiement GTM et document consultable par le client dans le même outil), ou un lien de partage simple type Figma/Notion (plus léger, séparation nette, mais moins sécurisé si le plan contient des infos sensibles)
- **Import CSV/Gsheet** : pas construit en v1, à ajouter si la migration manuelle s'avère trop lourde en usage réel
- **Liste fermée pour `owner`** : texte libre en v1, à revoir si un vocabulaire métier commun (paid/seo/merch/...) émerge

---

## 8. Backlog

- **v1.1** : import CSV depuis les Gsheets existants (mapping colonnes → champs)
- **v1.2** : accès client (une fois le modèle d'accès tranché, §7)
- **v2.0** : si migration vers le backend Supabase de la Phase B DataLayer Mapping, partage entre consultants DK
