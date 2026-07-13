import type {
  DatalayerClient, DatalayerEvent, DatalayerVariable, DictionaryEntry, DatalayerEventOccurrence,
} from '../features/datalayer-mapping/types/datalayer.types';

// Mock dataset (PRD §4.1, Phase A) — lets the UI/analysis be built and demoed before any real
// site is connected. Modeled loosely on the Noviscore audit (real bugs found: hardcoded EUR
// currency, add_shipping_info/add_payment_info missing from the dataLayer, empty Brevo payload).

export const MOCK_CLIENTS: DatalayerClient[] = [
  {
    clientId: 'noviscore',
    clientName: 'Noviscore',
    sites: [
      { siteId: 'GTM-NOVIFR01', siteName: 'noviscore.fr' },
      { siteId: 'GTM-NOVIDE01', siteName: 'noviscore.de' },
      { siteId: 'GTM-NOVIES01', siteName: 'noviscore.es' },
      { siteId: 'GTM-NOVICOM1', siteName: 'noviscore.com' },
    ],
  },
];

export const MOCK_DATALAYER_EVENTS: DatalayerEvent[] = [
  {
    id: 'evt-1', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'purchase',
    category: 'ecommerce', nbVariables: 6, occurrences: 842,
    firstDetection: '2026-06-01T08:00:00.000Z', lastDetection: '2026-07-09T10:00:00.000Z',
    rawExample: '{"event":"purchase","ecommerce":{"transaction_id":"***","value":128.5,"currency":"EUR","items":[{"item_name":"***"}]}}',
    templateToImplement: '{\n  "event": "purchase",\n  "ecommerce": {\n    "transaction_id": {{transaction_id}},\n    "value": {{value}},\n    "currency": {{currency}}\n  }\n}',
    priority: 'critical', status: 'validated',
  },
  {
    id: 'evt-2', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'add_shipping_info',
    category: 'ecommerce', nbVariables: 0, occurrences: 0,
    firstDetection: '2026-04-01T00:00:00.000Z', lastDetection: '2026-04-13T00:00:00.000Z',
    rawExample: '', templateToImplement: '',
    priority: 'critical', status: 'problem',
    notes: "Disparu du dataLayer depuis la mise à jour du 14 avril — régression front, pas un problème GTM.",
  },
  {
    id: 'evt-3', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'add_payment_info',
    category: 'ecommerce', nbVariables: 0, occurrences: 0,
    firstDetection: '2026-04-01T00:00:00.000Z', lastDetection: '2026-04-13T00:00:00.000Z',
    rawExample: '', templateToImplement: '',
    priority: 'critical', status: 'problem',
  },
  {
    id: 'evt-4', clientId: 'noviscore', siteId: 'GTM-NOVICOM1', eventName: 'purchase',
    category: 'ecommerce', nbVariables: 6, occurrences: 305,
    firstDetection: '2026-06-01T08:00:00.000Z', lastDetection: '2026-07-09T10:00:00.000Z',
    rawExample: '{"event":"purchase","ecommerce":{"transaction_id":"***","value":210,"currency":"USD"}}',
    templateToImplement: '{\n  "event": "purchase",\n  "ecommerce": {\n    "value": {{value}},\n    "currency": {{currency}}\n  }\n}',
    priority: 'critical', status: 'problem',
    notes: '3 tags Google Ads (USD/EUR/GBP) se déclenchent tous sans filtre de marché — au moins 2/3 reçoivent la mauvaise devise.',
  },
  {
    id: 'evt-5', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'view_item',
    category: 'ecommerce', nbVariables: 4, occurrences: 5120,
    firstDetection: '2026-05-01T00:00:00.000Z', lastDetection: '2026-07-09T10:00:00.000Z',
    rawExample: '{"event":"view_item","ecommerce":{"items":[{"item_name":"***","item_id":"***"}]}}',
    templateToImplement: '{\n  "event": "view_item"\n}',
    priority: 'important', status: 'validated',
  },
];

export const MOCK_DATALAYER_VARIABLES: DatalayerVariable[] = [
  {
    id: 'var-1', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'purchase',
    variablePath: 'ecommerce.currency', sampleValue: 'EUR', type: 'string',
    allValues: ['EUR'], nbOccurrences: 842, nbCompleted: 842, percentCompleted: 100,
    priority: 'critical', gtmVariableExists: true,
    anomalies: [{ type: 'invalid_currency', message: 'Toujours "EUR" même sur des commandes testées en GBP/USD — valeur codée en dur' }],
  },
  {
    id: 'var-2', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'purchase',
    variablePath: 'ecommerce.value', sampleValue: '128.5', type: 'float',
    allValues: ['128.5', '89.0', '245.99'], nbOccurrences: 842, nbCompleted: 842, percentCompleted: 100,
    priority: 'critical', gtmVariableExists: true, anomalies: [],
  },
  {
    id: 'var-3', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'purchase',
    variablePath: 'ecommerce.items[*].item_name', sampleValue: '***', type: 'string',
    allValues: ['***'], nbOccurrences: 842, nbCompleted: 798, percentCompleted: 94.8,
    priority: 'normal', gtmVariableExists: false, anomalies: [],
  },
  {
    id: 'var-4', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'view_item',
    variablePath: 'car_data.car_brand', sampleValue: '***MARQUE***', type: 'string',
    allValues: ['***MARQUE***'], nbOccurrences: 5120, nbCompleted: 3072, percentCompleted: 60,
    priority: 'important', gtmVariableExists: false,
    anomalies: [],
  },
  {
    id: 'var-5', clientId: 'noviscore', siteId: 'GTM-NOVICOM1', eventName: 'purchase',
    variablePath: 'ecommerce.currency', sampleValue: 'USD', type: 'string',
    allValues: ['USD'], nbOccurrences: 305, nbCompleted: 305, percentCompleted: 100,
    priority: 'critical', gtmVariableExists: true, anomalies: [],
  },
];

