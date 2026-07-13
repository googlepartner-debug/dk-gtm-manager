# PRD — DataLayer Mapping

**Version** : 0.1
**Date** : 2026-07-09
**Auteur** : Digital Keys
**Statut** : Brouillon — décisions de cadrage prises, détails d'implémentation à affiner

---

## 1. Contexte & problème

L'audit du dataLayer d'un site (quelles variables sont réellement poussées, avec quel taux de fiabilité, quels events sont cassés) se fait aujourd'hui manuellement — captures réseau (Omnibug), lecture de code, tableurs remplis à la main. C'est le travail qui vient d'être fait pour l'audit Noviscore (4 domaines), et qui a permis de trouver des bugs réels : devise codée en dur, events `add_shipping_info`/`add_payment_info` disparus du dataLayer, intégration Brevo qui reçoit une commande vide.

**Besoin** : automatiser cette collecte et cette analyse — remplacer l'audit ponctuel manuel par un monitoring continu du dataLayer réel, avec un taux de complétion par variable et une détection automatique des anomalies.

**Lien avec dk-gtm-manager** : ce module est un nouvel onglet de l'application GTM Monitoring existante (React/Vite/TS/Tailwind v4/Zustand), pas un projet séparé. Un « site » ici correspond au même référentiel que les containers GTM déjà gérés dans dk-gtm-manager (même ID) — permet de croiser à terme "ce que le site pousse réellement" avec "ce que GTM lit".

---

## 2. Utilisateurs

| Phase | Utilisateur | Accès |
|---|---|---|
| v1 | Digital Keys uniquement | Interne, aucun accès client |
| Prévu, non daté | Client final (ex. PFS, Noviscore) | Même logique que GTM Bulk Manager : lien envoyé, auth Google, dashboard en lecture (voire saisie dictionnaire) |

**Implication de conception** : ne pas coder de rôles/permissions en v1, mais éviter de coupler l'UI à une hypothèse "DK only" qui rendrait l'ouverture au client difficile ensuite (ex. ne pas mélanger des données multi-clients dans un même écran sans sélecteur de client déjà présent — ce sélecteur existe déjà dans le doc source, section Page principale).

---

## 3. Modèle de données — clientId et sites

- Un **client** (`clientId`) regroupe plusieurs **sites/domaines**.
- Un **site**, à l'intérieur d'un client, correspond au même container GTM que celui géré dans dk-gtm-manager (même identifiant) — même référentiel, pas un ID parallèle.
- Exemple : le client "Noviscore" contiendrait 4 sites (.fr, .de, .es, .com), chacun mappé sur son container GTM respectif.
- **Lien avec dk-gtm-manager (décision prise)** : `siteId` = `containerId` GTM par défaut (clé dure, un seul référentiel). Un champ optionnel de correspondance manuelle reste disponible pour les cas où un site n'a pas encore de container GTM géré (ex. site en cours d'onboarding, pas encore dans dk-gtm-manager).

---

## 4. Pipeline de collecte

### 4.1 Séquencement (décision prise)

Pour ne pas bloquer le développement de l'app pendant que l'infrastructure backend se met en place :

1. **Phase A — maintenant, zéro backend** :
   - **Données simulées** : un jeu de données mock (`MOCK_DATALAYER_EVENTS`, même principe que `monitoring-mock.ts` déjà présent dans le repo) permet de construire et démontrer toute l'UI/analyse immédiatement, sans dépendre d'un vrai site.
   - **Capture réelle sans BDD** : un **bookmarklet** (script JS déclenché depuis la barre de favoris) lit `window.dataLayer` en direct sur le site ouvert et génère un JSON exportable (téléchargement ou presse-papiers). Ce JSON est ensuite importé dans l'app. Ne nécessite ni tag GTM, ni Apps Script, ni Sheets, ni backend — juste le navigateur et l'app.
