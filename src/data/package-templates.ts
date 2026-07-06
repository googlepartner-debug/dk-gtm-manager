import type { DeploymentPackage } from '../types/gtm';

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
            triggerId: 'tpl-purchase',
            name: 'DL - purchase',
            type: 'customEvent',
            customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'purchase' }] }],
          },
          {
            triggerId: 'tpl-add_to_cart',
            name: 'DL - add_to_cart',
            type: 'customEvent',
            customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'add_to_cart' }] }],
          },
          {
            triggerId: 'tpl-view_item',
            name: 'DL - view_item',
            type: 'customEvent',
            customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'view_item' }] }],
          },
          {
            triggerId: 'tpl-begin_checkout',
            name: 'DL - begin_checkout',
            type: 'customEvent',
            customEventFilter: [{ type: 'equals', parameter: [{ type: 'template', key: 'arg0', value: '{{_event}}' }, { type: 'template', key: 'arg1', value: 'begin_checkout' }] }],
          },
          {
            triggerId: 'tpl-view_item_list',
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
            firingTriggerId: [],
            parameter: [{ type: 'template', key: 'measurementId', value: '{{Constante - GA4 ID}}' }],
            notes: 'Ajouter un déclencheur All Pages',
          },
          {
            name: 'GA4 — purchase',
            type: 'gaawe',
            firingTriggerId: ['tpl-purchase'],
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
            firingTriggerId: ['tpl-add_to_cart'],
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
            firingTriggerId: ['tpl-view_item'],
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
            firingTriggerId: ['tpl-begin_checkout'],
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
            firingTriggerId: ['tpl-view_item_list'],
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
];
