# PRD — Actions déclencheurs (Monitoring > TagDrawer)

**Version** : 1.0  
**Date** : 2026-06-26  
**Auteur** : Digital Keys  
**Statut** : Draft

---

## 1. Contexte

La page Monitoring affiche une matrice de couverture des tags GTM sur N containers. En cliquant sur une ligne Tags, le `TagDrawer` s'ouvre avec deux onglets : **Déclencheurs** et **Renommer**.

L'onglet Déclencheurs montre, pour chaque container, quels déclencheurs sont associés au tag sélectionné. La comparaison est sémantique (type + condition, pas le nom). Des badges signalent les incohérences : "déclencheurs variés" sur la ligne de la matrice, cartes rouges dans le drawer.

**Aujourd'hui** : lecture seule. L'utilisateur détecte le problème mais ne peut rien faire depuis cet écran.

**Besoin** : depuis le même drawer, planifier des corrections de déclencheurs sur un ou plusieurs containers, dans la même logique de queue que les renommages (exécution différée post-OAuth).

---

## 2. Utilisateurs cibles

Mêmes que le PRD principal — Digital Keys et PFS. Usage typique : un consultant DK audite les containers avant une mise en production, détecte que le tag `purchase` se déclenche sur "All Pages" dans Swiss, corrige directement depuis l'interface.

---

## 3. Problèmes couverts

| Problème détecté dans le drawer | Action requise |
|---|---|
| Tag purchase déclenche sur "All Pages" (pageview) dans un container — collecte purchase à chaque page | Retirer ce déclencheur |
| Container AF déclenche `add_to_cart` sur `customEvent::add_to_cart` mais TK utilise `customEvent::addToCart` (casse différente) | Synchroniser depuis la référence |
| Tag `begin_checkout` présent dans IBE mais sans aucun déclencheur lié | Lier un déclencheur existant |
| Containers TK + COR ont 2 déclencheurs pour purchase (correct), Swiss n'en a qu'un | Synchroniser depuis TK |

---

## 4. Actions définies

### 4.1 Retirer un déclencheur

**Déclencheur UX** : bouton "Retirer" au survol de chaque ligne de trigger dans la carte container.

