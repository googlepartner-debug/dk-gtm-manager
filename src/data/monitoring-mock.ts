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
  { name: 'GA4 — Configuration', type: 'gaawc', firingTriggerId: ['t101'], parameter: [{ type: 'template', key: 'measurementId', value: '{{LT - GA4 Measurement ID}}' }] },
  {
    name: 'GA4 — purchase', type: 'gaawe', firingTriggerId: ['t103'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{GA4 Measurement ID}}' },
      { type: 'template', key: 'event_name',     value: 'purchase' },
      { type: 'template', key: 'currency',        value: '{{Constante - Currency}}' },
      { type: 'template', key: 'transaction_id',  value: '{{DLV - ecommerce.transaction_id}}' },
      { type: 'template', key: 'value',           value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
      { type: 'template', key: 'affiliation',     value: '{{DLV - affiliation}}' },
      { type: 'template', key: 'user_id',         value: '{{DLV - user_id}}' },
    ],
  },
  {
    name: 'GA4 — add_to_cart', type: 'gaawe', firingTriggerId: ['t104'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{GA4 Measurement ID}}' },
      { type: 'template', key: 'event_name',     value: 'add_to_cart' },
      { type: 'template', key: 'currency',        value: '{{Constante - Currency}}' },
      { type: 'template', key: 'value',           value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
      { type: 'template', key: 'user_id',         value: '{{DLV - user_id}}' },
    ],
  },
  {
    name: 'GA4 — view_item', type: 'gaawe', firingTriggerId: ['t105'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{GA4 Measurement ID}}' },
      { type: 'template', key: 'event_name',     value: 'view_item' },
      { type: 'template', key: 'currency',        value: '{{Constante - Currency}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
    ],
  },
  {
    name: 'GA4 — begin_checkout', type: 'gaawe', firingTriggerId: ['t106'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{GA4 Measurement ID}}' },
      { type: 'template', key: 'event_name',     value: 'begin_checkout' },
      { type: 'template', key: 'currency',        value: '{{Constante - Currency}}' },
      { type: 'template', key: 'value',           value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
    ],
  },
  { name: 'Google Ads — Conversion Achat', type: 'awct', parameter: [{ type: 'template', key: 'conversionId', value: 'AW-111111111' }] },
  { name: 'Kameleoon — Init', type: 'html', parameter: [{ type: 'template', key: 'html', value: '<script src="https://js.kameleoon.com/kameleoon.js?siteCode=tk001"></script>' }] },
  { name: 'Meta Pixel — PageView', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- Meta Pixel Code -->\n<script>!function(f,b,e,v){fbq('init','1234567890');};</script>" }] },
];

const TK_TRIGGERS: GTMTrigger[] = [
  { triggerId: 't101', name: 'All Pages', type: 'pageview' },
  { triggerId: 't102', name: 'DOM Ready', type: 'domReady' },
  { triggerId: 't103', name: 'DL - purchase', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'purchase' }] }] },
  { triggerId: 't104', name: 'DL - add_to_cart', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'add_to_cart' }] }] },
  { triggerId: 't105', name: 'DL - view_item', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'view_item' }] }] },
  { triggerId: 't106', name: 'DL - begin_checkout', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'begin_checkout' }] }] },
  { triggerId: 't107', name: 'Click - CTA Réservation', type: 'click', filter: [{ type: 'contains', parameter: [{ type: 'template', key: 'arg0', value: '{{Click Classes}}' }, { type: 'template', key: 'arg1', value: 'btn-book' }] }] },
];

const JS_ITEMS_WITH_COUNTRY = 'function() {\n  var dl = window.dataLayer || [];\n  var ecom = dl.slice().reverse().find(function(d) { return d.ecommerce; });\n  if (!ecom) return [];\n  return (ecom.ecommerce.items || []).map(function(item) {\n    return {\n      item_id:       item.item_id || item.id,\n      item_name:     item.item_name || item.name,\n      item_brand:    item.item_brand    || \'\',\n      item_category: item.item_category || \'\',\n      item_country:  item.item_country  || \'\',\n      price:         parseFloat(item.price)      || 0,\n      quantity:      parseInt(item.quantity, 10) || 1\n    };\n  });\n}';

