import type { GTMTag, GTMTrigger, GTMVariable } from '../types/gtm';

export interface MonitoringContainerData {
  containerId: string;
  containerName: string;
  publicId: string;
  workspaceId: string;
  tags: GTMTag[];
  triggers: GTMTrigger[];
  variables: GTMVariable[];
  scannedAt: string;
}

// ─── Turkish Airlines ──────────────────────────────────────────────────────────
const TK_TAGS: GTMTag[] = [
  { name: 'GA4 — Configuration', type: 'gaawc', parameter: [{ type: 'template', key: 'measurementId', value: 'G-XXXXXXX001' }] },
  { name: 'GA4 — purchase', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 Measurement ID}}' }, { type: 'template', key: 'event_name', value: 'purchase' }] },
  { name: 'GA4 — add_to_cart', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 Measurement ID}}' }, { type: 'template', key: 'event_name', value: 'add_to_cart' }] },
  { name: 'GA4 — view_item', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 Measurement ID}}' }, { type: 'template', key: 'event_name', value: 'view_item' }] },
  { name: 'GA4 — begin_checkout', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 Measurement ID}}' }, { type: 'template', key: 'event_name', value: 'begin_checkout' }] },
  { name: 'Google Ads — Conversion Achat', type: 'awct', parameter: [{ type: 'template', key: 'conversionId', value: 'AW-111111111' }] },
  { name: 'Kameleoon — Init', type: 'html', parameter: [{ type: 'template', key: 'html', value: '<script src="https://js.kameleoon.com/kameleoon.js?siteCode=tk001"></script>' }] },
  { name: 'Meta Pixel — PageView', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- Meta Pixel Code -->\n<script>!function(f,b,e,v){fbq('init','1234567890');};</script>" }] },
];

const TK_TRIGGERS: GTMTrigger[] = [
  { name: 'All Pages', type: 'pageview' },
  { name: 'DOM Ready', type: 'domReady' },
  { name: 'DL - purchase', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'purchase' }] }] },
  { name: 'DL - add_to_cart', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'add_to_cart' }] }] },
  { name: 'DL - view_item', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'view_item' }] }] },
  { name: 'DL - begin_checkout', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'begin_checkout' }] }] },
  { name: 'Click - CTA Réservation', type: 'click', filter: [{ type: 'contains', parameter: [{ type: 'template', key: 'arg0', value: '{{Click Classes}}' }, { type: 'template', key: 'arg1', value: 'btn-book' }] }] },
];

const TK_VARIABLES: GTMVariable[] = [
  { name: 'DLV - ecommerce', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce' }] },
  { name: 'DLV - event', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'event' }] },
  { name: 'Constante - GA4 ID', type: 'c', parameter: [{ type: 'template', key: 'value', value: 'G-XXXXXXX001' }] },
  { name: 'DLV - user_id', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'user_id' }] },
  { name: 'DLV - page_type', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'page_type' }] },
  { name: 'JS - currency', type: 'jsm', parameter: [{ type: 'template', key: 'javascript', value: 'function(){ return document.documentElement.lang === "fr" ? "EUR" : "USD"; }' }] },
  { name: 'URL - full', type: 'u', parameter: [{ type: 'template', key: 'component', value: 'URL' }] },
];

// ─── Air France ────────────────────────────────────────────────────────────────
const AF_TAGS: GTMTag[] = [
  { name: 'GA4 Config', type: 'gaawc', parameter: [{ type: 'template', key: 'measurementId', value: 'G-XXXXXXX002' }] },
  { name: 'GA4 Event — purchase', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'purchase' }] },
  { name: 'GA4 Event — view_item', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'view_item' }] },
  { name: 'GA4 Event — search', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'search' }] },
  { name: 'Ads Remarketing', type: 'awct', parameter: [{ type: 'template', key: 'conversionId', value: 'AW-222222222' }] },
  { name: 'AB Tasty — Script', type: 'html', parameter: [{ type: 'template', key: 'html', value: '<script src="https://try.abtasty.com/af2024.js"></script>' }] },
  { name: 'TikTok Pixel', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- TikTok Pixel -->\n<script>!function (w, d, t) {ttq.load('CTXXXXXXXX');}(window, document, 'script');</script>" }] },
];

const AF_TRIGGERS: GTMTrigger[] = [
  { name: 'All Pages', type: 'pageview' },
  { name: 'DOM Ready - AF', type: 'domReady' },
  { name: 'Custom Event - purchase', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'purchase' }] }] },
  { name: 'Custom Event - view_item', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'view_item' }] }] },
  { name: 'Custom Event - search', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'search' }] }] },
  { name: 'Scroll 50%', type: 'scrollDepth', parameter: [{ type: 'template', key: 'verticalThresholdPercents', value: '50' }] },
];

