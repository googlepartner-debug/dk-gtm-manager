import { SENSITIVE_KEYWORDS } from '../constants/ga4Events';

// PRD §5.3 — combined method, deliberately NOT restricted to keyword-matched variables only:
// a value-pattern match (email/phone regex) is checked on every variable regardless of its name,
// so a badly-named variable (e.g. "input_1") holding an email still gets caught.
export function anonymizeValue(varPath: string, value: string): string {
  if (typeof value !== 'string' || value === '') return value;

  const lowerPath = varPath.toLowerCase();

  for (const [type, keywords] of Object.entries(SENSITIVE_KEYWORDS)) {
    if (keywords.some((k) => lowerPath.includes(k))) {
      return anonymizeByType(type, value);
    }
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return '***@***.***';
  }

  const phoneMatch = value.match(/^(\+\d{2,3}|0\d)[\d\s.-]+$/);
  if (phoneMatch && value.replace(/[\s.-]/g, '').length >= 10) {
    const prefix = value.match(/^(\+\d{2,3}|0\d)/);
    if (prefix) return prefix[0] + '********';
  }

  return value;
}

function anonymizeByType(type: string, value: string): string {
  switch (type) {
    case 'email': return '***@***.***';
    case 'phone': {
      const prefix = value.match(/^(\+\d{2,3}|0\d)/);
      return prefix ? prefix[0] + '********' : '**********';
    }
    case 'firstname': return '***PRENOM***';
    case 'lastname': return '***NOM***';
    case 'userid': return '***UID***';
    default: return '***';
  }
}

// Recursively anonymizes every string leaf of a dataLayer payload, tracking each leaf's path
// so anonymizeValue can match on the full variable path, not just the leaf key.
export function anonymizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  function walk(value: unknown, path: string): unknown {
    if (typeof value === 'string') return anonymizeValue(path, value);
    if (Array.isArray(value)) return value.map((v, i) => walk(v, `${path}[${i}]`));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = walk(v, path ? `${path}.${k}` : k);
      }
      return out;
    }
    return value;
  }
  return walk(payload, '') as Record<string, unknown>;
}