const TK_VARIABLES: GTMVariable[] = [
  { name: 'DLV - ecommerce', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce' }] },
  { name: 'DLV - event', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'event' }] },
  { name: 'Constante - GA4 ID', type: 'c', parameter: [{ type: 'template', key: 'value', value: 'G-XXXXXXX001' }] },
  {
    name: 'LT - GA4 Measurement ID',
    type: 'smm',
    parameter: [
      { type: 'template', key: 'input', value: '{{URL - hostname}}' },
      {
        type: 'list',
        key: 'map',
        list: [
          { type: 'map', map: [{ type: 'template', key: 'key', value: 'fr.turkishairlines.com' }, { type: 'template', key: 'value', value: 'G-TKFR001' }] },
          { type: 'map', map: [{ type: 'template', key: 'key', value: 'www.turkishairlines.com' }, { type: 'template', key: 'value', value: 'G-TKINT001' }] },
          { type: 'map', map: [{ type: 'template', key: 'key', value: 'de.turkishairlines.com' }, { type: 'template', key: 'value', value: 'G-TKDE001' }] },
        ],
      },
    ],
  },
  { name: 'Constante - Currency', type: 'c', parameter: [{ type: 'template', key: 'value', value: 'EUR' }] },
  { name: 'DLV - user_id', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'user_id' }] },
  { name: 'DLV - page_type', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'page_type' }] },
  { name: 'URL - full', type: 'u', parameter: [{ type: 'template', key: 'component', value: 'URL' }] },
  { name: 'JS - ecommerce.items', type: 'jsm', parameter: [{ type: 'template', key: 'javascript', value: JS_ITEMS_WITH_COUNTRY }] },
  { name: 'JS - page_path_clean', type: 'jsm', parameter: [{ type: 'template', key: 'javascript', value: "function() {\n  return window.location.pathname.replace(/\\/$/, '') || '/';\n}" }] },
];

// ─── Air France ────────────────────────────────────────────────────────────────
const AF_TAGS: GTMTag[] = [
  { name: 'GA4 Config', type: 'gaawc', firingTriggerId: ['t201'], parameter: [{ type: 'template', key: 'measurementId', value: 'G-XXXXXXX002' }] },
  {
    name: 'GA4 Event — purchase', type: 'gaawe', firingTriggerId: ['t203'], parameter: [
      { type: 'template', key: 'measurement_id',  value: '{{GA4 ID}}' },
      { type: 'template', key: 'event_name',      value: 'purchase' },
      { type: 'template', key: 'currency',         value: 'EUR' },             // hardcodé !
      { type: 'template', key: 'transaction_id',   value: '{{DLV - transactionId}}' }, // nom différent
      { type: 'template', key: 'value',            value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',            value: '{{DLV - ecommerce.items}}' },
      // manque : affiliation, user_id
    ],
  },
  {
    name: 'GA4 Event — add_to_cart', type: 'gaawe', firingTriggerId: ['t206'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'add_to_cart' },
      { type: 'template', key: 'currency',        value: 'EUR' },             // hardcodé !
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
      // manque : value, user_id
    ],
  },
  {
    name: 'GA4 Event — view_item', type: 'gaawe', firingTriggerId: ['t204'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'view_item' },
      { type: 'template', key: 'currency',        value: 'EUR' },             // hardcodé !
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
    ],
  },
  {
    name: 'GA4 Event — search', type: 'gaawe', firingTriggerId: ['t205'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'search' },
      { type: 'template', key: 'search_term',    value: '{{DLV - searchTerm}}' },
    ],
  },
  { name: 'Ads Remarketing', type: 'awct', parameter: [{ type: 'template', key: 'conversionId', value: 'AW-222222222' }] },
  { name: 'AB Tasty — Script', type: 'html', parameter: [{ type: 'template', key: 'html', value: '<script src="https://try.abtasty.com/af2024.js"></script>' }] },
  { name: 'TikTok Pixel', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- TikTok Pixel -->\n<script>!function (w, d, t) {ttq.load('CTXXXXXXXX');}(window, document, 'script');</script>" }] },
  // Trace UA — script analytics.js chargé en parallèle pendant migration (oublié)
  { name: 'UA — analytics.js fallback', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<script>\n  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){\n  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),\n  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)\n  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');\n  ga('create', 'UA-222222-1', 'auto');\n  ga('send', 'pageview');\n</script>" }] },
];

