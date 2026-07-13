import { useState } from 'react';
import { useDatalayerStore } from '../stores/datalayerStore';
import type { ValidationStatus } from '../types/datalayer.types';

const STATUS_CYCLE: ValidationStatus[] = ['pending', 'validated', 'problem'];
const STATUS_COLOR: Record<ValidationStatus, string> = {
  pending: '#9ca3af',
  validated: '#22c55e',
  problem: '#ef4444',
};
const STATUS_LABEL: Record<ValidationStatus, string> = {
  pending: 'À valider',
  validated: 'Validé',
  problem: 'Problème',
};

const FRESH_MS = 24 * 60 * 60 * 1000;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

// PRD §14.6 — freshness dot: pulsing green if seen in the last 24h, fixed gray if stale (>7 days).
function FreshnessDot({ lastDetection }: { lastDetection: string | null }) {
  if (!lastDetection) return <span className="w-1.5 h-1.5 rounded-full bg-muted-fg/40 shrink-0" title="Aucune détection" />;
  const age = Date.now() - new Date(lastDetection).getTime();
  if (age < FRESH_MS) {
    return <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0 animate-pulse" title="Actif (<24h)" />;
  }
  if (age > STALE_MS) {
    return <span className="w-1.5 h-1.5 rounded-full bg-muted-fg/40 shrink-0" title="Stale (>7j)" />;
  }
  return <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" title="Activité récente" />;
}

interface EventKanbanCardProps {
  eventName: string;
  clientId: string;
  mode: 'master' | 'partner';
  siteId: string | null; // required in 'partner' mode
  onClick?: () => void;
}

export function EventKanbanCard({ eventName, clientId, mode, siteId, onClick }: EventKanbanCardProps) {
  const { events, getVariablesForEvent, setEventStatus, getEventCoverage } = useDatalayerStore();
  const [showFailing, setShowFailing] = useState(false);

  if (mode === 'partner' && siteId) {
    const evt = events.find((e) => e.clientId === clientId && e.siteId === siteId && e.eventName === eventName);
    const vars = getVariablesForEvent(clientId, siteId, eventName);
    const avgCompletion = vars.length ? vars.reduce((s, v) => s + v.percentCompleted, 0) / vars.length : 100;
    const status = evt?.status ?? 'pending';

    function cycleStatus(e: React.MouseEvent) {
      e.stopPropagation();
      if (!evt) return;
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(status) + 1) % STATUS_CYCLE.length];
      setEventStatus(evt.id, next);
    }

    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-card border border-border rounded-lg px-3 py-2.5 hover:shadow-sm transition-all"
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="font-mono text-xs font-medium text-foreground truncate">{eventName}</span>
          <FreshnessDot lastDetection={evt?.lastDetection ?? null} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] tabular-nums" style={{ color: avgCompletion < 95 ? '#f97316' : '#22c55e' }}>
            {Math.round(avgCompletion)}% complété
          </span>
          <span
            onClick={cycleStatus}
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white cursor-pointer hover:opacity-80 transition-opacity"
            style={{ backgroundColor: STATUS_COLOR[status] }}
            title="Cliquer pour changer le statut"
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
      </button>
    );
  }

  // Master mode — aggregated coverage badge across all sites of the client.
  const coverage = getEventCoverage(clientId, eventName);
  const allOk = coverage.failingSites.length === 0;

  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2.5 hover:shadow-sm transition-all">
      <button onClick={onClick} className="w-full text-left group/title">
        <span className="font-mono text-xs font-medium text-foreground group-hover/title:text-primary transition-colors truncate block mb-1.5">{eventName}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setShowFailing((v) => !v); }}
        className="text-[11px] font-medium px-2 py-0.5 rounded-full w-full text-left transition-opacity disabled:hover:opacity-100 hover:opacity-80"
        style={allOk
          ? { backgroundColor: 'hsl(142 60% 95%)', color: 'hsl(142 60% 30%)' }
          : { backgroundColor: 'hsl(0 84% 96%)', color: 'hsl(0 84% 45%)' }}
        disabled={allOk}
      >
        {allOk ? `✅ Validé sur ${coverage.totalSites} containers` : `🔴 Échoue chez ${coverage.failingSites.length} partenaire${coverage.failingSites.length > 1 ? 's' : ''}`}
      </button>
      {showFailing && !allOk && (
        <ul className="mt-1.5 space-y-0.5">
          {coverage.failingSites.map((s) => (
            <li key={s.siteId} className="text-[10px] text-destructive truncate">— {s.siteName}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
