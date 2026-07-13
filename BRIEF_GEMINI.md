# DK GTM Manager — Brief pour revue externe (Gemini)

> Ce document est destiné à être partagé tel quel avec un autre modèle IA (Gemini) pour obtenir des observations et recommandations sur l'outil. Il résume le contexte, le problème résolu, les fonctionnalités (livrées + planifiées), l'architecture, l'état actuel et les points ouverts.

---

## 1. Contexte & problème

**DK GTM Manager** est un outil interne développé par Digital Keys (agence conseil GTM/analytics) pour un client, **PerfectStay (PFS)** — un acteur du voyage qui opère **10 à 30 sites web** (un par partenaire de distribution : Air France, Transavia, Turkish, etc.), tous partageant **le même dataLayer** mais avec des containers Google Tag Manager (GTM) séparés et une nomenclature qui diverge d'un container à l'autre.

**Problème métier concret** : un container de référence ("Turkish") concentre les évolutions de tracking. Aujourd'hui, propager un changement de tag/variable/déclencheur sur les 20+ autres containers se fait **manuellement dans l'UI GTM native**, container par container. Conséquences :
- Oublis fréquents (certains containers ne reçoivent pas la mise à jour)
- Incohérences entre containers
- Plusieurs heures de travail manuel par déploiement
- Aucune traçabilité (qui a déployé quoi, quand, sur quels containers)

**Objectif** : un outil web permettant à Digital Keys **et à PFS en autonomie** de synchroniser des tags/variables/triggers sur tous les containers cibles, avec un diff visuel avant tout déploiement, en passant de plusieurs heures à moins de 5 minutes.

---

## 2. Utilisateurs & modèle d'accès

| Profil | Auth | Rôle |
|---|---|---|
| Digital Keys | Compte Google DK | Crée/maintient les packages, déploie |
| PFS | Compte Google pro `@perfectstay.com` | Accès complet, déploie en autonomie |

- Authentification : Google OAuth (Google Identity Services), scopes `tagmanager.readonly` + `tagmanager.edit.containers` + `tagmanager.publish`
- **Aucun backend, aucune base de données** : 100% frontend, tokens dans le navigateur, packages et historique en `localStorage`
- **Profils multi-consultants** : le compte Google `googlepartner@digitalkeys.fr` est partagé entre plusieurs consultants DK en interne → chaque consultant a un profil local avec son propre namespace localStorage, pour ne pas mélanger packages/historique entre consultants qui utilisent le même compte Google
- Contrôle d'accès natif GTM : pas de rôles dans l'outil, les droits sont gérés en amont côté GTM (si un compte n'a pas les droits sur un container, l'API renvoie une 403)

---

## 3. Stack technique

| Couche | Choix |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| Style | Tailwind CSS v4 (config via `@theme` dans `index.css`, pas de `tailwind.config.ts`) |
| State | Zustand |
| Routing | React Router v7 |
| Auth | Google Identity Services (GIS) |
| API | GTM API v2 — appels directs depuis le navigateur, pas de proxy backend |
| Stockage | localStorage uniquement (packages, historique, profils) |
| Hosting | Vercel |

**Pattern clé du store** : chaque fonction de fetch accepte un `token` optionnel — si absent, fallback sur des données statiques (`gtm-static.ts`, ~160 comptes / 47 containers PFS mockés) pour pouvoir travailler/développer l'UI hors connexion OAuth réelle.

---

## 4. Fonctionnalités livrées (v1, testées sur compte réel depuis le 2026-07-09)

### 4.1 Déploiement par packages
- Un **package** = ensemble nommé de tags + variables + triggers au format JSON GTM natif (créations et modifications)
- Éditeur JSON inline, import/export, duplication, templates prêts à l'emploi (ex. "GA4 Ecommerce Standard")
- **Diff visuel avant déploiement** : l'outil compare le package à l'état réel de chaque container cible (workspace par défaut), classe chaque entité Nouveau / Modifié / Inchangé, affiche un diff JSON avant/après, sélection granulaire par case à cocher
- **Déploiement upsert** : POST si l'entité n'existe pas, PUT si elle existe déjà. Ordre garanti triggers → variables → tags (dépendances). Un workspace horodaté dédié est créé par déploiement (`DK Deploy - [version] - [date]`)
- **Isolation des erreurs** : un container qui échoue n'affecte pas les autres, marqué en rouge avec détail
- **Publication auto ou manuelle** (sécurité — PFS utilise plutôt le mode manuel)
- **Rollback** : republication de la version GTM qui était live avant le déploiement DK, disponible uniquement si publication auto avait été utilisée
- **Historique** : 50 derniers déploiements, détail par container, visible par tous les utilisateurs connectés

