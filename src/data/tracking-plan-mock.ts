import type { TrackingPlan } from '../features/tracking-plan/types/trackingPlan.types';

// Démo pour itérer sur l'UI/UX du Plan de tracking en attendant Supabase (2026-07-14) —
// clientId 'noviscore', même référentiel que datalayer-mock.ts.
//
// Statuts obtenus par recoupement avec les données mock déjà en place (pas de statut stocké
// en dur ici, PRD_TrackingPlan.md §5) :
// - "purchase" / "view_item" → Implémenté (bonne complétion dans MOCK_DATALAYER_VARIABLES,
//   src/data/datalayer-mock.ts — un vrai dataLayer.push() est détecté en prod)
// - "add_shipping_info" / "add_payment_info" → Planifié (0 occurrence dans le mock — reflète
//   la vraie régression Noviscore du 14/04 déjà documentée ailleurs dans le repo)
// - "sign_up" / "view_cart" → Planifié (aucune donnée nulle part, events jamais implémentés)
// "Configuré" (tag GTM posé, event pas encore capté en prod) ne peut pas apparaître avec ce
// seed seul : ça demande aussi de charger les données mock Monitoring (bouton "Charger les
// données de démonstration" sur Événements), et ce mock Monitoring-là couvre des containers
// compagnies aériennes, pas Noviscore — donc aucun des deux mocks ne se recoupe pour produire
// "Configuré" tel quel. Comblé différemment par test-container-mock.ts (2026-07-14), qui
// utilise un référentiel dédié plutôt que de corriger ce mock Noviscore.
export const MOCK_TRACKING_PLAN: TrackingPlan = {
  clientId: 'noviscore',
  createdAt: '2026-07-14T09:00:00.000Z',
  events: [
    {
      id: 'mock-tp-purchase',
      eventName: 'purchase',
      businessName: 'Confirmation d\'achat',
      description: 'Se déclenche à l\'affichage de la page de confirmation, une fois le paiement validé côté serveur.',
      category: 'ecommerce',
      pageOrStep: 'Confirmation',
      priority: 'critique',
      owner: 'Paid Media',
      platforms: ['GA4', 'Ads'],
      parameters: [
        { id: 'p1', key: 'ecommerce.transaction_id', type: 'string', required: true, exampleValue: 'NOV-2026-88214', description: 'Identifiant unique de la commande' },
        { id: 'p2', key: 'ecommerce.value', type: 'number', required: true, exampleValue: '129.90', description: 'Montant total TTC de la commande' },
        { id: 'p3', key: 'ecommerce.currency', type: 'string', required: true, exampleValue: 'EUR', description: 'Devise ISO 4217 — bug connu : codée en dur EUR même hors zone euro' },
      ],
      screenshots: [],
    },
    {
      id: 'mock-tp-view-item',
      eventName: 'view_item',
      businessName: 'Vue produit',
      description: 'Se déclenche à l\'affichage d\'une fiche partition/produit.',
      category: 'ecommerce',
      pageOrStep: 'Fiche produit',
      priority: 'important',
      owner: 'SEO',
      platforms: ['GA4'],
      parameters: [
        { id: 'p1', key: 'ecommerce.items[*].item_name', type: 'string', required: true, exampleValue: '', description: 'Nom de la partition' },
        { id: 'p2', key: 'ecommerce.items[*].price', type: 'number', required: true, exampleValue: '', description: 'Prix affiché' },
      ],
      screenshots: [],
    },
    {
      id: 'mock-tp-add-shipping-info',
      eventName: 'add_shipping_info',
      businessName: 'Ajout infos livraison',
      description: 'Se déclenche à la validation de l\'étape adresse de livraison, dans le tunnel de checkout.',
      category: 'ecommerce',
      pageOrStep: 'Checkout',
      priority: 'critique',
      owner: 'Merch',
      platforms: ['GA4'],
      parameters: [
        { id: 'p1', key: 'ecommerce.shipping_tier', type: 'string', required: false, exampleValue: '', description: 'Mode de livraison choisi' },
      ],
      screenshots: [],
    },
    {
      id: 'mock-tp-add-payment-info',
      eventName: 'add_payment_info',
      businessName: 'Ajout infos paiement',
      description: 'Se déclenche à la sélection du moyen de paiement, avant validation finale.',
      category: 'ecommerce',
      pageOrStep: 'Checkout',
      priority: 'critique',
      owner: 'Merch',
      platforms: ['GA4'],
      parameters: [
        { id: 'p1', key: 'ecommerce.payment_type', type: 'string', required: false, exampleValue: 'carte', description: 'Moyen de paiement sélectionné' },
      ],
      screenshots: [],
    },
    {
      id: 'mock-tp-view-cart',
      eventName: 'view_cart',
      businessName: 'Vue panier',
      description: 'Se déclenche à l\'ouverture du panier, avant le tunnel de checkout.',
      category: 'ecommerce',
      pageOrStep: 'Panier',
      priority: 'normal',
      owner: 'Merch',
      platforms: ['GA4', 'Piano'],
      parameters: [
        { id: 'p1', key: 'ecommerce.value', type: 'number', required: true, exampleValue: '', description: 'Valeur totale du panier' },
      ],
      screenshots: [],
    },
    {
      id: 'mock-tp-sign-up',
      eventName: 'sign_up',
      businessName: 'Création de compte',
      description: 'Se déclenche à la confirmation de création d\'un compte client.',
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
