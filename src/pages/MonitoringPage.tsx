import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { clsx } from 'clsx';
import type { MonitoringContainerData } from '../data/monitoring-mock';
import { generateMonitoringReport } from '../lib/export-monitoring';
import { useAuthStore } from '../store/auth-store';
import { RenameDrawer, type ContainerOption } from '../components/monitoring/RenameDrawer';
import { VariableContentDrawer } from '../components/monitoring/VariableContentDrawer';
import { TagDrawer } from '../components/monitoring/TagDrawer';
import { ParamMatrixTab } from '../components/monitoring/ParamMatrixTab';
import { CleaningTab } from '../components/monitoring/CleaningTab';
import { DistributionTab } from '../components/monitoring/DistributionTab';
import { RecommendationsTab, countCriticalRecommendations } from '../components/monitoring/RecommendationsTab';
import { BulkRenameModal, type BulkRenamePreview } from '../components/monitoring/BulkRenameModal';
import { TagTypeIcon } from '../components/monitoring/TagTypeIcon';
import { useGTMStore, MONITORING_BATCH_SIZE } from '../store/gtm-store';
import type { GTMTag, GTMTrigger } from '../types/gtm';

// ─── Entity kind ───────────────────────────────────────────────────────────────

type EntityKind = 'tags' | 'triggers' | 'variables' | 'params' | 'distribution' | 'cleaning' | 'recommendations';

// ─── Category configs per kind ─────────────────────────────────────────────────

interface CategoryConfig { label: string; color: string }

// Tags
const TAG_CATEGORIES: Record<string, CategoryConfig> = {
  'GA4':        { label: 'GA4',         color: 'var(--color-ga4)' },
  'Google Ads': { label: 'Google Ads',  color: 'var(--color-warning)' },
  'Floodlight': { label: 'Floodlight',  color: 'var(--color-floodlight)' },
  'Kameleoon':  { label: 'Kameleoon',   color: 'var(--color-primary)' },
  'AB Tasty':   { label: 'AB Tasty',    color: 'var(--color-abtasty)' },
  'Meta Pixel': { label: 'Meta Pixel',  color: 'var(--color-meta)' },
  'TikTok':     { label: 'TikTok',      color: 'var(--color-tiktok)' },
  'Hotjar':     { label: 'Hotjar',      color: 'var(--color-hotjar)' },
  'HTML Custom':{ label: 'HTML Custom', color: 'var(--color-muted-fg)' },
  'Legacy UA':  { label: 'Legacy UA',   color: 'hsl(27 70% 50%)' },
};

// Triggers
const TRIGGER_CATEGORIES: Record<string, CategoryConfig> = {
  pageview:          { label: 'Page Vue',      color: 'var(--color-ga4)' },
  domReady:          { label: 'DOM Ready',     color: 'var(--color-dom-ready)' },
  windowLoaded:      { label: 'Window Loaded', color: 'var(--color-success)' },
  customEvent:       { label: 'Custom Event',  color: 'var(--color-primary)' },
  click:             { label: 'Clic',          color: 'var(--color-warning)' },
  linkClick:         { label: 'Clic sur lien', color: 'var(--color-link-click)' },
  scrollDepth:       { label: 'Scroll',        color: 'var(--color-scroll)' },
  historyChange:     { label: 'Historique',    color: 'var(--color-auto-event)' },
  formSubmit:        { label: 'Formulaire',    color: 'hsl(142 60% 38%)' },
  timer:             { label: 'Minuterie',     color: 'var(--color-muted-fg)' },
  elementVisibility: { label: 'Visibilité',    color: 'var(--color-link-click)' },
  youTubeVideo:      { label: 'YouTube',       color: 'hsl(0 100% 40%)' },
};

// Variables
const VARIABLE_CATEGORIES: Record<string, CategoryConfig> = {
  v:    { label: 'Data Layer',    color: 'var(--color-ga4)' },
  c:    { label: 'Constante',     color: 'var(--color-success)' },
  jsm:  { label: 'Custom JS',     color: 'var(--color-js-custom)' },
  u:    { label: 'URL',           color: 'var(--color-warning)' },
  k:    { label: 'Cookie',        color: 'var(--color-cookie)' },
  aev:  { label: 'Auto-Event',    color: 'var(--color-primary)' },
  smm:  { label: 'Lookup Table',  color: 'hsl(270 70% 55%)' },
  regx: { label: 'Regex Table',   color: 'hsl(270 50% 50%)' },
  j:    { label: 'Variable JS',   color: 'var(--color-js-custom)' },
  d:    { label: 'Élément DOM',   color: 'var(--color-dom-ready)' },
};

function getCategoryConfig(kind: EntityKind, type: string): CategoryConfig {
  if (kind === 'triggers') return TRIGGER_CATEGORIES[type] ?? { label: type, color: 'var(--color-muted-fg)' };
  if (kind === 'variables') return VARIABLE_CATEGORIES[type] ?? { label: type, color: 'var(--color-muted-fg)' };
  return TAG_CATEGORIES[type] ?? { label: type, color: 'var(--color-muted-fg)' };
}

// ─── Category detection ────────────────────────────────────────────────────────

