import { useMemo } from 'react';
import type { MonitoringContainerData } from '../../data/monitoring-mock';
import { detectTagCategory } from '../../lib/gtm-matrix';
import { flattenGA4EventParams } from '../../lib/ga4-event-params';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Priority = 'critical' | 'warning' | 'info';
type Platform = 'Google Ads' | 'GA4' | 'Piano' | 'Matomo' | 'Meta Pixel' | 'TikTok' | 'Pinterest' | 'Snapchat' | 'LinkedIn';

interface Recommendation {
  id: string;
  priority: Priority;
  platform: Platform;
  title: string;
  description: string;
  action: string;
  containers: string[];
  docHint?: string;
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<Priority, { bg: string; border: string; color: string; dot: string; label: string }> = {
  critical: { bg: 'hsl(0 85% 97%)',   border: 'hsl(0 70% 85%)',   color: 'hsl(0 65% 40%)',   dot: 'hsl(0 70% 55%)',   label: 'Critique' },
  warning:  { bg: 'hsl(38 100% 97%)', border: 'hsl(38 95% 82%)',  color: 'hsl(35 90% 38%)',  dot: 'hsl(38 95% 52%)',  label: 'Attention' },
  info:     { bg: 'hsl(213 94% 97%)', border: 'hsl(213 94% 82%)', color: 'hsl(213 80% 38%)', dot: 'hsl(213 80% 55%)', label: 'Info' },
};

const PLATFORM_STYLE: Record<Platform, { color: string; bg: string }> = {
  'Google Ads': { color: 'hsl(27 96% 40%)',  bg: 'hsl(27 96% 95%)' },
  'GA4':        { color: 'hsl(213 80% 38%)', bg: 'hsl(213 94% 95%)' },
  'Piano':      { color: 'hsl(267 70% 40%)', bg: 'hsl(267 80% 96%)' },
  'Matomo':     { color: 'hsl(142 50% 28%)', bg: 'hsl(142 50% 95%)' },
  'Meta Pixel': { color: 'hsl(214 89% 40%)', bg: 'hsl(214 89% 95%)' },
  'TikTok':     { color: 'hsl(0 0% 15%)',    bg: 'hsl(0 0% 92%)' },
  'Pinterest':  { color: 'hsl(0 74% 42%)',   bg: 'hsl(0 74% 95%)' },
  'Snapchat':   { color: 'hsl(52 90% 32%)',  bg: 'hsl(54 95% 90%)' },
  'LinkedIn':   { color: 'hsl(201 100% 35%)', bg: 'hsl(201 100% 95%)' },
};

// ─── Rule engine ───────────────────────────────────────────────────────────────

function isPageviewTrigger(c: MonitoringContainerData, triggerId: string): boolean {
  const trigger = c.triggers.find((t) => t.triggerId === triggerId);
  return trigger?.type === 'pageview';
}

function hasUserDataParam(params: import('../../types/gtm').GTMParameter[] | undefined): boolean {
  if (!params) return false;
  return params.some((p) =>
    p.key && (
      p.key.toLowerCase().includes('email') ||
      p.key.toLowerCase().includes('phone') ||
      p.key.toLowerCase().includes('userdata') ||
      p.key.toLowerCase().includes('enhanced')
    )
  );
}

// ── Raw PII detection ──────────────────────────────────────────────────────────
// Google Ads Enhanced Conversions and Meta Advanced Matching/Conversions API both
// expect email/phone either pre-hashed (SHA-256) or as a GTM/Data Layer variable
// reference that a hashing step feeds at runtime. A literal value hardcoded in the
// tag config is neither: it sits in clear text inside the container, readable by
// any GTM editor, regardless of whether the destination platform would have
// auto-hashed it in transit. That hardcoding is the actual, checkable signal here —
// we cannot know from a static scan whether a variable reference resolves to a
// hashed or raw value at runtime.
const EMAIL_RE = /[^\s@'"()]+@[^\s@'"()]+\.[^\s@'"()]{2,}/;
const SHA256_RE = /^[a-f0-9]{64}$/i;
const GTM_VAR_RE = /^\{\{.*\}\}$/;

function isRawPhone(value: string): boolean {
  const v = value.trim();
  const digits = v.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return false;
  if (!/^\+?[\d\s().-]+$/.test(v)) return false;
  return v.startsWith('+') || /[\s().-]/.test(v);
}

function isRawPII(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  if (!v || GTM_VAR_RE.test(v) || SHA256_RE.test(v)) return false;
  return EMAIL_RE.test(v) || isRawPhone(v);
}

// Scans every tag of a given detectTagCategory() bucket for a literal (hardcoded)
// PII value assigned to one of that platform's known user-data parameter keys,
// in either the tag's HTML body or its parameter values. Splits containers into
// "server" (matches serverMarkers — e.g. a Conversions API/Events API/server tag,
// which per that platform's docs has no client-side auto-hash fallback) vs
// "client" (a browser pixel, which usually does auto-hash before transmission).
function scanCategoryForRawPII(
  containers: MonitoringContainerData[],
  category: string,
  keyPattern: RegExp,
  serverMarkers: RegExp
): { server: string[]; client: string[] } {
  const server = new Set<string>();
  const client = new Set<string>();
  for (const c of containers) {
    for (const tag of c.tags) {
      if (detectTagCategory(tag, c.templates) !== category) continue;
      const html = tag.type === 'html' ? (tag.parameter?.find((p) => p.key === 'html')?.value ?? '') : '';
      const paramValues = (tag.parameter ?? []).map((p) => p.value ?? '').join(' ');
      const haystack = `${html} ${paramValues}`;
      const kv = new RegExp(keyPattern.source, 'gi');
      let hasRaw = false;
      let match: RegExpExecArray | null;
      while ((match = kv.exec(haystack))) {
        if (isRawPII(match[2])) { hasRaw = true; break; }
      }
      if (!hasRaw) continue;
      (serverMarkers.test(haystack) ? server : client).add(c.containerName);
    }
  }
  return { server: [...server], client: [...client] };
}

// Conversion Linker isn't always the native "clmb" tag type — it's also commonly hand-built as
// Custom HTML (e.g. named "Google Ads - Conversion Linker"), which the native-type check alone misses.
function isConversionLinkerTag(tag: import('../../types/gtm').GTMTag): boolean {
  if (tag.type === 'clmb' || tag.type === 'gclidw') return true;
  const html = tag.type === 'html' ? (tag.parameter?.find((p) => p.key === 'html')?.value ?? '') : '';
  return /conversion[\s_-]?linker/i.test(`${tag.name} ${html}`);
}

function generateRecommendations(containers: MonitoringContainerData[]): Recommendation[] {
  const recs: Recommendation[] = [];

  // ── Google Ads: Conversion Linker absent ─────────────────────────────────────
  const noLinker = containers.filter((c) => !c.tags.some(isConversionLinkerTag));
  if (noLinker.length > 0) {
    recs.push({
      id: 'gads-no-linker',
      priority: 'critical',
      platform: 'Google Ads',
      title: 'Conversion Linker absent',
      description: 'Sans Conversion Linker, les paramètres gclid ne sont pas persistés entre pages ni entre domaines. Toutes les conversions GA/Ads sont sous-comptées en navigation multi-onglets ou cookieless.',
      action: 'Ajouter le tag "Conversion Linker" (type clmb) avec le déclencheur All Pages, priorité élevée (avant les tags de conversion).',
      containers: noLinker.map((c) => c.containerName),
      docHint: 'Google recommande de placer le Conversion Linker avant tout autre tag Ads sur chaque page.',
    });
  }

  // ── Google Ads: Enhanced Conversions manquantes ───────────────────────────────
  const noEnhanced = containers.filter((c) => {
    const awcts = c.tags.filter((t) => t.type === 'awct');
    return awcts.length > 0 && awcts.every((t) => !hasUserDataParam(t.parameter));
  });
  if (noEnhanced.length > 0) {
    recs.push({
      id: 'gads-no-enhanced',
      priority: 'critical',
      platform: 'Google Ads',
      title: 'Enhanced Conversions non configurées',
      description: 'Les Enhanced Conversions permettent de récupérer en moyenne +15% de conversions via correspondance de données first-party hashées (email, téléphone). Sans elles, les conversions sans cookie (Safari ITP, bloqueurs) sont perdues.',
      action: 'Dans le tag Conversion Tracking (awct), activer Enhanced Conversions et envoyer email/téléphone hashés SHA-256 via une variable Data Layer ou JavaScript.',
      containers: noEnhanced.map((c) => c.containerName),
      docHint: 'Données à hasher côté client ou via GTM : email (lowercase + trim avant SHA-256), phone au format E.164.',
    });
  }

  // ── Google Ads: PII en clair dans le tag Conversion Tracking ─────────────────
  const gadsRawPII: string[] = [];
  for (const c of containers) {
    const awcts = c.tags.filter((t) => t.type === 'awct');
    for (const tag of awcts) {
      const userParams = (tag.parameter ?? []).filter((p) =>
        p.key && /email|phone|first_?name|last_?name|street|city|region|postal|country/i.test(p.key)
      );
      if (userParams.some((p) => isRawPII(p.value))) { gadsRawPII.push(c.containerName); break; }
    }
  }
  if (gadsRawPII.length > 0) {
    recs.push({
      id: 'gads-raw-pii',
      priority: 'critical',
      platform: 'Google Ads',
      title: 'Donnée personnelle en clair dans le tag Conversion Tracking',
      description: 'Une valeur ressemblant à un email ou un téléphone en clair (ni variable, ni hash SHA-256) est codée en dur dans un paramètre Enhanced Conversions. Que Google hashe automatiquement ou non côté transport, cette valeur reste visible en clair pour quiconque a accès au container.',
      action: 'Remplacer la valeur figée par une variable Data Layer, et hasher (SHA-256, email en minuscules + trim, téléphone au format E.164) avant de l\'exposer au tag, ou s\'assurer que "Enhanced conversions" est bien activé si l\'envoi en clair est volontaire.',
      containers: gadsRawPII,
      docHint: 'Google Ads Enhanced Conversions accepte valeur brute (hashée automatiquement par Google) ou pré-hashée — support.google.com/google-ads/answer/9888656.',
    });
  }

  // ── Meta Pixel / CAPI: PII en clair détectée ─────────────────────────────────
  // Auto-hash fallback exists client-side (pixel base code); none server-side (CAPI).
  const meta = scanCategoryForRawPII(
    containers,
    'Meta Pixel',
    /\b(em|ph|fn|ln|external_id|email|phone)\s*[:=]\s*['"]([^'"]+)['"]/g,
    /capi|conversions api|graph\.facebook\.com|access_token/i
  );
  if (meta.server.length > 0) {
    recs.push({
      id: 'meta-capi-raw-pii',
      priority: 'critical',
      platform: 'Meta Pixel',
      title: 'Donnée personnelle en clair envoyée via Meta Conversions API',
      description: 'En Conversions API (server-side), Meta n\'applique aucun hachage automatique : contrairement au pixel navigateur, l\'annonceur doit hasher (SHA-256) email/téléphone/nom lui-même avant l\'envoi. Une valeur en clair détectée dans la configuration du tag part telle quelle vers l\'API Graph.',
      action: 'Hasher côté serveur (SHA-256 ; email en minuscules et sans espaces, téléphone au format E.164) avant de peupler le tag. Ne jamais stocker de PII en clair dans un paramètre GTM.',
      containers: meta.server,
      docHint: 'Meta Conversions API — hachage SHA-256 obligatoire côté annonceur pour em/ph/fn/ln, aucun hachage automatique côté serveur (developers.facebook.com/docs/meta-pixel/advanced/advanced-matching).',
    });
  }
  if (meta.client.length > 0) {
    recs.push({
      id: 'meta-pixel-raw-pii',
      priority: 'warning',
      platform: 'Meta Pixel',
      title: 'Donnée personnelle en clair détectée dans un tag Meta Pixel',
      description: 'Le pixel Meta côté navigateur peut hasher automatiquement les clés d\'Advanced Matching (em, ph, fn, ln) avant l\'envoi, mais une valeur codée en dur dans la configuration du tag reste lisible en clair par tout éditeur du container — un risque de confidentialité indépendant du hachage réseau.',
      action: 'Vérifier que la valeur provient d\'une variable Data Layer alimentée dynamiquement (pas une valeur figée dans le tag) et privilégier un pré-hachage SHA-256 côté site avant transmission.',
      containers: meta.client,
      docHint: 'Meta Advanced Matching — le pixel accepte texte brut (auto-hashé côté client) ou valeurs pré-hashées ; la Conversions API exige toujours un hachage préalable.',
    });
  }

  // ── TikTok Advanced Matching / Events API: PII en clair détectée ─────────────
  // Client-side pixel Advanced Matching can auto-hash; Events API (server) is
  // manual-only — TikTok requires the advertiser to SHA-256 hash before sending.
  const tiktok = scanCategoryForRawPII(
    containers,
    'TikTok',
    /\b(email|phone_number|phone|external_id)\s*[:=]\s*['"]([^'"]+)['"]/g,
    /business-api\.tiktok\.com|events\s*api|access_token/i
  );
  if (tiktok.server.length > 0) {
    recs.push({
      id: 'tiktok-events-api-raw-pii',
      priority: 'critical',
      platform: 'TikTok',
      title: 'Donnée personnelle en clair envoyée via TikTok Events API',
      description: 'TikTok Events API (server-side) exige que email/téléphone/external_id soient hashés SHA-256 par l\'annonceur avant l\'envoi — aucun hachage automatique côté serveur. Une valeur en clair détectée part telle quelle vers TikTok.',
      action: 'Hasher SHA-256 (email en minuscules + trim, téléphone au format E.164) avant de peupler le tag Events API. Ne jamais stocker de PII en clair dans un paramètre GTM.',
      containers: tiktok.server,
      docHint: 'TikTok Events API — hachage SHA-256 obligatoire côté annonceur pour email/phone_number/external_id (ads.tiktok.com/help/article/how-to-set-up-matching-events-with-events-api).',
    });
  }
  if (tiktok.client.length > 0) {
    recs.push({
      id: 'tiktok-pixel-raw-pii',
      priority: 'warning',
      platform: 'TikTok',
      title: 'Donnée personnelle en clair détectée dans un tag TikTok Pixel',
      description: 'Le pixel TikTok (Advanced Matching for Web) peut traiter des valeurs en clair côté navigateur, mais une valeur codée en dur dans la configuration du tag reste lisible par tout éditeur du container.',
      action: 'Vérifier que la valeur provient d\'une variable Data Layer alimentée dynamiquement et privilégier un pré-hachage SHA-256 côté site.',
      containers: tiktok.client,
      docHint: 'TikTok Advanced Matching for Web — ads.tiktok.com/help/article/faqs-for-advanced-matching-for-web.',
    });
  }

  // ── Pinterest Enhanced Match: PII en clair détectée ──────────────────────────
  // JS tag (em param) auto-detects and hashes raw or accepts pre-hashed; the
  // image/server-side tag requires the value to already be hashed before it reaches Pinterest.
  const pinterest = scanCategoryForRawPII(
    containers,
    'Pinterest',
    /\b(em|ph|email)\s*[:=]\s*['"]([^'"]+)['"]/g,
    /ct\.pinterest\.com|conversions?\s*api|server/i
  );
  if (pinterest.server.length > 0) {
    recs.push({
      id: 'pinterest-server-raw-pii',
      priority: 'critical',
      platform: 'Pinterest',
      title: 'Donnée personnelle en clair envoyée via le tag serveur Pinterest',
      description: 'Le tag Pinterest en mode image/serveur exige que l\'email soit déjà hashé (SHA-256) avant transmission — contrairement au tag JavaScript, il n\'y a pas de détection/hachage automatique.',
      action: 'Hasher SHA-256 (email en minuscules, espaces retirés) avant d\'exposer la valeur au tag serveur Pinterest.',
      containers: pinterest.server,
      docHint: 'Pinterest Enhanced Match — developers.pinterest.com/docs/conversions/enhanced-match.',
    });
  }
  if (pinterest.client.length > 0) {
    recs.push({
      id: 'pinterest-tag-raw-pii',
      priority: 'warning',
      platform: 'Pinterest',
      title: 'Donnée personnelle en clair détectée dans un tag Pinterest',
      description: 'Le tag Pinterest JavaScript (em) accepte texte brut ou hashé et détecte/hashe automatiquement côté client, mais une valeur codée en dur dans la configuration du tag reste lisible par tout éditeur du container.',
      action: 'Vérifier que la valeur provient d\'une variable Data Layer alimentée dynamiquement et privilégier un pré-hachage SHA-256 côté site.',
      containers: pinterest.client,
      docHint: 'Pinterest Enhanced Match — help.pinterest.com/en/business/article/enhanced-match.',
    });
  }

  // ── Snapchat Conversions API: PII en clair détectée ──────────────────────────
  // Snapchat's documented workflow always expects an already-normalized, already-hashed
  // identifier (hashed_email / hashed_phone_number) — no client-side auto-hash fallback
  // is documented, so any raw value found is treated as critical regardless of context.
  const snapchat = scanCategoryForRawPII(
    containers,
    'Snapchat',
    /\b(email|hashed_email|phone_number|hashed_phone_number)\s*[:=]\s*['"]([^'"]+)['"]/g,
    /.*/
  );
  const snapchatAll = [...new Set([...snapchat.server, ...snapchat.client])];
  if (snapchatAll.length > 0) {
    recs.push({
      id: 'snapchat-raw-pii',
      priority: 'critical',
      platform: 'Snapchat',
      title: 'Donnée personnelle en clair détectée dans un tag Snapchat',
      description: 'Snapchat attend des identifiants déjà normalisés et hashés SHA-256 (hashed_email, hashed_phone_number) — aucun hachage automatique documenté côté client ou serveur. Une valeur en clair détectée part telle quelle.',
      action: 'Hasher SHA-256 (email en minuscules + trim ; téléphone avec indicatif pays, sans le 0 initial) avant de peupler le tag Snapchat.',
      containers: snapchatAll,
      docHint: 'Snapchat Conversions API — businesshelp.snapchat.com/s/article/identifiers-faq.',
    });
  }

  // ── LinkedIn Conversions API: PII en clair détectée ──────────────────────────
  // LinkedIn auto-hashes clear-text email server-side, so this stays warning-tier —
  // the risk here is the value sitting hardcoded and readable in the container, not the transport.
  const linkedin = scanCategoryForRawPII(
    containers,
    'LinkedIn',
    /\b(email|first_?name|last_?name)\s*[:=]\s*['"]([^'"]+)['"]/g,
    /(?!)/ // never matches "server" bucket — LinkedIn auto-hashes either way, so severity doesn't depend on context
  );
  const linkedinAll = [...new Set([...linkedin.server, ...linkedin.client])];
  if (linkedinAll.length > 0) {
    recs.push({
      id: 'linkedin-raw-pii',
      priority: 'warning',
      platform: 'LinkedIn',
      title: 'Donnée personnelle en clair détectée dans un tag LinkedIn',
      description: 'LinkedIn Conversions API hashe automatiquement un email fourni en clair (SHA-256), donc le transport n\'est pas rompu — mais la valeur reste codée en dur et lisible en clair par tout éditeur du container tant qu\'elle n\'a pas été remplacée par une variable.',
      action: 'Remplacer la valeur figée par une variable Data Layer ; un pré-hachage SHA-256 côté site reste la pratique la plus sûre.',
      containers: linkedinAll,
      docHint: 'LinkedIn Conversions API — learn.microsoft.com/en-us/linkedin/marketing/conversions/conversions-faq.',
    });
  }

  // ── GA4: user-provided data (email/phone) en clair ───────────────────────────
  // gtag.js auto-hashes user-provided data client-side; the risk is the same
  // container-visibility issue as the other platforms, not the transport.
  const ga4RawPII: string[] = [];
  for (const c of containers) {
    const tags = c.tags.filter((t) => t.type === 'gaawc' || t.type === 'gaawe');
    const hasRaw = tags.some((tag) => {
      // gaawc (Config tag) params are flat; gaawe (Event tag) business params are nested in
      // "eventParameters" — flatten() covers both without needing to branch on tag.type here.
      const flat = flattenGA4EventParams(tag);
      return Object.entries(flat).some(([key, value]) => /email|phone/i.test(key) && isRawPII(value));
    });
    if (hasRaw) ga4RawPII.push(c.containerName);
  }
  if (ga4RawPII.length > 0) {
    recs.push({
      id: 'ga4-raw-pii',
      priority: 'warning',
      platform: 'GA4',
      title: 'Donnée personnelle en clair dans le user-provided data GA4',
      description: 'gtag.js hashe automatiquement les données utilisateur (email, téléphone) avant l\'envoi côté client, mais une valeur codée en dur dans le tag GA4 reste lisible en clair par tout éditeur du container.',
      action: 'Remplacer la valeur figée par une variable Data Layer alimentée dynamiquement ; hasher SHA-256 avant transmission reste la meilleure pratique, en particulier si les données transitent aussi par la Measurement Protocol (hachage manuel obligatoire côté serveur).',
      containers: ga4RawPII,
      docHint: 'GA4 User-Provided Data — developers.google.com/analytics/devguides/collection/ga4/uid-data.',
    });
  }

  // ── Google Ads: Remarketing tag absent ───────────────────────────────────────
  // Same caveat as Conversion Linker above — also commonly hand-built as Custom HTML. Requires
  // both "google ads" AND "remarketing" together, so a Meta/TikTok remarketing tag doesn't
  // wrongly count as covering the Google Ads one.
  const isRemarketingTag = (t: import('../../types/gtm').GTMTag) => {
    if (t.type === 'awrk' || t.type === 'sp') return true;
    const html = t.type === 'html' ? (t.parameter?.find((p) => p.key === 'html')?.value ?? '') : '';
    const text = `${t.name} ${html}`;
    return /google[\s_-]?ads/i.test(text) && /remarketing/i.test(text);
  };
  const noRemarketing = containers.filter((c) => !c.tags.some(isRemarketingTag));
  if (noRemarketing.length > 0) {
    recs.push({
      id: 'gads-no-remarketing',
      priority: 'warning',
      platform: 'Google Ads',
      title: 'Tag Remarketing absent',
      description: 'Sans tag Remarketing Google Ads, les listes d\'audiences ne sont pas alimentées. Les campagnes de retargeting et le Smart Bidding basé sur les audiences sont dégradés.',
      action: 'Ajouter le tag "Google Ads Remarketing" (type awrk) sur All Pages. Pour le e-commerce, ajouter les paramètres Dynamic Remarketing : ecomm_prodid, ecomm_pagetype, ecomm_totalvalue.',
      containers: noRemarketing.map((c) => c.containerName),
    });
  }

  // ── Google Ads: Conversion tag sur All Pages ──────────────────────────────────
  const convOnAllPages: string[] = [];
  for (const c of containers) {
    const awcts = c.tags.filter((t) => t.type === 'awct');
    for (const tag of awcts) {
      const firesOnPageview = (tag.firingTriggerId ?? []).some((id) => isPageviewTrigger(c, id));
      if (firesOnPageview) { convOnAllPages.push(c.containerName); break; }
    }
  }
  if (convOnAllPages.length > 0) {
    recs.push({
      id: 'gads-conv-on-pageview',
      priority: 'warning',
      platform: 'Google Ads',
      title: 'Tag Conversion déclenché sur All Pages',
      description: 'Un tag Conversion Tracking est configuré sur un déclencheur de type pageview (All Pages ou equivalent). Cela provoque un double comptage de conversion à chaque visite.',
      action: 'Restreindre le firing du tag Conversion Tracking à un déclencheur événement spécifique (ex : DL - purchase, formulaire soumis).',
      containers: convOnAllPages,
    });
  }

  // ── Google Ads: conversionLabel manquant ──────────────────────────────────────
  const noLabel: string[] = [];
  for (const c of containers) {
    const awcts = c.tags.filter((t) => t.type === 'awct');
    const missing = awcts.filter((t) => !t.parameter?.find((p) => p.key === 'conversionLabel' && p.value));
    if (missing.length > 0) noLabel.push(c.containerName);
  }
  if (noLabel.length > 0) {
    recs.push({
      id: 'gads-no-label',
      priority: 'warning',
      platform: 'Google Ads',
      title: 'conversionLabel manquant sur le tag Conversion',
      description: 'Sans conversionLabel, la conversion remonte dans Google Ads sans pouvoir distinguer le type d\'action (achat, lead, inscription). Le reporting par action de conversion est impossible.',
      action: 'Renseigner le paramètre conversionLabel dans chaque tag awct. La valeur est disponible dans l\'interface Google Ads > Conversions.',
      containers: noLabel,
    });
  }

  // ── Google Ads: conversionId + conversionLabel dupliqué (double comptage) ────
  type ConvKeyEntry = { containerName: string; tagName: string };
  const convKeyMap = new Map<string, ConvKeyEntry[]>();
  for (const c of containers) {
    for (const tag of c.tags) {
      if (tag.type !== 'awct') continue;
      if (tag.paused) continue;
      const id = tag.parameter?.find((p) => p.key === 'conversionId')?.value;
      const label = tag.parameter?.find((p) => p.key === 'conversionLabel')?.value;
      if (!id || !label) continue;
      const key = `${id}::${label}`;
      const list = convKeyMap.get(key) ?? [];
      list.push({ containerName: c.containerName, tagName: tag.name });
      convKeyMap.set(key, list);
    }
  }
  const dupConvSameContainer = new Set<string>();
  const dupConvCrossContainer = new Set<string>();
  for (const entries of convKeyMap.values()) {
    if (entries.length < 2) continue;
    const containerNames = new Set(entries.map((e) => e.containerName));
    if (containerNames.size === 1) {
      dupConvSameContainer.add(entries[0].containerName);
    } else {
      containerNames.forEach((name) => dupConvCrossContainer.add(name));
    }
  }
  if (dupConvSameContainer.size > 0) {
    recs.push({
      id: 'gads-dup-conv-same-container',
      priority: 'critical',
      platform: 'Google Ads',
      title: 'Même conversionId + conversionLabel sur plusieurs tags du même container',
      description: 'Plusieurs tags Conversion Tracking actifs partagent la même paire conversionId/conversionLabel dans le même container. Si leurs déclencheurs peuvent survenir dans le même parcours, la même action de conversion est comptée en double dans Google Ads.',
      action: 'Vérifier que chaque action de conversion Google Ads n\'a qu\'un seul tag actif qui la déclenche, ou rendre les déclencheurs mutuellement exclusifs.',
      containers: [...dupConvSameContainer],
    });
  }
  if (dupConvCrossContainer.size > 0) {
    recs.push({
      id: 'gads-dup-conv-cross-container',
      priority: 'warning',
      platform: 'Google Ads',
      title: 'Même conversionId + conversionLabel partagé entre plusieurs containers',
      description: 'La même paire conversionId/conversionLabel est utilisée par des tags dans des containers différents. Cela peut être volontaire (même compte Ads sur plusieurs domaines), mais mérite une vérification pour écarter un double comptage inter-domaines.',
      action: 'Confirmer que cette action de conversion est bien censée être partagée entre ces containers, sinon utiliser un conversionLabel distinct par container.',
      containers: [...dupConvCrossContainer],
    });
  }

  // ── Meta Pixel: double init du même Pixel ID (double comptage) ──────────────
  const PIXEL_INIT_RE = /fbq\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/g;
  const metaInitByContainer = new Map<string, Map<string, number>>();
  for (const c of containers) {
    for (const tag of c.tags) {
      if (detectTagCategory(tag, c.templates) !== 'Meta Pixel') continue;
      const html = tag.type === 'html' ? (tag.parameter?.find((p) => p.key === 'html')?.value ?? '') : '';
      const paramValues = (tag.parameter ?? []).map((p) => p.value ?? '').join(' ');
      const haystack = `${html} ${paramValues}`;
      PIXEL_INIT_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = PIXEL_INIT_RE.exec(haystack))) {
        const perContainer = metaInitByContainer.get(c.containerName) ?? new Map<string, number>();
        perContainer.set(match[1], (perContainer.get(match[1]) ?? 0) + 1);
        metaInitByContainer.set(c.containerName, perContainer);
      }
    }
  }
  const metaDupInit: string[] = [];
  for (const [containerName, perPixel] of metaInitByContainer) {
    if ([...perPixel.values()].some((count) => count > 1)) metaDupInit.push(containerName);
  }
  if (metaDupInit.length > 0) {
    recs.push({
      id: 'meta-pixel-dup-init',
      priority: 'critical',
      platform: 'Meta Pixel',
      title: 'Même Pixel ID initialisé (fbq init) sur plusieurs tags',
      description: 'Le même Pixel ID Meta est ré-initialisé (fbq(\'init\', ...)) dans plus d\'un tag du même container. Chaque initialisation supplémentaire déclenche un PageView et duplique le comptage de tous les events de base du pixel.',
      action: 'Ne garder qu\'un seul tag "Pixel base code" par Pixel ID et par container. Les autres tags Meta ne doivent contenir que des events (Purchase, Lead, etc.), sans nouvel appel init.',
      containers: metaDupInit,
    });
  }

  // ── Valeur/devise e-commerce codée en dur (justesse de mesure) ──────────────
  const hardcodedValue: string[] = [];
  for (const c of containers) {
    const awcts = c.tags.filter((t) => t.type === 'awct');
    const gaawePurchase = c.tags.filter((t) => t.type === 'gaawe');
    const hasHardcodedAwct = awcts.some((t) => {
      const value = t.parameter?.find((p) => p.key === 'conversionValue')?.value;
      const currency = t.parameter?.find((p) => p.key === 'currencyCode')?.value;
      return (value && !GTM_VAR_RE.test(value.trim())) || (currency && !GTM_VAR_RE.test(currency.trim()));
    });
    const hasHardcodedGa4 = gaawePurchase.some((t) => {
      const flat = flattenGA4EventParams(t);
      const value = flat.value;
      const currency = flat.currency;
      const hasEitherParam = value !== undefined || currency !== undefined;
      if (!hasEitherParam) return false;
      return (value && !GTM_VAR_RE.test(value.trim())) || (currency && !GTM_VAR_RE.test(currency.trim()));
    });
    if (hasHardcodedAwct || hasHardcodedGa4) hardcodedValue.push(c.containerName);
  }
  if (hardcodedValue.length > 0) {
    recs.push({
      id: 'ecom-hardcoded-value',
      priority: 'warning',
      platform: 'Google Ads',
      title: 'Valeur ou devise e-commerce codée en dur',
      description: 'Un tag de conversion (Google Ads Conversion Tracking ou GA4 purchase) envoie une valeur ou une devise fixe au lieu d\'une variable Data Layer. Chaque conversion remonte alors avec la même valeur, faussant le chiffre d\'affaires et le ROAS rapportés.',
      action: 'Remplacer la valeur/devise figée par une variable Data Layer (ex : {{DLV - ecommerce.value}}, {{DLV - ecommerce.currency}}).',
      containers: hardcodedValue,
    });
  }

  // ── GA4: user_id absent sur les events e-commerce ────────────────────────────
  const noUserId: string[] = [];
  for (const c of containers) {
    const ecomEvents = c.tags.filter((t) => t.type === 'gaawe' && ['purchase', 'add_to_cart', 'begin_checkout'].includes(
      t.parameter?.find((p) => p.key === 'event_name' || p.key === 'eventName')?.value ?? ''
    ));
    if (ecomEvents.length > 0 && ecomEvents.some((t) => flattenGA4EventParams(t).user_id === undefined)) {
      noUserId.push(c.containerName);
    }
  }
  if (noUserId.length > 0) {
    recs.push({
      id: 'ga4-no-userid',
      priority: 'info',
      platform: 'GA4',
      title: 'user_id absent sur certains événements e-commerce',
      description: 'Le paramètre user_id manque sur au moins un événement clé (purchase, add_to_cart, begin_checkout). Sans user_id, les rapports "User" de GA4 sont basés uniquement sur client_id (cookie), dégradant la persistance cross-device.',
      action: 'Ajouter le paramètre user_id (valeur hashée ou opaque, jamais d\'identifiant direct) sur tous les événements e-commerce. Source recommandée : variable Data Layer user_id.',
      containers: noUserId,
    });
  }

  // ── GA4: Config tag sans send_page_view désactivé quand événement page_view manuel ──
  const doublePageview: string[] = [];
  for (const c of containers) {
    const hasManualPageView = c.tags.some((t) => t.type === 'gaawe' &&
      t.parameter?.find((p) => p.key === 'event_name' || p.key === 'eventName')?.value === 'page_view'
    );
    if (hasManualPageView) {
      const configTag = c.tags.find((t) => t.type === 'gaawc');
      const sendPageView = configTag?.parameter?.find((p) => p.key === 'sendPageView')?.value;
      if (sendPageView !== 'false') doublePageview.push(c.containerName);
    }
  }
  if (doublePageview.length > 0) {
    recs.push({
      id: 'ga4-double-pageview',
      priority: 'warning',
      platform: 'GA4',
      title: 'Double page_view probable (Config + Event)',
      description: 'Un tag GA4 Event envoie un event page_view manuellement, mais le tag GA4 Config a send_page_view activé (comportement par défaut). Chaque visite génère deux événements page_view dans GA4.',
      action: 'Dans le tag GA4 Configuration (gaawc), désactiver "Envoyer un événement de page vue" (send_page_view: false) pour laisser le contrôle au tag Event.',
      containers: doublePageview,
    });
  }

  // ── GA4: couverture d'events inégale entre containers ────────────────────────
  const ga4EventCounts = containers.map((c) => {
    const names = new Set<string>();
    for (const t of c.tags) {
      if (t.type !== 'gaawe') continue;
      const ev = t.parameter?.find((p) => p.key === 'event_name' || p.key === 'eventName')?.value;
      if (ev) names.add(ev);
    }
    return { name: c.containerName, count: names.size };
  }).filter((x) => x.count > 0);
  const ga4CountSet = new Set(ga4EventCounts.map((x) => x.count));
  if (ga4CountSet.size > 1) {
    const min = Math.min(...ga4EventCounts.map((x) => x.count));
    const max = Math.max(...ga4EventCounts.map((x) => x.count));
    recs.push({
      id: 'ga4-event-coverage-gap',
      priority: 'warning',
      platform: 'GA4',
      title: "Couverture d'events GA4 inégale entre containers",
      description: `Le nombre d'événements GA4 distincts varie entre containers (${min} à ${max} events). Un container qui suit moins d'événements a une visibilité e-commerce/comportementale incomplète par rapport aux autres.`,
      action: 'Comparer la liste des events GA4 par container (onglet Distribution ou Paramètres envoyés) et aligner les containers en retard sur le set complet.',
      containers: ga4EventCounts.map((x) => x.name),
    });
  }

  // ── Piano: tag présent mais sans siteId détectable ───────────────────────────
  const pianoNoId: string[] = [];
  for (const c of containers) {
    const pianoTags = c.tags.filter((t) => t.type === 'html' && (() => {
      const html = (t.parameter?.find((p) => p.key === 'html')?.value ?? '').toLowerCase();
      return html.includes('piano') || html.includes('at internet') || html.includes('smarttag') || html.includes('pa.setconfigurations');
    })());
    if (pianoTags.length > 0) {
      const hasId = pianoTags.some((t) => {
        const html = t.parameter?.find((p) => p.key === 'html')?.value ?? '';
        return /siteId\s*[:=]\s*['"]?(\d+)/i.test(html) || /site\s*[:=]\s*['"]?([^"',;\s]+)/i.test(html);
      });
      if (!hasId) pianoNoId.push(c.containerName);
    }
  }
  if (pianoNoId.length > 0) {
    recs.push({
      id: 'piano-no-siteid',
      priority: 'warning',
      platform: 'Piano',
      title: 'Piano Analytics : siteId non détecté',
      description: 'Un tag Piano Analytics est présent mais le siteId n\'a pas pu être détecté dans le code HTML. Sans siteId valide, les données ne sont pas envoyées à la bonne propriété Piano.',
      action: 'Vérifier que le siteId est correctement défini dans le tag HTML Piano (pa.setConfigurations({ site: XXXXXX })).',
      containers: pianoNoId,
    });
  }

  // ── Matomo: tag présent mais sans siteId détectable ──────────────────────────
  const matomoNoId: string[] = [];
  for (const c of containers) {
    const matomoTags = c.tags.filter((t) => t.type === 'html' && (() => {
      const html = (t.parameter?.find((p) => p.key === 'html')?.value ?? '').toLowerCase();
      return html.includes('matomo') || html.includes('_paq');
    })());
    if (matomoTags.length > 0) {
      const hasId = matomoTags.some((t) => {
        const html = t.parameter?.find((p) => p.key === 'html')?.value ?? '';
        return /setSiteId['"]\s*,\s*['"]?(\d+)/i.test(html);
      });
      if (!hasId) matomoNoId.push(c.containerName);
    }
  }
  if (matomoNoId.length > 0) {
    recs.push({
      id: 'matomo-no-siteid',
      priority: 'warning',
      platform: 'Matomo',
      title: 'Matomo : setSiteId non détecté',
      description: 'Un tag Matomo est présent mais setSiteId n\'a pas pu être extrait. Sans siteId, les données remontent dans le mauvais site Matomo ou pas du tout.',
      action: 'S\'assurer que _paq.push([\'setSiteId\', \'X\']) est présent avec le bon identifiant numérique de site.',
      containers: matomoNoId,
    });
  }

  return recs;
}

// ─── Count helper (exported for MonitoringPage badge) ─────────────────────────

export function countCriticalRecommendations(containers: MonitoringContainerData[]): number {
  return generateRecommendations(containers).filter((r) => r.priority === 'critical').length;
}

// ─── Card component ────────────────────────────────────────────────────────────

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const ps = PRIORITY_STYLE[rec.priority];
  const plt = PLATFORM_STYLE[rec.platform];

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ backgroundColor: ps.bg, borderColor: ps.border }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ps.dot }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{ backgroundColor: plt.bg, color: plt.color }}
            >
              {rec.platform}
            </span>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{ backgroundColor: ps.border + '55', color: ps.color }}
            >
              {ps.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold leading-snug" style={{ color: ps.color }}>{rec.title}</h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed pl-5" style={{ color: 'hsl(220 13% 30%)' }}>
        {rec.description}
      </p>

      {/* Action */}
      <div className="pl-5 flex items-start gap-2">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 mt-0.5" style={{ color: ps.color }}>
          <path d="M6 1v7M3 5.5L6 8l3-2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 11h8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
        <p className="text-xs font-medium leading-relaxed" style={{ color: 'hsl(220 13% 20%)' }}>
          {rec.action}
        </p>
      </div>

      {/* Doc hint */}
      {rec.docHint && (
        <div
          className="pl-5 text-[11px] leading-relaxed italic"
          style={{ color: 'hsl(220 13% 50%)' }}
        >
          {rec.docHint}
        </div>
      )}

      {/* Affected containers */}
      <div className="pl-5 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-muted-fg">Containers :</span>
        {rec.containers.map((name) => (
          <span
            key={name}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 35%)' }}
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function RecommendationsTab({ containers }: { containers: MonitoringContainerData[] }) {
  const recs = useMemo(() => generateRecommendations(containers), [containers]);

  const critical = recs.filter((r) => r.priority === 'critical');
  const warnings = recs.filter((r) => r.priority === 'warning');
  const infos    = recs.filter((r) => r.priority === 'info');

  if (recs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-fg">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="16" stroke="currentColor" strokeWidth="1.5" opacity=".3"/>
          <path d="M11 18l5 5 9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".6"/>
        </svg>
        <p className="text-sm font-medium">Aucune recommandation — configuration optimale</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary bar */}
      <div
        className="px-6 py-3 border-b shrink-0 flex items-center gap-4"
        style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)' }}
      >
        {critical.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'hsl(0 65% 40%)' }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(0 70% 55%)' }} />
            {critical.length} critique{critical.length > 1 ? 's' : ''}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'hsl(35 90% 38%)' }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(38 95% 52%)' }} />
            {warnings.length} attention{warnings.length > 1 ? 's' : ''}
          </div>
        )}
        {infos.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'hsl(213 80% 38%)' }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(213 80% 55%)' }} />
            {infos.length} info{infos.length > 1 ? 's' : ''}
          </div>
        )}
        <div className="flex-1" />
        <span className="text-[10px] text-muted-fg">Basé sur les données scannées · règles Google Ads, GA4, Piano, Matomo</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
        {critical.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'hsl(0 65% 50%)' }}>
              Critique — action immédiate
            </h2>
            {critical.map((r) => <RecommendationCard key={r.id} rec={r} />)}
          </section>
        )}
        {warnings.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'hsl(35 90% 45%)' }}>
              Attention — à corriger prochainement
            </h2>
            {warnings.map((r) => <RecommendationCard key={r.id} rec={r} />)}
          </section>
        )}
        {infos.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'hsl(213 80% 45%)' }}>
              Info — optimisations possibles
            </h2>
            {infos.map((r) => <RecommendationCard key={r.id} rec={r} />)}
          </section>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-6 py-2.5 border-t flex items-center gap-2 shrink-0 text-xs"
        style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)', color: 'hsl(220 13% 50%)' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/>
          <path d="M6 4v2.5M6 8v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
        Analyse statique · ne remplace pas un audit manuel · données simulées en mode aperçu
      </div>
    </div>
  );
}
