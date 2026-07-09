import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import type { ContainerDiff, DiffEntity, EntityStatus, GTMTag } from '../../types/gtm';
import { Badge } from '../ui/Badge';
import { useGTMStore } from '../../store/gtm-store';

const STATUS_LABEL: Record<EntityStatus, string> = {
  new: 'Nouveau',
  modified: 'Modifié',
  unchanged: 'Inchangé',
  removed: 'Supprimé',
};

const STATUS_BADGE: Record<EntityStatus, 'success' | 'warning' | 'default' | 'error'> = {
  new: 'success',
  modified: 'warning',
  unchanged: 'default',
  removed: 'error',
};

const KIND_LABEL = { tag: 'Tag', variable: 'Variable', trigger: 'Déclencheur' };

const KIND_STYLE: Record<string, string> = {
  tag:      'bg-primary/10 text-primary',
  variable: 'bg-mauve/30 text-primary',
  trigger:  'bg-accent/10 text-warning',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEventName(entity: DiffEntity): string | null {
  if (entity.kind !== 'tag') return null;
  const tag = entity.proposed as GTMTag;
  if (tag.type !== 'gaawe') return null;
  return tag.parameter?.find((p) => p.key === 'event_name' || p.key === 'eventName')?.value ?? null;
}

function extractEventNames(diffs: ContainerDiff[]): string[] {
  const names = new Set<string>();
  for (const diff of diffs) {
    for (const entity of diff.entities) {
      const n = getEventName(entity);
      if (n) names.add(n);
    }
  }
  return Array.from(names).sort();
}

// Returns: for each entity name, which containers have it (existing/modified) vs missing (new)
interface CoverageEntry {
  entityName: string;
  kind: DiffEntity['kind'];
  presentIn: string[];   // container names where it exists (unchanged/modified)
  missingIn: string[];   // container names where it's new (absent from GTM)
}

function buildCoverageNotes(diffs: ContainerDiff[]): CoverageEntry[] {
  if (diffs.length < 2) return []; // only meaningful cross-container

  // Collect all entity names across all containers
  const entityMap = new Map<string, { kind: DiffEntity['kind']; presentIn: string[]; missingIn: string[] }>();

  for (const diff of diffs) {
    for (const entity of diff.entities) {
      if (!entityMap.has(entity.key)) {
        entityMap.set(entity.key, { kind: entity.kind, presentIn: [], missingIn: [] });
      }
      const entry = entityMap.get(entity.key)!;
      if (entity.status === 'new') {
        entry.missingIn.push(diff.containerName);
      } else {
        entry.presentIn.push(diff.containerName);
      }
    }
  }

  // Keep only entities with inconsistent presence (present in some, missing in others)
  return Array.from(entityMap.entries())
    .filter(([, v]) => v.presentIn.length > 0 && v.missingIn.length > 0)
    .map(([key, v]) => ({
      entityName: key.split('::')[1] ?? key,
      kind: v.kind,
      presentIn: v.presentIn,
      missingIn: v.missingIn,
    }))
    .sort((a, b) => b.missingIn.length - a.missingIn.length);
}

// ─── EntityRow ────────────────────────────────────────────────────────────────

function EntityRow({
  entity, containerId, dimmed,
}: { entity: DiffEntity; containerId: string; dimmed?: boolean }) {
  const { toggleEntitySelection } = useGTMStore();
  const [expanded, setExpanded] = useState(false);
  const eventName = getEventName(entity);

  return (
    <div className={clsx('border-b border-border last:border-0', entity.status === 'unchanged' && 'opacity-40', dimmed && 'opacity-20')}>
      <div
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted cursor-pointer transition-colors"
        onClick={() => toggleEntitySelection(containerId, entity.key)}
      >
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            entity.selected ? 'border-primary bg-primary' : 'border-border bg-card'
          }`}
        >
          {entity.selected && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <span className={clsx('text-xs px-1.5 py-0.5 rounded-md font-semibold shrink-0', KIND_STYLE[entity.kind])}>
          {KIND_LABEL[entity.kind]}
        </span>
        <span className="text-sm text-foreground flex-1 truncate font-medium">{entity.name}</span>
        {eventName && (
          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-fg shrink-0">{eventName}</span>
        )}
        <Badge variant={STATUS_BADGE[entity.status]}>{STATUS_LABEL[entity.status]}</Badge>
        {entity.status === 'modified' && (
          <button
            className="text-xs text-muted-fg hover:text-foreground shrink-0 ml-1"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? 'Masquer diff' : 'Voir diff'}
          </button>
        )}
      </div>
      {expanded && entity.status === 'modified' && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-muted-fg mb-1">Actuel</div>
            <pre className="text-xs bg-destructive/5 border border-destructive/20 rounded-lg p-2 overflow-auto max-h-32 text-destructive">
              {JSON.stringify(entity.current, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-xs text-muted-fg mb-1">Nouveau</div>
            <pre className="text-xs bg-success/5 border border-success/20 rounded-lg p-2 overflow-auto max-h-32 text-success">
              {JSON.stringify(entity.proposed, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ContainerDiffPanel ───────────────────────────────────────────────────────

function ContainerDiffPanel({
  diff, activeEventFilter,
}: { diff: ContainerDiff; activeEventFilter: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const { selectAllEntities, deselectUnchanged, toggleEntitySelection } = useGTMStore();

  const newCount = diff.entities.filter((e) => e.status === 'new').length;
  const modCount = diff.entities.filter((e) => e.status === 'modified').length;
  const unchanged = diff.entities.filter((e) => e.status === 'unchanged').length;
  const selected = diff.entities.filter((e) => e.selected).length;

  // Filter by event name if active
  const visibleEntities = activeEventFilter
    ? diff.entities.filter((e) => {
        const en = getEventName(e);
        return en === activeEventFilter;
      })
    : diff.entities;

  const matchCount = visibleEntities.length;

  function selectByEventName() {
    for (const entity of visibleEntities) {
      if (!entity.selected) toggleEntitySelection(diff.containerId, entity.key);
    }
  }

  if (diff.status === 'loading') {
    return (
      <div className="border border-border rounded-xl p-4 flex items-center gap-3">
        <div
          className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full shrink-0"
          style={{ animation: 'dk-spin 0.75s linear infinite' }}
        />
        <span className="text-sm text-muted-fg">{diff.containerName} — analyse en cours…</span>
      </div>
    );
  }

  if (diff.status === 'error') {
    return (
      <div className="border border-destructive/20 rounded-xl p-4 bg-destructive/5">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <span className="font-semibold">{diff.containerName}</span>
          <Badge variant="error">Erreur</Badge>
        </div>
        <p className="text-xs text-destructive/70 mt-1">{diff.error}</p>
      </div>
    );
  }

  // No match in active filter → dim the panel
  const noMatch = activeEventFilter !== null && matchCount === 0;

  return (
    <div className={clsx('border rounded-xl overflow-hidden transition-opacity', noMatch ? 'border-border opacity-30' : 'border-border')}>
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-muted transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className={clsx('shrink-0 text-muted-fg transition-transform', expanded && 'rotate-90')}
        >
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{diff.containerName}</span>
          <Badge variant="default">{diff.containerPublicId}</Badge>
          {activeEventFilter && matchCount > 0 && (
            <Badge variant="info">{matchCount} match</Badge>
          )}
          {!activeEventFilter && (
            <>
              {newCount > 0 && <Badge variant="success">{newCount} nouveau{newCount > 1 ? 'x' : ''}</Badge>}
              {modCount > 0 && <Badge variant="warning">{modCount} modifié{modCount > 1 ? 's' : ''}</Badge>}
              {unchanged > 0 && <Badge variant="default">{unchanged} inchangé{unchanged > 1 ? 's' : ''}</Badge>}
            </>
          )}
        </div>
        <span className="text-xs text-primary font-semibold shrink-0">{selected} sélectionné{selected !== 1 ? 's' : ''}</span>
      </div>

      {expanded && !noMatch && (
        <div className="border-t border-border">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted">
            {activeEventFilter ? (
              <button className="text-xs text-primary hover:underline" onClick={selectByEventName}>
                Sélectionner les {matchCount} correspondances
              </button>
            ) : (
              <>
                <button className="text-xs text-primary hover:underline" onClick={() => selectAllEntities(diff.containerId)}>
                  Tout sélectionner
                </button>
                <span className="text-border">·</span>
                <button className="text-xs text-muted-fg hover:underline" onClick={() => deselectUnchanged(diff.containerId)}>
                  Désélectionner inchangés
                </button>
              </>
            )}
          </div>
          {visibleEntities.length === 0 ? (
            <p className="text-sm text-muted-fg text-center py-6">Aucune entité correspondante.</p>
          ) : (
            visibleEntities.map((entity) => (
              <EntityRow key={entity.key} entity={entity} containerId={diff.containerId} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── CoverageNotes ────────────────────────────────────────────────────────────

function CoverageNotes({ notes }: { notes: CoverageEntry[] }) {
  const [open, setOpen] = useState(true);
  if (notes.length === 0) return null;

  return (
    <div className="border border-warning/30 bg-warning/5 rounded-xl overflow-hidden mb-2">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-warning/10 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-warning">
          <path d="M8 2L14 13H2L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M8 6v3M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="text-sm font-semibold text-warning flex-1">
          {notes.length} écart{notes.length > 1 ? 's' : ''} de couverture
        </span>
        <span className="text-xs text-warning/70">
          Tags présents dans certains containers, absents dans d'autres
        </span>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className={clsx('shrink-0 text-warning/60 transition-transform', open && 'rotate-180')}
        >
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="border-t border-warning/20 divide-y divide-warning/10">
          {notes.map((note) => (
            <div key={note.entityName} className="px-4 py-3 flex items-start gap-3">
              <span className={clsx('text-xs px-1.5 py-0.5 rounded-md font-semibold shrink-0 mt-0.5', KIND_STYLE[note.kind])}>
                {KIND_LABEL[note.kind]}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">{note.entityName}</span>
                <div className="flex flex-wrap gap-x-4 mt-1">
                  {note.presentIn.length > 0 && (
                    <span className="text-xs text-muted-fg">
                      <span className="text-success font-semibold">Présent</span> : {note.presentIn.join(', ')}
                    </span>
                  )}
                  <span className="text-xs text-muted-fg">
                    <span className="text-warning font-semibold">Absent</span> : {note.missingIn.join(', ')}
                  </span>
                </div>
              </div>
              <Badge variant="warning">Sera créé</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── GA4 Event Filter ─────────────────────────────────────────────────────────

function EventNameFilter({
  eventNames, active, onSelect,
}: { eventNames: string[]; active: string | null; onSelect: (name: string | null) => void }) {
  const [query, setQuery] = useState('');
  if (eventNames.length === 0) return null;

  const suggestions = query.trim()
    ? eventNames.filter((n) => n.toLowerCase().includes(query.toLowerCase()))
    : eventNames;

  function handleInput(val: string) {
    setQuery(val);
    if (val === '') onSelect(null);
  }

  function handleSelect(name: string) {
    setQuery(name);
    onSelect(name);
  }

  function handleClear() {
    setQuery('');
    onSelect(null);
  }

  return (
    <div className="mb-3 p-3 bg-card border border-border rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-muted-fg shrink-0">
          <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.25"/>
          <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
        <span className="text-xs font-semibold text-muted-fg">Filtrer par event GA4</span>
        {active && (
          <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-1">{active}</span>
        )}
      </div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="add_to_cart, purchase…"
          className="w-full h-8 pl-3 pr-7 text-xs font-mono border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-fg/50"
        />
        {query && (
          <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-fg hover:text-foreground">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
      {query && suggestions.length > 0 && suggestions[0] !== query && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.map((name) => (
            <button
              key={name}
              onClick={() => handleSelect(name)}
              className={clsx(
                'text-xs font-mono px-2 py-0.5 rounded-full border transition-all',
                active === name
                  ? 'bg-primary text-white border-primary'
                  : 'bg-muted text-muted-fg border-border hover:border-primary/50 hover:text-foreground'
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DiffView ─────────────────────────────────────────────────────────────────

export function DiffView({ diffs }: { diffs: Record<string, ContainerDiff> }) {
  const [activeEventFilter, setActiveEventFilter] = useState<string | null>(null);
  const diffList = Object.values(diffs);

  const readyDiffs = useMemo(() => diffList.filter((d) => d.status === 'ready'), [diffList]);
  const eventNames = useMemo(() => extractEventNames(readyDiffs), [readyDiffs]);
  const coverageNotes = useMemo(() => buildCoverageNotes(readyDiffs), [readyDiffs]);

  if (diffList.length === 0) return null;

  return (
    <div className="space-y-2">
      <EventNameFilter
        eventNames={eventNames}
        active={activeEventFilter}
        onSelect={setActiveEventFilter}
      />
      <CoverageNotes notes={coverageNotes} />
      {diffList.map((diff) => (
        <ContainerDiffPanel
          key={diff.containerId}
          diff={diff}
          activeEventFilter={activeEventFilter}
        />
      ))}
    </div>
  );
}
