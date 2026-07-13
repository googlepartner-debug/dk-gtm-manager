import type { DatalayerEventOccurrence, KanbanColumn } from '../types/datalayer.types';
import { KANBAN_GLOBAL_COLUMN, KANBAN_UNCLASSIFIED_COLUMN } from '../types/datalayer.types';

// PRD §14.3 — cascade de classification, dans l'ordre de priorité :
// 1. Flag sémantique explicite (page_type/pageCategory) — le plus fiable, utilisé tel quel.
// 2. Regex sur l'URL (page_location) — fallback si aucun flag n'est présent.
// 3. Transversal — un event vu sur plus de 3 pages différentes lors d'un import est extrait
//    vers "Global / All Pages" plutôt que dupliqué dans chaque colonne.
// 4. Bac à sable — rien ne matche → "Unclassified / Custom", réassignable à la main.

const URL_PATTERNS: { pattern: RegExp; column: string }[] = [
  { pattern: /\/(search|resultats|résultats)/i, column: 'Search Results' },
  { pattern: /\/(hotel|vol)\//i, column: 'Product Page' },
  { pattern: /\/(panier|cart)/i, column: 'Cart' },
  { pattern: /\/(checkout|paiement|reservation|réservation)/i, column: 'Checkout' },
  { pattern: /\/(confirmation|merci|success)/i, column: 'Confirmation Page' },
];

// Event names that always resolve to a fixed column regardless of URL — checked after
// pageType/regex, before falling back to transversal/unclassified.
const EVENT_NAME_OVERRIDES: Record<string, string> = {
  purchase: 'Confirmation Page',
};

const TRANSVERSAL_THRESHOLD = 3;

function classifyOccurrence(occ: DatalayerEventOccurrence): string | null {
  // Priority 1 — semantic flag
  if (occ.pageType) return occ.pageType;

  // Priority 2 — event name override, then URL regex
  if (EVENT_NAME_OVERRIDES[occ.eventName]) return EVENT_NAME_OVERRIDES[occ.eventName];
  if (occ.pageLocation) {
    for (const { pattern, column } of URL_PATTERNS) {
      if (pattern.test(occ.pageLocation)) return column;
    }
  }

  return null; // unresolved at this stage — routeOccurrences handles transversal/bac à sable
}

// Routes a batch of occurrences (typically one import/scan) into Kanban columns.
export function routeOccurrences(occurrences: DatalayerEventOccurrence[]): KanbanColumn[] {
  const columns = new Map<string, Set<string>>();
  const eventColumnsSeen = new Map<string, Set<string>>(); // eventName -> distinct columns it landed in

  const unresolved: DatalayerEventOccurrence[] = [];

  for (const occ of occurrences) {
    const column = classifyOccurrence(occ);
    if (!column) {
      unresolved.push(occ);
      continue;
    }
    if (!columns.has(column)) columns.set(column, new Set());
    columns.get(column)!.add(occ.eventName);

    if (!eventColumnsSeen.has(occ.eventName)) eventColumnsSeen.set(occ.eventName, new Set());
    eventColumnsSeen.get(occ.eventName)!.add(column);
  }

  // Priority 3 — transversal: an event routed to more than TRANSVERSAL_THRESHOLD distinct
  // columns is pulled out of all of them and consolidated into the Global column instead.
  const transversalEvents = new Set(
    [...eventColumnsSeen.entries()].filter(([, cols]) => cols.size > TRANSVERSAL_THRESHOLD).map(([name]) => name),
  );
  if (transversalEvents.size > 0) {
    for (const [, names] of columns) {
      for (const name of transversalEvents) names.delete(name);
    }
    if (!columns.has(KANBAN_GLOBAL_COLUMN)) columns.set(KANBAN_GLOBAL_COLUMN, new Set());
    for (const name of transversalEvents) columns.get(KANBAN_GLOBAL_COLUMN)!.add(name);
  }

  // Priority 4 — sandbox for anything that never resolved to a column at all.
  if (unresolved.length > 0) {
    if (!columns.has(KANBAN_UNCLASSIFIED_COLUMN)) columns.set(KANBAN_UNCLASSIFIED_COLUMN, new Set());
    for (const occ of unresolved) columns.get(KANBAN_UNCLASSIFIED_COLUMN)!.add(occ.eventName);
  }

  // Global column first, Unclassified last, everything else in between.
  const entries = [...columns.entries()];
  entries.sort((a, b) => {
    if (a[0] === KANBAN_GLOBAL_COLUMN) return -1;
    if (b[0] === KANBAN_GLOBAL_COLUMN) return 1;
    if (a[0] === KANBAN_UNCLASSIFIED_COLUMN) return 1;
    if (b[0] === KANBAN_UNCLASSIFIED_COLUMN) return -1;
    return a[0].localeCompare(b[0]);
  });

  return entries.map(([columnId, names]) => ({ columnId, eventNames: [...names] }));
}
