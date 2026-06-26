import { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import type { MonitoringContainerData } from '../../data/monitoring-mock';
import type { RenameOperation, GTMTrigger } from '../../types/gtm';
import { useGTMStore } from '../../store/gtm-store';

// ─── Types ─────────────────────────────────────────────────────────────────────

type DrawerTab = 'triggers' | 'rename';

interface TriggerEntry {
  name: string;
  type: string;
  semanticKey: string;
  triggerId?: string;
}

interface RemoveConfirm {
  containerId: string;
  containerName: string;
  publicId: string;
  trigger: TriggerEntry;
}

// ─── Semantic key ──────────────────────────────────────────────────────────────

function triggerSemanticKey(tr: GTMTrigger): string {
  if (tr.type === 'customEvent') {
    const ev = tr.customEventFilter?.[0]?.parameter?.find((p) => p.key === 'arg1')?.value ?? '';
    return `customEvent::${ev}`;
  }
  if (tr.type === 'pageview' || tr.type === 'domReady' || tr.type === 'windowLoaded') {
    return tr.type;
  }
  const filterKey = (tr.filter ?? [])
    .map((c) => `${c.type}:${c.parameter.map((p) => p.value ?? '').sort().join(',')}`)
    .sort().join('|');
  return `${tr.type}::${filterKey}`;
}

interface ContainerTriggerInfo {
  containerId: string;
  containerName: string;
  publicId: string;
  tagPresent: boolean;
  tagName: string | null;
  triggers: TriggerEntry[];
}

interface SyncTriggerAction {
  semanticKey: string;
  name: string;
  triggerId?: string;
  triggerData?: GTMTrigger;
}

interface SyncContainerDiff {
  containerId: string;
  containerName: string;
  publicId: string;
  status: 'identical' | 'needs-sync' | 'absent';
  toUnlink: TriggerEntry[];
  toLinkExisting: SyncTriggerAction[];
  toCreate: SyncTriggerAction[];
}

interface ContainerOption {
  containerId: string;
  containerName: string;
  publicId: string;
  currentName: string | null;
}

export interface TagDrawerProps {
  rowKey: string;
  category: string;
  categoryColor: string;
  cells: Record<string, { name: string; type: string } | null>;
  containers: MonitoringContainerData[];
  existingRenames: RenameOperation[];
  initialTab?: DrawerTab;
  onSave: (ops: Omit<RenameOperation, 'id' | 'status' | 'createdAt'>[]) => void;
  onClose: () => void;
}

// ─── Trigger helpers ───────────────────────────────────────────────────────────

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  pageview: 'Page Vue',
  domReady: 'DOM Ready',
  windowLoaded: 'Window Loaded',
  customEvent: 'Custom Event',
  click: 'Clic',
  linkClick: 'Lien',
  scrollDepth: 'Scroll',
};

function buildTriggerInfo(
  containers: MonitoringContainerData[],
  cells: Record<string, { name: string; type: string } | null>,
): ContainerTriggerInfo[] {
  return containers.map((c) => {
    const cell = cells[c.containerId];
    if (!cell) return { containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, tagPresent: false, tagName: null, triggers: [] };
    const tag = c.tags.find((t) => t.name === cell.name);
    if (!tag) return { containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, tagPresent: false, tagName: null, triggers: [] };
    const triggerMap = new Map(c.triggers.filter((tr) => tr.triggerId).map((tr) => [tr.triggerId!, tr]));
    const triggers: TriggerEntry[] = (tag.firingTriggerId ?? []).flatMap((id) => {
      const tr = triggerMap.get(id);
      return tr ? [{ name: tr.name, type: tr.type, semanticKey: triggerSemanticKey(tr), triggerId: tr.triggerId }] : [];
    });
    return { containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, tagPresent: true, tagName: tag.name, triggers };
  });
}

function triggersConsistent(infos: ContainerTriggerInfo[]): boolean {
  const present = infos.filter((i) => i.tagPresent);
  if (present.length === 0) return true;
  const ref = present[0].triggers.map((t) => t.semanticKey).sort().join('|');
  return present.every((i) => i.triggers.map((t) => t.semanticKey).sort().join('|') === ref);
}

// ─── Sync diff ────────────────────────────────────────────────────────────────