function detectTagCategory(tag: GTMTag): string {
  if (tag.type === 'gaawe' || tag.type === 'gaawc') return 'GA4';
  if (tag.type === 'awct' || tag.type === 'awrk') return 'Google Ads';
  if (tag.type === 'flc') return 'Floodlight';
  // Legacy Universal Analytics tag type
  if (tag.type === 'ua') return 'Legacy UA';
  if (tag.type === 'html') {
    const html = (tag.parameter?.find((p) => p.key === 'html')?.value ?? '').toLowerCase();
    // Legacy UA detection in custom HTML
    if (html.includes('analytics.js') || /ua-\d{4,}-\d+/.test(html)) return 'Legacy UA';
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
    return tag.parameter?.find((p) => p.key === 'event_name' || p.key === 'eventName')?.value ?? tag.name;
  }
  if (category === 'GA4' && tag.type === 'gaawc') return 'GA4 Configuration';
  return tag.name;
}

// ─── Matrix builder ────────────────────────────────────────────────────────────

interface MatrixCell { name: string; type: string; hasExceptions?: boolean }
export interface MatrixRow {
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
      const hasExceptions = kind === 'tags'
        ? ((entity as GTMTag).blockingTriggerId?.length ?? 0) > 0
        : undefined;
      rowMap.get(mapKey)!.cells[container.containerId] = { name: entity.name, type: entity.type, ...(hasExceptions !== undefined && { hasExceptions }) };
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
  hiddenContainers,
  pendingRenames,
  onRowClick,
  onRemoveContainer,
  onAddContainer,
  onCellCreate,
  selectedRowKeys,
  onToggleRow,
  onToggleAll,
  onToggleCategoryRows,
}: {
  kind: EntityKind;
  rows: MatrixRow[];
  containers: MonitoringContainerData[];
  hiddenContainers: MonitoringContainerData[];
  pendingRenames: import('../types/gtm').RenameOperation[];
  onRowClick: (row: MatrixRow) => void;
  onRemoveContainer: (id: string) => void;
  onAddContainer: (id: string) => void;
  onCellCreate?: (row: MatrixRow, containerId: string, containerName: string) => void;
  selectedRowKeys: Set<string>;
  onToggleRow: (key: string) => void;
  onToggleAll: () => void;
  onToggleCategoryRows: (keys: string[], selectAll: boolean) => void;
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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rows.length > 0 && selectedRowKeys.size === rows.length}
                onChange={onToggleAll}
                className="rounded cursor-pointer"
                title="Sélectionner tout"
                onClick={(e) => e.stopPropagation()}
              />
              {kind === 'tags' ? 'Tag / Event' : kind === 'triggers' ? 'Déclencheur' : 'Variable'}
            </div>
          </th>
          {containers.map((c) => (
            <th
              key={c.containerId}
              className="text-center px-3 py-2.5 text-xs font-semibold border-b border-r group/th"
              style={{ minWidth: '160px', borderColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 30%)' }}
            >
              <div className="flex flex-col items-center gap-0.5 relative">
                <span>{c.containerName}</span>
                <span className="font-mono text-[10px] opacity-60">{c.publicId}</span>
                {containers.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveContainer(c.containerId); }}
                    title="Masquer ce container"
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover/th:opacity-100 transition-opacity"
                    style={{ backgroundColor: 'hsl(220 13% 85%)', color: 'hsl(220 13% 40%)' }}
                  >
                    <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                      <path d="M1 1l5 5M6 1L1 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
            </th>
          ))}
          {hiddenContainers.length > 0 && (
            <th
              className="text-center px-2 py-2.5 border-b"
              style={{ minWidth: '48px', borderColor: 'hsl(220 13% 91%)' }}
            >
              <div className="relative group/add">
                <button
                  className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-colors"
                  style={{ backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 45%)' }}
                  title="Ajouter un container"
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
                {/* Dropdown */}
                <div
                  className="absolute right-0 top-full mt-1 z-20 rounded-lg shadow-lg border py-1 hidden group-hover/add:block"
                  style={{ backgroundColor: 'white', borderColor: 'hsl(220 13% 88%)', minWidth: '180px' }}
                >
                  {hiddenContainers.map((hc) => (
                    <button
                      key={hc.containerId}
                      onClick={() => onAddContainer(hc.containerId)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors"
                      style={{ color: 'hsl(220 13% 25%)' }}
                    >
                      <div className="font-medium">{hc.containerName}</div>
                      <div className="font-mono opacity-50 text-[10px]">{hc.publicId}</div>
                    </button>
                  ))}
                </div>
              </div>
            </th>
          )}
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
          const hasAnyExceptions = kind === 'tags' && Object.values(row.cells).some((c) => c?.hasExceptions);
          const isLegacy = kind === 'tags' && row.category === 'Legacy UA';

          return (
            <Fragment key={`${row.category}::${row.key}`}>
              {showCategoryHeader && (() => {
                const catRows = rows.filter((r) => r.category === row.category);
                const catKeys = catRows.map((r) => r.key);
                const allCatSel = catKeys.length > 0 && catKeys.every((k) => selectedRowKeys.has(k));
                const someCatSel = catKeys.some((k) => selectedRowKeys.has(k));
                return (
                  <tr key={`cat-${row.category}`} style={{ backgroundColor: 'hsl(220 20% 98%)' }}>
                    <td colSpan={containers.length + 1} className="px-4 py-1.5 border-b" style={{ borderColor: 'hsl(220 13% 91%)' }}>
                      <span className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={allCatSel}
                          ref={(el) => { if (el) el.indeterminate = someCatSel && !allCatSel; }}
                          onChange={() => onToggleCategoryRows(catKeys, !allCatSel)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded cursor-pointer"
                          title={`Sélectionner tous les ${config.label}`}
                        />
                        {kind === 'tags' && <TagTypeIcon category={row.category} size={16} />}
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                          style={{ backgroundColor: config.color + '22', color: config.color }}
                        >
                          {config.label}
                        </span>
                        {someCatSel && (
                          <span className="text-[10px] text-muted-fg">
                            {catKeys.filter((k) => selectedRowKeys.has(k)).length}/{catKeys.length}
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })()}
              <tr
                key={`${row.category}::${row.key}`}
                className="group hover:bg-card transition-colors cursor-pointer"
                style={selectedRowKeys.has(row.key) ? { backgroundColor: 'hsl(267 100% 59% / 0.05)' } : {}}
                onClick={() => onRowClick(row)}
              >
                <td
                  className="sticky left-0 z-10 px-4 py-2.5 border-b border-r"
                  style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: selectedRowKeys.has(row.key) ? 'hsl(267 100% 59% / 0.05)' : 'white' }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedRowKeys.has(row.key)}
                      onChange={() => onToggleRow(row.key)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded cursor-pointer shrink-0"
                    />
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
                      {hasAnyExceptions && (
                        <span
                          className="px-1 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: 'hsl(213 94% 96%)', color: 'hsl(213 80% 40%)' }}
                          title="Ce tag a des déclencheurs d'exception (blocking triggers)"
                        >
                          exceptions
                        </span>
                      )}
                      {isLegacy && (
                        <span
                          className="px-1 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: 'hsl(27 70% 95%)', color: 'hsl(27 70% 40%)' }}
                          title="Tag Universal Analytics — à supprimer après migration GA4"
                        >
                          legacy
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
                          className="group/absent flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors"
                          style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 55%)', cursor: onCellCreate ? 'pointer' : 'default' }}
                          onClick={onCellCreate ? (e) => { e.stopPropagation(); onCellCreate(row, c.containerId, c.containerName); } : undefined}
                          title={onCellCreate ? `Créer ce tag dans ${c.containerName}` : undefined}
                        >
                          <svg
                            className="group-hover/absent:hidden"
                            width="10" height="10" viewBox="0 0 10 10" fill="none"
                          >
                            <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          <svg
                            className="hidden group-hover/absent:block"
                            width="10" height="10" viewBox="0 0 10 10" fill="none"
                          >
                            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          <span className="group-hover/absent:hidden">Absent</span>
                          <span className="hidden group-hover/absent:inline">Créer</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            </Fragment>
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

// ─── Trigger ops panel ────────────────────────────────────────────────────────

function OpCard({ op, onCancel, onDelete }: {
  op: import('../types/gtm').TriggerOperation;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const isPending = op.status === 'pending';
  const isCancelled = op.status === 'cancelled';
  const isApplied = op.status === 'applied';

  return (
    <div
      className="flex items-start gap-3 px-3 py-2.5 rounded-lg border"
      style={{
        borderColor: isPending ? 'hsl(220 13% 88%)' : isCancelled ? 'hsl(220 13% 93%)' : 'hsl(142 60% 75%)',
        backgroundColor: isCancelled ? 'hsl(220 20% 98%)' : isApplied ? 'hsl(142 72% 97%)' : 'white',
        opacity: isCancelled ? 0.55 : 1,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0"
            style={{ backgroundColor: op.kind === 'remove' ? 'hsl(0 85% 97%)' : 'hsl(142 72% 95%)', color: op.kind === 'remove' ? 'hsl(0 70% 50%)' : 'hsl(142 60% 28%)' }}
          >
            {op.kind === 'remove' ? 'Retrait' : 'Sync'}
          </span>
          <span className="text-xs font-medium text-foreground truncate">{op.tagRowKey}</span>
          <span className="text-[10px] text-muted-fg shrink-0">{op.tagCategory}</span>
          {!isPending && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium"
              style={{
                backgroundColor: isCancelled ? 'hsl(220 13% 91%)' : 'hsl(142 60% 93%)',
                color: isCancelled ? 'hsl(220 13% 45%)' : 'hsl(142 50% 30%)',
              }}>
              {isCancelled ? 'Annulée' : 'Effectuée'}
            </span>
          )}
        </div>
        {op.triggerName && (
          <p className="text-[11px] font-mono mb-1" style={{ color: 'hsl(220 13% 35%)' }}>
            Retirer : {op.triggerName}
          </p>
        )}
        <div className="space-y-0.5">
          {op.steps.map((step, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'hsl(220 13% 50%)' }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="shrink-0"><circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1"/></svg>
              <span className="font-medium">{step.containerName}</span>
              <span className="font-mono">{step.publicId}</span>
              {step.unlink && step.unlink.length > 0 && (
                <span style={{ color: 'hsl(0 65% 50%)' }}>− {step.unlink.length}</span>
              )}
              {step.linkExisting && step.linkExisting.length > 0 && (
                <span style={{ color: 'hsl(213 94% 45%)' }}>~ {step.linkExisting.length}</span>
              )}
              {step.createAndLink && step.createAndLink.length > 0 && (
                <span style={{ color: 'hsl(142 60% 35%)' }}>+ {step.createAndLink.length}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      {isPending && onCancel && (
        <button onClick={onCancel} className="p-1 rounded hover:bg-card text-muted-fg hover:text-foreground transition-colors shrink-0 mt-0.5" title="Annuler">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
        </button>
      )}
      {!isPending && onDelete && (
        <button onClick={onDelete} className="p-1 rounded hover:bg-card text-muted-fg hover:text-foreground transition-colors shrink-0 mt-0.5" title="Supprimer de l'historique">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
        </button>
      )}
    </div>
  );
}

function TriggerOpsPlanPanel({ onClose }: { onClose: () => void }) {
  const { pendingTriggerOps, removeTriggerOp, cancelTriggerOp, clearTriggerOps } = useGTMStore();
  const pending = pendingTriggerOps.filter((op) => op.status === 'pending');
  const history = pendingTriggerOps.filter((op) => op.status !== 'pending');

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'hsl(220 13% 10% / 0.35)' }} onClick={onClose} />
      <div className="fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl" style={{ width: '440px', backgroundColor: 'white', borderLeft: '1px solid hsl(220 13% 91%)' }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Actions déclencheurs</h2>
            <p className="text-xs text-muted-fg mt-0.5">
              {pending.length > 0 ? `${pending.length} planifiée${pending.length > 1 ? 's' : ''}` : 'Aucune action en attente'}
              {history.length > 0 ? ` · ${history.length} dans l'historique` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card transition-colors text-muted-fg">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {pending.length === 0 && history.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-fg">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" opacity=".35"/><path d="M9 14l3.5 3.5L19 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".6"/></svg>
              <p className="text-xs">Aucune action planifiée</p>
            </div>
          )}

          {/* Pending ops */}
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">En attente</p>
              {pending.map((op) => (
                <OpCard key={op.id} op={op} onCancel={() => cancelTriggerOp(op.id)} />
              ))}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">Historique</p>
                <button onClick={() => history.forEach((op) => removeTriggerOp(op.id))}
                  className="text-[10px] text-muted-fg hover:text-foreground underline decoration-dotted">
                  Effacer
                </button>
              </div>
              {history.map((op) => (
                <OpCard key={op.id} op={op} onDelete={() => removeTriggerOp(op.id)} />
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t space-y-2" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          {pending.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs" style={{ backgroundColor: 'hsl(0 70% 50% / 0.07)', color: 'hsl(0 65% 45%)' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 mt-0.5"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/><path d="M6 4v2.5M6 8v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              Sera exécuté via l'API GTM après configuration GCP OAuth.
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { clearTriggerOps(); onClose(); }}
              className="flex-1 px-4 py-2 text-xs rounded-lg border transition-colors text-muted-fg hover:text-foreground"
              style={{ borderColor: 'hsl(220 13% 85%)' }}
            >
              Tout effacer
            </button>
            <button
              disabled
              className="flex-1 px-4 py-2 text-xs font-medium rounded-lg text-white opacity-40 cursor-not-allowed"
              style={{ backgroundColor: 'hsl(0 70% 50%)' }}
              title="Nécessite GCP OAuth"
            >
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
  distribution: 'Distribution',
  cleaning: 'Nettoyage',
  recommendations: 'Recommandations',
};

export function MonitoringPage() {
  const { pendingRenames, addRenames, pendingTriggerOps, pendingDeletions,
    monitoringData, isLoadingMonitoring, monitoringError, monitoringScanProgress,
    scanMonitoring, cancelMonitoringScan, clearMonitoringData,
    selectedContainerIds, containers: allContainers } = useGTMStore();
  const { accessToken } = useAuthStore();

  const isPreview = monitoringData.length === 0;
  const hasSelection = selectedContainerIds.size > 0;

  // Batch scan stats
  const scannedIds = new Set(monitoringData.map((d) => d.containerId));
  const selectedContainersList = allContainers.filter((c) => selectedContainerIds.has(c.containerId));
  const remainingContainers = selectedContainersList.filter((c) => !scannedIds.has(c.containerId));
  const remainingCount = remainingContainers.length;
  const nextBatchSize = Math.min(remainingCount, MONITORING_BATCH_SIZE);
  const hasPendingBatch = !isLoadingMonitoring && remainingCount > 0 && monitoringData.length > 0;
  const scanWillBeLarge = selectedContainerIds.size > MONITORING_BATCH_SIZE && isPreview;
  const estimatedMinutes = Math.ceil((nextBatchSize * 8) / 60);

  // Staleness — warn if oldest scan in the loaded data is > 24h
  const latestScanMs = monitoringData.length > 0
    ? Math.max(...monitoringData.map((d) => new Date(d.scannedAt).getTime()))
    : null;
  const staleHours = latestScanMs !== null
    ? Math.floor((Date.now() - latestScanMs) / (1000 * 60 * 60))
    : null;
  const isStale = staleHours !== null && staleHours >= 24;
  const [activeKind, setActiveKind] = useState<EntityKind>('tags');
  const [activeCategory, setActiveCategory] = useState<string>('Tous');
  const [search, setSearch] = useState('');
  const [renameRow, setRenameRow] = useState<MatrixRow | null>(null);
  const [contentRow, setContentRow] = useState<MatrixRow | null>(null);
  const [tagRow, setTagRow] = useState<MatrixRow | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [showTriggerOps, setShowTriggerOps] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [showBulkRename, setShowBulkRename] = useState(false);
  const [quickCreateTarget, setQuickCreateTarget] = useState<{ row: MatrixRow; containerId: string; containerName: string } | null>(null);
  const [showContainerFilter, setShowContainerFilter] = useState(false);
  const containerFilterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showContainerFilter) return;
    function handleClick(e: MouseEvent) {
      if (containerFilterRef.current && !containerFilterRef.current.contains(e.target as Node)) {
        setShowContainerFilter(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showContainerFilter]);

  const sourceData = monitoringData;

  // Track containers explicitly hidden by the user (via the × button on column headers).
  // Everything NOT in this set is visible — new scan data shows up automatically.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const containers: MonitoringContainerData[] = sourceData.filter((c) => !hiddenIds.has(c.containerId));
  const hiddenContainers: MonitoringContainerData[] = sourceData.filter((c) => hiddenIds.has(c.containerId));
  const containerIds = containers.map((c) => c.containerId);

  function removeContainer(id: string) {
    if (containers.length <= 1) return;
    setHiddenIds((prev) => new Set([...prev, id]));
  }
  function addContainer(id: string) {
    setHiddenIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  // Reset filters when switching kind
  function switchKind(kind: EntityKind) {
    setActiveKind(kind);
    setActiveCategory('Tous');
    setSearch('');
    setSelectedRowKeys(new Set());
  }

  const matrixKind = (activeKind === 'params' || activeKind === 'cleaning' || activeKind === 'distribution' || activeKind === 'recommendations') ? 'tags' : activeKind;

  const allRowsForKind = useMemo(
    () => buildMatrix(matrixKind, containers, 'Tous', ''),
    [matrixKind, containers],
  );

  const rows = useMemo(
    () => buildMatrix(matrixKind, containers, activeCategory, search),
    [matrixKind, containers, activeCategory, search],
  );

  const selectedRows = useMemo(() => rows.filter((r) => selectedRowKeys.has(r.key)), [rows, selectedRowKeys]);

  function toggleRowSelection(key: string) {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleAllRows() {
    setSelectedRowKeys((prev) => prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.key)));
  }

  function toggleCategoryRows(keys: string[], selectAll: boolean) {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (selectAll) keys.forEach((k) => next.add(k));
      else keys.forEach((k) => next.delete(k));
      return next;
    });
  }

  function handleBulkConfirm(previews: BulkRenamePreview[]) {
    addRenames(previews.map((p) => ({
      rowKey: p.rowKey,
      category: p.category,
      containerId: p.containerId,
      containerName: p.containerName,
      publicId: p.publicId,
      oldName: p.oldName,
      newName: p.newName,
    })));
    setSelectedRowKeys(new Set());
  }

  const stats = useMemo(() => coverageStats(rows, containerIds), [rows, containerIds]);
  const pendingCount = pendingRenames.filter((r) => r.status === 'pending').length;
  const pendingTriggerCount = pendingTriggerOps.filter((op) => op.status === 'pending').length;
  void pendingDeletions;
  const allTriggerOpsCount = pendingTriggerOps.length;

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
    const uniqueTags = new Set<string>();
    const uniqueTriggers = new Set<string>();
    const uniqueVars = new Set<string>();
    let orphanCount = 0;
    let distributionCount = 0;

    for (const c of containers) {
      // Unique entity names (for tab badges)
      for (const tag of c.tags) {
        if (tag.type === 'gaawe') {
          const ev = tag.parameter?.find((p) => p.key === 'event_name' || p.key === 'eventName')?.value;
          if (ev) ga4Events.add(ev);
        }
        if (tag.type === 'gaawc' || tag.type === 'awct' || tag.type === 'flc') distributionCount++;
        uniqueTags.add(tag.name);
      }
      for (const tr of c.triggers) uniqueTriggers.add(tr.name);
      for (const v of c.variables) uniqueVars.add(v.name);

      // Orphan count for cleaning badge
      const usedIds = new Set<string>();
      for (const tag of c.tags) { for (const id of tag.firingTriggerId ?? []) usedIds.add(id); }
      orphanCount += c.triggers.filter((tr) => tr.triggerId && !usedIds.has(tr.triggerId)).length;
      const usedVars = new Set<string>();
      const scan = (params?: import('../types/gtm').GTMParameter[]) => {
        for (const p of params ?? []) {
          if (p.value) { const re = /\{\{([^}]+)\}\}/g; let m: RegExpExecArray | null; while ((m = re.exec(p.value)) !== null) usedVars.add(m[1]); }
          scan(p.list); scan(p.map);
        }
      };
      for (const tag of c.tags) scan(tag.parameter);
      for (const tr of c.triggers) { scan(tr.parameter); for (const f of tr.filter ?? []) scan(f.parameter); }
      for (const v of c.variables) scan(v.parameter);
      orphanCount += c.variables.filter((v) => !usedVars.has(v.name)).length;
    }
    return {
      tags: uniqueTags.size,
      triggers: uniqueTriggers.size,
      variables: uniqueVars.size,
      params: ga4Events.size,
      distribution: distributionCount,
      cleaning: orphanCount,
      recommendations: countCriticalRecommendations(containers),
    };
  }, [containers]);

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
            {allTriggerOpsCount > 0 && (
              <button
                onClick={() => setShowTriggerOps(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                style={{
                  backgroundColor: pendingTriggerCount > 0 ? 'hsl(0 70% 50% / 0.1)' : 'hsl(220 13% 91%)',
                  color: pendingTriggerCount > 0 ? 'hsl(0 65% 45%)' : 'hsl(220 13% 45%)',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v4M5 7v.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1"/></svg>
                {pendingTriggerCount > 0 ? `${pendingTriggerCount} action${pendingTriggerCount > 1 ? 's' : ''} déclencheur${pendingTriggerCount > 1 ? 's' : ''}` : 'Historique déclencheurs'}
              </button>
            )}
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
            {/* Container filter dropdown */}
            {sourceData.length >= 2 && (
              <div className="relative" ref={containerFilterRef}>
                <button
                  onClick={() => setShowContainerFilter((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                  style={hiddenIds.size > 0
                    ? { backgroundColor: 'hsl(267 100% 59% / 0.1)', color: 'hsl(267 80% 40%)', borderColor: 'hsl(267 100% 59% / 0.3)' }
                    : { backgroundColor: 'hsl(220 13% 94%)', color: 'hsl(220 13% 35%)', borderColor: 'hsl(220 13% 88%)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <rect x="1" y="1" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.1"/>
                    <rect x="6" y="1" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.1"/>
                    <rect x="1" y="6" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.1"/>
                    <rect x="6" y="6" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.1"/>
                  </svg>
                  Containers ({containers.length}/{sourceData.length})
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ transition: 'transform 0.15s', transform: showContainerFilter ? 'rotate(180deg)' : 'none' }}>
                    <path d="M1.5 3l2.5 2.5L6.5 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {showContainerFilter && (
                  <div
                    className="absolute right-0 top-full mt-1.5 z-30 rounded-xl shadow-lg border py-1.5 overflow-hidden"
                    style={{ backgroundColor: 'white', borderColor: 'hsl(220 13% 88%)', minWidth: 220 }}
                  >
                    {/* Tous / Aucun */}
                    <div className="flex items-center gap-1 px-3 py-1.5 border-b mb-1" style={{ borderColor: 'hsl(220 13% 91%)' }}>
                      <button
                        onClick={() => setHiddenIds(new Set())}
                        className="flex-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors"
                        style={{ backgroundColor: hiddenIds.size === 0 ? 'hsl(267 100% 59% / 0.1)' : 'hsl(220 13% 93%)', color: hiddenIds.size === 0 ? 'hsl(267 80% 40%)' : 'hsl(220 13% 40%)' }}
                      >
                        Tous
                      </button>
                      <button
                        onClick={() => setHiddenIds(new Set(sourceData.slice(1).map((c) => c.containerId)))}
                        className="flex-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors"
                        style={{ backgroundColor: 'hsl(220 13% 93%)', color: 'hsl(220 13% 40%)' }}
                      >
                        1 seul
                      </button>
                    </div>

                    {/* Container list */}
                    {sourceData.map((c) => {
                      const active = !hiddenIds.has(c.containerId);
                      const isLast = active && containers.length <= 1;
                      return (
                        <button
                          key={c.containerId}
                          onClick={() => {
                            if (isLast) return;
                            setHiddenIds((prev) => {
                              const next = new Set(prev);
                              if (active) next.add(c.containerId); else next.delete(c.containerId);
                              return next;
                            });
                          }}
                          disabled={isLast}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed"
                          style={{ opacity: isLast ? 0.45 : 1 }}
                        >
                          <div
                            className="w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors"
                            style={active
                              ? { backgroundColor: 'hsl(267 100% 59%)', borderColor: 'hsl(267 100% 59%)' }
                              : { backgroundColor: 'white', borderColor: 'hsl(220 13% 75%)' }}
                          >
                            {active && (
                              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                <path d="M1.5 4.5l2 2L7.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium truncate" style={{ color: 'hsl(220 13% 15%)' }}>{c.containerName}</div>
                            <div className="text-[10px] font-mono" style={{ color: 'hsl(220 13% 55%)' }}>{c.publicId}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => {
                const html = generateMonitoringReport(containers);
                const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const w = window.open(url, '_blank');
                if (w) setTimeout(() => URL.revokeObjectURL(url), 60_000);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{ backgroundColor: 'hsl(220 13% 94%)', color: 'hsl(220 13% 35%)', border: '1px solid hsl(220 13% 88%)' }}
              title="Exporter le rapport de monitoring"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 9v1.5A1.5 1.5 0 003.5 12h5A1.5 1.5 0 0010 10.5V9M6 1v7M4 6l2 2 2-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Exporter
            </button>
            {!isPreview && (
              <button
                onClick={clearMonitoringData}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:opacity-80"
                style={{ backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 40%)' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
                Réinitialiser
              </button>
            )}
            {monitoringError && (
              <span className="text-xs text-destructive max-w-[200px] truncate" title={monitoringError}>
                {monitoringError.slice(0, 60)}
              </span>
            )}
            {/* Scanner button or cancel during scan */}
            {isLoadingMonitoring ? (
              <button
                onClick={cancelMonitoringScan}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ backgroundColor: 'hsl(0 70% 50%)', color: 'white' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor"/></svg>
                Annuler
              </button>
            ) : hasPendingBatch ? (
              <button
                onClick={() => accessToken && scanMonitoring(accessToken)}
                disabled={!accessToken}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                style={{ backgroundColor: 'hsl(267 100% 59%)', color: 'white' }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6a4 4 0 118 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/><path d="M6 2v1M6 9v1M2.5 3.5l.7.7M8.8 8.8l.7.7M1 6H2M10 6h1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                Scanner la suite ({nextBatchSize})
              </button>
            ) : (
              <button
                onClick={() => accessToken && scanMonitoring(accessToken)}
                disabled={!accessToken || !hasSelection}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'hsl(267 100% 59%)', color: 'white' }}
                title={!hasSelection ? 'Sélectionnez des containers dans la page Containers' : scanWillBeLarge ? `Limité à ${MONITORING_BATCH_SIZE} containers par batch (~${estimatedMinutes} min)` : undefined}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6a4 4 0 118 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/><path d="M6 2v1M6 9v1M2.5 3.5l.7.7M8.8 8.8l.7.7M1 6H2M10 6h1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                Scanner {hasSelection ? `(${Math.min(selectedContainerIds.size, MONITORING_BATCH_SIZE)}${selectedContainerIds.size > MONITORING_BATCH_SIZE ? `/${selectedContainerIds.size}` : ''})` : ''}
              </button>
            )}
          </div>
        </div>

        {/* Scan progress bar */}
        {isLoadingMonitoring && monitoringScanProgress && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              {monitoringScanProgress.current === 0 ? (
                <span className="text-xs text-muted-fg flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 border-2 rounded-full border-t-transparent" style={{ borderColor: 'hsl(267 100% 59%)', animation: 'dk-spin 0.75s linear infinite' }} />
                  Préparation du scan…
                </span>
              ) : (
                <span className="text-xs text-muted-fg">
                  Scan en cours — {monitoringScanProgress.current}/{monitoringScanProgress.total} containers
                </span>
              )}
              {monitoringScanProgress.current > 0 && (
                <span className="text-xs text-muted-fg">
                  ~{Math.ceil(((monitoringScanProgress.total - monitoringScanProgress.current) * 10) / 60)} min restantes
                </span>
              )}
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(220 13% 91%)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: monitoringScanProgress.current === 0
                    ? '4%'
                    : `${Math.round((monitoringScanProgress.current / monitoringScanProgress.total) * 100)}%`,
                  backgroundColor: 'hsl(267 100% 59%)',
                }}
              />
            </div>
          </div>
        )}

        {/* Large-batch warning: show before first scan when selection > batch size */}
        {scanWillBeLarge && !isLoadingMonitoring && (
          <div
            className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
            style={{ backgroundColor: 'hsl(46 100% 50% / 0.1)', color: 'hsl(35 90% 40%)', border: '1px solid hsl(46 100% 50% / 0.25)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 mt-0.5"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/><path d="M6 4v2.5M6 8v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
            <span>
              <strong>{selectedContainerIds.size} containers sélectionnés</strong> — le scan est limité à {MONITORING_BATCH_SIZE} containers par batch (~{estimatedMinutes} min).
              Les {selectedContainerIds.size - MONITORING_BATCH_SIZE} restants seront disponibles via «&nbsp;Scanner la suite&nbsp;» après le premier batch.
            </span>
          </div>
        )}

        {/* Remaining batch reminder after partial scan */}
        {hasPendingBatch && (
          <div
            className="mt-3 flex items-center justify-between px-3 py-2 rounded-lg text-xs"
            style={{ backgroundColor: 'hsl(267 100% 59% / 0.07)', border: '1px solid hsl(267 100% 59% / 0.2)', color: 'hsl(267 80% 45%)' }}
          >
            <span>
              <strong>{monitoringData.length} containers scannés</strong> — {remainingCount} container{remainingCount > 1 ? 's' : ''} restant{remainingCount > 1 ? 's' : ''} dans cette sélection.
            </span>
            <button
              onClick={() => accessToken && scanMonitoring(accessToken)}
              disabled={!accessToken}
              className="font-semibold hover:underline disabled:opacity-40 shrink-0 ml-3"
            >
              Scanner les {nextBatchSize} suivants
            </button>
          </div>
        )}

        {/* Staleness warning — data loaded from localStorage but > 24h old */}
        {isStale && !isLoadingMonitoring && (
          <div
            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ backgroundColor: 'hsl(46 100% 50% / 0.1)', color: 'hsl(35 90% 40%)', border: '1px solid hsl(46 100% 50% / 0.25)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/><path d="M6 3.5V6l1.5 1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Données du dernier scan <strong>il y a {staleHours}h</strong> — pensez à relancer un scan pour avoir une vue à jour.</span>
          </div>
        )}

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
                className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-semibold')}
                style={
                  activeKind === kind
                    ? { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }
                    : kind === 'recommendations' && kindCounts[kind] > 0
                    ? { backgroundColor: 'hsl(0 85% 95%)', color: 'hsl(0 65% 45%)' }
                    : { backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 50%)' }
                }
              >
                {kindCounts[kind]}
              </span>
            </button>
          ))}

          {activeKind !== 'params' && activeKind !== 'distribution' && activeKind !== 'recommendations' && <div className="mx-3 h-4 w-px" style={{ backgroundColor: 'hsl(220 13% 88%)' }} />}

          {/* Coverage for active kind */}
          {activeKind !== 'params' && activeKind !== 'distribution' && activeKind !== 'recommendations' && <div className="flex items-center gap-1.5 text-xs">
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

      {/* Filters + Search — hidden on params, distribution and cleaning tabs */}
      {activeKind !== 'params' && activeKind !== 'cleaning' && activeKind !== 'distribution' && activeKind !== 'recommendations' && (
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

      {/* Matrix or Params tab or Cleaning or Distribution */}
      {activeKind === 'recommendations' ? (
        <RecommendationsTab containers={containers} />
      ) : activeKind === 'cleaning' ? (
        <CleaningTab containers={containers} />
      ) : activeKind === 'distribution' ? (
        <DistributionTab containers={containers} />
      ) : activeKind === 'params' ? (
        <ParamMatrixTab containers={containers} />
      ) : (
        <>
          {selectedRowKeys.size > 0 && (
            <div
              className="shrink-0 flex items-center justify-between px-5 py-2.5 border-b"
              style={{ backgroundColor: 'hsl(267 100% 59% / 0.06)', borderColor: 'hsl(267 100% 59% / 0.2)' }}
            >
              <span className="text-xs font-semibold" style={{ color: 'hsl(267 85% 45%)' }}>
                {selectedRowKeys.size} entité{selectedRowKeys.size > 1 ? 's' : ''} sélectionnée{selectedRowKeys.size > 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedRowKeys(new Set())}
                  className="text-xs text-muted-fg hover:text-foreground transition-colors px-2 py-1 rounded"
                >
                  Désélectionner
                </button>
                <button
                  onClick={() => setShowBulkRename(true)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ backgroundColor: 'hsl(267 100% 59%)', color: 'white' }}
                >
                  Renommer en masse
                </button>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto">
            <MatrixTable
              kind={activeKind}
              rows={rows}
              containers={containers}
              hiddenContainers={hiddenContainers}
              pendingRenames={pendingRenames}
              onRowClick={handleRowClick}
              onRemoveContainer={removeContainer}
              onAddContainer={addContainer}
              onCellCreate={(row, containerId, containerName) => setQuickCreateTarget({ row, containerId, containerName })}
              selectedRowKeys={selectedRowKeys}
              onToggleRow={toggleRowSelection}
              onToggleAll={toggleAllRows}
              onToggleCategoryRows={toggleCategoryRows}
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

      {/* Trigger Ops Panel */}
      {showTriggerOps && <TriggerOpsPlanPanel onClose={() => setShowTriggerOps(false)} />}

      {/* Bulk Rename Modal */}
      {showBulkRename && (
        <BulkRenameModal
          selectedRows={selectedRows}
          containers={containers}
          onConfirm={handleBulkConfirm}
          onClose={() => setShowBulkRename(false)}
        />
      )}

      {/* Quick Create Modal — absent cell click */}
      {quickCreateTarget && (
        <QuickCreatePanel
          row={quickCreateTarget.row}
          containerId={quickCreateTarget.containerId}
          containerName={quickCreateTarget.containerName}
          onClose={() => setQuickCreateTarget(null)}
        />
      )}

    </div>
  );
}

// ─── QuickCreatePanel ─────────────────────────────────────────────────────────

function QuickCreatePanel({
  row,
  containerId,
  containerName,
  onClose,
}: {
  row: MatrixRow;
  containerId: string;
  containerName: string;
  onClose: () => void;
}) {
  const { packages, upsertPackage } = useGTMStore();
  const [selectedPkgId, setSelectedPkgId] = useState(packages[0]?.id ?? '');
  void containerId;

  const handleAdd = () => {
    const pkg = packages.find((p) => p.id === selectedPkgId);
    if (!pkg) return;
    const stub: GTMTag = {
      name: `${row.category} — ${row.key}`,
      type: 'html',
      parameter: [],
      firingTriggerId: [],
    };
    upsertPackage({ ...pkg, entities: { ...pkg.entities, tags: [...pkg.entities.tags, stub] } });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'rgba(0,10,6,0.35)' }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-card border border-border rounded-xl shadow-xl p-5 flex flex-col gap-4" style={{ width: 360 }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Créer ce tag</h3>
            <button type="button" onClick={onClose} className="p-1 rounded text-muted-fg hover:text-foreground">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-fg">Tag</span>
              <span className="font-medium text-foreground truncate ml-2">{row.category} — {row.key}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-fg">Container cible</span>
              <span className="font-medium text-foreground">{containerName}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-muted-fg">Package</span>
              {packages.length === 0 ? (
                <span className="text-xs text-destructive">Aucun package disponible</span>
              ) : (
                <select value={selectedPkgId} onChange={(e) => setSelectedPkgId(e.target.value)}
                  className="text-xs rounded-lg border border-border px-2 py-1 bg-card text-foreground focus:outline-none max-w-[160px]"
                >
                  {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-fg bg-muted rounded-lg px-3 py-2">
            Un tag stub sera ajouté au package. Configurez les paramètres et déclencheurs ensuite.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 px-3 py-2 text-xs rounded-lg border border-border text-muted-fg hover:text-foreground transition-colors">Annuler</button>
            <button type="button" onClick={handleAdd} disabled={packages.length === 0}
              className="flex-1 px-3 py-2 text-xs rounded-lg text-white font-semibold disabled:opacity-40"
              style={{ backgroundColor: 'hsl(267 100% 59%)' }}
            >Ajouter au package</button>
          </div>
        </div>
      </div>
    </>
  );
}
