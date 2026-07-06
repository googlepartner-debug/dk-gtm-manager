import { useState, useMemo, useRef, useEffect } from 'react';
import { useGTMStore } from '../store/gtm-store';
import { computeEventChain, resolveTagEventNames } from '../lib/event-chain';
import type { MonitoringContainerData } from '../data/monitoring-mock';
import type { GTMParameter } from '../types/gtm';

// ─── Drill-down state ──────────────────────────────────────────────────────────

type DrillState =
  | { level: 0 }
  | { level: 1; eventName: string }
  | { level: 2; eventName: string; triggerName: string };

// ─── Score helpers (level 0) ───────────────────────────────────────────────────

const SCORE_COLOR: Record<0 | 1 | 2 | 3, string> = {
  0: 'var(--color-score-0)',
  1: 'var(--color-score-1)',
  2: 'var(--color-score-2)',
  3: 'var(--color-score-3)',
};
const SCORE_BG: Record<0 | 1 | 2 | 3, string> = {
  0: 'var(--color-score-0-bg)',
  1: 'var(--color-score-1-bg)',
  2: 'var(--color-score-2-bg)',
  3: 'var(--color-score-3-bg)',
};
const SCORE_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: 'Absent',
  1: 'Trigger manquant',
  2: 'Variables manquantes',
  3: 'Complet',
};

function ScoreDots({ tagPresent, triggersMissing, variablesTotal, variablesMissing }: {
  tagPresent: boolean; triggersMissing: boolean; variablesTotal: number; variablesMissing: string[];
}) {
  const dots: [boolean | null, string][] = [
    [tagPresent, 'Tag'],
    [tagPresent ? !triggersMissing : null, 'Trigger'],
    [tagPresent ? variablesTotal > 0 && variablesMissing.length === 0 : null, 'Vars'],
  ];
  return (
    <div className="flex items-center gap-1">
      {dots.map(([ok, label], i) => (
        <span key={i} title={label} className="w-2 h-2 rounded-full" style={{
          backgroundColor: ok === null ? 'var(--color-score-0)' : ok ? 'var(--color-score-3)' : 'var(--color-score-1)',
        }} />
      ))}
    </div>
  );
}

function CoverageBar({ pct }: { pct: number }) {
  const d = Math.round(pct * 100);
  const color = d === 100 ? 'var(--color-score-3)' : d >= 60 ? 'var(--color-score-2)' : 'var(--color-score-1)';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: 'hsl(220 13% 91%)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${d}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums" style={{ color, minWidth: '2.5rem', textAlign: 'right' }}>{d}%</span>
    </div>
  );
}

// ─── Trigger type labels ───────────────────────────────────────────────────────

const TRIGGER_TYPE_LABEL: Record<string, string> = {
  customEvent: 'Custom Event',
  pageview: 'Page Vue',
  domReady: 'DOM Ready',
  windowLoaded: 'Window Loaded',
  click: 'Clic',
  linkClick: 'Clic lien',
  scrollDepth: 'Scroll',
  historyChange: 'Historique',
  timer: 'Timer',
};
const triggerTypeLabel = (t: string) => TRIGGER_TYPE_LABEL[t] ?? t;

// ─── Data helpers ──────────────────────────────────────────────────────────────

const VAR_RE = /\{\{([^}]+)\}\}/g;
function extractVarRefs(params: GTMParameter[]): string[] {
  const refs: string[] = [];
  function scan(ps: GTMParameter[]) {
    for (const p of ps ?? []) {
      if (p.value) {
        VAR_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = VAR_RE.exec(p.value)) !== null) refs.push(m[1]);
      }
      if (p.list) scan(p.list);
      if (p.map) scan(p.map);
    }
  }
  scan(params);
  return [...new Set(refs)];
}

// ─── Action queue ──────────────────────────────────────────────────────────────

type ActionType = 'create_tag' | 'create_trigger' | 'copy_tag' | 'copy_trigger' | 'copy_variable';

