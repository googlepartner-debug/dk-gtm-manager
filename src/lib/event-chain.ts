import type { GTMParameter, GTMTag, GTMTrigger } from '../types/gtm';
import type { EventChainStatus, EventChainRow } from '../types/gtm';
import type { MonitoringContainerData } from '../data/monitoring-mock';

const VAR_RE = /\{\{([^}]+)\}\}/g;
const IS_VAR_REF = /^\{\{.+\}\}$/;

function extractVarRefs(value: string): string[] {
  const refs: string[] = [];
  let m: RegExpExecArray | null;
  VAR_RE.lastIndex = 0;
  while ((m = VAR_RE.exec(value)) !== null) refs.push(m[1]);
  return refs;
}

function extractParamRefs(params: GTMParameter[]): string[] {
  const refs: string[] = [];
  for (const p of params) {
    if (p.value) refs.push(...extractVarRefs(p.value));
    if (p.list) refs.push(...extractParamRefs(p.list));
    if (p.map) refs.push(...extractParamRefs(p.map));
  }
  return refs;
}

// Simplify a regex pattern to a human-readable prefix.
// "click_.*" → "click_"  |  "^purchase$" → "purchase"  |  "click_" → "click_"
function simplifyPattern(pattern: string): string {
  return pattern
    .replace(/^\^/, '')      // strip leading anchor
    .replace(/[.*+?$]+$/, '') // strip trailing regex metacharacters
    .trim();
}

function resolveEventNameFromTrigger(trigger: GTMTrigger): string | null {
  if (trigger.type === 'customEvent') {
    const condition = trigger.customEventFilter?.[0];
    if (condition) {
      const arg1 = condition.parameter?.find((p) => p.key === 'arg1')?.value;
      if (arg1 && !IS_VAR_REF.test(arg1)) {
        if (condition.type === 'equals') return arg1;
        // Pattern-based conditions: contains / startsWith / matchesRegex — extract prefix
        if (
          condition.type === 'contains' ||
          condition.type === 'startsWith' ||
          condition.type === 'matchesRegex' ||
          condition.type === 'matchesRegexIgnoreCase'
        ) {
          const simplified = simplifyPattern(arg1);
          // Only use if pattern gives useful info (not just ".*" → "")
          if (simplified.length > 0) return simplified;
        }
      }
    }

    // Fallback: filter[] conditions on _event / {{Event}} (catch-all trigger + extra filter)
    for (const f of trigger.filter ?? []) {
      const arg0 = f.parameter?.find((p) => p.key === 'arg0')?.value;
      if (arg0 !== '_event' && arg0 !== '{{Event}}') continue;
      const val = f.parameter?.find((p) => p.key === 'arg1')?.value;
      if (!val || IS_VAR_REF.test(val)) continue;
      if (f.type === 'equals') return val;
      if (
        f.type === 'contains' ||
        f.type === 'startsWith' ||
        f.type === 'matchesRegex' ||
        f.type === 'matchesRegexIgnoreCase'
      ) {
        const simplified = simplifyPattern(val);
        if (simplified.length > 0) return simplified;
      }
    }
  }
  return null;
}

// Resolves the event name(s) for a gaawe tag.
// If the eventName param is a {{VarRef}}, reads trigger conditions to find concrete values.
// May return multiple names when multiple triggers each cover a different event.
export function resolveTagEventNames(tag: GTMTag, triggers: GTMTrigger[]): string[] {
  const raw = tag.parameter?.find((p) => p.key === 'event_name' || p.key === 'eventName')?.value;
  if (!raw) return [];
  if (!IS_VAR_REF.test(raw.trim())) return [raw];

  // Variable reference — try trigger conditions
  const triggerMap = new Map(triggers.filter((t) => t.triggerId).map((t) => [t.triggerId!, t]));
  const resolved: string[] = [];
  for (const id of tag.firingTriggerId ?? []) {
    const tr = triggerMap.get(id);
    if (!tr) continue;
    const name = resolveEventNameFromTrigger(tr);
    if (name && !resolved.includes(name)) resolved.push(name);
  }

  // If resolved, return those — if not, the tag fires on a dynamic/unresolvable event name;
  // return [] so it doesn't pollute the matrix with "{{Event}}" rows.
  return resolved;
}

export function computeEventChain(containers: MonitoringContainerData[]): EventChainRow[] {
  // Collect all event names across all containers (resolving {{VarRef}} via triggers)
  const allEvents = new Set<string>();
  for (const c of containers) {
    for (const tag of c.tags) {
      if (tag.type !== 'gaawe') continue;
      for (const name of resolveTagEventNames(tag, c.triggers)) allEvents.add(name);
    }
  }

  const rows: EventChainRow[] = [];

  for (const eventName of allEvents) {
    const statusMap: Record<string, EventChainStatus> = {};
    let completedCount = 0;

    for (const c of containers) {
      const tag = c.tags.find(
        (t) =>
          t.type === 'gaawe' &&
          resolveTagEventNames(t, c.triggers).includes(eventName),
      );

      if (!tag) {
        statusMap[c.containerId] = {
          eventName,
          containerId: c.containerId,
          tagPresent: false,
          triggerCount: 0,
          triggersMissing: true,
          variablesTotal: 0,
          variablesMissing: [],
          chainScore: 0,
        };
        continue;
      }

      const triggerIds = tag.firingTriggerId ?? [];
      const triggerCount = triggerIds.filter((id) =>
        c.triggers.some((t) => t.triggerId === id),
      ).length;

      const allRefs = extractParamRefs(tag.parameter ?? []);
      const uniqueRefs = [...new Set(allRefs)];
      const varNames = new Set(c.variables.map((v) => v.name));
      const variablesMissing = uniqueRefs.filter((ref) => !varNames.has(ref));

      let chainScore: 0 | 1 | 2 | 3;
      if (triggerCount === 0) chainScore = 1;
      else if (variablesMissing.length > 0) chainScore = 2;
      else chainScore = 3;

      if (chainScore === 3) completedCount++;

      statusMap[c.containerId] = {
        eventName,
        containerId: c.containerId,
        tagPresent: true,
        tagName: tag.name,
        triggerCount,
        triggersMissing: triggerCount === 0,
        variablesTotal: uniqueRefs.length,
        variablesMissing,
        chainScore,
      };
    }

    rows.push({
      eventName,
      containers: statusMap,
      coveragePercent: containers.length > 0 ? completedCount / containers.length : 0,
    });
  }

  rows.sort((a, b) => a.coveragePercent - b.coveragePercent);
  return rows;
}
