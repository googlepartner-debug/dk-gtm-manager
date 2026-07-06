import { create } from 'zustand';
import type {
  GTMAccount, GTMContainer, DeploymentPackage, DeploymentRecord, DeploymentResult,
  ContainerDiff, DiffEntity, GlobalDiffSummary, RenameOperation, TriggerOperation, DeletionOperation,
  ContainerRenameOperation,
} from '../types/gtm';
import { STATIC_ACCOUNTS, STATIC_CONTAINERS } from '../data/gtm-static';
import {
  listAccounts, listContainers, getLiveVersion, createWorkspace,
  createTag, updateTag, listTagsFull, deleteTag,
  createVariable, updateVariable, listVariablesFull, deleteVariable,
  createTrigger, updateTrigger, listTriggersFull, deleteTrigger,
  createVersion, publishVersion,
  getDefaultWorkspace,
} from '../lib/gtm-api';
import type { MonitoringContainerData } from '../data/monitoring-mock';
import { MONITORING_MOCK } from '../data/monitoring-mock';
import { computeContainerDiff } from '../lib/gtm-diff';
import { computeEventChain as computeEventChainFn } from '../lib/event-chain';
import type { EventChainRow } from '../types/gtm';
import { loadPackages, savePackage, deletePackage, loadHistory, saveDeploymentRecord } from '../lib/storage';

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

function saveRecent(accountId: string, containerIds: string[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify({ accountId, containerIds }));
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
};

const _persistedMonitoring = tryParse<MonitoringContainerData[]>(
  localStorage.getItem(MONITORING_PERSIST_KEY), [],
);

