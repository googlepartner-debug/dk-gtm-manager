import type { GlossaryEntry } from '../types/datalayer.types';

export const GA4_EVENTS: Record<string, string[]> = {
  ecommerce: [
    'add_payment_info', 'add_shipping_info', 'add_to_cart', 'add_to_wishlist',
    'begin_checkout', 'purchase', 'refund', 'remove_from_cart', 'select_item',
    'select_promotion', 'view_cart', 'view_item', 'view_item_list', 'view_promotion',
  ],
  engagement: [
    'earn_virtual_currency', 'join_group', 'login', 'search', 'select_content',
    'share', 'sign_up', 'spend_virtual_currency', 'tutorial_begin', 'tutorial_complete',
    'unlock_achievement', 'page_view', 'scroll', 'click', 'file_download', 'video_start',
    'video_progress', 'video_complete',
  ],
  generation_leads: ['generate_lead'],
  gaming: ['level_end', 'level_start', 'level_up', 'post_score'],
};

// GA4-required numeric fields (PRD §5.1) — a string value here is a type mismatch, not a style choice.
export const GA4_NUMERIC_KEYS = ['value', 'price', 'shipping', 'tax'];

export const GA4_CURRENCY_KEY = 'currency';
export const ISO_4217_RE = /^[A-Z]{3}$/;

export const SENSITIVE_KEYWORDS: Record<string, string[]> = {
  email: ['email', 'mail', 'courriel', 'e-mail'],
  phone: ['phone', 'tel', 'mobile', 'portable', 'telephone', 'gsm'],
  firstname: ['firstname', 'prenom', 'first_name', 'prénom'],
  lastname: ['lastname', 'nom', 'last_name', 'surname', 'family_name'],
  userid: ['user_id', 'userid', 'customer_id'],
};

export const GLOSSARY: GlossaryEntry[] = [
  { term: 'Nb Occurrences', definition: "Nombre total de fois où l'event ou la variable a été détecté" },
  { term: 'Nb Complétées', definition: 'Nombre de fois où la variable avait une valeur non vide' },
  { term: '% Complété', definition: '(Nb Complétées / Nb Occurrences) × 100' },
  { term: 'Catégorie', definition: 'Classification GA4 : ecommerce, engagement, generation_leads, gaming, custom' },
  { term: 'Priorité', definition: "Niveau d'importance : Critique, Important, Normal, Optionnel" },
  { term: 'dataLayer à implémenter', definition: 'Template avec placeholders {{variable}} destiné aux développeurs' },
  { term: 'Variable Path', definition: 'Chemin complet de la variable dans le dataLayer, notation wildcard pour les tableaux (ex: ecommerce.items[*].item_name)' },
  { term: 'Statut', definition: 'État de validation : À valider, Validé, Problème' },
  { term: 'Site', definition: 'Correspond à un container GTM existant dans dk-gtm-manager (même référentiel, PRD §3)' },
  { term: 'GA4 Type Mismatch', definition: 'value/price/shipping/tax doit être numérique — une chaîne ("45.00") est une alerte critique' },
  { term: 'Asynchronous DataLayer Split', definition: "Un event e-commerce dont l'objet ecommerce et la clé event ne sont pas dans le même push" },
  { term: 'Stale dataLayer object', definition: "Objet ecommerce résiduel d'une page précédente détecté sur un event non-ecommerce" },
];

// PRD §14.6 — default funnel isolated by Focus Mode; editable per client (datalayerStore.focusEvents).
export const DEFAULT_FUNNEL_STEPS = ['view_item_list', 'view_item', 'begin_checkout', 'purchase'];

export const ALERT_THRESHOLD = 95;
export const MAX_UNIQUE_VALUES = 20;

// System events excluded from collection (PRD §5.6)
export const SYSTEM_EVENT_PATTERNS = [/^gtm\./i, /^gtm_/i, /cookie/i];