interface ActionItem {
  id: string;
  type: ActionType;
  level: 0 | 1 | 2;
  eventName: string;
  triggerName?: string;
  varName?: string;
  targetContainerId: string;
  targetContainerName: string;
  targetPublicId: string;
  sourceContainerId?: string;
  sourceContainerName?: string;
}

const ACTION_LABEL: Record<ActionType, string> = {
  create_tag: 'Créer tag GA4',
  create_trigger: 'Créer déclencheur',
  copy_tag: 'Copier le tag',
  copy_trigger: 'Copier le déclencheur',
  copy_variable: 'Copier la variable',
};
const ACTION_COLOR: Record<ActionType, string> = {
  create_tag: 'hsl(142 60% 40%)',
  create_trigger: 'hsl(267 100% 55%)',
  copy_tag: 'hsl(213 94% 50%)',
  copy_trigger: 'hsl(213 94% 50%)',
  copy_variable: 'hsl(27 96% 50%)',
};

// ─── Level 1: trigger matrix for one event ────────────────────────────────────

interface TriggerRow {
  triggerName: string;
  triggerType: string;
  cells: Record<string, { name: string; type: string } | null>;
  coverage: number;
}

function buildTriggerMatrix(containers: MonitoringContainerData[], eventName: string): TriggerRow[] {
  const rowMap = new Map<string, { type: string; cells: Record<string, { name: string; type: string } | null> }>();
  const containerIds = containers.map((c) => c.containerId);

  for (const c of containers) {
    const tag = c.tags.find((t) => t.type === 'gaawe' && resolveTagEventNames(t, c.triggers).includes(eventName));
    const triggerIds = tag?.firingTriggerId ?? [];
    const linked = triggerIds
      .map((id) => c.triggers.find((tr) => tr.triggerId === id))
      .filter((tr): tr is NonNullable<typeof tr> => !!tr);

    for (const tr of linked) {
      if (!rowMap.has(tr.name)) {
        rowMap.set(tr.name, {
          type: tr.type,
          cells: Object.fromEntries(containerIds.map((id) => [id, null])),
        });
      }
      rowMap.get(tr.name)!.cells[c.containerId] = { name: tr.name, type: tr.type };
    }
  }

  return Array.from(rowMap.entries()).map(([triggerName, { type, cells }]) => {
    const present = Object.values(cells).filter(Boolean).length;
    return { triggerName, triggerType: type, cells, coverage: present / containers.length };
  }).sort((a, b) => b.coverage - a.coverage);
}

// ─── Level 2: variable matrix for one event ───────────────────────────────────

interface VarRow {
  varName: string;
  cells: Record<string, boolean>;
  coverage: number;
}

function buildVariableMatrix(containers: MonitoringContainerData[], eventName: string): VarRow[] {
  const rowMap = new Map<string, Record<string, boolean>>();
  const containerIds = containers.map((c) => c.containerId);

  for (const c of containers) {
    const tag = c.tags.find((t) => t.type === 'gaawe' && resolveTagEventNames(t, c.triggers).includes(eventName));
    if (!tag?.parameter) continue;
    const refs = extractVarRefs(tag.parameter);
    const varNames = new Set(c.variables.map((v) => v.name));
    for (const ref of refs) {
      if (!rowMap.has(ref)) {
        rowMap.set(ref, Object.fromEntries(containerIds.map((id) => [id, false])));
      }
      rowMap.get(ref)![c.containerId] = varNames.has(ref);
    }
  }

  return Array.from(rowMap.entries()).map(([varName, cells]) => {
    const present = Object.values(cells).filter(Boolean).length;
    return { varName, cells, coverage: present / containers.length };
  }).sort((a, b) => a.coverage - b.coverage);
}

// ─── Shared table shell ────────────────────────────────────────────────────────

