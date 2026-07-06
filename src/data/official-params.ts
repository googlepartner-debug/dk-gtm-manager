// Official parameter definitions sourced from GA4, Matomo, and Piano Analytics documentation.
// status: 'required' | 'recommended' | 'optional'

export type ParamStatus = 'required' | 'recommended' | 'optional';

export interface OfficialParam {
  key: string;
  status: ParamStatus;
  description?: string;
}

export interface OfficialEventDef {
  eventName: string;
  params: OfficialParam[];
}

// ─── GA4 Ecommerce events ──────────────────────────────────────────────────────

const GA4_ITEM_PARAMS: OfficialParam[] = [
  { key: 'item_id',        status: 'required',    description: 'SKU ou identifiant produit (ou item_name)' },
  { key: 'item_name',      status: 'required',    description: 'Nom du produit (ou item_id)' },
  { key: 'price',          status: 'recommended', description: 'Prix unitaire' },
  { key: 'quantity',       status: 'recommended', description: 'Quantité' },
  { key: 'item_brand',     status: 'recommended', description: 'Marque' },
  { key: 'item_variant',   status: 'recommended', description: 'Variante (couleur, taille…)' },
  { key: 'item_category',  status: 'recommended', description: 'Catégorie principale' },
  { key: 'item_category2', status: 'optional' },
  { key: 'item_category3', status: 'optional' },
  { key: 'item_category4', status: 'optional' },
  { key: 'item_category5', status: 'optional' },
  { key: 'affiliation',    status: 'optional',    description: 'Magasin / vendeur' },
  { key: 'coupon',         status: 'optional',    description: 'Code promo niveau item' },
  { key: 'discount',       status: 'optional',    description: 'Remise niveau item' },
  { key: 'index',          status: 'optional',    description: 'Position dans la liste' },
  { key: 'location_id',    status: 'optional',    description: 'Identifiant lieu physique' },
  { key: 'item_list_id',   status: 'optional',    description: 'ID liste (résultats, suggestions…)' },
  { key: 'item_list_name', status: 'optional',    description: 'Nom liste' },
];

export const GA4_OFFICIAL_EVENTS: OfficialEventDef[] = [
  {
    eventName: 'purchase',
    params: [
      { key: 'currency',       status: 'required',    description: 'Code ISO 4217 (EUR, USD…)' },
      { key: 'value',          status: 'required',    description: 'Valeur totale de la commande' },
      { key: 'transaction_id', status: 'required',    description: 'Identifiant unique de commande' },
      { key: 'items',          status: 'required',    description: 'Tableau des produits achetés' },
      { key: 'tax',            status: 'recommended', description: 'Taxes' },
      { key: 'shipping',       status: 'recommended', description: 'Frais de livraison' },
      { key: 'coupon',         status: 'recommended', description: 'Code promo niveau commande' },
      { key: 'affiliation',    status: 'optional',    description: 'Magasin / canal de vente' },
    ],
  },
  {
    eventName: 'add_to_cart',
    params: [
      { key: 'currency', status: 'required' },
      { key: 'value',    status: 'required' },
      { key: 'items',    status: 'required' },
    ],
  },
  {
    eventName: 'remove_from_cart',
    params: [
      { key: 'currency', status: 'required' },
      { key: 'value',    status: 'required' },
      { key: 'items',    status: 'required' },
    ],
  },
  {
    eventName: 'view_item',
    params: [
      { key: 'items',    status: 'required' },
      { key: 'currency', status: 'recommended' },
      { key: 'value',    status: 'recommended' },
    ],
  },
  {
    eventName: 'view_item_list',
    params: [
      { key: 'items',          status: 'required' },
      { key: 'item_list_id',   status: 'recommended' },
      { key: 'item_list_name', status: 'recommended' },
      { key: 'currency',       status: 'recommended' },
      { key: 'value',          status: 'recommended' },
    ],
  },
  {
    eventName: 'view_cart',
    params: [
      { key: 'items',    status: 'required' },
      { key: 'currency', status: 'recommended' },
      { key: 'value',    status: 'recommended' },
    ],
  },
  {
    eventName: 'begin_checkout',
    params: [
      { key: 'currency', status: 'required' },
      { key: 'value',    status: 'required' },
      { key: 'items',    status: 'required' },
      { key: 'coupon',   status: 'recommended' },
    ],
  },
  {
    eventName: 'add_shipping_info',
    params: [
      { key: 'currency',      status: 'required' },
      { key: 'value',         status: 'required' },
      { key: 'items',         status: 'required' },
      { key: 'coupon',        status: 'recommended' },
      { key: 'shipping_tier', status: 'recommended', description: 'Mode de livraison (Standard, Express…)' },
    ],
  },
  {
    eventName: 'add_payment_info',
    params: [
      { key: 'currency',     status: 'required' },
      { key: 'value',        status: 'required' },
      { key: 'items',        status: 'required' },
      { key: 'coupon',       status: 'recommended' },
      { key: 'payment_type', status: 'recommended', description: 'Mode de paiement (card, paypal…)' },
    ],
  },
  {
    eventName: 'select_item',
    params: [
      { key: 'items',          status: 'required' },
      { key: 'item_list_id',   status: 'recommended' },
      { key: 'item_list_name', status: 'recommended' },
    ],
  },
  {
    eventName: 'add_to_wishlist',
    params: [
      { key: 'currency', status: 'required' },
      { key: 'value',    status: 'required' },
      { key: 'items',    status: 'required' },
    ],
  },
  {
    eventName: 'select_promotion',
    params: [
      { key: 'promotion_id',   status: 'recommended' },
      { key: 'promotion_name', status: 'recommended' },
      { key: 'creative_name',  status: 'recommended' },
      { key: 'creative_slot',  status: 'recommended' },
      { key: 'items',          status: 'optional' },
    ],
  },
  {
    eventName: 'view_promotion',
    params: [
      { key: 'promotion_id',   status: 'recommended' },
      { key: 'promotion_name', status: 'recommended' },
      { key: 'creative_name',  status: 'recommended' },
      { key: 'creative_slot',  status: 'recommended' },
      { key: 'items',          status: 'optional' },
    ],
  },
];

