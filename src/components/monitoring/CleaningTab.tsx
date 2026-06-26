import { useState, useMemo } from 'react';
import type { MonitoringContainerData } from '../../data/monitoring-mock';
import type { GTMTrigger, GTMVariable, GTMParameter } from '../../types/gtm';
import { useGTMStore } from '../../store/gtm-store';

// ─── Orphan detection ──────────────────────────────────────────────────────────

function findOrphanTriggers(container: MonitoringContainerData): GTMTrigger[] {
  const usedIds = new Set<string>();
  for (const tag of container.tags) {
    for (const id of tag.firingTriggerId ?? []) usedIds.add(id);
    for (const id of tag.blockingTriggerId ?? []) usedIds.add(id);
  }
  return container.triggers.filter((tr) => tr.triggerId && !usedIds.has(tr.triggerId));
}

function scanParamValues(params: GTMParameter[] | undefined, out: Set<string>) {
  for (const p of params ?? []) {
    if (p.value) {
      const re = /\{\{([^}]+)\}\}/g;
      let m;
      while ((m = re.exec(p.value)) !== null) out.add(m[1]);
    }
    if (p.list) scanParamValues(p.list, out);
    if (p.map) scanParamValues(p.map, out);
  }
}

function findOrphanVariables(container: MonitoringContainerData): GTMVariable[] {
  const usedNames = new Set<string>();
  for (const tag of container.tags) scanParamValues(tag.parameter, usedNames);
  for (const tr of container.triggers) {
    scanParamValues(tr.parameter, usedNames);
    for (const f of tr.filter ?? []) scanParamValues(f.parameter, usedNames);
    for (const f of tr.customEventFilter ?? []) scanParamValues(f.parameter, usedNames);
  }
  for (const v of container.variables) scanParamValues(v.parameter, usedNames);
  return container.variables.filter((v) => !usedNames.has(v.name));
}

// ─── Sub-types ─────────────────────────────────────────────────────────────────

