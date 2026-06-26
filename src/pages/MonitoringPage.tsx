import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { MONITORING_MOCK, type MonitoringContainerData } from '../data/monitoring-mock';
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

const CATEGORY_COLORS: Record<TagCategory, string> = {
  'GA4': 'hsl(213 94% 68%)',
  'Google Ads': 'hsl(27 96% 61%)',
  'Floodlight': 'hsl(36 100% 50%)',
  'Kameleoon': 'hsl(267 100% 59%)',
  'AB Tasty': 'hsl(340 82% 52%)',
  'Meta Pixel': 'hsl(221 44% 41%)',
  'TikTok': 'hsl(180 100% 36%)',
  'Hotjar': 'hsl(17 100% 54%)',
  'HTML Custom': 'hsl(220 13% 50%)',
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
  cells: Record<string, MatrixCell | null>; // containerId → cell or null = absent
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
        const row: MatrixRow = {
          key: getRowKey(tag, category),
          category,
          cells: Object.fromEntries(containerIds.map((id) => [id, null])),
        };
        rowMap.set(key, row);
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

  // Sort: GA4 first, then alphabetically by key
  rows.sort((a, b) => {
    const catOrder = ALL_CATEGORIES.indexOf(a.category) - ALL_CATEGORIES.indexOf(b.category);
    if (catOrder !== 0) return catOrder;
    return a.key.localeCompare(b.key);
  });

  return rows;
}

// ─── Coverage stats ────────────────────────────────────────────────────────────

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
      style={{ backgroundColor: CATEGORY_COLORS[category] + '22', color: CATEGORY_COLORS[category] }}
    >
      {category}
    </span>
  );
}

function CellPresent({ cell }: { cell: MatrixCell }) {
  return (
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
  );
}