const AF_VARIABLES: GTMVariable[] = [
  { name: 'DLV - ecommerce', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce' }] },
  { name: 'DLV - event', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'event' }] },
  { name: 'Constante - GA4 ID', type: 'c', parameter: [{ type: 'template', key: 'value', value: 'G-XXXXXXX002' }] },
  { name: 'DLV - page_type', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'page_type' }] },
  { name: 'URL - full', type: 'u', parameter: [{ type: 'template', key: 'component', value: 'URL' }] },
  { name: 'Cookie - session', type: 'k', parameter: [{ type: 'template', key: 'cookieName', value: 'af_session' }] },
];

// ─── Corsair ───────────────────────────────────────────────────────────────────
const COR_TAGS: GTMTag[] = [
  { name: 'GA4 — Configuration Tag', type: 'gaawc', parameter: [{ type: 'template', key: 'measurementId', value: 'G-XXXXXXX003' }] },
  { name: 'GA4 — Purchase Event', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Var - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'purchase' }] },
  { name: 'GA4 — Add to Cart', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Var - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'add_to_cart' }] },
  { name: 'GA4 — View Item List', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Var - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'view_item_list' }] },
  { name: 'GA4 — Search', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Var - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'search' }] },
  { name: 'Kameleoon Script', type: 'html', parameter: [{ type: 'template', key: 'html', value: '<script src="https://js.kameleoon.com/kameleoon.js?siteCode=cor003"></script>' }] },
  { name: 'Hotjar', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- Hotjar -->\n<script>(function(h,o,t,j,a,r){h._hjSettings={hjid:3001234};})(window,document);</script>" }] },
];

const COR_TRIGGERS: GTMTrigger[] = [
  { name: 'All Pages', type: 'pageview' },
  { name: 'DOM Ready', type: 'domReady' },
  { name: 'Window Loaded', type: 'windowLoaded' },
  { name: 'DL - purchase', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'purchase' }] }] },
  { name: 'DL - add_to_cart', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'add_to_cart' }] }] },
  { name: 'DL - view_item_list', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'view_item_list' }] }] },
  { name: 'Link Click - External', type: 'linkClick', filter: [{ type: 'doesNotContain', parameter: [{ type: 'template', key: 'arg0', value: '{{Click URL}}' }, { type: 'template', key: 'arg1', value: 'corsair.fr' }] }] },
  { name: 'Scroll 50%', type: 'scrollDepth', parameter: [{ type: 'template', key: 'verticalThresholdPercents', value: '50' }] },
];

const COR_VARIABLES: GTMVariable[] = [
  { name: 'DLV - ecommerce', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce' }] },
  { name: 'DLV - event', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'event' }] },
  { name: 'Var - GA4 ID', type: 'c', parameter: [{ type: 'template', key: 'value', value: 'G-XXXXXXX003' }] },
  { name: 'DLV - user_id', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'user_id' }] },
  { name: 'JS - currency', type: 'jsm', parameter: [{ type: 'template', key: 'javascript', value: 'function(){ return "EUR"; }' }] },
  { name: 'URL - full', type: 'u', parameter: [{ type: 'template', key: 'component', value: 'URL' }] },
  { name: 'URL - path', type: 'u', parameter: [{ type: 'template', key: 'component', value: 'PATH' }] },
];

// ─── Iberia ────────────────────────────────────────────────────────────────────
const IBE_TAGS: GTMTag[] = [
  { name: 'GA4 Config — Iberia', type: 'gaawc', parameter: [{ type: 'template', key: 'measurementId', value: 'G-XXXXXXX004' }] },
  { name: 'GA4 — purchase', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'purchase' }] },
  { name: 'GA4 — view_item', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'view_item' }] },
  { name: 'GA4 — begin_checkout', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'begin_checkout' }] },
  { name: 'Google Ads Conversion', type: 'awct', parameter: [{ type: 'template', key: 'conversionId', value: 'AW-333333333' }] },
  { name: 'Floodlight — IBE', type: 'flc', parameter: [{ type: 'template', key: 'advertiserId', value: '987654321' }] },
  { name: 'Meta Pixel', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- Meta Pixel -->\n<script>!function(f,b,e,v){fbq('init','9876543210');};</script>" }] },
];

const IBE_TRIGGERS: GTMTrigger[] = [
  { name: 'Pageview - All', type: 'pageview' },
  { name: 'DOM Ready', type: 'domReady' },
  { name: 'Event - purchase', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'purchase' }] }] },
  { name: 'Event - begin_checkout', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'begin_checkout' }] }] },
  { name: 'Event - view_item', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'view_item' }] }] },
  { name: 'Click - Book Button', type: 'click', filter: [{ type: 'contains', parameter: [{ type: 'template', key: 'arg0', value: '{{Click ID}}' }, { type: 'template', key: 'arg1', value: 'book' }] }] },
];

const IBE_VARIABLES: GTMVariable[] = [
  { name: 'DLV - ecommerce', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce' }] },
  { name: 'DLV - event', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'event' }] },
  { name: 'Constante - GA4 ID', type: 'c', parameter: [{ type: 'template', key: 'value', value: 'G-XXXXXXX004' }] },
  { name: 'DLV - page_type', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'page_type' }] },
  { name: 'Cookie - session', type: 'k', parameter: [{ type: 'template', key: 'cookieName', value: 'ibe_session' }] },
  { name: 'URL - full', type: 'u', parameter: [{ type: 'template', key: 'component', value: 'URL' }] },
];