// ─── Matomo ────────────────────────────────────────────────────────────────────
// Source: https://developer.matomo.org/api-reference/tracking-javascript
// Note: all monetary values must be numeric (not strings).

export const MATOMO_OFFICIAL_EVENTS: OfficialEventDef[] = [
  {
    // _paq.push(['trackEcommerceOrder', orderId, grandTotal, subTotal, tax, shipping, discount])
    eventName: 'trackEcommerceOrder',
    params: [
      { key: 'orderId',    status: 'required',    description: 'Identifiant unique de commande' },
      { key: 'grandTotal', status: 'required',    description: 'Total TTC (numérique, pas une chaîne)' },
      { key: 'subTotal',   status: 'recommended', description: 'Total HT' },
      { key: 'tax',        status: 'recommended', description: 'Taxes' },
      { key: 'shipping',   status: 'recommended', description: 'Frais de livraison' },
      { key: 'discount',   status: 'recommended', description: 'Réduction totale' },
    ],
  },
  {
    // _paq.push(['addEcommerceItem', productSKU, productName, productCategory, price, quantity])
    eventName: 'addEcommerceItem',
    params: [
      { key: 'productSKU',      status: 'required',    description: 'Identifiant produit unique' },
      { key: 'productName',     status: 'recommended', description: 'Nom du produit' },
      { key: 'productCategory', status: 'recommended', description: 'Catégorie (string ou tableau, max 5)' },
      { key: 'price',           status: 'recommended', description: 'Prix unitaire (numérique)' },
      { key: 'quantity',        status: 'recommended', description: 'Quantité (défaut : 1)' },
    ],
  },
  {
    // _paq.push(['trackEcommerceCartUpdate', grandTotal])
    eventName: 'trackEcommerceCartUpdate',
    params: [
      { key: 'grandTotal', status: 'required', description: 'Total du panier (numérique)' },
    ],
  },
  {
    // _paq.push(['setEcommerceView', productSKU, productName, categoryName, price])
    // Doit précéder trackPageView()
    eventName: 'setEcommerceView',
    params: [
      { key: 'productSKU',   status: 'required', description: 'Identifiant produit' },
      { key: 'productName',  status: 'required', description: 'Nom du produit' },
      { key: 'categoryName', status: 'required', description: 'Catégorie (string ou tableau, max 5)' },
      { key: 'price',        status: 'required', description: 'Prix (numérique)' },
    ],
  },
];

// ─── Piano Analytics ───────────────────────────────────────────────────────────
// Source: https://analytics-docs.piano.io/en/analytics/v1/google-tag-manager-pa-sdk-template
// Piano utilise l'eCommerce Bridge pour transformer le schéma GA4 automatiquement.
// Les événements ecommerce Piano correspondent donc souvent au schéma GA4.

export const PIANO_OFFICIAL_EVENTS: OfficialEventDef[] = [
  {
    // Tag type: PA SDK Template / SmartTag Template
    eventName: 'page.display',
    params: [
      { key: 'site',            status: 'required',    description: 'Site ID Piano (numérique)' },
      { key: 'collecDomainSSL', status: 'required',    description: 'Domaine de collecte HTTPS' },
      { key: 'page',            status: 'recommended', description: 'Nom de la page' },
      { key: 'chapter1',        status: 'optional',    description: 'Niveau 1 de navigation' },
      { key: 'chapter2',        status: 'optional' },
      { key: 'chapter3',        status: 'optional' },
      { key: 'userId',          status: 'optional',    description: 'Identifiant utilisateur connecté' },
    ],
  },
  {
    // eCommerce Bridge — transforme le schéma GA4 vers Piano
    // Les événements GA4 (purchase, add_to_cart…) sont automatiquement bridgés
    eventName: 'order.confirmation',
    params: [
      { key: 'orderId',      status: 'required',    description: 'ID commande (via eCommerce Bridge)' },
      { key: 'turnover',     status: 'required',    description: 'CA TTC (mapped depuis value)' },
      { key: 'currency',     status: 'recommended', description: 'Code ISO 4217' },
      { key: 'discount',     status: 'optional' },
      { key: 'deliveryCost', status: 'optional',    description: 'Mapped depuis shipping' },
      { key: 'paymentType',  status: 'optional' },
    ],
  },
];

// ─── Lookup helpers ─────────────────────────────────────────────────────────────

type Platform = 'ga4' | 'matomo' | 'piano';

const PLATFORM_EVENTS: Record<Platform, OfficialEventDef[]> = {
  ga4: GA4_OFFICIAL_EVENTS,
  matomo: MATOMO_OFFICIAL_EVENTS,
  piano: PIANO_OFFICIAL_EVENTS,
};

export function getOfficialEventDef(eventName: string, platform: Platform = 'ga4'): OfficialEventDef | null {
  return PLATFORM_EVENTS[platform].find((e) => e.eventName === eventName) ?? null;
}

export function getOfficialParamStatus(eventName: string, paramKey: string, platform: Platform = 'ga4'): ParamStatus | null {
  const def = getOfficialEventDef(eventName, platform);
  return def?.params.find((p) => p.key === paramKey)?.status ?? null;
}

export { GA4_ITEM_PARAMS };
