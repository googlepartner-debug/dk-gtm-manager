import { useMemo } from 'react';
import type { MonitoringContainerData } from '../../data/monitoring-mock';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TriggerEntry {
  name: string;
  type: string;
}

interface ContainerTriggerInfo {
  containerId: string;
  containerName: string;
  publicId: string;
  tagPresent: boolean;
  tagName: string | null;
  triggers: TriggerEntry[];
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface TagDetailDrawerProps {
  rowKey: string;
  category: string;
  categoryColor: string;
  cells: Record<string, { name: string; type: string } | null>;
  containers: MonitoringContainerData[];
  onClose: () => void;
  onRename: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

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
    if (!cell) {
      return { containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, tagPresent: false, tagName: null, triggers: [] };
    }
    const tag = c.tags.find((t) => t.name === cell.name);
    if (!tag) {
      return { containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, tagPresent: false, tagName: null, triggers: [] };
    }
    const triggerMap = new Map(
      c.triggers.filter((tr) => tr.triggerId).map((tr) => [tr.triggerId!, tr]),
    );
    const triggers: TriggerEntry[] = (tag.firingTriggerId ?? []).flatMap((id) => {
      const tr = triggerMap.get(id);
      return tr ? [{ name: tr.name, type: tr.type }] : [];
    });
    return { containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, tagPresent: true, tagName: tag.name, triggers };
  });
}

function triggersConsistent(infos: ContainerTriggerInfo[]): boolean {
  const present = infos.filter((i) => i.tagPresent);
  if (present.length === 0) return true;
  const ref = present[0].triggers.map((t) => t.name).sort().join('|');
  return present.every((i) => i.triggers.map((t) => t.name).sort().join('|') === ref);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function TagDetailDrawer({
  rowKey,
  category,
  categoryColor,
  cells,
  containers,
  onClose,
  onRename,
}: TagDetailDrawerProps) {
  const infos = useMemo(() => buildTriggerInfo(containers, cells), [containers, cells]);
  const consistent = triggersConsistent(infos);
  const hasTriggerData = infos.some((i) => i.tagPresent && (i.triggers.length > 0 || i.tagPresent));
  const presentCount = infos.filter((i) => i.tagPresent).length;
  const absentCount = infos.filter((i) => !i.tagPresent).length;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'hsl(220 13% 10% / 0.35)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl overflow-hidden"
        style={{ width: '520px', backgroundColor: 'white', borderLeft: '1px solid hsl(220 13% 91%)' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b shrink-0 flex items-start justify-between" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0"
                style={{ backgroundColor: categoryColor + '22', color: categoryColor }}
              >
                {category}
              </span>
              {!consistent && presentCount > 1 && (
                <span
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 50%)' }}
                >
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 2l5 5M7 2l-5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
                  Déclencheurs différents
                </span>
              )}
              {consistent && presentCount > 0 && (
                <span
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{ backgroundColor: 'hsl(142 72% 95%)', color: 'hsl(142 60% 35%)' }}
                >
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
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onRename}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
              style={{ backgroundColor: categoryColor + '18', color: categoryColor }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M7.5 1.5l2 2-5 5H2.5v-2l5-5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
              </svg>
              Renommer
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-card transition-colors text-muted-fg"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>

        {/* Section title */}
        <div
          className="px-5 py-2.5 border-b shrink-0"
          style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)' }}
        >
          <span className="text-xs font-semibold text-foreground">Déclencheurs associés par container</span>
        </div>

        {/* Container cards */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {!hasTriggerData ? (
            <div className="flex items-center justify-center h-24 text-xs text-muted-fg italic">
              Aucun déclencheur lié à ce tag dans les données de monitoring
            </div>
          ) : (
            infos.map((info) => {
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
                  {/* Container header */}
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
                      <span
                        className="text-[10px] font-mono truncate max-w-[160px]"
                        style={{ color: 'hsl(220 13% 50%)' }}
                        title={info.tagName}
                      >
                        {info.tagName}
                      </span>
                    )}
                  </div>

                  {/* Triggers list */}
                  <div className="px-3.5 py-2.5" style={{ backgroundColor: 'white' }}>
                    {!info.tagPresent ? (
                      <span className="text-[11px] italic" style={{ color: 'hsl(220 13% 55%)' }}>Tag absent dans ce container</span>
                    ) : info.triggers.length === 0 ? (
                      <span className="text-[11px] italic" style={{ color: 'hsl(0 70% 55%)' }}>Aucun déclencheur lié (firingTriggerId vide)</span>
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
                              <span
                                className="text-[11px] font-mono"
                                style={{ color: isPageview ? 'hsl(0 70% 45%)' : 'hsl(220 13% 20%)' }}
                              >
                                {tr.name}
                              </span>
                              {isPageview && (
                                <span
                                  className="text-[10px] font-medium px-1 py-0.5 rounded"
                                  style={{ backgroundColor: 'hsl(0 85% 96%)', color: 'hsl(0 70% 45%)' }}
                                >
                                  Se déclenche sur toutes les pages
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
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 border-t shrink-0 flex items-center gap-2 text-xs"
          style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)', color: 'hsl(220 13% 45%)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/><path d="M6 4v2.5M6 8v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
          Données simulées · cliquez "Renommer" pour planifier un renommage groupé
        </div>
      </div>
    </>
  );
}
