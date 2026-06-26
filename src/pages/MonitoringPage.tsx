import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { MONITORING_MOCK, type MonitoringContainerData } from '../data/monitoring-mock';
import { RenameDrawer, type ContainerOption } from '../components/monitoring/RenameDrawer';
import { VariableContentDrawer } from '../components/monitoring/VariableContentDrawer';
import { TagDrawer } from '../components/monitoring/TagDrawer';
import { ParamMatrixTab } from '../components/monitoring/ParamMatrixTab';
import { useGTMStore } from '../store/gtm-store';
import type { GTMTag, GTMTrigger, GTMVariable } from '../types/gtm';

// ─── Entity kind ───────────────────────────────────────────────────────────────

type EntityKind = 'tags' | 'triggers' | 'variables' | 'params';

// ─── Category configs per kind ─────────────────────────────────────────────────

interface CategoryConfig { label: string; color: string }

// Tags
const TAG_CATEGORIES: Record<string, CategoryConfig> = {
  'GA4':        { label: 'GA4',         color: 'hsl(213 94% 60%)' },
  'Google Ads': { label: 'Google Ads',  color: 'hsl(27 96% 55%)' },
  'Floodlight': { label: 'Floodlight',  color: 'hsl(36 100% 50%)' },
  'Kameleoon':  { label: 'Kameleoon',   color: 'hsl(267 100% 59%)' },
  'AB Tasty':   { label: 'AB Tasty',    color: 'hsl(340 82% 52%)' },
  'Meta Pixel': { label: 'Meta Pixel',  color: 'hsl(221 44% 41%)' },
  'TikTok':     { label: 'TikTok',      color: 'hsl(180 100% 30%)' },
  'Hotjar':     { label: 'Hotjar',      color: 'hsl(17 100% 54%)' },
  'HTML Custom':{ label: 'HTML Custom', color: 'hsl(220 13% 46%)' },
};

// Triggers
const TRIGGER_CATEGORIES: Record<string, CategoryConfig> = {
  pageview:     { label: 'Page Vue',      color: 'hsl(213 94% 55%)' },
  domReady:     { label: 'DOM Ready',     color: 'hsl(173 80% 36%)' },
  windowLoaded: { label: 'Window Loaded', color: 'hsl(142 60% 40%)' },
  customEvent:  { label: 'Custom Event',  color: 'hsl(267 100% 59%)' },
  click:        { label: 'Clic',          color: 'hsl(27 96% 55%)' },
  linkClick:    { label: 'Clic sur lien', color: 'hsl(17 100% 54%)' },
  scrollDepth:  { label: 'Scroll',        color: 'hsl(221 44% 50%)' },
};

// Variables
const VARIABLE_CATEGORIES: Record<string, CategoryConfig> = {
  v:   { label: 'Data Layer',  color: 'hsl(213 94% 55%)' },
  c:   { label: 'Constante',   color: 'hsl(142 60% 40%)' },
  jsm: { label: 'Custom JS',   color: 'hsl(46 100% 40%)' },
  u:   { label: 'URL',         color: 'hsl(27 96% 55%)' },
  k:   { label: 'Cookie',      color: 'hsl(340 82% 52%)' },
  aev: { label: 'Auto-Event',  color: 'hsl(267 100% 59%)' },
};

function getCategoryConfig(kind: EntityKind, type: string): CategoryConfig {
  if (kind === 'triggers') return TRIGGER_CATEGORIES[type] ?? { label: type, color: 'hsl(220 13% 46%)' };
  if (kind === 'variables') return VARIABLE_CATEGORIES[type] ?? { label: type, color: 'hsl(220 13% 46%)' };
  return TAG_CATEGORIES[type] ?? { label: type, color: 'hsl(220 13% 46%)' };
}

// ─── Category detection ────────────────────────────────────────────────────────

