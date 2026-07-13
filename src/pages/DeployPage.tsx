import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { useGTMStore } from '../store/gtm-store';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DiffView } from '../components/diff/DiffView';
import { GA4CoverageMatrix } from '../components/diff/GA4CoverageMatrix';
import { PublishingLoader } from '../components/ui/PublishingLoader';
import { validatePackage } from '../lib/package-validation';
import { friendlyGtmError } from '../lib/gtm-errors';
import { InfoTooltip } from '../components/ui/InfoTooltip';
import type { DeploymentResult, RenameOperation, TriggerOperation, TriggerOpStep, TagDuplicationOperation, VariableDuplicationOperation } from '../types/gtm';

type Step = 'select' | 'diff' | 'progress' | 'done';

function StepIcon({ status }: { status: DeploymentResult['steps'][0]['status'] }) {
  if (status === 'success') return (
    <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center shrink-0">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
  if (status === 'error') return (
    <div className="w-5 h-5 rounded-full bg-destructive flex items-center justify-center shrink-0">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M3 3l4 4M7 3l-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
  if (status === 'running') return (
    <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent shrink-0" style={{ animation: 'dk-spin 0.75s linear infinite' }} />
  );
  return <div className="w-5 h-5 rounded-full border-2 border-border shrink-0" />;
}

// ─── Pending changes (renames + trigger ops + tag duplications, queued from Monitoring) ──

interface ContainerQueueGroup {
  containerId: string;
  containerName: string;
  publicId: string;
  renames: RenameOperation[];
  triggerOps: { op: TriggerOperation; step: TriggerOpStep }[];
  duplications: TagDuplicationOperation[];
  variableDuplications: VariableDuplicationOperation[];
}

// Describes WHAT kind of change this is, e.g. "Renommage" or "Renommage + Duplication tag" —
// used as the default version name prefix instead of the generic, meaningless "Déploiement".
function buildActionPrefix(group: ContainerQueueGroup): string {
  const parts: string[] = [];
  if (group.renames.length > 0) parts.push('Renommage');
  if (group.triggerOps.some(({ op }) => op.kind === 'remove')) parts.push('Retrait déclencheur');
  if (group.triggerOps.some(({ op }) => op.kind !== 'remove')) parts.push('Synchronisation déclencheur');
  if (group.duplications.length > 0) parts.push('Duplication tag');
  if (group.variableDuplications.length > 0) parts.push('Duplication variable');
  return parts.join(' + ') || 'Mise à jour';
}

function buildQueueVersionMeta(group: ContainerQueueGroup): { versionName: string; versionDesc: string } {
  const names = [
    ...group.renames.map((r) => r.newName),
    ...group.triggerOps.map((t) => t.op.tagRowKey),
    ...group.duplications.map((d) => d.tag.name),
    ...group.variableDuplications.map((d) => d.variable.name),
  ];
  const uniqueNames = [...new Set(names)];
  const namesLabel = uniqueNames.length <= 4 ? uniqueNames.join(', ') : `${uniqueNames.slice(0, 4).join(', ')} +${uniqueNames.length - 4} autre${uniqueNames.length - 4 > 1 ? 's' : ''}`;
  const versionName = `${buildActionPrefix(group)} — ${namesLabel}`;
  const lines = [
    ...group.renames.map((r) => `Renommage : "${r.oldName}" -> "${r.newName}"`),
    ...group.triggerOps.map(({ op }) => `${op.kind === 'remove' ? 'Retrait déclencheur' : 'Synchronisation déclencheurs'} : ${op.tagRowKey}`),
    ...group.duplications.map((d) => `Duplication tag : "${d.tag.name}" depuis ${d.sourceContainerName}`),
    ...group.variableDuplications.map((d) => `Duplication variable : "${d.variable.name}" depuis ${d.sourceContainerName}`),
  ];
  return { versionName, versionDesc: lines.join('\n') };
}

function ContainerQueueCard({
  group,
  selected,
  onToggleSelected,
}: {
  group: ContainerQueueGroup;
  selected: boolean;
  onToggleSelected: () => void;
}) {
  const { accessToken } = useAuthStore();
  const { applyContainerQueue, isApplyingContainerQueue } = useGTMStore();
  const [expanded, setExpanded] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [versionDesc, setVersionDesc] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  const totalCount = group.renames.length + group.triggerOps.length + group.duplications.length + group.variableDuplications.length;

  function openPanel() {
    const meta = buildQueueVersionMeta(group);
    setVersionName(meta.versionName);
    setVersionDesc(meta.versionDesc);
    setResult(null);
    setExpanded(true);
  }

  async function handlePublish() {
    if (!accessToken || !versionName.trim()) return;
    setPublishing(true);
    setResult(null);
    const res = await applyContainerQueue(accessToken, group.containerId, { versionName: versionName.trim(), description: versionDesc.trim() });
    setPublishing(false);
    setResult(res);
    if (res.success) setExpanded(false);
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            className="w-4 h-4 rounded border-border shrink-0"
            title="Inclure dans la publication groupée"
          />
          <span className="font-semibold text-sm text-foreground">{group.containerName}</span>
          <Badge variant="default">{group.publicId}</Badge>
          <span className="text-xs text-muted-fg">{totalCount} modification{totalCount > 1 ? 's' : ''}</span>
        </div>
        {!expanded && (
          <Button size="sm" onClick={openPanel} disabled={!accessToken} title={!accessToken ? 'Session GTM expirée — reconnecte-toi' : undefined}>
            Publier →
          </Button>
        )}
      </div>

      <div className="px-4 py-3 space-y-1.5 text-xs">
        {group.renames.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <Badge variant="default">Renommage</Badge>
            <span className="font-mono text-muted-fg truncate max-w-[140px]">{r.oldName}</span>
            <span className="text-muted-fg">→</span>
            <span className="font-mono font-medium text-foreground truncate max-w-[140px]">{r.newName}</span>
          </div>
        ))}
        {group.triggerOps.map(({ op }, i) => (
          <div key={`${op.id}-${i}`} className="flex items-center gap-2">
            <Badge variant={op.kind === 'remove' ? 'error' : 'info'}>{op.kind === 'remove' ? 'Retrait' : 'Sync'}</Badge>
            <span className="font-mono text-foreground">{op.tagRowKey}</span>
            <span className="text-muted-fg">({op.tagCategory})</span>
          </div>
        ))}
        {group.duplications.map((d) => (
          <div key={d.id} className="flex items-center gap-2">
            <Badge variant="success">Duplication tag</Badge>
            <span className="font-mono text-foreground">{d.tag.name}</span>
            <span className="text-muted-fg">depuis {d.sourceContainerName}</span>
          </div>
        ))}
        {group.variableDuplications.map((d) => (
          <div key={d.id} className="flex items-center gap-2">
            <Badge variant="success">Duplication variable</Badge>
            <span className="font-mono text-foreground">{d.variable.name}</span>
            <span className="text-muted-fg">depuis {d.sourceContainerName}</span>
          </div>
        ))}
      </div>

      {result && !result.success && (
        <div className="px-4 py-2.5 text-xs bg-destructive/8 border-t border-destructive/20 text-destructive">
          Échec : {result.error?.slice(0, 160)}
        </div>
      )}

      {expanded && (
        <div className="px-4 py-3 border-t border-border space-y-3" style={{ backgroundColor: 'hsl(220 20% 98%)' }}>
          {publishing ? (
            <PublishingLoader label={`Publication sur ${group.containerName}…`} />
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Nom de la version GTM</label>
                <input
                  className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Description</label>
                <textarea
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
                  rows={4}
                  value={versionDesc}
                  onChange={(e) => setVersionDesc(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setExpanded(false)}>Annuler</Button>
                <div className="flex-1" />
                <Button size="sm" onClick={handlePublish} disabled={!versionName.trim() || isApplyingContainerQueue}>
                  Publier
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface BulkResult {
  containerId: string;
  containerName: string;
  publicId: string;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

function PendingChangesSection() {
  const { pendingRenames, pendingTriggerOps, pendingTagDuplications, pendingVariableDuplications, applyContainerQueue } = useGTMStore();
  const { accessToken } = useAuthStore();

  const groups = useMemo(() => {
    const map = new Map<string, ContainerQueueGroup>();
    const ensure = (containerId: string, containerName: string, publicId: string) => {
      if (!map.has(containerId)) map.set(containerId, { containerId, containerName, publicId, renames: [], triggerOps: [], duplications: [], variableDuplications: [] });
      return map.get(containerId)!;
    };
    for (const r of pendingRenames) {
      if (r.status !== 'pending') continue;
      ensure(r.containerId, r.containerName, r.publicId).renames.push(r);
    }
    for (const op of pendingTriggerOps) {
      if (op.status !== 'pending') continue;
      for (const step of op.steps) {
        ensure(step.containerId, step.containerName, step.publicId).triggerOps.push({ op, step });
      }
    }
    for (const d of pendingTagDuplications) {
      if (d.status !== 'pending') continue;
      ensure(d.containerId, d.containerName, d.publicId).duplications.push(d);
    }
    for (const d of pendingVariableDuplications) {
      if (d.status !== 'pending') continue;
      ensure(d.containerId, d.containerName, d.publicId).variableDuplications.push(d);
    }
    return [...map.values()];
  }, [pendingRenames, pendingTriggerOps, pendingTagDuplications, pendingVariableDuplications]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);

  // Default to "all selected" whenever the set of containers with pending changes changes
  // (a container appears or gets fully cleared) — the common case is publishing everything.
  const idsKey = groups.map((g) => g.containerId).sort().join(',');
  useEffect(() => {
    setSelectedIds(new Set(groups.map((g) => g.containerId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  if (groups.length === 0) return null;

  function toggleSelected(containerId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(containerId)) next.delete(containerId); else next.add(containerId);
      return next;
    });
  }

  // Each container publishes to its own GTM version — GTM has no notion of a version
  // spanning multiple containers — so "publier en même temps" means sequential, isolated
  // publishes (one container's failure doesn't block the others), same pattern as the
  // main package deploy(). Auto-generates the version name/description per container;
  // use the individual "Publier →" button instead if you need to tweak one by hand.
  async function handleBulkPublish() {
    const targets = groups.filter((g) => selectedIds.has(g.containerId));
    if (targets.length === 0 || !accessToken) return;

    setIsBulkPublishing(true);
    setBulkResults(targets.map((g) => ({ containerId: g.containerId, containerName: g.containerName, publicId: g.publicId, status: 'pending' })));

    for (const g of targets) {
      setBulkResults((prev) => prev!.map((r) => (r.containerId === g.containerId ? { ...r, status: 'running' } : r)));
      const meta = buildQueueVersionMeta(g);
      const res = await applyContainerQueue(accessToken, g.containerId, { versionName: meta.versionName, description: meta.versionDesc });
      setBulkResults((prev) => prev!.map((r) => (r.containerId === g.containerId ? { ...r, status: res.success ? 'success' : 'error', error: res.error } : r)));
    }

    setIsBulkPublishing(false);
  }

  const selectedCount = groups.filter((g) => selectedIds.has(g.containerId)).length;
  const allSelected = selectedCount === groups.length;

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Modifications en attente
          <span className="ml-2 text-xs font-normal text-muted-fg">planifiées depuis Monitoring — {groups.length} container{groups.length > 1 ? 's' : ''}</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedIds(allSelected ? new Set() : new Set(groups.map((g) => g.containerId)))}
            className="text-xs text-muted-fg hover:text-foreground transition-colors"
          >
            {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
          <Button
            size="sm"
            onClick={handleBulkPublish}
            disabled={!accessToken || selectedCount === 0 || isBulkPublishing}
            title={!accessToken ? 'Session GTM expirée — reconnecte-toi' : undefined}
          >
            Publier {selectedCount > 1 ? `${selectedCount} containers` : selectedCount === 1 ? '1 container' : ''} →
          </Button>
        </div>
      </div>

      {bulkResults && (
        <div className="bg-card border border-border rounded-xl p-3 space-y-1.5">
          {bulkResults.map((r) => (
            <div key={r.containerId} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <StepIcon status={r.status} />
                <span className="text-foreground">{r.containerName}</span>
                <span className="text-muted-fg">{r.publicId}</span>
              </div>
              {r.error && <span className="text-destructive max-w-[280px] truncate">{r.error.slice(0, 100)}</span>}
            </div>
          ))}
        </div>
      )}

      {groups.map((g) => (
        <ContainerQueueCard
          key={g.containerId}
          group={g}
          selected={selectedIds.has(g.containerId)}
          onToggleSelected={() => toggleSelected(g.containerId)}
        />
      ))}
    </div>
  );
}

export function DeployPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const {
    packages, selectedPackageId, selectPackage,
    containers, selectedContainerIds,
    diffs, isDiffing, computeDiffs, globalDiffSummary, resetDiffs,
    isDeploying, deploymentResults, deploymentProgress,
    autoPublish, setAutoPublish,
    deploy, resetDeployment,
  } = useGTMStore();

  const [step, setStep] = useState<Step>('select');
  const [diffView, setDiffView] = useState<'entities' | 'coverage'>('entities');

  const selectedPkg = packages.find((p) => p.id === selectedPackageId);
  const selectedContainers = containers.filter((c) => selectedContainerIds.has(c.containerId));

  // Auto-generate short, explicit version name + description
  const defaultVersionName = selectedPkg ? selectedPkg.name.slice(0, 48) : 'DK Deploy';

  const [versionName, setVersionName] = useState(defaultVersionName);
  const [versionDescription, setVersionDescription] = useState('');
  const packageWarnings = useMemo(() => (selectedPkg ? validatePackage(selectedPkg) : []), [selectedPkg]);
  const canAnalyse = !!selectedPkg && selectedContainers.length > 0;
  const summary = globalDiffSummary();
  const hasDiff = Object.values(diffs).some((d) => d.status === 'ready');
  const canDeploy = hasDiff && summary.selectedCount > 0 && !isDeploying;

  const handleAnalyse = async () => {
    if (!accessToken) return;
    resetDiffs();
    setStep('diff');
    await computeDiffs(accessToken);
  };

  const handleDeploy = async () => {
    if (!accessToken || !selectedPackageId) return;
    setStep('progress');
    const desc = versionDescription.trim() ||
      `DK GTM Manager · Package: ${selectedPkg?.name ?? ''} · ${summary.selectedCount} entités sur ${selectedContainers.length} container${selectedContainers.length > 1 ? 's' : ''}`;
    await deploy(accessToken, selectedPackageId, versionName, desc);
    setStep('done');
  };

  const handleReset = () => {
    resetDeployment();
    resetDiffs();
    setStep('select');
  };

  const successCount = deploymentResults.filter((r) => r.status === 'success').length;
  const errorCount = deploymentResults.filter((r) => r.status === 'error').length;

  // ─── Progress / Done ────────────────────────────────────────────────────────

  if (step === 'progress' || step === 'done') {
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">
            {step === 'done' ? 'Déploiement terminé' : 'Déploiement en cours…'}
          </h1>
          {step === 'done' && (
            <div className="flex items-center gap-3 mt-2">
              {successCount > 0 && <Badge variant="success">{successCount} succès</Badge>}
              {errorCount > 0 && <Badge variant="error">{errorCount} erreur{errorCount > 1 ? 's' : ''}</Badge>}
            </div>
          )}
        </div>

        {step === 'progress' && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-fg mb-1">
              <span>Progression</span><span>{deploymentProgress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 rounded-full"
                style={{ width: `${deploymentProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          {deploymentResults.map((result) => (
            <div key={result.containerId} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{result.containerName}</span>
                  <Badge variant="default">{result.containerPublicId}</Badge>
                </div>
                {result.status === 'success' && <Badge variant="success">{autoPublish ? 'Publié' : 'Version créée'}</Badge>}
                {result.status === 'error' && <Badge variant="error">Erreur</Badge>}
                {result.status === 'running' && <Badge variant="info">En cours…</Badge>}
                {result.status === 'pending' && <Badge variant="default">En attente</Badge>}
              </div>
              <div className="px-4 py-3 space-y-1.5">
                {result.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <StepIcon status={s.status} />
                    <span className={`text-xs ${s.status === 'pending' ? 'text-muted-fg' : 'text-foreground'}`}>{s.label}</span>
                    {s.detail && (
                      <span className={`text-xs font-mono ${s.status === 'error' ? 'text-destructive' : 'text-muted-fg'}`}>
                        {s.status === 'error' ? (friendlyGtmError(s.detail)?.message ?? s.detail) : s.detail}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {step === 'done' && (
          <div className="mt-6 flex gap-3">
            <Button onClick={handleReset}>Nouveau déploiement</Button>
            <Button variant="secondary" onClick={() => navigate('/dashboard/history')}>Voir l'historique</Button>
          </div>
        )}
      </div>
    );
  }

  // ─── Diff step ──────────────────────────────────────────────────────────────

  if (step === 'diff') {
    return (
      <div className="max-w-2xl">
        <div className="mb-4 flex items-center gap-3">
          <button
            className="text-muted-fg hover:text-foreground transition-colors"
            onClick={() => { setStep('select'); resetDiffs(); }}
            aria-label="Retour à la sélection du package"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Analyse des containers</h1>
            <p className="text-sm text-muted-fg mt-0.5">
              Sélectionnez les entités à déployer, puis confirmez.
            </p>
          </div>
        </div>

        {/* Global summary */}
        {hasDiff && (
          <div className="bg-card border border-border rounded-xl p-4 mb-4 flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-extrabold text-success">{summary.newCount}</div>
              <div className="text-xs text-muted-fg">nouveau{summary.newCount > 1 ? 'x' : ''}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-warning">{summary.modifiedCount}</div>
              <div className="text-xs text-muted-fg">modifié{summary.modifiedCount > 1 ? 's' : ''}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-muted-fg">{summary.unchangedCount}</div>
              <div className="text-xs text-muted-fg">inchangé{summary.unchangedCount > 1 ? 's' : ''}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-sm font-semibold text-primary">{summary.selectedCount} sélectionné{summary.selectedCount > 1 ? 's' : ''}</div>
              <div className="text-xs text-muted-fg">sur {selectedContainers.length} container{selectedContainers.length > 1 ? 's' : ''}</div>
            </div>
          </div>
        )}

        {/* View toggle */}
        {hasDiff && (
          <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs mb-3 w-fit">
            <button
              onClick={() => setDiffView('entities')}
              className={`px-3 py-1.5 transition-colors font-medium ${diffView === 'entities' ? 'bg-primary text-white' : 'text-muted-fg hover:bg-muted'}`}
            >
              Entités
            </button>
            <button
              onClick={() => setDiffView('coverage')}
              className={`px-3 py-1.5 transition-colors font-medium border-l border-border ${diffView === 'coverage' ? 'bg-primary text-white' : 'text-muted-fg hover:bg-muted'}`}
            >
              Couverture GA4
            </button>
          </div>
        )}

        {/* Container diffs */}
        {diffView === 'entities' ? (
          <DiffView diffs={diffs} />
        ) : (
          <GA4CoverageMatrix diffs={diffs} />
        )}

        {/* Version + publish options */}
        {hasDiff && (
          <div className="mt-4 space-y-3">
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-fg uppercase tracking-wide mb-1">
                    Nom de la version GTM
                    <span className="ml-1 font-normal normal-case opacity-60">— court et explicite</span>
                  </label>
                  <input
                    className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    placeholder={defaultVersionName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-fg uppercase tracking-wide mb-1">
                    Description
                    <span className="ml-1 font-normal normal-case opacity-60">— optionnelle, auto-générée si vide</span>
                  </label>
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    rows={2}
                    value={versionDescription}
                    onChange={(e) => setVersionDescription(e.target.value)}
                    placeholder={`DK GTM Manager · Package: ${selectedPkg?.name ?? '—'} · ${summary.selectedCount} entités`}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${autoPublish ? 'border-primary bg-primary' : 'border-border'}`}
                    onClick={() => setAutoPublish(!autoPublish)}
                  >
                    {autoPublish && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-foreground">Publier automatiquement après déploiement</span>
                </label>
                {!autoPublish && (
                  <span className="text-xs text-muted-fg">La version sera créée mais pas publiée</span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-warning/8 border border-warning/20 rounded-lg text-xs text-warning">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
                <path d="M7 1L13 12H1L7 1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
                <path d="M7 5v3M7 10h.01" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
              <span>
                {summary.selectedCount} entité{summary.selectedCount > 1 ? 's' : ''} seront déployées sur{' '}
                <strong>{selectedContainers.length} container{selectedContainers.length > 1 ? 's' : ''}</strong>
                {autoPublish ? ' et publiées immédiatement.' : ' (version créée, pas encore publiée).'}
              </span>
            </div>

            <Button size="lg" className="w-full" disabled={!canDeploy} onClick={handleDeploy} loading={isDeploying}>
              {`Déployer ${summary.selectedCount} entité${summary.selectedCount > 1 ? 's' : ''} sur ${selectedContainers.length} container${selectedContainers.length > 1 ? 's' : ''}`}
            </Button>
          </div>
        )}

        {isDiffing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-fg">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full" style={{ animation: 'dk-spin 0.75s linear infinite' }} />
            Analyse en cours sur {selectedContainers.length} container{selectedContainers.length > 1 ? 's' : ''}…
          </div>
        )}
      </div>
    );
  }

  // ─── Select step ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl">
      <PendingChangesSection />

      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">Déployer un package</h1>
          <InfoTooltip>Compare un package aux containers cibles (diff avant/après), puis publie la nouvelle version — en masse sur plusieurs containers en un clic, avec isolation des erreurs container par container.</InfoTooltip>
        </div>
        <p className="text-sm text-muted-fg mt-1">Sélectionnez le package et les containers, puis analysez le diff.</p>
      </div>

      <div className="space-y-4">
        {/* Package */}
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="block text-xs font-semibold text-muted-fg uppercase tracking-wide mb-2">
            Package à déployer
          </label>
          {packages.length === 0 ? (
            <p className="text-sm text-muted-fg py-2">
              Aucun package.{' '}
              <button className="text-primary hover:underline" onClick={() => navigate('/dashboard/packages')}>
                Créer un package
              </button>
            </p>
          ) : (
            <select
              className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={selectedPackageId ?? ''}
              onChange={(e) => selectPackage(e.target.value || null)}
            >
              <option value="">— Choisir un package —</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.entities.tags.length}T · {p.entities.variables.length}V · {p.entities.triggers.length}D)
                </option>
              ))}
            </select>
          )}
          {selectedPkg && (
            <div className="mt-3 flex gap-4 text-xs text-muted-fg bg-muted rounded-lg px-3 py-2">
              <span><strong className="text-foreground">{selectedPkg.entities.tags.length}</strong> tags</span>
              <span><strong className="text-foreground">{selectedPkg.entities.variables.length}</strong> variables</span>
              <span><strong className="text-foreground">{selectedPkg.entities.triggers.length}</strong> déclencheurs</span>
            </div>
          )}
          {packageWarnings.length > 0 && (
            <div className="mt-3 bg-warning/10 border border-warning/30 rounded-lg px-3 py-2 space-y-1.5">
              <p className="text-xs font-semibold text-warning uppercase tracking-wide">
                {packageWarnings.length} point{packageWarnings.length > 1 ? 's' : ''} à vérifier avant déploiement
              </p>
              <ul className="space-y-1">
                {packageWarnings.map((w, i) => (
                  <li key={i} className="text-xs text-muted-fg">
                    <span className="font-medium text-foreground">[{w.entityKind}] {w.entityName}</span>
                    {' — '}{w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Containers */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide">
              Containers cibles
            </label>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate('/dashboard/containers')}>
              Gérer →
            </button>
          </div>
          {selectedContainers.length === 0 ? (
            <p className="text-sm text-muted-fg py-2">
              Aucun container sélectionné.{' '}
              <button className="text-primary hover:underline" onClick={() => navigate('/dashboard/containers')}>
                Sélectionner
              </button>
            </p>
          ) : (
            <div className="space-y-1.5">
              {selectedContainers.map((c) => (
                <div key={c.containerId} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-foreground">{c.name}</span>
                  <Badge variant="default">{c.publicId}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={!canAnalyse}
          loading={isDiffing}
          onClick={handleAnalyse}
        >
          {canAnalyse
            ? `Analyser ${selectedContainers.length} container${selectedContainers.length > 1 ? 's' : ''} →`
            : 'Sélectionnez un package et des containers'}
        </Button>
      </div>
    </div>
  );
}