const AF_TRIGGERS: GTMTrigger[] = [
  { triggerId: 't201', name: 'All Pages', type: 'pageview' },
  { triggerId: 't202', name: 'DOM Ready - AF', type: 'domReady' },
  { triggerId: 't203', name: 'Custom Event - purchase', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'purchase' }] }] },
  { triggerId: 't204', name: 'Custom Event - view_item', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'view_item' }] }] },
  { triggerId: 't205', name: 'Custom Event - search', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'search' }] }] },
  { triggerId: 't206', name: 'Custom Event - add_to_cart', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'add_to_cart' }] }] },
  { triggerId: 't207', name: 'Scroll 50%', type: 'scrollDepth', parameter: [{ type: 'template', key: 'verticalThresholdPercents', value: '50' }] },
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
  { name: 'GA4 — Configuration Tag', type: 'gaawc', firingTriggerId: ['t301'], parameter: [{ type: 'template', key: 'measurementId', value: 'G-XXXXXXX003' }] },
  {
    name: 'GA4 — Purchase Event', type: 'gaawe', firingTriggerId: ['t304'], parameter: [
      { type: 'template', key: 'measurement_id',  value: '{{Var - GA4 ID}}' },
      { type: 'template', key: 'event_name',      value: 'purchase' },
      { type: 'template', key: 'currency',         value: '{{JS - currency}}' }, // via JS custom
      { type: 'template', key: 'transaction_id',   value: '{{DLV - ecommerce.transaction_id}}' },
      { type: 'template', key: 'value',            value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',            value: '{{DLV - ecommerce.items}}' },
      { type: 'template', key: 'shipping',         value: '{{DLV - ecommerce.shipping}}' },
      // manque : affiliation, user_id
    ],
  },
  {
    name: 'GA4 — Add to Cart', type: 'gaawe', firingTriggerId: ['t305'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{Var - GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'add_to_cart' },
      { type: 'template', key: 'currency',        value: '{{JS - currency}}' }, // via JS custom
      { type: 'template', key: 'value',           value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
      // manque : user_id
    ],
  },
  {
    name: 'GA4 — View Item List', type: 'gaawe', firingTriggerId: ['t306'], parameter: [
      { type: 'template', key: 'measurement_id',  value: '{{Var - GA4 ID}}' },
      { type: 'template', key: 'event_name',      value: 'view_item_list' },
      { type: 'template', key: 'item_list_id',    value: '{{DLV - ecommerce.item_list_id}}' },
      { type: 'template', key: 'item_list_name',  value: '{{DLV - ecommerce.item_list_name}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
    ],
  },
  {
    name: 'GA4 — Search', type: 'gaawe', firingTriggerId: ['t301'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{Var - GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'search' },
      { type: 'template', key: 'search_term',    value: '{{DLV - search_term}}' }, // nom différent d'AF
    ],
  },
  { name: 'Kameleoon Script', type: 'html', parameter: [{ type: 'template', key: 'html', value: '<script src="https://js.kameleoon.com/kameleoon.js?siteCode=cor003"></script>' }] },
  { name: 'Hotjar', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- Hotjar -->\n<script>(function(h,o,t,j,a,r){h._hjSettings={hjid:3001234};})(window,document);</script>" }] },
  {
    name: 'Piano Analytics — Init', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<script>\n  var _cb = _cb || {};\n  _cb.site = 'corsair';\n  _cb.siteId = 647382;\n  pa.setConfigurations({ site: 647382, collectDomain: 'https://logs1412.xiti.com' });\n</script>" }],
  },
];

const COR_TRIGGERS: GTMTrigger[] = [
  { triggerId: 't301', name: 'All Pages', type: 'pageview' },
  { triggerId: 't302', name: 'DOM Ready', type: 'domReady' },
  { triggerId: 't303', name: 'Window Loaded', type: 'windowLoaded' },
  { triggerId: 't304', name: 'DL - purchase', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'purchase' }] }] },
  { triggerId: 't305', name: 'DL - add_to_cart', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'add_to_cart' }] }] },
  { triggerId: 't306', name: 'DL - view_item_list', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'view_item_list' }] }] },
  { triggerId: 't307', name: 'Link Click - External', type: 'linkClick', filter: [{ type: 'doesNotContain', parameter: [{ type: 'template', key: 'arg0', value: '{{Click URL}}' }, { type: 'template', key: 'arg1', value: 'corsair.fr' }] }] },
  { triggerId: 't308', name: 'Scroll 50%', type: 'scrollDepth', parameter: [{ type: 'template', key: 'verticalThresholdPercents', value: '50' }] },
];

