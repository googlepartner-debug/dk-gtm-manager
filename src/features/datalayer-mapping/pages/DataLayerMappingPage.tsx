import { useEffect, useState } from 'react';
import { useDatalayerStore } from '../stores/datalayerStore';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { GLOSSARY, ALERT_THRESHOLD } from '../constants/ga4Events';
import { VariableDrillDown } from '../components/VariableDrillDown';
import { InfoTooltip } from '../../../components/ui/InfoTooltip';
import type { Priority, ValidationStatus } from '../types/datalayer.types';

type Tab = 'events' | 'variables' | 'dictionary' | 'alerts';

const PRIORITY_STYLE: Record<Priority, { label: string; color: string }> = {
  critical: { label: 'Critique', color: '#ef4444' },
  important: { label: 'Important', color: '#f97316' },
  normal: { label: 'Normal', color: '#eab308' },
  optional: { label: 'Optionnel', color: '#9ca3af' },
};

const STATUS_STYLE: Record<ValidationStatus, { label: string; variant: 'default' | 'success' | 'error' }> = {
  pending: { label: 'À valider', variant: 'default' },
  validated: { label: 'Validé', variant: 'success' },
  problem: { label: 'Problème', variant: 'error' },
};

function PriorityBadge({ priority }: { priority: Priority }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
      style={{ backgroundColor: s.color }}
    >
      {s.label}
    </span>
  );
}

