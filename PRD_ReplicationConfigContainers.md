# PRD — Réplication de configuration entre containers (diff de versions + duplication de variables)

**Version** : 2.0
**Date** : 2026-07-07
**Auteur** : Digital Keys
**Statut** : Brouillon v2 — en attente de validation finale

---

## 1. Contexte

Cas d'usage déclencheur : sur PerfectStay (PFS), les composants "merch" en amont du tunnel de réservation poussent un dataLayer **strictement identique** entre partenaires (Air France, Transavia, Turkish, etc.), mais la nomenclature GTM (noms d'events, de triggers, de variables) diverge d'un container à l'autre. Le plan de tracking est en cours de refonte (nouveaux noms d'events + nouveaux paramètres).

Méthode de travail retenue : adapter le GTM d'**un container pilote** une fois les évolutions dataLayer livrées par les devs, publier une nouvelle version, puis **comparer cette version à la précédente** pour en extraire le delta exact et le **répliquer** sur tous les autres containers PFS via l'outil.

Audit du code existant (voir échange précédent) : deux chantiers retenus pour couvrir ce besoin.

---

## 2. Périmètre — deux chantiers

### 2.1 Chantier A — Répliquer le delta entre deux versions GTM d'un container pilote *(recommandé, prioritaire)*

**Décision validée** : plutôt que de capturer l'état complet du container pilote (risque d'embarquer des différences historiques sans rapport avec le projet dataLayer), on part de **deux versions publiées** de ce container — celle d'avant l'adaptation et celle d'après — et on calcule le **delta exact** : quelles entités ont été créées, modifiées, supprimées. C'est ce delta, et seulement lui, qui est répliqué sur les autres containers.

**Proposition** :
1. L'utilisateur choisit un container pilote déjà adapté (dataLayer + GTM à jour, version publiée) et sélectionne **deux versions** de ce container (ex. "version avant" et "version après" — via `versions.get`, l'API GTM permet de récupérer le contenu complet d'une version passée par son ID, pas seulement la live)
2. L'outil calcule le diff entre les deux versions (réutilise la logique déjà écrite dans `gtm-diff.ts` — `isSameEntity`, statut `new` / `modified` / `removed` / `unchanged` — étendue pour détecter aussi les suppressions, ce qu'elle ne fait pas aujourd'hui)
3. Le delta (uniquement les entités `new` + `modified`, suppressions traitées à part — voir cas limites) devient un package temporaire, éditable avant déploiement
4. Déploiement sur les autres containers via le flux Diff → Déployer existant, qui matche par nom sur chaque container cible

**Pourquoi c'est le chantier prioritaire** : ça isole précisément "ce qui a changé pour le projet dataLayer" et réutilise le moteur de diff déjà en prod, sans capturer tout l'historique de configuration du pilote.

---

### 2.2 Chantier B — Étendre la duplication aux Variables *(fix + extension, périmètre : Variables uniquement)*

**Bug constaté** : dans Monitoring, la cellule "Absent" est cliquable et invite à "Créer" sur les 3 onglets (Tags/Déclencheurs/Variables), mais le composant qui gère le clic (`QuickCreatePanel`) ne sait chercher une référence que dans `container.tags`. Sur Déclencheurs/Variables, le clic ouvre un panneau qui affiche toujours "Aucun container de référence disponible", même quand l'entité existe bel et bien ailleurs. C'est trompeur.

**Proposition (Variables uniquement — Déclencheurs autonomes reportés, la plupart des cas passent déjà par Synchroniser depuis un tag)** :
- Dupliquer une variable absente depuis un container de référence (copie `type` + `parameter`, sans ID)
- Cas limite : les variables de type Lookup Table (`smm`) référençant d'autres variables par nom — à vérifier que les variables référencées existent aussi dans le container cible, sinon avertir plutôt que dupliquer une référence cassée
- Passe par le même flux déjà en place pour les tags : planification dans une nouvelle file `pendingVariableDuplications`, publication centralisée depuis Déployer (`applyContainerQueue`)

---

### 2.3 Chantier C — Mise à jour ad-hoc de paramètres

**Statut : abandonné, remplacé par le chantier A.** Le diff entre deux versions (2.1) couvre exactement ce besoin — détecter et répliquer les changements de paramètres sur une entité qui existe déjà partout — sans construire de second moteur de diff dans Monitoring.

---

## 3. Hors scope (toutes versions)

- Éditeur de conditions de trigger (changer une condition existante, pas juste type+conditions à la création)
- Résolution automatique des Lookup Tables multi-propriétés lors du diff de versions (capturées telles quelles, y compris la référence à la LT existante)
- Renommage de paramètres à l'intérieur d'un tag/variable (ex. renommer une clé de paramètre) — seul le contenu (valeur) est comparé/copié, pas une clé individuelle
- Import/export de plan de tracking externe (Excel, Google Sheet) comme "spec cible" — évoqué dans l'échange précédent, explicitement hors scope ici
- Duplication de Déclencheurs autonomes (hors flux Synchroniser) — reportée à une prochaine itération

