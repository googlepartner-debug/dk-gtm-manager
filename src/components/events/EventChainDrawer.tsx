import { useNavigate } from 'react-router-dom';
import type { EventChainStatus } from '../../types/gtm';
import type { MonitoringContainerData } from '../../data/monitoring-mock';

interface Props {
  status: EventChainStatus;
  container: MonitoringContainerData;
  onClose: () => void;
}

function ChainBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{
        backgroundColor: ok ? 'hsl(142 60% 93%)' : 'hsl(0 84% 95%)',
        color: ok ? 'hsl(142 60% 30%)' : 'hsl(0 84% 40%)',
      }}
    >
      <span className="text-[10px]">{ok ? '✓' : '✗'}</span>
      {label}
    </span>
  );
}

export function EventChainDrawer({ status, container, onClose }: Props) {
  const navigate = useNavigate();

  // Resolve triggers for display
  const firingTriggers = container.tags
    .find(
      (t) =>
        t.type === 'gaawe' &&
        t.parameter?.find((p) => p.key === 'event_name' || p.key === 'eventName')?.value === status.eventName,
    )
    ?.firingTriggerId?.map((id) => container.triggers.find((tr) => tr.triggerId === id))
    .filter(Boolean) ?? [];

  const triggerOk = status.triggerCount > 0;
  const varsOk = status.variablesMissing.length === 0 && status.variablesTotal > 0;
  const okVars = status.variablesTotal - status.variablesMissing.length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-md flex flex-col bg-white shadow-xl"
        style={{ borderLeft: '1px solid hsl(220 13% 91%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-5 py-4 border-b"
          style={{ borderColor: 'hsl(220 13% 91%)' }}
        >
          <div>
            <p className="text-xs text-muted-fg mb-0.5">{container.containerName} · {container.publicId}</p>
            <h2 className="text-base font-semibold text-foreground">{status.eventName}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-fg hover:text-foreground transition-colors p-1 -mr-1 mt-0.5"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Tag */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Tag GA4</h3>
              <ChainBadge ok={status.tagPresent} label={status.tagPresent ? 'Présent' : 'Absent'} />
            </div>
            {status.tagPresent ? (
              <div
                className="px-3 py-2.5 rounded-lg text-sm"
                style={{ backgroundColor: 'hsl(220 20% 97%)', border: '1px solid hsl(220 13% 91%)' }}
              >
                <span className="font-medium text-foreground">{status.tagName}</span>
                <span className="ml-2 text-xs text-muted-fg">gaawe</span>
              </div>
            ) : (
              <p className="text-sm text-muted-fg italic">Aucun tag GA4 pour cet event dans ce container.</p>
            )}
          </section>

          {/* Triggers */}
          {status.tagPresent && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Déclencheurs</h3>
                <ChainBadge
                  ok={triggerOk}
                  label={triggerOk ? `${status.triggerCount} lié${status.triggerCount > 1 ? 's' : ''}` : 'Aucun'}
                />
              </div>
              <div className="space-y-1.5">
                {firingTriggers.length > 0 ? firingTriggers.map((tr, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'hsl(220 20% 97%)', border: '1px solid hsl(220 13% 91%)' }}
                  >
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: 'hsl(267 60% 93%)', color: 'hsl(267 100% 40%)' }}
                    >
                      {tr!.type}
                    </span>
                    <span className="text-foreground">{tr!.name}</span>
                  </div>
                )) : (
                  <p className="text-sm text-muted-fg italic">Aucun déclencheur lié à ce tag.</p>
                )}
              </div>
            </section>
          )}

          {/* Variables */}
          {status.tagPresent && status.variablesTotal > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Variables référencées</h3>
                <ChainBadge
                  ok={varsOk}
                  label={`${okVars} / ${status.variablesTotal}`}
                />
              </div>
              <div className="space-y-1">
                {getAllTagVarRefs(container, status.eventName).map((ref) => {
                  const missing = status.variablesMissing.includes(ref);
                  return (
                    <div
                      key={ref}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                      style={{ backgroundColor: 'hsl(220 20% 97%)', border: '1px solid hsl(220 13% 91%)' }}
                    >
                      <span style={{ color: missing ? 'hsl(0 84% 55%)' : 'hsl(142 60% 40%)' }}>
                        {missing ? '✗' : '✓'}
                      </span>
                      <span className="text-foreground">{ref}</span>
                      {missing && (
                        <span className="ml-auto text-xs text-muted-fg">manquante</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 border-t"
          style={{ borderColor: 'hsl(220 13% 91%)' }}
        >
          <button
            onClick={() => { navigate('/dashboard/monitoring'); onClose(); }}
            className="w-full text-center text-sm font-medium py-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'hsl(220 20% 97%)', color: 'hsl(220 13% 46%)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'hsl(220 20% 92%)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'hsl(220 20% 97%)'; }}
          >
            Aller au tag dans Monitoring
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper: extract all unique {{...}} refs from the GA4 event tag in a container
function getAllTagVarRefs(container: MonitoringContainerData, eventName: string): string[] {
  const tag = container.tags.find(
    (t) =>
      t.type === 'gaawe' &&
      t.parameter?.find((p) => p.key === 'event_name' || p.key === 'eventName')?.value === eventName,
  );
  if (!tag?.parameter) return [];
  const refs: string[] = [];
  const VAR_RE = /\{\{([^}]+)\}\}/g;
  function scan(val: string) {
    let m: RegExpExecArray | null;
    VAR_RE.lastIndex = 0;
    while ((m = VAR_RE.exec(val)) !== null) refs.push(m[1]);
  }
  function scanParams(params: NonNullable<typeof tag>['parameter']) {
    for (const p of params ?? []) {
      if (p.value) scan(p.value);
      if (p.list) scanParams(p.list);
      if (p.map) scanParams(p.map);
    }
  }
  scanParams(tag.parameter);
  return [...new Set(refs)];
}
