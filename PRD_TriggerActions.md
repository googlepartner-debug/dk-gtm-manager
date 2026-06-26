# PRD — Actions déclencheurs (Monitoring > TagDrawer)

**Version** : 1.1  
**Date** : 2026-06-26  
**Auteur** : Digital Keys  
**Statut** : Validé — prêt à implémenter

---

## 1. Contexte

La page Monitoring > onglet Tags > `TagDrawer` > onglet **Déclencheurs** montre, pour chaque container, quels triggers sont associés au tag sélectionné. La comparaison est sémantique (type + condition, pas le nom du trigger).

Aujourd'hui c'est lecture seule. Ce PRD définit les actions à ajouter.

---

## 2. Les deux actions

### 2.1 Retirer un déclencheur

Cas typique : Swiss purchase a `DL - purchase` (correct) + `All Pages` (pageview, problème). Je veux enlever `All Pages`.

**UX** : bouton `[Retirer]` visible au survol de chaque ligne trigger dans la carte container. Clic → queues l'opération pour ce container uniquement. Pas de sélection multi-containers — une carte, un retrait.

**Cas limite** : si c'est le dernier déclencheur du tag dans ce container, avertissement "Ce tag sera désactivé (plus aucun déclencheur)". L'utilisateur doit confirmer explicitement.

**Opération GTM** : PUT sur le tag — `firingTriggerId` sans l'ID du trigger retiré. Le trigger lui-même n'est pas supprimé du container.

---

### 2.2 Synchroniser depuis une référence

Cas typique : TK purchase n'a que `DL - purchase`. Swiss en a deux : `DL - purchase` + `All Pages`. Je synchronise depuis TK → Swiss doit finir identique à TK, `All Pages` est retiré.

**Règle validée** : le container cible doit finir **identiquement** à la référence — les triggers sémantiquement absents de la référence sont retirés du cible, les triggers manquants sont ajoutés.

**Règle clé sur la création** : avant de créer un nouveau trigger dans un container cible, l'outil vérifie s'il existe déjà un trigger avec la même clé sémantique (même type + conditions) — même si son nom est différent. Si trouvé, on lie l'existant plutôt que d'en créer un doublon.

Exemple : TK a `DL - purchase` (`customEvent::purchase`). AF a `Custom Event - purchase` (`customEvent::purchase`) → même clé sémantique → on lie `Custom Event - purchase` sans rien créer.

**UX** :
1. Bouton `[Synchroniser depuis une référence]` affiché dans le drawer uniquement si une incohérence est détectée (badge "déclencheurs variés" présent)
2. Sélecteur de container de référence (dropdown — seulement les containers avec le tag)
3. Aperçu par container cible :
   - Vert "Déjà identique" — rien à faire
   - Orange "À synchroniser" — sous-détail : triggers à ajouter / triggers à retirer / triggers à lier (existant trouvé)
   - Gris "Tag absent" — exclu de la synchronisation
4. Checkboxes pour choisir quels containers synchroniser
5. Bouton `[Planifier la synchronisation]` → ajoute les opérations à la queue

**Opérations GTM par container cible** :
- Pour chaque trigger dans la référence non présent sémantiquement dans le cible :
  - Si un trigger sémantiquement équivalent existe dans le cible → PUT tag pour lier son ID
  - Sinon → POST nouveau trigger (config de la référence, nom repris tel quel) + PUT tag
- Pour chaque trigger lié au tag cible absent sémantiquement de la référence → PUT tag pour délier

---

## 3. Ce qui n'est PAS dans ce PRD

**"Lier un déclencheur existant"** (tag présent sans aucun déclencheur) : action différée. La synchro couvre ce cas si on définit un container de référence. Une action dédiée peut être ajoutée en v2.

**Modifier les conditions d'un trigger** (ex: changer l'event name) : hors scope — nécessite un éditeur de conditions complet.

**Créer un trigger from scratch** : hors scope v1.

---

## 4. Modèle de données

### `TriggerOperation` — nouveau type dans `src/types/gtm.ts`

