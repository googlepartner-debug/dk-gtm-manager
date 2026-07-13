import { GA4_EVENTS, SYSTEM_EVENT_PATTERNS } from '../constants/ga4Events';
import type { EventCategory, VariableType } from '../types/datalayer.types';

export function getEventCategory(eventName: string): EventCategory {
  for (const [category, events] of Object.entries(GA4_EVENTS)) {
    if (events.includes(eventName)) return category as EventCategory;
  }
  return 'custom';
}

// PRD §5.6 — events starting with gtm./gtm_, or containing "cookie", are excluded from collection.
export function isSystemEvent(eventName: string): boolean {
  return SYSTEM_EVENT_PATTERNS.some((re) => re.test(eventName));
}

export function detectType(value: unknown): VariableType {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'float';
  if (typeof value === 'string') return value === '' ? 'string (empty)' : 'string';
  return 'string';
}

// PRD §5.2 — 0 and false are valid (completed) values, not missing data.
export function isCompletedValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) return false;
  return true;
}
