import type { DeploymentPackage } from '../types/gtm';

// Source annotée : src/features/datalayer-mapping/gtm-tag/dl-mapping-collector.html (mêmes
// fonctions, juste le gros commentaire d'en-tête raccourci ici). Deux destinations
// (2026-07-13) : POST vers {{DL Mapping - Sheets Endpoint}} si renseigné (voir
// dl-mapping-sheets-endpoint.gs.js — script Apps Script à déployer manuellement), sinon
// mode 100% local (localStorage + export manuel via __dlMappingExport()/__dlMappingClear()
// en console, à utiliser en Preview GTM). Tant que l'endpoint n'est pas configuré, ne pas
// publier ce tag sur du trafic réel — chaque visiteur accumulerait dans SON navigateur,
// inaccessible pour toi.
const DL_MAPPING_COLLECTOR_SCRIPT = `<script>
(function () {
  if (window.__dlMappingActive__) return;
  window.__dlMappingActive__ = true;

  var CLIENT_ID = '{{DL Mapping - Client ID}}';
  var SITE_ID = '{{Container ID}}';
  var ENDPOINT_URL = '{{DL Mapping - Sheets Endpoint}}';
  var STORAGE_KEY = 'dl_mapping_buffer_' + CLIENT_ID + '_' + SITE_ID;

  var SYSTEM_EVENT_PATTERNS = [/^gtm\\./i, /^gtm_/i, /cookie/i];
  var GA4_NUMERIC_KEYS = ['value', 'price', 'shipping', 'tax'];
  var GA4_CURRENCY_KEY = 'currency';
  var ISO_4217_RE = /^[A-Z]{3}$/;
  var SENSITIVE_KEYWORDS = {
    email: ['email', 'mail', 'courriel', 'e-mail'],
    phone: ['phone', 'tel', 'mobile', 'portable', 'telephone', 'gsm'],
    firstname: ['firstname', 'prenom', 'first_name'],
    lastname: ['lastname', 'nom', 'last_name', 'surname', 'family_name'],
    userid: ['user_id', 'userid', 'customer_id'],
  };

  function isSystemEvent(eventName) {
    for (var i = 0; i < SYSTEM_EVENT_PATTERNS.length; i++) {
      if (SYSTEM_EVENT_PATTERNS[i].test(eventName)) return true;
    }
    return false;
  }

  function normalizePath(path) {
    return path.replace(/\\[\\d+\\]/g, '[*]');
  }

  function anonymizeValue(path, value) {
    if (typeof value !== 'string' || value === '') return value;
    var lowerPath = path.toLowerCase();

    for (var type in SENSITIVE_KEYWORDS) {
      var keywords = SENSITIVE_KEYWORDS[type];
      for (var i = 0; i < keywords.length; i++) {
        if (lowerPath.indexOf(keywords[i]) !== -1) return anonymizeByType(type, value);
      }
    }

    if (/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) return '***@***.***';

    var phoneMatch = value.match(/^(\\+\\d{2,3}|0\\d)[\\d\\s.-]+$/);
    if (phoneMatch && value.replace(/[\\s.-]/g, '').length >= 10) {
      var prefix = value.match(/^(\\+\\d{2,3}|0\\d)/);
      if (prefix) return prefix[0] + '********';
    }

    return value;
  }

  function anonymizeByType(type, value) {
    switch (type) {
      case 'email': return '***@***.***';
      case 'phone':
        var prefix = value.match(/^(\\+\\d{2,3}|0\\d)/);
        return prefix ? prefix[0] + '********' : '**********';
      case 'firstname': return '***PRENOM***';
      case 'lastname': return '***NOM***';
      case 'userid': return '***UID***';
      default: return '***';
    }
  }

  function checkGA4Anomalies(key, value) {
    var anomalies = [];
    var lastPart = key.split('.').pop().replace(/\\[\\*\\]$/, '');
    if (GA4_NUMERIC_KEYS.indexOf(lastPart) !== -1 && typeof value === 'string' && value !== '') {
      anomalies.push('ga4_type_mismatch');
    }
    if (lastPart === GA4_CURRENCY_KEY && typeof value === 'string' && value !== '' && !ISO_4217_RE.test(value)) {
      anomalies.push('invalid_currency');
    }
    return anomalies;
  }

  function flattenAndAnonymize(obj, prefix) {
    var out = {};
    function walk(value, rawPath) {
      if (value === null || typeof value === 'undefined') {
        out[normalizePath(rawPath)] = value;
        return;
      }
      if (Object.prototype.toString.call(value) === '[object Array]') {
        if (value.length === 0) { out[normalizePath(rawPath)] = value; return; }
        for (var i = 0; i < value.length; i++) walk(value[i], rawPath + '[' + i + ']');
        return;
      }
      if (typeof value === 'object') {
        var keys = [];
        for (var k in value) if (Object.prototype.hasOwnProperty.call(value, k)) keys.push(k);
        if (keys.length === 0) { out[normalizePath(rawPath)] = value; return; }
        for (var j = 0; j < keys.length; j++) {
          walk(value[keys[j]], rawPath ? rawPath + '.' + keys[j] : keys[j]);
        }
        return;
      }
      var anonymized = anonymizeValue(rawPath, value);
      out[normalizePath(rawPath)] = anonymized;
    }
    for (var topKey in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, topKey) && topKey !== 'event') {
        walk(obj[topKey], prefix ? prefix + '.' + topKey : topKey);
      }
    }
    return out;
  }

  var buffer = [];
  var FLUSH_INTERVAL_MS = 5000;
  var MAX_BUFFER_SIZE = 20;
  var MAX_STORED_OCCURRENCES = 5000;

  function readStored() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function endpointConfigured() {
    return ENDPOINT_URL && ENDPOINT_URL.length > 0 && ENDPOINT_URL.charAt(0) !== '{';
  }

  function flush(useBeacon) {
    if (buffer.length === 0) return;
    var toSend = buffer;
    buffer = [];

    try {
      var stored = readStored().concat(toSend);
      if (stored.length > MAX_STORED_OCCURRENCES) stored = stored.slice(stored.length - MAX_STORED_OCCURRENCES);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch (e) { /* best-effort — localStorage full or unavailable, never block the page */ }

    if (!endpointConfigured()) return;

    var payload = JSON.stringify({ clientId: CLIENT_ID, siteId: SITE_ID, occurrences: toSend });
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT_URL, new Blob([payload], { type: 'text/plain;charset=utf-8' }));
      return;
    }
    try {
      fetch(ENDPOINT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: payload, keepalive: true, mode: 'no-cors' });
    } catch (e) { /* best-effort — never block the page on a monitoring failure */ }
  }

  setInterval(function () { flush(false); }, FLUSH_INTERVAL_MS);
  window.addEventListener('pagehide', function () { flush(true); });

  window.__dlMappingExport = function () {
    flush();
    var occurrences = readStored();
    var payload = JSON.stringify({ clientId: CLIENT_ID, siteId: SITE_ID, occurrences: occurrences }, null, 2);
    var blob = new Blob([payload], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'dl-mapping-' + CLIENT_ID + '-' + SITE_ID + '-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('[DL Mapping] Export : ' + occurrences.length + ' occurrence(s) — fichier téléchargé. Importe-le dans DK GTM Manager (page DataLayer Mapping).');
  };

  window.__dlMappingClear = function () {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    buffer = [];
    console.log('[DL Mapping] Buffer local vidé.');
  };

  function processPush(pushObj) {
    if (!pushObj || typeof pushObj !== 'object') return;
    var eventName = pushObj.event;
    if (typeof eventName !== 'string' || isSystemEvent(eventName)) return;

    var flat = flattenAndAnonymize(pushObj, '');
    var anomalySet = {};
    for (var path in flat) {
      var found = checkGA4Anomalies(path, flat[path]);
      for (var i = 0; i < found.length; i++) anomalySet[found[i]] = true;
    }

    buffer.push({
      eventName: eventName,
      pageType: pushObj.page_type || pushObj.pageCategory || undefined,
      pageLocation: window.location.href,
      detectedAt: new Date().toISOString(),
      variablesSnapshot: flat,
      anomalies: Object.keys(anomalySet),
    });

    if (buffer.length >= MAX_BUFFER_SIZE) flush(false);
  }

  var dataLayer = window.dataLayer = window.dataLayer || [];
  var originalPush = dataLayer.push;
  dataLayer.push = function () {
    for (var i = 0; i < arguments.length; i++) {
      try { processPush(arguments[i]); } catch (e) { /* never break the site over a monitoring bug */ }
    }
    return originalPush.apply(dataLayer, arguments);
  };

  for (var existing = 0; existing < dataLayer.length; existing++) {
    try { processPush(dataLayer[existing]); } catch (e) { /* ignore */ }
  }
})();
</script>`;

