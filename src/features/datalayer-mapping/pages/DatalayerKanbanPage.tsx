import { useEffect, useRef, useState } from 'react';
import { useDatalayerStore } from '../stores/datalayerStore';
import { EventKanbanCard } from '../components/EventKanbanCard';
import { EventDetailDrawer } from '../components/EventDetailDrawer';
import { KANBAN_GLOBAL_COLUMN, KANBAN_UNCLASSIFIED_COLUMN } from '../types/datalayer.types';
import { ALERT_THRESHOLD } from '../constants/ga4Events';

type ViewMode = 'master' | 'partner';

// PRD §14.6 — Focus Mode editor: add/remove/reorder the events that compose the funnel,
// per client (datalayerStore.getFocusEvents/setFocusEvents). Reorder via native HTML5
// drag-and-drop — no library needed for a handful of sequential steps.
function FocusModeEditor({
  events,
  onChange,
  onClose,
}: {
  events: string[];
  onChange: (next: string[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [newEvent, setNewEvent] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  function remove(i: number) {
    onChange(events.filter((_, idx) => idx !== i));
  }

  function add() {
    const name = newEvent.trim();
    if (!name || events.includes(name)) return;
    onChange([...events, name]);
    setNewEvent('');
  }

  function handleDrop(dropIndex: number) {
    if (dragIndex === null || dragIndex === dropIndex) { setDragIndex(null); setOverIndex(null); return; }
    const next = [...events];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    onChange(next);
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-9 z-50 w-80 rounded-lg shadow-lg p-3 space-y-2"
      style={{ backgroundColor: 'white', border: '1px solid hsl(220 13% 88%)' }}
    >
      <p className="text-xs font-semibold text-foreground">Étapes du funnel (Focus Mode)</p>
      <div className="space-y-1">
        {events.map((name, i) => (
          <div
            key={name}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => { e.preventDefault(); if (overIndex !== i) setOverIndex(i); }}
            onDrop={(e) => { e.preventDefault(); handleDrop(i); }}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
            className="flex items-center gap-1.5 rounded px-1 -mx-1 transition-colors"
            style={{
              opacity: dragIndex === i ? 0.4 : 1,
              backgroundColor: overIndex === i && dragIndex !== null && dragIndex !== i ? 'hsl(267 100% 59% / 0.08)' : 'transparent',
              borderTop: overIndex === i && dragIndex !== null && dragIndex !== i ? '2px solid hsl(267 100% 59%)' : '2px solid transparent',
              cursor: 'grab',
            }}
          >
            <span className="text-muted-fg text-xs shrink-0" title="Glisser pour réordonner">⠿</span>
            <span className="font-mono text-xs text-foreground flex-1 truncate">{name}</span>
            <button onClick={() => remove(i)} aria-label={`Retirer ${name} du funnel`} className="text-xs text-destructive hover:opacity-70 px-1">×</button>
          </div>
        ))}
        {events.length === 0 && <p className="text-xs text-muted-fg italic">Aucune étape — le connecteur restera vide.</p>}
      </div>
      <div className="flex items-center gap-1.5 pt-1 border-t border-border">
        <input
          type="text"
          value={newEvent}
          onChange={(e) => setNewEvent(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="nom_event"
          className="flex-1 h-7 px-2 text-xs font-mono border border-border rounded bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button onClick={add} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: 'hsl(267 100% 59%)', color: 'white' }}>
          Ajouter
        </button>
      </div>
    </div>
  );
}

function FunnelConnector({ health }: { health: { step: string; pct: number }[] }) {
  return (
    <div className="flex items-center gap-2 mb-5 px-1">
      {health.map((h, i) => {
        const broken = h.pct < ALERT_THRESHOLD;
        return (
          <div key={h.step} className="flex items-center flex-1">
            <div
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium shrink-0"
              style={broken
                ? { backgroundColor: 'hsl(0 84% 96%)', color: 'hsl(0 84% 45%)', border: '1px solid hsl(0 84% 85%)' }
                : { backgroundColor: 'hsl(142 60% 95%)', color: 'hsl(142 60% 30%)', border: '1px solid hsl(142 60% 80%)' }}
            >
              <span className="font-mono">{h.step}</span>
              <span className="tabular-nums text-[10px]">{Math.round(h.pct)}%</span>
            </div>
            {i < health.length - 1 && (
              <div
                className="flex-1 h-0.5 mx-1"
                style={broken || health[i + 1].pct < ALERT_THRESHOLD
                  ? { backgroundImage: 'repeating-linear-gradient(90deg, hsl(0 84% 60%) 0 6px, transparent 6px 12px)' }
                  : { backgroundColor: 'hsl(142 60% 60%)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Contenu de la vue Kanban, sans header ni sélecteur client/site propres — fusionné dans
// DataLayerMappingPage (2026-07-14) via un toggle Vue Liste/Vue Kanban : les deux vues
// tournent sur le même datalayerStore (mêmes events/variables/occurrences), pas la peine
// de dupliquer le sélecteur ni la page.
export function KanbanView() {
  const {
    clients, activeClientId, activeSiteId,
    getKanbanColumnsForSite, getKanbanColumnsAggregated,
    getVariablesForEvent, getEventCoverage, getFocusEvents, setFocusEvents,
  } = useDatalayerStore();

  const [mode, setMode] = useState<ViewMode>('master');
  const [ecommerceOnly, setEcommerceOnly] = useState(false);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusEditorOpen, setFocusEditorOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  // PRD §14.4 — selecting a partner site switches the view from Master to Partner.
  useEffect(() => {
    setMode(activeSiteId ? 'partner' : 'master');
  }, [activeSiteId]);

  const activeClient = clients.find((c) => c.clientId === activeClientId);
  if (!activeClientId) {
    return <p className="text-sm text-muted-fg py-6">Sélectionne un client.</p>;
  }

  const columns = mode === 'partner' && activeSiteId
    ? getKanbanColumnsForSite(activeClientId, activeSiteId)
    : getKanbanColumnsAggregated(activeClientId);

  const ECOMMERCE_EVENT_NAMES = new Set(['view_item_list', 'view_item', 'add_to_cart', 'begin_checkout', 'purchase']);

  function isInError(eventName: string): boolean {
    if (mode === 'partner' && activeSiteId) {
      const vars = getVariablesForEvent(activeClientId!, activeSiteId, eventName);
      return vars.some((v) => v.percentCompleted < ALERT_THRESHOLD || v.anomalies.length > 0);
    }
    return getEventCoverage(activeClientId!, eventName).failingSites.length > 0;
  }

  function stepHealth(step: string): number {
    if (mode === 'partner' && activeSiteId) {
      const vars = getVariablesForEvent(activeClientId!, activeSiteId, step);
      return vars.length ? vars.reduce((s, v) => s + v.percentCompleted, 0) / vars.length : 0;
    }
    const cov = getEventCoverage(activeClientId!, step);
    return cov.totalSites ? (cov.okSites / cov.totalSites) * 100 : 0;
  }
  const funnelSteps = getFocusEvents(activeClientId);
  const funnelHealth = funnelSteps.map((step) => ({ step, pct: stepHealth(step) }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-fg">
          {mode === 'master'
            ? `Vue Master — plan théorique agrégé sur ${activeClient?.sites.length ?? 0} sites`
            : `Vue Partenaire — ${activeClient?.sites.find((s) => s.siteId === activeSiteId)?.siteName ?? ''}`}
        </p>
      </div>

      {/* Filtres — le sélecteur client/site est celui de DataLayer Mapping, partagé */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="ml-auto flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-fg cursor-pointer select-none">
            <input type="checkbox" checked={ecommerceOnly} onChange={(e) => setEcommerceOnly(e.target.checked)} className="rounded" />
            🟢 E-commerce Only
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-fg cursor-pointer select-none">
            <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} className="rounded" />
            🔴 Errors Only
          </label>
          <div className="relative">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setFocusMode((v) => !v)}
                className="text-sm font-medium pl-3 pr-2 py-1.5 rounded-l-lg transition-colors"
                style={focusMode
                  ? { backgroundColor: 'hsl(267 100% 59%)', color: 'white' }
                  : { backgroundColor: 'hsl(220 20% 93%)', color: 'hsl(220 13% 40%)' }}
              >
                ⚡ Focus Mode
              </button>
              <button
                onClick={() => setFocusEditorOpen((v) => !v)}
                title="Configurer les étapes du funnel"
                aria-label="Configurer les étapes du funnel"
                className="text-sm font-medium px-2 py-1.5 rounded-r-lg transition-colors"
                style={focusMode
                  ? { backgroundColor: 'hsl(267 100% 59%)', color: 'white', borderLeft: '1px solid rgba(255,255,255,0.3)' }
                  : { backgroundColor: 'hsl(220 20% 93%)', color: 'hsl(220 13% 40%)', borderLeft: '1px solid hsl(220 13% 85%)' }}
              >
                ⚙
              </button>
            </div>
            {focusEditorOpen && (
              <FocusModeEditor
                events={funnelSteps}
                onChange={(next) => setFocusEvents(activeClientId, next)}
                onClose={() => setFocusEditorOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Focus Mode — funnel connector (PRD §14.6) */}
      {focusMode && <FunnelConnector health={funnelHealth} />}

      {/* Columns */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((col) => {
          const isSpecial = col.columnId === KANBAN_GLOBAL_COLUMN || col.columnId === KANBAN_UNCLASSIFIED_COLUMN;
          const filteredNames = col.eventNames.filter((name) => {
            if (ecommerceOnly && !ECOMMERCE_EVENT_NAMES.has(name)) return false;
            if (errorsOnly && !isInError(name)) return false;
            return true;
          });
          if (filteredNames.length === 0) return null;

          return (
            <div key={col.columnId} className="shrink-0 w-64">
              <div
                className="text-xs font-semibold uppercase tracking-wide px-2 py-1.5 rounded-t-lg"
                style={isSpecial
                  ? { backgroundColor: 'hsl(267 60% 95%)', color: 'hsl(267 100% 40%)' }
                  : { backgroundColor: 'hsl(220 20% 95%)', color: 'hsl(220 13% 40%)' }}
              >
                {col.columnId}
                <span className="ml-1.5 font-normal normal-case opacity-70">({filteredNames.length})</span>
              </div>
              <div className="bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[80px]">
                {filteredNames.map((eventName) => {
                  const dimmed = focusMode && !funnelSteps.includes(eventName);
                  return (
                    <div key={eventName} className="transition-opacity" style={{ opacity: dimmed ? 0.25 : 1 }}>
                      <EventKanbanCard
                        eventName={eventName}
                        clientId={activeClientId}
                        mode={mode}
                        siteId={activeSiteId}
                        onClick={() => setSelectedEvent(eventName)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {columns.length === 0 && (
          <p className="text-sm text-muted-fg py-6">Aucune occurrence détectée pour ce {mode === 'master' ? 'client' : 'site'}.</p>
        )}
      </div>

      {selectedEvent && (
        <EventDetailDrawer
          eventName={selectedEvent}
          clientId={activeClientId}
          mode={mode}
          siteId={activeSiteId}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
