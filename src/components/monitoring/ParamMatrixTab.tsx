import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import type { MonitoringContainerData } from '../../data/monitoring-mock';
import { getOfficialEventDef, type ParamStatus } from '../../data/official-params';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ParamCell {
  value: string;
  tagName: string;
}

interface ParamRow {
  paramKey: string;
  officialStatus: ParamStatus | null; // null = custom / not in GA4 spec
  description?: string;
  cells: Record<string, ParamCell | 'absent' | 'no-tag'>;
  consistent: boolean;
}

// ─── Builder ───────────────────────────────────────────────────────────────────

function buildParamMatrix(
  containers: MonitoringContainerData[],
  eventName: string,
): ParamRow[] {
  // For each container: find the GA4 Event tag for this eventName
  const tagPerContainer: Record<string, { tag: MonitoringContainerData['tags'][0] } | null> = {};
  for (const c of containers) {
    const tag = c.tags.find(
      (t) => t.type === 'gaawe' && t.parameter?.some((p) => p.key === 'event_name' && p.value === eventName),
    );
    tagPerContainer[c.containerId] = tag ? { tag } : null;
  }

  // Reference container: the one with the most params (to avoid missing any)
  let refParamKeys: string[] = [];
  let maxCount = 0;
  for (const c of containers) {
    const entry = tagPerContainer[c.containerId];
    if (entry) {
      const keys = (entry.tag.parameter ?? []).map((p) => p.key).filter(Boolean) as string[];
      if (keys.length > maxCount) {
        maxCount = keys.length;
        refParamKeys = keys;
      }
    }
  }

  // Official params for this event
  const officialDef = getOfficialEventDef(eventName, 'ga4');
  const officialParamMap = new Map<string, { status: ParamStatus; description?: string }>(
    (officialDef?.params ?? []).map((p) => [p.key, { status: p.status, description: p.description }]),
  );

  // Row list = union of reference container params + official required/recommended + all container params
  const allKeys = new Set<string>(refParamKeys);
  for (const [key, def] of officialParamMap) {
    if (def.status === 'required' || def.status === 'recommended') {
      allKeys.add(key);
    }
  }
  for (const c of containers) {
    const entry = tagPerContainer[c.containerId];
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
    const official = officialParamMap.get(key) ?? null;

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
    rows.push({
      paramKey: key,
      officialStatus: official?.status ?? null,
      description: official?.description,
      cells,
      consistent: uniqueValues.size <= 1,
    });
  }

  // Sort: required → recommended → optional/custom → system
  const SYSTEM = new Set(['measurement_id', 'send_to', 'event_name']);
  const STATUS_ORDER: Record<string, number> = { required: 0, recommended: 1, optional: 2 };
  rows.sort((a, b) => {
    const aS = SYSTEM.has(a.paramKey) ? 99 : 0;
    const bS = SYSTEM.has(b.paramKey) ? 99 : 0;
    if (aS !== bS) return aS - bS;
    const aO = a.officialStatus ? (STATUS_ORDER[a.officialStatus] ?? 3) : 3;
    const bO = b.officialStatus ? (STATUS_ORDER[b.officialStatus] ?? 3) : 3;
    if (aO !== bO) return aO - bO;
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

// ─── Official status badge ──────────────────────────────────────────────────────

const STATUS_LABEL: Record<ParamStatus, string> = {
  required: 'Requis',
  recommended: 'Recommandé',
  optional: 'Optionnel',
};
const STATUS_COLORS: Record<ParamStatus, { bg: string; color: string }> = {
  required:    { bg: 'hsl(0 85% 96%)',   color: 'hsl(0 70% 50%)' },
  recommended: { bg: 'hsl(38 100% 95%)', color: 'hsl(35 90% 40%)' },
  optional:    { bg: 'hsl(220 13% 95%)', color: 'hsl(220 13% 50%)' },
};

function OfficialBadge({ status }: { status: ParamStatus }) {
  const { bg, color } = STATUS_COLORS[status];
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide shrink-0"
      style={{ backgroundColor: bg, color }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
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
  const missingRequired = rows.filter(
    (r) => r.officialStatus === 'required' && r.cells[containerId] === 'absent',
  ).length;
  return (
    <div className="flex flex-col items-center gap-0.5 mt-0.5">
      <div className="flex items-center gap-1">
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
      {missingRequired > 0 && (
        <span className="text-[9px] font-semibold" style={{ color: 'hsl(0 70% 50%)' }}>
          {missingRequired} requis manquant{missingRequired > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ParamMatrixTab({ containers }: { containers: MonitoringContainerData[] }) {
  const eventNames = useMemo(() => getUniqueEventNames(containers), [containers]);
  const [selectedEvent, setSelectedEvent] = useState(() => eventNames.includes('purchase') ? 'purchase' : eventNames[0] ?? '');
  const [search, setSearch] = useState('');
  const [hideOptional, setHideOptional] = useState(false);

  const allRows = useMemo(
    () => (selectedEvent ? buildParamMatrix(containers, selectedEvent) : []),
    [containers, selectedEvent],
  );

  const SYSTEM = new Set(['measurement_id', 'send_to', 'event_name']);

  const rows = useMemo(() => {
    let r = allRows;
    if (hideOptional) {
      r = r.filter((row) => SYSTEM.has(row.paramKey) || row.officialStatus !== 'optional');
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row) =>
        row.paramKey.toLowerCase().includes(q) ||
        Object.values(row.cells).some((c) => typeof c === 'object' && c.value.toLowerCase().includes(q)),
      );
    }
    return r;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, search, hideOptional]);

  const inconsistentCount = rows.filter((r) => !r.consistent && !SYSTEM.has(r.paramKey)).length;
  const missingRequiredCount = rows.filter(
    (r) => r.officialStatus === 'required' && Object.values(r.cells).some((c) => c === 'absent'),
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
          <span className="text-xs text-muted-fg font-medium shrink-0">Evénement :</span>
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
        <div className="flex items-center gap-2 flex-wrap">
          {missingRequiredCount > 0 && (
            <span
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium"
              style={{ backgroundColor: 'hsl(0 85% 96%)', color: 'hsl(0 70% 45%)' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              {missingRequiredCount} param{missingRequiredCount > 1 ? 's' : ''} requis manquant{missingRequiredCount > 1 ? 's' : ''}
            </span>
          )}
          {inconsistentCount > 0 && (
            <span
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium"
              style={{ backgroundColor: 'hsl(46 100% 50% / 0.15)', color: 'hsl(35 90% 40%)' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1"/><path d="M5 3v2M5 7v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              {inconsistentCount} valeur{inconsistentCount > 1 ? 's' : ''} incohérente{inconsistentCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Hide optional filter */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-muted-fg shrink-0">
          <input
            type="checkbox"
            checked={hideOptional}
            onChange={(e) => setHideOptional(e.target.checked)}
            className="rounded"
          />
          Masquer optionnels
        </label>

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
                  style={{ minWidth: '220px', borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 97%)' }}
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
                const hasRequiredAbsent = row.officialStatus === 'required' &&
                  Object.values(row.cells).some((c) => c === 'absent');
                return (
                  <tr
                    key={row.paramKey}
                    className={clsx(
                      'transition-colors',
                      isSystem ? 'opacity-55 hover:opacity-70' : 'hover:bg-card',
                    )}
                  >
                    <td
                      className="sticky left-0 z-10 px-4 py-2.5 border-b border-r"
                      style={{
                        borderColor: 'hsl(220 13% 91%)',
                        backgroundColor: hasRequiredAbsent ? 'hsl(0 85% 98%)' : 'white',
                      }}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-medium text-foreground">{row.paramKey}</span>
                        {isSystem && (
                          <span
                            className="px-1 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider"
                            style={{ backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 50%)' }}
                          >
                            système
                          </span>
                        )}
                        {!isSystem && row.officialStatus && (
                          <OfficialBadge status={row.officialStatus} />
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
                      {row.description && (
                        <p className="text-[10px] text-muted-fg mt-0.5 leading-tight">{row.description}</p>
                      )}
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

      {/* Legend */}
      <div
        className="px-6 py-2.5 border-t flex items-center gap-4 shrink-0 text-xs flex-wrap"
        style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)', color: 'hsl(220 13% 50%)' }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(142 72% 95%)', border: '1px solid hsl(142 60% 70%)' }} />
          <span>Valeur identique</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(46 100% 94%)', border: '1px solid hsl(46 80% 70%)' }} />
          <span>Valeurs différentes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(0 85% 97%)', border: '1px solid hsl(0 70% 80%)' }} />
          <span>Non envoyé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(220 13% 95%)', border: '1px solid hsl(220 13% 80%)' }} />
          <span>Tag absent</span>
        </div>
        <div className="flex items-center gap-2">
          <OfficialBadge status="required" />
          <OfficialBadge status="recommended" />
          <span>= spec officielle GA4</span>
        </div>
      </div>
    </div>
  );
}
