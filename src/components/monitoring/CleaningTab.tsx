import { useState, useMemo, useRef, useEffect } from 'react';
import type { MonitoringContainerData } from '../../data/monitoring-mock';
import type { GTMTrigger, GTMVariable, GTMParameter } from '../../types/gtm';
import { useGTMStore } from '../../store/gtm-store';
import { useAuthStore } from '../../store/auth-store';

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
  kind: 'trigger' | 'variable' | 'tag';
  name: string;
  type: string;
  entityId?: string;
}

function allTagsAsItems(container: MonitoringContainerData): OrphanItem[] {
  return container.tags.map((tag) => ({
    containerId: container.containerId,
    containerName: container.containerName,
    publicId: container.publicId,
    kind: 'tag' as const,
    name: tag.name,
    type: tag.type,
    entityId: tag.tagId,
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CleaningTab({ containers }: { containers: MonitoringContainerData[] }) {
  const { pendingDeletions, addDeletions, cancelDeletion, removeDeletion, applyDeletions, isApplyingDeletions, applyPublishErrors } = useGTMStore();
  const { accessToken } = useAuthStore();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState<'triggers' | 'variables' | 'tags'>('triggers');
  const [tagSearch, setTagSearch] = useState('');

  // Confirmation modal
  const [showConfirm, setShowConfirm] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [versionDesc, setVersionDesc] = useState('');

  // Completion notification
  const [notif, setNotif] = useState<string | null>(null);
  const [errorNotif, setErrorNotif] = useState<string | null>(null);
  const prevApplying = useRef(false);
  useEffect(() => {
    if (prevApplying.current && !isApplyingDeletions) {
      const applied = pendingDeletions.filter((op) => op.status === 'applied').length;
      if (applyPublishErrors.length > 0) {
        const names = applyPublishErrors.map((e) => e.containerName).join(', ');
        // Extract short error (GTM API 400/403 messages are verbose)
        const firstErr = applyPublishErrors[0].error;
        const shortErr = firstErr.length > 120 ? firstErr.slice(0, 117) + '...' : firstErr;
        setErrorNotif(`Publication échouée sur ${applyPublishErrors.length} container${applyPublishErrors.length > 1 ? 's' : ''} (${names}) — ${shortErr}`);
      } else if (applied > 0) {
        setNotif(`${applied} suppression${applied > 1 ? 's' : ''} appliquée${applied > 1 ? 's' : ''} et publiée${applied > 1 ? 's' : ''}`);
        const t = setTimeout(() => setNotif(null), 6000);
        return () => clearTimeout(t);
      }
    }
    prevApplying.current = isApplyingDeletions;
  }, [isApplyingDeletions, pendingDeletions, applyPublishErrors]);

  // Collect orphans across all containers
  const { orphanTriggers, orphanVariables, allTags } = useMemo(() => {
    const triggers: OrphanItem[] = [];
    const variables: OrphanItem[] = [];
    const tags: OrphanItem[] = [];
    for (const c of containers) {
      for (const tr of findOrphanTriggers(c)) {
        triggers.push({ containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, kind: 'trigger', name: tr.name, type: tr.type, entityId: tr.triggerId });
      }
      for (const v of findOrphanVariables(c)) {
        variables.push({ containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, kind: 'variable', name: v.name, type: v.type, entityId: v.variableId });
      }
      tags.push(...allTagsAsItems(c));
    }
    return { orphanTriggers: triggers, orphanVariables: variables, allTags: tags };
  }, [containers]);

  const filteredTags = tagSearch.trim()
    ? allTags.filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()) || t.type.toLowerCase().includes(tagSearch.toLowerCase()))
    : allTags;

  const activeItems = activeSection === 'triggers' ? orphanTriggers : activeSection === 'variables' ? orphanVariables : filteredTags;

  // Already-queued set for dedup display — memoized so byContainer can depend on it
  const queuedKeys = useMemo(
    () => new Set(
      pendingDeletions
        .filter((op) => op.status === 'pending')
        .map((op) => `${op.containerId}::${op.kind}::${op.entityName}`),
    ),
    [pendingDeletions],
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

  function toggleContainerGroup(items: OrphanItem[]) {
    const plannable = items.filter((it) => !queuedKeys.has(itemKey(it)));
    const allSel = plannable.every((it) => selected.has(itemKey(it)));
    setSelected((prev) => {
      const n = new Set(prev);
      if (allSel) plannable.forEach((it) => n.delete(itemKey(it)));
      else plannable.forEach((it) => n.add(itemKey(it)));
      return n;
    });
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

  function buildDefaultVersionName(): string {
    const kinds = { variable: 0, trigger: 0, tag: 0 };
    for (const op of pending) kinds[op.kind as keyof typeof kinds]++;
    const parts: string[] = [];
    if (kinds.variable > 0) parts.push(`${kinds.variable} variable${kinds.variable > 1 ? 's' : ''}`);
    if (kinds.trigger > 0) parts.push(`${kinds.trigger} déclencheur${kinds.trigger > 1 ? 's' : ''}`);
    if (kinds.tag > 0) parts.push(`${kinds.tag} tag${kinds.tag > 1 ? 's' : ''}`);
    return `Nettoyage — ${parts.join(', ')}`;
  }

  function buildDefaultDescription(): string {
    const byC = new Map<string, { name: string; variable: number; trigger: number; tag: number }>();
    for (const op of pending) {
      if (!byC.has(op.containerId)) byC.set(op.containerId, { name: op.containerName, variable: 0, trigger: 0, tag: 0 });
      byC.get(op.containerId)![op.kind as 'variable' | 'trigger' | 'tag']++;
    }
    return [...byC.values()].map(({ name, variable, trigger, tag }) => {
      const parts: string[] = [];
      if (variable > 0) parts.push(`${variable} variable${variable > 1 ? 's' : ''} orpheline${variable > 1 ? 's' : ''}`);
      if (trigger > 0) parts.push(`${trigger} déclencheur${trigger > 1 ? 's' : ''} orphelin${trigger > 1 ? 's' : ''}`);
      if (tag > 0) parts.push(`${tag} tag${tag > 1 ? 's' : ''}`);
      return `${name} : suppression de ${parts.join(', ')}`;
    }).join('\n');
  }

  function openConfirmModal() {
    setVersionName(buildDefaultVersionName());
    setVersionDesc(buildDefaultDescription());
    setShowConfirm(true);
  }

  // Group active items by container — hide already-queued items (they're in "Suppressions planifiées")
  const byContainer = useMemo(() => {
    const map = new Map<string, OrphanItem[]>();
    for (const item of activeItems) {
      if (queuedKeys.has(itemKey(item))) continue;
      const list = map.get(item.containerId) ?? [];
      list.push(item);
      map.set(item.containerId, list);
    }
    return map;
  }, [activeItems, queuedKeys]);

  const TRIGGER_TYPE_LABELS: Record<string, string> = {
    pageview: 'Page Vue', domReady: 'DOM Ready', windowLoaded: 'Window Loaded',
    customEvent: 'Custom Event', click: 'Clic', linkClick: 'Lien', scrollDepth: 'Scroll',
  };
  const VARIABLE_TYPE_LABELS: Record<string, string> = {
    v: 'Data Layer', c: 'Constante', jsm: 'Custom JS', u: 'URL', k: 'Cookie', aev: 'Auto-Event',
  };

  const TAG_TYPE_LABELS: Record<string, string> = {
    gaawc: 'GA4 Config', gaawe: 'GA4 Event', html: 'HTML', awct: 'Google Ads', flc: 'Floodlight',
  };

  function typeLabel(kind: 'trigger' | 'variable' | 'tag', type: string) {
    if (kind === 'trigger') return TRIGGER_TYPE_LABELS[type] ?? type;
    if (kind === 'variable') return VARIABLE_TYPE_LABELS[type] ?? type;
    return TAG_TYPE_LABELS[type] ?? type;
  }

  return (
    <>
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

      {/* Section tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ['triggers', 'Déclencheurs orphelins', orphanTriggers.length],
          ['variables', 'Variables orphelines', orphanVariables.length],
          ['tags', 'Tags', allTags.length],
        ] as const).map(([s, label, count]) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
            style={activeSection === s
              ? { backgroundColor: s === 'tags' ? 'hsl(0 70% 50%)' : 'hsl(267 100% 59%)', color: 'white', borderColor: 'transparent' }
              : { borderColor: 'hsl(220 13% 88%)', color: 'hsl(220 13% 45%)' }}
          >
            {label}
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
              style={activeSection === s
                ? { backgroundColor: 'white', color: s === 'tags' ? 'hsl(0 60% 45%)' : 'hsl(267 80% 50%)' }
                : { backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 45%)' }}>
              {count}
            </span>
          </button>
        ))}
        <div className="flex-1" />
        {activeItems.length > 0 && (
          <button onClick={toggleAll} className="text-xs text-muted-fg hover:text-foreground transition-colors underline decoration-dotted">
            {activeItems.filter(it => !queuedKeys.has(itemKey(it))).every(it => selected.has(itemKey(it)))
              ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
        )}
        {pending.length > 0 && (
          <button
            onClick={() => { openConfirmModal(); }}
            disabled={!accessToken || isApplyingDeletions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
            style={{ backgroundColor: 'hsl(0 70% 50%)', opacity: (!accessToken || isApplyingDeletions) ? 0.5 : 1, cursor: (!accessToken || isApplyingDeletions) ? 'not-allowed' : undefined }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M5.5 1v6M3 4.5l2.5 2.5 2.5-2.5M1.5 8.5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Supprimer et publier ({pending.length})
          </button>
        )}
      </div>

      {/* Tag search */}
      {activeSection === 'tags' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: 'hsl(220 13% 88%)', backgroundColor: 'hsl(220 20% 98%)' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted-fg shrink-0"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.1"/><path d="M9 9l2 2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
          <input
            type="text"
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            placeholder="Filtrer par nom ou type de tag..."
            className="flex-1 text-xs bg-transparent outline-none"
            style={{ color: 'hsl(220 13% 20%)' }}
          />
          {tagSearch && (
            <button onClick={() => setTagSearch('')} className="text-muted-fg hover:text-foreground transition-colors text-[10px]">Effacer</button>
          )}
        </div>
      )}

      {/* Empty state */}
      {activeItems.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-fg">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" opacity=".4"/>
            <path d="M10 16l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-sm font-medium">
            {activeSection === 'tags' ? 'Aucun tag trouvé' : `Aucun ${activeSection === 'triggers' ? 'déclencheur' : 'variable'} orphelin`}
          </p>
          <p className="text-xs opacity-60">
            {activeSection === 'tags' ? 'Modifiez le filtre de recherche' : `Tous les ${activeSection === 'triggers' ? 'déclencheurs' : 'variables'} sont référencés`}
          </p>
        </div>
      )}

      {/* Items grouped by container */}
      {[...byContainer.entries()].map(([cid, items]) => (
        <div key={cid} className="rounded-xl border overflow-hidden" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          <div className="px-3.5 py-2.5 flex items-center gap-2.5" style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
            {(() => {
              const plannable = items.filter((it) => !queuedKeys.has(itemKey(it)));
              const allSel = plannable.length > 0 && plannable.every((it) => selected.has(itemKey(it)));
              const someSel = plannable.some((it) => selected.has(itemKey(it)));
              return (
                <input
                  type="checkbox"
                  checked={allSel}
                  ref={(el) => { if (el) el.indeterminate = someSel && !allSel; }}
                  onChange={() => toggleContainerGroup(items)}
                  className="rounded cursor-pointer shrink-0"
                  style={{ accentColor: 'hsl(267 100% 59%)' }}
                  title={`Sélectionner tout — ${items[0].containerName}`}
                />
              );
            })()}
            <span className="text-xs font-semibold text-foreground">{items[0].containerName}</span>
            <span className="font-mono text-[10px] text-muted-fg">{items[0].publicId}</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={activeSection === 'tags'
                ? { backgroundColor: 'hsl(220 13% 93%)', color: 'hsl(220 13% 40%)' }
                : { backgroundColor: 'hsl(0 85% 96%)', color: 'hsl(0 65% 50%)' }}>
              {items.length} {activeSection === 'tags' ? 'tag' : 'orphelin'}{items.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-border" style={{ backgroundColor: 'white' }}>
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
            Planifier la suppression de {selectedCount} {activeSection === 'tags' ? 'tag' : 'entité'}{selectedCount > 1 ? 's' : ''}
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
                {op.kind === 'trigger' ? 'Décl.' : op.kind === 'variable' ? 'Var.' : 'Tag'}
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
              <button
                onClick={() => { openConfirmModal(); }}
                disabled={!accessToken || isApplyingDeletions}
                className="flex-1 py-1.5 text-xs font-medium rounded-lg text-white transition-all"
                style={{ backgroundColor: 'hsl(0 70% 50%)', opacity: (!accessToken || isApplyingDeletions) ? 0.5 : 1, cursor: (!accessToken || isApplyingDeletions) ? 'not-allowed' : undefined }}
              >
                Supprimer et publier ({pending.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>

      {/* ── Confirmation modal ──────────────────────────────────────────────── */}
      {showConfirm && (() => {
        const byC = new Map<string, typeof pending>();
        for (const op of pending) {
          const list = byC.get(op.containerId) ?? [];
          list.push(op);
          byC.set(op.containerId, list);
        }
        const containerCount = byC.size;

        const KIND_LABEL: Record<string, string> = { variable: 'Variable', trigger: 'Déclencheur', tag: 'Tag' };
        const KIND_COLOR: Record<string, string> = {
          variable: 'hsl(213 94% 55%)',
          trigger: 'hsl(267 100% 59%)',
          tag: 'hsl(0 70% 50%)',
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: 640, maxHeight: '88vh' }}>

              {/* Header */}
              <div className="px-6 py-5 border-b" style={{ borderColor: 'hsl(220 13% 91%)' }}>
                <h2 className="text-sm font-semibold text-foreground">Publier les modifications</h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {[...byC.entries()].map(([cid, ops]) => (
                    <span key={cid} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border"
                      style={{ backgroundColor: 'hsl(220 13% 97%)', borderColor: 'hsl(220 13% 88%)', color: 'hsl(220 13% 25%)' }}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'hsl(267 100% 59%)' }} />
                      {ops[0].containerName}
                      <span className="font-mono opacity-55 text-[10px]">{ops[0].publicId}</span>
                      <span className="px-1 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: 'hsl(0 85% 96%)', color: 'hsl(0 65% 50%)' }}>
                        −{ops.length}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

                {/* Unified table grouped by container */}
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'hsl(220 13% 91%)' }}>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
                        <th className="px-3 py-2 text-left font-semibold border-b border-r" style={{ borderColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 40%)', width: '28%' }}>Container</th>
                        <th className="px-3 py-2 text-left font-semibold border-b border-r" style={{ borderColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 40%)', width: '16%' }}>Type</th>
                        <th className="px-3 py-2 text-left font-semibold border-b border-r" style={{ borderColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 40%)' }}>Nom</th>
                        <th className="px-3 py-2 text-center font-semibold border-b" style={{ borderColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 40%)', width: '100px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...byC.entries()].map(([, ops], ci) => (
                        ops.map((op, oi) => (
                          <tr key={op.id} style={{ backgroundColor: ci % 2 === 0 ? 'white' : 'hsl(220 20% 99%)' }}>
                            {/* Container cell — only on first row of group */}
                            {oi === 0 ? (
                              <td rowSpan={ops.length} className="px-3 py-2 border-b border-r align-top" style={{ borderColor: 'hsl(220 13% 91%)' }}>
                                <div className="font-semibold" style={{ color: 'hsl(220 13% 15%)' }}>{op.containerName}</div>
                                <div className="font-mono text-[10px] mt-0.5" style={{ color: 'hsl(220 13% 55%)' }}>{op.publicId}</div>
                              </td>
                            ) : null}
                            <td className="px-3 py-1.5 border-b border-r" style={{ borderColor: 'hsl(220 13% 91%)' }}>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={{ backgroundColor: KIND_COLOR[op.kind] + '18', color: KIND_COLOR[op.kind] }}>
                                {KIND_LABEL[op.kind]}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 border-b border-r font-mono" style={{ borderColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 18%)' }}>
                              <span className="truncate block max-w-xs" title={op.entityName}>{op.entityName}</span>
                            </td>
                            <td className="px-3 py-1.5 border-b text-center" style={{ borderColor: 'hsl(220 13% 91%)' }}>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={{ backgroundColor: 'hsl(0 85% 96%)', color: 'hsl(0 65% 50%)' }}>
                                <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4h5M4 1.5L6.5 4 4 6.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                Supprimé
                              </span>
                            </td>
                          </tr>
                        ))
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Version name */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium flex items-center gap-1" style={{ color: 'hsl(220 13% 35%)' }}>
                    Nom de la version GTM
                    <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'hsl(0 85% 96%)', color: 'hsl(0 65% 50%)' }}>obligatoire</span>
                  </label>
                  <input
                    type="text"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg border text-xs outline-none transition-all"
                    style={{ borderColor: versionName ? 'hsl(267 100% 59%)' : 'hsl(220 13% 85%)', color: 'hsl(220 13% 15%)' }}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium" style={{ color: 'hsl(220 13% 35%)' }}>
                    Description <span style={{ color: 'hsl(220 13% 60%)' }}>(optionnel)</span>
                  </label>
                  <textarea
                    value={versionDesc}
                    onChange={(e) => setVersionDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border text-xs outline-none resize-none transition-all font-mono"
                    style={{ borderColor: 'hsl(220 13% 85%)', color: 'hsl(220 13% 15%)' }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 flex items-center gap-3 border-t" style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)' }}>
                <span className="text-[11px] flex-1" style={{ color: 'hsl(220 13% 50%)' }}>
                  {pending.length} entité{pending.length > 1 ? 's' : ''} · {containerCount} container{containerCount > 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-5 py-2 text-xs rounded-xl border transition-colors hover:bg-gray-50"
                  style={{ borderColor: 'hsl(220 13% 85%)', color: 'hsl(220 13% 40%)' }}
                >
                  Annuler
                </button>
                <button
                  disabled={!versionName.trim()}
                  onClick={() => {
                    if (!versionName.trim()) return;
                    if (!accessToken) { setErrorNotif('Session GTM expirée ou absente — reconnecte-toi puis réessaie.'); return; }
                    setShowConfirm(false);
                    applyDeletions(accessToken, { versionName: versionName.trim(), description: versionDesc.trim() });
                  }}
                  className="px-5 py-2 text-xs font-semibold rounded-xl text-white transition-all"
                  style={{ backgroundColor: 'hsl(0 70% 50%)', opacity: !versionName.trim() ? 0.45 : 1, cursor: !versionName.trim() ? 'not-allowed' : undefined }}
                >
                  Supprimer et publier
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Floating progress indicator ─────────────────────────────────────── */}
      {isApplyingDeletions && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs"
          style={{ backgroundColor: 'white', borderColor: 'hsl(220 13% 91%)', minWidth: 220 }}>
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'hsl(267 100% 59%)' }} />
            <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: 'hsl(267 100% 59%)' }} />
          </span>
          <span style={{ color: 'hsl(220 13% 25%)' }}>Application et publication en cours...</span>
        </div>
      )}

      {/* ── Completion notification ─────────────────────────────────────────── */}
      {notif && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs"
          style={{ backgroundColor: 'hsl(142 72% 97%)', borderColor: 'hsl(142 60% 80%)', minWidth: 220, maxWidth: 400 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'hsl(142 50% 40%)', flexShrink: 0 }}>
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.25"/>
            <path d="M4.5 7l2 2L9.5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ color: 'hsl(142 50% 25%)' }}>{notif}</span>
          <button onClick={() => setNotif(null)} className="ml-auto shrink-0" style={{ color: 'hsl(142 40% 50%)' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
          </button>
        </div>
      )}

      {/* ── Publish error notification ──────────────────────────────────────── */}
      {errorNotif && (
        <div className="fixed bottom-6 right-6 z-40 flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs"
          style={{ backgroundColor: 'hsl(0 72% 97%)', borderColor: 'hsl(0 60% 80%)', minWidth: 260, maxWidth: 440 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'hsl(0 60% 45%)', flexShrink: 0, marginTop: 1 }}>
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.25"/>
            <path d="M7 4.5v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
          </svg>
          <span style={{ color: 'hsl(0 50% 25%)', lineHeight: 1.5 }}>{errorNotif}</span>
          <button onClick={() => setErrorNotif(null)} className="ml-auto shrink-0 mt-0.5" style={{ color: 'hsl(0 40% 50%)' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
          </button>
        </div>
      )}
    </>
  );
}
