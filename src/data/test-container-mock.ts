import type { MonitoringContainerData } from './monitoring-mock';
import type {
  DatalayerClient, DatalayerEvent, DatalayerVariable, DatalayerEventOccurrence,
} from '../features/datalayer-mapping/types/datalayer.types';
import type { TrackingPlan } from '../features/tracking-plan/types/trackingPlan.types';

// Container de test / bac à sable (2026-07-14) — jeu de données synthétique, entièrement
// fictif, sélectionnable en un clic pour peupler DataLayer Mapping + Plan Kanban + Plan de
// tracking d'un coup. Contrairement aux autres mocks (Noviscore, compagnies aériennes) qui
// vivent chacun dans leur silo, celui-ci utilise volontairement le même identifiant comme
// containerId GTM (Monitoring) ET comme siteId DataLayer Mapping, pour que le recoupement
// cross-store produise les 3 statuts du Plan de tracking (Planifié / Implémenté / Vérifié) —
// voir tracking-plan-mock.ts pour le contexte du trou que ça comble.
export const TEST_CONTAINER_ID = 'GTM-TESTDEMO01';
export const TEST_CLIENT_ID = 'test-sandbox';

const TEST_TAGS: MonitoringContainerData['tags'] = [
  { name: 'GA4 — Configuration', type: 'gaawc', firingTriggerId: ['tt01'], parameter: [{ type: 'template', key: 'measurementId', value: '{{Constante - GA4 ID}}' }] },
  {
    name: 'GA4 — purchase', type: 'gaawe', firingTriggerId: ['tt04'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'purchase' },
      { type: 'template', key: 'currency',        value: '{{Constante - Currency}}' },
      { type: 'template', key: 'transaction_id',  value: '{{DLV - ecommerce.transaction_id}}' },
      { type: 'template', key: 'value',           value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
    ],
  },
  {
    name: 'GA4 — view_item', type: 'gaawe', firingTriggerId: ['tt03'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'view_item' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
    ],
  },
  {
    // Implémenté côté GTM mais jamais recoupé côté DataLayer Mapping (pas d'event
    // add_to_cart dans TEST_DATALAYER_EVENTS) — démontre le statut "Implémenté" seul.
    name: 'GA4 — add_to_cart', type: 'gaawe', firingTriggerId: ['tt02'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'add_to_cart' },
      { type: 'template', key: 'value',           value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
    ],
  },
  {
    // Autre cas "Implémenté" : le tag existe et se déclenche, mais l'event n'a jamais été
    // capté en prod (occurrences=0, statut 'problem' côté DataLayer Mapping) — la nuance
    // avec add_to_cart ci-dessus est volontaire (deux causes réelles différentes).
    name: 'GA4 — begin_checkout', type: 'gaawe', firingTriggerId: ['tt05'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'begin_checkout' },
      { type: 'template', key: 'value',           value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
    ],
  },
];

const TEST_TRIGGERS: MonitoringContainerData['triggers'] = [
  { triggerId: 'tt01', name: 'All Pages', type: 'pageview' },
  { triggerId: 'tt02', name: 'DL - add_to_cart', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'add_to_cart' }] }] },
  { triggerId: 'tt03', name: 'DL - view_item', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'view_item' }] }] },
  { triggerId: 'tt04', name: 'DL - purchase', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'purchase' }] }] },
  { triggerId: 'tt05', name: 'DL - begin_checkout', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'begin_checkout' }] }] },
];

const TEST_VARIABLES: MonitoringContainerData['variables'] = [
  { name: 'DLV - ecommerce', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce' }] },
  { name: 'DLV - event', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'event' }] },
  { name: 'Constante - GA4 ID', type: 'c', parameter: [{ type: 'template', key: 'value', value: 'G-TESTDEMO01' }] },
  { name: 'Constante - Currency', type: 'c', parameter: [{ type: 'template', key: 'value', value: 'EUR' }] },
];

