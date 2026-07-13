import { GA4_CURRENCY_KEY, GA4_NUMERIC_KEYS, ISO_4217_RE } from '../constants/ga4Events';
import type { Anomaly } from '../types/datalayer.types';

// PRD §5.5 — array occurrences are grouped under a wildcard notation so the dictionary doesn't
// explode with one entry per index (ecommerce.items[0].item_name, [1]..., [37]... all collapse
// to ecommerce.items[*].item_name).
export function normalizeVariablePath(path: string): string {
  return path.replace(/\[\d+\]/g, '[*]');
}

// Flattens one dataLayer push into { normalizedPath: value } pairs. Arrays are walked with real
// indices internally (needed to read values) but exposed under the wildcard path (§5.5).
export function flattenPush(push: Record<string, unknown>): Map<string, unknown> {
  const out = new Map<string, unknown>();

  function walk(value: unknown, rawPath: string) {
    if (value === null || value === undefined) {
      out.set(normalizeVariablePath(rawPath), value);
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        out.set(normalizeVariablePath(rawPath), value); // empty array — counted as missing (§5.4)
        return;
      }
      value.forEach((v, i) => walk(v, `${rawPath}[${i}]`));
      return;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        out.set(normalizeVariablePath(rawPath), value); // empty object — counted as missing (§5.4)
        return;
      }
      for (const [k, v] of entries) walk(v, rawPath ? `${rawPath}.${k}` : k);
      return;
    }
    out.set(normalizeVariablePath(rawPath), value);
  }

  for (const [k, v] of Object.entries(push)) walk(v, k);
  return out;
}

// PRD §5.1 — GA4 Type Mismatch + invalid currency, keyed by the flattened variable path's last segment.
export function validateGA4Types(flat: Map<string, unknown>): Anomaly[] {
  const anomalies: Anomaly[] = [];
  for (const [path, value] of flat) {
    const key = path.split('.').pop()?.replace(/\[\*\]$/, '') ?? path;
    if (GA4_NUMERIC_KEYS.includes(key) && typeof value === 'string' && value !== '') {
      anomalies.push({ type: 'ga4_type_mismatch', message: `"${path}" doit être numérique, reçu une chaîne ("${value}")` });
    }
    if (key === GA4_CURRENCY_KEY && typeof value === 'string' && value !== '' && !ISO_4217_RE.test(value)) {
      anomalies.push({ type: 'invalid_currency', message: `"${path}" = "${value}" n'est pas un code devise ISO 4217 valide` });
    }
  }
  return anomalies;
}

// PRD §5.4 — an ecommerce event is only valid if `ecommerce` and `event` are in the same push,
// or `ecommerce` was pushed immediately before without being overwritten by another push in between.
export function validateEcommerceChronology(
  pushes: Record<string, unknown>[],
  index: number,
): Anomaly | null {
  const push = pushes[index];
  const eventName = push.event;
  if (typeof eventName !== 'string') return null;

  const hasEcommerceHere = 'ecommerce' in push;
  if (hasEcommerceHere) return null; // same-push case — valid

  // Look at the immediately preceding push only — "juste avant, non écrasé" per §5.4.
  const prev = pushes[index - 1];
  if (prev && 'ecommerce' in prev && !('event' in prev)) return null; // valid split-push case

  return {
    type: 'async_datalayer_split',
    message: `Event "${eventName}" sans objet "ecommerce" dans le même push ni juste avant`,
  };
}

// PRD §5.4 — a residual `ecommerce` object from a previous page, still present on a later
// non-ecommerce event, is pollution rather than real ecommerce data for that event.
export function detectStaleEcommerceObject(
  push: Record<string, unknown>,
  isEcommerceEvent: boolean,
): Anomaly | null {
  if (isEcommerceEvent) return null;
  if (!('ecommerce' in push)) return null;
  return {
    type: 'stale_datalayer_object',
    message: `Objet "ecommerce" résiduel détecté sur un event non-ecommerce ("${push.event ?? 'sans event'}")`,
  };
}

// Generates a dataLayer template with {{variable}} placeholders, ready to hand to developers.
export function generateTemplate(variables: Record<string, unknown>, eventName: string): string {
  const result: Record<string, unknown> = { event: eventName };

  for (const [varPath, value] of Object.entries(variables)) {
    if (varPath.startsWith('gtm') || varPath === 'event') continue;

    const parts = varPath.replace(/\[\*\]/g, '').split('.').filter(Boolean);
    const lastPart = parts[parts.length - 1];

    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[lastPart] = `{{${lastPart}}}`;
    void value;
  }

  let json = JSON.stringify(result, null, 2);
  json = json.replace(/^\{\n/, '').replace(/\n\}$/, '');
  json = json.replace(/^  /gm, '');
  json = json.replace(/"(\{\{[^}]+\}\})"/g, '$1');
  return json;
}
