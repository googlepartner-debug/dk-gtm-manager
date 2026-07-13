import { useGTMStore } from '../../../store/gtm-store';
import { useDatalayerStore } from '../stores/datalayerStore';
import { CoverageBar } from './CoverageBar';
import { buildEntityCreation } from '../utils/entityCreation';
import { generateTemplate } from '../utils/dataTransform';
import type { DatalayerVariable } from '../types/datalayer.types';

// PRD §14.6 — slide-over drawer from the right, not a centered modal, so the Kanban column
// context stays visible behind it. Same pattern as EventChainDrawer/TagDrawer.

interface Props {
  eventName: string;
  clientId: string;
  mode: 'master' | 'partner';
  siteId: string | null;
  onClose: () => void;
}

export function EventDetailDrawer({ eventName, clientId, mode, siteId, onClose }: Props) {
  const { dictionary, getVariablesForEvent, getStructureComparison, clients } = useDatalayerStore();
  const { monitoringData, containers, addEntityCreation, pendingEntityCreations } = useGTMStore();

  const client = clients.find((c) => c.clientId === clientId);

  // Partner mode: this site's real variables. Master mode: union across every site (dedup by
  // path) as a "reference" view of the theoretical tracking plan.
  const variables: DatalayerVariable[] = mode === 'partner' && siteId
    ? getVariablesForEvent(clientId, siteId, eventName)
    : dedupeByPath((client?.sites ?? []).flatMap((s) => getVariablesForEvent(clientId, s.siteId, eventName)));

  function dedupeByPath(vars: DatalayerVariable[]): DatalayerVariable[] {
    const seen = new Map<string, DatalayerVariable>();
    for (const v of vars) if (!seen.has(v.variablePath)) seen.set(v.variablePath, v);
    return [...seen.values()];
  }

  const dictEntries = dictionary.filter(
    (d) => d.clientId === clientId && variables.some((v) => v.variablePath === d.variablePath),
  );

  const templateSource: Record<string, unknown> = Object.fromEntries(variables.map((v) => [v.variablePath, v.sampleValue]));
  const template = generateTemplate(templateSource, eventName);

  const comparison = mode === 'master' ? getStructureComparison(clientId, eventName) : [];

  function handleCreateInGTM(v: DatalayerVariable) {
    if (mode !== 'partner' || !siteId) return;
    const alreadyQueued = pendingEntityCreations.some(
      (op) => op.status === 'pending' && op.containerId === siteId && op.variable.name === `DLV - ${v.variablePath}`,
    );
    if (alreadyQueued) return;
    const gtmContainer = containers.find((c) => c.containerId === siteId);
    const { variable, trigger, tag } = buildEntityCreation(v, monitoringData);
    addEntityCreation({
      containerId: siteId,
      containerName: gtmContainer?.name ?? siteId,
      publicId: gtmContainer?.publicId ?? siteId,
      variable, trigger, tag,
      sourceFeature: 'datalayer-mapping',
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-lg flex flex-col bg-white shadow-xl"
        style={{ borderLeft: '1px solid hsl(220 13% 91%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          <div>
            <p className="text-xs text-muted-fg mb-0.5">
              {mode === 'master' ? `Vue Master · ${client?.clientName ?? ''}` : client?.sites.find((s) => s.siteId === siteId)?.siteName ?? ''}
            </p>
            <h2 className="text-base font-semibold text-foreground font-mono">{eventName}</h2>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="text-muted-fg hover:text-foreground transition-colors p-1 -mr-1 mt-0.5">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Variables */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-fg mb-2">Variables</h3>
            <div className="space-y-2">
              {variables.map((v) => {
                const alreadyQueued = pendingEntityCreations.some(
                  (op) => op.status === 'pending' && op.containerId === v.siteId && op.variable.name === `DLV - ${v.variablePath}`,
                );
                return (
                  <div key={v.id} className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'hsl(220 20% 97%)', border: '1px solid hsl(220 13% 91%)' }}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-xs font-medium text-foreground">{v.variablePath}</span>
                      {mode === 'partner' && (
                        v.gtmVariableExists ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'hsl(142 60% 93%)', color: 'hsl(142 60% 30%)' }}>✓ GTM</span>
                        ) : alreadyQueued ? (
                          <span className="text-[10px] text-muted-fg italic">Planifiée</span>
                        ) : (
                          <button
                            onClick={() => handleCreateInGTM(v)}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: 'hsl(267 60% 93%)', color: 'hsl(267 100% 40%)' }}
                          >
                            [+] Créer dans GTM
                          </button>
                        )
                      )}
                    </div>
                    <CoverageBar pct={v.percentCompleted} />
                    {v.anomalies.map((a, i) => <div key={i} className="text-xs text-destructive mt-1">{a.message}</div>)}
                  </div>
                );
              })}
              {variables.length === 0 && <p className="text-sm text-muted-fg italic">Aucune variable détectée.</p>}
            </div>
          </section>

          {/* Dictionary */}
          {dictEntries.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-fg mb-2">Dictionnaire</h3>
              <div className="space-y-1.5">
                {dictEntries.map((d) => (
                  <div key={d.id} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'hsl(220 20% 97%)', border: '1px solid hsl(220 13% 91%)' }}>
                    <div className="font-mono text-xs text-foreground">{d.variablePath}</div>
                    <div className="text-xs text-muted-fg mt-0.5">{d.definition}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Template */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-fg mb-2">dataLayer à implémenter</h3>
            <pre className="text-xs font-mono px-3 py-2.5 rounded-lg overflow-x-auto" style={{ backgroundColor: 'hsl(220 20% 15%)', color: 'hsl(142 70% 65%)' }}>
              {template}
            </pre>
          </section>

          {/* Structure comparator — Master mode only (PRD §14.4) */}
          {mode === 'master' && comparison.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-fg mb-2">Comparateur de structures</h3>
              <div className="space-y-1.5">
                {comparison.map((row) => (
                  <div key={row.siteId} className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: row.keys.length === 0 ? 'hsl(0 84% 97%)' : 'hsl(220 20% 97%)', border: '1px solid hsl(220 13% 91%)' }}>
                    <div className="font-medium text-foreground mb-1">{row.siteName}</div>
                    {row.keys.length === 0 ? (
                      <span className="text-destructive italic">Aucune donnée transmise pour cet event</span>
                    ) : (
                      <span className="font-mono text-muted-fg">{row.keys.join(', ')}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