const JS_ITEMS_NO_COUNTRY = "function() {\n  var ecom = {{DLV - ecommerce}};\n  if (!ecom || !ecom.items) return [];\n  return ecom.items.map(function(item) {\n    return {\n      item_id:       item.item_id,\n      item_name:     item.item_name,\n      item_brand:    item.item_brand    || '',\n      item_category: item.item_category || '',\n      price:         item.price,\n      quantity:      item.quantity || 1\n    };\n  });\n}";

const COR_VARIABLES: GTMVariable[] = [
  { name: 'DLV - ecommerce', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce' }] },
  { name: 'DLV - event', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'event' }] },
  { name: 'Var - GA4 ID', type: 'c', parameter: [{ type: 'template', key: 'value', value: 'G-XXXXXXX003' }] },
  { name: 'DLV - user_id', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'user_id' }] },
  { name: 'JS - currency', type: 'jsm', parameter: [{ type: 'template', key: 'javascript', value: 'function(){ return "EUR"; }' }] },
  { name: 'JS - ecommerce.items', type: 'jsm', parameter: [{ type: 'template', key: 'javascript', value: JS_ITEMS_NO_COUNTRY }] },
  { name: 'URL - full', type: 'u', parameter: [{ type: 'template', key: 'component', value: 'URL' }] },
  { name: 'URL - path', type: 'u', parameter: [{ type: 'template', key: 'component', value: 'PATH' }] },
];

