import { useMemo } from 'react';
import type { GTMVariable } from '../../types/gtm';
import type { MonitoringContainerData } from '../../data/monitoring-mock';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VariableContentDrawerProps {
  rowKey: string;       // variable name from matrix row
  varType: string;      // variable type (jsm, v, c, u, k…)
  typeColor: string;    // category color for badges
  typeLabel: string;
  containers: MonitoringContainerData[];
  onClose: () => void;
  onRename: () => void;
}

// ─── Content extraction ────────────────────────────────────────────────────────

interface VariableContent {
  label: string;
  content: string;
  isCode: boolean;
}

function extractContent(v: GTMVariable): VariableContent {
  const p = v.parameter ?? [];
  switch (v.type) {
    case 'jsm': {
      const js = p.find((x) => x.key === 'javascript')?.value ?? '';
      return { label: 'Code JavaScript', content: js, isCode: true };
    }
    case 'v': {
      const name = p.find((x) => x.key === 'name')?.value ?? '';
      return { label: 'Chemin Data Layer', content: name, isCode: false };
    }
    case 'c': {
      const val = p.find((x) => x.key === 'value')?.value ?? '';
      return { label: 'Valeur constante', content: val, isCode: false };
    }
    case 'u': {
      const comp = p.find((x) => x.key === 'component')?.value ?? '';
      return { label: 'Composant URL', content: comp, isCode: false };
    }
    case 'k': {
      const name = p.find((x) => x.key === 'cookieName')?.value ?? '';
      return { label: 'Nom du cookie', content: name, isCode: false };
    }
    case 'aev': {
      const varType = p.find((x) => x.key === 'varType')?.value ?? '';
      return { label: 'Type Auto-Event', content: varType, isCode: false };
    }
    default: {
      const raw = p.map((x) => `${x.key}: ${x.value}`).join('\n');
      return { label: 'Paramètres', content: raw, isCode: false };
    }
  }
}

// ─── Diff lines helper for JS code ────────────────────────────────────────────

