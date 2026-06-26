import type { GTMTag } from '../types/gtm';

export interface MonitoringContainerData {
  containerId: string;
  containerName: string;
  publicId: string;
  workspaceId: string;
  tags: GTMTag[];
  scannedAt: string;
}

// Realistic PFS containers with intentional coverage gaps — mock until GCP OAuth
export const MONITORING_MOCK: MonitoringContainerData[] = [
  {
    containerId: '202264563',
    containerName: 'Turkish Airlines',
    publicId: 'GTM-MMMTXK6D',
    workspaceId: '1',
    scannedAt: '2026-06-26T10:00:00Z',
    tags: [
      { name: 'GA4 — Configuration', type: 'gaawc', parameter: [{ type: 'template', key: 'measurementId', value: 'G-XXXXXXX001' }] },
      { name: 'GA4 — purchase', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 Measurement ID}}' }, { type: 'template', key: 'event_name', value: 'purchase' }, { type: 'template', key: 'ecommerce_object', value: '{{dlv - ecommerce}}' }] },
      { name: 'GA4 — add_to_cart', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 Measurement ID}}' }, { type: 'template', key: 'event_name', value: 'add_to_cart' }] },
      { name: 'GA4 — view_item', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 Measurement ID}}' }, { type: 'template', key: 'event_name', value: 'view_item' }] },
      { name: 'GA4 — begin_checkout', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 Measurement ID}}' }, { type: 'template', key: 'event_name', value: 'begin_checkout' }] },
      { name: 'Google Ads — Conversion Achat', type: 'awct', parameter: [{ type: 'template', key: 'conversionId', value: 'AW-111111111' }, { type: 'template', key: 'conversionLabel', value: 'abc123' }] },
      { name: 'Kameleoon — Init', type: 'html', parameter: [{ type: 'template', key: 'html', value: '<script src="https://js.kameleoon.com/kameleoon.js?siteCode=tk001"></script>' }] },
      { name: 'Meta Pixel — PageView', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- Meta Pixel Code -->\n<script>!function(f,b,e,v){fbq('init','1234567890');};</script>" }] },
    ],
  },
  {
    containerId: '202264564',
    containerName: 'Air France',
    publicId: 'GTM-AF2024',
    workspaceId: '1',
    scannedAt: '2026-06-26T10:00:00Z',
    tags: [
      { name: 'GA4 Config', type: 'gaawc', parameter: [{ type: 'template', key: 'measurementId', value: 'G-XXXXXXX002' }] },
      { name: 'GA4 Event — purchase', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'purchase' }] },
      { name: 'GA4 Event — view_item', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'view_item' }] },
      { name: 'GA4 Event — search', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'search' }] },
      { name: 'Ads Remarketing', type: 'awct', parameter: [{ type: 'template', key: 'conversionId', value: 'AW-222222222' }, { type: 'template', key: 'conversionLabel', value: 'def456' }] },
      { name: 'AB Tasty — Script', type: 'html', parameter: [{ type: 'template', key: 'html', value: '<script src="https://try.abtasty.com/af2024.js"></script>' }] },
      { name: 'TikTok Pixel', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- TikTok Pixel -->\n<script>!function (w, d, t) {ttq.load('CTXXXXXXXX');}(window, document, 'script');</script>" }] },
    ],
  },
  {
    containerId: '202264565',
    containerName: 'Corsair',
    publicId: 'GTM-COR2024',
    workspaceId: '1',
    scannedAt: '2026-06-26T10:00:00Z',
    tags: [
      { name: 'GA4 — Configuration Tag', type: 'gaawc', parameter: [{ type: 'template', key: 'measurementId', value: 'G-XXXXXXX003' }] },
      { name: 'GA4 — Purchase Event', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Var - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'purchase' }, { type: 'template', key: 'ecommerce_object', value: '{{DL - ecommerce}}' }] },
      { name: 'GA4 — Add to Cart', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Var - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'add_to_cart' }] },
      { name: 'GA4 — View Item List', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Var - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'view_item_list' }] },
      { name: 'GA4 — Search', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Var - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'search' }] },
      { name: 'Kameleoon Script', type: 'html', parameter: [{ type: 'template', key: 'html', value: '<script src="https://js.kameleoon.com/kameleoon.js?siteCode=cor003"></script>' }] },
      { name: 'Hotjar', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- Hotjar -->\n<script>(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:3001234};})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');</script>" }] },
    ],
  },
  {
    containerId: '202264566',
    containerName: 'Iberia',
    publicId: 'GTM-IBE2024',
    workspaceId: '1',
    scannedAt: '2026-06-26T10:00:00Z',
    tags: [
      { name: 'GA4 Config — Iberia', type: 'gaawc', parameter: [{ type: 'template', key: 'measurementId', value: 'G-XXXXXXX004' }] },
      { name: 'GA4 — purchase', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'purchase' }] },
      { name: 'GA4 — view_item', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'view_item' }] },
      { name: 'GA4 — begin_checkout', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'begin_checkout' }] },
      { name: 'Google Ads Conversion', type: 'awct', parameter: [{ type: 'template', key: 'conversionId', value: 'AW-333333333' }, { type: 'template', key: 'conversionLabel', value: 'ghi789' }] },
      { name: 'Floodlight — IBE', type: 'flc', parameter: [{ type: 'template', key: 'advertiserId', value: '987654321' }, { type: 'template', key: 'groupTag', value: 'BOOK' }, { type: 'template', key: 'activityTag', value: 'CONF' }] },
      { name: 'Meta Pixel', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- Meta Pixel -->\n<script>!function(f,b,e,v){fbq('init','9876543210');};</script>" }] },
    ],
  },
  {
    containerId: '202264567',
    containerName: 'Swiss',
    publicId: 'GTM-SWI2024',
    workspaceId: '1',
    scannedAt: '2026-06-26T10:00:00Z',
    tags: [
      { name: 'GA4 Configuration', type: 'gaawc', parameter: [{ type: 'template', key: 'measurementId', value: 'G-XXXXXXX005' }] },
      { name: 'GA4 — purchase', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'purchase' }] },
      { name: 'GA4 — add_to_cart', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'add_to_cart' }] },
      { name: 'GA4 — remove_from_cart', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'remove_from_cart' }] },
      { name: 'GA4 — view_item', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'view_item' }] },
      { name: 'GA4 — begin_checkout', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'begin_checkout' }] },
      { name: 'GA4 — search', type: 'gaawe', parameter: [{ type: 'template', key: 'measurement_id', value: '{{Constante - GA4 ID}}' }, { type: 'template', key: 'event_name', value: 'search' }] },
      { name: 'Kameleoon', type: 'html', parameter: [{ type: 'template', key: 'html', value: '<script src="https://js.kameleoon.com/kameleoon.js?siteCode=swi005"></script>' }] },
      { name: 'Google Ads Conversion', type: 'awct', parameter: [{ type: 'template', key: 'conversionId', value: 'AW-444444444' }, { type: 'template', key: 'conversionLabel', value: 'jkl012' }] },
      { name: 'Hotjar Tracking', type: 'html', parameter: [{ type: 'template', key: 'html', value: "<!-- Hotjar -->\n<script>(function(h,o,t,j,a,r){h._hjSettings={hjid:3005678};})(window,document);</script>" }] },
    ],
  },
];