// ─── Iberia ────────────────────────────────────────────────────────────────────
const IBE_TAGS: GTMTag[] = [
  { name: 'GA4 Config — Iberia', type: 'gaawc', firingTriggerId: ['t401'], parameter: [{ type: 'template', key: 'measurementId', value: 'G-XXXXXXX004' }] },
  {
    name: 'GA4 — purchase', type: 'gaawe', firingTriggerId: ['t403'], parameter: [
      { type: 'template', key: 'measurement_id',  value: '{{GA4 ID}}' },
      { type: 'template', key: 'event_name',      value: 'purchase' },
      { type: 'template', key: 'currency',         value: '{{Constante - Currency}}' },
      { type: 'template', key: 'transaction_id',   value: '{{DLV - ecommerce.transaction_id}}' },
      { type: 'template', key: 'value',            value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',            value: '{{DLV - ecommerce.items}}' },
      { type: 'template', key: 'affiliation',      value: '{{DLV - affiliation}}' },
      // manque : user_id, shipping
    ],
  },
  {
    name: 'GA4 — view_item', type: 'gaawe', firingTriggerId: ['t405'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'view_item' },
      { type: 'template', key: 'currency',        value: '{{Constante - Currency}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
    ],
  },
  {
    name: 'GA4 — begin_checkout', type: 'gaawe', firingTriggerId: ['t404'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'begin_checkout' },
      { type: 'template', key: 'currency',        value: '{{Constante - Currency}}' },
      { type: 'template', key: 'value',           value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
    ],
  },
  { name: 'Google Ads Conversion', type: 'awct', parameter: [{ type: 'template', key: 'conversionId', value: 'AW-333333333' }] },
  { name: 'Floodlight — IBE', type: 'flc', parameter: [{ type: 'template', key: 'advertiserId', value: '987654321' }] },
  { name: 'Meta Pixel', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- Meta Pixel -->\n<script>!function(f,b,e,v){fbq('init','9876543210');};</script>" }] },
  // Trace UA — tag Universal Analytics non supprimé après migration
  { name: 'Universal Analytics — PageView', type: 'ua', parameter: [{ type: 'template', key: 'trackingId', value: 'UA-333333-1' }, { type: 'template', key: 'trackType', value: 'TRACK_PAGEVIEW' }] },
  {
    name: 'Matomo — Tracking', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<script>\n  var _paq = window._paq = window._paq || [];\n  _paq.push(['trackPageView']);\n  _paq.push(['enableLinkTracking']);\n  (function() {\n    var u='https://analytics.iberia.com/';\n    _paq.push(['setTrackerUrl', u+'matomo.php']);\n    _paq.push(['setSiteId', '12']);\n    var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];\n    g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);\n  })();\n</script>" }],
  },
];

const IBE_TRIGGERS: GTMTrigger[] = [
  { triggerId: 't401', name: 'Pageview - All', type: 'pageview' },
  { triggerId: 't402', name: 'DOM Ready', type: 'domReady' },
  { triggerId: 't403', name: 'Event - purchase', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'purchase' }] }] },
  { triggerId: 't404', name: 'Event - begin_checkout', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'begin_checkout' }] }] },
  { triggerId: 't405', name: 'Event - view_item', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'view_item' }] }] },
  { triggerId: 't406', name: 'Click - Book Button', type: 'click', filter: [{ type: 'contains', parameter: [{ type: 'template', key: 'arg0', value: '{{Click ID}}' }, { type: 'template', key: 'arg1', value: 'book' }] }] },
];

const IBE_VARIABLES: GTMVariable[] = [
  { name: 'DLV - ecommerce', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce' }] },
  { name: 'DLV - event', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'event' }] },
  { name: 'Constante - GA4 ID', type: 'c', parameter: [{ type: 'template', key: 'value', value: 'G-XXXXXXX004' }] },
  { name: 'Constante - Currency', type: 'c', parameter: [{ type: 'template', key: 'value', value: 'EUR' }] },
  { name: 'DLV - page_type', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'page_type' }] },
  { name: 'Cookie - session', type: 'k', parameter: [{ type: 'template', key: 'cookieName', value: 'ibe_session' }] },
  { name: 'URL - full', type: 'u', parameter: [{ type: 'template', key: 'component', value: 'URL' }] },
  // Trace UA — cookie _ga référencé dans une variable cookie oubliée
  { name: 'Cookie - _ga', type: 'k', parameter: [{ type: 'template', key: 'cookieName', value: '_ga' }] },
  // Trace UA — variable JS lisant le cookie _gid
  { name: 'JS - UA Client ID', type: 'jsm', parameter: [{ type: 'template', key: 'javascript', value: "function() {\n  // Legacy UA client ID — à supprimer après migration GA4\n  var match = document.cookie.match(/_ga=GA1\\.\\d+\\.(.+)/);\n  return match ? match[1] : null;\n}" }] },
];