function detectTagCategory(tag: GTMTag): string {
  if (tag.type === 'gaawe' || tag.type === 'gaawc') return 'GA4';
  if (tag.type === 'awct') return 'Google Ads';
  if (tag.type === 'flc') return 'Floodlight';
  if (tag.type === 'html') {
    const html = (tag.parameter?.find((p) => p.key === 'html')?.value ?? '').toLowerCase();
    if (html.includes('kameleoon')) return 'Kameleoon';
    if (html.includes('abtasty')) return 'AB Tasty';
    if (html.includes("fbq(") || html.includes('facebook')) return 'Meta Pixel';
    if (html.includes('tiktok') || html.includes('ttq.load')) return 'TikTok';
    if (html.includes('hotjar') || html.includes('hjid')) return 'Hotjar';
    return 'HTML Custom';
  }
  return 'HTML Custom';
}

function getTagRowKey(tag: GTMTag, category: string): string {
  if (category === 'GA4' && tag.type === 'gaawe') {
    return tag.parameter?.find((p) => p.key === 'event_name')?.value ?? tag.name;
  }
  if (category === 'GA4' && tag.type === 'gaawc') return 'GA4 Configuration';
  return tag.name;
}

// ─── Matrix builder ────────────────────────────────────────────────────────────

interface MatrixCell { name: string; type: string }
interface MatrixRow {
  key: string;
  category: string;
  cells: Record<string, MatrixCell | null>;
}

function buildMatrix(
  kind: EntityKind,
  containers: MonitoringContainerData[],
  activeCategory: string,
  search: string,
): MatrixRow[] {
  const rowMap = new Map<string, MatrixRow>();
  const containerIds = containers.map((c) => c.containerId);

  for (const container of containers) {
    const entities =
      kind === 'tags' ? container.tags :
      kind === 'triggers' ? container.triggers :
      container.variables;

    for (const entity of entities) {
      let category: string;
      let rowKey: string;

      if (kind === 'tags') {
        category = detectTagCategory(entity as GTMTag);
        rowKey = getTagRowKey(entity as GTMTag, category);
      } else {
        // triggers and variables: category = type, rowKey = name
        category = entity.type;
        rowKey = entity.name;
      }

      if (activeCategory !== 'Tous' && category !== activeCategory) continue;

      const mapKey = `${category}::${rowKey}`;
      if (!rowMap.has(mapKey)) {
        rowMap.set(mapKey, {
          key: rowKey,
          category,
          cells: Object.fromEntries(containerIds.map((id) => [id, null])),
        });
      }
      rowMap.get(mapKey)!.cells[container.containerId] = { name: entity.name, type: entity.type };
    }
  }

  let rows = Array.from(rowMap.values());

  if (search.trim()) {
    const q = search.toLowerCase();
    rows = rows.filter((r) =>
      r.key.toLowerCase().includes(q) ||
      Object.values(r.cells).some((c) => c?.name.toLowerCase().includes(q)),
    );
  }

  // Sort by category order then name
  const categoryOrder = (kind: EntityKind) => (cat: string) => {
    const keys = Object.keys(
      kind === 'tags' ? TAG_CATEGORIES :
      kind === 'triggers' ? TRIGGER_CATEGORIES :
      VARIABLE_CATEGORIES,
    );
    const i = keys.indexOf(cat);
    return i === -1 ? 99 : i;
  };
  const order = categoryOrder(kind);
  rows.sort((a, b) => order(a.category) - order(b.category) || a.key.localeCompare(b.key));

  return rows;
}

// ─── Trigger semantic comparison ──────────────────────────────────────────────

function triggerSemanticKey(tr: GTMTrigger): string {
  if (tr.type === 'customEvent') {
    // Compare on the event name condition, not the trigger name
    const ev = tr.customEventFilter?.[0]?.parameter?.find((p) => p.key === 'arg1')?.value ?? '';
    return `customEvent::${ev}`;
  }
  if (tr.type === 'pageview' || tr.type === 'domReady' || tr.type === 'windowLoaded') {
    return tr.type;
  }
  // For click, scroll, etc. — normalize filter conditions
  const filterKey = (tr.filter ?? [])
    .map((c) => `${c.type}:${c.parameter.map((p) => p.value ?? '').sort().join(',')}`)
    .sort().join('|');
  return `${tr.type}::${filterKey}`;
}

