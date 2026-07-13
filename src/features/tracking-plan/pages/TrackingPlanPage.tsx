import { useEffect, useMemo, useState } from 'react';
import { useDatalayerStore } from '../../datalayer-mapping/stores/datalayerStore';
import { useGTMStore } from '../../../store/gtm-store';
import { useTrackingPlanStore } from '../stores/trackingPlanStore';
import { computeEventChain } from '../../../lib/event-chain';
import { buildDataLayerPushSnippet } from '../utils/generatePush';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { InfoTooltip } from '../../../components/ui/InfoTooltip';
import type {
  TrackingPlanEvent, TrackingPlanParameter, TrackingEventCategory, EventPriority, Platform, ParamType, EventStatus,
} from '../types/trackingPlan.types';

type ViewMode = 'dev' | 'business';

const CATEGORIES: TrackingEventCategory[] = ['ecommerce', 'engagement', 'generation_leads', 'gaming', 'custom'];
const PRIORITIES: EventPriority[] = ['critique', 'important', 'normal', 'optionnel'];
const PLATFORMS: Platform[] = ['GA4', 'Piano', 'Matomo', 'Ads'];
const PARAM_TYPES: ParamType[] = ['string', 'number', 'boolean', 'array', 'object'];

const PRIORITY_COLOR: Record<EventPriority, string> = {
  critique: '#ef4444', important: '#f97316', normal: '#eab308', optionnel: '#9ca3af',
};

const STATUS_META: Record<EventStatus, { label: string; variant: 'default' | 'info' | 'success' }> = {
  planifie: { label: 'Planifié', variant: 'default' },
  implemente: { label: 'Implémenté', variant: 'info' },
  verifie: { label: 'Vérifié', variant: 'success' },
};