function CellAbsent() {
  return (
    <div
      className="flex items-center justify-center px-2 py-1.5 rounded-md text-xs font-medium"
      style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 55%)' }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span className="ml-1">Absent</span>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function MonitoringPage() {
  const [activeCategory, setActiveCategory] = useState<TagCategory | 'Tous'>('Tous');
  const [search, setSearch] = useState('');

  // Mock data = all 5 PFS containers (OAuth will replace this)
  const containers: MonitoringContainerData[] = MONITORING_MOCK;
  const containerIds = containers.map((c) => c.containerId);

  const rows = useMemo(
    () => buildMatrix(containers, activeCategory, search),
    [activeCategory, search],
  );

  const stats = useMemo(() => coverageStats(rows, containerIds), [rows, containerIds]);

  // Unique categories in current data
  const categoriesPresent = useMemo(() => {
    const seen = new Set<TagCategory>();
    for (const c of containers) {
      for (const tag of c.tags) seen.add(detectCategory(tag));
    }
    return ALL_CATEGORIES.filter((c) => seen.has(c));
  }, []);

  const absentCount = stats.total - stats.present;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b shrink-0" style={{ borderColor: 'hsl(220 13% 91%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Monitoring — Couverture des tags</h1>
            <p className="text-xs text-muted-fg mt-0.5">
              Visualisez la présence de chaque tag à travers vos containers GTM
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Mock badge */}
            <span
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium"
              style={{ backgroundColor: 'hsl(46 100% 50% / 0.12)', color: 'hsl(35 90% 45%)' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.25"/>
                <path d="M5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
              Mode aperçu — données simulées
            </span>
            {/* Scan button — disabled until OAuth */}
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
              Scanner les containers
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-fg">
            <span className="font-semibold text-foreground text-sm">{containers.length}</span>
            containers
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-fg">
            <span className="font-semibold text-foreground text-sm">{rows.length}</span>
            tags détectés
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div
              className="w-20 h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: 'hsl(220 13% 91%)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${stats.pct}%`,
                  backgroundColor: stats.pct >= 80
                    ? 'hsl(142 60% 45%)'
                    : stats.pct >= 50
                    ? 'hsl(46 100% 50%)'
                    : 'hsl(0 70% 55%)',
                }}
              />
            </div>
            <span
              className="font-semibold"
              style={{
                color: stats.pct >= 80 ? 'hsl(142 60% 35%)' : stats.pct >= 50 ? 'hsl(35 90% 40%)' : 'hsl(0 70% 50%)',
              }}
            >
              {stats.pct}% couverture
            </span>
          </div>
          {absentCount > 0 && (
            <div
              className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded"
              style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 50%)' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 2.5v3M5 7.5v.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1"/>
              </svg>
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
        {/* Category filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveCategory('Tous')}
            className={clsx(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
              activeCategory === 'Tous'
                ? 'text-white shadow-sm'
                : 'text-muted-fg hover:text-foreground',
            )}
            style={activeCategory === 'Tous' ? { backgroundColor: 'hsl(220 13% 20%)' } : { backgroundColor: 'hsl(220 13% 91%)' }}
          >
            Tous
          </button>
          {categoriesPresent.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? 'Tous' : cat)}
              className={clsx(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all border',
                activeCategory === cat ? 'shadow-sm' : 'hover:opacity-80',
              )}
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-fg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.25"/>
            <path d="M7.5 7.5l2 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher event_name, tag…"
            className="pl-7 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-all w-52"
            style={{ borderColor: 'hsl(220 13% 85%)', backgroundColor: 'white', color: 'hsl(220 13% 20%)' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-fg hover:text-foreground"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Matrix table */}
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
                {/* Tag column */}
                <th
                  className="sticky left-0 z-10 text-left px-4 py-2.5 text-xs font-semibold text-muted-fg border-b border-r"
                  style={{
                    minWidth: '220px',
                    borderColor: 'hsl(220 13% 91%)',
                    backgroundColor: 'hsl(220 20% 97%)',
                  }}
                >
                  Tag / Event
                </th>
                {containers.map((c) => (
                  <th
                    key={c.containerId}
                    className="text-center px-3 py-2.5 text-xs font-semibold border-b border-r last:border-r-0"
                    style={{
                      minWidth: '160px',
                      borderColor: 'hsl(220 13% 91%)',
                      color: 'hsl(220 13% 30%)',
                    }}
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
                return (
                  <>
                    {showCategoryHeader && (
                      <tr key={`cat-${row.category}`} style={{ backgroundColor: 'hsl(220 20% 98%)' }}>
                        <td
                          colSpan={containers.length + 1}
                          className="px-4 py-1.5 border-b"
                          style={{ borderColor: 'hsl(220 13% 91%)' }}
                        >
                          <CategoryBadge category={row.category} />
                        </td>
                      </tr>
                    )}
                    <tr
                      key={`${row.category}::${row.key}`}
                      className="hover:bg-card transition-colors"
                    >
                      {/* Row label */}
                      <td
                        className="sticky left-0 z-10 px-4 py-2.5 border-b border-r font-medium text-xs"
                        style={{
                          borderColor: 'hsl(220 13% 91%)',
                          backgroundColor: 'white',
                          color: 'hsl(220 13% 20%)',
                          maxWidth: '220px',
                        }}
                      >
                        <span className="truncate block">{row.key}</span>
                      </td>
                      {/* Cells */}
                      {containers.map((c) => {
                        const cell = row.cells[c.containerId];
                        return (
                          <td
                            key={c.containerId}
                            className="px-2 py-2 border-b border-r last:border-r-0 text-center"
                            style={{ borderColor: 'hsl(220 13% 91%)' }}
                          >
                            {cell ? <CellPresent cell={cell} /> : <CellAbsent />}
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

      {/* Footer — OAuth callout */}
      <div
        className="px-6 py-3 border-t flex items-center gap-2 shrink-0 text-xs"
        style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)', color: 'hsl(220 13% 45%)' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/>
          <path d="M6 4v2.5M6 8v.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
        Données simulées. Après configuration GCP OAuth, le bouton "Scanner les containers" lira les vrais workspaces GTM via l'API.
      </div>
    </div>
  );
}
