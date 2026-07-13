# PRD — DK GTM Manager

**Version** : 1.4  
**Date** : 2026-07-10  
**Auteur** : Digital Keys  
**Statut** : Draft

**Changelog v1.4** : Rollback (§4.6) implémenté (était prévu au PRD mais absent du code jusqu'ici). Capture automatique de la version live précédente avant toute publication (déploiement, nettoyage/suppression, renommage/duplication). Confirmation renforcée (saisie du mot "SUPPRIMER") sur les suppressions en CleaningTab. Ajout de la §20 Gouvernance & matrice de réversibilité.

---

## 1. Contexte & problème

PerfectStay (PFS) opère entre 10 et 30 sites web partageant le **même datalayer GTM**. Un container de référence — **Turkish** — concentre toutes les modifications de tags/variables/triggers. Aujourd'hui, propager ces changements sur les autres containers se fait **manuellement dans l'UI GTM**, container par container.

**Problèmes concrets :**
- Oublis fréquents : certains containers ne reçoivent pas les mises à jour
- Incohérences : les versions diffèrent d'un container à l'autre
- Temps : un déploiement sur 20 containers prend plusieurs heures
- Pas de trace : impossible de savoir ce qui a été déployé, quand, et sur quels containers

**Besoin :** un outil web permettant à Digital Keys **et à PFS** de synchroniser des tags/variables/triggers sur tous les containers, avec diff visuel avant déploiement.

---

## 2. Utilisateurs cibles

| Profil | Authentification | Rôle |
|--------|-----------------|------|
| **Digital Keys** | Compte Google DK | Crée et maintient les packages, définit les entités avec PFS, déploie |
| **PFS** | Compte Google pro `@perfectstay.com` | Accès complet — définit les packages avec DK, déploie en autonomie |

**Accès à l'outil :** DK envoie un lien à PFS. PFS clique, s'authentifie avec son compte Google professionnel qui dispose déjà des droits GTM. Pas de création de compte séparé.

**Nommage des entités :** libre — PFS nomme ses tags/variables/triggers comme il le souhaite, pas de convention imposée par l'outil.

**Historique :** visible par tous les utilisateurs connectés (DK + PFS).

---

## 3. Objectifs v1

1. Réduire le temps de déploiement sur N containers de **plusieurs heures à < 5 minutes**
2. **Zéro container oublié** sur les 6 premiers mois d'utilisation
3. Donner à PFS une autonomie complète sur ses déploiements GTM (sans appeler DK)
4. Tracer chaque déploiement (qui, quoi, quand, sur quels containers, résultat)

**Hors scope v1 :** multi-clients (autre que PFS), notifications email/Slack, backend partagé, séparation des historiques par utilisateur.

---

## 4. Fonctionnalités

### 4.1 Authentification
- Connexion via Google OAuth (Google Identity Services)
- Scopes requis : `tagmanager.readonly` + `tagmanager.edit.containers` + `tagmanager.publish`
- Session persistée en localStorage (token valide ~1h)
- **Reconnexion automatique** : si le token expire pendant un déploiement, l'outil ouvre le popup Google, attend la reconnexion, puis reprend au container suivant

### 4.2 Sélection des containers
- Chargement automatique de tous les containers du compte GTM PFS après connexion
- Sélection individuelle ou "tout sélectionner"
- Affichage : nom du container, ID public (GTM-XXXXX), contexte d'usage
- Turkish peut être sélectionné comme container cible au même titre que les autres

### 4.3 Packages de déploiement
- Un package = ensemble nommé de **tags + variables + triggers** au format JSON GTM natif
- Couvre **créations ET modifications** d'entités existantes
- Créés conjointement par DK et PFS
- Actions : créer (éditeur JSON), modifier, dupliquer, supprimer, exporter JSON, importer JSON
- Stockage local (localStorage) — pas de base de données en v1
- Nommage libre — pas de convention imposée

### 4.4 Diff visuel avant déploiement ⭐
- Avant tout déploiement, l'outil analyse l'état actuel de chaque container (workspace par défaut)
- **Résumé global** : comptage nouveau / modifié / inchangé sur l'ensemble des containers
- **Détail par container** : dépliable, liste chaque entité avec son statut
- **Diff JSON inline** : pour les entités `modifié`, bouton "Voir diff" affiche avant/après côte à côte
- **Sélection granulaire** : l'utilisateur coche/décoche les entités à déployer
  - Nouveau + Modifié : cochés par défaut
  - Inchangé : décoché par défaut

### 4.5 Déploiement
- Sélection : package + entités choisies dans le diff + containers cibles + nom de version
- **Option de publication** : automatique (publie immédiatement) ou manuelle (version créée, publication dans GTM ensuite)
- **Brouillon GTM** : un nouveau workspace horodaté est créé à chaque déploiement (`DK Deploy - [version] - [date]`)
- **Comportement upsert** par entité :
  - Entité absente dans le container → création (POST)
  - Entité déjà présente → mise à jour (PUT)
  - Ordre garanti : triggers → variables → tags (respect des dépendances)
- **Isolation des erreurs** : si un container échoue, les autres continuent. Le container en erreur est marqué rouge avec le détail, à retraiter manuellement.
- Progress en temps réel : état de chaque étape par container

### 4.6 Rollback ⭐
- Depuis l'historique, chaque déploiement réussi affiche un bouton **Annuler le déploiement**
- L'outil identifie la version GTM qui était publiée **avant** le déploiement DK sur chaque container
- Republication de cette version précédente sur les containers sélectionnés
- Même progress en temps réel que le déploiement normal
- Disponible uniquement sur les déploiements avec publication auto (les déploiements manuels n'ont pas modifié la version live)

### 4.7 Historique
- Chaque déploiement est enregistré : date, utilisateur, package, containers, statut par container, version ID GTM
- Conserve les 50 derniers déploiements
- Visible par tous les utilisateurs connectés (DK + PFS)
- Détail dépliable par déploiement
- Bouton Rollback accessible par déploiement (si publication auto était activée)

---

## 5. Cas limites & comportements attendus

| Situation | Comportement |
|-----------|-------------|
| Token OAuth expire mid-déploiement | Popup Google automatique → reconnexion → reprise au container suivant |
| Container échoue pendant le déploiement | Les autres containers continuent, l'erreur est loggée par container |
| Workspace DK Deploy déjà existant dans GTM | Un nouveau workspace horodaté est créé (`DK Deploy - [nom] - [date heure]`) |
| Package vide (0 entités) | Le bouton "Analyser" est désactivé |
| Aucun container sélectionné | Le bouton "Analyser" est désactivé |
| Diff : toutes les entités sont inchangées | L'utilisateur voit le diff, peut forcer le déploiement en cochant manuellement |
| Déploiement sans publication auto | La version est créée dans GTM, visible dans le workspace DK Deploy, à publier manuellement |
| Sélection d'un container sans droits GTM | L'API retourne une erreur 403, le container est marqué rouge, les autres continuent |
| Publication auto sur containers en production live | Avertissement explicite affiché avant confirmation : "Ces containers sont en production avec du trafic réel" |
| Rollback demandé sur déploiement sans publication auto | Bouton Rollback non affiché (pas de version live modifiée) |

---

## 6. User flows principaux

### Flow A — DK propage une modification GA4 sur tous les containers PFS
1. DK modifie le tag GA4 Purchase dans Turkish (dans GTM UI, hors outil)
2. DK ouvre DK GTM Manager → se connecte
3. Containers → coche tous les containers PFS
4. Packages → sélectionne le package `PFS - GA4 E-commerce`
5. Déployer → clique "Analyser" → diff s'affiche :
   - ✅ Tag GA4 Purchase : `currency EUR → USD` (coché — modifié)
   - ☐ Variable DL transaction_id : inchangé (non coché)
6. Confirme la sélection → publication auto → lance
7. Progress en temps réel → 22/22 containers publiés
8. Historique → trace complète

### Flow B — PFS déploie en autonomie
1. PFS clique sur le lien envoyé par DK → se connecte avec `@perfectstay.com`
2. Sélectionne ses containers GTM
3. Choisit un package défini avec DK
4. Consulte le diff → sélectionne les entités
5. Choisit **publication manuelle** (sécurité avant mise en live)
6. Lance → vérifie la version créée dans GTM → publie manuellement

---

## 7. UX & contraintes interface

- **Langue** : français uniquement
- **Device** : desktop uniquement (pas de responsive mobile requis)
- **Post-déploiement** : la première chose visible est un résumé clair — X containers OK (vert) · X échoués (rouge)
- **Containers en production live** : avant tout déploiement avec publication auto, afficher un avertissement explicite : *"Attention — X containers sélectionnés sont en production avec du trafic réel. La publication sera immédiate."*
- **Packages** : PFS crée ses propres packages directement dans l'outil (pas de transmission DK → PFS par email)

---

## 8. Stack technique

| Couche | Choix |
|--------|-------|
| Frontend | React 19 + Vite + TypeScript |
| Style | Tailwind CSS v4 |
| State | Zustand |
| Routing | React Router v7 |
| Auth | Google Identity Services (GIS) |
| API | GTM API v2 (appels directs navigateur) |
| Stockage | localStorage (packages + historique) |
| Hosting | Vercel (à déployer) |
| GCP | Projet existant AuditPilot en attendant un nouveau slot |

---

## 9. Sécurité & accès

- **Aucun secret stocké côté serveur** : l'outil est 100% frontend, les tokens restent dans le navigateur
- **Contrôle d'accès natif GTM** : si un utilisateur n'a pas les droits GTM sur un container, l'API retourne une erreur (pas de contournement possible)
- **Pas de rôles dans l'outil** : l'accès est contrôlé en amont dans GTM (DK ajoute les comptes PFS sur le compte GTM PFS)
- **Tokens non persistés entre sessions** : à chaque nouvelle session, reconnexion requise
- **Restriction de connexion (phase interne, v1.4)** : écran de consentement OAuth du projet GCP (`gtm-wbncv54-ngq1n`) en type **Interne** — Google refuse toute connexion hors de l'organisation `@digitalkeys.fr`, appliqué côté Google avant l'exécution du code, donc infalsifiable côté client. Doublé d'un check `ALLOWED_EMAILS` côté client (`src/lib/auth.ts`) qui ne restreint qu'à `googlepartner@digitalkeys.fr` — celui-ci est un garde-fou de confort (évite une connexion accidentelle par un autre consultant DK), pas une barrière de sécurité, et est contournable en éditant le bundle JS.

---

## 10. Onboarding PFS

1. DK s'assure que le compte `@perfectstay.com` de PFS a accès au compte GTM PFS (dans GTM : Admin → User Management)
2. DK envoie l'URL de l'outil à PFS
3. PFS clique, s'authentifie avec Google → accède directement au dashboard
4. DK partage les packages existants via export JSON (PFS les importe dans son localStorage)

**Pas de formation nécessaire en v1** — l'interface est autosuffisante.

---

## 11. KPIs de succès v1

| KPI | Cible | Mesure |
|-----|-------|--------|
| Temps de déploiement | < 5 minutes pour 20 containers | Chronométré sur le premier déploiement réel PFS |
| Containers oubliés | 0 sur les 6 premiers mois | Audit manuel trimestriel des versions GTM par container |

---

## 12. Plan de validation avant démo PFS

1. **DK teste en interne** : déploiement sur le compte GTM PFS en mode publication manuelle
2. Vérifier dans GTM que les versions créées sont correctes
3. Vérifier l'historique dans l'outil
4. Déployer sur Vercel → URL stable
5. Présentation PFS uniquement après validation interne

**Allowlist temporaire (v1.4)** : pendant cette phase, la connexion est restreinte côté client à `googlepartner@digitalkeys.fr` (`ALLOWED_EMAILS` dans `src/lib/auth.ts`). Ce n'est pas une vraie barrière de sécurité — l'app est 100% frontend (§9), le vrai rempart reste les permissions natives GTM — mais évite une connexion accidentelle par un autre compte tant que PFS n'est pas censé y accéder. **À faire avant l'onboarding PFS (§10)** : ajouter les comptes `@perfectstay.com` concernés à `ALLOWED_EMAILS`.

---

## 13. Messages d'erreur & retours utilisateur

| Situation | Message affiché | Action proposée |
|-----------|----------------|-----------------|
| Pas de droits sur un container (403) | "Accès refusé — votre compte Google n'a pas les droits sur ce container GTM." | Vérifier les droits dans GTM Admin |
| Token expiré (401) | "Votre session a expiré. Reconnexion en cours…" | Popup Google automatique |
| Container introuvable (404) | "Container introuvable. Il a peut-être été supprimé." | Le marquer en erreur, continuer les autres |
| Erreur réseau | "Connexion interrompue. Vérifiez votre connexion internet." | Bouton "Réessayer" |
| Quota GTM API dépassé (429) | "Limite GTM atteinte. Attendez quelques minutes avant de relancer." | Bouton "Réessayer dans 2 min" |
| Package JSON invalide à l'import | "Ce fichier JSON n'est pas un package valide. Vérifiez le format." | Lien vers la documentation du format |
| Aucun workspace disponible dans GTM | "Impossible de créer un workspace — GTM a peut-être atteint sa limite (3 workspaces max par container)." | Aller dans GTM nettoyer les workspaces |

---

## 14. Quotas & limites GTM API

L'API GTM v2 impose des quotas à connaître :

| Limite | Valeur | Impact |
|--------|--------|--------|
| Workspaces par container | 3 max | Si 3 workspaces DK Deploy existent déjà, la création échoue → informer l'utilisateur |
| Requêtes par minute | ~100 req/min | Pour 25 containers × 30 entités = 750 requêtes — espacer si nécessaire |
| Requêtes par jour | 100 000 / jour | Pas de risque en usage normal PFS |

**Stratégie v1 :** pas de gestion automatique du rate limiting. Si erreur 429, l'outil l'affiche et propose de réessayer manuellement. En v1.1, ajouter un délai automatique entre containers.

---

## 15. Description des écrans (v1)

### Écran 1 — Landing (non connecté)
- Titre + pitch en 1 phrase
- Bouton unique : "Se connecter avec Google"
- Pas d'autres éléments

### Écran 2 — Dashboard (après connexion)
- Sidebar : Containers · Packages · Déployer · Historique
- Header : compte connecté + compte GTM sélectionné + bouton déconnexion

### Écran 3 — Containers
- Sélecteur de compte GTM (si plusieurs comptes)
- Liste des containers avec checkbox
- Boutons : "Tout sélectionner" / "Effacer la sélection"
- Badge GTM-XXXXX sur chaque container

### Écran 4 — Packages
- Liste des packages avec nombre de tags/variables/déclencheurs
- Boutons : Créer · Modifier · Dupliquer · Supprimer
- Éditeur JSON inline pour créer/modifier un package
- Import/export JSON

### Écran 5 — Déployer (flow en 4 étapes)
1. **Sélection** : choisir package + containers → bouton "Analyser"
2. **Diff** : résumé global (X nouveaux · X modifiés · X inchangés) + détail dépliable par container + sélection granulaire + nom de version + option publication auto → bouton "Déployer"
3. **Progress** : barre de progression + état en temps réel par container (étapes : workspace · upsert · version · publication)
4. **Résultat** : X containers OK · X échoués + boutons "Nouveau déploiement" / "Voir l'historique"

### Écran 6 — Historique
- Liste des déploiements (date, package, nb containers, statut global)
- Détail dépliable : résultat par container, version ID GTM
- Bouton Rollback sur les déploiements avec publication auto

---

## 16. Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| GCP quota dépassé — impossible de créer l'OAuth Client ID | Actuel (bloquant) | Haut | Réutiliser le projet GCP AuditPilot en attendant un nouveau slot |
| PFS publie accidentellement en prod sans vérifier le diff | Moyen | Haut | Avertissement explicite + option publication manuelle par défaut pour PFS |
| Workspace GTM plein (3 max) | Faible | Moyen | Message d'erreur clair + lien vers GTM pour nettoyer |
| Quota API 429 sur grand nombre de containers | Faible | Moyen | v1 : message + retry manuel. v1.1 : rate limiting automatique |
| Diff faux positif (entité marquée "modifié" alors qu'identique) | Faible | Faible | Normalisation stricte des champs GTM dans la comparaison (exclusion des IDs, fingerprint, path) |
| PFS crée un package mal formé (JSON invalide) | Moyen | Faible | Validation JSON à l'import + message d'erreur précis |
| Token OAuth ne se renouvelle pas automatiquement | Faible | Moyen | Fallback : arrêt propre + affichage des containers traités |
| Container Turkish inclus par erreur dans le déploiement | Faible | Faible | Turkish peut être cible — c'est intentionnel. Pas de protection spéciale. |

---

## 17. Format JSON d'un package

Un package est un objet JSON contenant 3 listes : `tags`, `variables`, `triggers`. Chaque entité respecte le format natif GTM API v2.

### Structure minimale

```json
{
  "name": "PFS - GA4 E-commerce",
  "description": "Tags GA4 pour le tunnel e-commerce PFS",
  "entities": {
    "triggers": [
      {
        "name": "PFS - purchase",
        "type": "CUSTOM_EVENT",
        "customEventFilter": [
          {
            "type": "EQUALS",
            "parameter": [
              { "type": "TEMPLATE", "key": "arg0", "value": "{{_event}}" },
              { "type": "TEMPLATE", "key": "arg1", "value": "purchase" }
            ]
          }
        ]
      }
    ],
    "variables": [
      {
        "name": "DL - transaction_id",
        "type": "v",
        "parameter": [
          { "type": "INTEGER", "key": "dataLayerVersion", "value": "2" },
          { "type": "TEMPLATE", "key": "name", "value": "ecommerce.transaction_id" }
        ]
      }
    ],
    "tags": [
      {
        "name": "GA4 - Purchase",
        "type": "gaawe",
        "parameter": [
          { "type": "TEMPLATE", "key": "eventName", "value": "purchase" },
          { "type": "TEMPLATE", "key": "measurementId", "value": "G-XXXXXXXXXX" }
        ],
        "firingTriggerId": ["{{PFS - purchase}}"]
      }
    ]
  }
}
```

### Règles importantes

- **Pas d'IDs GTM dans le package** : ne pas inclure `tagId`, `variableId`, `triggerId`, `accountId`, `containerId`, `workspaceId` — ils sont assignés par GTM à la création
- **Références entre entités** : les tags référencent les triggers par **nom**, pas par ID. L'outil résout les IDs au moment du déploiement.
- **Ordre de déploiement géré par l'outil** : toujours triggers → variables → tags. Pas besoin de les trier dans le JSON.
- **Types GTM** : respecter la nomenclature GTM (`gaawe` pour GA4, `v` pour Data Layer Variable, `CUSTOM_EVENT` pour trigger custom event, etc.)

---

## 18. Glossaire

| Terme | Définition |
|-------|-----------|
| **Container GTM** | Un "contenant" GTM associé à un site web. PFS a un container par site (ex : site France, site UK, site Turkish). Chaque container a un ID public type `GTM-XXXXX`. |
| **Turkish** | Le container de référence PFS. Toutes les modifications de tracking sont d'abord faites ici, puis propagées sur les autres containers. |
| **Workspace (brouillon)** | Zone de travail dans GTM où les modifications sont préparées avant publication. Chaque container peut avoir jusqu'à 3 workspaces simultanés. L'outil en crée un nouveau à chaque déploiement. |
| **Version GTM** | Snapshot d'un container à un moment donné. Créée quand un workspace est "gelé". Peut être publiée (mise en ligne) ou archivée. |
| **Package** | Dans cet outil : ensemble nommé de tags/variables/déclencheurs à déployer simultanément sur plusieurs containers. |
| **Tag** | Morceau de code (ex : pixel Meta, tag GA4) déclenché selon des règles définies. |
| **Variable** | Valeur dynamique réutilisable dans les tags (ex : `ecommerce.transaction_id` lu dans le datalayer). |
| **Déclencheur** | Condition qui active un tag (ex : "quand l'événement purchase est poussé dans le datalayer"). |
| **Datalayer** | Objet JavaScript `dataLayer` poussé par le site web, lu par GTM pour récupérer les données (prix, ID transaction, etc.). PFS a le même datalayer sur tous ses sites. |
| **Diff** | Comparaison entre ce que le package contient et ce qui existe déjà dans un container. Résultat : chaque entité est classée Nouveau / Modifié / Inchangé. |
| **Upsert** | Opération combinée : crée l'entité si elle n'existe pas (POST), la met à jour si elle existe déjà (PUT). Évite les doublons. |
| **Publication auto** | Option qui publie immédiatement la version créée. Si désactivée, la version est créée mais reste en brouillon dans GTM — à publier manuellement. |
| **Rollback** | Action de republier la version GTM qui était en ligne avant le dernier déploiement. Annule l'effet d'un déploiement sur un ou plusieurs containers. |

---

## 19. Gouvernance & matrice de réversibilité

### 19.1 Rôles

L'outil ne porte pas de système de rôles interne (§9), mais la gouvernance de la donnée qu'il manipule répartit deux responsabilités distinctes :

| Rôle | Porté par | Responsabilité |
|------|-----------|-----------------|
| **Data owner** | Chaque métier (paid, SEO, merch, etc.) | Définit *quoi* tracker et pourquoi, sur son périmètre. Valide qu'un tag/variable répond à son besoin business. |
| **Data steward** | Digital Keys (web analyst) | Opère la donnée au quotidien : implémente, structure, garantit la fiabilité technique du tracking et la traçabilité des changements. N'est pas seul responsable de la fiabilité globale — dépend aussi des inputs métiers. |

PFS (§2) agit comme data owner ET opérateur technique ponctuel sur ses propres containers, en autonomie.

### 19.2 Matrice de réversibilité

Pour chaque action possible dans l'outil, ce qui se passe si elle doit être annulée.

| Action | Réversible automatiquement (bouton dans l'outil) | Réversible manuellement | Non réversible |
|--------|--------------------------------------------------|--------------------------|-----------------|
| Déploiement upsert (§4.5), publication auto activée | ✅ Rollback (§4.6) depuis Historique — republie la version live précédente | ✅ Republier une ancienne version depuis GTM UI | — |
| Déploiement upsert, publication manuelle | Non applicable — rien n'est publié, la version reste en brouillon | L'utilisateur publie ou ignore la version depuis GTM | — |
| Suppression d'entités (CleaningTab, §4.4 Nettoyage) | ✅ Rollback depuis Historique (v1.4) | ✅ Republier l'ancienne version depuis GTM UI | — |
| Renommage / duplication de tag ou variable (Monitoring) | ✅ Rollback depuis Historique (v1.4) | ✅ Republier l'ancienne version depuis GTM UI | — |
| Création de workspace | — (jamais destructif : l'outil ne supprime ni n'écrase un workspace existant, §4.5) | — | — |
| Modification faite directement dans GTM UI, hors de l'outil | Non — hors du périmètre de l'outil | ✅ Historique de versions natif GTM | — |
| Suppression d'un package local (§4.3) | Non | Ressaisie manuelle du package | ✅ Si non exporté au préalable — n'affecte que le localStorage, jamais GTM |

### 19.3 Limites connues du rollback

- Le rollback capture la version live juste avant publication. Un container qui n'a **jamais été publié** avant (aucune version live) n'a pas de version à restaurer — le bouton rollback l'ignore et l'indique explicitement.
- Les déploiements effectués **avant l'introduction du rollback (v1.4)** n'ont pas cette capture — le bouton n'apparaîtra pas rétroactivement sur l'historique antérieur.
- Le rollback republie une version : il n'annule pas une action isolée dans le détail (ex. un seul tag parmi dix) — il restaure l'état complet du container tel qu'il était avant le déploiement concerné.

---

## 20. Backlog versions suivantes

- **v1.1** : Rate limiting automatique entre containers (délai si 429)
- **v1.2** : Import depuis container — sélectionner des entités directement depuis Turkish pour créer un package
- **v1.3** : Multi-clients — gestion de plusieurs comptes GTM
- **v1.5** : Audit automatique de naming convention (Monitoring) — voir §21
- **v1.6** : Partage de packages — URL partageable ou export/import entre utilisateurs en un clic
- **v2.0** : Backend + BDD — packages partagés entre utilisateurs, notifications, audit log centralisé, séparation des historiques par utilisateur

---

## 21. Audit de naming convention (backlog, inspiré d'Avo)

**Constat (2026-07-13)** : Avo (avo.app, tracking plan pour l'analytics produit) fait un audit automatique de naming convention sur les events/properties, avec un namespace global pour éviter les doublons. Digital Keys a déjà une référence écrite (`Naming_Convention_GTM___GA4.csv`) mais elle est statique — rien dans l'outil ne la fait respecter ni ne détecte les écarts.

**Cas concret qui illustre le besoin** : le rename observé cette semaine ("GA4 - Begin Checkout" → "GA4 - begin_checkout", perfectstay.com) est exactement le genre d'incohérence qu'un check automatique aurait pu signaler avant qu'un humain ne le repère à l'œil dans Monitoring.

**Proposition (à cadrer plus précisément avant implémentation)** :
- Nouveau check dans Monitoring, à côté des détections existantes (orphelins, `detectRequiredBuiltInVariables`) : comparer les noms des tags/triggers/variables de chaque container à un jeu de règles dérivé de `Naming_Convention_GTM___GA4.csv` (préfixes attendus par plateforme — `GA4 -`, `FB -`, etc. —, casse cohérente, séparateurs cohérents `_` vs espace).
- Détection de **quasi-doublons** entre containers (même entité nommée différemment selon le container — ex. "GA4 - Begin Checkout" sur un container, "GA4 - begin_checkout" sur un autre pour le même événement) — utile spécifiquement pour PFS où plusieurs containers partagent le même datalayer et devraient converger vers les mêmes noms.
- Affichage : nouvel onglet ou section dans Monitoring, liste des écarts avec le nom actuel vs le nom attendu, et un lien direct vers le renommage déjà existant (`RenameOperation`/`applyContainerQueue`) pour corriger en un clic plutôt que de juste signaler.

**Non retenu pour l'instant** : un namespace global bloquant (empêcher la création d'un doublon à la source, comme le fait Avo) — nécessiterait de intercepter la création d'entités au moment du package/queue, plus intrusif qu'un simple audit a posteriori. À reconsidérer si l'audit a posteriori s'avère insuffisant en usage réel.
