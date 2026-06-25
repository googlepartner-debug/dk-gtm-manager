import { create } from 'zustand';
import type { GTMAccount, GTMContainer, DeploymentPackage, DeploymentRecord, DeploymentResult } from '../types/gtm';
import { listAccounts, listContainers, createWorkspace, createTag, createVariable, createTrigger, createVersion, publishVersion } from '../lib/gtm-api';
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

  // Deployment
  isDeploying: boolean;
  deploymentResults: DeploymentResult[];
  deploymentProgress: number; // 0-100

  // History
  history: DeploymentRecord[];

  // Actions
  fetchAccounts: (token: string) => Promise<void>;
  selectAccount: (accountId: string, token: string) => Promise<void>;
  toggleContainer: (containerId: string) => void;
  selectAllContainers: () => void;
  clearContainerSelection: () => void;

  loadPackages: () => void;
  selectPackage: (id: string | null) => void;
  upsertPackage: (pkg: DeploymentPackage) => void;
  removePackage: (id: string) => void;

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

  isDeploying: false,
  deploymentResults: [],
  deploymentProgress: 0,

  history: loadHistory(),

  fetchAccounts: async (token) => {
    set({ isLoadingAccounts: true, accountError: null });
    try {
      const accounts = await listAccounts(token);
      set({ accounts, isLoadingAccounts: false });
    } catch (err) {
      set({ isLoadingAccounts: false, accountError: String(err) });
    }
  },

  selectAccount: async (accountId, token) => {
    set({ selectedAccountId: accountId, isLoadingContainers: true, containers: [], selectedContainerIds: new Set() });
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
    set({ selectedContainerIds: ids });
  },

  selectAllContainers: () => {
    set({ selectedContainerIds: new Set(get().containers.map((c) => c.containerId)) });
  },

  clearContainerSelection: () => set({ selectedContainerIds: new Set() }),

  loadPackages: () => set({ packages: loadPackages() }),

  selectPackage: (id) => set({ selectedPackageId: id }),

  upsertPackage: (pkg) => {
    savePackage(pkg);
    set({ packages: loadPackages() });
  },

  removePackage: (id) => {
    deletePackage(id);
    set({ packages: loadPackages(), selectedPackageId: get().selectedPackageId === id ? null : get().selectedPackageId });
  },

  deploy: async (token, packageId, versionName) => {
    const { packages, containers, selectedContainerIds, selectedAccountId } = get();
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
        { label: `Ajouter ${pkg.entities.triggers.length} déclencheur(s)`, status: 'pending' },
        { label: `Ajouter ${pkg.entities.variables.length} variable(s)`, status: 'pending' },
        { label: `Ajouter ${pkg.entities.tags.length} tag(s)`, status: 'pending' },
        { label: 'Créer version', status: 'pending' },
        { label: 'Publier', status: 'pending' },
      ],
    }));

    set({ isDeploying: true, deploymentResults: results, deploymentProgress: 0 });

    const updateResult = (idx: number, partial: Partial<DeploymentResult>) => {
      set((state) => {
        const updated = [...state.deploymentResults];
        updated[idx] = { ...updated[idx], ...partial };
        return { deploymentResults: updated, deploymentProgress: Math.round((idx / targetContainers.length) * 100) };
      });
    };

    const updateStep = (resultIdx: number, stepIdx: number, status: DeploymentResult['steps'][0]['status'], detail?: string) => {
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
      updateResult(i, { status: 'running' });

      try {
        // Step 0: Create workspace
        updateStep(i, 0, 'running');
        const ws = await createWorkspace(
          token,
          selectedAccountId,
          container.containerId,
          `DK Deploy - ${versionName}`,
          `Déployé via DK GTM Manager`
        );
        updateStep(i, 0, 'success', ws.workspaceId);

        // Step 1: Triggers
        updateStep(i, 1, 'running');
        for (const trigger of pkg.entities.triggers) {
          await createTrigger(token, selectedAccountId, container.containerId, ws.workspaceId, trigger);
        }
        updateStep(i, 1, 'success');

        // Step 2: Variables
        updateStep(i, 2, 'running');
        for (const variable of pkg.entities.variables) {
          await createVariable(token, selectedAccountId, container.containerId, ws.workspaceId, variable);
        }
        updateStep(i, 2, 'success');

        // Step 3: Tags
        updateStep(i, 3, 'running');
        for (const tag of pkg.entities.tags) {
          await createTag(token, selectedAccountId, container.containerId, ws.workspaceId, tag);
        }
        updateStep(i, 3, 'success');

        // Step 4: Create version
        updateStep(i, 4, 'running');
        const versionRes = await createVersion(
          token,
          selectedAccountId,
          container.containerId,
          ws.workspaceId,
          versionName,
          `Package: ${pkg.name}`
        );
        const versionId = versionRes.containerVersion?.containerVersionId ?? '';
        updateStep(i, 4, 'success', `v${versionId}`);

        // Step 5: Publish
        updateStep(i, 5, 'running');
        await publishVersion(token, selectedAccountId, container.containerId, versionId);
        updateStep(i, 5, 'success');

        updateResult(i, { status: 'success', workspaceId: ws.workspaceId, versionId });
      } catch (err) {
        const errorMsg = String(err);
        // Find which step was running and mark it failed
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

    // Save to history
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
