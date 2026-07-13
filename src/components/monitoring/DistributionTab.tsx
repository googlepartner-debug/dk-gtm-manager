import { useMemo, useState } from 'react';
import type { MonitoringContainerData } from '../../data/monitoring-mock';
import type { GTMTag, GTMVariable, GTMCustomTemplate, GTMGtagConfig } from '../../types/gtm';
import { TagTypeIcon } from './TagTypeIcon';
import { detectTagCategory } from '../../lib/gtm-matrix';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Platform = 'GA4' | 'Piano' | 'Matomo' | 'Google Ads' | 'Floodlight' | 'Kameleoon' | 'AB Tasty' | 'Meta Pixel' | 'TikTok' | 'Hotjar' | 'Criteo' | 'LinkedIn' | 'Pinterest' | 'Snapchat' | 'Microsoft Ads' | 'Microsoft Clarity' | 'CMP' | 'Custom';

interface Destination {
  id: string;
  measurementId: string;
  isVariable: boolean;
  variableName?: string;
  variableType?: string;
  fromLT?: boolean;
  ltVariableName?: string;
  resolvedValue?: string; // the actual pixel/conversion ID, when isVariable points to a simple Constant variable
}

interface ChildItem {
  label: string;
  sourceTagName?: string;
}

interface ConfigNode {
  id: string;
  tagName: string;
  tagType: string;
  platform: Platform;
  destinations: Destination[];
  isMultiProperty?: boolean;
  children: ChildItem[]; // expandable detail — GA4 events, Meta/TikTok standard events, or underlying tag names
}

interface ContainerFlow {
  containerId: string;
  containerName: string;
  publicId: string;
  configs: ConfigNode[];
}

// ─── Platform style ────────────────────────────────────────────────────────────

const PLATFORM_STYLE: Record<Platform, { bg: string; border: string; color: string; accent: string }> = {
  'GA4':        { bg: 'hsl(213 94% 97%)', border: 'hsl(213 94% 78%)', color: 'hsl(213 94% 35%)', accent: 'hsl(213 94% 60%)' },
  'Piano':      { bg: 'hsl(267 80% 97%)', border: 'hsl(267 80% 78%)', color: 'hsl(267 80% 40%)', accent: 'hsl(267 80% 55%)' },
  'Matomo':     { bg: 'hsl(142 50% 96%)', border: 'hsl(142 50% 72%)', color: 'hsl(142 50% 28%)', accent: 'hsl(142 50% 45%)' },
  'Google Ads': { bg: 'hsl(27 96% 97%)', border: 'hsl(27 96% 75%)', color: 'hsl(27 96% 35%)', accent: 'hsl(27 96% 55%)' },
  'Floodlight': { bg: 'hsl(36 100% 96%)', border: 'hsl(36 100% 72%)', color: 'hsl(36 100% 30%)', accent: 'hsl(36 100% 48%)' },
  'Kameleoon':  { bg: 'hsl(267 50% 97%)', border: 'hsl(267 50% 78%)', color: 'hsl(267 50% 35%)', accent: 'hsl(267 50% 55%)' },
  'AB Tasty':   { bg: 'hsl(340 80% 97%)', border: 'hsl(340 80% 78%)', color: 'hsl(340 80% 38%)', accent: 'hsl(340 80% 55%)' },
  'Meta Pixel': { bg: 'hsl(221 80% 97%)', border: 'hsl(221 80% 78%)', color: 'hsl(221 80% 38%)', accent: 'hsl(221 80% 55%)' },
  'TikTok':     { bg: 'hsl(180 50% 96%)', border: 'hsl(180 50% 72%)', color: 'hsl(180 60% 25%)', accent: 'hsl(180 60% 40%)' },
  'Hotjar':     { bg: 'hsl(17 90% 97%)', border: 'hsl(17 90% 75%)', color: 'hsl(17 90% 35%)', accent: 'hsl(17 90% 55%)' },
  'Criteo':     { bg: 'hsl(28 90% 97%)', border: 'hsl(28 90% 75%)', color: 'hsl(28 90% 35%)', accent: 'hsl(28 90% 52%)' },
  'LinkedIn':   { bg: 'hsl(201 100% 97%)', border: 'hsl(201 100% 75%)', color: 'hsl(201 100% 32%)', accent: 'hsl(201 100% 48%)' },
  'Pinterest':  { bg: 'hsl(0 74% 97%)', border: 'hsl(0 74% 78%)', color: 'hsl(0 74% 38%)', accent: 'hsl(0 74% 55%)' },
  'Snapchat':   { bg: 'hsl(54 95% 95%)', border: 'hsl(52 90% 65%)', color: 'hsl(52 90% 28%)', accent: 'hsl(52 90% 45%)' },
  'Microsoft Ads':     { bg: 'hsl(207 45% 96%)', border: 'hsl(207 45% 72%)', color: 'hsl(207 55% 32%)', accent: 'hsl(207 55% 48%)' },
  'Microsoft Clarity': { bg: 'hsl(213 35% 95%)', border: 'hsl(213 35% 72%)', color: 'hsl(213 45% 28%)', accent: 'hsl(213 45% 42%)' },
  'CMP':        { bg: 'hsl(160 45% 95%)', border: 'hsl(160 45% 70%)', color: 'hsl(160 55% 25%)', accent: 'hsl(160 55% 40%)' },
  'Custom':     { bg: 'hsl(220 13% 96%)', border: 'hsl(220 13% 78%)', color: 'hsl(220 13% 38%)', accent: 'hsl(220 13% 55%)' },
};

const PLATFORM_ICON_CAT: Record<Platform, string> = {
  'GA4': 'GA4', 'Piano': 'Piano', 'Matomo': 'Matomo',
  'Google Ads': 'Google Ads', 'Floodlight': 'Floodlight',
  'Kameleoon': 'Kameleoon', 'AB Tasty': 'AB Tasty', 'Meta Pixel': 'Meta Pixel',
  'TikTok': 'TikTok', 'Hotjar': 'Hotjar', 'Criteo': 'Criteo',
  'LinkedIn': 'LinkedIn', 'Pinterest': 'Pinterest', 'Snapchat': 'Snapchat',
  'Microsoft Ads': 'Microsoft Ads', 'Microsoft Clarity': 'Microsoft Clarity', 'CMP': 'CMP', 'Custom': 'HTML Custom',
};