// ─── Swiss ─────────────────────────────────────────────────────────────────────
const SWI_TAGS: GTMTag[] = [
  { name: 'GA4 Configuration', type: 'gaawc', firingTriggerId: ['t501'], parameter: [{ type: 'template', key: 'measurementId', value: 'G-XXXXXXX005' }] },
  {
    // BUG intentionnel : purchase se déclenche aussi sur All Pages (t501) — à détecter avec la feature
    name: 'GA4 — purchase', type: 'gaawe', firingTriggerId: ['t504', 't501'], parameter: [
      { type: 'template', key: 'measurement_id',  value: '{{Constante - GA4 ID}}' },
      { type: 'template', key: 'event_name',      value: 'purchase' },
      { type: 'template', key: 'currency',         value: '{{Constante - Currency}}' },
      { type: 'template', key: 'transaction_id',   value: '{{DLV - ecommerce.transaction_id}}' },
      { type: 'template', key: 'value',            value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',            value: '{{DLV - ecommerce.items}}' },
      { type: 'template', key: 'shipping',         value: '{{DLV - ecommerce.shipping}}' },
      { type: 'template', key: 'tax',              value: '{{DLV - ecommerce.tax}}' },
      { type: 'template', key: 'coupon',           value: '{{DLV - ecommerce.coupon}}' },
      { type: 'template', key: 'user_id',          value: '{{DLV - user_id}}' },
    ],
  },
  {
    name: 'GA4 — add_to_cart', type: 'gaawe', firingTriggerId: ['t505'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'add_to_cart' },
      { type: 'template', key: 'currency',        value: '{{Constante - Currency}}' },
      { type: 'template', key: 'value',           value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
      { type: 'template', key: 'user_id',         value: '{{DLV - user_id}}' },
      { type: 'template', key: 'coupon',          value: '{{DLV - ecommerce.coupon}}' },
    ],
  },
  {
    name: 'GA4 — remove_from_cart', type: 'gaawe', firingTriggerId: ['t506'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'remove_from_cart' },
      { type: 'template', key: 'currency',        value: '{{Constante - Currency}}' },
      { type: 'template', key: 'value',           value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
    ],
  },
  {
    name: 'GA4 — view_item', type: 'gaawe', firingTriggerId: ['t508'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'view_item' },
      { type: 'template', key: 'currency',        value: '{{Constante - Currency}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
      { type: 'template', key: 'value',           value: '{{DLV - ecommerce.value}}' },
    ],
  },
  {
    name: 'GA4 — begin_checkout', type: 'gaawe', firingTriggerId: ['t507'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'begin_checkout' },
      { type: 'template', key: 'currency',        value: '{{Constante - Currency}}' },
      { type: 'template', key: 'value',           value: '{{DLV - ecommerce.value}}' },
      { type: 'template', key: 'items',           value: '{{DLV - ecommerce.items}}' },
      { type: 'template', key: 'coupon',          value: '{{DLV - ecommerce.coupon}}' },
    ],
  },
  {
    name: 'GA4 — search', type: 'gaawe', firingTriggerId: ['t509'], parameter: [
      { type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' },
      { type: 'template', key: 'event_name',     value: 'search' },
      { type: 'template', key: 'search_term',    value: '{{DLV - search_term}}' },
    ],
  },
  { name: 'Kameleoon', type: 'html', parameter: [{ type: 'template', key: 'html', value: '<script src="https://js.kameleoon.com/kameleoon.js?siteCode=swi005"></script>' }] },
  { name: 'Google Ads Conversion', type: 'awct', parameter: [{ type: 'template', key: 'conversionId', value: 'AW-444444444' }] },
  { name: 'Hotjar Tracking', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- Hotjar -->\n<script>(function(h,o,t,j,a,r){h._hjSettings={hjid:3005678};})(window,document);</script>" }] },
];

const SWI_TRIGGERS: GTMTrigger[] = [
  { triggerId: 't501', name: 'All Pages', type: 'pageview' },
  { triggerId: 't502', name: 'DOM Ready', type: 'domReady' },
  { triggerId: 't503', name: 'Window Loaded', type: 'windowLoaded' },
  { triggerId: 't504', name: 'DL - purchase', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'purchase' }] }] },
  { triggerId: 't505', name: 'DL - add_to_cart', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'add_to_cart' }] }] },
  { triggerId: 't506', name: 'DL - remove_from_cart', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'remove_from_cart' }] }] },
  { triggerId: 't507', name: 'DL - begin_checkout', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'begin_checkout' }] }] },
  { triggerId: 't508', name: 'DL - view_item', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'view_item' }] }] },
  { triggerId: 't509', name: 'DL - search', type: 'customEvent', customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'search' }] }] },
  { triggerId: 't510', name: 'Scroll 50%', type: 'scrollDepth', parameter: [{ type: 'template', key: 'verticalThresholdPercents', value: '50' }] },
  { triggerId: 't511', name: 'Scroll 90%', type: 'scrollDepth', parameter: [{ type: 'template', key: 'verticalThresholdPercents', value: '90' }] },
];