**Flux** :
1. Clic "Retirer" sur un trigger (ex: "All Pages" dans Swiss)
2. Mini-modal inline (pas de nouveau drawer) : 
   - Affiche le trigger à retirer + sa clé sémantique
   - Liste les containers qui ont ce même trigger sémantique lié au tag (pas seulement Swiss — peut-être aussi d'autres)
   - Checkbox par container, Swiss pré-coché
3. Bouton "Planifier le retrait"
4. Opération ajoutée à la queue `pendingTriggerOps`

**Opération GTM** : PUT sur le tag, `firingTriggerId` sans l'ID du trigger retiré.

**Contraintes** :
- Ne propose que les containers où ce trigger sémantique est effectivement lié au tag
- Si retirer ce trigger laisserait le tag sans aucun déclencheur → avertissement "Ce tag n'aura plus aucun déclencheur dans ce container"
- Ne supprime pas le trigger de GTM — le dissocie seulement du tag

---

### 4.2 Synchroniser depuis une référence

**Déclencheur UX** : bouton "Synchroniser" dans la barre d'action du drawer (visible uniquement si incohérence détectée).

**Flux** :
1. Clic "Synchroniser"
2. Sélecteur de container de référence (dropdown — seuls les containers avec le tag sont proposés)
3. Aperçu automatique par container cible :
   - Vert "Déjà identique" — rien à faire
   - Orange "À synchroniser" — avec détail des différences sémantiques
   - Gris "Tag absent" — exclu de la synchronisation (ne peut pas créer un tag)
4. Checkboxes pour sélectionner les containers cibles à corriger
5. Bouton "Planifier la synchronisation"
6. Opérations ajoutées à `pendingTriggerOps`

**Opération GTM** (par container cible) :
- Pour chaque trigger sémantique de la référence :
  - Chercher un trigger équivalent dans le container cible (même `triggerSemanticKey`)
  - Si trouvé → utiliser son ID existant → PUT tag avec cet ID dans `firingTriggerId`
  - Si non trouvé → POST nouveau trigger (config copiée de la référence, nom repris), puis PUT tag
- Pour chaque trigger lié au tag cible mais absent de la référence → retirer de `firingTriggerId`

**Contraintes** :
- Un trigger sémantiquement identique peut avoir un nom différent entre containers — c'est normal, l'outil cherche par sémantique et réutilise l'existant
- Si création nécessaire : le nom du nouveau trigger = nom du trigger de référence (sans convention forcée)
- La synchronisation ne modifie que le tag sélectionné, pas les autres tags du container

---

### 4.3 Lier un déclencheur existant

**Déclencheur UX** : dans la carte d'un container où le tag est présent mais sans déclencheur, bouton "Lier un déclencheur".

**Flux** :
1. Clic "Lier un déclencheur" dans la carte du container concerné
2. Liste déroulante des triggers disponibles dans ce container (nom + type), filtrée par pertinence sémantique si possible (ex: `customEvent` en tête pour un tag GA4 Event)
3. Sélection d'un trigger → aperçu "Ce tag déclenchera sur : [nom]"
4. Bouton "Planifier le lien"
5. Opération ajoutée à `pendingTriggerOps`

**Opération GTM** : PUT sur le tag, `firingTriggerId` avec l'ID sélectionné ajouté.

**Contraintes** :
- La liste est construite depuis `container.triggers` dans les données de monitoring — données mock en v1, données live post-OAuth
- Ne propose que les triggers du même container (impossible de lier un trigger d'un autre container)

---

## 5. Modèle de données

### `TriggerOperation` (nouveau type dans `src/types/gtm.ts`)

```typescript
export type TriggerOpType = 'remove' | 'sync' | 'link';

export interface TriggerOperationTarget {
  containerId: string;
  containerName: string;
  publicId: string;
  // 'remove' : retire triggerId du tag
  // 'link'   : ajoute triggerId au tag
  // 'sync'   : combinaison — peut inclure retrait + ajout + création
  action: 'unlink' | 'link_existing' | 'create_and_link';
  existingTriggerId?: string;   // pour unlink et link_existing
  triggerConfig?: GTMTrigger;   // pour create_and_link (config à copier)
}

export interface TriggerOperation {
  id: string;
  type: TriggerOpType;
  tagRowKey: string;            // event_name ou nom du tag
  tagCategory: string;
  triggerName: string;          // nom du trigger concerné (pour affichage)
  triggerSemanticKey: string;   // pour déduplication
  referenceContainerId?: string; // pour sync
  targets: TriggerOperationTarget[];
  status: 'pending' | 'applied' | 'failed';
  createdAt: string;
  error?: string;
}
```

### Store Zustand (`gtm-store.ts`)

Ajouter à côté de `pendingRenames` :
```typescript
pendingTriggerOps: TriggerOperation[]
addTriggerOp: (op: Omit<TriggerOperation, 'id' | 'status' | 'createdAt'>) => void
removeTriggerOp: (id: string) => void
clearTriggerOps: () => void
```

### Plan d'opérations partagé

Le panneau "Plan de renommage" existant devient un **Plan d'opérations** qui affiche les deux queues (renames + trigger ops) séparément, avec un compteur global dans le header.

---

## 6. UX — Localisation des actions dans le drawer

```
┌─────────────────────────────────────────────────────┐
│  [GA4]  purchase                        [X]         │
│  5 containers · 1 déclencheur différent             │
│  ┌──────────────────┬──────────────────┐            │
│  │  Déclencheurs    │    Renommer      │            │
│  └──────────────────┴──────────────────┘            │
│                                                     │
│  [Synchroniser depuis une référence]  ← bouton     │
│  (visible seulement si incohérence)                 │
│                                                     │
│  ┌── Swiss · GTM-XXXXX ─────────────────────────┐  │
│  │  [Page Vue]  All Pages  Toutes les pages  [x] │  │  ← x = Retirer
│  │  [Custom Event]  DL - purchase               │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌── IBE · GTM-XXXXX ──────────────────────────┐   │
│  │  (aucun déclencheur lié)                    │   │
│  │  [Lier un déclencheur]                      │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 7. Cas limites

| Situation | Comportement |
|---|---|
| Retrait du dernier déclencheur d'un tag | Avertissement "Ce tag sera désactivé dans ce container (aucun déclencheur)" — confirmation requise |
| Synchronisation : trigger sémantique absent du container cible | Création automatique (config copiée de la référence) — indiqué dans l'aperçu |
| Synchronisation : container cible sans le tag | Exclu de la liste des cibles (on ne crée pas de tag depuis cet écran) |
| Trigger lié à plusieurs tags | Le retrait / la modification ne touchent que le tag sélectionné dans le drawer |
| Opération déjà planifiée pour ce tag + container | Bloquer le doublon, indiquer "Opération déjà planifiée" dans l'aperçu |
| Données mock (pré-OAuth) | Toutes les actions sont planifiables — exécution bloquée jusqu'à OAuth (même comportement que les renames) |

---

## 8. Ce qui est hors scope

- Créer un trigger from scratch avec un éditeur de conditions complet — la synchronisation copie depuis une référence, pas de création manuelle
- Modifier les conditions d'un trigger existant (ex: changer l'event name)
- Actions depuis l'onglet Déclencheurs de la matrice principale (pas le drawer Tags)
- Réordonner les priorités de déclenchement

---

## 9. Dépendances

| Dépendance | Statut |
|---|---|
| GCP OAuth | Requis pour l'exécution — planification disponible en mode mock |
| `TriggerOperation` dans `gtm.ts` | À créer |
| Queue `pendingTriggerOps` dans le store | À ajouter |
| Panneau Plan d'opérations (extension du plan renames actuel) | À étendre |
| API GTM `tags.update` + `triggers.create` | Disponible post-OAuth |

---

## 10. Ordre d'implémentation suggéré

1. `TriggerOperation` type + store
2. Action "Retirer" (la plus simple — pas de création de trigger)
3. Panneau Plan d'opérations étendu (affiche trigger ops + renames)
4. Action "Lier un déclencheur existant" (liste les triggers du container)
5. Action "Synchroniser" (la plus complexe — implique create_and_link)
6. Exécution API (post-OAuth)
