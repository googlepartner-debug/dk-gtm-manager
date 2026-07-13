import { create } from 'zustand';
import type {
  DatalayerClient, DatalayerEvent, DatalayerVariable, DictionaryEntry, DatalayerEventOccurrence,
  Priority, ValidationStatus, SiteDashboard, Alert, KanbanColumn,
} from '../types/datalayer.types';
import {
  MOCK_CLIENTS, MOCK_DATALAYER_EVENTS, MOCK_DATALAYER_VARIABLES, MOCK_DICTIONARY, MOCK_DATALAYER_OCCURRENCES,
} from '../../../data/datalayer-mock';
import { ALERT_THRESHOLD, MAX_UNIQUE_VALUES, DEFAULT_FUNNEL_STEPS } from '../constants/ga4Events';
import { routeOccurrences } from '../utils/pageRouter';
import { importCollectorExport, type CollectorExportPayload, type ImportSummary } from '../utils/importCollectorExport';

function tryParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

const STORAGE_PREFIX = 'dk_datalayer_mapping_v1';

interface Persisted {
  clients: DatalayerClient[];
  events: DatalayerEvent[];
  variables: DatalayerVariable[];
  dictionary: DictionaryEntry[];
  occurrences: DatalayerEventOccurrence[];
  // PRD §14.6 — Focus Mode funnel steps, editable per client. Absent/missing clientId falls
  // back to DEFAULT_FUNNEL_STEPS (see getFocusEvents) rather than being persisted eagerly.
  focusEvents: Record<string, string[]>;
}

const emptyPersisted: Persisted = { clients: [], events: [], variables: [], dictionary: [], occurrences: [], focusEvents: {} };

interface DatalayerState extends Persisted {
  activeProfileId: string | null;
  activeClientId: string | null;
  activeSiteId: string | null;

  loadForProfile: (profileId: string) => void;
  loadMockData: () => void;

  setActiveClient: (clientId: string | null) => void;
  setActiveSite: (siteId: string | null) => void;

  updateEvent: (id: string, updates: Partial<DatalayerEvent>) => void;
  setEventPriority: (id: string, priority: Priority) => void;
  setEventStatus: (id: string, status: ValidationStatus) => void;

  updateVariable: (id: string, updates: Partial<DatalayerVariable>) => void;
  setVariablePriority: (id: string, priority: Priority) => void;

  addDictionaryEntry: (entry: Omit<DictionaryEntry, 'id'>) => void;
  updateDefinition: (id: string, definition: string) => void;

  purgeClient: (clientId: string) => void;

  // Import a JSON export from the dl-mapping-collector.html tag's __dlMappingExport()
  // (local-storage capture, no Supabase required — see PRD §9.1, 2026-07-13 amendment).
  importOccurrences: (payload: CollectorExportPayload, siteName?: string) => ImportSummary;

  // PRD §14.6 — Focus Mode funnel steps, editable per client.
  getFocusEvents: (clientId: string) => string[];
  setFocusEvents: (clientId: string, events: string[]) => void;

  getSiteDashboard: (clientId: string, siteId: string) => SiteDashboard | null;
  getAlerts: (clientId?: string, siteId?: string) => Alert[];
  getEventsForSite: (clientId: string, siteId: string) => DatalayerEvent[];
  getVariablesForEvent: (clientId: string, siteId: string, eventName: string) => DatalayerVariable[];

  // Kanban par page (PRD §14)
  getKanbanColumnsForSite: (clientId: string, siteId: string) => KanbanColumn[];
  getKanbanColumnsAggregated: (clientId: string) => KanbanColumn[];
  getEventCoverage: (clientId: string, eventName: string) => {
    totalSites: number;
    okSites: number;
    failingSites: { siteId: string; siteName: string }[];
  };

  // PRD §14.4 — "Comparateur de structures" — one row per site showing the real dataLayer keys
  // captured for this event, so a naming divergence (Air France "price" vs Transavia "tarif")
  // is visible in seconds instead of read from code.
  getStructureComparison: (clientId: string, eventName: string) => {
    siteId: string;
    siteName: string;
    keys: string[];
    lastSnapshot: Record<string, unknown> | null;
  }[];
}

function persist(profileId: string | null, state: Persisted) {
  if (!profileId) return;
  localStorage.setItem(`${STORAGE_PREFIX}_${profileId}`, JSON.stringify(state));
}

