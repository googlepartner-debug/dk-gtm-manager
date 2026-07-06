import type { GTMParameter } from '../types/gtm';

export type FieldType = 'text' | 'textarea' | 'boolean' | 'select' | 'params-list' | 'trigger-ids-list';

export interface FieldDef {
  key: string;
  label: string;
  fieldType: FieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  monospace?: boolean;
  hint?: string;
}

export interface EntityTypeDef {
  id: string;
  label: string;
  description: string;
  category: string;
  icon: string; // SVG path data or letter
  fields: FieldDef[];
}

// ─── TAG TYPES ────────────────────────────────────────────────────────────────

export const TAG_TYPES: EntityTypeDef[] = [
  {
    id: 'gaawe',
    label: 'GA4 Event',
    description: 'Envoie un événement à Google Analytics 4',
    category: 'Google',
    icon: 'G4',
    fields: [
      { key: 'measurement_id', label: 'Measurement ID', fieldType: 'text', placeholder: '{{GA4 Measurement ID}}', required: true },
      { key: 'event_name', label: "Nom de l'événement", fieldType: 'text', placeholder: 'purchase', required: true },
      { key: 'ecommerce_object', label: 'Objet ecommerce (DL)', fieldType: 'text', placeholder: '{{dlv - ecommerce}}', hint: 'Optionnel — variable de couche de données' },
      { key: 'event_parameters', label: 'Paramètres événement', fieldType: 'params-list', hint: 'Paires clé/valeur envoyées avec l\'événement' },
    ],
  },
  {
    id: 'html',
    label: 'HTML personnalisé',
    description: 'Injecte du HTML ou JavaScript personnalisé',
    category: 'Personnalisé',
    icon: '</>',
    fields: [
      { key: 'html', label: 'Code HTML / JavaScript', fieldType: 'textarea', placeholder: '<script>\n// votre code\n</script>', required: true, monospace: true },
      { key: 'supportDocumentWrite', label: 'Support document.write', fieldType: 'boolean' },
    ],
  },
  {
    id: 'awct',
    label: 'Google Ads — Conversion',
    description: 'Suivi de conversion Google Ads',
    category: 'Google',
    icon: 'GA',
    fields: [
      { key: 'conversionId', label: 'Conversion ID', fieldType: 'text', placeholder: 'AW-123456789', required: true },
      { key: 'conversionLabel', label: 'Conversion Label', fieldType: 'text', placeholder: 'abcDEF123', required: true },
      { key: 'conversionValue', label: 'Valeur de conversion', fieldType: 'text', placeholder: '{{transaction_revenue}}' },
      { key: 'currencyCode', label: 'Devise', fieldType: 'text', placeholder: 'EUR' },
      { key: 'orderId', label: 'ID commande', fieldType: 'text', placeholder: '{{transaction_id}}' },
    ],
  },
  {
    id: 'flc',
    label: 'Floodlight Counter',
    description: 'Compteur de conversion Campaign Manager',
    category: 'Google',
    icon: 'FL',
    fields: [
      { key: 'advertiserId', label: 'Advertiser ID', fieldType: 'text', required: true },
      { key: 'groupTag', label: 'Group Tag', fieldType: 'text', required: true },
      { key: 'activityTag', label: 'Activity Tag', fieldType: 'text', required: true },
      { key: 'countingMethod', label: 'Méthode de comptage', fieldType: 'select', options: [
        { value: 'standard', label: 'Standard' },
        { value: 'unique', label: 'Unique' },
        { value: 'per_session', label: 'Par session' },
      ]},
    ],
  },
  {
    id: 'img',
    label: 'Image personnalisée',
    description: 'Pixel de tracking — requête image',
    category: 'Personnalisé',
    icon: 'IMG',
    fields: [
      { key: 'url', label: 'URL de l\'image', fieldType: 'text', placeholder: 'https://...', required: true },
      { key: 'useCacheBuster', label: 'Cache buster', fieldType: 'boolean' },
    ],
  },
];

// ─── VARIABLE TYPES ───────────────────────────────────────────────────────────

