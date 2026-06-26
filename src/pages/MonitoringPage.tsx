import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { MONITORING_MOCK, type MonitoringContainerData } from '../data/monitoring-mock';
import { RenameDrawer, type ContainerOption } from '../components/monitoring/RenameDrawer';
import { useGTMStore } from '../store/gtm-store';
import type { GTMTag } from '../types/gtm';

// ─── Tag categorisation ────────────────────────────────────────────────────────

type TagCategory =
  | 'GA4'
  | 'Google Ads'
  | 'Floodlight'
  | 'Kameleoon'
  | 'AB Tasty'
  | 'Meta Pixel'
  | 'TikTok'
  | 'Hotjar'
  | 'HTML Custom';

const ALL_CATEGORIES: TagCategory[] = [
  'GA4', 'Google Ads', 'Floodlight', 'Kameleoon', 'AB Tasty',
  'Meta Pixel', 'TikTok', 'Hotjar', 'HTML Custom',
];

export const CATEGORY_COLORS: Record<TagCategory, string> = {
  'GA4': 'hsl(213 94% 60%)',
  'Google Ads': 'hsl(27 96% 55%)',
  'Floodlight': 'hsl(36 100% 50%)',
  'Kameleoon': 'hsl(267 100% 59%)',
  'AB Tasty': 'hsl(340 82% 52%)',
  'Meta Pixel': 'hsl(221 44% 41%)',
  'TikTok': 'hsl(180 100% 30%)',
  'Hotjar': 'hsl(17 100% 54%)',
  'HTML Custom': 'hsl(220 13% 46%)',
};