```typescript
export type TriggerOpKind = 'remove' | 'sync';

export interface TriggerOpStep {
  containerId: string;
  containerName: string;
  publicId: string;
  // Ce que cette étape fait sur le tag :
  unlink?: string[];             // IDs de triggers à délier du tag
  linkExisting?: string[];       // IDs de triggers existants à lier
  create?: GTMTrigger[];         // Triggers à créer puis lier
}

export interface TriggerOperation {
  id: string;
  kind: TriggerOpKind;
  tagRowKey: string;             // event_name ou nom du tag (label d'affichage)
  tagCategory: string;
  // Pour 'sync' :
  referenceContainerId?: string;
  referenceContainerName?: string;
  // Pour 'remove' :
  triggerName?: string;          // label du trigger retiré
  triggerSemanticKey?: string;
  // Cible(s) :
  steps: TriggerOpStep[];
  status: 'pending' | 'applied' | 'failed';
  createdAt: string;
  error?: string;
}
```

### Store Zustand

```typescript
pendingTriggerOps: TriggerOperation[]
addTriggerOp:    (op: Omit<TriggerOperation, 'id' | 'status' | 'createdAt'>) => void
removeTriggerOp: (id: string) => void
clearTriggerOps: () => void
```

---

## 5. UX — Localisation dans le drawer

```
┌─────────────────────────────────────────────────────────┐
│  [GA4]  purchase          [Déclencheurs différents]  X  │
│  5 containers · 1 absent                                │
│  ┌───────────────────────┬────────────────────────┐     │
│  │  Déclencheurs         │  Renommer              │     │
│  └───────────────────────┴────────────────────────┘     │
│                                                         │
│  [Synchroniser depuis une référence]  ← si incohérence  │
│                                                         │
│  ┌── TK · GTM-001 ─────────────────────────────────┐   │
│  │  [Custom Event]  DL - purchase                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌── Swiss · GTM-005 ─────────────────────────────────┐ │
│  │  [Custom Event]  DL - purchase                  │   │
│  │  [Page Vue]  All Pages  Toutes les pages  [Ret.] │   │  ← au survol
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Plan d'opérations — deux boutons séparés dans le header

```
[ 2 renommages planifiés ]   [ 1 action déclencheur ]   [ Mode aperçu ]   [ Scanner ]
```

Chaque bouton ouvre son propre panneau latéral.

Le panneau "Actions déclencheurs" liste les `TriggerOperation` pendantes avec :
- Type (Retrait / Synchronisation)
- Tag concerné
- Containers impactés avec détail des étapes
- Bouton supprimer l'opération
- Footer : `[Tout effacer]` + `[Appliquer (OAuth requis)]`

---

## 7. Cas limites

| Situation | Comportement |
|---|---|
| Retrait du dernier déclencheur | Avertissement + confirmation explicite requise |
| Sync : trigger sémantiquement équivalent trouvé dans le cible | Lier l'existant, ne pas créer de doublon |
| Sync : aucun équivalent trouvé dans le cible | Créer le trigger (config de la référence) + lier |
| Sync : tag absent dans un container | Exclu de la synchronisation — affiché en gris dans l'aperçu |
| Opération déjà planifiée pour ce tag + container | Bloquer le doublon, indiquer "Déjà planifié" |
| Sync sans incohérence détectée | Bouton Synchroniser masqué |
| Données mock (pré-OAuth) | Planification disponible — exécution bloquée jusqu'à OAuth |

---

## 8. Dépendances

| Dépendance | Statut |
|---|---|
| GCP OAuth | Requis pour l'exécution seulement |
| `TriggerOperation` dans `gtm.ts` | À créer |
| `pendingTriggerOps` dans le store | À ajouter |
| Panneau "Actions déclencheurs" (nouveau) | À créer |
| API GTM `tags.update` + `triggers.create` | Disponible post-OAuth |

---

## 9. Ordre d'implémentation

1. `TriggerOperation` type + store (`pendingTriggerOps`)
2. Action **Retirer** dans le drawer (plus simple — pas de création)
3. Bouton + panneau "Actions déclencheurs" dans le header
4. Action **Synchroniser** — aperçu + sélecteur de référence + queue
