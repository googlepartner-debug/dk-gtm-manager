import { useMemo } from 'react';
import { clsx } from 'clsx';
import type { ContainerDiff, DiffEntity, GTMTag } from '../../types/gtm';
import { useGTMStore } from '../../store/gtm-store';

// ─── Types ────────────────────────────────────────────────────────────────────

type CellStatus = 'present' | 'modified' | 'absent' | 'not-in-package';

interface MatrixCell {
  status: CellStatus;
  entityKey: string | null;
  tagName: string | null;
}

interface MatrixRow {
  eventName: string;
  cells: Record<string, MatrixCell>; // keyed by containerId
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEventName(entity: DiffEntity): string | null {
  if (entity.kind !== 'tag') return null;
  const tag = entity.proposed as GTMTag;
  if (tag.type !== 'gaawe') return null;
  return tag.parameter?.find((p) => p.key === 'event_name')?.value ?? null;
}

function buildMatrix(diffs: ContainerDiff[]): MatrixRow[] {
  const readyDiffs = diffs.filter((d) => d.status === 'ready');

  // Collect all unique event_names across all containers
  const allEventNames = new Set<string>();
  for (const diff of readyDiffs) {
    for (const entity of diff.entities) {
      const en = getEventName(entity);
      if (en) allEventNames.add(en);
    }
  }

  const sortedNames = Array.from(allEventNames).sort();

  return sortedNames.map((eventName) => {
    const cells: Record<string, MatrixCell> = {};

    for (const diff of readyDiffs) {
      const matching = diff.entities.filter((e) => getEventName(e) === eventName);

      if (matching.length === 0) {
        cells[diff.containerId] = { status: 'not-in-package', entityKey: null, tagName: null };
      } else {
        // Pick the "most important" status if multiple tags with same event_name
        const priority: CellStatus[] = ['absent', 'modified', 'present'];
        let best: MatrixCell = { status: 'present', entityKey: null, tagName: null };

        for (const entity of matching) {
          let cellStatus: CellStatus;
          if (entity.status === 'new') cellStatus = 'absent';
          else if (entity.status === 'modified') cellStatus = 'modified';
          else cellStatus = 'present';

          if (priority.indexOf(cellStatus) < priority.indexOf(best.status)) {
            best = { status: cellStatus, entityKey: entity.key, tagName: entity.name };
          } else if (best.entityKey === null) {
            best = { status: cellStatus, entityKey: entity.key, tagName: entity.name };
          }
        }

        cells[diff.containerId] = best;
      }
    }

    return { eventName, cells };
  });
}

// ─── Cell ─────────────────────────────────────────────────────────────────────

function Cell({ cell, containerId, eventName }: { cell: MatrixCell; containerId: string; eventName: string }) {
  const { toggleEntitySelection } = useGTMStore();

  const base = 'w-full h-11 flex items-center justify-center border-r border-border last:border-r-0 transition-colors';

  if (cell.status === 'not-in-package') {
    return (
      <td className={clsx(base, 'bg-muted/30')}>
        <span className="text-muted-fg/30 text-xs">—</span>
      </td>
    );
  }

  const canClick = cell.status === 'absent' && cell.entityKey;

  return (
    <td
      className={clsx(
        base,
        cell.status === 'present' && 'bg-success/8',
        cell.status === 'modified' && 'bg-warning/8',
        cell.status === 'absent' && 'bg-destructive/8 cursor-pointer hover:bg-destructive/15',
      )}
      title={cell.tagName ?? eventName}
      onClick={() => canClick && toggleEntitySelection(containerId, cell.entityKey!)}
    >
      {cell.status === 'present' && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" className="fill-success/20 stroke-success" strokeWidth="1"/>
          <path d="M5 8l2 2 4-4" stroke="currentColor" className="stroke-success" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {cell.status === 'modified' && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" className="fill-warning/20 stroke-warning" strokeWidth="1"/>
          <path d="M8 5v3.5M8 11h.01" stroke="currentColor" className="stroke-warning" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )}
      {cell.status === 'absent' && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" className="fill-destructive/15 stroke-destructive/60" strokeWidth="1"/>
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" className="stroke-destructive" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )}
    </td>
  );
}

// ─── GA4CoverageMatrix ────────────────────────────────────────────────────────

interface GA4CoverageMatrixProps {
  diffs: Record<string, ContainerDiff>;
}

export function GA4CoverageMatrix({ diffs }: GA4CoverageMatrixProps) {
  const { toggleEntitySelection } = useGTMStore();

  const readyDiffs = useMemo(
    () => Object.values(diffs).filter((d) => d.status === 'ready'),
    [diffs]
  );

  const matrix = useMemo(() => buildMatrix(readyDiffs), [readyDiffs]);

  if (readyDiffs.length === 0) {
    return (
      <div className="text-center py-10 text-muted-fg text-sm">
        Lancez l'analyse pour voir la couverture GA4.
      </div>
    );
  }

  if (matrix.length === 0) {
    return (
      <div className="text-center py-10 text-muted-fg text-sm">
        Aucun tag GA4 Event (gaawe) dans ce package.
      </div>
    );
  }

  const absentCount = matrix.reduce((acc, row) =>
    acc + Object.values(row.cells).filter((c) => c.status === 'absent').length, 0
  );
  const totalCells = matrix.reduce((acc, row) =>
    acc + Object.values(row.cells).filter((c) => c.status !== 'not-in-package').length, 0
  );
  const presentCount = matrix.reduce((acc, row) =>
    acc + Object.values(row.cells).filter((c) => c.status === 'present').length, 0
  );
  const coveragePct = totalCells > 0 ? Math.round((presentCount / totalCells) * 100) : 0;

  function selectAllAbsent() {
    for (const diff of readyDiffs) {
      for (const row of matrix) {
        const cell = row.cells[diff.containerId];
        if (cell?.status === 'absent' && cell.entityKey) {
          toggleEntitySelection(diff.containerId, cell.entityKey);
        }
      }
    }
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center gap-4 mb-3 px-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-fg">
          <div className="w-3 h-3 rounded-full bg-success" />
          Présent
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-fg">
          <div className="w-3 h-3 rounded-full bg-warning" />
          À mettre à jour
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-fg">
          <div className="w-3 h-3 rounded-full bg-destructive/60" />
          Absent
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-fg">
          <div className="w-3 h-3 rounded-full bg-muted border border-border" />
          Hors package
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-semibold text-foreground">
            Couverture : <span className={coveragePct === 100 ? 'text-success' : coveragePct >= 70 ? 'text-warning' : 'text-destructive'}>{coveragePct}%</span>
          </span>
          {absentCount > 0 && (
            <button
              onClick={selectAllAbsent}
              className="text-xs bg-destructive/10 text-destructive border border-destructive/20 px-2.5 py-1 rounded-full hover:bg-destructive/20 transition-colors font-semibold"
            >
              Sélectionner {absentCount} absent{absentCount > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {/* Matrix table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-fg w-48 border-r border-border sticky left-0 bg-muted z-10">
                  Événement GA4
                </th>
                {readyDiffs.map((diff) => (
                  <th
                    key={diff.containerId}
                    className="px-3 py-2.5 text-xs font-semibold text-muted-fg text-center border-r border-border last:border-r-0 min-w-[120px]"
                    title={`${diff.containerName} — ${diff.containerPublicId}`}
                  >
                    <div className="truncate max-w-[110px]">{diff.containerName}</div>
                    <div className="text-muted-fg/50 font-normal">{diff.containerPublicId}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => {
                const absentInRow = Object.values(row.cells).filter((c) => c.status === 'absent').length;
                const presentInRow = Object.values(row.cells).filter((c) => c.status === 'present').length;
                const totalInRow = Object.values(row.cells).filter((c) => c.status !== 'not-in-package').length;

                return (
                  <tr key={row.eventName} className={clsx('border-b border-border last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
                    <td className="px-4 py-0 border-r border-border sticky left-0 bg-card z-10" style={i % 2 !== 0 ? { backgroundColor: 'hsl(var(--muted) / 0.2)' } : {}}>
                      <div className="flex items-center gap-2 h-11">
                        <code className="text-xs font-mono text-foreground font-semibold">{row.eventName}</code>
                        {absentInRow > 0 && (
                          <span className="text-xs text-destructive font-semibold ml-auto">
                            {presentInRow}/{totalInRow}
                          </span>
                        )}
                      </div>
                    </td>
                    {readyDiffs.map((diff) => (
                      <Cell
                        key={diff.containerId}
                        cell={row.cells[diff.containerId] ?? { status: 'not-in-package', entityKey: null, tagName: null }}
                        containerId={diff.containerId}
                        eventName={row.eventName}
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {absentCount > 0 && (
        <p className="text-xs text-muted-fg mt-2 px-1">
          Cliquer sur une cellule rouge sélectionne ce tag pour déploiement.
        </p>
      )}
    </div>
  );
}