function MatrixTable({ containers, firstColLabel, minColWidth = 140, children }: {
  containers: MonitoringContainerData[];
  firstColLabel: string;
  minColWidth?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm border-collapse" style={{ minWidth: `${240 + containers.length * minColWidth}px` }}>
        <thead>
          <tr style={{ backgroundColor: 'hsl(220 20% 97%)', borderBottom: '1px solid hsl(220 13% 91%)' }}>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-fg sticky left-0 z-10 w-52"
                style={{ backgroundColor: 'hsl(220 20% 97%)', borderRight: '1px solid hsl(220 13% 91%)' }}>
              {firstColLabel}
            </th>
            <th className="text-left px-3 py-3 font-medium text-xs text-muted-fg w-36">Couverture</th>
            {containers.map((c) => (
              <th key={c.containerId} className="text-left px-3 py-3 font-medium text-xs text-muted-fg" style={{ minWidth: minColWidth }}>
                <div className="text-foreground font-medium truncate" title={c.containerName}>{c.containerName}</div>
                <div className="text-muted-fg font-normal">{c.publicId}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-12 text-sm text-muted-fg">{message}</td>
    </tr>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function EventsPage() {
  const { monitoringData, isLoadingMonitoring, loadMockMonitoringData } = useGTMStore();
  const containers = monitoringData;
  const hasData = containers.length > 0;

  const [drill, setDrill] = useState<DrillState>({ level: 0 });
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [actionQueue, setActionQueue] = useState<ActionItem[]>([]);
  const [popover, setPopover] = useState<{ actions: ActionItem[]; anchorRect: DOMRect } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!popover) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopover(null);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popover]);

  // ── Level 0 data ────────────────────────────────────────────────────────────
  const eventChainRows = useMemo(() => computeEventChain(containers), [containers]);
  const filteredEventRows = useMemo(() => eventChainRows.filter((row) => {
    if (incompleteOnly && Object.values(row.containers).every((s) => s.chainScore === 3)) return false;
    return true;
  }), [eventChainRows, incompleteOnly]);

  // ── Narrowed drill states ────────────────────────────────────────────────────
  const drill1 = drill.level >= 1 ? (drill as { level: 1 | 2; eventName: string }) : null;
  const drill2 = drill.level === 2 ? (drill as { level: 2; eventName: string; triggerName: string }) : null;

  // ── Level 1 data ────────────────────────────────────────────────────────────
  const triggerRows = useMemo(() =>
    drill1 ? buildTriggerMatrix(containers, drill1.eventName) : [],
    [containers, drill],
  );

  // ── Level 2 data ────────────────────────────────────────────────────────────
  const varRows = useMemo(() =>
    drill1 ? buildVariableMatrix(containers, drill1.eventName) : [],
    [containers, drill],
  );

  // ── Navigation ──────────────────────────────────────────────────────────────
  function drillToEvent(eventName: string) { setDrill({ level: 1, eventName }); }
  function drillToTrigger(triggerName: string) {
    if (drill1) setDrill({ level: 2, eventName: drill1.eventName, triggerName });
  }
  function goBack() {
    if (drill2) setDrill({ level: 1, eventName: drill2.eventName });
    else setDrill({ level: 0 });
  }

  // ── Action helpers ──────────────────────────────────────────────────────────

  function openCellActions(e: React.MouseEvent, rawActions: Omit<ActionItem, 'id'>[]) {
    if (rawActions.length === 0) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({
      actions: rawActions.map((a, i) => ({ ...a, id: `${Date.now()}-${i}` })),
      anchorRect: rect,
    });
  }

  function buildLevel0Actions(eventName: string, score: 0 | 1 | 2 | 3, targetC: MonitoringContainerData): Omit<ActionItem, 'id'>[] {
    const t = { eventName, level: 0 as const, targetContainerId: targetC.containerId, targetContainerName: targetC.containerName, targetPublicId: targetC.publicId };
    const row = eventChainRows.find((r) => r.eventName === eventName);
    const best = containers.find((c) => c.containerId !== targetC.containerId && row?.containers[c.containerId]?.chainScore === 3);
    if (score === 0) {
      const acts: Omit<ActionItem, 'id'>[] = [{ ...t, type: 'create_tag' }];
      if (best) acts.push({ ...t, type: 'copy_tag', sourceContainerId: best.containerId, sourceContainerName: best.containerName });
      return acts;
    }
    if (score === 1) {
      const acts: Omit<ActionItem, 'id'>[] = [{ ...t, type: 'create_trigger' }];
      if (best) acts.push({ ...t, type: 'copy_trigger', sourceContainerId: best.containerId, sourceContainerName: best.containerName });
      return acts;
    }
    if (score === 2 && best) return [{ ...t, type: 'copy_tag', sourceContainerId: best.containerId, sourceContainerName: best.containerName }];
    return [];
  }

  function buildLevel1Actions(triggerName: string, targetC: MonitoringContainerData): Omit<ActionItem, 'id'>[] {
    if (!drill1) return [];
    const t = { eventName: drill1.eventName, triggerName, level: 1 as const, targetContainerId: targetC.containerId, targetContainerName: targetC.containerName, targetPublicId: targetC.publicId };
    const row = triggerRows.find((r) => r.triggerName === triggerName);
    const best = containers.find((c) => c.containerId !== targetC.containerId && row?.cells[c.containerId] !== null);
    const acts: Omit<ActionItem, 'id'>[] = [{ ...t, type: 'create_trigger' }];
    if (best) acts.push({ ...t, type: 'copy_trigger', sourceContainerId: best.containerId, sourceContainerName: best.containerName });
    return acts;
  }

  function buildLevel2Actions(varName: string, targetC: MonitoringContainerData): Omit<ActionItem, 'id'>[] {
    if (!drill1) return [];
    const t = { eventName: drill1.eventName, varName, level: 2 as const, targetContainerId: targetC.containerId, targetContainerName: targetC.containerName, targetPublicId: targetC.publicId };
    const row = varRows.find((r) => r.varName === varName);
    const best = containers.find((c) => c.containerId !== targetC.containerId && row?.cells[c.containerId] === true);
    if (!best) return [];
    return [{ ...t, type: 'copy_variable', sourceContainerId: best.containerId, sourceContainerName: best.containerName }];
  }

  // Compute missing dependencies when copying a tag or trigger to a target container.
  // Returns additional actions to add alongside the main copy action.
  function computeCopyDependencies(action: ActionItem): Omit<ActionItem, 'id'>[] {
    if (action.type !== 'copy_tag' && action.type !== 'copy_trigger') return [];
    if (!action.sourceContainerId) return [];
    const sourceC = containers.find((c) => c.containerId === action.sourceContainerId);
    const targetC = containers.find((c) => c.containerId === action.targetContainerId);
    if (!sourceC || !targetC) return [];

    const targetVarNames = new Set(targetC.variables.map((v) => v.name));
    const targetTriggerNames = new Set(targetC.triggers.map((t) => t.name));
    const base: Omit<ActionItem, 'id' | 'type'> = {
      eventName: action.eventName,
      level: action.level,
      targetContainerId: action.targetContainerId,
      targetContainerName: action.targetContainerName,
      targetPublicId: action.targetPublicId,
      sourceContainerId: action.sourceContainerId,
      sourceContainerName: action.sourceContainerName,
    };
    const deps: Omit<ActionItem, 'id'>[] = [];

    if (action.type === 'copy_tag') {
      const tag = sourceC.tags.find(
        (t) => t.type === 'gaawe' && resolveTagEventNames(t, sourceC.triggers).includes(action.eventName),
      );
      if (!tag) return [];
      // Missing triggers
      for (const triggerId of tag.firingTriggerId ?? []) {
        const trigger = sourceC.triggers.find((t) => t.triggerId === triggerId);
        if (!trigger || targetTriggerNames.has(trigger.name)) continue;
        deps.push({ ...base, type: 'copy_trigger', triggerName: trigger.name });
      }
      // Missing variables referenced in tag parameters
      const refs = extractVarRefs(tag.parameter ?? []);
      for (const ref of refs) {
        if (!targetVarNames.has(ref)) deps.push({ ...base, type: 'copy_variable', varName: ref });
      }
    }

    if (action.type === 'copy_trigger' && action.triggerName) {
      const trigger = sourceC.triggers.find((t) => t.name === action.triggerName);
      if (!trigger) return [];
      // Scan trigger conditions for {{VarRef}} references
      const TVAR = /\{\{([^}]+)\}\}/g;
      const scanCondParam = (val: string) => {
        TVAR.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = TVAR.exec(val)) !== null) {
          if (!targetVarNames.has(m[1])) deps.push({ ...base, type: 'copy_variable', varName: m[1], triggerName: action.triggerName });
        }
      };
      for (const cond of [...(trigger.filter ?? []), ...(trigger.customEventFilter ?? [])]) {
        for (const p of cond.parameter ?? []) { if (p.value) scanCondParam(p.value); }
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return deps.filter((d) => {
      const key = `${d.type}|${d.varName ?? ''}|${d.triggerName ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ── Breadcrumb ──────────────────────────────────────────────────────────────
  const breadcrumb: { label: string; onClick?: () => void }[] = [
    { label: 'Événements GA4', onClick: drill.level > 0 ? () => setDrill({ level: 0 }) : undefined },
    ...(drill1 ? [{ label: drill1.eventName, onClick: drill2 ? () => setDrill({ level: 1, eventName: drill1.eventName }) : undefined }] : []),
    ...(drill2 ? [{ label: drill2.triggerName }] : []),
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b shrink-0" style={{ borderColor: 'hsl(220 13% 91%)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Back button */}
            {drill.level > 0 && (
              <button
                onClick={goBack}
                className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[hsl(220_20%_93%)]"
                style={{ color: 'hsl(220 13% 50%)' }}
                title="Retour"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm min-w-0 flex-wrap">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-muted-fg text-xs">›</span>}
                  {crumb.onClick ? (
                    <button
                      onClick={crumb.onClick}
                      className="text-muted-fg hover:text-foreground transition-colors font-medium"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-foreground font-semibold truncate">{crumb.label}</span>
                  )}
                </span>
              ))}
            </div>

            {isLoadingMonitoring && (
              <span className="text-xs text-muted-fg shrink-0">Scan en cours…</span>
            )}
          </div>

          {/* Level 0 controls */}
          {drill.level === 0 && hasData && (
            <label className="flex items-center gap-2 text-sm text-muted-fg cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={incompleteOnly}
                onChange={(e) => setIncompleteOnly(e.target.checked)}
                className="rounded"
              />
              Incomplets seulement
            </label>
          )}
        </div>


        {/* Level 1/2: sub-label */}
        {drill1 && (
          <p className="text-xs text-muted-fg mt-1">
            {drill.level === 1 && `Déclencheurs associés à l'event "${drill1.eventName}" — cliquez une ligne pour voir ses variables`}
            {drill.level === 2 && `Variables référencées par le tag GA4 de l'event "${drill1.eventName}"`}
          </p>
        )}
      </div>

      {/* Empty state */}
      {!hasData && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'hsl(220 20% 95%)' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: 'hsl(220 13% 60%)' }}>
              <path d="M10 3L12.5 8H18L13.5 11.5L15 17L10 14L5 17L6.5 11.5L2 8H7.5L10 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Aucune donnée de monitoring</p>
            <p className="text-xs text-muted-fg mt-1">Lancez un scan depuis la page Monitoring pour analyser vos containers.</p>
          </div>
          <button
            onClick={loadMockMonitoringData}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: 'hsl(220 20% 93%)', color: 'hsl(220 13% 40%)' }}
          >
            Charger les données de démonstration
          </button>
        </div>
      )}

      {/* ── Level 0 — Events matrix ─────────────────────────────────────────── */}
      {hasData && drill.level === 0 && (
        <MatrixTable containers={containers} firstColLabel="Event GA4">
          {filteredEventRows.length === 0 && <EmptyRow colSpan={2 + containers.length} message="Aucun event à afficher avec ces filtres." />}
          {filteredEventRows.map((row) => (
            <tr
              key={row.eventName}
              className="border-b transition-colors"
              style={{ borderColor: 'hsl(220 13% 93%)' }}
            >
              {/* Event name — clickable row label */}
              <td className="px-4 py-3 sticky left-0 z-10" style={{ backgroundColor: 'white', borderRight: '1px solid hsl(220 13% 91%)' }}>
                <button
                  onClick={() => drillToEvent(row.eventName)}
                  className="text-sm font-medium text-foreground hover:text-[hsl(213_94%_45%)] transition-colors text-left w-full flex items-center gap-1.5 group"
                >
                  {row.eventName}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'hsl(213 94% 50%)' }}>
                    <path d="M3 8l4-3-4-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </td>

              {/* Coverage */}
              <td className="px-3 py-3 w-36">
                <CoverageBar pct={row.coveragePercent} />
              </td>

              {/* Cells */}
              {containers.map((c) => {
                const cell = row.containers[c.containerId];
                if (!cell) return (
                  <td key={c.containerId} className="px-3 py-3">
                    <button
                      onClick={(e) => openCellActions(e, buildLevel0Actions(row.eventName, 0, c))}
                      className="w-6 h-6 flex items-center justify-center text-xs text-muted-fg hover:bg-[hsl(220_20%_95%)] rounded transition-colors"
                      title="Créer un tag GA4 dans ce container"
                    >—</button>
                  </td>
                );
                return (
                  <td key={c.containerId} className="px-3 py-3">
                    <button
                      onClick={(e) => {
                        if (cell.chainScore === 3) drillToEvent(row.eventName);
                        else openCellActions(e, buildLevel0Actions(row.eventName, cell.chainScore, c));
                      }}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all w-full text-left hover:shadow-sm"
                      style={{ backgroundColor: SCORE_BG[cell.chainScore], borderColor: SCORE_COLOR[cell.chainScore] + '44' }}
                      title={cell.chainScore === 3 ? 'Voir les déclencheurs' : SCORE_LABEL[cell.chainScore] + ' — cliquez pour agir'}
                    >
                      <ScoreDots
                        tagPresent={cell.tagPresent}
                        triggersMissing={cell.triggersMissing}
                        variablesTotal={cell.variablesTotal}
                        variablesMissing={cell.variablesMissing}
                      />
                      <span className="truncate text-muted-fg">{cell.chainScore === 0 ? '—' : SCORE_LABEL[cell.chainScore]}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </MatrixTable>
      )}

      {/* ── Level 1 — Triggers matrix ───────────────────────────────────────── */}
      {hasData && drill.level === 1 && (
        <MatrixTable containers={containers} firstColLabel="Déclencheur" minColWidth={160}>
          {triggerRows.length === 0 && <EmptyRow colSpan={2 + containers.length} message="Aucun déclencheur lié à cet event." />}
          {triggerRows.map((row) => (
            <tr
              key={row.triggerName}
              className="border-b transition-colors"
              style={{ borderColor: 'hsl(220 13% 93%)' }}
            >
              {/* Trigger name */}
              <td className="px-4 py-3 sticky left-0 z-10" style={{ backgroundColor: 'white', borderRight: '1px solid hsl(220 13% 91%)' }}>
                <button
                  onClick={() => drillToTrigger(row.triggerName)}
                  className="text-sm font-medium text-foreground hover:text-[hsl(213_94%_45%)] transition-colors text-left w-full flex items-center gap-1.5 group"
                >
                  <span className="truncate">{row.triggerName}</span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'hsl(213 94% 50%)' }}>
                    <path d="M3 8l4-3-4-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className="mt-0.5">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: 'hsl(267 60% 93%)', color: 'hsl(267 100% 40%)' }}>
                    {triggerTypeLabel(row.triggerType)}
                  </span>
                </div>
              </td>

              {/* Coverage */}
              <td className="px-3 py-3 w-36">
                <CoverageBar pct={row.coverage} />
              </td>

              {/* Cells */}
              {containers.map((c) => {
                const cell = row.cells[c.containerId];
                return (
                  <td key={c.containerId} className="px-3 py-3">
                    {cell ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'hsl(142 60% 96%)', border: '1px solid hsl(142 60% 80%)' }}>
                        <span style={{ color: 'hsl(142 60% 35%)' }}>✓</span>
                        <span className="truncate font-medium" style={{ color: 'hsl(142 60% 25%)' }}>{cell.name}</span>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => openCellActions(e, buildLevel1Actions(row.triggerName, c))}
                        className="w-6 h-6 flex items-center justify-center text-xs text-muted-fg hover:bg-[hsl(0_84%_96%)] hover:text-[hsl(0_84%_55%)] rounded transition-colors"
                        title="Créer ou copier ce déclencheur"
                      >—</button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </MatrixTable>
      )}

      {/* ── Level 2 — Variables matrix ──────────────────────────────────────── */}
      {hasData && drill.level === 2 && (
        <MatrixTable containers={containers} firstColLabel="Variable" minColWidth={140}>
          {varRows.length === 0 && <EmptyRow colSpan={2 + containers.length} message="Aucune variable référencée dans ce tag GA4." />}
          {varRows.map((row) => {
            const allOk = Object.values(row.cells).every(Boolean);
            const allMissing = !Object.values(row.cells).some(Boolean);
            return (
              <tr
                key={row.varName}
                className="border-b transition-colors"
                style={{ borderColor: 'hsl(220 13% 93%)' }}
              >
                {/* Variable name */}
                <td className="px-4 py-3 sticky left-0 z-10" style={{ backgroundColor: 'white', borderRight: '1px solid hsl(220 13% 91%)' }}>
                  <span className="text-xs font-mono font-medium" style={{ color: allMissing ? 'hsl(0 84% 50%)' : allOk ? 'hsl(142 60% 30%)' : 'hsl(220 13% 25%)' }}>
                    {`{{${row.varName}}}`}
                  </span>
                </td>

                {/* Coverage */}
                <td className="px-3 py-3 w-36">
                  <CoverageBar pct={row.coverage} />
                </td>

                {/* Cells */}
                {containers.map((c) => {
                  const ok = row.cells[c.containerId];
                  return (
                    <td key={c.containerId} className="px-3 py-3">
                      {ok ? (
                        <div
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                          style={{ backgroundColor: 'hsl(142 60% 96%)', color: 'hsl(142 60% 30%)', border: '1px solid hsl(142 60% 80%)' }}
                        >
                          <span>✓</span>
                          <span>Présente</span>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => openCellActions(e, buildLevel2Actions(row.varName, c))}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:shadow-sm"
                          style={{ backgroundColor: 'hsl(0 84% 97%)', color: 'hsl(0 84% 45%)', border: '1px solid hsl(0 84% 85%)' }}
                          title="Copier cette variable depuis un autre container"
                        >
                          <span>✗</span>
                          <span>Manquante</span>
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </MatrixTable>
      )}

      {/* ── Action popover ─────────────────────────────────────────────────── */}
      {popover && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-white rounded-xl shadow-xl py-1.5"
          style={{
            top: Math.min(popover.anchorRect.bottom + 6, window.innerHeight - 200),
            left: Math.min(popover.anchorRect.left, window.innerWidth - 240),
            minWidth: 228,
            border: '1px solid hsl(220 13% 91%)',
          }}
        >
          {popover.actions.map((action) => {
            const deps = computeCopyDependencies(action);
            return (
              <button
                key={action.id}
                onClick={() => {
                  const ts = Date.now();
                  const depWithIds = deps.map((d, i) => ({ ...d, id: `${ts}-dep-${i}` }));
                  const allNew = [action, ...depWithIds];
                  setActionQueue((prev) => {
                    const toAdd = allNew.filter(
                      (a) => !prev.some(
                        (p) => p.type === a.type && p.targetContainerId === a.targetContainerId &&
                          p.eventName === a.eventName && p.varName === a.varName && p.triggerName === a.triggerName,
                      ),
                    );
                    return [...prev, ...toAdd];
                  });
                  setPopover(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
                style={{ color: 'hsl(220 13% 20%)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'hsl(220 20% 97%)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ACTION_COLOR[action.type] }} />
                <div className="min-w-0">
                  <div className="font-medium">{ACTION_LABEL[action.type]}</div>
                  <div className="text-xs text-muted-fg truncate">
                    {action.sourceContainerName ? `depuis ${action.sourceContainerName}` : `dans ${action.targetContainerName}`}
                    {action.varName ? ` · {{${action.varName}}}` : ''}
                    {deps.length > 0 && (
                      <span className="ml-1" style={{ color: 'hsl(27 96% 50%)' }}>
                        {`+ ${deps.length} dép.`}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Action queue panel ─────────────────────────────────────────────── */}
      {actionQueue.length > 0 && (
        <div className="shrink-0 border-t" style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)' }}>
          <div className="px-6 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'hsl(220 13% 50%)' }}>
                Plan de déploiement ({actionQueue.length})
              </span>
              <button
                onClick={() => setActionQueue([])}
                className="text-xs transition-colors"
                style={{ color: 'hsl(220 13% 60%)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'hsl(220 13% 20%)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'hsl(220 13% 60%)'; }}
              >
                Tout effacer
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {actionQueue.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border"
                  style={{ backgroundColor: 'white', borderColor: 'hsl(220 13% 91%)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ACTION_COLOR[action.type] }} />
                  <span className="font-medium text-foreground">{ACTION_LABEL[action.type]}</span>
                  <span className="text-muted-fg">·</span>
                  <span className="text-foreground">{action.eventName}</span>
                  <span className="text-muted-fg">→</span>
                  <span className="font-medium text-foreground">{action.targetPublicId}</span>
                  {action.sourceContainerName && (
                    <span className="text-muted-fg">depuis {action.sourceContainerName}</span>
                  )}
                  {action.varName && (
                    <span className="font-mono text-muted-fg">{`{{${action.varName}}}`}</span>
                  )}
                  <button
                    onClick={() => setActionQueue((prev) => prev.filter((a) => a.id !== action.id))}
                    className="ml-0.5 transition-colors"
                    style={{ color: 'hsl(220 13% 70%)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'hsl(0 84% 55%)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'hsl(220 13% 70%)'; }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M7.5 2.5L2.5 7.5M2.5 2.5L7.5 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Legend (level 0 only) */}
      {hasData && drill.level === 0 && (
        <div className="px-6 py-2.5 border-t shrink-0 flex items-center gap-5 text-xs text-muted-fg" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          <span className="font-medium">Légende :</span>
          {([3, 2, 1, 0] as const).map((score) => (
            <span key={score} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SCORE_COLOR[score] }} />
              {SCORE_LABEL[score]}
            </span>
          ))}
          <span className="ml-auto">Cliquez un event pour explorer ses déclencheurs</span>
        </div>
      )}
      {hasData && drill.level === 1 && (
        <div className="px-6 py-2.5 border-t shrink-0 flex items-center gap-2 text-xs text-muted-fg" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          <span className="ml-auto">Cliquez un déclencheur pour explorer ses variables</span>
        </div>
      )}
    </div>
  );
}