export const VARIABLE_TYPES: EntityTypeDef[] = [
  {
    id: 'v',
    label: 'Variable de couche de données',
    description: 'Lit une valeur depuis dataLayer',
    category: 'Variables de page',
    icon: 'DL',
    fields: [
      { key: 'name', label: 'Nom de la variable dataLayer', fieldType: 'text', placeholder: 'ecommerce.purchase.actionField.id', required: true },
      { key: 'dataLayerVersion', label: 'Version', fieldType: 'select', options: [
        { value: '2', label: 'Version 2' },
        { value: '1', label: 'Version 1' },
      ]},
      { key: 'setDefaultValue', label: 'Valeur par défaut', fieldType: 'boolean' },
      { key: 'defaultValue', label: 'Valeur par défaut', fieldType: 'text', placeholder: 'undefined' },
    ],
  },
  {
    id: 'c',
    label: 'Constante',
    description: 'Valeur fixe réutilisable',
    category: 'Utilitaires',
    icon: 'C',
    fields: [
      { key: 'value', label: 'Valeur', fieldType: 'text', required: true },
    ],
  },
  {
    id: 'jsm',
    label: 'JavaScript personnalisé',
    description: 'Retourne une valeur depuis une fonction JS',
    category: 'Variables de page',
    icon: 'JS',
    fields: [
      { key: 'javascript', label: 'Fonction JavaScript', fieldType: 'textarea', placeholder: 'function() {\n  return document.title;\n}', required: true, monospace: true },
    ],
  },
  {
    id: 'u',
    label: 'URL',
    description: 'Extrait une partie de l\'URL',
    category: 'Variables de page',
    icon: 'URL',
    fields: [
      { key: 'component', label: 'Composant URL', fieldType: 'select', options: [
        { value: 'URL', label: 'URL complète' },
        { value: 'PROTOCOL', label: 'Protocole' },
        { value: 'HOST', label: 'Hôte' },
        { value: 'PORT', label: 'Port' },
        { value: 'PATH', label: 'Chemin' },
        { value: 'QUERY', label: 'Paramètre de requête' },
        { value: 'FRAGMENT', label: 'Fragment (#)' },
      ], required: true },
      { key: 'queryKey', label: 'Clé du paramètre', fieldType: 'text', placeholder: 'utm_source', hint: 'Si composant = Paramètre de requête' },
    ],
  },
  {
    id: 'k',
    label: 'Cookie 1ère partie',
    description: 'Lit un cookie du navigateur',
    category: 'Variables de page',
    icon: 'CK',
    fields: [
      { key: 'name', label: 'Nom du cookie', fieldType: 'text', required: true, placeholder: '_ga' },
      { key: 'decodeCookie', label: 'Décoder le cookie (URI)', fieldType: 'boolean' },
    ],
  },
  {
    id: 'aev',
    label: 'Variable d\'auto-événement',
    description: 'Valeur capturée lors d\'un clic/form',
    category: 'Variables de page',
    icon: 'AE',
    fields: [
      { key: 'varType', label: 'Type', fieldType: 'select', options: [
        { value: 'ELEMENT', label: 'Élément' },
        { value: 'ATTRIBUTE', label: 'Attribut' },
        { value: 'TEXT', label: 'Texte' },
        { value: 'URL', label: 'URL' },
        { value: 'TARGET', label: 'Cible' },
      ], required: true },
      { key: 'attribute', label: 'Nom de l\'attribut', fieldType: 'text', placeholder: 'data-id', hint: 'Si type = Attribut' },
    ],
  },
];

// ─── TRIGGER TYPES ────────────────────────────────────────────────────────────