export const TEST_MONITORING_CONTAINER: MonitoringContainerData = {
  containerId: TEST_CONTAINER_ID,
  containerName: 'Container de test (démo)',
  publicId: TEST_CONTAINER_ID,
  workspaceId: '1',
  scannedAt: '2026-07-14T09:00:00.000Z',
  tags: TEST_TAGS,
  triggers: TEST_TRIGGERS,
  variables: TEST_VARIABLES,
};

export const TEST_DATALAYER_CLIENT: DatalayerClient = {
  clientId: TEST_CLIENT_ID,
  clientName: 'Container de test (démo)',
  sites: [{ siteId: TEST_CONTAINER_ID, siteName: 'demo.test-sandbox.fr' }],
};

export const TEST_DATALAYER_EVENTS: DatalayerEvent[] = [
  {
    id: 'test-evt-purchase', clientId: TEST_CLIENT_ID, siteId: TEST_CONTAINER_ID, eventName: 'purchase',
    category: 'ecommerce', nbVariables: 3, occurrences: 214,
    firstDetection: '2026-07-01T08:00:00.000Z', lastDetection: '2026-07-14T09:00:00.000Z',
    rawExample: '{"event":"purchase","ecommerce":{"transaction_id":"***","value":64.9,"currency":"EUR"}}',
    templateToImplement: '{\n  "event": "purchase",\n  "ecommerce": {\n    "transaction_id": {{transaction_id}},\n    "value": {{value}},\n    "currency": {{currency}}\n  }\n}',
    priority: 'critical', status: 'validated',
  },
  {
    id: 'test-evt-view-item', clientId: TEST_CLIENT_ID, siteId: TEST_CONTAINER_ID, eventName: 'view_item',
    category: 'ecommerce', nbVariables: 2, occurrences: 1840,
    firstDetection: '2026-07-01T08:00:00.000Z', lastDetection: '2026-07-14T09:00:00.000Z',
    rawExample: '{"event":"view_item","ecommerce":{"items":[{"item_name":"***"}]}}',
    templateToImplement: '{\n  "event": "view_item"\n}',
    priority: 'important', status: 'validated',
  },
  {
    id: 'test-evt-begin-checkout', clientId: TEST_CLIENT_ID, siteId: TEST_CONTAINER_ID, eventName: 'begin_checkout',
    category: 'ecommerce', nbVariables: 0, occurrences: 0,
    firstDetection: '2026-07-01T00:00:00.000Z', lastDetection: '2026-07-01T00:00:00.000Z',
    rawExample: '', templateToImplement: '',
    priority: 'critical', status: 'problem',
    notes: 'Tag GTM en place et déclenché, mais aucune occurrence captée en prod — à investiguer côté front.',
  },
];

export const TEST_DATALAYER_VARIABLES: DatalayerVariable[] = [
  {
    id: 'test-var-purchase-currency', clientId: TEST_CLIENT_ID, siteId: TEST_CONTAINER_ID, eventName: 'purchase',
    variablePath: 'ecommerce.currency', sampleValue: 'EUR', type: 'string',
    allValues: ['EUR'], nbOccurrences: 214, nbCompleted: 214, percentCompleted: 100,
    priority: 'critical', gtmVariableExists: true, anomalies: [],
  },
  {
    id: 'test-var-purchase-value', clientId: TEST_CLIENT_ID, siteId: TEST_CONTAINER_ID, eventName: 'purchase',
    variablePath: 'ecommerce.value', sampleValue: '64.9', type: 'float',
    allValues: ['64.9', '32.5', '99.0'], nbOccurrences: 214, nbCompleted: 214, percentCompleted: 100,
    priority: 'critical', gtmVariableExists: true, anomalies: [],
  },
  {
    id: 'test-var-view-item-name', clientId: TEST_CLIENT_ID, siteId: TEST_CONTAINER_ID, eventName: 'view_item',
    variablePath: 'ecommerce.items[*].item_name', sampleValue: '***', type: 'string',
    allValues: ['***'], nbOccurrences: 1840, nbCompleted: 1840, percentCompleted: 100,
    priority: 'normal', gtmVariableExists: true, anomalies: [],
  },
];

