import { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import type { MonitoringContainerData } from '../../data/monitoring-mock';
import type { RenameOperation, GTMTrigger } from '../../types/gtm';

// ─── Types ─────────────────────────────────────────────────────────────────────

type DrawerTab = 'triggers' | 'rename';

interface TriggerEntry {
  name: string;
  type: string;
  semanticKey: string;
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
      return tr ? [{ name: tr.name, type: tr.type, semanticKey: triggerSemanticKey(tr) }] : [];
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

// ─── Triggers tab ──────────────────────────────────────────────────────────────

function TriggersTab({ infos, consistent }: { infos: ContainerTriggerInfo[]; consistent: boolean }) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
      {infos.map((info) => {
        const isInconsistent = !consistent && info.tagPresent;
        return (
          <div
            key={info.containerId}
            className="rounded-xl border overflow-hidden"
            style={{
              borderColor: !info.tagPresent
                ? 'hsl(220 13% 88%)'
                : isInconsistent
                ? 'hsl(0 70% 80%)'
                : 'hsl(142 60% 70%)',
            }}
          >
            <div
              className="px-3.5 py-2.5 flex items-center justify-between"
              style={{
                backgroundColor: !info.tagPresent
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
              {info.tagPresent && info.tagName && (
                <span className="text-[10px] font-mono truncate max-w-[160px]" style={{ color: 'hsl(220 13% 50%)' }} title={info.tagName}>
                  {info.tagName}
                </span>
              )}
            </div>
            <div className="px-3.5 py-2.5" style={{ backgroundColor: 'white' }}>
              {!info.tagPresent ? (
                <span className="text-[11px] italic" style={{ color: 'hsl(220 13% 55%)' }}>Tag absent dans ce container</span>
              ) : info.triggers.length === 0 ? (
                <span className="text-[11px] italic" style={{ color: 'hsl(0 70% 55%)' }}>Aucun déclencheur lié</span>
              ) : (
                <div className="space-y-1.5">
                  {info.triggers.map((tr, i) => {
                    const label = TRIGGER_TYPE_LABELS[tr.type] ?? tr.type;
                    const isPageview = tr.type === 'pageview';
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider shrink-0"
                          style={{
                            backgroundColor: isPageview ? 'hsl(0 85% 96%)' : 'hsl(220 13% 91%)',
                            color: isPageview ? 'hsl(0 70% 50%)' : 'hsl(220 13% 45%)',
                          }}
                        >
                          {label}
                        </span>
                        <span className="text-[11px] font-mono" style={{ color: isPageview ? 'hsl(0 70% 45%)' : 'hsl(220 13% 20%)' }}>
                          {tr.name}
                        </span>
                        {isPageview && (
                          <span className="text-[10px] font-medium px-1 py-0.5 rounded" style={{ backgroundColor: 'hsl(0 85% 96%)', color: 'hsl(0 70% 45%)' }}>
                            Toutes les pages
                          </span>
                        )}
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

  const triggerInfos = useMemo(() => buildTriggerInfo(containers, cells), [containers, cells]);
  const consistent = triggersConsistent(triggerInfos);
  const presentCount = triggerInfos.filter((i) => i.tagPresent).length;
  const absentCount = triggerInfos.filter((i) => !i.tagPresent).length;

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

      <div className="fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl" style={{ width: '520px', backgroundColor: 'white', borderLeft: '1px solid hsl(220 13% 91%)' }}>
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
        {activeTab === 'triggers' ? (
          <TriggersTab infos={triggerInfos} consistent={consistent} />
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
      </div>
    </>
  );
}