// ─── Swiss ─────────────────────────────────────────────────────────────────────
const SWI_TAGS: GTMTag[] = [
  { name: 'GA4 Configuration', type: 'gaawc', parameter: [{ type: 'template', key: 'measurementId', value: 'G-XXXXXXX005' }] },
  { name: 'GA4 — purchase', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'purchase' }] },
  { name: 'GA4 — add_to_cart', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'add_to_cart' }] },
  { name: 'GA4 — remove_from_cart', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'remove_from_cart' }] },
  { name: 'GA4 — view_item', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'view_item' }] },
  { name: 'GA4 — begin_checkout', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'begin_checkout' }] },
  { name: 'GA4 — search', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'search' }] },
  { name: 'Kameleoon', type: 'html', parameter: [{ type: 'template', key: 'html', value: '<script src="https://js.kameleoon.com/kameleoon.js?siteCode=swi005"></script>' }] },
  { name: 'Google Ads Conversion', type: 'awct', parameter: [{ type: 'template', key: 'conversionId', value: 'AW-444444444' }] },
  { name: 'Hotjar Tracking', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- Hotjar -->\n<script>(function(h,o,t,j,a,r){h._hjSettings={hjid:3005678};})(window,document);</script>" }] },
];

const SWI_TRIGGERS: GTMTrigger[] = [
  { name: 'All Pages', type: 'pageview' },
  { name: 'DOM Ready', type: 'domReady' },
  { name: 'Window Loaded', type: 'windowLoaded' },
  { name: 'DL - purchase', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'purchase' }] }] },
  { name: 'DL - add_to_cart', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'add_to_cart' }] }] },
  { name: 'DL - remove_from_cart', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'remove_from_cart' }] }] },
  { name: 'DL - begin_checkout', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'begin_checkout' }] }] },
  { name: 'DL - view_item', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'view_item' }] }] },
  { name: 'DL - search', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'search' }] }] },
  { name: 'Scroll 50%', type: 'scrollDepth', parameter: [{ type: 'template', key: 'verticalThresholdPercents', value: '50' }] },
  { name: 'Scroll 90%', type: 'scrollDepth', parameter: [{ type: 'template', key: 'verticalThresholdPercents', value: '90' }] },
];

const SWI_VARIABLES: GTMVariable[] = [
  { name: 'DLV - ecommerce', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce' }] },
  { name: 'DLV - event', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'event' }] },
  { name: 'Constante - GA4 ID', type: 'c', parameter: [{ type: 'template', key: 'value', value: 'G-XXXXXXX005' }] },
  { name: 'DLV - user_id', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'user_id' }] },
  { name: 'DLV - page_type', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'page_type' }] },
  { name: 'JS - currency', type: 'jsm', parameter: [{ type: 'template', key: 'javascript', value: 'function(){ return "CHF"; }' }] },
  { name: 'URL - full', type: 'u', parameter: [{ type: 'template', key: 'component', value: 'URL' }] },
  { name: 'URL - path', type: 'u', parameter: [{ type: 'template', key: 'component', value: 'PATH' }] },
  { name: 'Cookie - session', type: 'k', parameter: [{ type: 'template', key: 'cookieName', value: 'swi_session' }] },
];

// ─── Final export ──────────────────────────────────────────────────────────────
export const MONITORING_MOCK: MonitoringContainerData[] = [
  { containerId: '202264563', containerName: 'Turkish Airlines', publicId: 'GTM-MMMTXK6D', workspaceId: '1', scannedAt: '2026-06-26T10:00:00Z', tags: TK_TAGS, triggers: TK_TRIGGERS, variables: TK_VARIABLES },
  { containerId: '202264564', containerName: 'Air France',       publicId: 'GTM-AF2024',   workspaceId: '1', scannedAt: '2026-06-26T10:00:00Z', tags: AF_TAGS, triggers: AF_TRIGGERS, variables: AF_VARIABLES },
  { containerId: '202264565', containerName: 'Corsair',          publicId: 'GTM-COR2024',  workspaceId: '1', scannedAt: '2026-06-26T10:00:00Z', tags: COR_TAGS, triggers: COR_TRIGGERS, variables: COR_VARIABLES },
  { containerId: '202264566', containerName: 'Iberia',           publicId: 'GTM-IBE2024',  workspaceId: '1', scannedAt: '2026-06-26T10:00:00Z', tags: IBE_TAGS, triggers: IBE_TRIGGERS, variables: IBE_VARIABLES },
  { containerId: '202264567', containerName: 'Swiss',            publicId: 'GTM-SWI2024',  workspaceId: '1', scannedAt: '2026-06-26T10:00:00Z', tags: SWI_TAGS, triggers: SWI_TRIGGERS, variables: SWI_VARIABLES },
];
