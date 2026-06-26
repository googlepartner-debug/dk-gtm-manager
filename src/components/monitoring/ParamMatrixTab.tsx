import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import type { MonitoringContainerData } from '../../data/monitoring-mock';

// ─── Trigger section builder ───────────────────────────────────────────────────

interface TriggerEntry {
  name: string;
  type: string;
}

interface TriggerContainerInfo {
  containerId: string;
  containerName: string;
  publicId: string;
  tagPresent: boolean;
  triggers: TriggerEntry[];
}

function buildTriggerInfo(
  containers: MonitoringContainerData[],
  eventName: string,
): TriggerContainerInfo[] {
  return containers.map((c) => {
    const tag = c.tags.find(
      (t) => t.type === 'gaawe' && t.parameter?.some((p) => p.key === 'event_name' && p.value === eventName),
    );
    if (!tag) return { containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, tagPresent: false, triggers: [] };
    const triggerMap = new Map(c.triggers.filter((tr) => tr.triggerId).map((tr) => [tr.triggerId!, tr]));
    const triggers: TriggerEntry[] = (tag.firingTriggerId ?? []).flatMap((id) => {
      const tr = triggerMap.get(id);
      return tr ? [{ name: tr.name, type: tr.type }] : [];
    });
    return { containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, tagPresent: true, triggers };
  });
}

function triggersConsistent(infos: TriggerContainerInfo[]): boolean {
  const present = infos.filter((i) => i.tagPresent);
  if (present.length === 0) return true;
  const ref = present[0].triggers.map((t) => t.name).sort().join('|');
  return present.every((i) => i.triggers.map((t) => t.name).sort().join('|') === ref);
}

// ─── Trigger section component ─────────────────────────────────────────────────