export const useDatalayerStore = create<DatalayerState>((set, get) => ({
  ...emptyPersisted,
  activeProfileId: null,
  activeClientId: null,
  activeSiteId: null,

  loadForProfile: (profileId) => {
    const data = tryParse<Persisted>(localStorage.getItem(`${STORAGE_PREFIX}_${profileId}`), emptyPersisted);
    set({
      activeProfileId: profileId,
      clients: data.clients,
      events: data.events,
      variables: data.variables,
      dictionary: data.dictionary,
      occurrences: data.occurrences ?? [],
      focusEvents: data.focusEvents ?? {},
    });
  },

  loadMockData: () => {
    set({
      clients: MOCK_CLIENTS,
      events: MOCK_DATALAYER_EVENTS,
      variables: MOCK_DATALAYER_VARIABLES,
      dictionary: MOCK_DICTIONARY,
      occurrences: MOCK_DATALAYER_OCCURRENCES,
      activeClientId: MOCK_CLIENTS[0]?.clientId ?? null,
      activeSiteId: MOCK_CLIENTS[0]?.sites[0]?.siteId ?? null,
    });
    // Without this, App.tsx's own profile-load effect (loadForProfile) can fire after this
    // one and overwrite these in-memory-only clients with the (empty) persisted state —
    // a race that stayed invisible as long as some other action had already persisted
    // real data for the profile, but leaves a brand new profile stuck on an empty client
    // list forever, since nothing re-triggers loadMockData once clients.length > 0.
    persist(get().activeProfileId, { clients: get().clients, events: get().events, variables: get().variables, dictionary: get().dictionary, occurrences: get().occurrences, focusEvents: get().focusEvents });
  },

  setActiveClient: (clientId) => set({ activeClientId: clientId, activeSiteId: null }),
  setActiveSite: (siteId) => set({ activeSiteId: siteId }),

  updateEvent: (id, updates) => {
    set((state) => ({ events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)) }));
    persist(get().activeProfileId, { clients: get().clients, events: get().events, variables: get().variables, dictionary: get().dictionary, occurrences: get().occurrences, focusEvents: get().focusEvents });
  },
  setEventPriority: (id, priority) => get().updateEvent(id, { priority }),
  setEventStatus: (id, status) => get().updateEvent(id, { status }),

  updateVariable: (id, updates) => {
    set((state) => ({
      variables: state.variables.map((v) => {
        if (v.id !== id) return v;
        const next = { ...v, ...updates };
        // PRD §5 — cap unique sample values, no unbounded accumulation in localStorage.
        if (next.allValues.length > MAX_UNIQUE_VALUES) next.allValues = next.allValues.slice(-MAX_UNIQUE_VALUES);
        return next;
      }),
    }));
    persist(get().activeProfileId, { clients: get().clients, events: get().events, variables: get().variables, dictionary: get().dictionary, occurrences: get().occurrences, focusEvents: get().focusEvents });
  },
  setVariablePriority: (id, priority) => get().updateVariable(id, { priority }),

  addDictionaryEntry: (entry) => {
    set((state) => ({ dictionary: [...state.dictionary, { ...entry, id: crypto.randomUUID() }] }));
    persist(get().activeProfileId, { clients: get().clients, events: get().events, variables: get().variables, dictionary: get().dictionary, occurrences: get().occurrences, focusEvents: get().focusEvents });
  },
  updateDefinition: (id, definition) => {
    set((state) => ({ dictionary: state.dictionary.map((d) => (d.id === id ? { ...d, definition } : d)) }));
    persist(get().activeProfileId, { clients: get().clients, events: get().events, variables: get().variables, dictionary: get().dictionary, occurrences: get().occurrences, focusEvents: get().focusEvents });
  },

  purgeClient: (clientId) => {
    set((state) => {
      const { [clientId]: _removed, ...restFocusEvents } = state.focusEvents;
      return {
        clients: state.clients.filter((c) => c.clientId !== clientId),
        events: state.events.filter((e) => e.clientId !== clientId),
        variables: state.variables.filter((v) => v.clientId !== clientId),
        dictionary: state.dictionary.filter((d) => d.clientId !== clientId),
        occurrences: state.occurrences.filter((o) => o.clientId !== clientId),
        focusEvents: restFocusEvents,
      };
    });
    persist(get().activeProfileId, { clients: get().clients, events: get().events, variables: get().variables, dictionary: get().dictionary, occurrences: get().occurrences, focusEvents: get().focusEvents });
  },

  importOccurrences: (payload, siteName) => {
    const result = importCollectorExport(payload, {
      clients: get().clients,
      events: get().events,
      variables: get().variables,
      occurrences: get().occurrences,
    }, siteName);
    set({ clients: result.clients, events: result.events, variables: result.variables, occurrences: result.occurrences });
    persist(get().activeProfileId, { clients: get().clients, events: get().events, variables: get().variables, dictionary: get().dictionary, occurrences: get().occurrences, focusEvents: get().focusEvents });
    return result.summary;
  },

  getFocusEvents: (clientId) => get().focusEvents[clientId] ?? DEFAULT_FUNNEL_STEPS,
  setFocusEvents: (clientId, events) => {
    set((state) => ({ focusEvents: { ...state.focusEvents, [clientId]: events } }));
    persist(get().activeProfileId, { clients: get().clients, events: get().events, variables: get().variables, dictionary: get().dictionary, occurrences: get().occurrences, focusEvents: get().focusEvents });
  },

  getSiteDashboard: (clientId, siteId) => {
    const { clients, events, variables } = get();
    const client = clients.find((c) => c.clientId === clientId);
    const site = client?.sites.find((s) => s.siteId === siteId);
    if (!client || !site) return null;

    const siteEvents = events.filter((e) => e.clientId === clientId && e.siteId === siteId);
    const siteVariables = variables.filter((v) => v.clientId === clientId && v.siteId === siteId);
    const alerts = get().getAlerts(clientId, siteId);
    const totalOccurrences = siteEvents.reduce((sum, e) => sum + e.occurrences, 0);
    const avgCompletion = siteVariables.length
      ? siteVariables.reduce((sum, v) => sum + v.percentCompleted, 0) / siteVariables.length
      : 100;
    const lastActivity = siteEvents.reduce((max, e) => (e.lastDetection > max ? e.lastDetection : max), '');

    return {
      clientId, siteId, siteName: site.siteName,
      nbEvents: siteEvents.length,
      nbVariables: siteVariables.length,
      totalOccurrences,
      lastActivity,
      topEvents: [...siteEvents].sort((a, b) => b.occurrences - a.occurrences).slice(0, 5).map((e) => ({ name: e.eventName, count: e.occurrences })),
      alertsCount: alerts.length,
      completionRate: Math.round(avgCompletion * 10) / 10,
    };
  },

  getAlerts: (clientId, siteId) => {
    const { variables } = get();
    return variables
      .filter((v) => (!clientId || v.clientId === clientId) && (!siteId || v.siteId === siteId))
      .filter((v) => v.percentCompleted < ALERT_THRESHOLD || v.anomalies.length > 0)
      .map((v) => ({
        id: v.id, clientId: v.clientId, siteId: v.siteId, eventName: v.eventName,
        variablePath: v.variablePath, percentCompleted: v.percentCompleted,
        nbOccurrences: v.nbOccurrences, nbCompleted: v.nbCompleted,
        priority: v.priority, anomalies: v.anomalies,
      }));
  },

  getEventsForSite: (clientId, siteId) => get().events.filter((e) => e.clientId === clientId && e.siteId === siteId),

  getVariablesForEvent: (clientId, siteId, eventName) =>
    get().variables.filter((v) => v.clientId === clientId && v.siteId === siteId && v.eventName === eventName),

  getKanbanColumnsForSite: (clientId, siteId) =>
    routeOccurrences(get().occurrences.filter((o) => o.clientId === clientId && o.siteId === siteId)),

  // Vue Master (PRD §14.4) — routes every site's occurrences together so an event's column
  // reflects the client's theoretical tracking plan, not just one site's.
  getKanbanColumnsAggregated: (clientId) =>
    routeOccurrences(get().occurrences.filter((o) => o.clientId === clientId)),

  // "OK" = the event exists for that site with real occurrences and isn't flagged 'problem' —
  // drives the Vue Master badges ("✅ validé sur 18 containers" / "🔴 échoue chez 3 partenaires").
  getEventCoverage: (clientId, eventName) => {
    const { clients, events } = get();
    const client = clients.find((c) => c.clientId === clientId);
    const sites = client?.sites ?? [];
    const failingSites: { siteId: string; siteName: string }[] = [];
    let okSites = 0;

    for (const site of sites) {
      const evt = events.find((e) => e.clientId === clientId && e.siteId === site.siteId && e.eventName === eventName);
      const ok = !!evt && evt.occurrences > 0 && evt.status !== 'problem';
      if (ok) okSites++;
      else failingSites.push({ siteId: site.siteId, siteName: site.siteName });
    }

    return { totalSites: sites.length, okSites, failingSites };
  },

  getStructureComparison: (clientId, eventName) => {
    const { clients, occurrences } = get();
    const client = clients.find((c) => c.clientId === clientId);
    const sites = client?.sites ?? [];

    return sites.map((site) => {
      const matches = occurrences.filter(
        (o) => o.clientId === clientId && o.siteId === site.siteId && o.eventName === eventName,
      );
      const last = matches.length > 0
        ? matches.reduce((mostRecent, o) => (o.detectedAt > mostRecent.detectedAt ? o : mostRecent))
        : null;
      return {
        siteId: site.siteId,
        siteName: site.siteName,
        keys: last ? Object.keys(last.variablesSnapshot) : [],
        lastSnapshot: last?.variablesSnapshot ?? null,
      };
    });
  },
}));
