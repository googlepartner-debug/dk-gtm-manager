export type EventCategory = 'ecommerce' | 'engagement' | 'generation_leads' | 'gaming' | 'custom';

export type Priority = 'critical' | 'important' | 'normal' | 'optional';

export type ValidationStatus = 'pending' | 'validated' | 'problem';

export type VariableType = 'string' | 'string (empty)' | 'integer' | 'float' | 'boolean' | 'array' | 'null';

// PRD §5.1 — GA4 Type Mismatch (value/price/shipping/tax must be numeric, currency must be ISO 4217)
export type AnomalyType =
  | 'ga4_type_mismatch'
  | 'invalid_currency'
  | 'async_datalayer_split'
  | 'stale_datalayer_object';

export interface Anomaly {
  type: AnomalyType;
  message: string;
}

export interface DatalayerEvent {
  id: string;
  clientId: string;
  siteId: string; // = containerId GTM (PRD §3)
  eventName: string;
  category: EventCategory;
  nbVariables: number;
  occurrences: number;
  firstDetection: string; // ISO date
  lastDetection: string;  // ISO date
  rawExample: string;           // anonymized JSON payload sample
  templateToImplement: string;  // JSON block with {{variable}} placeholders, for dev specs
  priority: Priority;
  status: ValidationStatus;
  notes?: string;
}

export interface DatalayerVariable {
  id: string;
  clientId: string;
  siteId: string;
  eventName: string;
  variablePath: string;   // dotted notation, wildcard for arrays (ecommerce.items[*].item_name)
  sampleValue: string;     // anonymized example value
  type: VariableType;
  allValues: string[];     // capped at MAX_UNIQUE_VALUES
  nbOccurrences: number;
  nbCompleted: number;
  percentCompleted: number;
  priority: Priority;
  anomalies: Anomaly[];
  notes?: string;
  // true once a GTM Data Layer Variable exists in the site's container for this path —
  // drives the "[+] Créer dans GTM" affordance (PRD §6)
  gtmVariableExists: boolean;
}

export interface DictionaryEntry {
  id: string;
  clientId: string;
  variablePath: string;
  definition: string;
  type: VariableType;
  possibleValues: string[];
}

export interface SiteDashboard {
  clientId: string;
  siteId: string;
  siteName: string;
  nbEvents: number;
  nbVariables: number;
  totalOccurrences: number;
  lastActivity: string;
  topEvents: { name: string; count: number }[];
  alertsCount: number;
  completionRate: number;
}

export interface Alert {
  id: string;
  clientId: string;
  siteId: string;
  eventName: string;
  variablePath: string;
  percentCompleted: number;
  nbOccurrences: number;
  nbCompleted: number;
  priority: Priority;
  anomalies: Anomaly[];
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

// A client groups several sites (PRD §3) — sites map 1:1 to dk-gtm-manager containerId.
export interface DatalayerClient {
  clientId: string;
  clientName: string;
  sites: { siteId: string; siteName: string }[];
}

// ─── Kanban par page (PRD §14) ──────────────────────────────────────────────────
// One row per real dataLayer.push(), not an aggregate — a given event can land in
// several page columns depending on where it actually fired (PRD §14.2).

export interface DatalayerEventOccurrence {
  id: string;
  clientId: string;
  siteId: string;
  eventName: string;
  pageType?: string;      // explicit semantic flag (page_type/pageCategory), Priority 1 in pageRouter
  pageLocation?: string;  // raw URL, used as regex fallback when pageType is absent
  detectedAt: string;     // ISO
  variablesSnapshot: Record<string, unknown>; // anonymized flattened payload for this exact push
}

export const KANBAN_GLOBAL_COLUMN = 'Global / All Pages';
export const KANBAN_UNCLASSIFIED_COLUMN = 'Unclassified / Custom';

export interface KanbanColumn {
  columnId: string; // page type / column label
  eventNames: string[]; // unique event names routed to this column
}