function detectCategory(tag: GTMTag): TagCategory {
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

function getRowKey(tag: GTMTag, category: TagCategory): string {
  if (category === 'GA4' && tag.type === 'gaawe') {
    return tag.parameter?.find((p) => p.key === 'event_name')?.value ?? tag.name;
  }
  if (category === 'GA4' && tag.type === 'gaawc') return 'GA4 Configuration';
  return tag.name;
}

// ─── Matrix builder ────────────────────────────────────────────────────────────

interface MatrixCell {
  tagName: string;
  tagType: string;
}

interface MatrixRow {
  key: string;
  category: TagCategory;
  cells: Record<string, MatrixCell | null>;
}

function buildMatrix(
  containers: MonitoringContainerData[],
  activeCategory: TagCategory | 'Tous',
  search: string,
): MatrixRow[] {
  const rowMap = new Map<string, MatrixRow>();
  const containerIds = containers.map((c) => c.containerId);

  for (const container of containers) {
    for (const tag of container.tags) {
      const category = detectCategory(tag);
      if (activeCategory !== 'Tous' && category !== activeCategory) continue;

      const key = `${category}::${getRowKey(tag, category)}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          key: getRowKey(tag, category),
          category,
          cells: Object.fromEntries(containerIds.map((id) => [id, null])),
        });
      }
      rowMap.get(key)!.cells[container.containerId] = {
        tagName: tag.name,
        tagType: tag.type,
      };
    }
  }

  let rows = Array.from(rowMap.values());

  if (search.trim()) {
    const q = search.toLowerCase();
    rows = rows.filter((r) => {
      if (r.key.toLowerCase().includes(q)) return true;
      return Object.values(r.cells).some((c) => c?.tagName.toLowerCase().includes(q));
    });
  }

  rows.sort((a, b) => {
    const catOrder = ALL_CATEGORIES.indexOf(a.category) - ALL_CATEGORIES.indexOf(b.category);
    if (catOrder !== 0) return catOrder;
    return a.key.localeCompare(b.key);
  });

  return rows;
}

function coverageStats(rows: MatrixRow[], containerIds: string[]) {
  let total = 0;
  let present = 0;
  for (const row of rows) {
    for (const cid of containerIds) {
      total++;
      if (row.cells[cid]) present++;
    }
  }
  return { total, present, pct: total === 0 ? 100 : Math.round((present / total) * 100) };
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: TagCategory }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
      style={{
        backgroundColor: CATEGORY_COLORS[category] + '22',
        color: CATEGORY_COLORS[category],
      }}
    >
      {category}
    </span>
  );
}

// ─── Rename plan panel ─────────────────────────────────────────────────────────

function RenamePlanPanel({ onClose }: { onClose: () => void }) {
  const { pendingRenames, removeRename, clearRenames } = useGTMStore();

  if (pendingRenames.length === 0) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'hsl(220 13% 10% / 0.35)' }}
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl"
        style={{ width: '440px', backgroundColor: 'white', borderLeft: '1px solid hsl(220 13% 91%)' }}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Plan de renommage</h2>
            <p className="text-xs text-muted-fg mt-0.5">{pendingRenames.length} opération{pendingRenames.length > 1 ? 's' : ''} planifiée{pendingRenames.length > 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-card transition-colors text-muted-fg"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {pendingRenames.map((op) => (
            <div
              key={op.id}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg border"
              style={{ borderColor: 'hsl(220 13% 91%)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0"
                    style={{
                      backgroundColor: (CATEGORY_COLORS[op.category as TagCategory] ?? 'hsl(220 13% 50%)') + '22',
                      color: CATEGORY_COLORS[op.category as TagCategory] ?? 'hsl(220 13% 50%)',
                    }}
                  >
                    {op.category}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">{op.containerName}</span>
                  <span className="text-[10px] text-muted-fg font-mono shrink-0">{op.publicId}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                  <span className="text-muted-fg truncate max-w-[140px]" title={op.oldName}>{op.oldName}</span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-muted-fg">
                    <path d="M2.5 5h5M5.5 2.5L8 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span
                    className="font-semibold truncate max-w-[140px]"
                    style={{ color: CATEGORY_COLORS[op.category as TagCategory] ?? 'hsl(267 100% 59%)' }}
                    title={op.newName}
                  >
                    {op.newName}
                  </span>
                </div>
              </div>
              <button
                onClick={() => removeRename(op.id)}
                className="p-1 rounded hover:bg-card text-muted-fg hover:text-foreground transition-colors shrink-0 mt-0.5"
                title="Supprimer"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div
          className="px-5 py-4 border-t space-y-2"
          style={{ borderColor: 'hsl(220 13% 91%)' }}
        >
          {/* OAuth notice */}
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
            style={{ backgroundColor: 'hsl(267 100% 59% / 0.08)', color: 'hsl(267 80% 40%)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 mt-0.5">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/>
              <path d="M6 4v2.5M6 8v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
            Le renommage sera exécuté via l'API GTM une fois GCP OAuth configuré. Les opérations sont conservées jusqu'à application.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { clearRenames(); onClose(); }}
              className="flex-1 px-4 py-2 text-xs rounded-lg border transition-colors text-muted-fg hover:text-foreground"
              style={{ borderColor: 'hsl(220 13% 85%)' }}
            >
              Tout effacer
            </button>
            <button
              disabled
              className="flex-1 px-4 py-2 text-xs font-medium rounded-lg text-white opacity-40 cursor-not-allowed"
              style={{ backgroundColor: 'hsl(267 100% 59%)' }}
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

export function MonitoringPage() {
  const { pendingRenames, addRenames } = useGTMStore();
  const [activeCategory, setActiveCategory] = useState<TagCategory | 'Tous'>('Tous');
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<MatrixRow | null>(null);
  const [showPlan, setShowPlan] = useState(false);

  const containers: MonitoringContainerData[] = MONITORING_MOCK;
  const containerIds = containers.map((c) => c.containerId);

  const rows = useMemo(
    () => buildMatrix(containers, activeCategory, search),
    [activeCategory, search],
  );

  const stats = useMemo(() => coverageStats(rows, containerIds), [rows, containerIds]);
  const absentCount = stats.total - stats.present;

  const categoriesPresent = useMemo(() => {
    const seen = new Set<TagCategory>();
    for (const c of containers) {
      for (const tag of c.tags) seen.add(detectCategory(tag));
    }
    return ALL_CATEGORIES.filter((c) => seen.has(c));
  }, []);

  const pendingCount = pendingRenames.filter((r) => r.status === 'pending').length;

  function openRenameDrawer(row: MatrixRow) {
    setSelectedRow(row);
    setShowPlan(false);
  }

  function buildContainerOptions(row: MatrixRow): ContainerOption[] {
    return containers.map((c) => ({
      containerId: c.containerId,
      containerName: c.containerName,
      publicId: c.publicId,
      currentName: row.cells[c.containerId]?.tagName ?? null,
    }));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b shrink-0" style={{ borderColor: 'hsl(220 13% 91%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Monitoring — Couverture des tags</h1>
            <p className="text-xs text-muted-fg mt-0.5">
              Visualisez la présence de chaque tag · cliquez une ligne pour renommer
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Pending renames badge */}
            {pendingCount > 0 && (
              <button
                onClick={() => setShowPlan(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                style={{ backgroundColor: 'hsl(267 100% 59% / 0.12)', color: 'hsl(267 80% 45%)' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.25"/>
                  <path d="M5 3v2l1.5 1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                </svg>
                {pendingCount} renommage{pendingCount > 1 ? 's' : ''} planifié{pendingCount > 1 ? 's' : ''}
              </button>
            )}
            {/* Mock badge */}
            <span
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium"
              style={{ backgroundColor: 'hsl(46 100% 50% / 0.12)', color: 'hsl(35 90% 45%)' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.25"/>
                <path d="M5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
              Mode aperçu
            </span>
            {/* Scan button */}
            <button
              disabled
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium opacity-40 cursor-not-allowed"
              style={{ backgroundColor: 'hsl(267 100% 59%)', color: 'white' }}
              title="Nécessite GCP OAuth pour scanner les vrais containers"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.25"/>
                <path d="M6 3v3l2 1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
              Scanner
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-fg">
            <span className="font-semibold text-foreground text-sm">{containers.length}</span>containers
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-fg">
            <span className="font-semibold text-foreground text-sm">{rows.length}</span>tags
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(220 13% 91%)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${stats.pct}%`,
                  backgroundColor: stats.pct >= 80 ? 'hsl(142 60% 45%)' : stats.pct >= 50 ? 'hsl(46 100% 50%)' : 'hsl(0 70% 55%)',
                }}
              />
            </div>
            <span
              className="font-semibold"
              style={{ color: stats.pct >= 80 ? 'hsl(142 60% 35%)' : stats.pct >= 50 ? 'hsl(35 90% 40%)' : 'hsl(0 70% 50%)' }}
            >
              {stats.pct}%
            </span>
          </div>
          {absentCount > 0 && (
            <div
              className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded"
              style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 50%)' }}
            >
              {absentCount} absence{absentCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Filters + Search */}
      <div
        className="px-6 py-3 flex items-center gap-3 border-b shrink-0 flex-wrap"
        style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)' }}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveCategory('Tous')}
            className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
            style={
              activeCategory === 'Tous'
                ? { backgroundColor: 'hsl(220 13% 20%)', color: 'white' }
                : { backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 40%)' }
            }
          >
            Tous
          </button>
          {categoriesPresent.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? 'Tous' : cat)}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-all border"
              style={
                activeCategory === cat
                  ? {
                      backgroundColor: CATEGORY_COLORS[cat] + '22',
                      color: CATEGORY_COLORS[cat],
                      borderColor: CATEGORY_COLORS[cat] + '55',
                    }
                  : {
                      backgroundColor: 'hsl(220 13% 91%)',
                      color: 'hsl(220 13% 40%)',
                      borderColor: 'transparent',
                    }
              }
            >
              {cat}
            </button>
          ))}
        </div>
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
            placeholder="add_to_cart, tag name…"
            className="pl-7 pr-3 py-1.5 text-xs rounded-lg border outline-none w-52"
            style={{ borderColor: 'hsl(220 13% 85%)', backgroundColor: 'white', color: 'hsl(220 13% 20%)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-fg hover:text-foreground">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-fg">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
              <path d="M10 16h12M16 10v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
            </svg>
            <p className="text-sm">Aucun tag correspondant</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
                <th
                  className="sticky left-0 z-10 text-left px-4 py-2.5 text-xs font-semibold text-muted-fg border-b border-r"
                  style={{ minWidth: '220px', borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 97%)' }}
                >
                  Tag / Event
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
                const rowRenames = pendingRenames.filter((r) => r.rowKey === row.key);

                // Check if names differ across containers (highlight the row)
                const presentNames = Object.values(row.cells)
                  .filter(Boolean)
                  .map((c) => c!.tagName);
                const hasInconsistentNames = new Set(presentNames).size > 1;

                return (
                  <>
                    {showCategoryHeader && (
                      <tr key={`cat-${row.category}`} style={{ backgroundColor: 'hsl(220 20% 98%)' }}>
                        <td colSpan={containers.length + 1} className="px-4 py-1.5 border-b" style={{ borderColor: 'hsl(220 13% 91%)' }}>
                          <CategoryBadge category={row.category} />
                        </td>
                      </tr>
                    )}
                    <tr
                      key={`${row.category}::${row.key}`}
                      className="group hover:bg-card transition-colors cursor-pointer"
                      onClick={() => openRenameDrawer(row)}
                    >
                      {/* Row label */}
                      <td
                        className="sticky left-0 z-10 px-4 py-2.5 border-b border-r"
                        style={{
                          borderColor: 'hsl(220 13% 91%)',
                          backgroundColor: 'white',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground truncate flex-1">{row.key}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Inconsistent names warning */}
                            {hasInconsistentNames && (
                              <span
                                className="px-1 py-0.5 rounded text-[10px] font-medium"
                                style={{ backgroundColor: 'hsl(46 100% 50% / 0.15)', color: 'hsl(35 90% 40%)' }}
                                title="Noms différents entre containers"
                              >
                                noms variés
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
                            {/* Rename icon — visible on hover */}
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-fg">
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
                              </svg>
                            </span>
                          </div>
                        </div>
                      </td>
                      {/* Cells */}
                      {containers.map((c) => {
                        const cell = row.cells[c.containerId];
                        const queuedRename = pendingRenames.find(
                          (r) => r.containerId === c.containerId && r.rowKey === row.key,
                        );
                        return (
                          <td
                            key={c.containerId}
                            className="px-2 py-2 border-b border-r last:border-r-0"
                            style={{ borderColor: 'hsl(220 13% 91%)' }}
                          >
                            {queuedRename ? (
                              <div
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium"
                                style={{ backgroundColor: 'hsl(267 100% 59% / 0.08)', color: 'hsl(267 80% 40%)' }}
                                title={`${queuedRename.oldName} → ${queuedRename.newName}`}
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1"/>
                                  <path d="M5 3v2l1 1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                                </svg>
                                <span className="truncate max-w-[110px]">{queuedRename.newName}</span>
                              </div>
                            ) : cell ? (
                              <div
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium"
                                style={{ backgroundColor: 'hsl(142 72% 95%)', color: 'hsl(142 60% 28%)' }}
                                title={cell.tagName}
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
                                  <path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <span className="truncate max-w-[120px]">{cell.tagName}</span>
                              </div>
                            ) : (
                              <div
                                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium"
                                style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 55%)' }}
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
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
        )}
      </div>

      {/* Footer */}
      <div
        className="px-6 py-2.5 border-t flex items-center gap-2 shrink-0 text-xs"
        style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)', color: 'hsl(220 13% 45%)' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/>
          <path d="M6 4v2.5M6 8v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
        Données simulées. Cliquez une ligne pour renommer · cliquez le badge violet pour voir le plan de renommage.
      </div>

      {/* Rename Drawer */}
      {selectedRow && (
        <RenameDrawer
          rowKey={selectedRow.key}
          category={selectedRow.category}
          categoryColor={CATEGORY_COLORS[selectedRow.category]}
          options={buildContainerOptions(selectedRow)}
          existingRenames={pendingRenames.filter((r) => r.rowKey === selectedRow.key)}
          onSave={(ops) => addRenames(ops)}
          onClose={() => setSelectedRow(null)}
        />
      )}

      {/* Rename Plan Panel */}
      {showPlan && <RenamePlanPanel onClose={() => setShowPlan(false)} />}
    </div>
  );
}
