import { create } from 'zustand';
import type { TrackingPlan, TrackingPlanEvent, TrackingPlanParameter } from '../types/trackingPlan.types';

function tryParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

const STORAGE_PREFIX = 'dk_tracking_plan_v1';

// Keyed by clientId — one plan per client (PRD §2), same referential as datalayerStore's clients.
type Persisted = Record<string, TrackingPlan>;

function persist(profileId: string | null, state: Persisted) {
  if (!profileId) return;
  localStorage.setItem(`${STORAGE_PREFIX}_${profileId}`, JSON.stringify(state));
}

interface TrackingPlanState {
  activeProfileId: string | null;
  plans: Persisted;

  loadForProfile: (profileId: string) => void;

  getPlan: (clientId: string) => TrackingPlan | null;
  createPlan: (clientId: string) => void;

  addEvent: (clientId: string, event: Omit<TrackingPlanEvent, 'id' | 'parameters'>) => string;
  updateEvent: (clientId: string, eventId: string, updates: Partial<Omit<TrackingPlanEvent, 'id' | 'parameters'>>) => void;
  removeEvent: (clientId: string, eventId: string) => void;
  removeEvents: (clientId: string, eventIds: string[]) => void;

  addParameter: (clientId: string, eventId: string, param: Omit<TrackingPlanParameter, 'id'>) => void;
  updateParameter: (clientId: string, eventId: string, paramId: string, updates: Partial<Omit<TrackingPlanParameter, 'id'>>) => void;
  removeParameter: (clientId: string, eventId: string, paramId: string) => void;
}

function updatePlan(state: TrackingPlanState, clientId: string, mutate: (plan: TrackingPlan) => TrackingPlan): Persisted {
  const existing = state.plans[clientId];
  if (!existing) return state.plans;
  return { ...state.plans, [clientId]: mutate(existing) };
}

export const useTrackingPlanStore = create<TrackingPlanState>((set, get) => ({
  activeProfileId: null,
  plans: {},

  loadForProfile: (profileId) => {
    const data = tryParse<Persisted>(localStorage.getItem(`${STORAGE_PREFIX}_${profileId}`), {});
    set({ activeProfileId: profileId, plans: data });
  },

  getPlan: (clientId) => get().plans[clientId] ?? null,

  createPlan: (clientId) => {
    if (get().plans[clientId]) return; // already exists — don't overwrite a blank slate over real data
    set((state) => ({ plans: { ...state.plans, [clientId]: { clientId, createdAt: new Date().toISOString(), events: [] } } }));
    persist(get().activeProfileId, get().plans);
  },

  addEvent: (clientId, event) => {
    const id = crypto.randomUUID();
    set((state) => ({
      plans: updatePlan(state, clientId, (plan) => ({ ...plan, events: [...plan.events, { ...event, id, parameters: [] }] })),
    }));
    persist(get().activeProfileId, get().plans);
    return id;
  },

  updateEvent: (clientId, eventId, updates) => {
    set((state) => ({
      plans: updatePlan(state, clientId, (plan) => ({
        ...plan,
        events: plan.events.map((e) => (e.id === eventId ? { ...e, ...updates } : e)),
      })),
    }));
    persist(get().activeProfileId, get().plans);
  },

  removeEvent: (clientId, eventId) => {
    set((state) => ({
      plans: updatePlan(state, clientId, (plan) => ({ ...plan, events: plan.events.filter((e) => e.id !== eventId) })),
    }));
    persist(get().activeProfileId, get().plans);
  },

  removeEvents: (clientId, eventIds) => {
    const idSet = new Set(eventIds);
    set((state) => ({
      plans: updatePlan(state, clientId, (plan) => ({ ...plan, events: plan.events.filter((e) => !idSet.has(e.id)) })),
    }));
    persist(get().activeProfileId, get().plans);
  },

  addParameter: (clientId, eventId, param) => {
    set((state) => ({
      plans: updatePlan(state, clientId, (plan) => ({
        ...plan,
        events: plan.events.map((e) =>
          e.id === eventId ? { ...e, parameters: [...e.parameters, { ...param, id: crypto.randomUUID() }] } : e,
        ),
      })),
    }));
    persist(get().activeProfileId, get().plans);
  },

  updateParameter: (clientId, eventId, paramId, updates) => {
    set((state) => ({
      plans: updatePlan(state, clientId, (plan) => ({
        ...plan,
        events: plan.events.map((e) =>
          e.id === eventId
            ? { ...e, parameters: e.parameters.map((p) => (p.id === paramId ? { ...p, ...updates } : p)) }
            : e,
        ),
      })),
    }));
    persist(get().activeProfileId, get().plans);
  },

  removeParameter: (clientId, eventId, paramId) => {
    set((state) => ({
      plans: updatePlan(state, clientId, (plan) => ({
        ...plan,
        events: plan.events.map((e) =>
          e.id === eventId ? { ...e, parameters: e.parameters.filter((p) => p.id !== paramId) } : e,
        ),
      })),
    }));
    persist(get().activeProfileId, get().plans);
  },
}));
