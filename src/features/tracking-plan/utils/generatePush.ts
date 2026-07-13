import type { TrackingPlanEvent, TrackingPlanParameter } from '../types/trackingPlan.types';

// A leaf whose value should be emitted as raw, unquoted text ({{name}} placeholder or a
// non-parseable example) instead of being JSON-stringified like a real value.
class RawText {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

function formatLeaf(p: TrackingPlanParameter): unknown {
  const example = p.exampleValue.trim();
  if (example) {
    if (p.type === 'number') {
      const n = Number(example);
      return Number.isFinite(n) ? n : new RawText(example);
    }
    if (p.type === 'boolean') return example.toLowerCase() === 'true';
    if (p.type === 'string') return example;
    return new RawText(example); // array/object example text — can't safely reparse, show as-is
  }
  const lastSegment = p.key.split('.').filter(Boolean).pop() ?? p.key;
  return new RawText(`{{${lastSegment.replace(/\[\*\]$/, '')}}}`);
}

// Builds a nested object from flat dotted keys — same wildcard convention as the "Variable
// Path" notation already used elsewhere in the app (e.g. "ecommerce.items[*].item_name").
function buildTree(parameters: TrackingPlanParameter[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const p of parameters) {
    const segments = p.key.split('.').map((s) => s.trim()).filter(Boolean);
    if (segments.length === 0) continue;
    let node = root;
    for (let i = 0; i < segments.length; i++) {
      const raw = segments[i];
      const isLast = i === segments.length - 1;
      const isArraySegment = raw.endsWith('[*]');
      const name = isArraySegment ? raw.slice(0, -3) : raw;

      if (isLast) {
        node[name] = isArraySegment ? [formatLeaf(p)] : formatLeaf(p);
        continue;
      }

      if (isArraySegment) {
        const existing = node[name];
        if (!Array.isArray(existing) || typeof existing[0] !== 'object' || existing[0] instanceof RawText) {
          node[name] = [{}];
        }
        node = (node[name] as Record<string, unknown>[])[0];
      } else {
        const existing = node[name];
        if (!existing || typeof existing !== 'object' || existing instanceof RawText || Array.isArray(existing)) {
          node[name] = {};
        }
        node = node[name] as Record<string, unknown>;
      }
    }
  }
  return root;
}

function serialize(value: unknown, indent: number): string {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);
  if (value instanceof RawText) return value.text;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[\n${value.map((v) => padIn + serialize(v, indent + 1)).join(',\n')}\n${pad}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return `{\n${entries.map(([k, v]) => `${padIn}${JSON.stringify(k)}: ${serialize(v, indent + 1)}`).join(',\n')}\n${pad}}`;
  }
  return JSON.stringify(value);
}

// Generates a ready-to-paste dataLayer.push() snippet from an event's declared parameters —
// {{placeholder}} for anything without an example value, same convention as DataLayer
// Mapping's templateToImplement (PRD DataLayerMapping §7 concepts).
export function buildDataLayerPushSnippet(event: TrackingPlanEvent): string {
  const tree = buildTree(event.parameters);
  const full: Record<string, unknown> = { event: event.eventName, ...tree };
  return `dataLayer.push(${serialize(full, 0)});`;
}