const _persistedOps = tryParse<PersistedOps>(
  localStorage.getItem(OPS_PERSIST_KEY),
  { pendingDeletions: [], pendingRenames: [], pendingTriggerOps: [], pendingContainerRenames: [] },
);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Max containers scanned per batch (stay well under the GTM API 30 req/min quota
// for hour-long sessions; 40 × 8s = ~5min 20s per batch)
export const MONITORING_BATCH_SIZE = 40;

interface GTMStore {
  // Accounts & containers
  accounts: GTMAccount[];
  selectedAccountId: string | null;
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

  // Rename queue
  pendingRenames: RenameOperation[];

  // Trigger operations queue
  pendingTriggerOps: TriggerOperation[];

  // Deletion queue
  pendingDeletions: DeletionOperation[];

  // Container / Account rename queue
  pendingContainerRenames: ContainerRenameOperation[];

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

  // Actions — deploy
  setAutoPublish: (v: boolean) => void;
  deploy: (token: string, packageId: string, versionName: string, versionDescription?: string) => Promise<void>;
  loadHistory: () => void;
  resetDeployment: () => void;

  // Actions — renames
  addRenames: (ops: Omit<RenameOperation, 'id' | 'status' | 'createdAt'>[]) => void;
  removeRename: (id: string) => void;
  clearRenames: () => void;

  // Actions — trigger ops
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

  // Actions — container/account renames
  addContainerRenames: (ops: Omit<ContainerRenameOperation, 'id' | 'status' | 'createdAt'>[]) => void;
  removeContainerRename: (id: string) => void;
  clearContainerRenames: () => void;

  // Event chain (GA4 audit)
  eventChainRows: EventChainRow[];
  computeEventChain: () => void;
}

export const useGTMStore = create<GTMStore>((set, get) => ({
  accounts: [],
  selectedAccountId: _recent?.accountId ?? null,
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
  applyPublishErrors: [],
  pendingContainerRenames: _persistedOps.pendingContainerRenames,

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
    set({
      selectedAccountId: accountId,
      isLoadingContainers: true,
      containers: [],
      // Keep existing selection when restoring the same account (session restore)
      selectedContainerIds: isRestoringCurrentAccount ? get().selectedContainerIds : new Set(),
      diffs: {},
    });
    saveRecent(accountId, [...(isRestoringCurrentAccount ? get().selectedContainerIds : new Set<string>())]);
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
        const all: ({ fingerprint?: string } | null)[] = new Array(containers.length).fill(null);
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
    if (accountId) saveRecent(accountId, [...ids]);
  },

  selectAllContainers: () => {
    const ids = new Set(get().containers.map((c) => c.containerId));
    set({ selectedContainerIds: ids, diffs: {} });
    const accountId = get().selectedAccountId;
    if (accountId) saveRecent(accountId, [...ids]);
  },

  clearContainerSelection: () => {
    set({ selectedContainerIds: new Set(), diffs: {} });
    const accountId = get().selectedAccountId;
    if (accountId) saveRecent(accountId, []);
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
        // Step 0: Create workspace
        updateStep(i, 0, 'running');
        const ws = await createWorkspace(
          token, selectedAccountId, container.containerId,
          `DK Deploy - ${versionName}`, 'Déployé via DK GTM Manager'
        );
        updateStep(i, 0, 'success', `ws ${ws.workspaceId}`);

        // Step 1: Upsert selected entities
        updateStep(i, 1, 'running');
        const selectedEntities = containerDiff?.entities.filter((e) => e.selected) ?? [];

        // Sort: triggers → variables → tags (dependencies order)
        const order = { trigger: 0, variable: 1, tag: 2 };
        const sorted = [...selectedEntities].sort((a, b) => order[a.kind] - order[b.kind]);

        let upsertCount = 0;
        for (const entity of sorted) {
          if (entity.kind === 'trigger') {
            if (entity.existingId) {
              await updateTrigger(token, selectedAccountId, container.containerId, ws.workspaceId, entity.existingId, entity.proposed as never);
            } else {
              await createTrigger(token, selectedAccountId, container.containerId, ws.workspaceId, entity.proposed as never);
            }
          } else if (entity.kind === 'variable') {
            if (entity.existingId) {
              await updateVariable(token, selectedAccountId, container.containerId, ws.workspaceId, entity.existingId, entity.proposed as never);
            } else {
              await createVariable(token, selectedAccountId, container.containerId, ws.workspaceId, entity.proposed as never);
            }
          } else if (entity.kind === 'tag') {
            if (entity.existingId) {
              await updateTag(token, selectedAccountId, container.containerId, ws.workspaceId, entity.existingId, entity.proposed as never);
            } else {
              await createTag(token, selectedAccountId, container.containerId, ws.workspaceId, entity.proposed as never);
            }
          }
          upsertCount++;
        }
        updateStep(i, 1, 'success', `${upsertCount} entité(s)`);

        // Step 2: Create version
        updateStep(i, 2, 'running');
        const versionRes = await createVersion(
          token, selectedAccountId, container.containerId, ws.workspaceId,
          versionName, versionDescription ?? `Package: ${pkg.name}`
        );
        const versionId = versionRes.containerVersion?.containerVersionId ?? '';
        updateStep(i, 2, 'success', `v${versionId}`);

        // Step 3: Publish (optional)
        if (autoPublish) {
          updateStep(i, 3, 'running');
          await publishVersion(token, selectedAccountId, container.containerId, versionId);
          updateStep(i, 3, 'success');
        }

        updateResult(i, { status: 'success', workspaceId: ws.workspaceId, versionId });
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
    };
    saveDeploymentRecord(record);

    set({ isDeploying: false, deploymentProgress: 100, history: loadHistory() });
  },

  loadHistory: () => set({ history: loadHistory() }),
  resetDeployment: () => set({ deploymentResults: [], deploymentProgress: 0 }),

  addRenames: (ops) => {
    const newOps: RenameOperation[] = ops.map((op) => ({
      ...op,
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }));
    set((state) => ({ pendingRenames: [...state.pendingRenames, ...newOps] }));
  },

  removeRename: (id) =>
    set((state) => ({ pendingRenames: state.pendingRenames.filter((r) => r.id !== id) })),

  clearRenames: () => set({ pendingRenames: [] }),

  addTriggerOp: (op) => {
    const newOp: TriggerOperation = {
      ...op,
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ pendingTriggerOps: [...state.pendingTriggerOps, newOp] }));
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
      for (const op of pending) {
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
      // Sequential scan: 1 workspace call + 3 sequential entity calls per container = 4 calls.
      // 10s pause between containers → 4 calls / 10s = 24 req/min (well under 30 req/min quota).
      for (let i = 0; i < targets.length; i++) {
        if (cancelled) break;
        const c = targets[i];
        set({ monitoringScanProgress: { current: i + 1, total: targets.length } });

        const ws = await getDefaultWorkspace(token, selectedAccountId, c.containerId);
        if (cancelled) break;
        // Sequential (not parallel) to stay well under the per-minute quota
        const tags = await listTagsFull(token, selectedAccountId, c.containerId, ws.workspaceId);
        if (cancelled) break;
        const variables = await listVariablesFull(token, selectedAccountId, c.containerId, ws.workspaceId);
        if (cancelled) break;
        const triggers = await listTriggersFull(token, selectedAccountId, c.containerId, ws.workspaceId);
        if (cancelled) break;

        const entry: MonitoringContainerData = {
          containerId: c.containerId,
          containerName: c.name,
          publicId: c.publicId,
          workspaceId: ws.workspaceId,
          tags,
          variables,
          triggers,
          scannedAt: new Date().toISOString(),
        };
        set((state) => ({ monitoringData: [...state.monitoringData, entry] }));

        if (!cancelled && i < targets.length - 1) await sleep(10_000);
      }
      const finalData = get().monitoringData;
      set({ isLoadingMonitoring: false, monitoringScanProgress: null, _cancelMonitoringScan: null, _abortDateEnrichment: false, eventChainRows: computeEventChainFn(finalData) });
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
    let ops = tryParse<PersistedOps>(
      localStorage.getItem(`${OPS_PERSIST_KEY}_${profileId}`),
      { pendingDeletions: [], pendingRenames: [], pendingTriggerOps: [], pendingContainerRenames: [] },
    );

    // Same one-shot migration for ops
    const opsEmpty = !ops.pendingDeletions.length && !ops.pendingRenames.length &&
      !ops.pendingTriggerOps.length && !ops.pendingContainerRenames.length;
    if (opsEmpty) {
      const legacyOps = tryParse<PersistedOps>(
        localStorage.getItem(OPS_PERSIST_KEY),
        { pendingDeletions: [], pendingRenames: [], pendingTriggerOps: [], pendingContainerRenames: [] },
      );
      const legacyHasData = legacyOps.pendingDeletions.length || legacyOps.pendingRenames.length ||
        legacyOps.pendingTriggerOps.length || legacyOps.pendingContainerRenames.length;
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
      // Reset transient state
      isLoadingMonitoring: false,
      monitoringError: null,
      monitoringScanProgress: null,
      _cancelMonitoringScan: null,
      _abortDateEnrichment: false,
      isApplyingDeletions: false,
    });
  },

  clearMonitoringData: () => set({ monitoringData: [], monitoringError: null, eventChainRows: [] }),
  loadMockMonitoringData: () => set({
    monitoringData: MONITORING_MOCK,
    eventChainRows: computeEventChainFn(MONITORING_MOCK),
    monitoringError: null,
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
    state.pendingContainerRenames !== prev.pendingContainerRenames
  ) {
    safeLocalSet(`${OPS_PERSIST_KEY}_${profileId}`, JSON.stringify({
      pendingDeletions: state.pendingDeletions,
      pendingRenames: state.pendingRenames,
      pendingTriggerOps: state.pendingTriggerOps,
      pendingContainerRenames: state.pendingContainerRenames,
    }));
  }
});