export const TEST_DATALAYER_OCCURRENCES: DatalayerEventOccurrence[] = [
  { id: 'test-occ-1', clientId: TEST_CLIENT_ID, siteId: TEST_CONTAINER_ID, eventName: 'view_item', pageType: 'product_detail', detectedAt: '2026-07-14T08:50:00.000Z', variablesSnapshot: { 'ecommerce.items[*].item_name': '***' } },
  { id: 'test-occ-2', clientId: TEST_CLIENT_ID, siteId: TEST_CONTAINER_ID, eventName: 'purchase', pageType: 'confirmation', detectedAt: '2026-07-14T09:00:00.000Z', variablesSnapshot: { 'ecommerce.currency': 'EUR' } },
  { id: 'test-occ-3', clientId: TEST_CLIENT_ID, siteId: TEST_CONTAINER_ID, eventName: 'view_item_list', pageType: 'product_listing', detectedAt: '2026-07-14T08:40:00.000Z', variablesSnapshot: {} },
];

export const TEST_TRACKING_PLAN: TrackingPlan = {
  clientId: TEST_CLIENT_ID,
  createdAt: '2026-07-14T09:00:00.000Z',
  events: [
    {
      id: 'test-tp-purchase',
      eventName: 'purchase',
      businessName: 'Confirmation d\'achat',
      description: 'Se déclenche à l\'affichage de la page de confirmation de commande.',
      category: 'ecommerce',
      pageOrStep: 'Confirmation',
      priority: 'critique',
      owner: 'Paid Media',
      platforms: ['GA4'],
      parameters: [
        { id: 'p1', key: 'ecommerce.transaction_id', type: 'string', required: true, exampleValue: 'TEST-88214', description: 'Identifiant unique de la commande' },
        { id: 'p2', key: 'ecommerce.value', type: 'number', required: true, exampleValue: '64.90', description: 'Montant total TTC' },
      ],
      screenshots: [],
    },
    {
      id: 'test-tp-view-item',
      eventName: 'view_item',
      businessName: 'Vue produit',
      description: 'Se déclenche à l\'affichage d\'une fiche produit.',
      category: 'ecommerce',
      pageOrStep: 'Fiche produit',
      priority: 'important',
      owner: 'SEO',
      platforms: ['GA4'],
      parameters: [
        { id: 'p1', key: 'ecommerce.items[*].item_name', type: 'string', required: true, exampleValue: '', description: 'Nom du produit' },
      ],
      screenshots: [],
    },
    {
      id: 'test-tp-add-to-cart',
      eventName: 'add_to_cart',
      businessName: 'Ajout panier',
      description: 'Se déclenche au clic sur "Ajouter au panier".',
      category: 'ecommerce',
      pageOrStep: 'Fiche produit',
      priority: 'critique',
      owner: 'Merch',
      platforms: ['GA4'],
      parameters: [
        { id: 'p1', key: 'ecommerce.value', type: 'number', required: true, exampleValue: '', description: 'Valeur ajoutée au panier' },
      ],
      screenshots: [],
    },
    {
      id: 'test-tp-begin-checkout',
      eventName: 'begin_checkout',
      businessName: 'Début du tunnel de paiement',
      description: 'Se déclenche à l\'entrée dans le tunnel de checkout.',
      category: 'ecommerce',
      pageOrStep: 'Checkout',
      priority: 'critique',
      owner: 'Merch',
      platforms: ['GA4'],
      parameters: [],
      screenshots: [],
    },
    {
      id: 'test-tp-view-item-list',
      eventName: 'view_item_list',
      businessName: 'Vue liste produits',
      description: 'Se déclenche à l\'affichage d\'une page de listing produits.',
      category: 'ecommerce',
      pageOrStep: 'Listing',
      priority: 'normal',
      owner: 'SEO',
      platforms: ['GA4'],
      parameters: [],
      screenshots: [],
    },
    {
      id: 'test-tp-sign-up',
      eventName: 'sign_up',
      businessName: 'Création de compte',
      description: 'Se déclenche à la confirmation de création d\'un compte.',
      category: 'engagement',
      pageOrStep: 'Compte',
      priority: 'optionnel',
      owner: 'CRM',
      platforms: ['GA4'],
      parameters: [],
      screenshots: [],
    },
  ],
};