2. **Phase B — en parallèle, sans bloquer la Phase A** : mise en place du pipeline temps réel — un tag GTM personnalisé pousse chaque `dataLayer.push()` directement vers une base de données (Supabase envisagé, pas encore configuré).
3. **Bascule** : une fois la Phase B opérationnelle, l'app change sa source de lecture (import manuel → requête directe sur la base) sans réécrire la couche d'analyse (types, statistiques, détection d'anomalies), qui reste identique quelle que soit la source.

### 4.2 Conséquence architecturale importante

Le doc de départ (v1.3 Gemini) prévoyait IndexedDB + une couche d'abstraction `DataService.ts` pour anticiper un futur backend. **Cette anticipation n'a plus lieu d'être** : le vrai backend (Supabase, Phase B) est un objectif concret de la v1, pas une hypothèse lointaine. Donc :
- Phase A (import manuel) : `localStorage` suffit, comme dans le doc original — volumes bornés (`MAX_UNIQUE_VALUES = 20`), pas besoin d'IndexedDB pour ça.
- Phase B (Supabase branché) : l'app lit directement depuis Supabase, elle n'a plus besoin de stocker le flux brut de dataLayer localement.
- **Pas de couche d'abstraction `DataService.ts` à construire par anticipation** — coder directement pour Supabase quand Phase B démarre, plutôt que deviner une interface générique maintenant.

---

## 5. Règles métier et logique d'analyse

*(Reprises du doc v1.3, validées — voir aussi la revue faite avec Gemini)*

### 5.1 Alignement types & formats GA4
- `value`, `price`, `shipping`, `tax` doivent être de type `number`. Une chaîne (`"45.00"`, `"45€"`) déclenche une **Alerte Critique : GA4 Type Mismatch**.
- `currency` doit matcher une RegEx ISO 4217 (3 lettres majuscules).

*(Directement motivé par le bug réel trouvé chez Noviscore : devise codée en dur.)*

### 5.2 Taux de complétion (`percentCompleted`)
- Calcul : `(Nb Complétées / Nb Occurrences) × 100`.
- Valeurs considérées manquantes : `null`, `undefined`, `""`. **`0` et `false` sont des valeurs valides (complétées)**, pas des données manquantes.
- Seuil d'alerte : `ALERT_THRESHOLD = 95` (configurable).

### 5.3 Anonymisation RGPD — méthode combinée (pas restreinte)
- Détection par **deux méthodes combinées**, l'une n'excluant pas l'autre :
  - Nom de variable contient un mot-clé suspect (`SENSITIVE_KEYWORDS`)
  - **OU** valeur matche un pattern (regex email, regex téléphone FR/international)
- Le filet de sécurité par pattern de valeur s'applique à **toutes** les variables, pas seulement celles déjà repérées par mot-clé — sinon une variable mal nommée contenant un email (ex. `input_1`) ne serait jamais anonymisée.
- Masquage avant tout stockage, y compris côté source.

*(Écart assumé avec la v1.3 Gemini, qui restreignait le scan par pattern aux seules variables déjà matchées par mot-clé "pour la performance" — rejeté : le volume de données ici ne justifie pas d'affaiblir la détection RGPD.)*

### 5.4 Comportements SPA, timing, anti-pollution
- **Parsing isolé ligne par ligne** : chaque `.push()` traité atomiquement, jamais un état fusionné de `window.dataLayer` global (évite les faux-positifs liés aux cinétiques SPA).
- **Validation chronologique** : un event e-commerce n'est valide que si `ecommerce` et `event` sont dans le même push (ou juste avant, non écrasé). Sinon → alerte *Asynchronous DataLayer Split*.
- **Tableau/objet vide** (`items: []`, `{}`) compté comme donnée manquante, fait chuter `percentCompleted`.
- **Objets résiduels (stale)** : un event non-ecommerce (ex. `click_menu`) contenant un objet `ecommerce` résiduel d'une page précédente déclenche une alerte *Stale dataLayer object detected*.

### 5.5 Notation e-commerce (wildcard)
Les occurrences de tableaux e-commerce sont regroupées sous une notation globale `ecommerce.items[*].item_name` plutôt que par index, pour éviter la démultiplication des entrées du dictionnaire.

### 5.6 Catégorisation GA4 & filtrage
- Catégorisation automatique par event name (`ecommerce`, `engagement`, `generation_leads`, `gaming`, ou `custom`).
- Exclusion de la collecte : tout ce qui commence par `gtm.`/`gtm_`, tout ce qui contient `cookie`.

---

## 6. Synergie avec GTM Bulk Manager (bouton "Créer dans GTM")

**Décision prise : inclus en v1**, et plus large que prévu initialement — le bouton crée **variable + tag + trigger**, pas seulement une Data Layer Variable isolée.

### 6.1 Ce que ça fait
Quand une variable est détectée dans le vrai dataLayer d'un site sans équivalent côté GTM (pas de Variable GTM pointant sur ce chemin), un bouton `[+] Créer dans GTM` propose de générer l'ensemble variable + tag + trigger correspondant, et de le déployer sur le container cible.

### 6.2 Mécanisme d'injection (décision prise)

dk-gtm-manager a deux familles de mécaniques de publication, pas une seule :
- **Package / Diff / Déployer** (`deploy()`) : conçu pour propager un changement validé sur **N containers** (Turkish → 20 partenaires PFS). Sélection de package, sélection de containers, diff, déploiement en masse.
- **File unifiée Monitoring** (`applyContainerQueue`) : conçu pour des actions ponctuelles sur **un seul container à la fois** (renommages, actions déclencheurs, duplications tag/variable), agrégées et publiées via un bouton "Publier" unique par container.

Le cas DataLayer Mapping (une variable détectée manquante sur **le container correspondant au site dont le dataLayer vient d'être capturé**) correspond exactement à la deuxième famille, pas à la première : il n'y a qu'un seul container cible, pas de propagation à faire. Router ça dans le flux package (comme envisagé dans un premier temps) aurait ajouté de la friction UI pour un bénéfice nul.

**Décision** : ajouter une 5ème file à `applyContainerQueue`, aux côtés des 4 existantes (renames, trigger ops, duplications tag, duplications variable) :

- Nouveau type `EntityCreationOperation` : `{ id, containerId, containerName, publicId, variable: GTMVariable, trigger?: GTMTrigger, tag?: GTMTag, sourceFeature: 'datalayer-mapping', status, createdAt, error? }` — `trigger`/`tag` optionnels selon ce qui manque réellement (parfois seule la variable est absente, tag/trigger existent déjà).
- Nouvelle queue `pendingEntityCreations`, même pattern que `pendingVariableDuplications`.
- Dans `applyContainerQueue`, nouvelle étape "5. Créations d'entités" : pour chaque opération de ce container, créer variable → créer trigger (si fourni) → créer tag (si fourni, avec `firingTriggerId` résolu vers l'ID réel du trigger qu'on vient de créer dans la même opération — même logique que celle ajoutée dans `deploy()` pour la résolution nom→ID).
- **Correction à porter en même temps** : `applyContainerQueue` n'active aujourd'hui **jamais** les built-in variables avant de créer une entité (contrairement à `deploy()`, corrigé precédemment) — ajouter le même appel à `detectRequiredBuiltInVariables` + activation avant la création, sinon ce nouveau chemin réintroduit le bug qu'on vient de fixer ailleurs.
- Le bouton `[+] Créer dans GTM` dans DataLayer Mapping appelle une nouvelle action de store `addEntityCreation(...)` — l'opération apparaît alors dans le même panneau "Actions en attente" que Monitoring alimente déjà sur la page Déployer, avec le même bouton "Publier" unifié par container.

---

## 7. Concepts & glossaire

| Terme | Définition |
|---|---|
| Event | Un `dataLayer.push()` avec un nom d'event, catégorisé automatiquement selon la nomenclature GA4 |
| Variable | Un chemin de donnée dans un event (notation pointée, wildcard pour les tableaux) |
| % Complété | `(Nb Complétées / Nb Occurrences) × 100` |
| Priorité | Critique / Important / Normal / Optionnel — assignée manuellement |
| Statut de validation | À valider / Validé / Problème — état manuel |
| Alerte | Variable sous le seuil de complétion, ou anomalie de type/structure détectée |
| Dictionnaire | Définitions manuelles des variables, saisies par le consultant |
| Site | Correspond à un container GTM existant dans dk-gtm-manager (même référentiel) |

---

## 8. Hors scope v1

- Accès client (prévu, non daté)
- Connexion Supabase effective (Phase B, en parallèle, pas bloquante pour la Phase A)
- Historique des changements, comparaison avant/après (V2)
- Notifications email/Slack (V3)
- Workflow de validation multi-étapes (V3)
- Couche d'abstraction générique de service de données (rejetée — voir §4.2)

---

## 9. Schéma Supabase (Phase B)

**Une seule Edge Function partagée**, pas de config par client — chaque tag GTM (un par site) envoie vers la même URL avec un paramètre `siteId` (= `containerId` GTM, voir §3). Zéro infra dupliquée par client.

### 9.1 Le collecteur est un tag Custom HTML, pas un Custom Template Sandboxed JS (correction)

Décision initiale (issue d'une proposition Gemini) écartée après vérification technique : le Sandboxed JS des Custom Templates GTM **ne peut pas** intercepter `dataLayer.push()` de façon vivante — `copyFromWindow` renvoie une copie, pas une référence, et il n'existe aucune API sandboxée pour injecter une fonction du bac à sable comme méthode native d'un objet de la page. C'est la frontière de sécurité du sandbox elle-même, pas une limite contournable.

**Le collecteur est donc un tag GTM de type HTML personnalisé** (JS classique, contexte réel de la page) : `src/features/datalayer-mapping/gtm-tag/dl-mapping-collector.html`. Il enveloppe `dataLayer.push` de façon non-destructive (sauvegarde l'original, l'appelle toujours, GTM continue de fonctionner normalement) plutôt que de le remplacer.

**Ce collecteur répond directement à la question "à quoi sert le Package ?"** : DK l'écrit une fois, l'encapsule comme n'importe quel tag dans un Package (variable/trigger/tag), et le déploie en masse sur tous les containers PFS via le flux Diff→Déployer déjà durci — c'est le cas d'usage concret du mécanisme Package, pas un exemple abstrait.

**Mode local (2026-07-13, en attendant la Phase B) — pas d'endpoint réseau requis pour commencer un vrai audit.** Le buffer s'accumule dans le `localStorage` du site audité plutôt que d'être envoyé à une Edge Function (qui n'existe pas encore). Deux fonctions exposées sur `window` pendant une session d'audit : `__dlMappingExport()` télécharge un JSON, `__dlMappingClear()` vide le buffer. Le JSON s'importe ensuite dans l'outil via le bouton "Importer un export" (page DataLayer Mapping) — `src/features/datalayer-mapping/utils/importCollectorExport.ts` recalcule events/variables/anomalies à partir des occurrences brutes, en préservant priorité/statut/notes déjà saisis à la main sur un événement déjà connu. Quand la Phase B existe, seule la fonction `flush()` du tag change (écriture réseau au lieu de `localStorage`) — tout le reste (interception, anonymisation, détection d'anomalies) ne bouge pas.

### 9.2 Anonymisation — deux couches, pas une seule (écart assumé par rapport à la décision initiale)

La décision initiale ("server-side uniquement, dans l'Edge Function") supposait que la donnée brute pouvait transiter jusqu'au serveur avant d'être masquée. En écrivant le collecteur, ce n'est plus tenable tel quel : envoyer un email en clair en HTTPS jusqu'à l'Edge Function, même si elle l'anonymise à la réception, viole le principe de minimisation déjà posé ailleurs dans ce PRD ("aucune donnée personnelle en clair ne doit être stockée, même côté source").

**Décision révisée** : anonymisation en deux couches.
- **Client (tag Custom HTML)** : masquage immédiat avant tout envoi réseau — la donnée brute ne quitte jamais le navigateur. Règles dupliquées en JS vanilla dans le tag (`SENSITIVE_KEYWORDS` + regex email/téléphone), pas d'import possible depuis l'app.
- **Serveur (Edge Function)** : filet de sécurité, au cas où une règle du tag serait incomplète ou pas encore republiée partout.

**Point d'attention explicite** : les deux implémentations (TS dans l'app, JS vanilla dans le tag) doivent rester synchronisées manuellement — pas de source unique possible ici, contrairement à ce qui était supposé initialement. Un changement de règle RGPD nécessite de mettre à jour les deux, et de republier le tag sur tous les containers (via Package/Déployer) pour que le changement soit effectif partout.

### 9.3 Batching — jamais une requête HTTP par event

Le collecteur bufferise les occurrences (`FLUSH_INTERVAL_MS = 5000`, `MAX_BUFFER_SIZE = 20`) et envoie un batch groupé plutôt qu'un ping par `dataLayer.push()` — sur un site à trafic réel, une requête par event aurait saturé l'Edge Function inutilement. Flush forcé sur `pagehide` via `navigator.sendBeacon` pour ne pas perdre le buffer en cours à la fermeture de l'onglet.

### 9.4 Tables — correction : historique nécessaire pour l'alerting (écart par rapport à la décision initiale)

**Le choix initial ("pas de table raw pushes, upsert/incrément direct sur un compteur cumulé") était insuffisant.** Un compteur cumulé depuis le début des temps ne permet pas de répondre à "le taux de complétion a chuté quand exactement ?" — exactement le diagnostic qui a permis de trouver la régression Noviscore du 14 avril. Sans dimension temporelle, aucune alerte de dégradation n'est possible, et la comparaison avant/après (déjà listée en V2, §8) ne pourra jamais être reconstruite rétroactivement si la donnée n'a pas été captée dès la Phase B.

**Décision révisée — 5 tables, pas 3** :
- `datalayer_events` — miroir de `DatalayerEvent`, snapshot courant (une ligne par site/event), alimente le Dashboard "maintenant"
- `datalayer_variables` — miroir de `DatalayerVariable`, snapshot courant (une ligne par site/event/variable)
- `datalayer_dictionary` — miroir de `DictionaryEntry`
- **`datalayer_variable_daily`** (nouveau) — rollup quotidien : une ligne par (site, event, variable, **jour**) avec occurrences/complétion de ce jour précis. Alimente les courbes de tendance et l'alerting ("le taux a chuté par rapport à la moyenne des 7 derniers jours"). Conservé **indéfiniment, sans compression hebdo/mensuelle** (décision : pire cas assumé, pas d'optimisation de rétention pour l'instant).
- **`datalayer_raw_pushes`** (nouveau) — un enregistrement par occurrence reçue (payload aplati anonymisé), pour pouvoir rejouer/inspecter le détail exact d'un jour précis pendant un debug. Conservé **indéfiniment** (même décision — pas de purge automatique en v1).

**Partitionnement dès la création, pas en rattrapage** : `datalayer_raw_pushes` et `datalayer_variable_daily` doivent être créées avec un partitionnement Postgres natif par date (mensuel) dès le départ. Ajouter une politique de rétention/purge plus tard sur une table déjà partitionnée est une opération triviale (`DROP PARTITION`) ; le faire sur une table de plusieurs centaines de millions de lignes non partitionnée ne l'est pas.

**Pas de table "alertes"** : les alertes restent calculées à la volée (requête sur `percentCompleted < ALERT_THRESHOLD`, ou sur `datalayer_variable_daily` pour une alerte de tendance), pas un état stocké séparément.

### 9.5 Dimensionnement chiffré (pire cas — pas de purge, pas de compression)

Hypothèses : ~750 variables suivies/site, dictionnaire ~100-150 entrées/client (partagé entre sites).

| Table | Échelle actuelle (Noviscore, 4 sites) | Échelle agence complète (~80 sites cumulés) |
|---|---|---|
| `datalayer_events` + `datalayer_variables` (snapshot courant) | ~4 Mo | ~90 Mo |
| `datalayer_variable_daily` (rollup, indéfini) | ~1,1 Mo/an | ~22 Mo/an |
| `datalayer_raw_pushes` (brut, indéfini) — hypothèse 2 000 events/jour/site en trafic réel | **~1,5 Go/an** | **~45-75 Go/an**, selon trafic réel des sites |

**Le poste qui compte, c'est `datalayer_raw_pushes`, pas le reste.** Sur l'échelle actuelle (un seul client, 4 sites), c'est un non-sujet même sur plusieurs années. À pleine échelle agence (80 sites à trafic réel cumulé), on parle de dizaines de Go par an — gérable sans problème sur un VPS que tu possèdes déjà (contrairement à un stockage Supabase managé facturé au Go), mais ça confirme que le partitionnement mensuel (§9.4) n'est pas optionnel passé ce volume : au-delà de quelques centaines de millions de lignes, les requêtes sur une table non partitionnée deviennent lentes indépendamment de l'espace disque disponible.

**Pas de purge automatique construite en v1** (décision assumée) — si le volume réel dépasse ce qui est confortable sur le VPS, le partitionnement déjà en place permet d'ajouter une politique de rétention (ex. purger `datalayer_raw_pushes` au-delà de 90 jours, garder `datalayer_variable_daily` indéfiniment) sans réécriture de schéma.

### 9.6 Alerting sur baseline glissante (backlog Phase B — inspiré d'un outil concurrent, Trooper)

**Constat (2026-07-13)** : l'alerting actuel prévu (§9.4) n'est qu'une intention documentée, pas un algorithme spécifié. Un outil comparable (Trooper, audit quotidien GA4/Piano) montre trois éléments concrets à intégrer, **aucun ne dépend de BigQuery** — tous reposent sur notre propre collecteur (§9.1) donc valables pour n'importe quel client, avec ou sans export GA4 BigQuery activé :

1. **Déviation % vs moyenne glissante 7 jours**, calculée sur `datalayer_variable_daily` : pour chaque (site, event, variable), comparer le `percentCompleted`/`occurrences` du jour à la moyenne des 7 jours précédents. Formule simple : `deviation = (valeur_du_jour - moyenne_7j) / moyenne_7j`. C'est la brique manquante pour que la phrase déjà écrite en §9.4 ("le taux a chuté par rapport à la moyenne des 7 derniers jours") devienne un vrai calcul, pas juste une intention.

2. **Volumétrie d'événement comme signal indépendant** — à date, seule la *complétion des paramètres* est suivie. Le volume brut d'un event (nb de fois où il a été poussé ce jour vs sa moyenne 7j) est un signal différent et complémentaire (ex. `purchase` qui chute de 30% en volume peut être normal côté paramètres mais catastrophique côté business). Nécessite un rollup quotidien **par event** (pas seulement par variable) — soit une agrégation à la volée sur `datalayer_raw_pushes`, soit une table `datalayer_event_daily` dédiée (site, event, jour, nb_occurrences) si l'agrégation à la volée s'avère trop coûteuse en lecture.

3. **Badge à deux états (Anomaly / OK — dans la variance)** dans l'onglet Alertes, plutôt qu'un pourcentage brut à interpréter — même logique de seuils colorés que `CoverageBar` (§7 concepts), étendue à la déviation plutôt qu'à la seule complétion instantanée.

**Réduction des faux positifs (volontairement plus simple que le "consensus de 7 algorithmes" de Trooper)** : ne déclencher une alerte que si **plusieurs conditions simples sont réunies en même temps**, pas une seule — ex. déviation au-delà d'un seuil ET persistante sur ≥2 jours consécutifs ET volume absolu au-dessus d'un plancher de bruit (éviter qu'un event à 3 occurrences/jour déclenche une alerte à chaque fluctuation normale). Objectif : un signal combiné simple et explicable, pas une boîte noire à plusieurs modèles.

**BigQuery — optionnel et complémentaire, pas la source par défaut** : tous les clients n'ont pas l'export GA4 BigQuery activé, donc le collecteur custom (§9.1) reste la seule source **universelle** — c'est lui qui doit porter les points 1 à 3 pour que l'alerting marche partout. Mais pour la volumétrie précisément (point 2), BigQuery a un vrai avantage quand il est disponible : c'est l'event déjà traité côté serveur par GA4 (dédupliqué, filtré des bots), donc à l'abri des pertes classiques du comptage client-side (adblockers, script qui échoue à charger, JS cassé avant même que le push n'atteigne le collecteur) qui peuvent faire sous-compter le collecteur. À prévoir en V2 comme source de volumétrie alternative/de recoupement pour les clients qui l'ont déjà (Noviscore, PFS probablement) — sans en faire une dépendance bloquante pour les autres.

**Statut** : idées à cadrer plus précisément avant implémentation — pas encore de schéma de table `datalayer_event_daily` ni de spécification exacte des seuils. Priorité proposée : point 1 (déviation vs baseline) d'abord, il ne demande aucune nouvelle table.

---

## 10. DataLayer Flow Chart — réutilisation d'EventsPage (décision prise)

dk-gtm-manager a déjà le pattern demandé : `EventsPage` fait un drill-down à 3 niveaux (event → trigger → variable) avec `ScoreDots`, `CoverageBar`, `EventChainDrawer` — sourcé depuis la config GTM déclarée.

**Décision** : adapter ces composants existants pour lire les données DataLayer Mapping (le vrai dataLayer capturé) plutôt que construire un nouveau composant "Node-to-Node" dédié. Même niveau de drill-down (event → variable → état GTM), mêmes codes couleur (vert/orange/rouge selon santé de la donnée), source de données différente. Réduit fortement le coût d'implémentation et évite de maintenir deux systèmes de visualisation qui se ressemblent mais divergent avec le temps.

---

## 11. Bookmarklet — abandonné, remplacé par le collecteur (§9.1)

Le bookmarklet (capture manuelle ponctuelle par le consultant) est abandonné au profit du collecteur temps réel (tag Custom HTML, §9.1) qui couvre le même besoin — capturer le vrai dataLayer — sans dépendre d'une action manuelle répétée par site. La Phase A (données mock, §4.1) reste le moyen de construire/démontrer l'UI en attendant que le collecteur + Supabase (Phase B) soient déployés.

---

## 12. Séquence de création dans `EntityCreationOperation` (§6.2, précision)

Au sein d'une même opération, variable → trigger → tag sont traités comme une **séquence dépendante dans une seule fonction async**, pas comme 3 files indépendantes :
1. Créer la variable (si absente) → obtenir son nom (déjà connu, pas d'ID à propager).
2. Créer le trigger (si absent) → récupérer l'ID réel retourné par l'API GTM.
3. Créer le tag (si fourni) avec `firingTriggerId` résolu vers l'ID réel obtenu à l'étape 2 — jamais vers un nom ou un ID d'un autre container (même logique que la résolution ajoutée dans `deploy()`).

Si une étape échoue (ex. trigger non créé), les étapes suivantes de la même opération sont annulées plutôt que de créer un tag orphelin sans déclencheur valide.

---

## 13. Structure des fichiers (ajustée §10 — réutilisation d'EventsPage)

```
src/features/datalayer-mapping/
├── components/     (Tables, Badges, Modals — pas de FlowChart dédié, voir §10)
├── stores/         (datalayerStore.ts — Zustand, localStorage en Phase A)
├── types/          (datalayer.types.ts)
├── utils/          (categorization, anonymization, dataTransform)
├── hooks/          (useDatalayerData)
├── constants/      (ga4Events.ts)
└── pages/          (DatalayerMappingPage.tsx)

src/pages/EventsPage.tsx           — étendu pour lire une source DataLayer Mapping en plus de la config GTM
src/components/events/             — ScoreDots/CoverageBar/EventChainDrawer réutilisés, pas dupliqués
```

---

## 14. Vue Kanban par page (Recette & Audit visuel)

Proposition initiale par Gemini (inspiration Dribbble, colonnes = pages/étapes du parcours au lieu d'events isolés). Revue et cadrée ci-dessous — décisions prises et écarts assumés par rapport à la proposition d'origine.

### 14.1 Coexistence avec le drill-down existant (décision prise)

Le Kanban **ne remplace pas** le drill-down event→variable construit en §10/§12 (réutilisation d'EventsPage) — les deux coexistent, usages différents :
- **Drill-down (Events, existant)** : debug fin d'un event précis, variable par variable.
- **Kanban (nouvel onglet)** : vue macro de recette, organisée par page/étape du parcours plutôt que par event isolé.

Même socle de données (`DatalayerEvent`/`DatalayerVariable`/nouvelle notion d'occurrence, §14.2) — deux façons de le regarder, pas deux systèmes séparés à maintenir.

### 14.2 Modèle de données — tracking par occurrence (décision prise, changement structurant)

Le modèle actuel (`DatalayerEvent` agrégé par site+event, sans notion de page) ne permet pas de classer un event par colonne — `pageRouter.ts` (§14.3) a besoin de savoir sur **quelle page** chaque push a eu lieu.

**Décision** : passer à un tracking par occurrence plutôt qu'un seul agrégat par event. Un même event (ex. `view_item`) peut apparaître dans plusieurs colonnes selon la page où il a été vu — plus fidèle à la réalité qu'une "page dominante" unique, au prix d'un modèle plus lourd.

Nouveau type, à ajouter à `datalayer.types.ts` :

```typescript
export interface DatalayerEventOccurrence {
  id: string;
  clientId: string;
  siteId: string;
  eventName: string;
  pageType?: string;      // flag sémantique explicite si présent dans le payload (page_type, pageCategory)
  pageLocation?: string;  // URL brute, utilisée par le fallback regex si pageType absent
  detectedAt: string;     // ISO — remplace la paire firstDetection/lastDetection à l'échelle de l'agrégat
  variablesSnapshot: Record<string, unknown>; // payload aplati de ce push précis, anonymisé
}
```

`DatalayerEvent`/`DatalayerVariable` (agrégats) restent inchangés pour le Dashboard/Alertes/drill-down — les occurrences alimentent en plus le Kanban et peuvent, en Phase B, recalculer les agrégats plutôt que les dupliquer.

### 14.3 `pageRouter.ts` — cascade de classification (repris tel quel, bonne idée)

1. **Flag sémantique** — si `pageType`/`pageCategory` présent dans l'occurrence, l'utiliser directement.
2. **Regex URL** — à défaut, analyser `pageLocation` (ex. `/search|résultats/` → colonne Search Results, `/hotel/|/vol/` → Product Page, event `purchase` → Confirmation Page).
3. **Transversaux** — un event détecté sur plus de 3 types de page différents lors d'un import est extrait vers une colonne fixe "Global / All Pages" plutôt que dupliqué dans chaque colonne.
4. **Bac à sable** — tout ce qui ne matche rien atterrit dans "Unclassified / Custom", réassignable à la main par glisser-déposer.

Implémentation directe dans `src/features/datalayer-mapping/utils/pageRouter.ts`, en entrée `DatalayerEventOccurrence[]`, en sortie un regroupement par colonne.

### 14.4 Vue Master + Vue Partenaire dès la v1 (décision prise, avec réserve)

Contrairement à la recommandation initiale (Vue Partenaire seule d'abord, Vue Master ensuite), **les deux sont construites dès cette itération**. Implication assumée : la Vue Master (agrégation multi-sites, badges "✅ validé sur 18 containers", comparateur de structures entre partenaires en échec) est une **nouvelle capacité de store**, pas une couche d'affichage au-dessus de l'existant — `getSiteDashboard` actuel est mono-site, il faut une fonction d'agrégation cross-sites en plus. À chiffrer comme tel dans le planning, pas comme un simple habillage UI du Kanban mono-site.

- **Vue Master (par défaut)** : colonnes = plan de marquage théorique du container pilote. Badge par carte = statut agrégé sur l'ensemble des sites du client.
- **Comparateur de structures** : au clic sur un badge d'échec, liste les sites en faute avec leur structure réelle divergente (ex. Air France envoie `price`, Transavia envoie `tarif`) — compare les **occurrences réelles capturées**, pas la config GTM (à ne pas confondre avec le diff de containers déjà existant dans Monitoring/dk-gtm-manager, qui compare de la config déclarée, pas du dataLayer réel).
- **Vue Partenaire** : sélection d'un site dans le header → mêmes colonnes, données à 100% celles du site sélectionné (`percentCompleted`, anomalies réelles).

### 14.5 Statut de validation humaine — localStorage, pas de dépendance Supabase (décision prise)

Comme `status`/`priority` déjà existants sur `DatalayerEvent`, le statut de validation humaine sur les cartes Kanban reste en localStorage (Phase A) — pas de dépendance à Supabase pour livrer cette vue. La synchronisation multi-consultant arrivera naturellement avec la Phase B, sans bloquer le Kanban avant.

### 14.6 Fonctionnalités UX (reprises, priorité secondaire)

- **Focus Mode** (filtre funnel GA4 : `view_item_list → view_item → begin_checkout → purchase` en surbrillance, ligne de flux qui se brise si `percentCompleted < 95%`) — polish visuel, à traiter après la mécanique de classification/agrégation, pas avant.
- **Filtres d'intention** (E-commerce Only / Errors Only) — filtrage simple sur les données déjà présentes, faible coût.
- **Témoin de fraîcheur** (point vert < 24h / gris > 7 jours) — calculé directement depuis `detectedAt` (§14.2), pas de nouvelle donnée nécessaire.
- **Slide-over Drawer** — réutilise le pattern déjà en place (`EventChainDrawer`/`TagDrawer`), pas un nouveau composant à inventer. Contient le dictionnaire, le template avec placeholders (`generateTemplate`, déjà écrit §5), et le bouton `[+] Créer dans GTM` (déjà câblé en §12, à déplacer visuellement dans le drawer plutôt que la ligne de tableau du drill-down actuel).

### 14.7 Points ouverts

1. ~~Bookmarklet et futur tag GTM→Supabase doivent capturer pageType/pageLocation~~ — **résolu** : le collecteur (§9.1) capture `pageLocation` (`window.location.href`) et `pageType` (clé `page_type`/`pageCategory` si présente) sur chaque occurrence.
2. **Volume de données — résolu côté Phase B** (§9.4/§9.5 : tables `datalayer_variable_daily`/`datalayer_raw_pushes` partitionnées, dimensionnement chiffré). Reste ouvert côté **Phase A (localStorage)** uniquement : le tracking par occurrence va générer plus de lignes que le modèle agrégé initial — à borner (ex. purge des occurrences mock/importées les plus anciennes) puisque localStorage n'a pas la marge d'un VPS.
3. **Fonction d'agrégation cross-sites** (Vue Master, §14.4) : implémentée en v0 (`getEventCoverage` — tolérance nulle, un seul site en échec suffit à marquer l'event en rouge) — à affiner si un seuil de tolérance (type "18/21 = OK") s'avère plus pertinent à l'usage.
4. **Synchronisation des deux couches d'anonymisation** (§9.2, TS app vs JS vanilla du tag) — pas de garde-fou automatique aujourd'hui pour détecter une divergence entre les deux implémentations.