function TriggerSection({ containers, eventName }: { containers: MonitoringContainerData[]; eventName: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const infos = useMemo(() => buildTriggerInfo(containers, eventName), [containers, eventName]);
  const consistent = triggersConsistent(infos);

  const TYPE_LABELS: Record<string, string> = {
    pageview: 'Page Vue', domReady: 'DOM Ready', windowLoaded: 'Window Loaded',
    customEvent: 'Custom Event', click: 'Clic', linkClick: 'Lien', scrollDepth: 'Scroll',
  };

  return (
    <div className="border-t shrink-0" style={{ borderColor: 'hsl(220 13% 91%)' }}>
      {/* Toggle header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-6 py-2.5 text-xs hover:bg-card transition-colors"
        style={{ backgroundColor: 'hsl(220 20% 98%)' }}
      >
        <div className="flex items-center gap-2">
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            className="transition-transform shrink-0"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', color: 'hsl(220 13% 50%)' }}
          >
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="font-semibold text-foreground">Déclencheurs du tag</span>
          {!consistent && (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 50%)' }}
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 2l5 5M7 2l-5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              Déclencheurs différents entre containers
            </span>
          )}
          {consistent && infos.some((i) => i.tagPresent) && (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: 'hsl(142 72% 95%)', color: 'hsl(142 60% 35%)' }}
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Identiques
            </span>
          )}
        </div>
        <span className="text-muted-fg">
          {collapsed ? 'Afficher' : 'Masquer'}
        </span>
      </button>

      {!collapsed && (
        <div className="grid px-4 pb-4 pt-1 gap-2" style={{ gridTemplateColumns: `repeat(${containers.length}, minmax(160px, 1fr))` }}>
          {infos.map((info) => {
            const hasExtraTrigger = !consistent && info.tagPresent;
            return (
              <div
                key={info.containerId}
                className="rounded-lg border overflow-hidden"
                style={{
                  borderColor: !info.tagPresent
                    ? 'hsl(220 13% 88%)'
                    : hasExtraTrigger
                    ? 'hsl(0 70% 80%)'
                    : 'hsl(142 60% 70%)',
                  backgroundColor: !info.tagPresent
                    ? 'hsl(220 20% 98%)'
                    : hasExtraTrigger
                    ? 'hsl(0 85% 98%)'
                    : 'hsl(142 72% 98%)',
                }}
              >
                <div
                  className="px-3 py-1.5 border-b"
                  style={{
                    borderColor: 'inherit',
                    backgroundColor: !info.tagPresent ? 'hsl(220 20% 97%)' : hasExtraTrigger ? 'hsl(0 85% 97%)' : 'hsl(142 72% 96%)',
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-foreground truncate">{info.containerName}</span>
                    <span className="font-mono text-[9px] text-muted-fg shrink-0">{info.publicId}</span>
                  </div>
                </div>
                <div className="px-3 py-2 space-y-1.5">
                  {!info.tagPresent ? (
                    <span className="text-[11px] italic" style={{ color: 'hsl(220 13% 55%)' }}>Tag absent</span>
                  ) : info.triggers.length === 0 ? (
                    <span className="text-[11px] italic" style={{ color: 'hsl(0 70% 55%)' }}>Aucun déclencheur lié</span>
                  ) : (
                    info.triggers.map((tr, i) => {
                      const label = TYPE_LABELS[tr.type] ?? tr.type;
                      const isPageview = tr.type === 'pageview';
                      return (
                        <div key={i} className="flex items-center gap-1.5">
                          <span
                            className="px-1 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider shrink-0"
                            style={{
                              backgroundColor: isPageview ? 'hsl(0 85% 96%)' : 'hsl(220 13% 91%)',
                              color: isPageview ? 'hsl(0 70% 50%)' : 'hsl(220 13% 45%)',
                            }}
                          >
                            {label}
                          </span>
                          <span
                            className="text-[11px] font-mono truncate"
                            style={{ color: isPageview ? 'hsl(0 70% 45%)' : 'hsl(220 13% 25%)' }}
                            title={tr.name}
                          >
                            {tr.name}
                            {isPageview && (
                              <span className="ml-1 text-[9px] font-sans font-semibold" style={{ color: 'hsl(0 70% 50%)' }}>⚠</span>
                            )}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ParamCell {
  value: string;
  tagName: string;
}

interface ParamRow {
  paramKey: string;
  // status for each container: present (with value), absent (tag has the param key missing), or no-tag (tag itself absent)
  cells: Record<string, ParamCell | 'absent' | 'no-tag'>;
  // true if all *present* containers have the same value string
  consistent: boolean;
}

// ─── Builder ───────────────────────────────────────────────────────────────────

function buildParamMatrix(
  containers: MonitoringContainerData[],
  eventName: string,
): ParamRow[] {
  // For each container: find the GA4 Event tag for this eventName
  const tagPerContainer: Record<string, { tag: MonitoringContainerData['tags'][0]; containerId: string } | null> = {};
  for (const c of containers) {
    const tag = c.tags.find(
      (t) => t.type === 'gaawe' && t.parameter?.some((p) => p.key === 'event_name' && p.value === eventName),
    );
    tagPerContainer[c.containerId] = tag ? { tag, containerId: c.containerId } : null;
  }

  // Collect all param keys across all containers for this event
  const allKeys = new Set<string>();
  for (const entry of Object.values(tagPerContainer)) {
    if (entry) {
      for (const p of entry.tag.parameter ?? []) {
        if (p.key) allKeys.add(p.key);
      }
    }
  }

  // Build rows
  const rows: ParamRow[] = [];
  for (const key of allKeys) {
    const cells: ParamRow['cells'] = {};
    const presentValues: string[] = [];

    for (const c of containers) {
      const entry = tagPerContainer[c.containerId];
      if (!entry) {
        cells[c.containerId] = 'no-tag';
      } else {
        const param = entry.tag.parameter?.find((p) => p.key === key);
        if (param?.value !== undefined) {
          cells[c.containerId] = { value: param.value, tagName: entry.tag.name };
          presentValues.push(param.value);
        } else {
          cells[c.containerId] = 'absent';
        }
      }
    }

    const uniqueValues = new Set(presentValues);
    rows.push({ paramKey: key, cells, consistent: uniqueValues.size <= 1 });
  }

  // Sort: system params last, then alphabetical
  const SYSTEM = new Set(['measurement_id', 'send_to', 'event_name']);
  rows.sort((a, b) => {
    const aS = SYSTEM.has(a.paramKey) ? 1 : 0;
    const bS = SYSTEM.has(b.paramKey) ? 1 : 0;
    if (aS !== bS) return aS - bS;
    return a.paramKey.localeCompare(b.paramKey);
  });

  return rows;
}

// ─── Event picker ──────────────────────────────────────────────────────────────

function getUniqueEventNames(containers: MonitoringContainerData[]): string[] {
  const seen = new Set<string>();
  for (const c of containers) {
    for (const tag of c.tags) {
      if (tag.type === 'gaawe') {
        const ev = tag.parameter?.find((p) => p.key === 'event_name')?.value;
        if (ev) seen.add(ev);
      }
    }
  }
  // Sort: purchase first, then alpha
  const PRIORITY = ['purchase', 'begin_checkout', 'add_to_cart', 'remove_from_cart', 'view_item', 'view_item_list', 'search'];
  return [...seen].sort((a, b) => {
    const ai = PRIORITY.indexOf(a);
    const bi = PRIORITY.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}

// ─── Cell component ────────────────────────────────────────────────────────────

function ParamCellView({ cell, consistent }: { cell: ParamCell | 'absent' | 'no-tag'; consistent: boolean }) {
  if (cell === 'no-tag') {
    return (
      <div
        className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium"
        style={{ backgroundColor: 'hsl(220 13% 95%)', color: 'hsl(220 13% 60%)' }}
      >
        <span className="text-[10px]">Tag absent</span>
      </div>
    );
  }
  if (cell === 'absent') {
    return (
      <div
        className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium"
        style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 55%)' }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span>Non envoyé</span>
      </div>
    );
  }
  const color = consistent ? 'hsl(142 60% 28%)' : 'hsl(35 90% 38%)';
  const bg = consistent ? 'hsl(142 72% 95%)' : 'hsl(46 100% 94%)';
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-mono"
      style={{ backgroundColor: bg, color }}
      title={cell.value}
    >
      {!consistent && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
          <path d="M5 2v3.5M5 7.5v.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1"/>
        </svg>
      )}
      {consistent && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
          <path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      <span className="truncate max-w-[140px]">{cell.value}</span>
    </div>
  );
}

// ─── Coverage summary per container ───────────────────────────────────────────

function ContainerCoverageBadge({ rows, containerId }: { rows: ParamRow[]; containerId: string }) {
  const relevant = rows.filter((r) => r.cells[containerId] !== 'no-tag');
  const present = relevant.filter((r) => r.cells[containerId] !== 'absent');
  if (relevant.length === 0) return null;
  const pct = Math.round((present.length / relevant.length) * 100);
  return (
    <div className="flex items-center gap-1 mt-0.5">
      <div className="w-10 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(220 13% 88%)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: pct === 100 ? 'hsl(142 60% 45%)' : pct >= 70 ? 'hsl(46 100% 50%)' : 'hsl(0 70% 55%)',
          }}
        />
      </div>
      <span className="text-[10px]" style={{ color: pct === 100 ? 'hsl(142 60% 35%)' : pct >= 70 ? 'hsl(35 90% 40%)' : 'hsl(0 70% 50%)' }}>
        {pct}%
      </span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ParamMatrixTab({ containers }: { containers: MonitoringContainerData[] }) {
  const eventNames = useMemo(() => getUniqueEventNames(containers), [containers]);
  const [selectedEvent, setSelectedEvent] = useState(() => eventNames.includes('purchase') ? 'purchase' : eventNames[0] ?? '');
  const [search, setSearch] = useState('');

  const allRows = useMemo(
    () => (selectedEvent ? buildParamMatrix(containers, selectedEvent) : []),
    [containers, selectedEvent],
  );

  const rows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.toLowerCase();
    return allRows.filter((r) =>
      r.paramKey.toLowerCase().includes(q) ||
      Object.values(r.cells).some((c) => typeof c === 'object' && c.value.toLowerCase().includes(q)),
    );
  }, [allRows, search]);

  const SYSTEM = new Set(['measurement_id', 'send_to', 'event_name']);
  const inconsistentCount = rows.filter((r) => !r.consistent && !SYSTEM.has(r.paramKey)).length;
  const absentCount = rows.filter((r) =>
    Object.values(r.cells).some((c) => c === 'absent'),
  ).length;

  if (eventNames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-fg">
        <p className="text-sm">Aucun tag GA4 Event détecté dans les containers</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Event picker + search */}
      <div
        className="px-6 py-3 flex items-center gap-3 border-b shrink-0 flex-wrap"
        style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)' }}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-fg font-medium shrink-0">Event :</span>
          {eventNames.map((ev) => (
            <button
              key={ev}
              onClick={() => { setSelectedEvent(ev); setSearch(''); }}
              className={clsx(
                'px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all border',
                selectedEvent === ev
                  ? 'border-transparent shadow-sm text-white'
                  : 'border-transparent text-muted-fg hover:text-foreground',
              )}
              style={
                selectedEvent === ev
                  ? { backgroundColor: 'hsl(267 100% 59%)' }
                  : { backgroundColor: 'hsl(220 13% 91%)' }
              }
            >
              {ev}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Alerts */}
        <div className="flex items-center gap-2">
          {inconsistentCount > 0 && (
            <span
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium"
              style={{ backgroundColor: 'hsl(46 100% 50% / 0.15)', color: 'hsl(35 90% 40%)' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1"/><path d="M5 3v2M5 7v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              {inconsistentCount} valeur{inconsistentCount > 1 ? 's' : ''} incohérente{inconsistentCount > 1 ? 's' : ''}
            </span>
          )}
          {absentCount > 0 && (
            <span
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium"
              style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 50%)' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              {absentCount} param{absentCount > 1 ? 's' : ''} non envoyé{absentCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-fg" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.25"/>
            <path d="M7.5 7.5l2 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="currency, items…"
            className="pl-7 pr-3 py-1.5 text-xs rounded-lg border outline-none w-44"
            style={{ borderColor: 'hsl(220 13% 85%)', backgroundColor: 'white', color: 'hsl(220 13% 20%)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-fg hover:text-foreground">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-fg">
            <p className="text-sm">Aucun paramètre trouvé</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
                <th
                  className="sticky left-0 z-10 text-left px-4 py-2.5 text-xs font-semibold text-muted-fg border-b border-r"
                  style={{ minWidth: '180px', borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 97%)' }}
                >
                  Paramètre
                </th>
                {containers.map((c) => (
                  <th
                    key={c.containerId}
                    className="text-center px-3 py-2 border-b border-r last:border-r-0"
                    style={{ minWidth: '180px', borderColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 30%)' }}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xs font-semibold">{c.containerName}</span>
                      <span className="font-mono text-[10px] opacity-60">{c.publicId}</span>
                      <ContainerCoverageBadge rows={rows} containerId={c.containerId} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSystem = SYSTEM.has(row.paramKey);
                return (
                  <tr
                    key={row.paramKey}
                    className={clsx('transition-colors', isSystem ? 'opacity-60 hover:opacity-80' : 'hover:bg-card')}
                  >
                    <td
                      className="sticky left-0 z-10 px-4 py-2.5 border-b border-r"
                      style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'white' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-foreground">{row.paramKey}</span>
                        {isSystem && (
                          <span
                            className="px-1 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider"
                            style={{ backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 50%)' }}
                          >
                            système
                          </span>
                        )}
                        {!row.consistent && !isSystem && (
                          <span
                            className="px-1 py-0.5 rounded text-[9px] font-medium"
                            style={{ backgroundColor: 'hsl(46 100% 50% / 0.15)', color: 'hsl(35 90% 40%)' }}
                          >
                            valeurs différentes
                          </span>
                        )}
                      </div>
                    </td>
                    {containers.map((c) => (
                      <td
                        key={c.containerId}
                        className="px-2 py-2 border-b border-r last:border-r-0"
                        style={{ borderColor: 'hsl(220 13% 91%)' }}
                      >
                        <ParamCellView cell={row.cells[c.containerId]} consistent={row.consistent} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Trigger section */}
      {selectedEvent && <TriggerSection containers={containers} eventName={selectedEvent} />}

      {/* Legend */}
      <div
        className="px-6 py-2.5 border-t flex items-center gap-4 shrink-0 text-xs"
        style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)', color: 'hsl(220 13% 50%)' }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(142 72% 95%)', border: '1px solid hsl(142 60% 70%)' }} />
          <span>Valeur identique sur tous les containers</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(46 100% 94%)', border: '1px solid hsl(46 80% 70%)' }} />
          <span>Valeurs différentes entre containers</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(0 85% 97%)', border: '1px solid hsl(0 70% 80%)' }} />
          <span>Paramètre non envoyé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(220 13% 95%)', border: '1px solid hsl(220 13% 80%)' }} />
          <span>Tag absent du container</span>
        </div>
      </div>
    </div>
  );
}