// Fixed display order for grouping same-platform nodes together, consistent across every
// container so containers can be visually compared node-by-node.
const PLATFORM_ORDER: Platform[] = [
  'GA4', 'Google Ads', 'Floodlight', 'Meta Pixel', 'TikTok', 'LinkedIn', 'Pinterest', 'Snapchat',
  'Microsoft Ads', 'Piano', 'Matomo', 'Kameleoon', 'AB Tasty', 'Criteo', 'Hotjar', 'Microsoft Clarity',
  'CMP', 'Custom',
];

// ─── Detection helpers ─────────────────────────────────────────────────────────

function isVarRef(v: string) { return /^\{\{.+\}\}$/.test(v.trim()); }
function varName(v: string) { return v.trim().replace(/^\{\{|\}\}$/g, ''); }

// The same Google Ads account ID gets entered/stored as either bare digits ("1059038729") or the
// full "AW-1059038729" form depending on how the tag was configured — normalizing to the "AW-"
// form so both cases are recognized as the same destination instead of two different ones.
function normalizeGoogleAdsId(id: string): string {
  const trimmed = id.trim();
  if (/^\d+$/.test(trimmed)) return `AW-${trimmed}`;
  return trimmed.toUpperCase();
}

// Most Pixel/Conversion IDs are referenced through a Constant variable rather than hardcoded —
// resolving it shows the real ID (e.g. "AW-123456789") instead of just the variable's name.
function resolveConstant(vDef: GTMVariable | undefined): string | undefined {
  if (vDef?.type !== 'c') return undefined;
  return vDef.parameter?.find((p) => p.key === 'value')?.value;
}

// The Google tag config resource's parameter key naming isn't documented — scan every value
// (recursively, same helper as Community Templates) rather than guessing a specific key name.
function findGtagConfigId(gtagConfigs: GTMGtagConfig[] | undefined, pattern: RegExp): string {
  for (const gc of gtagConfigs ?? []) {
    const m = collectAllParamValues(gc.parameter).match(pattern);
    if (m) return m[1] ?? '';
  }
  return '';
}

function resolveLTValues(variable: GTMVariable): string[] {
  const mapParam = variable.parameter?.find((p) => p.key === 'map' && p.type === 'list');
  if (!mapParam?.list) return [];
  return mapParam.list
    .map((item) => item.map?.find((m) => m.key === 'value')?.value)
    .filter((v): v is string => !!v);
}