export const PACKAGE_TEMPLATES: { id: string; name: string; description: string; category: string; template: Omit<DeploymentPackage, 'id' | 'createdAt'> }[] = [
  {
    id: 'ga4-ecommerce-standard',
    name: 'GA4 Ecommerce Standard',
    description: 'Tags GA4 pour les 5 events ecommerce essentiels (purchase, add_to_cart, view_item, begin_checkout, view_item_list) avec variables Data Layer et déclencheurs customEvent.',
    category: 'GA4',
    template: {
      name: 'GA4 Ecommerce Standard',
      description: 'Template DK — événements ecommerce GA4 standards',
      client: '',
      entities: {
        triggers: [
          {
            name: 'DL - purchase',
            type: 'customEvent',
            customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'purchase' }] }],
          },
          {
            name: 'DL - add_to_cart',
            type: 'customEvent',
            customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'add_to_cart' }] }],
          },
          {
            name: 'DL - view_item',
            type: 'customEvent',
            customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'view_item' }] }],
          },
          {
            name: 'DL - begin_checkout',
            type: 'customEvent',
            customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'begin_checkout' }] }],
          },
          {
            name: 'DL - view_item_list',
            type: 'customEvent',
            customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'view_item_list' }] }],
          },
        ],
        variables: [
          {
            name: 'Constante - GA4 ID',
            type: 'c',
            parameter: [{ type: 'template', key: 'value', value: 'G-XXXXXXXXXX' }],
            notes: 'Remplacer G-XXXXXXXXXX par le vrai Measurement ID',
          },
          {
            name: 'Constante - Currency',
            type: 'c',
            parameter: [{ type: 'template', key: 'value', value: 'EUR' }],
          },
          { name: 'DLV - ecommerce', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce' }] },
          { name: 'DLV - ecommerce.transaction_id', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce.transaction_id' }] },
          { name: 'DLV - ecommerce.value', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce.value' }] },
          { name: 'DLV - ecommerce.items', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce.items' }] },
          { name: 'DLV - ecommerce.shipping', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce.shipping' }] },
          { name: 'DLV - ecommerce.tax', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce.tax' }] },
          { name: 'DLV - ecommerce.coupon', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce.coupon' }] },
          { name: 'DLV - ecommerce.item_list_id', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce.item_list_id' }] },
          { name: 'DLV - ecommerce.item_list_name', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'ecommerce.item_list_name' }] },
          { name: 'DLV - user_id', type: 'v', parameter: [{ type: 'template', key: 'name', value: 'user_id' }] },
        ],
        tags: [
          {
            name: 'GA4 — Configuration',
            type: 'gaawc',
            firingTriggerId: ['All Pages'],
            parameter: [{ type: 'template', key: 'measurementId', value: '{{Constante - GA4 ID}}' }],
            notes: "Référence le déclencheur natif \"All Pages\" déjà présent par défaut dans chaque container — vérifier qu'il porte bien ce nom exact avant déploiement.",
          },
          {
            name: 'GA4 — purchase',
            type: 'gaawe',
            firingTriggerId: ['DL - purchase'],
            parameter: [
              { type: 'template', key: 'event_name',     value: 'purchase' },
              { type: 'template', key: 'currency',       value: '{{Constante - Currency}}' },
              { type: 'template', key: 'transaction_id', value: '{{DLV - ecommerce.transaction_id}}' },
              { type: 'template', key: 'value',          value: '{{DLV - ecommerce.value}}' },
              { type: 'template', key: 'items',          value: '{{DLV - ecommerce.items}}' },
              { type: 'template', key: 'shipping',       value: '{{DLV - ecommerce.shipping}}' },
              { type: 'template', key: 'tax',            value: '{{DLV - ecommerce.tax}}' },
              { type: 'template', key: 'coupon',         value: '{{DLV - ecommerce.coupon}}' },
              { type: 'template', key: 'user_id',        value: '{{DLV - user_id}}' },
            ],
          },
          {
            name: 'GA4 — add_to_cart',
            type: 'gaawe',
            firingTriggerId: ['DL - add_to_cart'],
            parameter: [
              { type: 'template', key: 'event_name', value: 'add_to_cart' },
              { type: 'template', key: 'currency',   value: '{{Constante - Currency}}' },
              { type: 'template', key: 'value',      value: '{{DLV - ecommerce.value}}' },
              { type: 'template', key: 'items',      value: '{{DLV - ecommerce.items}}' },
              { type: 'template', key: 'coupon',     value: '{{DLV - ecommerce.coupon}}' },
              { type: 'template', key: 'user_id',    value: '{{DLV - user_id}}' },
            ],
          },
          {
            name: 'GA4 — view_item',
            type: 'gaawe',
            firingTriggerId: ['DL - view_item'],
            parameter: [
              { type: 'template', key: 'event_name', value: 'view_item' },
              { type: 'template', key: 'currency',   value: '{{Constante - Currency}}' },
              { type: 'template', key: 'value',      value: '{{DLV - ecommerce.value}}' },
              { type: 'template', key: 'items',      value: '{{DLV - ecommerce.items}}' },
            ],
          },
          {
            name: 'GA4 — begin_checkout',
            type: 'gaawe',
            firingTriggerId: ['DL - begin_checkout'],
            parameter: [
              { type: 'template', key: 'event_name', value: 'begin_checkout' },
              { type: 'template', key: 'currency',   value: '{{Constante - Currency}}' },
              { type: 'template', key: 'value',      value: '{{DLV - ecommerce.value}}' },
              { type: 'template', key: 'items',      value: '{{DLV - ecommerce.items}}' },
              { type: 'template', key: 'coupon',     value: '{{DLV - ecommerce.coupon}}' },
            ],
          },
          {
            name: 'GA4 — view_item_list',
            type: 'gaawe',
            firingTriggerId: ['DL - view_item_list'],
            parameter: [
              { type: 'template', key: 'event_name',    value: 'view_item_list' },
              { type: 'template', key: 'item_list_id',  value: '{{DLV - ecommerce.item_list_id}}' },
              { type: 'template', key: 'item_list_name',value: '{{DLV - ecommerce.item_list_name}}' },
              { type: 'template', key: 'items',         value: '{{DLV - ecommerce.items}}' },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'dl-mapping-collector',
    name: 'DataLayer Mapping — Collecteur',
    description: "Tag HTML personnalisé qui capture le vrai dataLayer.push() du site, anonymise et détecte les anomalies GA4 côté navigateur. Envoie vers un Google Sheet si {{DL Mapping - Sheets Endpoint}} est renseigné (voir src/features/datalayer-mapping/gtm-tag/dl-mapping-sheets-endpoint.gs.js à déployer manuellement en Apps Script), sinon capture 100% locale (localStorage, export manuel __dlMappingExport() en console) — dans ce cas, à tester en Preview GTM uniquement, jamais publié tel quel sur du trafic réel.",
    category: 'DataLayer Mapping',
    template: {
      name: 'DataLayer Mapping — Collecteur (Noviscore)',
      description: 'Capture dataLayer réel — voir PRD_DataLayerMapping.md §9.1',
      client: 'Noviscore',
      entities: {
        triggers: [],
        variables: [
          {
            name: 'DL Mapping - Client ID',
            type: 'c',
            parameter: [{ type: 'template', key: 'value', value: 'noviscore' }],
            notes: 'Identifiant client — identique sur les 4 containers Noviscore, seul {{Container ID}} (natif GTM) varie automatiquement pour distinguer les sites.',
          },
          {
            name: 'DL Mapping - Sheets Endpoint',
            type: 'c',
            parameter: [{ type: 'template', key: 'value', value: '' }],
            notes: "URL /exec du script Apps Script (dl-mapping-sheets-endpoint.gs.js) une fois déployé. Laisser vide = mode 100% local (localStorage + export manuel), à utiliser tant que ce script n'a pas été déployé — ne jamais publier ce tag en trafic réel avec cette valeur vide.",
          },
        ],
        tags: [
          {
            name: 'DL Mapping - Collecteur',
            type: 'html',
            // Référence le déclencheur natif "All Pages" déjà présent par défaut dans chaque
            // container — à vérifier avant déploiement qu'il porte bien ce nom exact.
            firingTriggerId: ['All Pages'],
            parameter: [
              { type: 'template', key: 'html', value: DL_MAPPING_COLLECTOR_SCRIPT },
              { type: 'boolean', key: 'supportDocumentWrite', value: 'false' },
            ],
            notes: "Tant que \"DL Mapping - Sheets Endpoint\" est vide : NE PAS publier en auto — publication manuelle puis test en Preview GTM uniquement. Une fois l'endpoint Google Sheets déployé et renseigné, ce tag peut être publié en trafic réel.",
          },
        ],
      },
    },
  },
];
