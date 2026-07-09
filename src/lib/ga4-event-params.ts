import type { GTMTag } from '../types/gtm';

// A GA4 Event tag's (gaawe) business parameters — currency, value, items, transaction_id,
// coupon, shipping, tax, affiliation, and any custom parameter — are NOT flat tag.parameter
// entries. GTM nests them inside a LIST-type parameter, but the key/sub-key naming differs
// depending on which era of the GA4 Event tag template built the tag — two real conventions
// have been confirmed against actual GTM exports:
//   - "eventParameters"    → list of MAP { name, value }        (newer tag template)
//   - "eventSettingsTable" → list of MAP { parameter, parameterValue }  (older tag template)
// Only a few fixed fields (eventName, measurementIdOverride, and toggles like enhancedUserId)
// are flat. Reading tag.parameter directly for a business param misses it under either
// convention — this flattens all shapes into one lookup so every caller gets the same answer
// regardless of which convention a given container's tags happen to use.
export function flattenGA4EventParams(tag: GTMTag): Record<string, string> {
  const result: Record<string, string> = {};
  for (const p of tag.parameter ?? []) {
    if (p.type === 'list' && p.key === 'eventParameters') {
      for (const item of p.list ?? []) {
        const name = item.map?.find((m) => m.key === 'name')?.value;
        const value = item.map?.find((m) => m.key === 'value')?.value;
        if (name !== undefined && value !== undefined) result[name] = value;
      }
    } else if (p.type === 'list' && p.key === 'eventSettingsTable') {
      for (const item of p.list ?? []) {
        const name = item.map?.find((m) => m.key === 'parameter')?.value;
        const value = item.map?.find((m) => m.key === 'parameterValue')?.value;
        if (name !== undefined && value !== undefined) result[name] = value;
      }
    } else if (p.key && p.value !== undefined) {
      result[p.key] = p.value;
    }
  }
  return result;
}

export function getGA4EventParam(tag: GTMTag, key: string): string | undefined {
  return flattenGA4EventParams(tag)[key];
}
