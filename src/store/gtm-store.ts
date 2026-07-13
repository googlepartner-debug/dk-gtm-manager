import { create } from 'zustand';
import type {
  GTMAccount, GTMContainer, DeploymentPackage, DeploymentRecord, DeploymentResult,
  ContainerDiff, DiffEntity, GlobalDiffSummary, RenameOperation, TriggerOperation, DeletionOperation,
  ContainerRenameOperation, GTMTag, GTMTrigger, GTMVariable, TagDuplicationOperation, VariableDuplicationOperation,
  EntityCreationOperation, RollbackResult,
} from '../types/gtm';
import { findTagByRowKey } from '../lib/gtm-matrix';
import { STATIC_ACCOUNTS, STATIC_CONTAINERS } from '../data/gtm-static';
import {
  listAccounts, listContainers, getLiveVersion, createWorkspace,
  createTag, updateTag, listTagsFull, deleteTag,
  createVariable, updateVariable, listVariablesFull, deleteVariable,
  createTrigger, updateTrigger, listTriggersFull, deleteTrigger,
  listTemplates, listGtagConfig,
  createVersion, publishVersion,
  getDefaultWorkspace, listWorkspaces, getWorkspaceStatus,
  updateContainer, updateAccount,
  listVersionHeaders, getVersion, type GTMVersionHeader, type GTMVersionContent,
  listEnabledBuiltInVariables, enableBuiltInVariables,
} from '../lib/gtm-api';
import { detectRequiredBuiltInVariables } from '../lib/gtm-builtin-variables';
import type { MonitoringContainerData } from '../data/monitoring-mock';
import { MONITORING_MOCK } from '../data/monitoring-mock';
import { TEST_CONTAINER_ID, TEST_MONITORING_CONTAINER } from '../data/test-container-mock';
import { computeContainerDiff, diffVersions } from '../lib/gtm-diff';
import { computeEventChain as computeEventChainFn } from '../lib/event-chain';
import type { EventChainRow } from '../types/gtm';
import { loadPackages, savePackage, deletePackage, loadHistory, saveDeploymentRecord, updateDeploymentRecord } from '../lib/storage';

// ─── Storage helpers ──────────────────────────────────────────────────────────

function tryParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // QuotaExceededError: code 22 in older browsers, name in modern ones
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
      console.warn('[GTM Persist] localStorage plein — sauvegarde ignorée pour', key);
    }
  }
}

// ─── Recent session persistence ───────────────────────────────────────────────

const RECENT_KEY = 'dk_gtm_recent';

interface RecentSession {
  accountId: string;
  accountName?: string; // absent on older persisted sessions, pre-2026-07-14
  containerIds: string[];
}

function loadRecent(): RecentSession | null {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentSession) : null;
  } catch {
    return null;
  }
}

// accountName kept alongside the id purely for UX — showing "tu retrouveras [Nom]" on the
// session-expired screen (ContainersPage) without needing a successful accounts fetch first.
function saveRecent(accountId: string, containerIds: string[], accountName?: string) {
  localStorage.setItem(RECENT_KEY, JSON.stringify({ accountId, accountName, containerIds }));
}

const _recent = loadRecent();

// ─── Monitoring + ops persistence ─────────────────────────────────────────────
// Stored in separate keys so a large monitoringData never blocks ops from saving.
// Versioned keys (_v1) let us wipe stale data on schema changes by bumping the suffix.

const MONITORING_PERSIST_KEY = 'dk_gtm_monitoring_v1';
const OPS_PERSIST_KEY = 'dk_gtm_ops_v1';
const MAX_MONITORING_BYTES = 3_500_000; // 3.5 MB — safe below the typical 5-10 MB limit

type PersistedOps = {
  pendingDeletions: DeletionOperation[];
  pendingRenames: RenameOperation[];
  pendingTriggerOps: TriggerOperation[];
  pendingContainerRenames: ContainerRenameOperation[];
  pendingTagDuplications: TagDuplicationOperation[];
  pendingVariableDuplications: VariableDuplicationOperation[];
  pendingEntityCreations: EntityCreationOperation[];
};

const _persistedMonitoring = tryParse<MonitoringContainerData[]>(
  localStorage.getItem(MONITORING_PERSIST_KEY), [],
);