const SWI_VARIABLES: GTMVariable[] = [
  { name: 'DLV - ecommerce', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce' }] },
  { name: 'DLV - event', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'event' }] },
  { name: 'Constante - GA4 ID', type: 'c', parameter: [{ type: 'template', key: 'value', value: 'G-XXXXXXX005' }] },
  { name: 'Constante - Currency', type: 'c', parameter: [{ type: 'template', key: 'value', value: 'CHF' }] },
  { name: 'DLV - user_id', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'user_id' }] },
  { name: 'DLV - page_type', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'page_type' }] },
  { name: 'URL - full', type: 'u', parameter: [{ type: 'template', key: 'component', value: 'URL' }] },
  { name: 'URL - path', type: 'u', parameter: [{ type: 'template', key: 'component', value: 'PATH' }] },
  { name: 'Cookie - session', type: 'k', parameter: [{ type: 'template', key: 'cookieName', value: 'swi_session' }] },
  // Same JS code as TK — will show green in content comparison
  { name: 'JS - ecommerce.items', type: 'jsm', parameter: [{ type: 'template', key: 'javascript', value: JS_ITEMS_WITH_COUNTRY }] },
  { name: 'JS - page_path_clean', type: 'jsm', parameter: [{ type: 'template', key: 'javascript', value: "function() {\n  return window.location.pathname.replace(/\\/$/, '') || '/';\n}" }] },
];

// ─── Final export ──────────────────────────────────────────────────────────────
export const MONITORING_MOCK: MonitoringContainerData[] = [
  { containerId: '202264563', containerName: 'Turkish Airlines', publicId: 'GTM-MMMTXK6D', workspaceId: '1', scannedAt: '2026-06-26T10:00:00Z', tags: TK_TAGS, triggers: TK_TRIGGERS, variables: TK_VARIABLES },
  { containerId: '202264564', containerName: 'Air France',       publicId: 'GTM-AF2024',   workspaceId: '1', scannedAt: '2026-06-26T10:00:00Z', tags: AF_TAGS, triggers: AF_TRIGGERS, variables: AF_VARIABLES },
  { containerId: '202264565', containerName: 'Corsair',          publicId: 'GTM-COR2024',  workspaceId: '1', scannedAt: '2026-06-26T10:00:00Z', tags: COR_TAGS, triggers: COR_TRIGGERS, variables: COR_VARIABLES },
  { containerId: '202264566', containerName: 'Iberia',           publicId: 'GTM-IBE2024',  workspaceId: '1', scannedAt: '2026-06-26T10:00:00Z', tags: IBE_TAGS, triggers: IBE_TRIGGERS, variables: IBE_VARIABLES },
  { containerId: '202264567', containerName: 'Swiss',            publicId: 'GTM-SWI2024',  workspaceId: '1', scannedAt: '2026-06-26T10:00:00Z', tags: SWI_TAGS, triggers: SWI_TRIGGERS, variables: SWI_VARIABLES },
];
