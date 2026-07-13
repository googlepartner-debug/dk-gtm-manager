import type { DeploymentPackage, GTMTag, GTMVariable, GTMTrigger } from '../types/gtm';
import { BUILTIN_DISPLAY_TO_TYPE, collectStrings } from './gtm-builtin-variables';

export interface PackageWarning {
  severity: 'warning' | 'info';
  entityKind: 'tag' | 'variable' | 'trigger';
  entityName: string;
  message: string;
}

function extractTemplateRefs(s: string): string[] {
  const refs: string[] = [];
  const re = /\{\{\s*([^{}]+?)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) refs.push(m[1].trim());
  return refs;
}

// Third-party infra domains that legitimately show up identically across every container —
// not a sign of container-specific hardcoding, so excluded from the domain heuristic below.
const KNOWN_SHARED_DOMAINS = [
  'googletagmanager.com', 'google-analytics.com', 'googleadservices.com', 'doubleclick.net',
  'google.com', 'gstatic.com', 'facebook.com', 'facebook.net', 'analytics.tiktok.com',
  'clarity.ms', 'hotjar.com', 'criteo.com', 'bing.com', 'snapchat.com', 'linkedin.com',
  'schema.org', 'w3.org', 'piano.io', 'matomo.cloud',
];

const DOMAIN_RE = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi;
const BARE_NUMERIC_ID_RE = /^\d{6,}$/;

// A bare "word.word" shape is indistinguishable from a real domain by DOMAIN_RE alone — and
// GA4/dataLayer variable paths use exactly that shape by convention (ecommerce.value,
// ecommerce.shipping, ecommerce.items…), so every standard ecommerce package used to flood
// this warning with false positives on its own variable names. Requiring the last segment to
// be a real-looking TLD keeps genuine hostnames (turkishairlines.com) while dropping those.
const REAL_TLDS = new Set([
  'com', 'net', 'org', 'io', 'co', 'fr', 'de', 'es', 'it', 'uk', 'nl', 'be', 'ch', 'at', 'se',
  'no', 'dk', 'fi', 'pl', 'app', 'dev', 'cloud', 'ai', 'shop', 'store', 'biz', 'info', 'me',
  'tv', 'us', 'ca', 'jp', 'cn', 'ru', 'br', 'mx', 'au', 'xyz',
]);

// {{_event}} isn't a user-created or enableable built-in variable — it's the implicit token
// GTM itself inserts as arg0 in every Custom Event trigger's condition (matches the fired
// event name). Flagging it as a "ghost reference" fired on every single Custom Event trigger,
// which is most of them in a typical GA4 package.
const ALWAYS_VALID_REFS = new Set(['_event']);

function scanEntity(
  kind: 'tag' | 'variable' | 'trigger',
  entity: GTMTag | GTMVariable | GTMTrigger,
  declaredNames: Set<string>,
  warnings: PackageWarning[],
): void {
  const strings: string[] = [];
  collectStrings(entity, strings);

  for (const s of strings) {
    // Ghost reference: {{X}} where X is neither declared in this package nor a built-in GTM variable.
    // Will silently resolve to nothing (or worse, an unrelated same-named entity) on a container
    // where nobody happens to have created something named exactly X.
    for (const ref of extractTemplateRefs(s)) {
      if (declaredNames.has(ref) || BUILTIN_DISPLAY_TO_TYPE[ref] || ALWAYS_VALID_REFS.has(ref)) continue;
      warnings.push({
        severity: 'warning',
        entityKind: kind,
        entityName: entity.name,
        message: `Référence "{{${ref}}}" absente du package et non reconnue comme variable native GTM — elle ne fonctionnera que si un élément portant exactement ce nom existe déjà dans le container cible.`,
      });
    }

    const trimmed = s.trim();
    if (trimmed.includes('{{')) continue; // already a variable reference, not a hardcoded literal

    // Bare numeric ID (pixel ID, conversion ID...) hardcoded instead of via a Constante variable.
    if (BARE_NUMERIC_ID_RE.test(trimmed)) {
      warnings.push({
        severity: 'info',
        entityKind: kind,
        entityName: entity.name,
        message: `Valeur "${trimmed}" ressemble à un ID en dur (pixel/conversion) — si elle est spécifique au container pilote, la propager telle quelle enverra les données de la cible vers le compte du pilote. Vérifier qu'elle vient d'une variable Constante avant de déployer ailleurs.`,
      });
      continue;
    }

    // Domain-like literal (site-specific hostname) not in the shared-infra allowlist.
    for (const match of trimmed.matchAll(DOMAIN_RE)) {
      const domain = match[0].toLowerCase();
      const tld = domain.slice(domain.lastIndexOf('.') + 1);
      if (!REAL_TLDS.has(tld)) continue;
      if (KNOWN_SHARED_DOMAINS.some((known) => domain === known || domain.endsWith(`.${known}`))) continue;
      warnings.push({
        severity: 'info',
        entityKind: kind,
        entityName: entity.name,
        message: `Valeur "${trimmed}" contient un domaine ("${domain}") qui semble propre à un site — à vérifier avant de déployer sur un autre container.`,
      });
    }
  }
}

// Scans a package for two classes of copy-paste-across-containers risk:
// 1. {{variable}} references that don't resolve to anything in this package or GTM's built-ins
// 2. Literal values that look like a pixel/conversion ID or a site-specific domain, hardcoded
//    instead of behind a Constante variable — the classic "Turkish tag deployed on Air France
//    still points at Turkish's own pixel/domain" failure mode.
// Heuristic and non-blocking by design — surfaced as warnings to review, not hard errors.
export function validatePackage(pkg: DeploymentPackage): PackageWarning[] {
  const warnings: PackageWarning[] = [];
  const declaredNames = new Set<string>([
    ...pkg.entities.tags.map((t) => t.name),
    ...pkg.entities.variables.map((v) => v.name),
    ...pkg.entities.triggers.map((t) => t.name),
  ]);

  for (const t of pkg.entities.tags) scanEntity('tag', t, declaredNames, warnings);
  for (const v of pkg.entities.variables) scanEntity('variable', v, declaredNames, warnings);
  for (const tr of pkg.entities.triggers) scanEntity('trigger', tr, declaredNames, warnings);

  return warnings;
}