---

## 4. Modèle de données

### Chantier A — Diff entre deux versions → Package

Nouvelles fonctions API (`gtm-api.ts`) :

```typescript
function listVersionHeaders(token, accountId, containerId): Promise<{ versionId: string; name: string; containerVersionId: string }[]>
function getVersion(token, accountId, containerId, versionId): Promise<{ tag: GTMTag[]; trigger: GTMTrigger[]; variable: GTMVariable[] }>
```

Nouvelle fonction de diff (extension de `gtm-diff.ts`) :

```typescript
function diffVersions(before: VersionContent, after: VersionContent): {
  tags: DiffEntity[];       // new | modified | removed | unchanged
  triggers: DiffEntity[];
  variables: DiffEntity[];
}
```

Réutilise `isSameEntity` déjà écrit, étendu pour détecter les entités présentes dans `before` mais absentes de `after` (`removed` — statut qui n'existe pas encore dans `DiffEntity`).

Le résultat (uniquement `new` + `modified`, cases cochables comme dans le Diff existant) alimente un **nouveau package** via la structure `DeploymentPackage['entities']` déjà existante — pas de nouveau type de package.

### Chantier B — Duplication Variables

Périmètre confirmé : **Variables uniquement** cette itération (Déclencheurs autonomes reportés — la plupart des cas passent déjà par Synchroniser depuis un tag).

Nouveau type, miroir de `TagDuplicationOperation` :

```typescript
export interface VariableDuplicationOperation {
  id: string;
  containerId: string;
  containerName: string;
  publicId: string;
  variable: GTMVariable;
  sourceContainerName: string;
  status: 'pending' | 'applied' | 'failed';
  createdAt: string;
  error?: string;
}
```

File séparée `pendingVariableDuplications` (même pattern que `pendingTagDuplications` — plus simple à typer qu'une file générique à champ `kind`). Intégrée dans `applyContainerQueue` (Déployer) au même titre que les tags — un container = un workspace vierge = une version = une publication, tous types de modifications confondus.

---

## 5. UX par chantier

### Chantier A
- Page Packages (ou Containers) : bouton "Comparer deux versions"
- Sélecteur : compte → container pilote → version "avant" → version "après" (liste des versions publiées, via `listVersionHeaders`)
- Affichage du diff (réutilise le composant `DiffView` déjà existant) : tags/déclencheurs/variables `new` / `modified` / `removed`, cases à cocher (mêmes conventions que le Diff actuel)
- Confirmation → **nouveau package** créé avec les entités `new` + `modified` cochées, redirection vers l'éditeur de package pour révision avant déploiement
- Les entités `removed` sont affichées mais **non cochées par défaut** et non incluses dans le package (voir cas limites) — seule une suppression explicite et volontaire doit se propager

### Chantier B
- Mêmes panneaux qu'aujourd'hui (`QuickCreatePanel`), étendus pour accepter `kind: 'variables'` en plus de `'tags'`
- Le texte s'adapte : "Dupliquer cette variable"
- Pour les variables Lookup Table : avertissement si une variable référencée est absente du container cible

---

## 6. Cas limites

| Situation | Comportement |
|---|---|
| Chantier A : container pilote n'a pas de version "avant" (ex. tout premier historique) | Le diff se fait alors contre un état vide — toutes les entités de la version "après" apparaissent en `new` |
| Chantier A : une entité est `removed` entre les deux versions | Affichée dans le diff mais **non cochée par défaut** — répliquer une suppression sur les autres containers est un choix explicite et distinct, pas une conséquence automatique du diff |
| Chantier A : package du même nom existe déjà | Toujours un **nouveau** package (nom auto-suffixé si collision) — pas d'écrasement |
| Chantier B : variable Lookup Table référençant une variable absente cible | Avertir, ne pas dupliquer silencieusement une référence cassée |

---

## 7. Dépendances

| Dépendance | Statut |
|---|---|
| Whitelisting champs techniques (tag/trigger) | Déjà écrit — réutilisable tel quel |
| `applyContainerQueue` (Déployer, un workspace/version/publish par container) | Déjà en place — à étendre pour les Variables |
| `DiffView` / moteur de diff (`gtm-diff.ts`) | Déjà en place — à étendre pour comparer deux versions (au lieu de package vs container) et détecter les suppressions |
| Éditeur de package existant | Déjà en place — à réutiliser pour réviser le package généré par le diff |
| GCP OAuth | Déjà opérationnel |

---

## 8. Ordre d'implémentation

1. **Chantier A** — le plus haut ROI, débloque immédiatement le cas d'usage PFS
2. **Chantier B — Variables**

**Décidé, hors scope de cette itération** : Chantier C (abandonné), Déclencheurs autonomes dans le Chantier B (reportés).