### 4.2 Monitoring (5 onglets : Tags / Déclencheurs / Variables / Paramètres / Nettoyage)
- Vue matricielle comparant l'état de toutes les entités à travers tous les containers sélectionnés
- **Renommages en masse** planifiés puis publiés en un clic
- **Duplication d'entités** (tags puis variables) depuis un container de référence vers un container où l'entité est absente
- **Actions déclencheurs** (`TagDrawer` > onglet Déclencheurs) : retirer un déclencheur d'un tag, ou **synchroniser** un container cible pour qu'il finisse identique à un container de référence (ajoute les déclencheurs manquants, retire les déclencheurs en trop, lie un déclencheur sémantiquement équivalent existant plutôt que d'en créer un doublon)
- **Nettoyage** : suppression d'entités orphelines/inutilisées avec modal de confirmation dédiée
- **Distribution** : diagramme de flux tag → plateforme de destination (GA4, Google Ads, Meta, TikTok, Microsoft Ads, Piano, Matomo, Hotjar, Clarity, CMP...), détection centralisée de plateforme (`gtm-matrix.ts`) réconciliant les incohérences réelles observées sur des comptes de test (types GTM non documentés, tags par template sans code, migration GA4 Config → googtag de 2023, variantes de nommage agence)
- **Recommandations** : moteur de règles priorisées (critique/attention/info) — PII non hashée envoyée à des plateformes tierces, Pixel/Conversion ID dupliqué (double comptage), Conversion Linker/Remarketing absents, valeur e-commerce codée en dur, couverture d'events GA4 inégale entre containers

### 4.3 EventsPage — dashboard drill-down par score
- Vue matricielle des events GA4 avec score par container : Absent / Trigger manquant / Variables manquantes / Complet
- Drill-down : event → détail par déclencheur → détail par variable, avec queue d'actions pour lier/créer une variable manquante depuis un container source

### 4.4 ContextePage
- Analyse d'un container (comptage tags/variables/triggers par catégorie) + timeline des versions publiées

### 4.5 Réplication de configuration entre containers (chantier récent, PRD v2.0 du 2026-07-07)
- **Diff entre deux versions publiées** d'un même container pilote (avant/après une évolution de dataLayer) → extraction du delta exact (créations + modifications, suppressions affichées mais jamais auto-sélectionnées) → génération d'un nouveau package prêt à déployer sur les autres containers
- Réutilise le moteur de diff déjà en prod plutôt que de capturer tout l'historique du container pilote (évite d'embarquer des différences sans rapport)

---

## 5. Sécurité & garde-fous

- Aucun secret stocké côté serveur — l'outil est 100% frontend
- Avertissement explicite avant publication auto sur des containers en production avec trafic réel
- Tokens non persistés entre sessions (reconnexion requise à chaque session)
- Gestion des quotas GTM API documentée (3 workspaces max/container, ~100 req/min, 100k req/jour) — v1 : pas de rate limiting automatique, affichage d'erreur + retry manuel si 429

---

## 6. État actuel (2026-07-09)

- OAuth Google opérationnel en production depuis le 2026-07-02 (contournement initial : réutilisation d'un projet GCP existant en attendant un nouveau slot GCP, un vrai blocage de quota a été rencontré)
- Première session de test intensif sur un **compte GTM réel** (client "Noviscore", 4 containers) le 2026-07-09 : nombreux bugs de détection corrigés en confrontant les hypothèses initiales aux vraies données (types GTM non documentés officiellement, structures de paramètres GA4 à deux conventions selon l'ancienneté du template GTM)
- Déploiement PFS pas encore réalisé — l'outil est en phase de validation interne avant démo PFS (voir plan de validation ci-dessous)

**Plan de validation avant démo PFS** :
1. DK teste en interne (déploiement sur le compte GTM PFS en mode publication manuelle)
2. Vérification dans GTM que les versions créées sont correctes
3. Vérification de l'historique dans l'outil
4. Déploiement sur Vercel, URL stable
5. Présentation PFS uniquement après validation interne complète

---

## 7. Hors scope volontaire (v1)

- Multi-clients (au-delà de PFS)
- Notifications email/Slack
- Backend partagé / base de données / audit log centralisé
- Séparation des historiques par utilisateur (partagé DK+PFS)
- Éditeur de conditions de trigger (changer une condition existante)
- Import/export de plan de tracking externe (Excel/Google Sheet) comme spec cible
- Renommage de clé de paramètre à l'intérieur d'un tag/variable
- Rate limiting automatique (prévu v1.1)

---

## 8. Risques connus identifiés par l'équipe

| Risque | Mitigation actuelle |
|---|---|
| PFS publie accidentellement en prod sans vérifier le diff | Avertissement explicite + publication manuelle par défaut pour PFS |
| Workspace GTM plein (3 max/container) | Message d'erreur clair |
| Quota API 429 sur beaucoup de containers | v1 : message + retry manuel seulement |
| Diff faux positif (entité marquée modifiée alors qu'identique) | Normalisation stricte des champs (exclusion IDs/fingerprint) |
| Token OAuth ne se renouvelle pas en plein déploiement | Arrêt propre + affichage des containers déjà traités |
| Résolution de plateforme (Distribution) pour un Google tag vivant dans un autre container que celui scanné | Limite connue, non résolue |

---

## 9. Ce qu'on attend de cette revue

Digital Keys cherche un regard extérieur (Gemini) sur cet outil, notamment :
- **Robustesse de l'architecture 100% frontend + localStorage** : est-ce défendable durablement pour un outil qui va gérer des déploiements de production chez un client, ou les limites (pas d'audit log centralisé, pas de séparation d'historique, pas de sauvegarde partagée fiable) deviennent-elles bloquantes rapidement ?
- **Modèle de sécurité** : le contrôle d'accès 100% délégué à GTM (pas de rôles dans l'outil) est-il suffisant, ou manque-t-il une couche de protection côté outil (ex. confirmation renforcée pour PFS, garde-fous supplémentaires avant publication auto) ?
- **Gestion des quotas/rate limiting** : l'absence de rate limiting automatique en v1 est-elle un risque réel vu les volumes (20-25 containers × 30 entités = ~750 requêtes) ?
- **Diff entre versions vs diff package/container** : la stratégie de calcul de delta (basée sur deux versions publiées d'un pilote) vous semble-t-elle la bonne architecture, ou y a-t-il un angle mort ?
- **Priorisation du backlog** (v1.1 rate limiting, v1.2 import depuis container, v1.3 multi-clients, v1.4 partage de packages, v2.0 backend+BDD) : cet ordre est-il cohérent avec les risques identifiés ?
- Toute autre observation sur les choix produits ou techniques qui vous semble pertinente.

Merci de formuler des recommandations concrètes et priorisées plutôt qu'une liste exhaustive de remarques.