// PRD §14.2 — per-occurrence tracking, feeds pageRouter.ts. Covers all 4 cascade priorities:
// semantic flag (pageType), URL regex fallback, a transversal event (>3 distinct columns), and
// one unclassified custom event with neither flag nor matching URL.
export const MOCK_DATALAYER_OCCURRENCES: DatalayerEventOccurrence[] = [
  // Priority 1 — semantic flag
  { id: 'occ-1', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'view_item_list', pageType: 'product_listing', detectedAt: '2026-07-09T09:00:00.000Z', variablesSnapshot: {} },
  { id: 'occ-2', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'view_item', pageType: 'product_detail', detectedAt: '2026-07-09T09:05:00.000Z', variablesSnapshot: { 'car_data.car_brand': '***MARQUE***' } },

  // Priority 2 — URL regex fallback (no pageType)
  { id: 'occ-3', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'view_item', pageLocation: 'https://noviscore.fr/hotel/le-grand-paris', detectedAt: '2026-07-08T18:00:00.000Z', variablesSnapshot: {} },
  { id: 'occ-4', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'search', pageLocation: 'https://noviscore.fr/resultats?dest=paris', detectedAt: '2026-07-09T08:00:00.000Z', variablesSnapshot: {} },
  { id: 'occ-5', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'add_to_cart', pageLocation: 'https://noviscore.fr/panier', detectedAt: '2026-07-09T09:10:00.000Z', variablesSnapshot: {} },
  { id: 'occ-6', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'begin_checkout', pageLocation: 'https://noviscore.fr/reservation', detectedAt: '2026-07-09T09:12:00.000Z', variablesSnapshot: {} },
  // purchase resolves via EVENT_NAME_OVERRIDES regardless of URL
  { id: 'occ-7', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'purchase', pageLocation: 'https://noviscore.fr/confirmation/12345', detectedAt: '2026-07-09T10:00:00.000Z', variablesSnapshot: { 'ecommerce.currency': 'EUR' } },
  { id: 'occ-8', clientId: 'noviscore', siteId: 'GTM-NOVICOM1', eventName: 'purchase', pageLocation: 'https://noviscore.com/success/98765', detectedAt: '2026-07-09T07:00:00.000Z', variablesSnapshot: { 'ecommerce.currency': 'USD' } },

  // Priority 3 — transversal: seen on 4 distinct columns in this same import → Global / All Pages
  { id: 'occ-9', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'click_menu_navigation', pageType: 'product_listing', detectedAt: '2026-07-09T09:01:00.000Z', variablesSnapshot: {} },
  { id: 'occ-10', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'click_menu_navigation', pageType: 'product_detail', detectedAt: '2026-07-09T09:06:00.000Z', variablesSnapshot: {} },
  { id: 'occ-11', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'click_menu_navigation', pageLocation: 'https://noviscore.fr/panier', detectedAt: '2026-07-09T09:11:00.000Z', variablesSnapshot: {} },
  { id: 'occ-12', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'click_menu_navigation', pageLocation: 'https://noviscore.fr/reservation', detectedAt: '2026-07-09T09:13:00.000Z', variablesSnapshot: {} },

  // Priority 4 — bac à sable: no pageType, no matching URL pattern
  { id: 'occ-13', clientId: 'noviscore', siteId: 'GTM-NOVIFR01', eventName: 'widget_interaction', pageLocation: 'https://noviscore.fr/aide/faq', detectedAt: '2026-07-01T12:00:00.000Z', variablesSnapshot: {} },

  // Second site — same product_detail column, divergent variable naming (feeds the future
  // structure comparator, §14.4: "Air France envoie price, Transavia envoie tarif").
  { id: 'occ-14', clientId: 'noviscore', siteId: 'GTM-NOVICOM1', eventName: 'view_item', pageType: 'product_detail', detectedAt: '2026-07-09T07:05:00.000Z', variablesSnapshot: { 'product.price': 210 } },
];

export const MOCK_DICTIONARY: DictionaryEntry[] = [
  {
    id: 'dict-1', clientId: 'noviscore', variablePath: 'car_data.car_brand',
    definition: 'Marque du véhicule sélectionné par le user (ex: Renault, Peugeot)',
    type: 'string', possibleValues: ['Renault', 'Peugeot', 'Citroën'],
  },
  {
    id: 'dict-2', clientId: 'noviscore', variablePath: 'ecommerce.currency',
    definition: 'Devise réelle de la transaction — doit refléter le marché, jamais codée en dur',
    type: 'string', possibleValues: ['EUR', 'USD', 'GBP'],
  },
];
