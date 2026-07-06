// Lightweight event log — persisted to localStorage, max 300 entries (ring buffer).
// Used to capture real usage patterns and errors for iterative improvement.

export type EventType = 'error' | 'action' | 'perf' | 'frustration';

export interface EventEntry {
  id: string;
  type: EventType;
  event: string;
  context?: Record<string, unknown>;
  ts: string; // ISO timestamp
}

const STORAGE_KEY = 'dk_gtm_events';
const MAX_ENTRIES = 300;

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function load(): EventEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EventEntry[]) : [];
  } catch {
    return [];
  }
}

function save(entries: EventEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage quota exceeded — clear and retry
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
}

export function logEvent(
  type: EventType,
  event: string,
  context?: Record<string, unknown>,
): void {
  const entries = load();
  const entry: EventEntry = { id: genId(), type, event, context, ts: new Date().toISOString() };
  // Ring buffer: keep newest MAX_ENTRIES
  const next = [...entries, entry].slice(-MAX_ENTRIES);
  save(next);
}

export function getEvents(): EventEntry[] {
  return load();
}

export function clearEvents(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// Typed helpers for common events

export const logError = (event: string, context?: Record<string, unknown>) =>
  logEvent('error', event, context);

export const logAction = (event: string, context?: Record<string, unknown>) =>
  logEvent('action', event, context);

export const logPerf = (event: string, context?: Record<string, unknown>) =>
  logEvent('perf', event, context);

// Call when the user cancels something mid-flow or retries (signals friction)
export const logFrustration = (event: string, context?: Record<string, unknown>) =>
  logEvent('frustration', event, context);