function computeSyncDiff(
  refContainerId: string,
  infos: ContainerTriggerInfo[],
  containers: MonitoringContainerData[],
): SyncContainerDiff[] {
  const refInfo = infos.find((i) => i.containerId === refContainerId);
  if (!refInfo) return [];
  const refKeys = new Set(refInfo.triggers.map((t) => t.semanticKey));
  const refContainer = containers.find((c) => c.containerId === refContainerId);

  return infos
    .filter((i) => i.containerId !== refContainerId)
    .map((info): SyncContainerDiff => {
      if (!info.tagPresent) {
        return { containerId: info.containerId, containerName: info.containerName, publicId: info.publicId, status: 'absent', toUnlink: [], toLinkExisting: [], toCreate: [] };
      }

      const targetKeys = new Set(info.triggers.map((t) => t.semanticKey));
      const identical = refKeys.size === targetKeys.size && [...refKeys].every((k) => targetKeys.has(k));
      if (identical) {
        return { containerId: info.containerId, containerName: info.containerName, publicId: info.publicId, status: 'identical', toUnlink: [], toLinkExisting: [], toCreate: [] };
      }

      const toUnlink = info.triggers.filter((t) => !refKeys.has(t.semanticKey));

      const targetContainer = containers.find((c) => c.containerId === info.containerId);
      const toLinkExisting: SyncTriggerAction[] = [];
      const toCreate: SyncTriggerAction[] = [];

      for (const refTr of refInfo.triggers) {
        if (targetKeys.has(refTr.semanticKey)) continue; // already linked
        const existing = targetContainer?.triggers.find(
          (tr) => tr.triggerId && triggerSemanticKey(tr) === refTr.semanticKey,
        );
        if (existing) {
          toLinkExisting.push({ semanticKey: refTr.semanticKey, name: existing.name, triggerId: existing.triggerId });
        } else {
          const fullTrigger = refContainer?.triggers.find((tr) => tr.triggerId === refTr.triggerId);
          toCreate.push({ semanticKey: refTr.semanticKey, name: refTr.name, triggerData: fullTrigger });
        }
      }

      return { containerId: info.containerId, containerName: info.containerName, publicId: info.publicId, status: 'needs-sync', toUnlink, toLinkExisting, toCreate };
    });
}

// ─── Sync plan view ────────────────────────────────────────────────────────────

