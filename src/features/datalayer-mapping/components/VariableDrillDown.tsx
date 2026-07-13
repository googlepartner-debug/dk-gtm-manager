import { useGTMStore } from '../../../store/gtm-store';
import { useDatalayerStore } from '../stores/datalayerStore';
import { CoverageBar } from './CoverageBar';
import { buildEntityCreation } from '../utils/entityCreation';
import type { DatalayerVariable } from '../types/datalayer.types';

// Reuses the visual language of EventsPage's drill-down (ScoreDots/CoverageBar/breadcrumb,
// PRD §10) — same completion-based color coding, adapted to a single site's real dataLayer
// instead of a cross-container GTM config comparison.

export function VariableDrillDown({ eventName, onBack }: { eventName: string; onBack: () => void }) {
  const { activeClientId, activeSiteId, getVariablesForEvent } = useDatalayerStore();
  const { containers, monitoringData, addEntityCreation, pendingEntityCreations } = useGTMStore();

  if (!activeClientId || !activeSiteId) {
    return <p className="text-sm text-muted-fg py-6">Sélectionne un site pour explorer les variables.</p>;
  }

  const variables = getVariablesForEvent(activeClientId, activeSiteId, eventName);
  const gtmContainer = containers.find((c) => c.containerId === activeSiteId);

  function handleCreateInGTM(v: DatalayerVariable) {
    const alreadyQueued = pendingEntityCreations.some(
      (op) => op.status === 'pending' && op.containerId === v.siteId && op.variable.name === `DLV - ${v.variablePath}`,
    );
    if (alreadyQueued) return;
    const { variable, trigger, tag } = buildEntityCreation(v, monitoringData);
    addEntityCreation({
      containerId: v.siteId,
      containerName: gtmContainer?.name ?? v.siteId,
      publicId: gtmContainer?.publicId ?? v.siteId,
      variable, trigger, tag,
      sourceFeature: 'datalayer-mapping',
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-fg hover:bg-muted transition-colors"
          title="Retour"
          aria-label="Retour"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-fg font-medium">Events</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted-fg"><path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span className="text-xs px-2.5 py-1 rounded-full bg-primary text-white font-semibold">{eventName}</span>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-fg uppercase tracking-wide border-b border-border" style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
              <th className="px-4 py-2.5">Variable</th>
              <th className="px-3 py-2.5 w-40">% Complété</th>
              <th className="px-3 py-2.5">Anomalies</th>
              <th className="px-3 py-2.5 w-56">État GTM</th>
            </tr>
          </thead>
          <tbody>
            {variables.map((v) => {
              const alreadyQueued = pendingEntityCreations.some(
                (op) => op.status === 'pending' && op.containerId === v.siteId && op.variable.name === `DLV - ${v.variablePath}`,
              );
              return (
                <tr key={v.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs">{v.variablePath}</td>
                  <td className="px-3 py-2.5"><CoverageBar pct={v.percentCompleted} /></td>
                  <td className="px-3 py-2.5">
                    {v.anomalies.length === 0
                      ? <span className="text-xs text-muted-fg">—</span>
                      : <div className="space-y-1">{v.anomalies.map((a, i) => <div key={i} className="text-xs text-destructive">{a.message}</div>)}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    {v.gtmVariableExists ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: 'hsl(142 60% 96%)', color: 'hsl(142 60% 30%)', border: '1px solid hsl(142 60% 80%)' }}>
                        ✓ Présente
                      </span>
                    ) : alreadyQueued ? (
                      <span className="text-xs text-muted-fg italic">Planifiée — voir Déployer</span>
                    ) : (
                      <button
                        onClick={() => handleCreateInGTM(v)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:shadow-sm"
                        style={{ backgroundColor: 'hsl(267 60% 96%)', color: 'hsl(267 100% 40%)', border: '1px solid hsl(267 60% 85%)' }}
                        title="Planifie la création dans GTM — à publier depuis la page Déployer"
                      >
                        [+] Créer dans GTM
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {variables.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-fg">Aucune variable pour cet event.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