export const TRIGGER_TYPES: EntityTypeDef[] = [
  {
    id: 'pageview',
    label: 'Page Vue',
    description: 'Se déclenche au chargement de la page',
    category: 'Chargement de page',
    icon: 'PV',
    fields: [],
  },
  {
    id: 'domReady',
    label: 'DOM prêt',
    description: 'Se déclenche quand le DOM est chargé',
    category: 'Chargement de page',
    icon: 'DOM',
    fields: [],
  },
  {
    id: 'windowLoaded',
    label: 'Fenêtre chargée',
    description: 'Se déclenche quand window.load est terminé',
    category: 'Chargement de page',
    icon: 'WL',
    fields: [],
  },
  {
    id: 'customEvent',
    label: 'Événement personnalisé',
    description: 'Se déclenche sur un événement dataLayer.push',
    category: 'Autre',
    icon: 'EV',
    fields: [
      { key: 'customEventFilter', label: 'Nom de l\'événement', fieldType: 'text', placeholder: 'purchase', required: true, hint: 'Correspond à event: dans le dataLayer.push' },
      { key: 'useRegex', label: 'Utiliser une expression régulière', fieldType: 'boolean' },
    ],
  },
  {
    id: 'click',
    label: 'Clic — Tous les éléments',
    description: 'Se déclenche sur tous les clics',
    category: 'Clic',
    icon: 'CLK',
    fields: [
      { key: 'waitForTags', label: 'Attendre les tags', fieldType: 'boolean' },
      { key: 'checkValidation', label: 'Vérifier la validation', fieldType: 'boolean' },
    ],
  },
  {
    id: 'linkClick',
    label: 'Clic — Liens uniquement',
    description: 'Se déclenche sur les clics de liens',
    category: 'Clic',
    icon: 'LNK',
    fields: [
      { key: 'waitForTags', label: 'Attendre les tags', fieldType: 'boolean' },
      { key: 'checkValidation', label: 'Vérifier la validation', fieldType: 'boolean' },
      { key: 'waitForTagsTimeout', label: 'Délai (ms)', fieldType: 'text', placeholder: '2000' },
    ],
  },
  {
    id: 'scrollDepth',
    label: 'Profondeur de défilement',
    description: 'Se déclenche selon la distance de scroll',
    category: 'Engagement',
    icon: 'SCR',
    fields: [
      { key: 'verticalThresholdUnits', label: 'Unité', fieldType: 'select', options: [
        { value: 'PERCENT', label: 'Pourcentage' },
        { value: 'PIXELS', label: 'Pixels' },
      ]},
      { key: 'verticalThresholds', label: 'Seuils (séparés par virgule)', fieldType: 'text', placeholder: '25,50,75,90' },
    ],
  },
  {
    id: 'tgg',
    label: 'Groupe de déclencheurs',
    description: 'Se déclenche quand TOUS les déclencheurs sélectionnés ont été activés sur la même page',
    category: 'Avancé',
    icon: 'GRP',
    fields: [
      {
        key: 'triggerIds',
        label: 'Déclencheurs à combiner',
        fieldType: 'trigger-ids-list',
        required: true,
        hint: 'Tous ces déclencheurs doivent avoir été actifs pour que le groupe se déclenche',
      },
    ],
  },
];

// ─── HELPERS param ↔ form ─────────────────────────────────────────────────────

export type FormValues = Record<string, string | boolean | { name: string; value: string }[]>;

export function paramsToForm(params: GTMParameter[] = []): FormValues {
  const form: FormValues = {};
  for (const p of params) {
    if (!p.key) continue;
    if (p.type === 'boolean') form[p.key] = p.value === 'true';
    else if (p.type === 'list') {
      form[p.key] = (p.list ?? []).map((item) => {
        const nameParam = item.map?.find((m) => m.key === 'name');
        const valueParam = item.map?.find((m) => m.key === 'value');
        return { name: nameParam?.value ?? '', value: valueParam?.value ?? '' };
      });
    } else {
      form[p.key] = p.value ?? '';
    }
  }
  return form;
}

export function formToParams(form: FormValues, fields: FieldDef[]): GTMParameter[] {
  const params: GTMParameter[] = [];
  for (const field of fields) {
    const val = form[field.key];
    if (val === undefined || val === '' || val === false) continue;
    if (field.fieldType === 'boolean') {
      if (val === true) params.push({ type: 'boolean', key: field.key, value: 'true' });
    } else if (field.fieldType === 'params-list') {
      const list = val as { name: string; value: string }[];
      if (list.length > 0) {
        params.push({
          type: 'list',
          key: field.key,
          list: list.map((item) => ({
            type: 'map',
            map: [
              { type: 'template', key: 'name', value: item.name },
              { type: 'template', key: 'value', value: item.value },
            ],
          })),
        });
      }
    } else {
      params.push({ type: 'template', key: field.key, value: String(val) });
    }
  }
  return params;
}