function StatusBadge({ status }: { status: ValidationStatus }) {
  const s = STATUS_STYLE[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function DataLayerMappingPage() {
  const {
    clients, activeClientId, activeSiteId, setActiveClient, setActiveSite,
    loadMockData, getSiteDashboard, getEventsForSite, getAlerts, dictionary, variables,
  } = useDatalayerStore();

  const [tab, setTab] = useState<Tab>('events');
  const [showGlossary, setShowGlossary] = useState(false);
  const [drillEvent, setDrillEvent] = useState<string | null>(null);

  useEffect(() => {
    if (clients.length === 0) loadMockData();
  }, [clients.length, loadMockData]);

  const activeClient = clients.find((c) => c.clientId === activeClientId);
  const dashboard = activeClientId && activeSiteId ? getSiteDashboard(activeClientId, activeSiteId) : null;
  const siteEvents = activeClientId && activeSiteId ? getEventsForSite(activeClientId, activeSiteId) : [];
  const siteVariables = variables.filter((v) => v.clientId === activeClientId && (!activeSiteId || v.siteId === activeSiteId));
  const alerts = activeClientId ? getAlerts(activeClientId, activeSiteId ?? undefined) : [];

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">DataLayer Mapping</h1>
            <InfoTooltip>Analyse le vrai dataLayer capturé sur le site (pas la config GTM déclarée) — taux de complétion par variable, anomalies de type GA4, et détection des variables sans équivalent GTM à créer d'un clic.</InfoTooltip>
          </div>
          <p className="text-sm text-muted-fg mt-1">Analyse statistique du dataLayer réel — audit continu, pas ponctuel.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowGlossary(true)}>Glossaire</Button>
      </div>

      {/* Client / Site selector */}
      <div className="flex items-center gap-3 mb-5">
        <select
          className="h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground"
          value={activeClientId ?? ''}
          onChange={(e) => setActiveClient(e.target.value || null)}
        >
          {clients.map((c) => <option key={c.clientId} value={c.clientId}>{c.clientName}</option>)}
        </select>
        <select
          className="h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground"
          value={activeSiteId ?? ''}
          onChange={(e) => setActiveSite(e.target.value || null)}
        >
          <option value="">— Tous les sites —</option>
          {activeClient?.sites.map((s) => <option key={s.siteId} value={s.siteId}>{s.siteName}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-5">
        {(['events', 'variables', 'dictionary', 'alerts'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setDrillEvent(null); }}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-fg hover:text-foreground'}`}
          >
            {{ events: 'Events', variables: 'Variables', dictionary: 'Dictionnaire', alerts: `Alertes${alerts.length ? ` (${alerts.length})` : ''}` }[t]}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        drillEvent ? (
          <VariableDrillDown eventName={drillEvent} onBack={() => setDrillEvent(null)} />
        ) : (
          <>
            {dashboard && (
              <div className="grid grid-cols-4 gap-4 mb-5">
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="text-2xl font-extrabold text-foreground">{dashboard.nbEvents}</div>
                  <div className="text-xs text-muted-fg">Events détectés</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="text-2xl font-extrabold text-foreground">{dashboard.nbVariables}</div>
                  <div className="text-xs text-muted-fg">Variables suivies</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="text-2xl font-extrabold" style={{ color: dashboard.completionRate < ALERT_THRESHOLD ? '#f97316' : undefined }}>
                    {dashboard.completionRate}%
                  </div>
                  <div className="text-xs text-muted-fg">Taux de complétion moyen</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="text-2xl font-extrabold text-destructive">{dashboard.alertsCount}</div>
                  <div className="text-xs text-muted-fg">Alertes</div>
                </div>
              </div>
            )}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-fg uppercase tracking-wide border-b border-border">
                  <th className="px-4 py-2.5">Event</th>
                  <th className="px-4 py-2.5">Catégorie</th>
                  <th className="px-4 py-2.5">Occurrences</th>
                  <th className="px-4 py-2.5">Priorité</th>
                  <th className="px-4 py-2.5">Statut</th>
                </tr>
              </thead>
              <tbody>
                {siteEvents.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setDrillEvent(e.eventName)}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs">{e.eventName}</td>
                    <td className="px-4 py-2.5"><Badge variant="info">{e.category}</Badge></td>
                    <td className="px-4 py-2.5">{e.occurrences.toLocaleString()}</td>
                    <td className="px-4 py-2.5"><PriorityBadge priority={e.priority} /></td>
                    <td className="px-4 py-2.5"><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
                {siteEvents.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-fg">Aucun event pour ce site.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          </>
        )
      )}

      {tab === 'alerts' && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className="bg-card border border-warning/30 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground font-mono">{a.variablePath}</div>
                <div className="text-xs text-muted-fg mt-0.5">
                  {a.eventName} — {a.percentCompleted}% complété ({a.nbCompleted}/{a.nbOccurrences})
                  {a.anomalies.map((an, i) => <div key={i} className="text-destructive mt-1">{an.message}</div>)}
                </div>
              </div>
              <PriorityBadge priority={a.priority} />
            </div>
          ))}
          {alerts.length === 0 && <p className="text-sm text-muted-fg py-6">Aucune alerte.</p>}
        </div>
      )}

      {tab === 'dictionary' && (
        <div className="space-y-2">
          {dictionary.filter((d) => d.clientId === activeClientId).map((d) => (
            <div key={d.id} className="bg-card border border-border rounded-lg px-4 py-3">
              <div className="text-sm font-mono text-foreground">{d.variablePath}</div>
              <div className="text-xs text-muted-fg mt-1">{d.definition}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'variables' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-fg uppercase tracking-wide border-b border-border" style={{ backgroundColor: 'hsl(220 20% 97%)' }}>
                <th className="px-4 py-2.5">Variable</th>
                <th className="px-4 py-2.5">Event</th>
                <th className="px-3 py-2.5 w-32">% Complété</th>
                <th className="px-3 py-2.5 w-32">État GTM</th>
              </tr>
            </thead>
            <tbody>
              {siteVariables.map((v) => (
                <tr
                  key={v.id}
                  className="group/row border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => { setDrillEvent(v.eventName); setTab('events'); }}
                >
                  <td className="px-4 py-2.5 font-mono text-xs">{v.variablePath}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-fg">{v.eventName}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: v.percentCompleted < ALERT_THRESHOLD ? '#f97316' : undefined }}>{v.percentCompleted}%</td>
                  <td className="px-3 py-2.5">
                    {v.gtmVariableExists ? (
                      <Badge variant="success">Présente</Badge>
                    ) : (
                      <div
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                        style={{ backgroundColor: 'hsl(0 85% 97%)', color: 'hsl(0 70% 55%)' }}
                        title="Ouvrir le détail de l'event pour créer cette variable dans GTM"
                      >
                        <svg className="group-hover/row:hidden" width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <svg className="hidden group-hover/row:block" width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <span className="group-hover/row:hidden">Absente</span>
                        <span className="hidden group-hover/row:inline">Créer</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {siteVariables.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-fg">Aucune variable.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showGlossary && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowGlossary(false)}>
          <div className="bg-card rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-4">Glossaire</h2>
            <dl className="space-y-3">
              {GLOSSARY.map((g) => (
                <div key={g.term}>
                  <dt className="text-sm font-semibold text-foreground">{g.term}</dt>
                  <dd className="text-xs text-muted-fg">{g.definition}</dd>
                </div>
              ))}
            </dl>
            <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => setShowGlossary(false)}>Fermer</Button>
          </div>
        </div>
      )}
    </div>
  );
}
