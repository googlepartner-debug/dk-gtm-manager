import type { GTMTag, GTMCustomTemplate } from '../types/gtm';

// Shared between MonitoringPage (matrix builder) and the store (applying queued operations) —
// both need to resolve which tag a given matrix row (category + rowKey) maps to per container.

// A tag instantiated from a Custom/Community Template has type "cvt_<templateId>" instead of a
// native GTM type string, so its real destination platform can't be read from `tag.type` at all.
// The template's own name + gallery owner/repository (e.g. "Meta Ads Conversions API Tag",
// repository "facebook-conversions-api") is a far more reliable signal than guessing from the
// tag's own name or its (often generic/minified) code — resolve it first and fold it into the
// same keyword cascade used for Custom HTML tags below.
function resolveTemplateText(tag: GTMTag, templates: GTMCustomTemplate[] | undefined): string {
  if (!templates || !tag.type.startsWith('cvt_')) return '';
  const tpl = templates.find((t) => tag.type === `cvt_${t.templateId}`);
  if (!tpl) return '';
  return [tpl.name, tpl.galleryReference?.owner, tpl.galleryReference?.repository].filter(Boolean).join(' ');
}

export function detectTagCategory(tag: GTMTag, templates?: GTMCustomTemplate[]): string {
  if (tag.type === 'gaawe' || tag.type === 'gaawc') return 'GA4';
  // 'sp' and 'gclidw' are the real native types for Google Ads Remarketing / Conversion Linker on
  // this account (confirmed against live scan data) — 'awrk'/'clmb' kept too in case other
  // accounts still use those.
  if (tag.type === 'awct' || tag.type === 'awrk' || tag.type === 'clmb' || tag.type === 'sp' || tag.type === 'gclidw') return 'Google Ads';
  if (tag.type === 'flc') return 'Floodlight';
  // Legacy Universal Analytics tag type
  if (tag.type === 'ua') return 'Legacy UA';
  // Native Microsoft Advertising (Bing Ads) Universal Event Tracking tag type
  if (tag.type === 'baut') return 'Microsoft Ads';

  // Platform-in-custom-code detection — runs for 'html' tags AND for any unrecognized type
  // (e.g. official GTM Community Template tags for Meta/TikTok/etc. don't have type === 'html',
  // they have their own vendor-specific type string). Searches the tag NAME too, not just the
  // HTML body, since a Community Template's code is often generic/minified with no destination
  // keyword in it, but the tag is usually still named after its platform ("Meta Pixel - Purchase").
  const html = tag.type === 'html' ? (tag.parameter?.find((p) => p.key === 'html')?.value ?? '') : '';
  const templateText = resolveTemplateText(tag, templates);
  // The unified "Google tag" (type "googtag", replaced the classic gaawc GA4 Configuration tag
  // from GTM's Sept. 2023 update onward) covers GA4 OR Google Ads depending on its tagId value —
  // fold that value into the searched text so the keyword cascade below can tell them apart.
  const googTagId = tag.type === 'googtag' ? (tag.parameter?.find((p) => p.key === 'tagId')?.value ?? '') : '';
  const text = `${tag.name} ${html} ${templateText} ${googTagId}`.toLowerCase();

  if (text.includes('analytics.js') || /ua-\d{4,}-\d+/.test(text)) return 'Legacy UA';
  // Google Ads / GA4 implemented as Custom HTML instead of the native awct/awrk/gaawe tag type
  // (e.g. a hand-written gtag snippet, or a name like "Google Ads - remarketing - add_to_cart")
  // still needs to resolve to the right platform rather than falling through to "HTML Custom".
  if (/google[\s_-]?ads/i.test(text) || /\baw-\d{6,}\b/i.test(text) || text.includes('googleadservices.com') || text.includes('googlesyndication.com/pagead')) return 'Google Ads';
  if (text.includes('ga4') || text.includes('google analytics 4') || text.includes('google-analytics.com/g/collect') || /\bg-[a-z0-9]{6,}\b/i.test(text)) return 'GA4';
  if (text.includes('piano') || /at[\s_-]?internet/i.test(text) || text.includes('smarttag')) return 'Piano';
  if (text.includes('matomo') || text.includes('_paq')) return 'Matomo';
  if (text.includes('kameleoon')) return 'Kameleoon';
  if (/ab[\s_-]?tasty/i.test(text)) return 'AB Tasty';
  // "fb" as a standalone token (agency naming convention: "FB - event - Purchase", "fb_pixel"…) —
  // bounded by start/end/space/dash/underscore so it doesn't match inside unrelated words.
  // Multi-word keywords also tolerate missing separators ("MetaPixel", "ConversionsAPI") since
  // agencies often drop spaces/dashes in tag names inconsistently — see the "GoogleAds" case.
  const hasFbToken = /(^|[\s_-])fb([\s_-]|$)/i.test(text);
  const hasMetaBrand = hasFbToken || text.includes('fbq(') || text.includes('facebook') || text.includes('fbevents') || /meta[\s_-]?pixel/i.test(text);
  // "conversions api"/"capi" alone is generic (TikTok, Snapchat, Pinterest, LinkedIn all have one) —
  // only counts as Meta when a Meta-specific brand marker is also present in the same tag.
  const hasMetaCapi = /\bmeta\b/i.test(text) && (/meta[\s_-]?capi/i.test(text) || /conversions?[\s_-]?api/i.test(text));
  if (hasMetaBrand || hasMetaCapi) return 'Meta Pixel';
  if (text.includes('tiktok') || text.includes('ttq.load')) return 'TikTok';
  if (text.includes('hotjar') || text.includes('hjid')) return 'Hotjar';
  if (text.includes('criteo') || text.includes('rtax')) return 'Criteo';
  if (text.includes('linkedin') || text.includes('li_fat_id') || text.includes('_linkedin_partner_id')) return 'LinkedIn';
  if (text.includes('pinterest') || text.includes('pintrk')) return 'Pinterest';
  if (text.includes('snapchat') || text.includes('snaptr')) return 'Snapchat';
  if (/microsoft[\s_-]?ads/i.test(text) || /bing[\s_-]?ads/i.test(text) || text.includes('uetq') || text.includes('bat.bing.com') || /\buet[\s_-]?tag\b/i.test(text) || text.includes('msclkid')) return 'Microsoft Ads';
  if (/microsoft[\s_-]?clarity/i.test(text) || text.includes('clarity.ms') || /\bclarity\s*\(/i.test(text)) return 'Microsoft Clarity';
  // Consent Management Platform vendor script — a real third party (consent logs, IP, etc.)
  if (/\bcmp\b/i.test(text) || /consent[\s_-]?studio/i.test(text) || /didomi|onetrust|cookiebot|axeptio|tarteaucitron|usercentrics|cookiefirst|sirdata|quantcast/i.test(text)) return 'CMP';
  // Google Consent Mode signal (gtag('consent', 'default'/'update', ...)) — configures existing
  // GA4/Ads tags locally, sends nothing to any destination by itself. Kept distinct from 'CMP'.
  if (/consent[\s_-]?mode/i.test(text) || /gtag\(\s*['"]consent['"]/i.test(text)) return 'Consent Mode';

  // A googtag whose tagId is a variable reference with no recognizable keyword in its name
  // still needs to land somewhere — GA4 is by far the more common use of this tag type.
  if (tag.type === 'googtag') return 'GA4';

  return tag.type === 'html' ? 'HTML Custom' : 'Custom Template';
}

// Human-readable label for the template a tag was instantiated from, when known —
// used to show the real vendor template name (e.g. in a tooltip) instead of a raw "cvt_..." type.
export function resolveTemplateName(tag: GTMTag, templates: GTMCustomTemplate[] | undefined): string | undefined {
  if (!templates || !tag.type.startsWith('cvt_')) return undefined;
  return templates.find((t) => tag.type === `cvt_${t.templateId}`)?.name;
}

export function getTagRowKey(tag: GTMTag, category: string): string {
  if (category === 'GA4' && tag.type === 'gaawe') {
    return tag.parameter?.find((p) => p.key === 'event_name' || p.key === 'eventName')?.value ?? tag.name;
  }
  if (category === 'GA4' && tag.type === 'gaawc') return 'GA4 Configuration';
  return tag.name;
}

export function findTagByRowKey(tags: GTMTag[], category: string, rowKey: string, templates?: GTMCustomTemplate[]): GTMTag | undefined {
  return tags.find((t) => detectTagCategory(t, templates) === category && getTagRowKey(t, category) === rowKey);
}
