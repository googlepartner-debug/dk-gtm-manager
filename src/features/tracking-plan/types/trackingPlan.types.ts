// PRD_TrackingPlan.md §4

export type ParamType = 'string' | 'number' | 'boolean' | 'array' | 'object';
export type TrackingEventCategory = 'ecommerce' | 'engagement' | 'generation_leads' | 'gaming' | 'custom';
export type EventPriority = 'critique' | 'important' | 'normal' | 'optionnel';
export type Platform = 'GA4' | 'Piano' | 'Matomo' | 'Ads';

export interface TrackingPlanParameter {
  id: string;
  key: string;              // dataLayer path, wildcard for arrays (e.g. "ecommerce.items[*].item_name")
  type: ParamType;
  required: boolean;
  exampleValue: string;
  description: string;      // business meaning, one sentence
}

export interface TrackingPlanScreenshot {
  id: string;
  dataUrl: string;   // base64 data URL — resized/compressed client-side before storage (localStorage, no backend)
  caption?: string;
  addedAt: string;
}

export interface TrackingPlanEvent {
  id: string;
  eventName: string;        // technical name, e.g. "purchase"
  businessName: string;     // PM-facing label, e.g. "Confirmation d'achat"
  description: string;      // plain language: what/why, when it fires
  category: TrackingEventCategory;
  pageOrStep?: string;
  priority: EventPriority;
  owner?: string;            // data owner (métier responsable) — free text v1, PRD §5
  platforms: Platform[];
  parameters: TrackingPlanParameter[];
  screenshots: TrackingPlanScreenshot[];
}

export interface TrackingPlan {
  clientId: string;
  createdAt: string;
  events: TrackingPlanEvent[];
}

// Never persisted — always recomputed by cross-referencing Monitoring (configuré) and
// DataLayer Mapping's Dictionnaire (implémenté), PRD §5. "Implémenté" = un vrai
// dataLayer.push() est détecté en prod (le dev a codé le push) — pas juste le tag GTM posé,
// c'est ça qui distingue de "configuré" (2026-07-14, retour utilisateur sur le nommage).
export type EventStatus = 'planifie' | 'configure' | 'implemente';
