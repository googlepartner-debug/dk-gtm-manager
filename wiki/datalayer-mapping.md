# DataLayer Mapping — module d'analyse du vrai dataLayer

**Spec complète** : `PRD_DataLayerMapping.md` (racine du repo). Cette page résume l'état d'implémentation.

## Ce que c'est

Un module indépendant de la config GTM déclarée : il analyse le **vrai** `dataLayer.push()` capturé sur un site (taux de complétion par variable, anomalies de type GA4, variables sans équivalent GTM), là où le reste de l'app (`EventsPage`, `MonitoringPage`) travaille sur la config GTM elle-même. Les deux sources sont complémentaires, pas redondantes.

## État (2026-07-09)

**Phase A (localStorage, données mock)** — implémentée :
- `src/features/datalayer-mapping/types/datalayer.types.ts` — `DatalayerEvent`, `DatalayerVariable`, `DictionaryEntry`, `DatalayerEventOccurrence` (tracking par occurrence, pas seulement agrégat — nécessaire pour le Kanban par page)
- `src/features/datalayer-mapping/stores/datalayerStore.ts` — Zustand persisté par profil (`dk_datalayer_mapping_v1_${profileId}`), même pattern que `useGTMStore`
- `src/data/datalayer-mock.ts` — jeu de données basé sur le cas réel Noviscore (devise codée en dur, events disparus après une mise à jour, tags Ads dupliqués)
- Pages : `DataLayerMappingPage.tsx` (onglets Events/Variables/Dictionnaire/Alertes, KPI en tête de l'onglet Events), `DatalayerKanbanPage.tsx` (Kanban par page, voir plus bas)

**Phase B (collecteur temps réel → Supabase)** — conçue, pas encore implémentée :
- `src/features/datalayer-mapping/gtm-tag/dl-mapping-collector.html` — tag GTM **Custom HTML** (pas Custom Template Sandboxed JS — voir "Décision technique" plus bas). Override non-destructif de `dataLayer.push`, anonymisation client-side avant envoi, buffer+flush groupé
- Schéma Supabase détaillé dans le PRD §9 : `datalayer_events`/`datalayer_variables`/`datalayer_dictionary` (snapshot courant) + `datalayer_variable_daily` (rollup quotidien, conservé indéfiniment, indépendant du volume de trafic) + `datalayer_raw_pushes` (échantillon plafonné par site/event/jour — **pas** un log exhaustif du trafic, un vrai chiffre terrain PFS/TK à 400K events GA4/jour a invalidé cette approche)

## Décision technique importante : Custom HTML, pas Custom Template

Le Sandboxed JS des Custom Templates GTM ne peut **pas** intercepter `dataLayer.push()` de façon vivante — `copyFromWindow` renvoie une copie, pas une référence, et aucune API sandboxée ne permet d'injecter une fonction du bac à sable comme méthode native d'un objet de la page. C'est la frontière de sécurité du sandbox elle-même. Le collecteur doit être un tag **Custom HTML** (JS classique, contexte réel de la page).

## Le cas d'usage concret de "Package"

Ce collecteur répond à la question "à quoi sert le mécanisme Package de dk-gtm-manager ?" : DK l'écrit une fois, l'encapsule dans un Package, et le déploie en masse sur tous les containers PFS via le flux Diff→Déployer déjà durci.

## Bouton "Créer dans GTM"

Quand une variable est détectée sans équivalent GTM, un bouton propose de créer variable + trigger + tag. Publié via **`applyContainerQueue`** (nouvelle 5ème file `pendingEntityCreations`/`EntityCreationOperation` dans `gtm-store.ts`), pas via le flux Package — un seul container cible à la fois, pas de propagation multi-container à faire ici. Bénéficie des mêmes garde-fous que le reste de l'app (activation built-in variables, résolution `firingTriggerId`).

## Plan Kanban par page

`DatalayerKanbanPage.tsx` — colonnes = pages/étapes du parcours (Product Listing, Product Page, Cart, Checkout, Confirmation Page…) plutôt qu'events isolés.

- **`pageRouter.ts`** — cascade de classification : flag sémantique (`page_type`) → regex URL (`page_location`) → event transversal (>3 colonnes → "Global / All Pages") → bac à sable ("Unclassified / Custom")
- **Vue Master** (par défaut) : plan agrégé sur tous les sites du client, badges de couverture ("✅ validé sur N containers" / "🔴 échoue chez N partenaires"), comparateur de structures (clic sur un badge d'échec → liste les clés réellement transmises par site, révèle les divergences de nommage)
- **Vue Partenaire** : sélection d'un site → mêmes colonnes, données 100% réelles de ce site
- **Focus Mode** : isole le funnel e-commerce (`view_item_list → view_item → begin_checkout → purchase`), ligne de flux qui casse visuellement si la complétion d'une étape passe sous 95%
- **Tiroir latéral** (`EventDetailDrawer.tsx`) au clic sur une carte — réutilise le pattern déjà en place (`EventChainDrawer`/`TagDrawer`), pas un nouveau composant inventé

## Ce qui a été écarté en cours de route

- **Bookmarklet** (capture manuelle ponctuelle) — remplacé par le collecteur temps réel
- **Onglet Dashboard séparé** — seulement 4 KPI, jugé redondant ; remontés en tête de l'onglet Events
- **Historique brut exhaustif en Phase B** — invalidé par un vrai chiffre de trafic (400K events/jour sur un seul site PFS) ; remplacé par rollup quotidien + échantillon plafonné