function StatusBadge({ status }: { status: EventStatus }) {
  const s = STATUS_META[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

// PRD §5 — status is never stored, always recomputed by crossing the plan with what's
// actually implemented in GTM (Monitoring) and what's really captured in prod (DataLayer
// Mapping's Dictionnaire).
function useEventStatus(clientId: string | null, siteIds: string[]) {
  const monitoringData = useGTMStore((s) => s.monitoringData);
  const getEventCoverage = useDatalayerStore((s) => s.getEventCoverage);
  const chainRows = useMemo(() => computeEventChain(monitoringData), [monitoringData]);

  return (eventName: string): EventStatus => {
    if (!clientId) return 'planifie';
    const coverage = getEventCoverage(clientId, eventName);
    if (coverage.okSites > 0) return 'verifie';
    const row = chainRows.find((r) => r.eventName === eventName);
    if (row && siteIds.some((id) => row.containers[id]?.tagPresent)) return 'implemente';
    return 'planifie';
  };
}

// ─── Event editor drawer — business fields first, parameters below (PRD §6) ────────────

function EventEditorDrawer({
  clientId,
  event,
  onClose,
}: {
  clientId: string;
  event: TrackingPlanEvent | null; // null = creating
  onClose: () => void;
}) {
  const { addEvent, updateEvent, addParameter, updateParameter, removeParameter } = useTrackingPlanStore();
  const [eventName, setEventName] = useState(event?.eventName ?? '');
  const [businessName, setBusinessName] = useState(event?.businessName ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [category, setCategory] = useState<TrackingEventCategory>(event?.category ?? 'ecommerce');
  const [pageOrStep, setPageOrStep] = useState(event?.pageOrStep ?? '');
  const [priority, setPriority] = useState<EventPriority>(event?.priority ?? 'normal');
  const [owner, setOwner] = useState(event?.owner ?? '');
  const [platforms, setPlatforms] = useState<Set<Platform>>(new Set(event?.platforms ?? ['GA4']));

  const [newParamKey, setNewParamKey] = useState('');

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  function save() {
    if (!eventName.trim() || !businessName.trim()) return;
    const fields = {
      eventName: eventName.trim(),
      businessName: businessName.trim(),
      description: description.trim(),
      category,
      pageOrStep: pageOrStep.trim() || undefined,
      priority,
      owner: owner.trim() || undefined,
      platforms: [...platforms],
    };
    if (event) {
      updateEvent(clientId, event.id, fields);
    } else {
      addEvent(clientId, fields);
    }
    onClose();
  }

  function addParam() {
    if (!event || !newParamKey.trim()) return;
    addParameter(clientId, event.id, {
      key: newParamKey.trim(), type: 'string', required: true, exampleValue: '', description: '',
    });
    setNewParamKey('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <div
        className="w-[520px] max-w-full bg-card h-full overflow-y-auto shadow-2xl border-l border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">{event ? 'Modifier l\'event' : 'Nouvel event'}</h2>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Nom métier</label>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Confirmation d'achat"
              className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary" autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Nom technique (dataLayer)</label>
            <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="purchase"
              className="w-full h-9 px-3 text-sm font-mono border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Quoi, pourquoi, à quel moment ça se déclenche"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Catégorie</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as TrackingEventCategory)}
                className="w-full h-9 px-2 text-sm border border-border rounded-lg bg-card text-foreground">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Priorité</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as EventPriority)}
                className="w-full h-9 px-2 text-sm border border-border rounded-lg bg-card text-foreground">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Étape du parcours</label>
              <input value={pageOrStep} onChange={(e) => setPageOrStep(e.target.value)} placeholder="Checkout"
                className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide flex items-center gap-1">
                Data owner
                <InfoTooltip label="?">Le métier responsable de ce besoin de tracking (paid, SEO, merch...) — pas la personne qui l'implémente techniquement.</InfoTooltip>
              </label>
              <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Paid Media"
                className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Plateformes</label>
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer select-none">
                  <input type="checkbox" checked={platforms.has(p)} onChange={() => togglePlatform(p)} className="rounded" />
                  {p}
                </label>
              ))}
            </div>
          </div>

          {event && (
            <div className="pt-3 border-t border-border space-y-2">
              <label className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Paramètres</label>
              {event.parameters.map((param) => (
                <ParamRow
                  key={param.id}
                  param={param}
                  onChange={(updates) => updateParameter(clientId, event.id, param.id, updates)}
                  onRemove={() => removeParameter(clientId, event.id, param.id)}
                />
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  value={newParamKey}
                  onChange={(e) => setNewParamKey(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addParam(); }}
                  placeholder="ecommerce.value"
                  className="flex-1 h-8 px-2 text-xs font-mono border border-border rounded bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button size="sm" variant="secondary" onClick={addParam}>+ Paramètre</Button>
              </div>
              {event.parameters.length === 0 && (
                <p className="text-xs text-muted-fg italic">Aucun paramètre — ajoute au moins la clé dataLayer principale.</p>
              )}
            </div>
          )}
          {!event && (
            <p className="text-xs text-muted-fg italic pt-2 border-t border-border">
              Les paramètres se gèrent une fois l'event créé — enregistre d'abord, puis rouvre-le.
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center gap-2 sticky bottom-0 bg-card">
          <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <div className="flex-1" />
          <Button size="sm" onClick={save} disabled={!eventName.trim() || !businessName.trim()}>Enregistrer</Button>
        </div>
      </div>
    </div>
  );
}

function ParamRow({
  param,
  onChange,
  onRemove,
}: {
  param: TrackingPlanParameter;
  onChange: (updates: Partial<Omit<TrackingPlanParameter, 'id'>>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-border rounded-lg p-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input value={param.key} onChange={(e) => onChange({ key: e.target.value })}
          className="flex-1 h-7 px-2 text-xs font-mono border border-border rounded bg-card text-foreground" />
        <select value={param.type} onChange={(e) => onChange({ type: e.target.value as ParamType })}
          className="h-7 px-1.5 text-xs border border-border rounded bg-card text-foreground">
          {PARAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-1 text-[11px] text-muted-fg shrink-0">
          <input type="checkbox" checked={param.required} onChange={(e) => onChange({ required: e.target.checked })} className="rounded" />
          requis
        </label>
        <button onClick={onRemove} className="text-xs text-destructive hover:opacity-70 px-1">×</button>
      </div>
      <div className="flex items-center gap-1.5">
        <input value={param.exampleValue} onChange={(e) => onChange({ exampleValue: e.target.value })} placeholder="valeur d'exemple"
          className="w-1/3 h-7 px-2 text-xs font-mono border border-border rounded bg-card text-foreground" />
        <input value={param.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="sens métier"
          className="flex-1 h-7 px-2 text-xs border border-border rounded bg-card text-foreground" />
      </div>
    </div>
  );
}

// ─── Detail panel — spec du plan | GTM (Monitoring) | dataLayer réel (Dictionnaire) ────

function EventDetailPanel({
  clientId, siteIds, event, onClose, onEdit,
}: {
  clientId: string;
  siteIds: string[];
  event: TrackingPlanEvent;
  onClose: () => void;
  onEdit: () => void;
}) {
  const monitoringData = useGTMStore((s) => s.monitoringData);
  const getEventCoverage = useDatalayerStore((s) => s.getEventCoverage);
  const chainRows = useMemo(() => computeEventChain(monitoringData), [monitoringData]);
  const chainRow = chainRows.find((r) => r.eventName === event.eventName);
  const coverage = getEventCoverage(clientId, event.eventName);

  const implementedSites = siteIds.filter((id) => chainRow?.containers[id]?.tagPresent);
  const [copied, setCopied] = useState(false);
  const pushSnippet = buildDataLayerPushSnippet(event);

  function copySnippet() {
    navigator.clipboard.writeText(pushSnippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">{event.businessName}</h2>
            <p className="text-xs font-mono text-muted-fg mt-0.5">{event.eventName}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onEdit}>Modifier</Button>
        </div>

        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Plan</p>
            <p className="text-xs text-foreground leading-relaxed">{event.description || 'Pas de description.'}</p>
            <div className="pt-2 space-y-1 text-xs text-muted-fg">
              <p>Priorité : {event.priority}</p>
              {event.owner && <p>Owner : {event.owner}</p>}
              <p>Plateformes : {event.platforms.join(', ') || '—'}</p>
            </div>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Dans GTM (Monitoring)</p>
            {implementedSites.length > 0 ? (
              <p className="text-xs text-success">✓ Implémenté sur {implementedSites.length}/{siteIds.length} container(s)</p>
            ) : (
              <p className="text-xs text-muted-fg">Aucun tag trouvé pour cet event dans les containers scannés.</p>
            )}
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Dans le dataLayer réel</p>
            {coverage.okSites > 0 ? (
              <p className="text-xs text-success">✓ Vérifié sur {coverage.okSites}/{coverage.totalSites || siteIds.length} site(s)</p>
            ) : coverage.totalSites > 0 ? (
              <p className="text-xs text-destructive">Capté mais sous le seuil de complétion sur les {coverage.totalSites} site(s) suivis.</p>
            ) : (
              <p className="text-xs text-muted-fg">Aucune donnée captée pour cet event (DataLayer Mapping).</p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border">
          <p className="text-xs font-semibold text-muted-fg uppercase tracking-wide mb-2">Paramètres ({event.parameters.length})</p>
          {event.parameters.length === 0 ? (
            <p className="text-xs text-muted-fg italic">Aucun paramètre défini.</p>
          ) : (
            <div className="space-y-1">
              {event.parameters.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-foreground">{p.key}</span>
                  <Badge variant="outline">{p.type}</Badge>
                  {p.required && <span className="text-destructive text-[10px]">requis</span>}
                  <span className="text-muted-fg truncate">{p.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Push dataLayer généré</p>
            <Button size="sm" variant="secondary" onClick={copySnippet}>{copied ? 'Copié !' : 'Copier'}</Button>
          </div>
          <pre className="text-[11px] font-mono leading-relaxed p-3 rounded-lg overflow-x-auto" style={{ backgroundColor: 'hsl(220 20% 15%)', color: 'hsl(142 60% 75%)' }}>
            {pushSnippet}
          </pre>
          <p className="text-[11px] text-muted-fg mt-1.5">
            {event.parameters.some((p) => !p.exampleValue.trim())
              ? 'Les valeurs entre {{ }} sont des paramètres sans exemple renseigné — à remplacer par la vraie valeur.'
              : 'Généré à partir des valeurs d\'exemple des paramètres.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────────

export function TrackingPlanPage() {
  const { clients, activeClientId, setActiveClient } = useDatalayerStore();
  const { getPlan, createPlan, removeEvent, removeEvents } = useTrackingPlanStore();

  const [viewMode, setViewMode] = useState<ViewMode>('business');
  // IDs, not object snapshots — the drawer/panel always re-derive the live event from the
  // store below, so an edit made while open (e.g. adding a parameter) shows up immediately
  // instead of being masked by a stale object captured at open time.
  const [editingEventId, setEditingEventId] = useState<string | 'new' | null>(null);
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeClient = clients.find((c) => c.clientId === activeClientId);
  const plan = activeClientId ? getPlan(activeClientId) : null;
  const siteIds = activeClient?.sites.map((s) => s.siteId) ?? [];
  const getStatus = useEventStatus(activeClientId, siteIds);

  function toggleSelected(eventId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId); else next.add(eventId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!plan) return;
    setSelectedIds((prev) => (prev.size === plan.events.length ? new Set() : new Set(plan.events.map((e) => e.id))));
  }

  function deleteSelected() {
    if (!activeClientId || selectedIds.size === 0) return;
    if (!confirm(`Supprimer ${selectedIds.size} event(s) du plan ?`)) return;
    removeEvents(activeClientId, [...selectedIds]);
    setSelectedIds(new Set());
  }

  // Selection is per-client — don't carry it over to a different client's event list.
  useEffect(() => { setSelectedIds(new Set()); }, [activeClientId]);

  function deleteOne(eventId: string) {
    if (!activeClientId) return;
    if (!confirm('Supprimer cet event du plan ?')) return;
    removeEvent(activeClientId, eventId);
    setSelectedIds((prev) => {
      if (!prev.has(eventId)) return prev;
      const next = new Set(prev);
      next.delete(eventId);
      return next;
    });
  }

  const editingEvent = editingEventId && editingEventId !== 'new' ? plan?.events.find((e) => e.id === editingEventId) ?? null : null;
  const detailEvent = detailEventId ? plan?.events.find((e) => e.id === detailEventId) ?? null : null;

  if (!activeClientId) {
    return <p className="text-sm text-muted-fg py-6">Sélectionne un client.</p>;
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">Plan de tracking</h1>
            <InfoTooltip>Source de vérité des events/paramètres attendus, à la place du Gsheet/Excel. Statut calculé automatiquement : Planifié (dans le plan) → Implémenté (trouvé dans GTM via Monitoring) → Vérifié (réellement capté en prod via DataLayer Mapping).</InfoTooltip>
          </div>
          <p className="text-sm text-muted-fg mt-1">{activeClient?.clientName}</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            className="h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground"
            value={activeClientId ?? ''}
            onChange={(e) => setActiveClient(e.target.value || null)}
          >
            {clients.map((c) => <option key={c.clientId} value={c.clientId}>{c.clientName}</option>)}
          </select>

          {plan && (
            <div className="flex items-center rounded-lg overflow-hidden border border-border">
              <button onClick={() => setViewMode('business')}
                className="text-xs font-medium px-3 py-2 transition-colors"
                style={viewMode === 'business' ? { backgroundColor: 'hsl(267 100% 59%)', color: 'white' } : { color: 'hsl(220 13% 40%)' }}>
                Vue Business
              </button>
              <button onClick={() => setViewMode('dev')}
                className="text-xs font-medium px-3 py-2 transition-colors"
                style={viewMode === 'dev' ? { backgroundColor: 'hsl(267 100% 59%)', color: 'white' } : { color: 'hsl(220 13% 40%)' }}>
                Vue Dev
              </button>
            </div>
          )}
        </div>
      </div>

      {!plan ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <p className="text-sm text-muted-fg mb-4">Aucun plan de tracking pour {activeClient?.clientName}.</p>
          <Button onClick={() => { createPlan(activeClientId); }}>Nouveau plan</Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-3">
              {plan.events.length > 0 && (
                <>
                  <button onClick={toggleSelectAll} className="text-xs text-muted-fg hover:text-foreground transition-colors">
                    {selectedIds.size === plan.events.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                  {selectedIds.size > 0 && (
                    <Button size="sm" variant="danger" onClick={deleteSelected}>Supprimer ({selectedIds.size})</Button>
                  )}
                </>
              )}
            </div>
            <Button size="sm" onClick={() => setEditingEventId('new')}>+ Ajouter un event</Button>
          </div>

          {plan.events.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
              <p className="text-sm text-muted-fg">Plan vide — ajoute le premier event.</p>
            </div>
          ) : viewMode === 'dev' ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-fg">
                    <th className="px-3 py-2 w-8">
                      <input type="checkbox" checked={selectedIds.size === plan.events.length} onChange={toggleSelectAll} className="rounded" />
                    </th>
                    <th className="text-left px-3 py-2 font-semibold">Event</th>
                    <th className="text-left px-3 py-2 font-semibold">Paramètres</th>
                    <th className="text-left px-3 py-2 font-semibold">Plateformes</th>
                    <th className="text-left px-3 py-2 font-semibold">Statut</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {plan.events.map((ev) => (
                    <tr key={ev.id} className="border-b border-border last:border-0 hover:bg-muted cursor-pointer" onClick={() => setDetailEventId(ev.id)}>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(ev.id)} onChange={() => toggleSelected(ev.id)} className="rounded" />
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground">{ev.eventName}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {ev.parameters.map((p) => (
                            <span key={p.id} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-fg">
                              {p.key}{p.required ? '' : '?'}: {p.type}
                            </span>
                          ))}
                          {ev.parameters.length === 0 && <span className="text-muted-fg">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-fg">{ev.platforms.join(', ') || '—'}</td>
                      <td className="px-3 py-2"><StatusBadge status={getStatus(ev.eventName)} /></td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={(e) => { e.stopPropagation(); deleteOne(ev.id); }}
                          className="text-destructive hover:opacity-70 text-xs">Supprimer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {plan.events.map((ev) => (
                <div key={ev.id} onClick={() => setDetailEventId(ev.id)}
                  className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:shadow-card transition-shadow space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(ev.id)}
                        onChange={() => toggleSelected(ev.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded shrink-0"
                      />
                      <p className="text-sm font-semibold text-foreground truncate">{ev.businessName}</p>
                    </div>
                    <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: PRIORITY_COLOR[ev.priority] }} title={ev.priority} />
                  </div>
                  <p className="text-xs text-muted-fg line-clamp-2">{ev.description || 'Pas de description.'}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-fg">{ev.owner || 'Owner non défini'}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={getStatus(ev.eventName)} />
                      <button onClick={(e) => { e.stopPropagation(); deleteOne(ev.id); }}
                        className="text-destructive hover:opacity-70 text-xs">Supprimer</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editingEventId !== null && (
        <EventEditorDrawer
          clientId={activeClientId}
          event={editingEventId === 'new' ? null : editingEvent}
          onClose={() => setEditingEventId(null)}
        />
      )}

      {detailEvent && (
        <EventDetailPanel
          clientId={activeClientId}
          siteIds={siteIds}
          event={detailEvent}
          onClose={() => setDetailEventId(null)}
          onEdit={() => { setEditingEventId(detailEvent.id); setDetailEventId(null); }}
        />
      )}
    </div>
  );
}