function SyncPlanView({
  infos,
  containers,
  rowKey,
  category,
  onPlan,
  onBack,
}: {
  infos: ContainerTriggerInfo[];
  containers: MonitoringContainerData[];
  rowKey: string;
  category: string;
  onPlan: (steps: import('../../types/gtm').TriggerOpStep[], refContainerId: string, refContainerName: string) => void;
  onBack: () => void;
}) {
  const presentInfos = infos.filter((i) => i.tagPresent);
  const [refId, setRefId] = useState<string>(presentInfos[0]?.containerId ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const diffs = useMemo(
    () => (refId ? computeSyncDiff(refId, infos, containers) : []),
    [refId, infos, containers],
  );

  // Auto-select all "needs-sync" when ref changes
  useEffect(() => {
    setSelected(new Set(diffs.filter((d) => d.status === 'needs-sync').map((d) => d.containerId)));
  }, [refId]);

  const refInfo = infos.find((i) => i.containerId === refId);
  const needsSync = diffs.filter((d) => d.status === 'needs-sync');
  const selectedCount = needsSync.filter((d) => selected.has(d.containerId)).length;

  function toggleContainer(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handlePlan() {
    const refContainer = containers.find((c) => c.containerId === refId);
    const steps: import('../../types/gtm').TriggerOpStep[] = diffs
      .filter((d) => d.status === 'needs-sync' && selected.has(d.containerId))
      .map((d) => ({
        containerId: d.containerId,
        containerName: d.containerName,
        publicId: d.publicId,
        unlink: d.toUnlink.map((t) => t.triggerId).filter((id): id is string => !!id),
        linkExisting: d.toLinkExisting.map((t) => t.triggerId).filter((id): id is string => !!id),
        createAndLink: d.toCreate.map((t) => t.triggerData).filter((tr): tr is GTMTrigger => !!tr),
      }));
    onPlan(steps, refId, refContainer?.containerName ?? refId);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sub-header */}
      <div className="px-5 py-3 border-b flex items-center gap-2 shrink-0" style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)' }}>
        <button onClick={onBack} className="p-1 rounded text-muted-fg hover:text-foreground transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-xs font-semibold text-foreground">Synchroniser les déclencheurs</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Reference selector */}
        <div>
          <p className="text-[11px] font-semibold text-muted-fg uppercase tracking-wider mb-2">Container de référence</p>
          <div className="space-y-1">
            {presentInfos.map((info) => (
              <button
                key={info.containerId}
                onClick={() => setRefId(info.containerId)}
                className="w-full flex items-start gap-2.5 px-3 py-2 rounded-lg border text-left transition-all"
                style={{
                  borderColor: refId === info.containerId ? 'hsl(142 60% 55%)' : 'hsl(220 13% 88%)',
                  backgroundColor: refId === info.containerId ? 'hsl(142 72% 96%)' : 'white',
                }}
              >
                <div className="w-3.5 h-3.5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center" style={{ borderColor: refId === info.containerId ? 'hsl(142 60% 40%)' : 'hsl(220 13% 70%)' }}>
                  {refId === info.containerId && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(142 60% 40%)' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">{info.containerName}</span>
                    <span className="text-[10px] font-mono text-muted-fg">{info.publicId}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {info.triggers.map((t, i) => (
                      <span key={i} className="px-1 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 40%)' }}>
                        {t.name}
                      </span>
                    ))}
                    {info.triggers.length === 0 && <span className="text-[10px] italic text-muted-fg">Aucun déclencheur</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Target containers */}
        {refId && (
          <div>
            <p className="text-[11px] font-semibold text-muted-fg uppercase tracking-wider mb-2">Containers cibles</p>
            <div className="space-y-2">
              {diffs.map((diff) => {
                const isNeeds = diff.status === 'needs-sync';
                const isSelected = selected.has(diff.containerId);
                return (
                  <div
                    key={diff.containerId}
                    className="rounded-xl border overflow-hidden"
                    style={{
                      borderColor: diff.status === 'absent' ? 'hsl(220 13% 88%)' : diff.status === 'identical' ? 'hsl(142 60% 70%)' : isSelected ? 'hsl(38 90% 60%)' : 'hsl(220 13% 88%)',
                      opacity: diff.status === 'absent' ? 0.5 : 1,
                    }}
                  >
                    {/* Card header */}
                    <div
                      className="px-3 py-2 flex items-center justify-between"
                      style={{
                        backgroundColor: diff.status === 'absent' ? 'hsl(220 20% 97%)' : diff.status === 'identical' ? 'hsl(142 72% 96%)' : isSelected ? 'hsl(38 100% 97%)' : 'hsl(220 20% 97%)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {isNeeds && (
                          <button
                            onClick={() => toggleContainer(diff.containerId)}
                            className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                            style={{
                              borderColor: isSelected ? 'hsl(38 90% 50%)' : 'hsl(220 13% 65%)',
                              backgroundColor: isSelected ? 'hsl(38 90% 50%)' : 'white',
                            }}
                          >
                            {isSelected && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </button>
                        )}
                        <span className="text-xs font-semibold text-foreground">{diff.containerName}</span>
                        <span className="text-[10px] font-mono text-muted-fg">{diff.publicId}</span>
                      </div>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: diff.status === 'absent' ? 'hsl(220 13% 91%)' : diff.status === 'identical' ? 'hsl(142 72% 90%)' : 'hsl(38 100% 92%)',
                          color: diff.status === 'absent' ? 'hsl(220 13% 50%)' : diff.status === 'identical' ? 'hsl(142 60% 30%)' : 'hsl(35 80% 35%)',
                        }}
                      >
                        {diff.status === 'absent' ? 'Tag absent' : diff.status === 'identical' ? 'Déjà identique' : 'À synchroniser'}
                      </span>
                    </div>

                    {/* Diff details */}
                    {diff.status === 'needs-sync' && (
                      <div className="px-3 py-2 space-y-1" style={{ backgroundColor: 'white' }}>
                        {diff.toUnlink.map((t, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px]">
                            <span className="font-bold shrink-0" style={{ color: 'hsl(0 70% 55%)' }}>−</span>
                            <span className="font-mono" style={{ color: 'hsl(0 70% 40%)' }}>{t.name}</span>
                            <span className="text-muted-fg text-[10px]">retirer</span>
                          </div>
                        ))}
                        {diff.toLinkExisting.map((t, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px]">
                            <span className="font-bold shrink-0" style={{ color: 'hsl(220 70% 55%)' }}>~</span>
                            <span className="font-mono" style={{ color: 'hsl(220 13% 30%)' }}>{t.name}</span>
                            <span className="text-muted-fg text-[10px]">lier l'existant</span>
                          </div>
                        ))}
                        {diff.toCreate.map((t, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px]">
                            <span className="font-bold shrink-0" style={{ color: 'hsl(142 60% 40%)' }}>+</span>
                            <span className="font-mono" style={{ color: 'hsl(220 13% 30%)' }}>{t.name}</span>
                            <span className="text-muted-fg text-[10px]">créer et lier</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t shrink-0" style={{ borderColor: 'hsl(220 13% 91%)' }}>
        <button
          disabled={selectedCount === 0}
          onClick={handlePlan}
          className="w-full px-4 py-2 text-xs font-medium rounded-lg text-white transition-all"
          style={{ backgroundColor: selectedCount > 0 ? 'hsl(38 90% 50%)' : 'hsl(220 13% 85%)', cursor: selectedCount > 0 ? 'pointer' : 'not-allowed' }}
        >
          {selectedCount === 0 ? 'Sélectionner des containers' : `Planifier ${selectedCount} synchronisation${selectedCount > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

// ─── Triggers tab ──────────────────────────────────────────────────────────────

function TriggersTab({
  infos,
  consistent,
  pendingTriggerOps,
  tagRowKey,
  containers,
  onRemove,
  onCancelOp,
  onSync,
}: {
  infos: ContainerTriggerInfo[];
  consistent: boolean;
  pendingTriggerOps: import('../../types/gtm').TriggerOperation[];
  tagRowKey: string;
  containers: MonitoringContainerData[];
  onRemove: (containerId: string, containerName: string, publicId: string, trigger: TriggerEntry, isLast: boolean) => void;
  onCancelOp: (opId: string) => void;
  onSync: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
      {!consistent && (
        <button
          onClick={onSync}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all hover:opacity-80"
          style={{ borderColor: 'hsl(38 90% 60%)', backgroundColor: 'hsl(38 100% 97%)', color: 'hsl(35 80% 35%)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6a4 4 0 0 1 7.5-1.5M10 6a4 4 0 0 1-7.5 1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/><path d="M9.5 2v2.5H7M3 9.5V7H5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Synchroniser depuis une référence
        </button>
      )}
      {[...infos].sort((a, b) => {
        // Compute majority trigger set once (most common across present containers)
        const presentInfos = infos.filter((i) => i.tagPresent);
        const freq = new Map<string, number>();
        for (const i of presentInfos) {
          const k = [...i.triggers.map((t) => t.semanticKey)].sort().join('|');
          freq.set(k, (freq.get(k) ?? 0) + 1);
        }
        const majoritySet = [...freq.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? '';

        const rank = (i: ContainerTriggerInfo) => {
          if (!i.tagPresent) return 2;
          const hasPendingOp = pendingTriggerOps.some(
            (op) => op.tagRowKey === tagRowKey && op.steps.some((s) => s.containerId === i.containerId),
          );
          if (hasPendingOp) return 0;
          const thisSet = [...i.triggers.map((t) => t.semanticKey)].sort().join('|');
          return thisSet === majoritySet ? 1 : 0; // identical to majority → just above absent
        };
        return rank(a) - rank(b);
      }).map((info) => {
        const isInconsistent = !consistent && info.tagPresent;

        // Pending operations for this container
        const pendingRemoveOp = pendingTriggerOps.find(
          (op) => op.kind === 'remove' && op.tagRowKey === tagRowKey &&
            op.steps.some((s) => s.containerId === info.containerId),
        );
        const pendingSyncOp = pendingTriggerOps.find(
          (op) => op.kind === 'sync' && op.tagRowKey === tagRowKey &&
            op.steps.some((s) => s.containerId === info.containerId),
        );
        const syncStep = pendingSyncOp?.steps.find((s) => s.containerId === info.containerId);

        // Resolve linkExisting trigger names from the full container data
        const containerData = containers.find((c) => c.containerId === info.containerId);
        const toAddRows: { name: string; type: string; kind: 'link' | 'create' }[] = [];
        if (syncStep) {
          for (const id of syncStep.linkExisting ?? []) {
            const tr = containerData?.triggers.find((t) => t.triggerId === id);
            if (tr) toAddRows.push({ name: tr.name, type: tr.type, kind: 'link' });
          }
          for (const tr of syncStep.createAndLink ?? []) {
            toAddRows.push({ name: tr.name, type: tr.type, kind: 'create' });
          }
        }

        const hasPending = !!pendingRemoveOp || !!pendingSyncOp;

        return (
          <div
            key={info.containerId}
            className="rounded-xl border overflow-hidden"
            style={{
              borderColor: hasPending
                ? 'hsl(38 90% 60%)'
                : !info.tagPresent
                ? 'hsl(220 13% 88%)'
                : isInconsistent
                ? 'hsl(0 70% 80%)'
                : 'hsl(142 60% 70%)',
            }}
          >
            <div
              className="px-3.5 py-2.5 flex items-center justify-between"
              style={{
                backgroundColor: hasPending
                  ? 'hsl(38 100% 97%)'
                  : !info.tagPresent
                  ? 'hsl(220 20% 97%)'
                  : isInconsistent
                  ? 'hsl(0 85% 97%)'
                  : 'hsl(142 72% 96%)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{info.containerName}</span>
                <span className="font-mono text-[10px] text-muted-fg">{info.publicId}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {pendingSyncOp && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: 'hsl(38 90% 50% / 0.15)', color: 'hsl(35 80% 35%)' }}>
                    Sync planifiée
                  </span>
                )}
                {info.tagPresent && info.tagName && !pendingSyncOp && (
                  <span className="text-[10px] font-mono truncate max-w-[160px]" style={{ color: 'hsl(220 13% 50%)' }} title={info.tagName}>
                    {info.tagName}
                  </span>
                )}
              </div>
            </div>
            <div className="px-3.5 py-2.5" style={{ backgroundColor: 'white' }}>
              {!info.tagPresent ? (
                <span className="text-[11px] italic" style={{ color: 'hsl(220 13% 55%)' }}>Tag absent dans ce container</span>
              ) : info.triggers.length === 0 && toAddRows.length === 0 ? (
                <span className="text-[11px] italic" style={{ color: 'hsl(0 70% 55%)' }}>Aucun déclencheur lié</span>
              ) : (
                <div className="space-y-1.5">
                  {info.triggers.map((tr, i) => {
                    const label = TRIGGER_TYPE_LABELS[tr.type] ?? tr.type;
                    const isLast = info.triggers.length === 1;
                    const isSuspiciousPageview = tr.type === 'pageview' && info.triggers.length > 1;
                    const queuedRemove = pendingTriggerOps.find(
                      (op) => op.kind === 'remove' && op.tagRowKey === tagRowKey &&
                        op.steps.some((s) => s.containerId === info.containerId && s.unlink?.includes(tr.triggerId ?? '')),
                    );
                    const syncWillRemove = syncStep?.unlink?.includes(tr.triggerId ?? '');

                    const willBeRemoved = !!queuedRemove || !!syncWillRemove;
                    return (
                      <div key={i} className="group flex items-center gap-2" style={{ opacity: willBeRemoved ? 0.5 : 1 }}>
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider shrink-0"
                          style={{
                            backgroundColor: isSuspiciousPageview ? 'hsl(0 85% 96%)' : 'hsl(220 13% 91%)',
                            color: isSuspiciousPageview ? 'hsl(0 70% 50%)' : 'hsl(220 13% 45%)',
                          }}
                        >
                          {label}
                        </span>
                        <span
                          className="text-[11px] font-mono flex-1"
                          style={{
                            color: isSuspiciousPageview ? 'hsl(0 70% 45%)' : 'hsl(220 13% 20%)',
                            textDecoration: willBeRemoved ? 'line-through' : 'none',
                          }}
                        >
                          {tr.name}
                        </span>
                        {isSuspiciousPageview && !willBeRemoved && (
                          <span className="text-[10px] font-medium px-1 py-0.5 rounded shrink-0" style={{ backgroundColor: 'hsl(0 85% 96%)', color: 'hsl(0 70% 45%)' }}>
                            Toutes les pages
                          </span>
                        )}
                        {willBeRemoved ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: 'hsl(0 85% 96%)', color: 'hsl(0 65% 50%)' }}>
                            à retirer
                          </span>
                        ) : queuedRemove ? null : tr.triggerId && !syncStep ? (
                          <button
                            onClick={() => onRemove(info.containerId, info.containerName, info.publicId, tr, isLast)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 50%)' }}
                          >
                            Retirer
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                  {toAddRows.map((tr, i) => {
                    const label = TRIGGER_TYPE_LABELS[tr.type] ?? tr.type;
                    return (
                      <div key={`add-${i}`} className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider shrink-0" style={{ backgroundColor: 'hsl(142 60% 93%)', color: 'hsl(142 50% 30%)' }}>
                          {label}
                        </span>
                        <span className="text-[11px] font-mono flex-1" style={{ color: 'hsl(142 50% 30%)' }}>{tr.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: 'hsl(142 60% 93%)', color: 'hsl(142 50% 30%)' }}>
                          {tr.kind === 'link' ? 'à lier' : 'à créer'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Rename tab ────────────────────────────────────────────────────────────────

function RenameTab({
  rowKey,
  category,
  categoryColor,
  options,
  existingRenames,
  onSave,
  onClose,
}: {
  rowKey: string;
  category: string;
  categoryColor: string;
  options: ContainerOption[];
  existingRenames: RenameOperation[];
  onSave: (ops: Omit<RenameOperation, 'id' | 'status' | 'createdAt'>[]) => void;
  onClose: () => void;
}) {
  function getMostFrequentName(): string {
    const names = options.flatMap((o) => (o.currentName ? [o.currentName] : []));
    if (names.length === 0) return rowKey;
    const freq = new Map<string, number>();
    for (const n of names) freq.set(n, (freq.get(n) ?? 0) + 1);
    return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  const [newName, setNewName] = useState(getMostFrequentName);
  const [checked, setChecked] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const opt of options) {
      if (opt.currentName !== null && opt.currentName !== getMostFrequentName()) {
        initial.add(opt.containerId);
      }
    }
    return initial;
  });

  useEffect(() => {
    setChecked(() => {
      const next = new Set<string>();
      for (const opt of options) {
        if (opt.currentName === null) continue;
        const alreadyQueued = existingRenames.some((r) => r.containerId === opt.containerId && r.rowKey === rowKey);
        if (!alreadyQueued && opt.currentName !== newName) next.add(opt.containerId);
      }
      return next;
    });
  }, [newName]);

  function toggleCheck(containerId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(containerId)) next.delete(containerId); else next.add(containerId);
      return next;
    });
  }

  const opsToAdd = options.filter((o) => o.currentName !== null && checked.has(o.containerId) && o.currentName !== newName);

  function handleSave() {
    if (!newName.trim() || opsToAdd.length === 0) return;
    onSave(opsToAdd.map((o) => ({ rowKey, category, containerId: o.containerId, containerName: o.containerName, publicId: o.publicId, oldName: o.currentName!, newName: newName.trim() })));
    onClose();
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Nouveau nom standardisé</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all font-mono"
            style={{ borderColor: 'hsl(220 13% 85%)', backgroundColor: 'hsl(220 20% 98%)', color: 'hsl(220 13% 15%)' }}
            placeholder="ex: GA4 — add_to_cart"
            autoFocus
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-foreground">Appliquer à</span>
            <div className="flex items-center gap-2">
              <button onClick={() => { const eligible = options.filter((o) => o.currentName !== null && o.currentName !== newName); setChecked(new Set(eligible.map((o) => o.containerId))); }} className="text-[11px] text-muted-fg hover:text-foreground transition-colors">
                Tout sélectionner
              </button>
              <span className="text-muted-fg opacity-40">·</span>
              <button onClick={() => setChecked(new Set())} className="text-[11px] text-muted-fg hover:text-foreground transition-colors">
                Tout désélectionner
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {options.map((opt) => {
              const isAbsent = opt.currentName === null;
              const alreadyQueued = existingRenames.some((r) => r.containerId === opt.containerId && r.rowKey === rowKey);
              const alreadyCorrect = opt.currentName === newName.trim();
              const isChecked = checked.has(opt.containerId);
              const isDisabled = isAbsent || alreadyQueued || alreadyCorrect;

              return (
                <div
                  key={opt.containerId}
                  onClick={() => !isDisabled && toggleCheck(opt.containerId)}
                  className={clsx('flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all', isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}
                  style={{ borderColor: isChecked && !isDisabled ? categoryColor + '55' : 'hsl(220 13% 91%)', backgroundColor: isChecked && !isDisabled ? categoryColor + '08' : 'white' }}
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all"
                    style={{ borderColor: isChecked && !isDisabled ? categoryColor : 'hsl(220 13% 80%)', backgroundColor: isChecked && !isDisabled ? categoryColor : 'white' }}
                  >
                    {isChecked && !isDisabled && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground truncate">{opt.containerName}</span>
                      <span className="text-[10px] text-muted-fg font-mono shrink-0">{opt.publicId}</span>
                    </div>
                    {isAbsent ? (
                      <span className="text-[11px] text-muted-fg">Tag absent</span>
                    ) : alreadyQueued ? (
                      <span className="text-[11px]" style={{ color: 'hsl(46 90% 45%)' }}>Renommage déjà planifié</span>
                    ) : alreadyCorrect ? (
                      <div className="flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 2.5" stroke="hsl(142 60% 40%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="text-[11px]" style={{ color: 'hsl(142 60% 40%)' }}>Déjà correct</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-mono text-muted-fg truncate max-w-[140px]" title={opt.currentName!}>{opt.currentName}</span>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-muted-fg"><path d="M2.5 5h5M5.5 2.5L8 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="text-[11px] font-mono truncate max-w-[140px]" style={{ color: categoryColor }} title={newName.trim()}>{newName.trim() || '…'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 border-t flex items-center justify-between gap-3 shrink-0" style={{ borderColor: 'hsl(220 13% 91%)' }}>
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border transition-colors text-muted-fg hover:text-foreground" style={{ borderColor: 'hsl(220 13% 85%)' }}>
          Annuler
        </button>
        <button
          disabled={opsToAdd.length === 0 || !newName.trim()}
          onClick={handleSave}
          className={clsx('px-4 py-2 text-sm font-medium rounded-lg transition-all text-white', opsToAdd.length > 0 && newName.trim() ? 'shadow-sm hover:opacity-90' : 'opacity-40 cursor-not-allowed')}
          style={{ backgroundColor: categoryColor }}
        >
          {opsToAdd.length === 0 ? 'Sélectionner des containers' : `Planifier ${opsToAdd.length} renommage${opsToAdd.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </>
  );
}

// ─── TagDrawer ─────────────────────────────────────────────────────────────────

export function TagDrawer({
  rowKey,
  category,
  categoryColor,
  cells,
  containers,
  existingRenames,
  initialTab = 'triggers',
  onSave,
  onClose,
}: TagDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>(initialTab);
  const [removeConfirm, setRemoveConfirm] = useState<RemoveConfirm | null>(null);
  const [syncMode, setSyncMode] = useState(false);
  const { pendingTriggerOps, addTriggerOp, removeTriggerOp } = useGTMStore();

  const triggerInfos = useMemo(() => buildTriggerInfo(containers, cells), [containers, cells]);
  const consistent = triggersConsistent(triggerInfos);
  const presentCount = triggerInfos.filter((i) => i.tagPresent).length;
  const absentCount = triggerInfos.filter((i) => !i.tagPresent).length;

  function queueRemoval(containerId: string, containerName: string, publicId: string, trigger: TriggerEntry) {
    if (!trigger.triggerId) return;
    addTriggerOp({
      kind: 'remove',
      tagRowKey: rowKey,
      tagCategory: category,
      triggerName: trigger.name,
      triggerSemanticKey: trigger.semanticKey,
      steps: [{ containerId, containerName, publicId, unlink: [trigger.triggerId] }],
    });
    setRemoveConfirm(null);
  }

  function handleRemove(containerId: string, containerName: string, publicId: string, trigger: TriggerEntry, isLast: boolean) {
    if (isLast) {
      setRemoveConfirm({ containerId, containerName, publicId, trigger });
    } else {
      queueRemoval(containerId, containerName, publicId, trigger);
    }
  }

  const options: ContainerOption[] = containers.map((c) => ({
    containerId: c.containerId,
    containerName: c.containerName,
    publicId: c.publicId,
    currentName: cells[c.containerId]?.name ?? null,
  }));

  const TABS: { id: DrawerTab; label: string }[] = [
    { id: 'triggers', label: 'Déclencheurs' },
    { id: 'rename',   label: 'Renommer' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'hsl(220 13% 10% / 0.35)' }} onClick={onClose} />

      <div className="fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl overflow-hidden" style={{ width: '520px', backgroundColor: 'white', borderLeft: '1px solid hsl(220 13% 91%)' }}>
        {/* Header */}
        <div className="px-5 pt-4 pb-0 border-b shrink-0" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0"
                  style={{ backgroundColor: categoryColor + '22', color: categoryColor }}
                >
                  {category}
                </span>
                {activeTab === 'triggers' && !consistent && presentCount > 1 && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 50%)' }}>
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 2l5 5M7 2l-5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
                    Déclencheurs différents
                  </span>
                )}
                {activeTab === 'triggers' && consistent && presentCount > 0 && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: 'hsl(142 72% 95%)', color: 'hsl(142 60% 35%)' }}>
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Identiques
                  </span>
                )}
              </div>
              <h2 className="text-sm font-semibold text-foreground font-mono">{rowKey}</h2>
              <p className="text-xs text-muted-fg mt-0.5">
                {presentCount} container{presentCount > 1 ? 's' : ''} avec ce tag
                {absentCount > 0 && <> · <span style={{ color: 'hsl(0 70% 50%)' }}>{absentCount} absent{absentCount > 1 ? 's' : ''}</span></>}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card transition-colors text-muted-fg shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'px-4 py-2 text-xs font-medium rounded-t-lg transition-colors relative',
                  activeTab === tab.id ? 'text-foreground' : 'text-muted-fg hover:text-foreground',
                )}
                style={activeTab === tab.id ? { backgroundColor: 'white', boxShadow: `inset 0 -2px 0 ${categoryColor}` } : {}}
              >
                {tab.label}
                {tab.id === 'triggers' && !consistent && presentCount > 1 && (
                  <span className="ml-1.5 w-1.5 h-1.5 rounded-full inline-block align-middle" style={{ backgroundColor: 'hsl(0 70% 55%)' }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {syncMode ? (
          <SyncPlanView
            infos={triggerInfos}
            containers={containers}
            rowKey={rowKey}
            category={category}
            onPlan={(steps, refContainerId, refContainerName) => {
              addTriggerOp({
                kind: 'sync',
                tagRowKey: rowKey,
                tagCategory: category,
                referenceContainerId: refContainerId,
                referenceContainerName: refContainerName,
                steps,
              });
              setSyncMode(false);
            }}
            onBack={() => setSyncMode(false)}
          />
        ) : activeTab === 'triggers' ? (
          <TriggersTab
            infos={triggerInfos}
            consistent={consistent}
            pendingTriggerOps={pendingTriggerOps}
            tagRowKey={rowKey}
            containers={containers}
            onRemove={handleRemove}
            onCancelOp={removeTriggerOp}
            onSync={() => setSyncMode(true)}
          />
        ) : (
          <RenameTab
            rowKey={rowKey}
            category={category}
            categoryColor={categoryColor}
            options={options}
            existingRenames={existingRenames}
            onSave={onSave}
            onClose={onClose}
          />
        )}

        {/* Confirmation — dernier déclencheur */}
        {removeConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ backgroundColor: 'hsl(220 13% 10% / 0.5)' }}>
            <div className="mx-5 rounded-xl border shadow-xl p-5 max-w-sm w-full" style={{ backgroundColor: 'white', borderColor: 'hsl(220 13% 88%)' }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'hsl(0 85% 97%)' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v4.5M7 9v.5" stroke="hsl(0 70% 50%)" strokeWidth="1.5" strokeLinecap="round"/><circle cx="7" cy="7" r="6" stroke="hsl(0 70% 50%)" strokeWidth="1.25"/></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Dernier déclencheur</p>
                  <p className="text-xs text-muted-fg mt-0.5">
                    Retirer <span className="font-mono font-medium" style={{ color: 'hsl(220 13% 20%)' }}>{removeConfirm.trigger.name}</span> désactivera le tag dans <span className="font-medium">{removeConfirm.containerName}</span> — il ne se déclenchera plus.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRemoveConfirm(null)}
                  className="flex-1 px-3 py-2 text-xs rounded-lg border transition-colors text-muted-fg hover:text-foreground"
                  style={{ borderColor: 'hsl(220 13% 85%)' }}
                >
                  Annuler
                </button>
                <button
                  onClick={() => queueRemoval(removeConfirm.containerId, removeConfirm.containerName, removeConfirm.publicId, removeConfirm.trigger)}
                  className="flex-1 px-3 py-2 text-xs font-medium rounded-lg text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: 'hsl(0 70% 50%)' }}
                >
                  Confirmer le retrait
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