// Extracts standard/custom event names fired inside a tag's HTML, when the platform's SDK
// exposes them as a discrete tracking call (fbq('track', 'Purchase', ...), ttq.track('X'), ...).
function detectHtmlEvents(platform: Platform, html: string): string[] {
  const names = new Set<string>();
  if (platform === 'Meta Pixel') {
    for (const m of html.matchAll(/fbq\s*\(\s*['"](?:track|trackCustom)['"]\s*,\s*['"]([^'"]+)['"]/gi)) names.add(m[1]);
  } else if (platform === 'TikTok') {
    for (const m of html.matchAll(/ttq\.track\s*\(\s*['"]([^'"]+)['"]/gi)) names.add(m[1]);
  } else if (platform === 'Criteo') {
    for (const m of html.matchAll(/event\s*[:=]\s*['"]([^'"]+)['"]/gi)) names.add(m[1]);
  }
  return [...names];
}

// A Custom/Community Template tag (type "cvt_...") has no HTML body at all — its Pixel/Conversion
// ID lives in one of the template's own custom fields instead, whose key name varies per template
// author. Recursively collecting every parameter value (flat, and nested inside list/map) gives
// the destId regexes below a chance to find it regardless of which field it's actually stored under.
function collectAllParamValues(params: import('../../types/gtm').GTMParameter[] | undefined): string {
  if (!params) return '';
  let out = '';
  for (const p of params) {
    if (p.value) out += ` ${p.value}`;
    if (p.list) out += ` ${collectAllParamValues(p.list)}`;
    if (p.map) out += ` ${collectAllParamValues(p.map)}`;
  }
  return out;
}

// Community Template tags (type "cvt_...") have no HTML body, so the syntax-based regexes below
// (which look for code markers like "fbq(" or "ti:") never match — the ID sits in a field the
// template author named however they liked ("Microsoft Advertising UET Tag ID", "Pixel ID"...).
// Rather than guess every possible field key, search by the KEY itself: any parameter whose key
// contains "id" is a strong candidate, preferring the most ID-specific names first. Skips known
// non-destination "id" fields (event IDs, external IDs used for PII matching, etc).
const ID_KEY_PRIORITY = [/tag[\s_-]?id/i, /pixel[\s_-]?id/i, /conversion[\s_-]?id/i, /account[\s_-]?id/i, /advertiser[\s_-]?id/i, /property[\s_-]?id/i, /site[\s_-]?id/i, /\bid\b/i];
const ID_KEY_EXCLUDE = /event[\s_-]?id|external[\s_-]?id|user[\s_-]?id|transaction[\s_-]?id|client[\s_-]?id|session[\s_-]?id/i;

function findIdLikeParamValue(params: import('../../types/gtm').GTMParameter[] | undefined): string {
  if (!params) return '';
  const candidates: { key: string; value: string }[] = [];
  const walk = (list: import('../../types/gtm').GTMParameter[]) => {
    for (const p of list) {
      if (p.key && p.value && !ID_KEY_EXCLUDE.test(p.key) && /id/i.test(p.key)) candidates.push({ key: p.key, value: p.value });
      if (p.list) walk(p.list);
      if (p.map) walk(p.map);
    }
  };
  walk(params);
  for (const pattern of ID_KEY_PRIORITY) {
    const hit = candidates.find((c) => pattern.test(c.key));
    if (hit) return hit.value;
  }
  return '';
}

// Categories from the shared detectTagCategory() that don't have a dedicated node type here.
const UNMAPPED_CATEGORY: Platform = 'Custom';

function mapCategoryToPlatform(category: string): Platform {
  const known: Platform[] = ['GA4', 'Piano', 'Matomo', 'Google Ads', 'Floodlight', 'Kameleoon', 'AB Tasty', 'Meta Pixel', 'TikTok', 'Hotjar', 'Criteo', 'LinkedIn', 'Pinterest', 'Snapchat', 'Microsoft Ads', 'Microsoft Clarity', 'CMP'];
  return (known as string[]).includes(category) ? (category as Platform) : UNMAPPED_CATEGORY;
}

// Category (platform) comes from the shared detectTagCategory() — same source of truth used by
// Monitoring/Recommandations, template-aware — so this stays consistent instead of drifting with
// its own separate keyword list. Only the destination ID extraction (pixel ID, site ID…) is local,
// since that's presentation detail specific to this tab.
// The ID passed to an SDK init call (fbq('init', 'XXXX'), ttq.load('XXXX')...) is very often a
// GTM variable reference rather than a literal — {{Meta - ID}}, {{Pixel FB}}, {{whatever the
// consultant named it}} — the variable's own name is never predictable. Every capture group below
// accepts either the literal pattern OR a bare "{{...}}" reference; the caller then resolves a
// captured reference against the container's variables (Constant type) to get the real value.
const VAR_REF = '\\{\\{[^}]+\\}\\}';

function detectHtmlPlatform(tag: GTMTag, templates: GTMCustomTemplate[] | undefined, htmlBody: string): { platform: Platform; destId: string } {
  const category = detectTagCategory(tag, templates);
  const platform = mapCategoryToPlatform(category);
  // Search the tag's HTML body (Custom HTML tags) AND every other parameter value (Community
  // Template tags, which have no HTML body but expose the ID via their own custom field).
  const html = `${htmlBody} ${collectAllParamValues(tag.parameter)}`;

  switch (platform) {
    case 'Google Ads': {
      const m = html.match(new RegExp(`\\b(aw-\\d{6,}|${VAR_REF})\\b`, 'i'));
      const id = m?.[1] ?? '';
      return { platform, destId: id.startsWith('{{') ? id : id.toUpperCase() };
    }
    case 'GA4': {
      const m = html.match(new RegExp(`\\b(g-[a-z0-9]{6,}|${VAR_REF})\\b`, 'i'));
      const id = m?.[1] ?? '';
      return { platform, destId: id.startsWith('{{') ? id : id.toUpperCase() };
    }
    case 'Piano': {
      const m = html.match(new RegExp(`setSiteId['"]\\s*,\\s*['"]?(\\d+|${VAR_REF})`, 'i')) ||
                html.match(new RegExp(`siteId\\s*[:=]\\s*['"]?(\\d+|${VAR_REF})`, 'i')) ||
                html.match(/(?:site|sfCode)\s*[=:]\s*["']?([^"',;\s]+)/i);
      return { platform, destId: m?.[1] ?? '' };
    }
    case 'Matomo': {
      const m = html.match(new RegExp(`setSiteId['"]\\s*,\\s*['"]?(\\d+|${VAR_REF})`, 'i')) ||
                html.match(new RegExp(`siteId\\s*[:=]\\s*['"]?(\\d+|${VAR_REF})`, 'i'));
      return { platform, destId: m?.[1] ?? '' };
    }
    case 'Kameleoon': {
      const m = html.match(new RegExp(`siteCode[:\\s"'=]+([a-z0-9_-]{4,}|${VAR_REF})`, 'i')) ||
                html.match(/kameleoon[^/]*\/([a-z0-9_-]+)\.js/i);
      return { platform, destId: m?.[1] ?? '' };
    }
    case 'AB Tasty': {
      const m = html.match(/abtasty\.com\/users\/([a-z0-9]+)\.js/i);
      return { platform, destId: m?.[1] ?? '' };
    }
    case 'Meta Pixel': {
      const m = html.match(new RegExp(`fbq\\s*\\(\\s*['"]init['"]\\s*,\\s*['"](\\d+|${VAR_REF})['"]`, 'i'));
      return { platform, destId: m?.[1] ?? '' };
    }
    case 'TikTok': {
      const m = html.match(new RegExp(`ttq\\.load\\s*\\(\\s*['"]([A-Z0-9]+|${VAR_REF})['"]`, 'i'));
      return { platform, destId: m?.[1] ?? '' };
    }
    case 'Hotjar': {
      const m = html.match(new RegExp(`hjid[:\\s,]*(\\d+|${VAR_REF})`, 'i'));
      return { platform, destId: m?.[1] ?? '' };
    }
    case 'Criteo': {
      const m = html.match(new RegExp(`['"](a|account)['"]\\s*,\\s*(\\d+|${VAR_REF})`, 'i')) ||
                html.match(/criteo[^"']*["']([0-9]+)["']/i);
      return { platform, destId: m?.[2] ?? m?.[1] ?? '' };
    }
    case 'LinkedIn': {
      const m = html.match(new RegExp(`_linkedin_partner_id\\s*=\\s*["'](\\d+|${VAR_REF})["']`, 'i'));
      return { platform, destId: m?.[1] ?? '' };
    }
    case 'Pinterest': {
      const m = html.match(new RegExp(`pintrk\\s*\\(\\s*['"]load['"]\\s*,\\s*['"]([a-z0-9-]+|${VAR_REF})['"]`, 'i'));
      return { platform, destId: m?.[1] ?? '' };
    }
    case 'Snapchat': {
      const m = html.match(new RegExp(`snaptr\\s*\\(\\s*['"]init['"]\\s*,\\s*['"]([a-z0-9-]+|${VAR_REF})['"]`, 'i'));
      return { platform, destId: m?.[1] ?? '' };
    }
    case 'Microsoft Ads': {
      const m = html.match(new RegExp(`bat\\.bing\\.com/bat\\.js\\?ti=(\\d+)`, 'i')) ||
                html.match(new RegExp(`\\bti\\s*[:=]\\s*['"]?(\\d+|${VAR_REF})['"]?`, 'i'));
      return { platform, destId: m?.[1] ?? '' };
    }
    case 'Microsoft Clarity': {
      const m = html.match(/clarity\.ms\/tag\/([a-z0-9]+)/i) ||
                html.match(new RegExp(`["']script["']\\s*,\\s*["']([a-z0-9]+|${VAR_REF})["']`, 'i'));
      return { platform, destId: m?.[1] ?? '' };
    }
    case 'CMP':
      // No universal ID pattern across CMP vendors — shown without a destination ID.
      return { platform, destId: '' };
    default:
      return { platform: UNMAPPED_CATEGORY, destId: '' };
  }
}

// Key used to group config nodes that belong to the same real-world destination
// (e.g. three separate "Meta Pixel — Base/Purchase/AddToCart" tags sharing one pixel ID).
// Platforms whose SDK is a single global instance per container (fbq/ttq/pintrk/snaptr, the
// LinkedIn Insight Tag): once the init call runs, every other tag of that platform just fires an
// event against that same instance — it doesn't carry (and doesn't need) its own copy of the ID.
// Grouping strictly by platform (ignoring per-tag destination) keeps them as one node instead of
// splitting into the init tag's node plus a spurious "no destination" node for the event tags.
const SINGLE_INSTANCE_PLATFORMS = new Set<Platform>(['Meta Pixel', 'TikTok', 'Pinterest', 'Snapchat', 'LinkedIn', 'Microsoft Ads', 'Microsoft Clarity']);

function destGroupKey(platform: Platform, destinations: Destination[]): string {
  if (SINGLE_INSTANCE_PLATFORMS.has(platform)) return platform;
  const primary = destinations[0];
  if (!primary) return `${platform}::__none__`;
  // Group by the resolved literal value when known, not the variable name — two tags referencing
  // different Constant variables that both resolve to the same real ID are the same destination.
  if (primary.isVariable) return `${platform}::${primary.resolvedValue ?? `var:${primary.variableName}`}`;
  return `${platform}::${primary.measurementId}`;
}

function buildContainerFlow(c: MonitoringContainerData): ContainerFlow {
  const varMap = new Map(c.variables.map((v) => [v.name, v]));
  const ga4EventNames = [...new Set(
    c.tags.filter((t) => t.type === 'gaawe')
      .map((t) => t.parameter?.find((p) => p.key === 'event_name' || p.key === 'eventName')?.value)
      .filter((v): v is string => !!v),
  )];

  const rawConfigs: ConfigNode[] = [];
  let idx = 0;
  const makeId = () => `${c.containerId}-cfg-${idx++}`;
  const makeDestId = () => `d-${idx++}`;

  for (const tag of c.tags) {
    if (tag.type === 'gaawe') continue; // folded into the GA4 config node's children below
    // Google Consent Mode signal tags (gtag('consent', 'default'/'update', ...)) don't send
    // anything to a destination themselves — they just configure existing GA4/Ads tags locally.
    // Not a data flow, so no node for them here (unlike CMP vendor script tags, which are real).
    if (detectTagCategory(tag, c.templates) === 'Consent Mode') continue;

    if (tag.type === 'gaawc') {
      // When the tag has no explicit measurementId, it's using the newer "Google tag" auto-detect
      // mode (GTM UI shows "This tag will use the configuration of Google tag X") — the real
      // G-XXXXXXX lives in a separate gtag_config API resource instead of on this tag at all.
      const ownRaw = tag.parameter?.find((p) => p.key === 'measurementId')?.value ?? '';
      const raw = ownRaw || findGtagConfigId(c.gtagConfigs, /\b(g-[a-z0-9]{6,})\b/i);
      const isVar = isVarRef(raw);
      const vn = isVar ? varName(raw) : undefined;
      const vDef = vn ? varMap.get(vn) : undefined;
      let destinations: Destination[];
      if (vDef?.type === 'smm') {
        const ltValues = resolveLTValues(vDef);
        destinations = ltValues.length > 0
          ? ltValues.map((val) => ({ id: makeDestId(), measurementId: val, isVariable: false, fromLT: true, ltVariableName: vn }))
          : [{ id: makeDestId(), measurementId: raw, isVariable: true, variableName: vn, variableType: 'smm' }];
      } else {
        destinations = raw ? [{ id: makeDestId(), measurementId: raw, isVariable: isVar, variableName: vn, variableType: vDef?.type, resolvedValue: resolveConstant(vDef) }] : [];
      }
      rawConfigs.push({
        id: makeId(), tagName: tag.name, tagType: tag.type, platform: 'GA4',
        destinations, isMultiProperty: vDef?.type === 'smm' && destinations.length > 1,
        children: ga4EventNames.map((name) => ({ label: name })),
      });
    } else if (tag.type === 'googtag') {
      // The unified "Google tag" (replaced the classic gaawc GA4 Configuration tag from GTM's
      // Sept. 2023 update onward) — one tag type covers GA4, Google Ads, or other destinations;
      // which one depends entirely on the resolved ID's own prefix, not the tag type.
      const raw = tag.parameter?.find((p) => p.key === 'tagId')?.value ?? '';
      const isVar = isVarRef(raw);
      const vn = isVar ? varName(raw) : undefined;
      const vDef = vn ? varMap.get(vn) : undefined;
      const resolved = resolveConstant(vDef);
      const effective = (isVar ? resolved : raw) ?? '';
      const platform: Platform = /^aw-/i.test(effective) ? 'Google Ads' : 'GA4';
      const normalize = (v: string) => (platform === 'Google Ads' ? normalizeGoogleAdsId(v) : v.toUpperCase());
      rawConfigs.push({
        id: makeId(), tagName: tag.name, tagType: tag.type, platform,
        destinations: raw ? [{ id: makeDestId(), measurementId: isVar ? raw : normalize(raw), isVariable: isVar, variableName: vn, resolvedValue: resolved ? normalize(resolved) : undefined }] : [],
        children: platform === 'GA4' ? ga4EventNames.map((name) => ({ label: name })) : [],
      });
    } else if (tag.type === 'awct') {
      const raw = tag.parameter?.find((p) => p.key === 'conversionId')?.value ?? '';
      const isVar = isVarRef(raw);
      const vn = isVar ? varName(raw) : undefined;
      const vDef = vn ? varMap.get(vn) : undefined;
      const resolved = resolveConstant(vDef);
      rawConfigs.push({
        id: makeId(), tagName: tag.name, tagType: tag.type, platform: 'Google Ads',
        destinations: raw ? [{ id: makeDestId(), measurementId: isVar ? raw : normalizeGoogleAdsId(raw), isVariable: isVar, variableName: vn, resolvedValue: resolved ? normalizeGoogleAdsId(resolved) : undefined }] : [],
        children: [],
      });
    } else if (tag.type === 'awrk' || tag.type === 'sp') {
      // 'sp' is the real native type for Google Ads Remarketing on this account (confirmed
      // against live scan data) — 'awrk' kept too in case other accounts still use it.
      const raw = tag.parameter?.find((p) => p.key === 'conversionId')?.value ?? '';
      const isVar = isVarRef(raw);
      const vn = isVar ? varName(raw) : undefined;
      const vDef = vn ? varMap.get(vn) : undefined;
      const resolved = resolveConstant(vDef);
      rawConfigs.push({
        id: makeId(), tagName: tag.name, tagType: tag.type, platform: 'Google Ads',
        destinations: raw ? [{ id: makeDestId(), measurementId: isVar ? raw : normalizeGoogleAdsId(raw), isVariable: isVar, variableName: vn, resolvedValue: resolved ? normalizeGoogleAdsId(resolved) : undefined }] : [],
        children: [{ label: 'Remarketing' }],
      });
    } else if (tag.type === 'clmb' || tag.type === 'gclidw') {
      // 'gclidw' is the real native type for Conversion Linker on this account.
      rawConfigs.push({
        id: makeId(), tagName: tag.name, tagType: tag.type, platform: 'Google Ads',
        destinations: [],
        children: [{ label: 'Conversion Linker' }],
      });
    } else if (tag.type === 'flc') {
      const raw = tag.parameter?.find((p) => p.key === 'dcmFloodlightConfigId')?.value ?? '';
      const isVar = isVarRef(raw);
      const vn = isVar ? varName(raw) : undefined;
      const vDef = vn ? varMap.get(vn) : undefined;
      rawConfigs.push({
        id: makeId(), tagName: tag.name, tagType: tag.type, platform: 'Floodlight',
        destinations: raw ? [{ id: makeDestId(), measurementId: raw, isVariable: isVar, variableName: vn, resolvedValue: resolveConstant(vDef) }] : [],
        children: [],
      });
    } else if (tag.type === 'baut') {
      // Native Microsoft Advertising (Bing Ads) Universal Event Tracking tag type.
      const raw = tag.parameter?.find((p) => p.key === 'tagId')?.value ?? '';
      const isVar = isVarRef(raw);
      const vn = isVar ? varName(raw) : undefined;
      const vDef = vn ? varMap.get(vn) : undefined;
      rawConfigs.push({
        id: makeId(), tagName: tag.name, tagType: tag.type, platform: 'Microsoft Ads',
        destinations: raw ? [{ id: makeDestId(), measurementId: raw, isVariable: isVar, variableName: vn, resolvedValue: resolveConstant(vDef) }] : [],
        children: [],
      });
    } else {
      // Everything else: Custom HTML tags, and Custom/Community Template tags (type "cvt_...")
      // which have no HTML body at all — the template's own name/gallery reference is what
      // detectTagCategory() resolves them through instead.
      const html = tag.type === 'html' ? (tag.parameter?.find((p) => p.key === 'html')?.value ?? '') : '';
      const { platform, destId: destIdFromCode } = detectHtmlPlatform(tag, c.templates, html);
      // Anything that isn't Custom HTML has no code to pattern-match against — not just Community
      // Template tags ("cvt_..."), but also short native type strings we don't branch on
      // explicitly (e.g. "sp" for Google Ads Remarketing on some accounts) — fall back to
      // searching by parameter key name (see findIdLikeParamValue) for all of these.
      const destId = destIdFromCode || (tag.type !== 'html' ? findIdLikeParamValue(tag.parameter) : '');
      const events = detectHtmlEvents(platform, html);
      const isVar = isVarRef(destId);
      const vn = isVar ? varName(destId) : undefined;
      const vDef = vn ? varMap.get(vn) : undefined;
      const resolved = resolveConstant(vDef);
      const normalize = (v: string) => (platform === 'Google Ads' ? normalizeGoogleAdsId(v) : v);
      rawConfigs.push({
        id: makeId(), tagName: tag.name, tagType: tag.type, platform,
        destinations: destId ? [{ id: makeDestId(), measurementId: isVar ? destId : normalize(destId), isVariable: isVar, variableName: vn, resolvedValue: resolved ? normalize(resolved) : undefined }] : [],
        children: events.length > 0
          ? events.map((name) => ({ label: name, sourceTagName: tag.name }))
          : [{ label: tag.name }],
      });
    }
  }

  // Group nodes that share the same platform + destination (e.g. several Meta Pixel tags
  // firing to the same pixel ID) into one node whose children list every event/tag underneath.
  const grouped = new Map<string, ConfigNode>();
  // Same idea as destGroupKey: dedup by the EFFECTIVE resolved value, not the variable name —
  // two tags referencing different Constant variables that both resolve to the same real ID
  // are the same destination and must collapse into one box, not two identical-looking ones.
  const destEffectiveKey = (d: Destination) => (d.isVariable ? (d.resolvedValue ?? `var:${d.variableName}`) : d.measurementId);
  function mergeInto(existing: ConfigNode, cfg: ConfigNode) {
    existing.children = [...existing.children, ...cfg.children];
    for (const d of cfg.destinations) {
      const dup = existing.destinations.some((e) => destEffectiveKey(e) === destEffectiveKey(d));
      if (!dup) existing.destinations.push(d);
    }
    existing.isMultiProperty = existing.isMultiProperty || cfg.isMultiProperty;
  }

  // Some configs never carry their own destination: Conversion Linker is an account-wide cookie
  // helper (not tied to any one conversion ID), and a classic gaawc GA4 Configuration tag with no
  // resolvable measurementId is really the same GA4 property as whatever googtag/other GA4 node
  // already resolved one — in both cases they're processed last and folded into whichever real
  // destination of that platform already exists, instead of forming their own spurious
  // "no destination" node alongside the tags that actually carry an ID.
  const isFoldable = (cfg: ConfigNode) => cfg.tagType === 'clmb' || cfg.tagType === 'gclidw' || (cfg.tagType === 'gaawc' && cfg.destinations.length === 0);
  const foldableConfigs = rawConfigs.filter(isFoldable);
  const otherConfigs = rawConfigs.filter((cfg) => !isFoldable(cfg));

  for (const cfg of otherConfigs) {
    const key = destGroupKey(cfg.platform, cfg.destinations);
    const existing = grouped.get(key);
    if (!existing) { grouped.set(key, { ...cfg }); continue; }
    mergeInto(existing, cfg);
  }
  for (const cfg of foldableConfigs) {
    const realGroup = [...grouped.entries()].find(([k]) => k.startsWith(`${cfg.platform}::`) && k !== `${cfg.platform}::__none__`);
    if (realGroup) { mergeInto(realGroup[1], cfg); continue; }
    const key = destGroupKey(cfg.platform, cfg.destinations);
    const existing = grouped.get(key);
    if (!existing) { grouped.set(key, { ...cfg }); continue; }
    mergeInto(existing, cfg);
  }

  const configs = [...grouped.values()]
    .map((cfg) => ({
      ...cfg,
      // Representative label once grouped: platform name, not an arbitrary single tag's name
      tagName: cfg.children.length > 1 || grouped.size !== rawConfigs.length ? cfg.platform : cfg.tagName,
    }))
    // Same platform's nodes stay adjacent, and in the same fixed order across every container —
    // makes it easy to compare containers visually instead of the scattered scan order.
    .sort((a, b) => (PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform)) || 0);

  return { containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, configs };
}

// ─── Layout constants ──────────────────────────────────────────────────────────

const COL_W = { container: 180, config: 200, dest: 180 };
const COL_GAP = 60;
const NODE_H = 64;
const V_GAP = 12;
const DEST_H = 48;

function totalColX(col: 'container' | 'config' | 'dest'): { x: number; w: number } {
  if (col === 'container') return { x: 0, w: COL_W.container };
  if (col === 'config') return { x: COL_W.container + COL_GAP, w: COL_W.config };
  return { x: COL_W.container + COL_GAP + COL_W.config + COL_GAP, w: COL_W.dest };
}

// ─── SVG bezier path ───────────────────────────────────────────────────────────

function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const cx = (x1 + x2) / 2;
  return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
}

// ─── Single flow diagram for one container ────────────────────────────────────

function ContainerFlowDiagram({ flow, highlighted, onHighlight, onNodeClick, onExpand }: {
  flow: ContainerFlow;
  highlighted: string | null;
  onHighlight: (id: string | null) => void;
  onNodeClick: (cfg: ConfigNode, containerName: string) => void;
  onExpand?: () => void;
}) {
  const configs = flow.configs;

  // Layout: compute Y position for each config node and its destinations
  type NodeLayout = { cfgId: string; cfgY: number; dests: { destId: string; destY: number }[] };
  const layout: NodeLayout[] = [];
  let cursor = 0;
  for (const cfg of configs) {
    const destCount = Math.max(cfg.destinations.length, 1);
    const totalDestH = destCount * DEST_H + (destCount - 1) * V_GAP;
    const cfgCenter = cursor + Math.max(NODE_H, totalDestH) / 2;
    const destStart = cursor + (Math.max(NODE_H, totalDestH) - totalDestH) / 2;
    const dests = cfg.destinations.map((d, i) => ({
      destId: d.id,
      destY: destStart + i * (DEST_H + V_GAP) + DEST_H / 2,
    }));
    layout.push({ cfgId: cfg.id, cfgY: cfgCenter, dests });
    cursor += Math.max(NODE_H, totalDestH) + V_GAP;
  }
  if (cursor > 0) cursor -= V_GAP;

  const svgH = Math.max(NODE_H, cursor);
  const svgW = totalColX('dest').x + COL_W.dest;

  const containerY = svgH / 2;
  const { x: cfgX } = totalColX('config');
  const { x: destX } = totalColX('dest');
  const { x: contX } = totalColX('container');

  if (configs.length === 0) {
    return (
      <div className="relative select-none" style={{ height: NODE_H, minHeight: NODE_H }}>
        <div
          className="absolute flex flex-col justify-center px-3 py-2.5 rounded-xl border"
          style={{
            left: contX, top: 0,
            width: COL_W.container, height: NODE_H,
            backgroundColor: 'white',
            borderColor: 'var(--color-border)',
            boxShadow: '0 1px 4px hsl(220 20% 10% / 0.07)',
          }}
        >
          <div className="text-xs font-semibold text-foreground leading-tight">{flow.containerName}</div>
          <div className="text-[10px] font-mono text-muted-fg mt-0.5">{flow.publicId}</div>
        </div>
        <div
          className="absolute flex items-center px-3"
          style={{
            left: contX + COL_W.container + 16, top: NODE_H / 2 - 9,
            color: 'hsl(220 13% 60%)',
          }}
        >
          <span className="text-[11px] italic">Aucun tag de configuration reconnu</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative select-none" style={{ height: svgH, minHeight: NODE_H }}>
      <svg
        width={svgW}
        height={svgH}
        className="absolute inset-0 pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        {/* Container → Config connectors */}
        {layout.map(({ cfgId, cfgY }, i) => {
          const cfg = configs[i];
          const style = PLATFORM_STYLE[cfg.platform];
          const isHl = highlighted === cfg.id;
          return (
            <path
              key={`cc-${cfgId}`}
              d={bezier(contX + COL_W.container, containerY, cfgX, cfgY)}
              fill="none"
              stroke={isHl ? style.accent : 'hsl(220 13% 82%)'}
              strokeWidth={isHl ? 2 : 1.5}
              strokeDasharray={isHl ? undefined : '4 3'}
              style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
            />
          );
        })}

        {/* Config → Destination connectors */}
        {layout.map(({ cfgId, cfgY, dests }, i) => {
          const cfg = configs[i];
          const style = PLATFORM_STYLE[cfg.platform];
          const isHl = highlighted === cfg.id;
          if (dests.length === 0) return null;
          return dests.map(({ destId, destY }) => (
            <path
              key={`cd-${cfgId}-${destId}`}
              d={bezier(cfgX + COL_W.config, cfgY, destX, destY)}
              fill="none"
              stroke={isHl ? style.accent : 'hsl(220 13% 82%)'}
              strokeWidth={isHl ? 2 : 1.5}
              strokeDasharray={isHl ? undefined : '4 3'}
              style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
            />
          ));
        })}

        {/* Arrowheads on config connectors */}
        {layout.map(({ cfgY }, i) => {
          const cfg = configs[i];
          const style = PLATFORM_STYLE[cfg.platform];
          const isHl = highlighted === cfg.id;
          const ax = cfgX - 1;
          return (
            <polygon
              key={`arrow-c-${cfg.id}`}
              points={`${ax},${cfgY} ${ax - 7},${cfgY - 4} ${ax - 7},${cfgY + 4}`}
              fill={isHl ? style.accent : 'hsl(220 13% 75%)'}
              style={{ transition: 'fill 0.2s' }}
            />
          );
        })}

        {/* Arrowheads on destination connectors */}
        {layout.map(({ cfgId, dests }, i) => {
          const cfg = configs[i];
          const style = PLATFORM_STYLE[cfg.platform];
          const isHl = highlighted === cfg.id;
          return dests.map(({ destId, destY }) => {
            const ax = destX - 1;
            return (
              <polygon
                key={`arrow-d-${cfgId}-${destId}`}
                points={`${ax},${destY} ${ax - 7},${destY - 4} ${ax - 7},${destY + 4}`}
                fill={isHl ? style.accent : 'hsl(220 13% 75%)'}
                style={{ transition: 'fill 0.2s' }}
              />
            );
          });
        })}
      </svg>

      {/* Container node */}
      <div
        className="absolute flex flex-col justify-center px-3 py-2.5 rounded-xl border"
        style={{
          left: contX, top: containerY - NODE_H / 2,
          width: COL_W.container, height: NODE_H,
          backgroundColor: 'white',
          borderColor: 'var(--color-border)',
          boxShadow: '0 1px 4px hsl(220 20% 10% / 0.07)',
        }}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-foreground leading-tight truncate">{flow.containerName}</div>
            <div className="text-[10px] font-mono text-muted-fg mt-0.5">{flow.publicId}</div>
          </div>
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="shrink-0 p-1 rounded text-muted-fg hover:text-foreground hover:bg-card transition-colors"
              title="Agrandir ce container"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4.5 1.5h-3v3M7.5 1.5h3v3M4.5 10.5h-3v-3M7.5 10.5h3v-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Config nodes */}
      {layout.map(({ cfgId, cfgY }, i) => {
        const cfg = configs[i];
        const style = PLATFORM_STYLE[cfg.platform];
        const isHl = highlighted === cfg.id;
        return (
          <div
            key={cfgId}
            className="absolute flex items-center gap-2.5 px-3 cursor-pointer rounded-xl border transition-all"
            style={{
              left: cfgX, top: cfgY - NODE_H / 2,
              width: COL_W.config, height: NODE_H,
              backgroundColor: isHl ? style.bg : 'white',
              borderColor: isHl ? style.border : 'hsl(220 13% 88%)',
              boxShadow: isHl ? `0 0 0 2px ${style.border}` : '0 1px 4px hsl(220 20% 10% / 0.06)',
            }}
            onMouseEnter={() => onHighlight(cfg.id)}
            onMouseLeave={() => onHighlight(null)}
            onClick={() => cfg.children.length > 0 && onNodeClick(cfg, flow.containerName)}
          >
            <div className="shrink-0">
              <TagTypeIcon category={PLATFORM_ICON_CAT[cfg.platform]} size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: style.color }}>
                  {cfg.platform}
                </span>
                {cfg.isMultiProperty && (
                  <span
                    className="text-[9px] font-semibold px-1 py-px rounded"
                    style={{ backgroundColor: style.border, color: style.color }}
                  >
                    {cfg.destinations.length} props
                  </span>
                )}
              </div>
              {/* Quand le fallback de regroupement retombe sur le nom de la plateforme (ligne
                  ~486), ça duplique exactement le badge juste au-dessus — pas la peine de
                  répéter "GA4" deux fois d'affilée. */}
              {cfg.tagName !== cfg.platform && (
                <div className="text-[11px] font-medium text-foreground truncate leading-tight">{cfg.tagName}</div>
              )}
              {cfg.children.length > 0 && (
                <div className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: style.color }}>
                  {cfg.children.length} event{cfg.children.length > 1 ? 's' : ''}
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Destination nodes */}
      {layout.map(({ cfgId, dests }, i) => {
        const cfg = configs[i];
        const style = PLATFORM_STYLE[cfg.platform];
        const isHl = highlighted === cfg.id;

        if (cfg.destinations.length === 0) {
          return (
            <div
              key={`dest-empty-${cfgId}`}
              className="absolute flex items-center px-3 rounded-lg border"
              style={{
                left: destX, top: dests.length > 0 ? dests[0].destY - DEST_H / 2 : layout[i].cfgY - DEST_H / 2,
                width: COL_W.dest, height: DEST_H,
                borderColor: 'var(--color-sidebar-border)', backgroundColor: 'hsl(220 13% 97%)',
              }}
            >
              <span className="text-[11px] text-muted-fg italic">Non détecté</span>
            </div>
          );
        }

        return dests.map(({ destId, destY }, di) => {
          const dest = cfg.destinations[di];
          if (!dest) return null;
          const isUnresolvedLT = dest.isVariable && dest.variableType === 'smm';
          const isFromLT = dest.fromLT;
          return (
            <div
              key={destId}
              className="absolute flex items-center gap-2 px-3 rounded-lg border transition-all"
              style={{
                left: destX, top: destY - DEST_H / 2,
                width: COL_W.dest, height: DEST_H,
                backgroundColor: isHl ? style.bg : 'var(--color-sidebar-bg)',
                borderColor: isFromLT
                  ? (isHl ? style.border : 'hsl(213 80% 85%)')
                  : (isHl ? style.border : 'hsl(220 13% 88%)'),
              }}
            >
              {isUnresolvedLT ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0" style={{ color: style.accent }}>
                  <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M3 6h6M3 4h6M3 8h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                </svg>
              ) : (
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: isFromLT ? 'hsl(213 80% 60%)' : (isHl ? style.accent : 'hsl(220 13% 75%)') }}
                />
              )}
              <div className="min-w-0">
                <div className="text-[10px] font-mono font-medium truncate" style={{ color: isHl ? style.color : 'var(--color-foreground)' }}>
                  {dest.isVariable ? (dest.resolvedValue ?? dest.variableName ?? dest.measurementId) : dest.measurementId}
                </div>
                {isUnresolvedLT && (
                  <div className="text-[9px] mt-0.5" style={{ color: style.accent }}>Lookup Table non résolue</div>
                )}
              </div>
            </div>
          );
        });
      })}
    </div>
  );
}

// ─── Cross-container alert bar ─────────────────────────────────────────────────

function AlertBar({ flows }: { flows: ContainerFlow[] }) {
  const alerts: { kind: 'gap' | 'diverge'; text: string }[] = [];

  // Event gaps
  // GA4 event count divergence
  const ga4Counts = flows
    .map((f) => ({ name: f.containerName, count: f.configs.find((c) => c.platform === 'GA4')?.children.length ?? 0 }))
    .filter((x) => x.count > 0);
  const countSet = new Set(ga4Counts.map((x) => x.count));
  if (countSet.size > 1) {
    const min = Math.min(...ga4Counts.map((x) => x.count));
    const max = Math.max(...ga4Counts.map((x) => x.count));
    alerts.push({ kind: 'gap', text: `GA4 : couverture d'events inégale entre containers (${min}–${max} events)` });
  }

  // Destination divergence per platform
  const platformDests = new Map<Platform, { names: Set<string>; vars: number }>();
  for (const flow of flows) {
    for (const cfg of flow.configs) {
      if (!platformDests.has(cfg.platform)) platformDests.set(cfg.platform, { names: new Set(), vars: 0 });
      const pd = platformDests.get(cfg.platform)!;
      for (const d of cfg.destinations) {
        if (d.isVariable) pd.vars++;
        else pd.names.add(d.measurementId);
      }
    }
  }
  for (const [platform, { names }] of platformDests) {
    if (names.size > 1) {
      alerts.push({ kind: 'diverge', text: `${platform} : destinations différentes entre containers (${[...names].join(', ')})` });
    }
  }

  if (alerts.length === 0) return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs"
      style={{ borderColor: 'hsl(142 60% 75%)', backgroundColor: 'hsl(142 72% 97%)', color: 'var(--color-success)' }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3.5L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      Destinations et couverture cohérentes entre containers
    </div>
  );

  return (
    <div className="space-y-1.5">
      {alerts.map((a, i) => (
        <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs"
          style={a.kind === 'diverge'
            ? { borderColor: 'hsl(38 100% 80%)', backgroundColor: 'hsl(38 100% 97%)', color: 'var(--color-warning)' }
            : { borderColor: 'hsl(0 70% 80%)', backgroundColor: 'hsl(0 85% 97%)', color: 'var(--color-destructive)' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            {a.kind === 'diverge'
              ? <><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/><path d="M6 4v2.5M6 8v.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></>
              : <><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>}
          </svg>
          {a.text}
        </div>
      ))}
    </div>
  );
}

// ─── Column headers ────────────────────────────────────────────────────────────

function ColumnHeaders() {
  const { x: contX, w: contW } = totalColX('container');
  const { x: cfgX, w: cfgW } = totalColX('config');
  const { x: destX, w: destW } = totalColX('dest');
  const svgW = destX + destW;

  return (
    <div className="relative shrink-0" style={{ height: 28, width: svgW }}>
      {[
        { x: contX, w: contW, label: 'Container' },
        { x: cfgX, w: cfgW, label: 'Tag de configuration' },
        { x: destX, w: destW, label: 'Destination' },
      ].map(({ x, w, label }) => (
        <div
          key={label}
          className="absolute text-[10px] font-semibold uppercase tracking-widest text-muted-fg"
          style={{ left: x, width: w, top: 4 }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function DistributionTab({ containers }: { containers: MonitoringContainerData[] }) {
  const flows = useMemo(() => containers.map(buildContainerFlow), [containers]);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [detailNode, setDetailNode] = useState<{ cfg: ConfigNode; containerName: string } | null>(null);
  const [fullscreenContainerId, setFullscreenContainerId] = useState<string | null>(null);
  const fullscreenFlow = flows.find((f) => f.containerId === fullscreenContainerId) ?? null;

  const svgW = totalColX('dest').x + COL_W.dest;
  const hasAny = flows.some((f) => f.configs.length > 0);

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-fg">
        <p className="text-sm">Aucun tag de configuration détecté</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Alert bar */}
      <div className="px-6 py-3 border-b shrink-0" style={{ borderColor: 'var(--color-sidebar-border)', backgroundColor: 'var(--color-sidebar-bg)' }}>
        <AlertBar flows={flows} />
      </div>

      {/* Flow diagrams */}
      <div className="flex-1 overflow-auto px-6 py-5 space-y-8">
        {/* Column headers */}
        <ColumnHeaders />

        {flows.map((flow, i) => (
          <div key={flow.containerId}>
            {i > 0 && (
              <div className="mb-8 h-px" style={{ backgroundColor: 'hsl(220 13% 92%)', width: svgW }} />
            )}
            <ContainerFlowDiagram
              flow={flow}
              highlighted={highlighted}
              onHighlight={setHighlighted}
              onNodeClick={(cfg, containerName) => setDetailNode({ cfg, containerName })}
              onExpand={() => setFullscreenContainerId(flow.containerId)}
            />
          </div>
        ))}
      </div>

      {/* Fullscreen single-container view */}
      {fullscreenFlow && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white">
          <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'hsl(220 13% 91%)' }}>
            <div>
              <div className="text-sm font-bold text-foreground">{fullscreenFlow.containerName}</div>
              <div className="text-xs font-mono text-muted-fg">{fullscreenFlow.publicId}</div>
            </div>
            <button
              type="button"
              onClick={() => setFullscreenContainerId(null)}
              aria-label="Fermer la vue plein écran"
              className="p-1.5 rounded-lg text-muted-fg hover:text-foreground hover:bg-card transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-auto px-8 py-8">
            <ColumnHeaders />
            <div className="mt-5">
              <ContainerFlowDiagram
                flow={fullscreenFlow}
                highlighted={highlighted}
                onHighlight={setHighlighted}
                onNodeClick={(cfg, containerName) => setDetailNode({ cfg, containerName })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        className="px-6 py-2.5 border-t flex items-center gap-2 shrink-0 text-xs"
        style={{ borderColor: 'var(--color-sidebar-border)', backgroundColor: 'var(--color-sidebar-bg)', color: 'var(--color-muted-fg)' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/><path d="M6 4v2.5M6 8v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
        Survolez un nœud pour ses connexions · cliquez un nœud avec un badge "N events" pour le détail
      </div>

      {/* Node detail drawer */}
      {detailNode && (
        <>
          <div className="fixed inset-0 z-40" style={{ backgroundColor: 'rgba(0,10,6,0.25)' }} onClick={() => setDetailNode(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-80 bg-white shadow-2xl flex flex-col" style={{ borderLeft: '1px solid hsl(220 13% 91%)' }}>
            <div className="px-5 py-4 border-b flex items-start justify-between gap-2" style={{ borderColor: 'hsl(220 13% 91%)' }}>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: PLATFORM_STYLE[detailNode.cfg.platform].color }}>
                  {detailNode.cfg.platform}
                </div>
                <div className="text-sm font-bold text-foreground truncate">{detailNode.cfg.tagName}</div>
                <div className="text-xs text-muted-fg mt-0.5">{detailNode.containerName}</div>
              </div>
              <button type="button" onClick={() => setDetailNode(null)} aria-label="Fermer" className="p-1 rounded text-muted-fg hover:text-foreground shrink-0">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {detailNode.cfg.destinations.length > 0 && (
              <div className="px-5 py-3 border-b text-xs space-y-1" style={{ borderColor: 'hsl(220 13% 91%)' }}>
                <div className="text-muted-fg font-medium">Destination{detailNode.cfg.destinations.length > 1 ? 's' : ''}</div>
                {detailNode.cfg.destinations.map((d, i) => (
                  <div key={i} className="font-mono text-foreground">{d.isVariable ? (d.resolvedValue ?? d.variableName ?? d.measurementId) : d.measurementId}</div>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-3">
              <div className="text-xs text-muted-fg font-medium mb-2">{detailNode.cfg.children.length} event{detailNode.cfg.children.length > 1 ? 's' : ''}</div>
              <div className="space-y-1">
                {detailNode.cfg.children.map((child, i) => (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'hsl(220 20% 98%)' }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PLATFORM_STYLE[detailNode.cfg.platform].accent }} />
                    <span className="font-mono text-foreground truncate">{child.label}</span>
                    {child.sourceTagName && child.sourceTagName !== child.label && (
                      <span className="text-muted-fg ml-auto truncate max-w-[100px]" title={child.sourceTagName}>{child.sourceTagName}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
