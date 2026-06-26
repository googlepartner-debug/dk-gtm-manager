import { create } from 'zustand';
import type {
  GTMAccount, GTMContainer, DeploymentPackage, DeploymentRecord, DeploymentResult,
  ContainerDiff, DiffEntity, GlobalDiffSummary,
} from '../types/gtm';
import { STATIC_ACCOUNTS, STATIC_CONTAINERS } from '../data/gtm-static';
import {
  listAccounts, listContainers, createWorkspace,
  createTag, updateTag,
  createVariable, updateVariable,
  createTrigger, updateTrigger,
  createVersion, publishVersion,
} from '../lib/gtm-api';
import { computeContainerDiff } from '../lib/gtm-diff';
import { loadPackages, savePackage, deletePackage, loadHistory, saveDeploymentRecord } from '../lib/storage';

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

  // Actions — containers
  fetchAccounts: (token?: string) => Promise<void>;
  selectAccount: (accountId: string, token?: string) => Promise<void>;
  toggleContainer: (containerId: string) => void;
  selectAllContainers: () => void;
  clearContainerSelection: () => void;

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
  deploy: (token: string, packageId: string, versionName: string) => Promise<void>;
  loadHistory: () => void;
  resetDeployment: () => void;
}

export const useGTMStore = create<GTMStore>((set, get) => ({
  accounts: [],
  selectedAccountId: null,
  containers: [],
  selectedContainerIds: new Set(),
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
    set({ selectedAccountId: accountId, isLoadingContainers: true, containers: [], selectedContainerIds: new Set(), diffs: {} });
    if (!token) {
      const containers = STATIC_CONTAINERS[accountId] ?? [];
      set({ containers, isLoadingContainers: false });
      return;
    }
    try {
      const containers = await listContainers(token, accountId);
      set({ containers, isLoadingContainers: false });
    } catch (err) {
      set({ isLoadingContainers: false, accountError: String(err) });
    }
  },

  toggleContainer: (containerId) => {
    const ids = new Set(get().selectedContainerIds);
    if (ids.has(containerId)) ids.delete(containerId);
    else ids.add(containerId);
    set({ selectedContainerIds: ids, diffs: {} });
  },

  selectAllContainers: () => {
    set({ selectedContainerIds: new Set(get().containers.map((c) => c.containerId)), diffs: {} });
  },

  clearContainerSelection: () => set({ selectedContainerIds: new Set(), diffs: {} }),

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

  deploy: async (token, packageId, versionName) => {
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
          versionName, `Package: ${pkg.name}`
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
}));