const _persistedOps = tryParse<PersistedOps>(
  localStorage.getItem(OPS_PERSIST_KEY),
  { pendingDeletions: [], pendingRenames: [], pendingTriggerOps: [], pendingContainerRenames: [], pendingTagDuplications: [], pendingVariableDuplications: [], pendingEntityCreations: [] },
);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Max containers scanned per batch (stay well under the GTM API 30 req/min quota
// for hour-long sessions; 40 × 8s = ~5min 20s per batch)
export const MONITORING_BATCH_SIZE = 40;

interface GTMStore {
  // Accounts & containers
  accounts: GTMAccount[];
  selectedAccountId: string | null;
  // Nom du dernier compte sélectionné, persisté séparément — permet d'afficher "tu
  // retrouveras [Nom]" sur l'écran de session expirée avant même que /accounts ait réussi.
  recentAccountName: string | null;
  containers: GTMContainer[];
  selectedContainerIds: Set<string>;
  isLoadingAccounts: boolean;
  isLoadingContainers: boolean;
  accountError: string | null;

  // Packages
  packages: DeploymentPackage[];
  selectedPackageId: string | null;

  // Diff
  diffs: Record<string, ContainerDiff>; // keyed by containerId
  isDiffing: boolean;
  diffError: string | null;

  // Deployment
  isDeploying: boolean;
  deploymentResults: DeploymentResult[];
  deploymentProgress: number;
  autoPublish: boolean;

  // History
  history: DeploymentRecord[];

  // Rollback
  isRollingBack: boolean;
  rollbackRecordId: string | null;
  rollbackResults: RollbackResult[];

  // Rename queue
  pendingRenames: RenameOperation[];

  // Trigger operations queue
  pendingTriggerOps: TriggerOperation[];

  // Deletion queue
  pendingDeletions: DeletionOperation[];

  // Container / Account rename queue
  pendingContainerRenames: ContainerRenameOperation[];

  // Tag duplication queue
  pendingTagDuplications: TagDuplicationOperation[];

  // Variable duplication queue
  pendingVariableDuplications: VariableDuplicationOperation[];

  // Entity creation queue (variable + optional trigger + optional tag, no source container)
  pendingEntityCreations: EntityCreationOperation[];

  // Active consultant profile
  activeProfileId: string | null;

  // Monitoring
  monitoringData: MonitoringContainerData[];
  isLoadingMonitoring: boolean;
  monitoringError: string | null;
  monitoringScanProgress: { current: number; total: number } | null;
  _cancelMonitoringScan: (() => void) | null;
  _abortDateEnrichment: boolean;

  // Actions — profile
  loadForProfile: (profileId: string) => void;

  // Actions — containers
  fetchAccounts: (token?: string) => Promise<void>;
  selectAccount: (accountId: string, token?: string) => Promise<void>;
  toggleContainer: (containerId: string) => void;
  selectAllContainers: () => void;
  clearContainerSelection: () => void;

  // Actions — monitoring
  scanMonitoring: (token: string) => Promise<void>;
  cancelMonitoringScan: () => void;
  clearMonitoringData: () => void;
  loadMockMonitoringData: () => void;
  // Container de test / bac à sable (2026-07-14) — ajoute un container fictif dédié à la
  // démo, sans écraser un monitoringData réel déjà scanné (contrairement à loadMockMonitoringData).
  seedTestContainer: () => void;

  // Actions — packages
  loadPackages: () => void;
  selectPackage: (id: string | null) => void;
  upsertPackage: (pkg: DeploymentPackage) => void;
  removePackage: (id: string) => void;

  // Actions — diff
  computeDiffs: (token: string) => Promise<void>;
  toggleEntitySelection: (containerId: string, entityKey: string) => void;
  selectAllEntities: (containerId: string) => void;
  deselectUnchanged: (containerId: string) => void;
  resetDiffs: () => void;
  globalDiffSummary: () => GlobalDiffSummary;

  // Actions — version diff (Chantier A : comparer deux versions d'un container pilote,
  // isoler le delta exact, en faire un nouveau package prêt à déployer ailleurs)
  versionHeaders: GTMVersionHeader[];
  isLoadingVersionHeaders: boolean;
  loadVersionHeaders: (token: string, containerId: string) => Promise<void>;
  versionDiffEntities: DiffEntity[] | null;
  isDiffingVersions: boolean;
  versionDiffError: string | null;
  computeVersionDiff: (
    token: string,
    containerId: string,
    beforeVersionId: string,
    afterVersionId: string,
  ) => Promise<void>;
  toggleVersionDiffEntity: (key: string) => void;
  selectAllVersionDiffEntities: () => void;
  clearVersionDiff: () => void;
  createPackageFromVersionDiff: (name: string, client?: string) => string; // returns new package id

  // Actions — deploy
  setAutoPublish: (v: boolean) => void;
  deploy: (token: string, packageId: string, versionName: string, versionDescription?: string) => Promise<void>;
  loadHistory: () => void;
  resetDeployment: () => void;

  // Actions — rollback (republish the version live before a given auto-published deployment)
  rollback: (token: string, record: DeploymentRecord) => Promise<void>;

  // Actions — renames (queued here, published from Déployer via applyContainerQueue)
  addRenames: (ops: Omit<RenameOperation, 'id' | 'status' | 'createdAt'>[]) => void;
  removeRename: (id: string) => void;
  clearRenames: () => void;

  // Actions — trigger ops (queued here, published from Déployer via applyContainerQueue)
  addTriggerOp: (op: Omit<TriggerOperation, 'id' | 'status' | 'createdAt'>) => void;
  removeTriggerOp: (id: string) => void;
  cancelTriggerOp: (id: string) => void;
  clearTriggerOps: () => void;

  // Actions — deletions
  isApplyingDeletions: boolean;
  applyPublishErrors: { containerName: string; error: string }[];
  addDeletions: (ops: Omit<DeletionOperation, 'id' | 'status' | 'createdAt'>[]) => void;
  cancelDeletion: (id: string) => void;
  removeDeletion: (id: string) => void;
  clearDeletions: () => void;
  applyDeletions: (token: string, opts: { versionName: string; description: string }) => Promise<void>;

  // Actions — duplicate tag from a reference container
  isDuplicatingTag: boolean;
  // Step 1 (optional) — write the tag into a BLANK workspace (existing empty one, or a newly
  // created one — never the shared Default Workspace, which may hold other consultants'
  // unrelated pending edits). Visible immediately in the GTM UI, reviewable before going live.
  writeTagDraft: (
    token: string,
    opts: { containerId: string; tag: GTMTag; linkedTriggerIds?: string[]; triggersToCreate?: GTMTrigger[] },
  ) => Promise<{ success: boolean; tagId?: string; workspaceId?: string; error?: string }>;
  // Step 2 — create a version from the given workspace's state and publish it.
  publishWorkspaceVersion: (
    token: string,
    opts: { containerId: string; workspaceId: string; versionName: string; description: string; label?: string },
  ) => Promise<{ success: boolean; error?: string }>;
  // Convenience — does step 1 + step 2 in one call (create tag, then version + publish)
  duplicateTagToContainer: (
    token: string,
    opts: { containerId: string; tag: GTMTag; linkedTriggerIds?: string[]; triggersToCreate?: GTMTrigger[]; versionName: string; description: string },
  ) => Promise<{ success: boolean; error?: string }>;

  // Actions — container/account renames
  addContainerRenames: (ops: Omit<ContainerRenameOperation, 'id' | 'status' | 'createdAt'>[]) => void;
  removeContainerRename: (id: string) => void;
  clearContainerRenames: () => void;
  isApplyingContainerRenames: boolean;
  applyContainerRenames: (token: string) => Promise<void>;

  // Actions — tag duplication queue (staged, published from Déployer alongside renames/trigger ops)
  addTagDuplication: (op: Omit<TagDuplicationOperation, 'id' | 'status' | 'createdAt'>) => void;
  removeTagDuplication: (id: string) => void;
  clearTagDuplications: () => void;

  // Actions — variable duplication queue (same pattern as tags)
  addVariableDuplication: (op: Omit<VariableDuplicationOperation, 'id' | 'status' | 'createdAt'>) => void;
  removeVariableDuplication: (id: string) => void;
  clearVariableDuplications: () => void;

  // Actions — entity creation queue (no source container — built from an external detection,
  // e.g. DataLayer Mapping finding a real dataLayer variable with no GTM counterpart)
  addEntityCreation: (op: Omit<EntityCreationOperation, 'id' | 'status' | 'createdAt'>) => void;
  removeEntityCreation: (id: string) => void;
  clearEntityCreations: () => void;

  // Self-healing: compares every pending rename/duplication/trigger-removal against the latest
  // scanned monitoringData and auto-marks anything already reflected in reality as 'applied' —
  // e.g. a rename done manually in GTM, or a queued op published earlier that never got cleared.
  // Runs automatically after every scan and on session load, so "planifié" never lies.
  reconcilePendingOps: () => void;

  // Unified per-container publish — combines pending renames + trigger ops + tag duplications
  // for ONE container into a single blank workspace + one version + one publish. This is the
  // only place these three queues get applied (Déployer page), so a container never ends up
  // with three separate versions for what the user sees as one review-then-publish action.
  isApplyingContainerQueue: boolean;
  applyContainerQueue: (
    token: string,
    containerId: string,
    opts: { versionName: string; description: string },
  ) => Promise<{ success: boolean; error?: string }>;

  // Event chain (GA4 audit)
  eventChainRows: EventChainRow[];
  computeEventChain: () => void;
}

// Finds a workspace with zero pending changes ("blank"), or creates a new one.
// Never returns the Default Workspace on the assumption it's dirty — it's shared across
// consultants on this account and may hold unrelated, unpublished edits from someone else.
async function resolveBlankWorkspace(
  token: string,
  accountId: string,
  containerId: string,
  label: string,
): Promise<{ workspaceId: string } | { error: string }> {
  try {
    const workspaces = await listWorkspaces(token, accountId, containerId);
    for (const ws of workspaces) {
      try {
        const status = await getWorkspaceStatus(token, accountId, containerId, ws.workspaceId);
        if (!status.workspaceChange || status.workspaceChange.length === 0) {
          return { workspaceId: ws.workspaceId };
        }
      } catch {
        // Can't verify this one's status — skip it, try the next.
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Impossible de lister les workspaces existants : ${msg}` };
  }

  try {
    const ws = await createWorkspace(token, accountId, containerId, label, 'Créé automatiquement par DK GTM Manager — workspace vierge pour cette opération');
    return { workspaceId: ws.workspaceId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Aucun workspace vierge disponible et impossible d'en créer un nouveau (limite GTM atteinte ?) : ${msg}` };
  }
}

export const useGTMStore = create<GTMStore>((set, get) => ({
  accounts: [],
  selectedAccountId: _recent?.accountId ?? null,
  recentAccountName: _recent?.accountName ?? null,
  containers: [],
  selectedContainerIds: new Set(_recent?.containerIds ?? []),
  isLoadingAccounts: false,
  isLoadingContainers: false,
  accountError: null,

  packages: loadPackages(),
  selectedPackageId: null,

  diffs: {},
  isDiffing: false,
  diffError: null,

  isDeploying: false,
  deploymentResults: [],
  deploymentProgress: 0,
  autoPublish: true,

  history: loadHistory(),

  isRollingBack: false,
  rollbackRecordId: null,
  rollbackResults: [],

  activeProfileId: null,

  monitoringData: _persistedMonitoring,
  isLoadingMonitoring: false,
  monitoringError: null,
  monitoringScanProgress: null,
  _cancelMonitoringScan: null,
  _abortDateEnrichment: false,

  pendingRenames: _persistedOps.pendingRenames,
  pendingTriggerOps: _persistedOps.pendingTriggerOps,
  pendingDeletions: _persistedOps.pendingDeletions,
  isApplyingDeletions: false,
  isDuplicatingTag: false,
  applyPublishErrors: [],
  pendingContainerRenames: _persistedOps.pendingContainerRenames,
  pendingTagDuplications: _persistedOps.pendingTagDuplications ?? [],
  pendingVariableDuplications: _persistedOps.pendingVariableDuplications ?? [],
  pendingEntityCreations: _persistedOps.pendingEntityCreations ?? [],

  eventChainRows: computeEventChainFn(_persistedMonitoring),
  computeEventChain: () => {
    const rows = computeEventChainFn(get().monitoringData);
    set({ eventChainRows: rows });
  },

  // ─── Accounts & containers ──────────────────────────────────────────────────

  fetchAccounts: async (token) => {
    set({ isLoadingAccounts: true, accountError: null });
    if (!token) {
      set({ accounts: STATIC_ACCOUNTS, isLoadingAccounts: false });
      return;
    }
    try {
      const accounts = await listAccounts(token);
      set({ accounts, isLoadingAccounts: false });
    } catch (err) {
      set({ isLoadingAccounts: false, accountError: String(err) });
    }
  },

  selectAccount: async (accountId, token) => {
    const isRestoringCurrentAccount = accountId === get().selectedAccountId;
    const accountName = get().accounts.find((a) => a.accountId === accountId)?.name ?? get().recentAccountName;
    set({
      selectedAccountId: accountId,
      recentAccountName: accountName ?? null,
      isLoadingContainers: true,
      containers: [],
      // Keep existing selection when restoring the same account (session restore)
      selectedContainerIds: isRestoringCurrentAccount ? get().selectedContainerIds : new Set(),
      diffs: {},
    });
    saveRecent(accountId, [...(isRestoringCurrentAccount ? get().selectedContainerIds : new Set<string>())], accountName ?? undefined);
    if (!token) {
      const containers = STATIC_CONTAINERS[accountId] ?? [];
      set({ containers, isLoadingContainers: false });
      return;
    }
    try {
      const containers = await listContainers(token, accountId);
      // Display containers immediately — no waiting for live versions
      set({ containers, isLoadingContainers: false });

      // Enrich with real publication dates — batched 8/600ms to stay under GTM quota (60/10s)
      if (get().selectedAccountId === accountId && !get()._abortDateEnrichment) {
        const BATCH = 8;
        const all: (GTMVersionContent | null)[] = new Array(containers.length).fill(null);
        for (let i = 0; i < containers.length; i += BATCH) {
          if (get().selectedAccountId !== accountId || get()._abortDateEnrichment) break;
          const chunk = containers.slice(i, i + BATCH);
          const chunkResults = await Promise.all(
            chunk.map((c) => getLiveVersion(token, accountId, c.containerId))
          );
          chunkResults.forEach((r, j) => { all[i + j] = r; });
          if (i + BATCH < containers.length) await sleep(600);
        }
        if (get().selectedAccountId !== accountId) return;
        const dateMap = new Map<string, string>();
        containers.forEach((c, i) => {
          const lv = all[i];
          if (!lv?.fingerprint) return;
          const raw = parseInt(lv.fingerprint, 10);
          // GTM fingerprint: ns (>1e16) ÷1M, μs (>1e13) ÷1000, ms (>1e11) as-is, s ×1000
          const ms = raw > 1e16 ? raw / 1_000_000 : raw > 1e13 ? raw / 1_000 : raw > 1e11 ? raw : raw * 1_000;
          const date = new Date(ms);
          if (date.getFullYear() > 2000) dateMap.set(c.containerId, date.toISOString());
        });
        set((state) => ({
          containers: state.containers.map((sc) =>
            dateMap.has(sc.containerId) ? { ...sc, publicationDate: dateMap.get(sc.containerId) } : sc
          ),
        }));
      }
    } catch (err) {
      set({ isLoadingContainers: false, accountError: String(err) });
    }
  },

  toggleContainer: (containerId) => {
    const ids = new Set(get().selectedContainerIds);
    if (ids.has(containerId)) ids.delete(containerId);
    else ids.add(containerId);
    set({ selectedContainerIds: ids, diffs: {} });
    const accountId = get().selectedAccountId;
    if (accountId) saveRecent(accountId, [...ids], get().recentAccountName ?? undefined);
  },

  selectAllContainers: () => {
    const ids = new Set(get().containers.map((c) => c.containerId));
    set({ selectedContainerIds: ids, diffs: {} });
    const accountId = get().selectedAccountId;
    if (accountId) saveRecent(accountId, [...ids], get().recentAccountName ?? undefined);
  },

  clearContainerSelection: () => {
    set({ selectedContainerIds: new Set(), diffs: {} });
    const accountId = get().selectedAccountId;
    if (accountId) saveRecent(accountId, [], get().recentAccountName ?? undefined);
  },

  // ─── Packages ───────────────────────────────────────────────────────────────

  loadPackages: () => set({ packages: loadPackages() }),
  selectPackage: (id) => set({ selectedPackageId: id, diffs: {} }),

  upsertPackage: (pkg) => {
    savePackage(pkg);
    set({ packages: loadPackages() });
  },

  removePackage: (id) => {
    deletePackage(id);
    set({
      packages: loadPackages(),
      selectedPackageId: get().selectedPackageId === id ? null : get().selectedPackageId,
    });
  },

  // ─── Diff ───────────────────────────────────────────────────────────────────

  computeDiffs: async (token) => {
    const { packages, selectedPackageId, containers, selectedContainerIds, selectedAccountId } = get();
    const pkg = packages.find((p) => p.id === selectedPackageId);
    if (!pkg || !selectedAccountId) return;

    const targetContainers = containers.filter((c) => selectedContainerIds.has(c.containerId));

    // Mark all as loading
    const initialDiffs: Record<string, ContainerDiff> = {};
    for (const c of targetContainers) {
      initialDiffs[c.containerId] = {
        containerId: c.containerId,
        containerName: c.name,
        containerPublicId: c.publicId,
        defaultWorkspaceId: '',
        entities: [],
        status: 'loading',
      };
    }
    set({ isDiffing: true, diffError: null, diffs: initialDiffs });

    // Compute diffs in parallel
    const results = await Promise.allSettled(
      targetContainers.map((c) =>
        computeContainerDiff(token, selectedAccountId, c.containerId, c.name, c.publicId, pkg.entities)
      )
    );

    const updatedDiffs: Record<string, ContainerDiff> = {};
    results.forEach((result, i) => {
      const containerId = targetContainers[i].containerId;
      if (result.status === 'fulfilled') {
        updatedDiffs[containerId] = result.value;
      } else {
        updatedDiffs[containerId] = {
          ...initialDiffs[containerId],
          status: 'error',
          error: String(result.reason),
        };
      }
    });

    set({ isDiffing: false, diffs: updatedDiffs });
  },

  toggleEntitySelection: (containerId, entityKey) => {
    set((state) => {
      const diff = state.diffs[containerId];
      if (!diff) return state;
      const entities = diff.entities.map((e) =>
        e.key === entityKey ? { ...e, selected: !e.selected } : e
      );
      return { diffs: { ...state.diffs, [containerId]: { ...diff, entities } } };
    });
  },

  selectAllEntities: (containerId) => {
    set((state) => {
      const diff = state.diffs[containerId];
      if (!diff) return state;
      const entities = diff.entities.map((e) => ({ ...e, selected: true }));
      return { diffs: { ...state.diffs, [containerId]: { ...diff, entities } } };
    });
  },

  deselectUnchanged: (containerId) => {
    set((state) => {
      const diff = state.diffs[containerId];
      if (!diff) return state;
      const entities = diff.entities.map((e) =>
        e.status === 'unchanged' ? { ...e, selected: false } : e
      );
      return { diffs: { ...state.diffs, [containerId]: { ...diff, entities } } };
    });
  },

  resetDiffs: () => set({ diffs: {} }),

  globalDiffSummary: () => {
    const diffs = Object.values(get().diffs).filter((d) => d.status === 'ready');
    // Dedupe by entity key across containers: use the first occurrence's status
    const seen = new Map<string, DiffEntity>();
    for (const diff of diffs) {
      for (const entity of diff.entities) {
        if (!seen.has(entity.key)) seen.set(entity.key, entity);
      }
    }
    const entities = Array.from(seen.values());
    return {
      newCount: entities.filter((e) => e.status === 'new').length,
      modifiedCount: entities.filter((e) => e.status === 'modified').length,
      unchangedCount: entities.filter((e) => e.status === 'unchanged').length,
      selectedCount: entities.filter((e) => e.selected).length,
    };
  },

  // ─── Version diff (Chantier A) ─────────────────────────────────────────────

  versionHeaders: [],
  isLoadingVersionHeaders: false,
  loadVersionHeaders: async (token, containerId) => {
    const { selectedAccountId } = get();
    if (!selectedAccountId) return;
    set({ isLoadingVersionHeaders: true, versionHeaders: [] });
    try {
      const headers = await listVersionHeaders(token, selectedAccountId, containerId);
      set({ versionHeaders: headers });
    } finally {
      set({ isLoadingVersionHeaders: false });
    }
  },

  versionDiffEntities: null,
  isDiffingVersions: false,
  versionDiffError: null,
  computeVersionDiff: async (token, containerId, beforeVersionId, afterVersionId) => {
    const { selectedAccountId } = get();
    if (!selectedAccountId) return;
    set({ isDiffingVersions: true, versionDiffError: null, versionDiffEntities: null });
    try {
      const [before, after] = await Promise.all([
        getVersion(token, selectedAccountId, containerId, beforeVersionId),
        getVersion(token, selectedAccountId, containerId, afterVersionId),
      ]);
      const entities = diffVersions(before, after);
      set({ versionDiffEntities: entities });
    } catch (err) {
      set({ versionDiffError: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ isDiffingVersions: false });
    }
  },

  toggleVersionDiffEntity: (key) => {
    set((state) => ({
      versionDiffEntities: state.versionDiffEntities?.map((e) => e.key === key ? { ...e, selected: !e.selected } : e) ?? null,
    }));
  },

  selectAllVersionDiffEntities: () => {
    set((state) => ({
      versionDiffEntities: state.versionDiffEntities?.map((e) => ({ ...e, selected: true })) ?? null,
    }));
  },

  clearVersionDiff: () => set({ versionDiffEntities: null, versionDiffError: null, versionHeaders: [] }),

  createPackageFromVersionDiff: (name, client) => {
    const entities = get().versionDiffEntities ?? [];
    // 'removed' entities are informational only — the package format can only create/update,
    // it has no delete semantics. Including one here would re-create the "before" definition,
    // the opposite of a deletion. Propagating a removal is a separate, explicit action (out of
    // scope here) — e.g. via Nettoyage on the target containers.
    const selected = entities.filter((e) => e.selected && e.status !== 'removed');
    const id = crypto.randomUUID();
    const pkg: DeploymentPackage = {
      id,
      name,
      client: client ?? '',
      createdAt: new Date().toISOString(),
      entities: {
        tags: selected.filter((e) => e.kind === 'tag').map((e) => e.proposed as GTMTag),
        variables: selected.filter((e) => e.kind === 'variable').map((e) => e.proposed as GTMVariable),
        triggers: selected.filter((e) => e.kind === 'trigger').map((e) => e.proposed as GTMTrigger),
      },
    };
    get().upsertPackage(pkg);
    return id;
  },

  // ─── Deploy (upsert) ────────────────────────────────────────────────────────

  setAutoPublish: (v) => set({ autoPublish: v }),

  deploy: async (token, packageId, versionName, versionDescription) => {
    const { packages, containers, selectedContainerIds, selectedAccountId, diffs, autoPublish } = get();
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg || !selectedAccountId) return;

    const targetContainers = containers.filter((c) => selectedContainerIds.has(c.containerId));

    const results: DeploymentResult[] = targetContainers.map((c) => ({
      containerId: c.containerId,
      containerName: c.name,
      containerPublicId: c.publicId,
      status: 'pending',
      steps: [
        { label: 'Créer workspace', status: 'pending' },
        { label: 'Activer variables natives', status: 'pending' },
        { label: 'Synchroniser les entités (upsert)', status: 'pending' },
        { label: 'Créer version', status: 'pending' },
        ...(autoPublish ? [{ label: 'Publier', status: 'pending' as const }] : []),
      ],
    }));

    set({ isDeploying: true, deploymentResults: results, deploymentProgress: 0 });

    const updateResult = (idx: number, partial: Partial<DeploymentResult>) => {
      set((state) => {
        const updated = [...state.deploymentResults];
        updated[idx] = { ...updated[idx], ...partial };
        return {
          deploymentResults: updated,
          deploymentProgress: Math.round(((idx + 1) / targetContainers.length) * 100),
        };
      });
    };

    const updateStep = (
      resultIdx: number,
      stepIdx: number,
      status: DeploymentResult['steps'][0]['status'],
      detail?: string
    ) => {
      set((state) => {
        const updated = [...state.deploymentResults];
        const steps = [...updated[resultIdx].steps];
        steps[stepIdx] = { ...steps[stepIdx], status, detail };
        updated[resultIdx] = { ...updated[resultIdx], steps };
        return { deploymentResults: updated };
      });
    };

    for (let i = 0; i < targetContainers.length; i++) {
      const container = targetContainers[i];
      const containerDiff = diffs[container.containerId];
      updateResult(i, { status: 'running' });

      try {
        // Step 0: Reuse a blank workspace, or create one (avoids hitting the 3-workspace GTM cap)
        updateStep(i, 0, 'running');
        const wsResult = await resolveBlankWorkspace(
          token, selectedAccountId, container.containerId,
          `DK Deploy - ${versionName}`
        );
        if ('error' in wsResult) throw new Error(wsResult.error);
        const ws = wsResult;
        updateStep(i, 0, 'success', `ws ${ws.workspaceId}`);

        // Step 1: Enable built-in variables the package's triggers/tags reference (e.g. {{Click URL}})
        // but that were never turned on in this container — otherwise the trigger deploys
        // silently inert (GTM accepts it, it just never fires).
        updateStep(i, 1, 'running');
        const selectedEntitiesForScan = containerDiff?.entities.filter((e) => e.selected) ?? [];
        const requiredBuiltIns = detectRequiredBuiltInVariables({
          tags: selectedEntitiesForScan.filter((e) => e.kind === 'tag').map((e) => e.proposed as GTMTag),
          variables: selectedEntitiesForScan.filter((e) => e.kind === 'variable').map((e) => e.proposed as GTMVariable),
          triggers: selectedEntitiesForScan.filter((e) => e.kind === 'trigger').map((e) => e.proposed as GTMTrigger),
        });
        if (requiredBuiltIns.size > 0) {
          const enabled = new Set(await listEnabledBuiltInVariables(token, selectedAccountId, container.containerId, ws.workspaceId));
          const missing = [...requiredBuiltIns].filter((t) => !enabled.has(t));
          if (missing.length > 0) {
            await enableBuiltInVariables(token, selectedAccountId, container.containerId, ws.workspaceId, missing);
          }
          updateStep(i, 1, 'success', missing.length > 0 ? `${missing.length} activée(s)` : 'déjà actives');
        } else {
          updateStep(i, 1, 'success', 'aucune requise');
        }

        // Step 2: Upsert selected entities
        updateStep(i, 2, 'running');
        const selectedEntities = containerDiff?.entities.filter((e) => e.selected) ?? [];

        // Sort: triggers → variables → tags (dependencies order)
        const order = { trigger: 0, variable: 1, tag: 2 };
        const sorted = [...selectedEntities].sort((a, b) => order[a.kind] - order[b.kind]);

        // A tag's firingTriggerId is stored as trigger NAMES in a package (never IDs — a package
        // is portable across containers). Seed with every trigger already live in this container
        // (touched by the package or not), then keep it updated as triggers get upserted below,
        // so tags can resolve to this container's own real trigger IDs right before being sent.
        const triggerNameToId = new Map<string, string>(Object.entries(containerDiff?.existingTriggersByName ?? {}));

        let upsertCount = 0;
        for (const entity of sorted) {
          if (entity.kind === 'trigger') {
            if (entity.existingId) {
              await updateTrigger(token, selectedAccountId, container.containerId, ws.workspaceId, entity.existingId, entity.proposed as never);
              triggerNameToId.set(entity.name, entity.existingId);
            } else {
              const created = await createTrigger(token, selectedAccountId, container.containerId, ws.workspaceId, entity.proposed as never);
              const createdId = (created as GTMTrigger | null)?.triggerId;
              if (createdId) triggerNameToId.set(entity.name, createdId);
            }
          } else if (entity.kind === 'variable') {
            if (entity.existingId) {
              await updateVariable(token, selectedAccountId, container.containerId, ws.workspaceId, entity.existingId, entity.proposed as never);
            } else {
              await createVariable(token, selectedAccountId, container.containerId, ws.workspaceId, entity.proposed as never);
            }
          } else if (entity.kind === 'tag') {
            const proposedTag = entity.proposed as GTMTag;
            const resolvedFiringTriggerId = proposedTag.firingTriggerId?.map((ref) => {
              const resolved = triggerNameToId.get(ref);
              if (!resolved) console.warn(`[GTM] Tag "${proposedTag.name}": déclencheur "${ref}" introuvable dans ${container.name}, référence ignorée`);
              return resolved;
            }).filter((id): id is string => Boolean(id));
            const tagToSend = { ...proposedTag, ...(resolvedFiringTriggerId ? { firingTriggerId: resolvedFiringTriggerId } : {}) };
            if (entity.existingId) {
              await updateTag(token, selectedAccountId, container.containerId, ws.workspaceId, entity.existingId, tagToSend as never);
            } else {
              await createTag(token, selectedAccountId, container.containerId, ws.workspaceId, tagToSend as never);
            }
          }
          upsertCount++;
        }
        updateStep(i, 2, 'success', `${upsertCount} entité(s)`);

        // Step 3: Create version
        updateStep(i, 3, 'running');
        const versionRes = await createVersion(
          token, selectedAccountId, container.containerId, ws.workspaceId,
          versionName, versionDescription ?? `Package: ${pkg.name}`
        );
        const versionId = versionRes.containerVersion?.containerVersionId ?? '';
        updateStep(i, 3, 'success', `v${versionId}`);

        // Step 4: Publish (optional)
        let previousVersionId: string | undefined;
        if (autoPublish) {
          updateStep(i, 4, 'running');
          // Capture what's live right now — BEFORE publishing — so a later rollback knows
          // which version to republish. Best-effort: a fresh container may have no live
          // version yet, and if this lookup fails, rollback simply won't be offered for it.
          try {
            const live = await getLiveVersion(token, selectedAccountId, container.containerId);
            previousVersionId = live?.containerVersionId;
          } catch {
            previousVersionId = undefined;
          }
          await publishVersion(token, selectedAccountId, container.containerId, versionId);
          updateStep(i, 4, 'success');
        }

        updateResult(i, { status: 'success', workspaceId: ws.workspaceId, versionId, previousVersionId });
      } catch (err) {
        const errorMsg = String(err);
        set((state) => {
          const updated = [...state.deploymentResults];
          const steps = updated[i].steps.map((s) =>
            s.status === 'running' ? { ...s, status: 'error' as const, detail: errorMsg } : s
          );
          updated[i] = { ...updated[i], status: 'error', steps, error: errorMsg };
          return { deploymentResults: updated };
        });
      }
    }

    const record: DeploymentRecord = {
      id: crypto.randomUUID(),
      packageName: pkg.name,
      deployedAt: new Date().toISOString(),
      accountId: selectedAccountId,
      containers: get().deploymentResults,
      autoPublish,
    };
    saveDeploymentRecord(record);

    set({ isDeploying: false, deploymentProgress: 100, history: loadHistory() });
  },

  loadHistory: () => set({ history: loadHistory() }),
  resetDeployment: () => set({ deploymentResults: [], deploymentProgress: 0 }),

  // Republishes, per container, the version that was live right before this deployment
  // published — undoing its effect. Only containers that succeeded AND have a captured
  // previousVersionId are eligible; others are marked 'skipped' with an explanation.
  // Isolation matches deploy(): a failing container doesn't block the others.
  rollback: async (token, record) => {
    if (!record.autoPublish) return;

    const eligible = record.containers.filter((c) => c.status === 'success');
    const initial: RollbackResult[] = eligible.map((c) => ({
      containerId: c.containerId,
      containerName: c.containerName,
      containerPublicId: c.containerPublicId,
      status: c.previousVersionId ? 'pending' : 'skipped',
      error: c.previousVersionId ? undefined : "Pas de version antérieure enregistrée pour ce container — republiez manuellement une ancienne version depuis GTM.",
    }));

    set({ isRollingBack: true, rollbackRecordId: record.id, rollbackResults: initial });

    const updateRb = (idx: number, partial: Partial<RollbackResult>) => {
      set((state) => {
        const updated = [...state.rollbackResults];
        updated[idx] = { ...updated[idx], ...partial };
        return { rollbackResults: updated };
      });
    };

    for (let i = 0; i < eligible.length; i++) {
      const c = eligible[i];
      if (!c.previousVersionId) continue; // already marked 'skipped' above

      updateRb(i, { status: 'running' });
      try {
        await publishVersion(token, record.accountId, c.containerId, c.previousVersionId);
        updateRb(i, { status: 'success' });
      } catch (err) {
        updateRb(i, { status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    }

    const finalResults = get().rollbackResults;
    updateDeploymentRecord(record.id, {
      rolledBackAt: new Date().toISOString(),
      rollbackResults: finalResults,
    });

    set({ isRollingBack: false, history: loadHistory() });
  },

  addRenames: (ops) => {
    set((state) => {
      // Skip anything that duplicates an already-pending rename for the same entity —
      // otherwise re-queuing the same rename twice leaves a stale "planifié" ghost behind
      // once the first copy gets published.
      const isDuplicate = (op: typeof ops[number]) => state.pendingRenames.some((r) =>
        r.status === 'pending' && r.containerId === op.containerId && r.oldName === op.oldName && r.newName === op.newName,
      );
      const newOps: RenameOperation[] = ops.filter((op) => !isDuplicate(op)).map((op) => ({
        ...op,
        id: crypto.randomUUID(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      }));
      return { pendingRenames: [...state.pendingRenames, ...newOps] };
    });
  },

  removeRename: (id) =>
    set((state) => ({ pendingRenames: state.pendingRenames.filter((r) => r.id !== id) })),

  clearRenames: () => set({ pendingRenames: [] }),

  addTriggerOp: (op) => {
    set((state) => {
      // Same guard as addRenames — avoid a stale duplicate lingering after the first copy is published.
      const containerIds = op.steps.map((s) => s.containerId).sort().join(',');
      const isDuplicate = state.pendingTriggerOps.some((existing) =>
        existing.status === 'pending' &&
        existing.kind === op.kind &&
        existing.tagRowKey === op.tagRowKey &&
        existing.tagCategory === op.tagCategory &&
        existing.triggerName === op.triggerName &&
        existing.steps.map((s) => s.containerId).sort().join(',') === containerIds,
      );
      if (isDuplicate) return state;
      const newOp: TriggerOperation = {
        ...op,
        id: crypto.randomUUID(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      return { pendingTriggerOps: [...state.pendingTriggerOps, newOp] };
    });
  },

  removeTriggerOp: (id) =>
    set((state) => ({ pendingTriggerOps: state.pendingTriggerOps.filter((op) => op.id !== id) })),

  cancelTriggerOp: (id) =>
    set((state) => ({
      pendingTriggerOps: state.pendingTriggerOps.map((op) =>
        op.id === id ? { ...op, status: 'cancelled' as const } : op,
      ),
    })),

  clearTriggerOps: () => set({ pendingTriggerOps: [] }),

  addDeletions: (ops) => {
    const newOps: DeletionOperation[] = ops.map((op) => ({
      ...op,
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }));
    set((state) => ({ pendingDeletions: [...state.pendingDeletions, ...newOps] }));
  },

  cancelDeletion: (id) =>
    set((state) => ({
      pendingDeletions: state.pendingDeletions.map((op) =>
        op.id === id ? { ...op, status: 'cancelled' as const } : op,
      ),
    })),

  removeDeletion: (id) =>
    set((state) => ({ pendingDeletions: state.pendingDeletions.filter((op) => op.id !== id) })),

  clearDeletions: () => set({ pendingDeletions: [] }),

  applyDeletions: async (token, { versionName, description }) => {
    const { pendingDeletions, selectedAccountId, monitoringData } = get();
    const pending = pendingDeletions.filter((op) => op.status === 'pending');
    if (!selectedAccountId || pending.length === 0) return;

    const wsMap = new Map<string, string>();
    const metaMap = new Map<string, { name: string; publicId: string }>();
    for (const d of monitoringData) {
      wsMap.set(d.containerId, d.workspaceId);
      metaMap.set(d.containerId, { name: d.containerName, publicId: d.publicId });
    }

    set({ isApplyingDeletions: true, applyPublishErrors: [] });
    const affectedContainers = new Set<string>();
    const deletedByContainer = new Map<string, number>();

    try {
      // Step 1: delete entities
      // Reverse of creation order (tag → variable → trigger) so a tag never
      // outlives the trigger/variable it depends on mid-deletion (GTM 400s otherwise).
      const deletionOrder = { tag: 0, variable: 1, trigger: 2 };
      const orderedPending = [...pending].sort((a, b) => deletionOrder[a.kind] - deletionOrder[b.kind]);
      for (const op of orderedPending) {
        const workspaceId = wsMap.get(op.containerId);
        if (!workspaceId || !op.entityId) {
          console.warn(`[GTM] Skipping "${op.entityName}" — missing workspaceId or entityId`);
          continue;
        }
        try {
          if (op.kind === 'variable') {
            await deleteVariable(token, selectedAccountId, op.containerId, workspaceId, op.entityId);
          } else if (op.kind === 'trigger') {
            await deleteTrigger(token, selectedAccountId, op.containerId, workspaceId, op.entityId);
          } else {
            await deleteTag(token, selectedAccountId, op.containerId, workspaceId, op.entityId);
          }
          affectedContainers.add(op.containerId);
          deletedByContainer.set(op.containerId, (deletedByContainer.get(op.containerId) ?? 0) + 1);
          set((state) => ({
            pendingDeletions: state.pendingDeletions.map((d) =>
              d.id === op.id ? { ...d, status: 'applied' as const } : d,
            ),
          }));
        } catch (err) {
          console.error(`[GTM] Delete failed for "${op.entityName}":`, err);
        }
      }

      // Step 2: create version + publish per affected container
      const publishErrors: { containerName: string; error: string }[] = [];
      const deployResults: DeploymentResult[] = [];

      for (const containerId of affectedContainers) {
        const workspaceId = wsMap.get(containerId);
        if (!workspaceId) continue;
        const meta = metaMap.get(containerId);
        const count = deletedByContainer.get(containerId) ?? 0;

        const result: DeploymentResult = {
          containerId,
          containerName: meta?.name ?? containerId,
          containerPublicId: meta?.publicId ?? '',
          workspaceId,
          status: 'error',
          steps: [
            { label: `${count} suppression${count > 1 ? 's' : ''}`, status: 'success' },
            { label: 'Créer version', status: 'pending' },
            { label: 'Publier', status: 'pending' },
          ],
        };

        try {
          // Capture what's live BEFORE publishing the deletion, so a rollback can restore it —
          // deletions are the highest-risk action in this tool, so they get the same safety net.
          let previousVersionId: string | undefined;
          try {
            const live = await getLiveVersion(token, selectedAccountId, containerId);
            previousVersionId = live?.containerVersionId;
          } catch {
            previousVersionId = undefined;
          }

          const versionRes = await createVersion(token, selectedAccountId, containerId, workspaceId, versionName, description);
          const versionId = versionRes.containerVersion?.containerVersionId;
          result.steps[1].status = 'success';

          if (!versionId) {
            result.steps[2].status = 'error';
            result.steps[2].detail = 'versionId absent de la réponse API';
            result.error = 'versionId absent de la réponse createVersion';
            publishErrors.push({ containerName: meta?.name ?? containerId, error: 'Aucun versionId retourné par GTM' });
          } else {
            result.versionId = versionId;
            await publishVersion(token, selectedAccountId, containerId, versionId);
            result.steps[2].status = 'success';
            result.status = 'success';
            result.previousVersionId = previousVersionId;
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          result.error = errMsg;
          if (result.steps[1].status === 'pending') {
            result.steps[1].status = 'error';
            result.steps[1].detail = errMsg;
          } else {
            result.steps[2].status = 'error';
            result.steps[2].detail = errMsg;
          }
          publishErrors.push({ containerName: meta?.name ?? containerId, error: errMsg });
          console.error(`[GTM] Publish failed for container ${containerId}:`, err);
        }

        deployResults.push(result);
      }

      // Step 3: save to history (deletions happened — record even on partial publish failure)
      if (deployResults.length > 0) {
        saveDeploymentRecord({
          id: crypto.randomUUID(),
          packageName: `Nettoyage — ${versionName}`,
          deployedAt: new Date().toISOString(),
          accountId: selectedAccountId,
          containers: deployResults,
          autoPublish: true,
        });
        set({ history: loadHistory() });
      }

      if (publishErrors.length > 0) {
        set({ applyPublishErrors: publishErrors });
      }
    } finally {
      set({ isApplyingDeletions: false });
    }
  },

  writeTagDraft: async (token, { containerId, tag, linkedTriggerIds = [], triggersToCreate = [] }) => {
    const { selectedAccountId, monitoringData } = get();
    const meta = monitoringData.find((d) => d.containerId === containerId);
    if (!selectedAccountId || !meta) return { success: false, error: 'Container introuvable dans les données scannées' };

    set({ isDuplicatingTag: true, applyPublishErrors: [] });
    try {
      const blank = await resolveBlankWorkspace(token, selectedAccountId, containerId, `DK Duplication — ${tag.name}`);
      if ('error' in blank) {
        set({ applyPublishErrors: [{ containerName: meta.containerName, error: blank.error }] });
        return { success: false, error: blank.error };
      }

      const createdTriggerIds: string[] = [];
      const createdTriggers: GTMTrigger[] = [];
      for (const tr of triggersToCreate) {
        // Whitelist only the fields a trigger CREATE accepts. `tr` comes from a live scan and
        // carries extra read-only API fields (accountId, containerId, workspaceId, fingerprint,
        // path, tagManagerUrl...) — sending those back causes a 400 Bad Request.
        const clone: GTMTrigger = {
          name: tr.name,
          type: tr.type,
          ...(tr.filter ? { filter: tr.filter.map((f) => ({ ...f, parameter: f.parameter.map((p) => ({ ...p })) })) } : {}),
          ...(tr.customEventFilter ? { customEventFilter: tr.customEventFilter.map((f) => ({ ...f, parameter: f.parameter.map((p) => ({ ...p })) })) } : {}),
          ...(tr.parameter ? { parameter: tr.parameter.map((p) => ({ ...p })) } : {}),
          ...(tr.notes ? { notes: tr.notes } : {}),
        };
        try {
          const createdTr = (await createTrigger(token, selectedAccountId, containerId, blank.workspaceId, clone as never)) as { triggerId?: string };
          if (createdTr.triggerId) {
            createdTriggerIds.push(createdTr.triggerId);
            createdTriggers.push({ ...tr, triggerId: createdTr.triggerId });
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          set({ applyPublishErrors: [{ containerName: meta.containerName, error: `Échec de création du déclencheur "${tr.name}" : ${errMsg}` }] });
          return { success: false, error: `Échec de création du déclencheur "${tr.name}" : ${errMsg}` };
        }
      }

      const fullTag: GTMTag = { ...tag, firingTriggerId: [...linkedTriggerIds, ...createdTriggerIds] };
      const created = (await createTag(token, selectedAccountId, containerId, blank.workspaceId, fullTag as never)) as { tagId?: string };
      // Reflect locally so the matrix shows the tag (and any new triggers) as present without waiting for a rescan.
      // Note: this writes to a dedicated blank workspace, not the scanned Default Workspace —
      // a later rescan may still show "Absent" until that workspace is synced/merged.
      set((state) => ({
        monitoringData: state.monitoringData.map((d) =>
          d.containerId === containerId
            ? { ...d, tags: [...d.tags, { ...fullTag, tagId: created.tagId }], triggers: [...d.triggers, ...createdTriggers] }
            : d,
        ),
      }));
      return { success: true, tagId: created.tagId, workspaceId: blank.workspaceId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      set({ applyPublishErrors: [{ containerName: meta.containerName, error: errMsg }] });
      return { success: false, error: errMsg };
    } finally {
      set({ isDuplicatingTag: false });
    }
  },

  publishWorkspaceVersion: async (token, { containerId, workspaceId, versionName, description, label }) => {
    const { selectedAccountId, monitoringData } = get();
    const meta = monitoringData.find((d) => d.containerId === containerId);
    if (!selectedAccountId || !meta) return { success: false, error: 'Container introuvable dans les données scannées' };

    set({ isDuplicatingTag: true, applyPublishErrors: [] });

    const result: DeploymentResult = {
      containerId,
      containerName: meta.containerName,
      containerPublicId: meta.publicId,
      workspaceId,
      status: 'error',
      steps: [
        { label: 'Créer version', status: 'pending' },
        { label: 'Publier', status: 'pending' },
      ],
    };
    const recordName = label ?? `Publication — ${versionName}`;

    try {
      // Same safety net as deploy()/applyDeletions(): capture what's live before we publish
      // over it, so a rollback from Historique can restore it.
      let previousVersionId: string | undefined;
      try {
        const live = await getLiveVersion(token, selectedAccountId, containerId);
        previousVersionId = live?.containerVersionId;
      } catch {
        previousVersionId = undefined;
      }

      const versionRes = await createVersion(token, selectedAccountId, containerId, workspaceId, versionName, description);
      const versionId = versionRes.containerVersion?.containerVersionId;
      result.steps[0].status = 'success';

      if (!versionId) {
        result.steps[1].status = 'error';
        result.steps[1].detail = 'versionId absent de la réponse API';
        result.error = 'Aucun versionId retourné par GTM';
        saveDeploymentRecord({
          id: crypto.randomUUID(), packageName: recordName, deployedAt: new Date().toISOString(),
          accountId: selectedAccountId, containers: [result], autoPublish: true,
        });
        set({ history: loadHistory(), applyPublishErrors: [{ containerName: meta.containerName, error: result.error }] });
        return { success: false, error: result.error };
      }

      result.versionId = versionId;
      await publishVersion(token, selectedAccountId, containerId, versionId);
      result.steps[1].status = 'success';
      result.status = 'success';
      result.previousVersionId = previousVersionId;

      saveDeploymentRecord({
        id: crypto.randomUUID(), packageName: recordName, deployedAt: new Date().toISOString(),
        accountId: selectedAccountId, containers: [result], autoPublish: true,
      });
      set({ history: loadHistory() });
      return { success: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (result.steps[0].status === 'pending') {
        result.steps[0].status = 'error';
        result.steps[0].detail = errMsg;
      } else {
        result.steps[1].status = 'error';
        result.steps[1].detail = errMsg;
      }
      result.error = errMsg;
      saveDeploymentRecord({
        id: crypto.randomUUID(), packageName: recordName, deployedAt: new Date().toISOString(),
        accountId: selectedAccountId, containers: [result], autoPublish: true,
      });
      set({ history: loadHistory(), applyPublishErrors: [{ containerName: meta.containerName, error: errMsg }] });
      return { success: false, error: errMsg };
    } finally {
      set({ isDuplicatingTag: false });
    }
  },

  duplicateTagToContainer: async (token, { containerId, tag, linkedTriggerIds, triggersToCreate, versionName, description }) => {
    const draft = await get().writeTagDraft(token, { containerId, tag, linkedTriggerIds, triggersToCreate });
    if (!draft.success || !draft.workspaceId) return { success: false, error: draft.error };
    return get().publishWorkspaceVersion(token, { containerId, workspaceId: draft.workspaceId, versionName, description, label: `Duplication — ${tag.name}` });
  },

  addTagDuplication: (op) => {
    set((state) => {
      const isDuplicate = state.pendingTagDuplications.some((existing) =>
        existing.status === 'pending' && existing.containerId === op.containerId && existing.tag.name === op.tag.name,
      );
      if (isDuplicate) return state;
      const newOp: TagDuplicationOperation = {
        ...op,
        id: crypto.randomUUID(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      return { pendingTagDuplications: [...state.pendingTagDuplications, newOp] };
    });
  },

  removeTagDuplication: (id) =>
    set((state) => ({ pendingTagDuplications: state.pendingTagDuplications.filter((op) => op.id !== id) })),

  clearTagDuplications: () => set({ pendingTagDuplications: [] }),

  addVariableDuplication: (op) => {
    set((state) => {
      const isDuplicate = state.pendingVariableDuplications.some((existing) =>
        existing.status === 'pending' && existing.containerId === op.containerId && existing.variable.name === op.variable.name,
      );
      if (isDuplicate) return state;
      const newOp: VariableDuplicationOperation = {
        ...op,
        id: crypto.randomUUID(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      return { pendingVariableDuplications: [...state.pendingVariableDuplications, newOp] };
    });
  },

  removeVariableDuplication: (id) =>
    set((state) => ({ pendingVariableDuplications: state.pendingVariableDuplications.filter((op) => op.id !== id) })),

  clearVariableDuplications: () => set({ pendingVariableDuplications: [] }),

  addEntityCreation: (op) => {
    set((state) => {
      const isDuplicate = state.pendingEntityCreations.some((existing) =>
        existing.status === 'pending' && existing.containerId === op.containerId && existing.variable.name === op.variable.name,
      );
      if (isDuplicate) return state;
      const newOp: EntityCreationOperation = {
        ...op,
        id: crypto.randomUUID(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      return { pendingEntityCreations: [...state.pendingEntityCreations, newOp] };
    });
  },

  removeEntityCreation: (id) =>
    set((state) => ({ pendingEntityCreations: state.pendingEntityCreations.filter((op) => op.id !== id) })),

  clearEntityCreations: () => set({ pendingEntityCreations: [] }),

  reconcilePendingOps: () => {
    const { monitoringData, pendingRenames, pendingTagDuplications, pendingVariableDuplications, pendingTriggerOps, pendingEntityCreations } = get();
    if (monitoringData.length === 0) return;

    const dataByContainer = new Map(monitoringData.map((d) => [d.containerId, d]));
    const allNames = (d: MonitoringContainerData) => [
      ...d.tags.map((t) => t.name),
      ...d.triggers.map((t) => t.name),
      ...d.variables.map((v) => v.name),
    ];

    let renamesChanged = false;
    const nextRenames = pendingRenames.map((op) => {
      if (op.status !== 'pending') return op;
      const meta = dataByContainer.get(op.containerId);
      if (!meta) return op;
      const names = allNames(meta);
      const alreadyDone = !names.includes(op.oldName) && names.includes(op.newName);
      if (alreadyDone) { renamesChanged = true; return { ...op, status: 'applied' as const }; }
      return op;
    });

    let tagDupsChanged = false;
    const nextTagDups = pendingTagDuplications.map((op) => {
      if (op.status !== 'pending') return op;
      const meta = dataByContainer.get(op.containerId);
      if (!meta) return op;
      const alreadyDone = meta.tags.some((t) => t.name === op.tag.name);
      if (alreadyDone) { tagDupsChanged = true; return { ...op, status: 'applied' as const }; }
      return op;
    });

    let varDupsChanged = false;
    const nextVarDups = pendingVariableDuplications.map((op) => {
      if (op.status !== 'pending') return op;
      const meta = dataByContainer.get(op.containerId);
      if (!meta) return op;
      const alreadyDone = meta.variables.some((v) => v.name === op.variable.name);
      if (alreadyDone) { varDupsChanged = true; return { ...op, status: 'applied' as const }; }
      return op;
    });

    // Trigger ops: only the simple 'remove' case is safely auto-verifiable (a single trigger ID
    // either is or isn't in the tag's firingTriggerId). 'sync' spans multiple steps/containers —
    // left for manual review rather than risk a wrong auto-clear.
    let triggerOpsChanged = false;
    const nextTriggerOps = pendingTriggerOps.map((op) => {
      if (op.status !== 'pending' || op.kind !== 'remove') return op;
      const allStepsResolved = op.steps.every((step) => {
        const meta = dataByContainer.get(step.containerId);
        if (!meta) return false;
        const tag = findTagByRowKey(meta.tags, op.tagCategory, op.tagRowKey, meta.templates);
        if (!tag) return false;
        const firing = tag.firingTriggerId ?? [];
        return (step.unlink ?? []).every((id) => !firing.includes(id));
      });
      if (allStepsResolved) { triggerOpsChanged = true; return { ...op, status: 'applied' as const }; }
      return op;
    });

    // Entity creations are done once the variable exists — trigger/tag are secondary to that check
    // (a variable created without its planned trigger/tag would need manual review, not silent success).
    let entityCreationsChanged = false;
    const nextEntityCreations = pendingEntityCreations.map((op) => {
      if (op.status !== 'pending') return op;
      const meta = dataByContainer.get(op.containerId);
      if (!meta) return op;
      const alreadyDone = meta.variables.some((v) => v.name === op.variable.name);
      if (alreadyDone) { entityCreationsChanged = true; return { ...op, status: 'applied' as const }; }
      return op;
    });

    if (renamesChanged || tagDupsChanged || varDupsChanged || triggerOpsChanged || entityCreationsChanged) {
      set({
        pendingRenames: nextRenames,
        pendingTagDuplications: nextTagDups,
        pendingVariableDuplications: nextVarDups,
        pendingTriggerOps: nextTriggerOps,
        pendingEntityCreations: nextEntityCreations,
      });
    }
  },

  isApplyingContainerQueue: false,
  applyContainerQueue: async (token, containerId, { versionName, description }) => {
    const { selectedAccountId, monitoringData, pendingRenames, pendingTriggerOps, pendingTagDuplications, pendingVariableDuplications, pendingEntityCreations } = get();
    const meta = monitoringData.find((d) => d.containerId === containerId);
    if (!selectedAccountId || !meta) return { success: false, error: 'Container introuvable dans les données scannées' };

    const renameOps = pendingRenames.filter((r) => r.status === 'pending' && r.containerId === containerId);
    const dupOps = pendingTagDuplications.filter((d) => d.status === 'pending' && d.containerId === containerId);
    const varDupOps = pendingVariableDuplications.filter((d) => d.status === 'pending' && d.containerId === containerId);
    const creationOps = pendingEntityCreations.filter((c) => c.status === 'pending' && c.containerId === containerId);
    const triggerWorkItems = pendingTriggerOps.flatMap((op) =>
      op.status === 'pending'
        ? op.steps.filter((s) => s.containerId === containerId).map((step) => ({ opId: op.id, step }))
        : [],
    );

    if (renameOps.length === 0 && dupOps.length === 0 && varDupOps.length === 0 && creationOps.length === 0 && triggerWorkItems.length === 0) {
      return { success: false, error: 'Aucune modification en attente pour ce container' };
    }

    set({ isApplyingContainerQueue: true, applyPublishErrors: [] });

    try {
      const label = `DK Déploiement — ${meta.containerName}`;
      const blank = await resolveBlankWorkspace(token, selectedAccountId, containerId, label);
      if ('error' in blank) {
        set({ applyPublishErrors: [{ containerName: meta.containerName, error: blank.error }] });
        return { success: false, error: blank.error };
      }
      const workspaceId = blank.workspaceId;

      let okCount = 0;
      let totalCount = 0;

      // 1. Renames
      for (const op of renameOps) {
        totalCount++;
        try {
          const tag = meta.tags.find((t) => t.name === op.oldName);
          const trigger = !tag ? meta.triggers.find((t) => t.name === op.oldName) : undefined;
          const variable = !tag && !trigger ? meta.variables.find((v) => v.name === op.oldName) : undefined;

          if (tag && tag.tagId) {
            const payload: GTMTag = {
              name: op.newName, type: tag.type,
              ...(tag.parameter ? { parameter: tag.parameter } : {}),
              ...(tag.firingTriggerId ? { firingTriggerId: tag.firingTriggerId } : {}),
              ...(tag.blockingTriggerId ? { blockingTriggerId: tag.blockingTriggerId } : {}),
              ...(tag.tagFiringOption ? { tagFiringOption: tag.tagFiringOption } : {}),
              ...(tag.notes ? { notes: tag.notes } : {}),
            };
            await updateTag(token, selectedAccountId, containerId, workspaceId, tag.tagId, payload as never);
          } else if (trigger && trigger.triggerId) {
            const payload: GTMTrigger = {
              name: op.newName, type: trigger.type,
              ...(trigger.filter ? { filter: trigger.filter } : {}),
              ...(trigger.customEventFilter ? { customEventFilter: trigger.customEventFilter } : {}),
              ...(trigger.parameter ? { parameter: trigger.parameter } : {}),
              ...(trigger.notes ? { notes: trigger.notes } : {}),
            };
            await updateTrigger(token, selectedAccountId, containerId, workspaceId, trigger.triggerId, payload as never);
          } else if (variable && variable.variableId) {
            const payload: GTMVariable = {
              name: op.newName, type: variable.type,
              ...(variable.parameter ? { parameter: variable.parameter } : {}),
              ...(variable.notes ? { notes: variable.notes } : {}),
            };
            await updateVariable(token, selectedAccountId, containerId, workspaceId, variable.variableId, payload as never);
          } else {
            throw new Error(`Entité "${op.oldName}" introuvable dans ${meta.containerName}`);
          }
          okCount++;
          set((state) => ({ pendingRenames: state.pendingRenames.map((r) => r.id === op.id ? { ...r, status: 'applied' as const } : r) }));
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          set((state) => ({ pendingRenames: state.pendingRenames.map((r) => r.id === op.id ? { ...r, status: 'failed' as const, error: errMsg } : r) }));
        }
      }

      // 2. Trigger ops (remove/sync) — group by parent op so a multi-container op only
      // gets marked applied once ALL of its steps (across containers) have succeeded.
      const opSucceededSteps = new Map<string, number>();
      for (const { opId, step } of triggerWorkItems) {
        totalCount++;
        const op = pendingTriggerOps.find((p) => p.id === opId);
        if (!op) continue;
        try {
          const tag = findTagByRowKey(meta.tags, op.tagCategory, op.tagRowKey, meta.templates);
          if (!tag || !tag.tagId) throw new Error(`Tag "${op.tagRowKey}" introuvable dans ${meta.containerName}`);

          const firing = new Set(tag.firingTriggerId ?? []);
          for (const id of step.unlink ?? []) firing.delete(id);
          for (const id of step.linkExisting ?? []) firing.add(id);

          for (const tr of step.createAndLink ?? []) {
            const clone: GTMTrigger = {
              name: tr.name, type: tr.type,
              ...(tr.filter ? { filter: tr.filter } : {}),
              ...(tr.customEventFilter ? { customEventFilter: tr.customEventFilter } : {}),
              ...(tr.parameter ? { parameter: tr.parameter } : {}),
              ...(tr.notes ? { notes: tr.notes } : {}),
            };
            const createdTr = (await createTrigger(token, selectedAccountId, containerId, workspaceId, clone as never)) as { triggerId?: string };
            if (createdTr.triggerId) firing.add(createdTr.triggerId);
          }

          const tagPayload: GTMTag = {
            name: tag.name, type: tag.type,
            ...(tag.parameter ? { parameter: tag.parameter } : {}),
            firingTriggerId: [...firing],
            ...(tag.blockingTriggerId ? { blockingTriggerId: tag.blockingTriggerId } : {}),
            ...(tag.tagFiringOption ? { tagFiringOption: tag.tagFiringOption } : {}),
            ...(tag.notes ? { notes: tag.notes } : {}),
          };
          await updateTag(token, selectedAccountId, containerId, workspaceId, tag.tagId, tagPayload as never);

          okCount++;
          opSucceededSteps.set(opId, (opSucceededSteps.get(opId) ?? 0) + 1);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          set((state) => ({
            pendingTriggerOps: state.pendingTriggerOps.map((o) => o.id === opId ? { ...o, status: 'failed' as const, error: errMsg } : o),
          }));
        }
      }
      for (const [opId, succeeded] of opSucceededSteps) {
        const op = pendingTriggerOps.find((p) => p.id === opId);
        if (!op) continue;
        const totalStepsInThisContainer = triggerWorkItems.filter((w) => w.opId === opId).length;
        if (succeeded === totalStepsInThisContainer) {
          // Only mark applied if this container held ALL of the op's steps (the common case —
          // multi-container sync ops spanning several containers get applied incrementally
          // and are only fully "applied" once every container's queue has been published).
          const stepsElsewhere = op.steps.some((s) => s.containerId !== containerId);
          if (!stepsElsewhere) {
            set((state) => ({
              pendingTriggerOps: state.pendingTriggerOps.map((o) => o.id === opId ? { ...o, status: 'applied' as const } : o),
            }));
          }
        }
      }

      // 3. Tag duplications
      for (const dup of dupOps) {
        totalCount++;
        try {
          const createdTriggerIds: string[] = [];
          for (const tr of dup.triggersToCreate) {
            const clone: GTMTrigger = {
              name: tr.name, type: tr.type,
              ...(tr.filter ? { filter: tr.filter } : {}),
              ...(tr.customEventFilter ? { customEventFilter: tr.customEventFilter } : {}),
              ...(tr.parameter ? { parameter: tr.parameter } : {}),
              ...(tr.notes ? { notes: tr.notes } : {}),
            };
            const createdTr = (await createTrigger(token, selectedAccountId, containerId, workspaceId, clone as never)) as { triggerId?: string };
            if (createdTr.triggerId) createdTriggerIds.push(createdTr.triggerId);
          }
          const fullTag: GTMTag = { ...dup.tag, firingTriggerId: [...dup.linkedTriggerIds, ...createdTriggerIds] };
          await createTag(token, selectedAccountId, containerId, workspaceId, fullTag as never);
          okCount++;
          set((state) => ({ pendingTagDuplications: state.pendingTagDuplications.map((d) => d.id === dup.id ? { ...d, status: 'applied' as const } : d) }));
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          set((state) => ({ pendingTagDuplications: state.pendingTagDuplications.map((d) => d.id === dup.id ? { ...d, status: 'failed' as const, error: errMsg } : d) }));
        }
      }

      // 4. Variable duplications
      for (const dup of varDupOps) {
        totalCount++;
        try {
          const payload: GTMVariable = {
            name: dup.variable.name,
            type: dup.variable.type,
            ...(dup.variable.parameter ? { parameter: dup.variable.parameter } : {}),
            ...(dup.variable.notes ? { notes: dup.variable.notes } : {}),
          };
          await createVariable(token, selectedAccountId, containerId, workspaceId, payload as never);
          okCount++;
          set((state) => ({ pendingVariableDuplications: state.pendingVariableDuplications.map((d) => d.id === dup.id ? { ...d, status: 'applied' as const } : d) }));
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          set((state) => ({ pendingVariableDuplications: state.pendingVariableDuplications.map((d) => d.id === dup.id ? { ...d, status: 'failed' as const, error: errMsg } : d) }));
        }
      }

      // 5. Entity creations (variable + optional trigger + optional tag, no source container —
      // e.g. from DataLayer Mapping detecting a gap). Same built-in-variable activation as deploy(),
      // missing here until now — this path went straight to create* calls with no such check.
      if (creationOps.length > 0) {
        const requiredBuiltIns = detectRequiredBuiltInVariables({
          tags: creationOps.flatMap((c) => c.tag ? [c.tag] : []),
          variables: creationOps.map((c) => c.variable),
          triggers: creationOps.flatMap((c) => c.trigger ? [c.trigger] : []),
        });
        if (requiredBuiltIns.size > 0) {
          const enabled = new Set(await listEnabledBuiltInVariables(token, selectedAccountId, containerId, workspaceId));
          const missing = [...requiredBuiltIns].filter((t) => !enabled.has(t));
          if (missing.length > 0) await enableBuiltInVariables(token, selectedAccountId, containerId, workspaceId, missing);
        }

        for (const creation of creationOps) {
          totalCount++;
          try {
            // Variable → trigger → tag as one dependent sequence, not 3 independent queues —
            // the tag (if any) needs the trigger's real ID, not a name or another container's ID.
            await createVariable(token, selectedAccountId, containerId, workspaceId, creation.variable as never);

            let triggerId: string | undefined;
            if (creation.trigger) {
              const createdTr = (await createTrigger(token, selectedAccountId, containerId, workspaceId, creation.trigger as never)) as { triggerId?: string };
              triggerId = createdTr.triggerId;
              if (!triggerId) throw new Error(`Trigger "${creation.trigger.name}" créé mais sans ID retourné — tag annulé`);
            }

            if (creation.tag) {
              const tagPayload: GTMTag = { ...creation.tag, ...(triggerId ? { firingTriggerId: [triggerId] } : {}) };
              await createTag(token, selectedAccountId, containerId, workspaceId, tagPayload as never);
            }

            okCount++;
            set((state) => ({ pendingEntityCreations: state.pendingEntityCreations.map((c) => c.id === creation.id ? { ...c, status: 'applied' as const } : c) }));
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            set((state) => ({ pendingEntityCreations: state.pendingEntityCreations.map((c) => c.id === creation.id ? { ...c, status: 'failed' as const, error: errMsg } : c) }));
          }
        }
      }

      if (okCount === 0) {
        const errMsg = 'Aucune modification appliquée';
        set({ applyPublishErrors: [{ containerName: meta.containerName, error: errMsg }] });
        return { success: false, error: errMsg };
      }

      const publishRes = await get().publishWorkspaceVersion(token, {
        containerId, workspaceId, versionName, description,
        label: `Déploiement — ${meta.containerName} (${okCount}/${totalCount})`,
      });
      return publishRes;
    } finally {
      set({ isApplyingContainerQueue: false });
    }
  },

  addContainerRenames: (ops) => {
    const newOps: ContainerRenameOperation[] = ops.map((op) => ({
      ...op,
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }));
    set((state) => ({ pendingContainerRenames: [...state.pendingContainerRenames, ...newOps] }));
  },

  removeContainerRename: (id) =>
    set((state) => ({ pendingContainerRenames: state.pendingContainerRenames.filter((op) => op.id !== id) })),

  clearContainerRenames: () => set({ pendingContainerRenames: [] }),

  isApplyingContainerRenames: false,
  applyContainerRenames: async (token) => {
    const { pendingContainerRenames, containers } = get();
    const pending = pendingContainerRenames.filter((op) => op.status === 'pending');
    if (pending.length === 0) return;

    set({ isApplyingContainerRenames: true, applyPublishErrors: [] });
    const errors: { containerName: string; error: string }[] = [];

    try {
      for (const op of pending) {
        try {
          if (op.kind === 'account') {
            await updateAccount(token, op.accountId, { name: op.newName });
          } else {
            if (!op.containerId) throw new Error('containerId manquant sur cette opération');
            const meta = containers.find((c) => c.containerId === op.containerId);
            if (!meta) throw new Error(`Container introuvable dans le compte (id ${op.containerId})`);
            await updateContainer(token, op.accountId, op.containerId, { name: op.newName, usageContext: meta.usageContext });
          }
          set((state) => ({
            pendingContainerRenames: state.pendingContainerRenames.map((r) => r.id === op.id ? { ...r, status: 'applied' as const } : r),
          }));
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          errors.push({ containerName: op.oldName, error: errMsg });
          set((state) => ({
            pendingContainerRenames: state.pendingContainerRenames.map((r) => r.id === op.id ? { ...r, status: 'failed' as const, error: errMsg } : r),
          }));
        }
      }

      // Refresh local container list so renamed entries show their new names immediately
      const { selectedAccountId } = get();
      if (selectedAccountId) {
        try {
          const refreshed = await listContainers(token, selectedAccountId);
          set({ containers: refreshed });
        } catch {
          // Non-fatal — the rename already applied server-side, just couldn't refresh the local list.
        }
      }

      if (errors.length > 0) set({ applyPublishErrors: errors });
    } finally {
      set({ isApplyingContainerRenames: false });
    }
  },

  // ─── Monitoring scan ────────────────────────────────────────────────────────

  cancelMonitoringScan: () => {
    get()._cancelMonitoringScan?.();
    set({ isLoadingMonitoring: false, monitoringScanProgress: null, _cancelMonitoringScan: null });
  },

  scanMonitoring: async (token) => {
    // Guard against double-click: if already scanning, do nothing.
    if (get().isLoadingMonitoring) return;

    const { selectedContainerIds, selectedAccountId, monitoringData } = get();
    if (!selectedAccountId) return;

    // Show UI feedback IMMEDIATELY so the first click is always visible.
    // This must happen before any async work.
    set({ isLoadingMonitoring: true, monitoringError: null, _abortDateEnrichment: true });

    // After a page refresh, containers (in-memory Zustand state) may be empty
    // even though selectedContainerIds is restored from localStorage.
    // Fetch the container list directly — never call selectAccount() here because
    // selectAccount() includes the date-enrichment loop which blocks for minutes.
    let { containers } = get();
    if (containers.length === 0 && selectedContainerIds.size > 0) {
      try {
        containers = await listContainers(token, selectedAccountId);
        set({ containers });
      } catch (err) {
        set({ isLoadingMonitoring: false, monitoringError: String(err), _abortDateEnrichment: false });
        return;
      }
    }

    const selected = selectedContainerIds.size > 0
      ? containers.filter((c) => selectedContainerIds.has(c.containerId))
      : containers;

    // Append mode: skip containers already scanned in this session
    const alreadyScanned = new Set(monitoringData.map((d) => d.containerId));
    const remaining = selected.filter((c) => !alreadyScanned.has(c.containerId));
    const targets = remaining.slice(0, MONITORING_BATCH_SIZE);

    if (targets.length === 0) {
      set({ isLoadingMonitoring: false, _abortDateEnrichment: false });
      return;
    }

    let cancelled = false;

    set({
      ...(monitoringData.length === 0 ? { monitoringData: [] } : {}),
      monitoringScanProgress: { current: 0, total: targets.length },
      _cancelMonitoringScan: () => { cancelled = true; },
    });

    // Wait for any in-flight getLiveVersion call to finish before we start consuming quota.
    await sleep(2500);

    try {
      // 2 calls per container: the workspace (needed for its ID, used by Nettoyage/write features)
      // + the full live version content (tag[]/trigger[]/variable[] in ONE call, replacing the
      // previous 3 separate list-by-workspace calls). The shared rate limiter (25 req/min) paces
      // every call automatically — no manual sleep needed, it can't ever exceed quota.
      // Fallback: containers never published (no live version yet) are scanned from their
      // workspace directly (3 extra calls, rare — happens once for a genuinely new container).
      for (let i = 0; i < targets.length; i++) {
        if (cancelled) break;
        const c = targets[i];
        set({ monitoringScanProgress: { current: i + 1, total: targets.length } });

        const ws = await getDefaultWorkspace(token, selectedAccountId, c.containerId);
        if (cancelled) break;
        const live = await getLiveVersion(token, selectedAccountId, c.containerId);
        if (cancelled) break;

        let tags, variables, triggers, templates, gtagConfigs;
        if (live && (live.tag || live.trigger || live.variable)) {
          tags = live.tag ?? [];
          variables = live.variable ?? [];
          triggers = live.trigger ?? [];
          templates = live.customTemplate ?? [];
          gtagConfigs = live.gtagConfig ?? [];
        } else {
          // Never published — no live version to read from, fall back to the workspace.
          tags = await listTagsFull(token, selectedAccountId, c.containerId, ws.workspaceId);
          if (cancelled) break;
          variables = await listVariablesFull(token, selectedAccountId, c.containerId, ws.workspaceId);
          if (cancelled) break;
          triggers = await listTriggersFull(token, selectedAccountId, c.containerId, ws.workspaceId);
          if (cancelled) break;
          templates = await listTemplates(token, selectedAccountId, c.containerId, ws.workspaceId);
          if (cancelled) break;
          gtagConfigs = await listGtagConfig(token, selectedAccountId, c.containerId, ws.workspaceId);
          if (cancelled) break;
        }


        const entry: MonitoringContainerData = {
          containerId: c.containerId,
          containerName: c.name,
          publicId: c.publicId,
          workspaceId: ws.workspaceId,
          tags,
          variables,
          triggers,
          templates,
          gtagConfigs,
          scannedAt: new Date().toISOString(),
        };
        set((state) => ({ monitoringData: [...state.monitoringData, entry] }));
      }
      const finalData = get().monitoringData;
      set({ isLoadingMonitoring: false, monitoringScanProgress: null, _cancelMonitoringScan: null, _abortDateEnrichment: false, eventChainRows: computeEventChainFn(finalData) });
      get().reconcilePendingOps();
    } catch (err) {
      set({ isLoadingMonitoring: false, monitoringError: String(err), monitoringScanProgress: null, _cancelMonitoringScan: null, _abortDateEnrichment: false });
    }
  },

  loadForProfile: (profileId) => {
    // ── Load monitoring data ──────────────────────────────────────────────────
    let monitoring = tryParse<MonitoringContainerData[]>(
      localStorage.getItem(`${MONITORING_PERSIST_KEY}_${profileId}`), [],
    );

    // One-shot migration from pre-profile era (non-namespaced key).
    // Runs once for the first profile to load; clears the legacy key so
    // subsequent profiles don't inherit someone else's data.
    if (monitoring.length === 0) {
      const legacy = tryParse<MonitoringContainerData[]>(
        localStorage.getItem(MONITORING_PERSIST_KEY), [],
      );
      if (legacy.length > 0) {
        monitoring = legacy;
        const serialized = JSON.stringify(legacy);
        if (serialized.length <= MAX_MONITORING_BYTES) {
          safeLocalSet(`${MONITORING_PERSIST_KEY}_${profileId}`, serialized);
        }
        try { localStorage.removeItem(MONITORING_PERSIST_KEY); } catch { /* ignore */ }
      }
    }

    // ── Load ops queues ───────────────────────────────────────────────────────
    const emptyOps: PersistedOps = { pendingDeletions: [], pendingRenames: [], pendingTriggerOps: [], pendingContainerRenames: [], pendingTagDuplications: [], pendingVariableDuplications: [], pendingEntityCreations: [] };
    let ops = tryParse<PersistedOps>(
      localStorage.getItem(`${OPS_PERSIST_KEY}_${profileId}`),
      emptyOps,
    );

    // Same one-shot migration for ops
    const opsEmpty = !ops.pendingDeletions.length && !ops.pendingRenames.length &&
      !ops.pendingTriggerOps.length && !ops.pendingContainerRenames.length && !ops.pendingTagDuplications.length &&
      !ops.pendingVariableDuplications?.length && !ops.pendingEntityCreations?.length;
    if (opsEmpty) {
      const legacyOps = tryParse<PersistedOps>(
        localStorage.getItem(OPS_PERSIST_KEY),
        emptyOps,
      );
      const legacyHasData = legacyOps.pendingDeletions.length || legacyOps.pendingRenames.length ||
        legacyOps.pendingTriggerOps.length || legacyOps.pendingContainerRenames.length || legacyOps.pendingTagDuplications.length ||
        legacyOps.pendingVariableDuplications?.length || legacyOps.pendingEntityCreations?.length;
      if (legacyHasData) {
        ops = legacyOps;
        safeLocalSet(`${OPS_PERSIST_KEY}_${profileId}`, JSON.stringify(legacyOps));
        try { localStorage.removeItem(OPS_PERSIST_KEY); } catch { /* ignore */ }
      }
    }

    set({
      activeProfileId: profileId,
      monitoringData: monitoring,
      eventChainRows: computeEventChainFn(monitoring),
      pendingDeletions: ops.pendingDeletions,
      pendingRenames: ops.pendingRenames,
      pendingTriggerOps: ops.pendingTriggerOps,
      pendingContainerRenames: ops.pendingContainerRenames,
      pendingTagDuplications: ops.pendingTagDuplications ?? [],
      pendingVariableDuplications: ops.pendingVariableDuplications ?? [],
      pendingEntityCreations: ops.pendingEntityCreations ?? [],
      // Reset transient state
      isLoadingMonitoring: false,
      monitoringError: null,
      monitoringScanProgress: null,
      _cancelMonitoringScan: null,
      _abortDateEnrichment: false,
      isApplyingDeletions: false,
      isDuplicatingTag: false,
    });
    get().reconcilePendingOps();
  },

  clearMonitoringData: () => set({ monitoringData: [], monitoringError: null, eventChainRows: [] }),
  loadMockMonitoringData: () => set({
    monitoringData: MONITORING_MOCK,
    eventChainRows: computeEventChainFn(MONITORING_MOCK),
    monitoringError: null,
  }),
  seedTestContainer: () => set((state) => {
    const next = [...state.monitoringData.filter((d) => d.containerId !== TEST_CONTAINER_ID), TEST_MONITORING_CONTAINER];
    return { monitoringData: next, eventChainRows: computeEventChainFn(next), monitoringError: null };
  }),
}));

// ─── Persist relevant slices on change (namespaced by active profile) ─────────
useGTMStore.subscribe((state, prev) => {
  const profileId = state.activeProfileId;
  if (!profileId) return; // no profile selected yet — don't persist

  // monitoringData — separate key, size-guarded
  if (state.monitoringData !== prev.monitoringData) {
    const key = `${MONITORING_PERSIST_KEY}_${profileId}`;
    if (state.monitoringData.length === 0) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    } else {
      const serialized = JSON.stringify(state.monitoringData);
      if (serialized.length <= MAX_MONITORING_BYTES) {
        safeLocalSet(key, serialized);
      } else {
        console.warn(
          `[GTM Persist] monitoringData trop volumineux (${(serialized.length / 1_048_576).toFixed(1)} Mo > 3.5 Mo) — non persisté.`,
        );
        try { localStorage.removeItem(key); } catch { /* ignore */ }
      }
    }
  }

  // Ops queues — always persist, much smaller than monitoring data
  if (
    state.pendingDeletions !== prev.pendingDeletions ||
    state.pendingRenames !== prev.pendingRenames ||
    state.pendingTriggerOps !== prev.pendingTriggerOps ||
    state.pendingContainerRenames !== prev.pendingContainerRenames ||
    state.pendingTagDuplications !== prev.pendingTagDuplications ||
    state.pendingVariableDuplications !== prev.pendingVariableDuplications ||
    state.pendingEntityCreations !== prev.pendingEntityCreations
  ) {
    safeLocalSet(`${OPS_PERSIST_KEY}_${profileId}`, JSON.stringify({
      pendingDeletions: state.pendingDeletions,
      pendingRenames: state.pendingRenames,
      pendingTriggerOps: state.pendingTriggerOps,
      pendingContainerRenames: state.pendingContainerRenames,
      pendingTagDuplications: state.pendingTagDuplications,
      pendingVariableDuplications: state.pendingVariableDuplications,
      pendingEntityCreations: state.pendingEntityCreations,
    }));
  }
});