interface OrphanItem {
  containerId: string;
  containerName: string;
  publicId: string;
  kind: 'trigger' | 'variable';
  name: string;
  type: string;
  entityId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CleaningTab({ containers }: { containers: MonitoringContainerData[] }) {
  const { pendingDeletions, addDeletions, cancelDeletion, removeDeletion, clearDeletions } = useGTMStore();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState<'triggers' | 'variables'>('triggers');

  // Collect orphans across all containers
  const { orphanTriggers, orphanVariables } = useMemo(() => {
    const triggers: OrphanItem[] = [];
    const variables: OrphanItem[] = [];
    for (const c of containers) {
      for (const tr of findOrphanTriggers(c)) {
        triggers.push({ containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, kind: 'trigger', name: tr.name, type: tr.type, entityId: tr.triggerId });
      }
      for (const v of findOrphanVariables(c)) {
        variables.push({ containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, kind: 'variable', name: v.name, type: v.type });
      }
    }
    return { orphanTriggers: triggers, orphanVariables: variables };
  }, [containers]);

  const activeItems = activeSection === 'triggers' ? orphanTriggers : orphanVariables;

  // Already-queued set for dedup display
  const queuedKeys = new Set(
    pendingDeletions
      .filter((op) => op.status === 'pending')
      .map((op) => `${op.containerId}::${op.kind}::${op.entityName}`),
  );

  function itemKey(item: OrphanItem) {
    return `${item.containerId}::${item.kind}::${item.name}`;
  }

  function toggleItem(item: OrphanItem) {
    const k = itemKey(item);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  function toggleAll() {
    const plannable = activeItems.filter((it) => !queuedKeys.has(itemKey(it)));
    const allSelected = plannable.every((it) => selected.has(itemKey(it)));
    if (allSelected) {
      setSelected((prev) => { const n = new Set(prev); plannable.forEach((it) => n.delete(itemKey(it))); return n; });
    } else {
      setSelected((prev) => { const n = new Set(prev); plannable.forEach((it) => n.add(itemKey(it))); return n; });
    }
  }

  function planSelected() {
    const ops = activeItems
      .filter((it) => selected.has(itemKey(it)) && !queuedKeys.has(itemKey(it)))
      .map((it) => ({
        kind: it.kind,
        containerId: it.containerId,
        containerName: it.containerName,
        publicId: it.publicId,
        entityName: it.name,
        entityType: it.type,
        entityId: it.entityId,
      }));
    if (ops.length === 0) return;
    addDeletions(ops);
    setSelected(new Set());
  }

  const selectedCount = activeItems.filter((it) => selected.has(itemKey(it)) && !queuedKeys.has(itemKey(it))).length;

  // History
  const history = pendingDeletions.filter((op) => op.status !== 'pending');
  const pending = pendingDeletions.filter((op) => op.status === 'pending');

  // Group active items by container
  const byContainer = useMemo(() => {
    const map = new Map<string, OrphanItem[]>();
    for (const item of activeItems) {
      const list = map.get(item.containerId) ?? [];
      list.push(item);
      map.set(item.containerId, list);
    }
    return map;
  }, [activeItems]);

  const TRIGGER_TYPE_LABELS: Record<string, string> = {
    pageview: 'Page Vue', domReady: 'DOM Ready', windowLoaded: 'Window Loaded',
    customEvent: 'Custom Event', click: 'Clic', linkClick: 'Lien', scrollDepth: 'Scroll',
  };
  const VARIABLE_TYPE_LABELS: Record<string, string> = {
    v: 'Data Layer', c: 'Constante', jsm: 'Custom JS', u: 'URL', k: 'Cookie', aev: 'Auto-Event',
  };

  function typeLabel(kind: 'trigger' | 'variable', type: string) {
    return kind === 'trigger'
      ? (TRIGGER_TYPE_LABELS[type] ?? type)
      : (VARIABLE_TYPE_LABELS[type] ?? type);
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

      {/* Section tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveSection('triggers')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
          style={activeSection === 'triggers'
            ? { backgroundColor: 'hsl(267 100% 59%)', color: 'white', borderColor: 'transparent' }
            : { borderColor: 'hsl(220 13% 88%)', color: 'hsl(220 13% 45%)' }}
        >
          Déclencheurs
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={activeSection === 'triggers'
              ? { backgroundColor: 'white', color: 'hsl(267 80% 50%)' }
              : { backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 45%)' }}>
            {orphanTriggers.length}
          </span>
        </button>
        <button
          onClick={() => setActiveSection('variables')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
          style={activeSection === 'variables'
            ? { backgroundColor: 'hsl(267 100% 59%)', color: 'white', borderColor: 'transparent' }
            : { borderColor: 'hsl(220 13% 88%)', color: 'hsl(220 13% 45%)' }}
        >
          Variables
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={activeSection === 'variables'
              ? { backgroundColor: 'white', color: 'hsl(267 80% 50%)' }
              : { backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 45%)' }}>
            {orphanVariables.length}
          </span>
        </button>
        <div className="flex-1" />
        {activeItems.length > 0 && (
          <button onClick={toggleAll} className="text-xs text-muted-fg hover:text-foreground transition-colors underline decoration-dotted">
            {activeItems.filter(it => !queuedKeys.has(itemKey(it))).every(it => selected.has(itemKey(it)))
              ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
        )}
      </div>

      {/* Empty state */}
      {activeItems.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-fg">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" opacity=".4"/>
            <path d="M10 16l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-sm font-medium">Aucun {activeSection === 'triggers' ? 'déclencheur' : 'variable'} orphelin</p>
          <p className="text-xs opacity-60">Tous les {activeSection === 'triggers' ? 'déclencheurs' : 'variables'} sont référencés</p>
        </div>
      )}

      {/* Items grouped by container */}
      {[...byContainer.entries()].map(([cid, items]) => (
        <div key={cid} className="rounded-xl border overflow-hidden" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          <div className="px-3.5 py-2.5 flex items-center gap-2" style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
            <span className="text-xs font-semibold text-foreground">{items[0].containerName}</span>
            <span className="font-mono text-[10px] text-muted-fg">{items[0].publicId}</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: 'hsl(0 85% 96%)', color: 'hsl(0 65% 50%)' }}>
              {items.length} orphelin{items.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y" style={{ divideColor: 'hsl(220 13% 93%)', backgroundColor: 'white' }}>
            {items.map((item) => {
              const k = itemKey(item);
              const isQueued = queuedKeys.has(k);
              const isSel = selected.has(k);
              return (
                <div key={k} className="px-3.5 py-2 flex items-center gap-2.5"
                  style={{ backgroundColor: isQueued ? 'hsl(38 100% 98%)' : undefined }}>
                  {!isQueued && (
                    <input type="checkbox" checked={isSel} onChange={() => toggleItem(item)}
                      className="rounded shrink-0" style={{ accentColor: 'hsl(267 100% 59%)' }} />
                  )}
                  {isQueued && (
                    <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="5" stroke="hsl(38 80% 55%)" strokeWidth="1.25"/>
                        <path d="M6 3.5v2.5M6 8v.25" stroke="hsl(38 80% 55%)" strokeWidth="1.25" strokeLinecap="round"/>
                      </svg>
                    </div>
                  )}
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider shrink-0"
                    style={{ backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 45%)' }}>
                    {typeLabel(item.kind, item.type)}
                  </span>
                  <span className="text-[11px] font-mono flex-1 truncate" style={{ color: 'hsl(220 13% 20%)' }}>{item.name}</span>
                  {isQueued && (
                    <span className="text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: 'hsl(38 90% 50% / 0.15)', color: 'hsl(35 80% 35%)' }}>
                      Planifié
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Plan button */}
      {selectedCount > 0 && (
        <div className="sticky bottom-0 pt-3 pb-1">
          <button
            onClick={planSelected}
            className="w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 shadow-lg"
            style={{ backgroundColor: 'hsl(0 70% 50%)' }}
          >
            Planifier la suppression de {selectedCount} entité{selectedCount > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* History section */}
      {(pending.length > 0 || history.length > 0) && (
        <div className="border-t pt-4 space-y-2" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground">
              Suppressions planifiées{pending.length > 0 ? ` · ${pending.length} en attente` : ''}
            </h3>
            {history.length > 0 && (
              <button onClick={() => history.forEach((op) => removeDeletion(op.id))}
                className="text-[10px] text-muted-fg hover:text-foreground underline decoration-dotted">
                Effacer l'historique
              </button>
            )}
          </div>
          {[...pending, ...history].map((op) => (
            <div key={op.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border text-[11px]"
              style={{
                borderColor: op.status === 'pending' ? 'hsl(0 70% 80%)' : 'hsl(220 13% 91%)',
                backgroundColor: op.status === 'pending' ? 'hsl(0 85% 98%)' : op.status === 'cancelled' ? 'hsl(220 20% 97%)' : 'hsl(142 72% 97%)',
                opacity: op.status === 'cancelled' ? 0.6 : 1,
              }}>
              <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                style={{ backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 45%)' }}>
                {op.kind === 'trigger' ? 'Décl.' : 'Var.'}
              </span>
              <span className="font-mono flex-1 truncate" style={{ color: 'hsl(220 13% 25%)' }}>{op.entityName}</span>
              <span className="text-muted-fg shrink-0">{op.containerName}</span>
              {op.status === 'pending' ? (
                <button onClick={() => cancelDeletion(op.id)}
                  className="text-[10px] px-1.5 py-0.5 rounded transition-colors hover:opacity-70 shrink-0"
                  style={{ backgroundColor: 'hsl(0 85% 96%)', color: 'hsl(0 65% 50%)' }}>
                  Annuler
                </button>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: op.status === 'cancelled' ? 'hsl(220 13% 91%)' : 'hsl(142 60% 93%)', color: op.status === 'cancelled' ? 'hsl(220 13% 45%)' : 'hsl(142 50% 30%)' }}>
                  {op.status === 'cancelled' ? 'Annulée' : 'Effectuée'}
                </span>
              )}
            </div>
          ))}
          {pending.length > 0 && (
            <div className="flex gap-2">
              <button onClick={() => { pending.forEach((op) => cancelDeletion(op.id)); }}
                className="flex-1 py-1.5 text-xs rounded-lg border text-muted-fg hover:text-foreground"
                style={{ borderColor: 'hsl(220 13% 85%)' }}>
                Tout annuler
              </button>
              <button disabled
                className="flex-1 py-1.5 text-xs font-medium rounded-lg text-white opacity-40 cursor-not-allowed"
                style={{ backgroundColor: 'hsl(0 70% 50%)' }}
                title="Nécessite GCP OAuth">
                Appliquer (OAuth requis)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