function diffLines(ref: string, other: string): Array<{ line: string; status: 'same' | 'added' | 'removed' }> {
  const refLines = ref.split('\n');
  const otherLines = other.split('\n');
  const refSet = new Set(refLines.map((l) => l.trim()));
  const otherSet = new Set(otherLines.map((l) => l.trim()));

  const result: Array<{ line: string; status: 'same' | 'added' | 'removed' }> = [];

  for (const line of otherLines) {
    const trimmed = line.trim();
    if (!trimmed) { result.push({ line, status: 'same' }); continue; }
    result.push({ line, status: refSet.has(trimmed) ? 'same' : 'added' });
  }
  for (const line of refLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!otherSet.has(trimmed)) {
      result.push({ line, status: 'removed' });
    }
  }
  return result;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function VariableContentDrawer({
  rowKey,
  varType,
  typeColor,
  typeLabel,
  containers,
  onClose,
  onRename,
}: VariableContentDrawerProps) {
  // For each container, find the variable with matching name + type
  const entries = useMemo(() => {
    return containers.map((c) => {
      const found = c.variables.find((v) => v.name === rowKey && v.type === varType);
      return {
        containerId: c.containerId,
        containerName: c.containerName,
        publicId: c.publicId,
        variable: found ?? null,
        content: found ? extractContent(found) : null,
      };
    });
  }, [containers, rowKey, varType]);

  // Reference = content of first container that has the variable
  const reference = useMemo(() => {
    return entries.find((e) => e.content !== null)?.content ?? null;
  }, [entries]);

  const presentContents = entries.filter((e) => e.content !== null).map((e) => e.content!.content);
  const uniqueContents = new Set(presentContents);
  const hasDifferences = uniqueContents.size > 1;
  const absentCount = entries.filter((e) => e.content === null).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'hsl(220 13% 10% / 0.35)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl overflow-hidden"
        style={{ width: '560px', backgroundColor: 'white', borderLeft: '1px solid hsl(220 13% 91%)' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b shrink-0" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                  style={{ backgroundColor: typeColor + '22', color: typeColor }}
                >
                  {typeLabel}
                </span>
                {hasDifferences && (
                  <span
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{ backgroundColor: 'hsl(46 100% 50% / 0.15)', color: 'hsl(35 90% 40%)' }}
                  >
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1"/><path d="M4.5 2.5v2M4.5 6.5v.25" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                    Contenu différent entre containers
                  </span>
                )}
              </div>
              <h2 className="text-sm font-semibold text-foreground font-mono truncate">{rowKey}</h2>
              <p className="text-xs text-muted-fg mt-0.5">
                {entries.filter((e) => e.content).length} container{entries.filter((e) => e.content).length > 1 ? 's' : ''} · {absentCount > 0 ? `${absentCount} absent` : 'présent partout'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onRename}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-card"
                style={{ borderColor: 'hsl(220 13% 85%)', color: 'hsl(220 13% 40%)' }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M7.5 1l2.5 2.5-6 6H1.5V7l6-6z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
                </svg>
                Renommer
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-card transition-colors text-muted-fg hover:text-foreground"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {entries.map((entry) => {
            const isAbsent = entry.content === null;
            const content = entry.content;
            const isRef = reference && content && content.content === reference.content;
            const differs = reference && content && content.content !== reference.content;

            let borderColor = 'hsl(220 13% 91%)';
            let bgColor = 'white';
            if (!isAbsent) {
              if (differs) {
                borderColor = 'hsl(46 80% 70%)';
                bgColor = 'hsl(46 100% 98%)';
              } else {
                borderColor = 'hsl(142 60% 70%)';
                bgColor = 'hsl(142 72% 98%)';
              }
            }

            return (
              <div
                key={entry.containerId}
                className="rounded-xl border overflow-hidden"
                style={{ borderColor, backgroundColor: bgColor }}
              >
                {/* Container header */}
                <div
                  className="flex items-center justify-between px-3.5 py-2.5 border-b"
                  style={{ borderColor, backgroundColor: isAbsent ? 'hsl(220 20% 98%)' : bgColor }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{entry.containerName}</span>
                    <span className="font-mono text-[10px] text-muted-fg">{entry.publicId}</span>
                  </div>
                  {isAbsent ? (
                    <span
                      className="flex items-center gap-1 text-[11px] font-medium"
                      style={{ color: 'hsl(220 13% 55%)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      Variable absente
                    </span>
                  ) : differs ? (
                    <span
                      className="flex items-center gap-1 text-[11px] font-medium"
                      style={{ color: 'hsl(35 90% 40%)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1"/><path d="M5 3v2M5 7v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
                      Contenu différent
                    </span>
                  ) : (
                    <span
                      className="flex items-center gap-1 text-[11px] font-medium"
                      style={{ color: 'hsl(142 60% 35%)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {isRef ? 'Référence' : 'Identique'}
                    </span>
                  )}
                </div>

                {/* Content */}
                {!isAbsent && content && (
                  <div className="px-3.5 py-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'hsl(220 13% 55%)' }}>
                        {content.label}
                      </span>
                    </div>
                    {content.isCode ? (
                      // Show diff view if there are differences, plain code otherwise
                      <CodeBlock
                        code={content.content}
                        reference={reference?.content ?? null}
                        differs={!!differs}
                      />
                    ) : (
                      <div
                        className="px-3 py-2 rounded-lg font-mono text-xs break-all"
                        style={{
                          backgroundColor: differs ? 'hsl(46 100% 94%)' : 'hsl(220 20% 96%)',
                          color: differs ? 'hsl(35 90% 32%)' : 'hsl(220 13% 25%)',
                        }}
                      >
                        {content.content || <span className="opacity-40 italic">vide</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer note about naming constraint */}
        <div
          className="px-5 py-3 border-t shrink-0"
          style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)' }}
        >
          <div className="flex items-start gap-2 text-xs" style={{ color: 'hsl(220 13% 50%)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 mt-0.5">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/>
              <path d="M6 4v2.5M6 8v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
            <span>
              Comparaison possible uniquement entre variables portant le même nom exact.
              Utilisez <button onClick={onRename} className="underline hover:text-foreground transition-colors">Renommer</button> pour homogénéiser les noms d'abord.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Code block with optional diff highlighting ────────────────────────────────

function CodeBlock({ code, reference, differs }: { code: string; reference: string | null; differs: boolean }) {
  const lines = useMemo(() => {
    if (!differs || !reference) {
      return code.split('\n').map((line) => ({ line, status: 'same' as const }));
    }
    return diffLines(reference, code);
  }, [code, reference, differs]);

  return (
    <div
      className="rounded-lg overflow-auto text-[11px] font-mono"
      style={{
        backgroundColor: 'hsl(220 13% 10%)',
        maxHeight: '240px',
        border: differs ? '1px solid hsl(46 80% 55%)' : '1px solid hsl(220 13% 20%)',
      }}
    >
      <div className="py-2">
        {lines.map((item, i) => {
          const bg =
            item.status === 'added'
              ? 'hsl(46 100% 50% / 0.2)'
              : item.status === 'removed'
              ? 'hsl(0 80% 50% / 0.2)'
              : 'transparent';
          const prefix =
            item.status === 'added' ? '+' : item.status === 'removed' ? '-' : ' ';
          const color =
            item.status === 'added'
              ? 'hsl(46 90% 65%)'
              : item.status === 'removed'
              ? 'hsl(0 80% 65%)'
              : 'hsl(220 13% 75%)';

          return (
            <div
              key={i}
              className="flex"
              style={{ backgroundColor: bg }}
            >
              <span
                className="w-4 shrink-0 text-center select-none"
                style={{ color: item.status !== 'same' ? color : 'hsl(220 13% 40%)', opacity: 0.7 }}
              >
                {prefix}
              </span>
              <span
                className="px-2 whitespace-pre"
                style={{ color }}
              >
                {item.line}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