function hasTriggerVariance(row: MatrixRow, containers: MonitoringContainerData[]): boolean {
  const presentSets: string[][] = [];
  for (const c of containers) {
    const cell = row.cells[c.containerId];
    if (!cell) continue; // tag absent — skip from comparison
    const tag = c.tags.find((t) => t.name === cell.name);
    if (!tag) continue;
    const triggerMap = new Map(c.triggers.filter((tr) => tr.triggerId).map((tr) => [tr.triggerId!, tr]));
    const keys = (tag.firingTriggerId ?? [])
      .flatMap((id) => { const tr = triggerMap.get(id); return tr ? [triggerSemanticKey(tr)] : []; })
      .sort();
    presentSets.push(keys);
  }
  if (presentSets.length <= 1) return false;
  const ref = presentSets[0].join('|');
  return !presentSets.every((s) => s.join('|') === ref);
}

function coverageStats(rows: MatrixRow[], containerIds: string[]) {
  let total = 0, present = 0;
  for (const row of rows) {
    for (const cid of containerIds) {
      total++;
      if (row.cells[cid]) present++;
    }
  }
  return { total, present, pct: total === 0 ? 100 : Math.round((present / total) * 100) };
}

// ─── Category filter bar ───────────────────────────────────────────────────────

function CategoryFilterBar({
  kind,
  rows,
  activeCategory,
  onChange,
}: {
  kind: EntityKind;
  rows: MatrixRow[];
  activeCategory: string;
  onChange: (cat: string) => void;
}) {
  const presentCategories = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) seen.add(r.category);
    const configs = kind === 'tags' ? TAG_CATEGORIES : kind === 'triggers' ? TRIGGER_CATEGORIES : VARIABLE_CATEGORIES;
    return Object.keys(configs).filter((k) => seen.has(k));
  }, [rows, kind]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => onChange('Tous')}
        className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
        style={activeCategory === 'Tous'
          ? { backgroundColor: 'hsl(220 13% 20%)', color: 'white' }
          : { backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 40%)' }}
      >
        Tous
      </button>
      {presentCategories.map((cat) => {
        const config = getCategoryConfig(kind, cat);
        const active = activeCategory === cat;
        return (
          <button
            key={cat}
            onClick={() => onChange(active ? 'Tous' : cat)}
            className="px-2.5 py-1 rounded-md text-xs font-medium transition-all border"
            style={active
              ? { backgroundColor: config.color + '22', color: config.color, borderColor: config.color + '55' }
              : { backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 40%)', borderColor: 'transparent' }}
          >
            {config.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Matrix table ──────────────────────────────────────────────────────────────

function MatrixTable({
  kind,
  rows,
  containers,
  pendingRenames,
  onRowClick,
}: {
  kind: EntityKind;
  rows: MatrixRow[];
  containers: MonitoringContainerData[];
  pendingRenames: ReturnType<typeof useGTMStore>['pendingRenames'];
  onRowClick: (row: MatrixRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-fg">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="2" y="2" width="28" height="28" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
          <path d="M10 16h12M16 10v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        </svg>
        <p className="text-sm">Aucun résultat</p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
          <th
            className="sticky left-0 z-10 text-left px-4 py-2.5 text-xs font-semibold text-muted-fg border-b border-r"
            style={{ minWidth: '220px', borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 97%)' }}
          >
            {kind === 'tags' ? 'Tag / Event' : kind === 'triggers' ? 'Déclencheur' : 'Variable'}
          </th>
          {containers.map((c) => (
            <th
              key={c.containerId}
              className="text-center px-3 py-2.5 text-xs font-semibold border-b border-r last:border-r-0"
              style={{ minWidth: '160px', borderColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 30%)' }}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span>{c.containerName}</span>
                <span className="font-mono text-[10px] opacity-60">{c.publicId}</span>
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const prevRow = rows[i - 1];
          const showCategoryHeader = !prevRow || prevRow.category !== row.category;
          const config = getCategoryConfig(kind, row.category);
          const rowRenames = pendingRenames.filter((r) => r.rowKey === row.key && r.category === row.category);
          const presentNames = Object.values(row.cells).filter(Boolean).map((c) => c!.name);
          const hasInconsistentNames = new Set(presentNames).size > 1;
          const hasTriggerDiff = kind === 'tags' && hasTriggerVariance(row, containers);

          return (
            <>
              {showCategoryHeader && (
                <tr key={`cat-${row.category}`} style={{ backgroundColor: 'hsl(220 20% 98%)' }}>
                  <td colSpan={containers.length + 1} className="px-4 py-1.5 border-b" style={{ borderColor: 'hsl(220 13% 91%)' }}>
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                      style={{ backgroundColor: config.color + '22', color: config.color }}
                    >
                      {config.label}
                    </span>
                  </td>
                </tr>
              )}
              <tr
                key={`${row.category}::${row.key}`}
                className="group hover:bg-card transition-colors cursor-pointer"
                onClick={() => onRowClick(row)}
              >
                <td
                  className="sticky left-0 z-10 px-4 py-2.5 border-b border-r"
                  style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'white' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground truncate flex-1">{row.key}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {hasInconsistentNames && (
                        <span
                          className="px-1 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: 'hsl(46 100% 50% / 0.15)', color: 'hsl(35 90% 40%)' }}
                        >
                          noms variés
                        </span>
                      )}
                      {hasTriggerDiff && (
                        <span
                          className="px-1 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 50%)' }}
                        >
                          déclencheurs variés
                        </span>
                      )}
                      {rowRenames.length > 0 && (
                        <span
                          className="px-1 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: 'hsl(267 100% 59% / 0.1)', color: 'hsl(267 80% 45%)' }}
                        >
                          {rowRenames.length} planifié{rowRenames.length > 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-fg">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </div>
                  </div>
                </td>
                {containers.map((c) => {
                  const cell = row.cells[c.containerId];
                  const queued = pendingRenames.find(
                    (r) => r.containerId === c.containerId && r.rowKey === row.key && r.category === row.category,
                  );
                  return (
                    <td
                      key={c.containerId}
                      className="px-2 py-2 border-b border-r last:border-r-0"
                      style={{ borderColor: 'hsl(220 13% 91%)' }}
                    >
                      {queued ? (
                        <div
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium"
                          style={{ backgroundColor: 'hsl(267 100% 59% / 0.08)', color: 'hsl(267 80% 40%)' }}
                          title={`${queued.oldName} → ${queued.newName}`}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1"/><path d="M5 3v2l1 1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
                          <span className="truncate max-w-[110px]">{queued.newName}</span>
                        </div>
                      ) : cell ? (
                        <div
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium"
                          style={{ backgroundColor: 'hsl(142 72% 95%)', color: 'hsl(142 60% 28%)' }}
                          title={cell.name}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0"><path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <span className="truncate max-w-[120px]">{cell.name}</span>
                        </div>
                      ) : (
                        <div
                          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium"
                          style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 55%)' }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          Absent
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            </>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Rename plan panel ─────────────────────────────────────────────────────────

function RenamePlanPanel({ onClose }: { onClose: () => void }) {
  const { pendingRenames, removeRename, clearRenames } = useGTMStore();
  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'hsl(220 13% 10% / 0.35)' }} onClick={onClose} />
      <div className="fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl" style={{ width: '440px', backgroundColor: 'white', borderLeft: '1px solid hsl(220 13% 91%)' }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Plan de renommage</h2>
            <p className="text-xs text-muted-fg mt-0.5">{pendingRenames.length} opération{pendingRenames.length > 1 ? 's' : ''} planifiée{pendingRenames.length > 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card transition-colors text-muted-fg">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {pendingRenames.map((op) => {
            const config = getCategoryConfig(
              op.category in TAG_CATEGORIES ? 'tags' : op.category in TRIGGER_CATEGORIES ? 'triggers' : 'variables',
              op.category,
            );
            return (
              <div key={op.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border" style={{ borderColor: 'hsl(220 13% 91%)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0"
                      style={{ backgroundColor: config.color + '22', color: config.color }}>{config.label}</span>
                    <span className="text-xs font-medium text-foreground truncate">{op.containerName}</span>
                    <span className="text-[10px] text-muted-fg font-mono shrink-0">{op.publicId}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    <span className="text-muted-fg truncate max-w-[140px]" title={op.oldName}>{op.oldName}</span>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-muted-fg"><path d="M2.5 5h5M5.5 2.5L8 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span className="font-semibold truncate max-w-[140px]" style={{ color: config.color }} title={op.newName}>{op.newName}</span>
                  </div>
                </div>
                <button onClick={() => removeRename(op.id)} className="p-1 rounded hover:bg-card text-muted-fg hover:text-foreground transition-colors shrink-0 mt-0.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t space-y-2" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs" style={{ backgroundColor: 'hsl(267 100% 59% / 0.08)', color: 'hsl(267 80% 40%)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 mt-0.5"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/><path d="M6 4v2.5M6 8v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
            Sera exécuté via l'API GTM après configuration GCP OAuth.
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { clearRenames(); onClose(); }} className="flex-1 px-4 py-2 text-xs rounded-lg border transition-colors text-muted-fg hover:text-foreground" style={{ borderColor: 'hsl(220 13% 85%)' }}>
              Tout effacer
            </button>
            <button disabled className="flex-1 px-4 py-2 text-xs font-medium rounded-lg text-white opacity-40 cursor-not-allowed" style={{ backgroundColor: 'hsl(267 100% 59%)' }} title="Nécessite GCP OAuth">
              Appliquer (OAuth requis)
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<EntityKind, string> = {
  tags: 'Tags',
  triggers: 'Déclencheurs',
  variables: 'Variables',
  params: 'Paramètres envoyés',
};

export function MonitoringPage() {
  const { pendingRenames, addRenames } = useGTMStore();
  const [activeKind, setActiveKind] = useState<EntityKind>('tags');
  const [activeCategory, setActiveCategory] = useState<string>('Tous');
  const [search, setSearch] = useState('');
  const [renameRow, setRenameRow] = useState<MatrixRow | null>(null);
  const [contentRow, setContentRow] = useState<MatrixRow | null>(null);
  const [tagRow, setTagRow] = useState<MatrixRow | null>(null);
  const [showPlan, setShowPlan] = useState(false);

  const containers: MonitoringContainerData[] = MONITORING_MOCK;
  const containerIds = containers.map((c) => c.containerId);

  // Reset filters when switching kind
  function switchKind(kind: EntityKind) {
    setActiveKind(kind);
    setActiveCategory('Tous');
    setSearch('');
    setSelectedRow(null);
  }

  const matrixKind = activeKind === 'params' ? 'tags' : activeKind;

  const allRowsForKind = useMemo(
    () => buildMatrix(matrixKind, containers, 'Tous', ''),
    [matrixKind],
  );

  const rows = useMemo(
    () => buildMatrix(matrixKind, containers, activeCategory, search),
    [matrixKind, activeCategory, search],
  );

  const stats = useMemo(() => coverageStats(rows, containerIds), [rows, containerIds]);
  const pendingCount = pendingRenames.filter((r) => r.status === 'pending').length;

  function buildContainerOptions(row: MatrixRow): ContainerOption[] {
    return containers.map((c) => ({
      containerId: c.containerId,
      containerName: c.containerName,
      publicId: c.publicId,
      currentName: row.cells[c.containerId]?.name ?? null,
    }));
  }

  function handleRowClick(row: MatrixRow) {
    setShowPlan(false);
    if (activeKind === 'variables') {
      setContentRow(row); setRenameRow(null); setTagRow(null);
    } else if (activeKind === 'tags') {
      setTagRow(row); setRenameRow(null); setContentRow(null);
    } else {
      setRenameRow(row); setContentRow(null); setTagRow(null);
    }
  }

  const renameRowConfig = renameRow ? getCategoryConfig(activeKind, renameRow.category) : null;

  // Per-kind counts for tabs
  const kindCounts = useMemo(() => {
    const ga4Events = new Set<string>();
    for (const c of containers) {
      for (const tag of c.tags) {
        if (tag.type === 'gaawe') {
          const ev = tag.parameter?.find((p) => p.key === 'event_name')?.value;
          if (ev) ga4Events.add(ev);
        }
      }
    }
    return {
      tags: buildMatrix('tags', containers, 'Tous', '').length,
      triggers: buildMatrix('triggers', containers, 'Tous', '').length,
      variables: buildMatrix('variables', containers, 'Tous', '').length,
      params: ga4Events.size,
    };
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b shrink-0" style={{ borderColor: 'hsl(220 13% 91%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Monitoring — Couverture</h1>
            <p className="text-xs text-muted-fg mt-0.5">Visualisez la présence de chaque entité · cliquez une ligne pour renommer</p>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <button
                onClick={() => setShowPlan(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                style={{ backgroundColor: 'hsl(267 100% 59% / 0.12)', color: 'hsl(267 80% 45%)' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.25"/><path d="M5 3v2l1.5 1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
                {pendingCount} renommage{pendingCount > 1 ? 's' : ''} planifié{pendingCount > 1 ? 's' : ''}
              </button>
            )}
            <span
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium"
              style={{ backgroundColor: 'hsl(46 100% 50% / 0.12)', color: 'hsl(35 90% 45%)' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.25"/><path d="M5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              Mode aperçu
            </span>
            <button
              disabled
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-40 cursor-not-allowed"
              style={{ backgroundColor: 'hsl(267 100% 59%)', color: 'white' }}
              title="Nécessite GCP OAuth"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.25"/><path d="M6 3v3l2 1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              Scanner
            </button>
          </div>
        </div>

        {/* Kind tabs */}
        <div className="flex items-center gap-1 mt-4">
          {(Object.keys(KIND_LABELS) as EntityKind[]).map((kind) => (
            <button
              key={kind}
              onClick={() => switchKind(kind)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                activeKind === kind
                  ? 'border-transparent shadow-sm'
                  : 'border-transparent text-muted-fg hover:text-foreground hover:bg-card',
              )}
              style={activeKind === kind ? { backgroundColor: 'hsl(267 100% 59%)', color: 'white' } : {}}
            >
              {KIND_LABELS[kind]}
              <span
                className={clsx(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
                  activeKind === kind ? 'bg-white/20 text-white' : 'text-muted-fg',
                )}
                style={activeKind !== kind ? { backgroundColor: 'hsl(220 13% 91%)' } : {}}
              >
                {kindCounts[kind]}
              </span>
            </button>
          ))}

          {activeKind !== 'params' && <div className="mx-3 h-4 w-px" style={{ backgroundColor: 'hsl(220 13% 88%)' }} />}

          {/* Coverage for active kind */}
          {activeKind !== 'params' && <div className="flex items-center gap-1.5 text-xs">
            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(220 13% 91%)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${stats.pct}%`,
                  backgroundColor: stats.pct >= 80 ? 'hsl(142 60% 45%)' : stats.pct >= 50 ? 'hsl(46 100% 50%)' : 'hsl(0 70% 55%)',
                }}
              />
            </div>
            <span className="font-semibold text-muted-fg">{stats.pct}%</span>
            {(stats.total - stats.present) > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 50%)' }}>
                {stats.total - stats.present} absent{stats.total - stats.present > 1 ? 's' : ''}
              </span>
            )}
          </div>}
        </div>
      </div>

      {/* Filters + Search — hidden on params tab */}
      {activeKind !== 'params' && (
        <div
          className="px-6 py-3 flex items-center gap-3 border-b shrink-0 flex-wrap"
          style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)' }}
        >
          <CategoryFilterBar
            kind={activeKind as 'tags' | 'triggers' | 'variables'}
            rows={allRowsForKind}
            activeCategory={activeCategory}
            onChange={setActiveCategory}
          />
          <div className="flex-1" />
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-fg" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.25"/>
              <path d="M7.5 7.5l2 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={activeKind === 'tags' ? 'add_to_cart, tag name…' : activeKind === 'triggers' ? 'DL - purchase…' : 'DLV - ecommerce…'}
              className="pl-7 pr-3 py-1.5 text-xs rounded-lg border outline-none w-52"
              style={{ borderColor: 'hsl(220 13% 85%)', backgroundColor: 'white', color: 'hsl(220 13% 20%)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-fg hover:text-foreground">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Matrix or Params tab */}
      {activeKind === 'params' ? (
        <ParamMatrixTab containers={containers} />
      ) : (
        <>
          <div className="flex-1 overflow-auto">
            <MatrixTable
              kind={activeKind}
              rows={rows}
              containers={containers}
              pendingRenames={pendingRenames}
              onRowClick={handleRowClick}
            />
          </div>
          <div
            className="px-6 py-2.5 border-t flex items-center gap-2 shrink-0 text-xs"
            style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)', color: 'hsl(220 13% 45%)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/><path d="M6 4v2.5M6 8v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
            {activeKind === 'variables'
              ? 'Données simulées · cliquez une ligne pour comparer le contenu · bouton Renommer dans le drawer'
              : 'Données simulées · cliquez une ligne pour renommer · badge violet = plan de renommage'}
          </div>
        </>
      )}

      {/* Tag Drawer (Déclencheurs + Renommer) */}
      {tagRow && (
        <TagDrawer
          rowKey={tagRow.key}
          category={tagRow.category}
          categoryColor={getCategoryConfig('tags', tagRow.category).color}
          cells={tagRow.cells}
          containers={containers}
          existingRenames={pendingRenames.filter((r) => r.rowKey === tagRow.key && r.category === tagRow.category)}
          onSave={(ops) => addRenames(ops)}
          onClose={() => setTagRow(null)}
        />
      )}

      {/* Variable Content Drawer */}
      {contentRow && (
        <VariableContentDrawer
          rowKey={contentRow.key}
          varType={contentRow.category}
          typeColor={getCategoryConfig('variables', contentRow.category).color}
          typeLabel={getCategoryConfig('variables', contentRow.category).label}
          containers={containers}
          onClose={() => setContentRow(null)}
          onRename={() => { setRenameRow(contentRow); setContentRow(null); }}
        />
      )}

      {/* Rename Drawer */}
      {renameRow && renameRowConfig && (
        <RenameDrawer
          rowKey={renameRow.key}
          category={renameRow.category}
          categoryColor={renameRowConfig.color}
          options={buildContainerOptions(renameRow)}
          existingRenames={pendingRenames.filter(
            (r) => r.rowKey === renameRow.key && r.category === renameRow.category,
          )}
          onSave={(ops) => addRenames(ops)}
          onClose={() => setRenameRow(null)}
        />
      )}

      {/* Rename Plan Panel */}
      {showPlan && <RenamePlanPanel onClose={() => setShowPlan(false)} />}
    </div>
  );
}
