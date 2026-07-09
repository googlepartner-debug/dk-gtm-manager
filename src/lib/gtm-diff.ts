import type { GTMTag, GTMVariable, GTMTrigger, DiffEntity, ContainerDiff, EntityKind } from '../types/gtm';
import { getDefaultWorkspace, listTags, listVariables, listTriggers } from './gtm-api';

// Compare two GTM entities by their meaningful fields (ignore GTM-assigned IDs)
function isSameEntity(
  proposed: GTMTag | GTMVariable | GTMTrigger,
  existing: Record<string, unknown>
): boolean {
  const normalize = (obj: Record<string, unknown>) => {
    const { tagId: _t, variableId: _v, triggerId: _tr, path: _p, fingerprint: _f, accountId: _a, containerId: _c, workspaceId: _w, parentFolderId: _pf, ...rest } = obj;
    return JSON.stringify(rest, Object.keys(rest).sort());
  };
  return normalize(proposed as unknown as Record<string, unknown>) === normalize(existing);
}

interface ExistingEntity {
  id: string;
  name: string;
  raw: Record<string, unknown>;
}

function extractExisting(
  list: Record<string, unknown>[],
  idKey: string
): Map<string, ExistingEntity> {
  const map = new Map<string, ExistingEntity>();
  for (const item of list) {
    const name = item.name as string;
    map.set(name, { id: item[idKey] as string, name, raw: item });
  }
  return map;
}

function buildDiffEntities(
  kind: EntityKind,
  proposed: (GTMTag | GTMVariable | GTMTrigger)[],
  existing: Map<string, ExistingEntity>
): DiffEntity[] {
  return proposed.map((entity) => {
    const match = existing.get(entity.name);
    if (!match) {
      return {
        key: `${kind}::${entity.name}`,
        kind,
        name: entity.name,
        status: 'new' as const,
        selected: true,
        proposed: entity,
      };
    }
    const unchanged = isSameEntity(entity, match.raw);
    return {
      key: `${kind}::${entity.name}`,
      kind,
      name: entity.name,
      status: unchanged ? ('unchanged' as const) : ('modified' as const),
      selected: !unchanged, // auto-select new + modified, not unchanged
      existingId: match.id,
      proposed: entity,
      current: match.raw as unknown as GTMTag | GTMVariable | GTMTrigger,
    };
  });
}

// ─── Version-to-version diff (Chantier A — réplication depuis un container pilote) ──

export interface VersionContent {
  tag?: GTMTag[];
  trigger?: GTMTrigger[];
  variable?: GTMVariable[];
}

const ID_KEY: Record<EntityKind, string> = { tag: 'tagId', variable: 'variableId', trigger: 'triggerId' };
const LIST_KEY: Record<EntityKind, 'tag' | 'trigger' | 'variable'> = { tag: 'tag', variable: 'variable', trigger: 'trigger' };

// Compares two published versions of the SAME container and returns every entity that
// changed between them (new/modified/removed) — used to isolate exactly what a pilot
// container's dataLayer adaptation changed, so only that delta gets replicated elsewhere.
export function diffVersions(before: VersionContent, after: VersionContent): DiffEntity[] {
  const entities: DiffEntity[] = [];

  for (const kind of ['tag', 'variable', 'trigger'] as EntityKind[]) {
    const beforeList = (before[LIST_KEY[kind]] ?? []) as unknown as Record<string, unknown>[];
    const afterList = (after[LIST_KEY[kind]] ?? []) as (GTMTag | GTMVariable | GTMTrigger)[];
    const beforeMap = extractExisting(beforeList, ID_KEY[kind]);

    entities.push(...buildDiffEntities(kind, afterList, beforeMap));

    const afterNames = new Set(afterList.map((e) => e.name));
    for (const [name, info] of beforeMap) {
      if (afterNames.has(name)) continue;
      entities.push({
        key: `${kind}::${name}`,
        kind,
        name,
        status: 'removed',
        selected: false, // replicating a deletion is an explicit, separate choice — never automatic
        existingId: info.id,
        proposed: info.raw as unknown as GTMTag | GTMVariable | GTMTrigger,
        current: info.raw as unknown as GTMTag | GTMVariable | GTMTrigger,
      });
    }
  }

  return entities;
}

export async function computeContainerDiff(
  token: string,
  accountId: string,
  containerId: string,
  containerName: string,
  containerPublicId: string,
  packageEntities: { tags: GTMTag[]; variables: GTMVariable[]; triggers: GTMTrigger[] }
): Promise<ContainerDiff> {
  // Get default workspace
  const workspace = await getDefaultWorkspace(token, accountId, containerId);
  const wsId = workspace.workspaceId;

  // Fetch existing entities in parallel
  const [tagsRes, variablesRes, triggersRes] = await Promise.all([
    listTags(token, accountId, containerId, wsId),
    listVariables(token, accountId, containerId, wsId),
    listTriggers(token, accountId, containerId, wsId),
  ]);

  const existingTags = extractExisting((tagsRes.tag ?? []) as Record<string, unknown>[], 'tagId');
  const existingVariables = extractExisting((variablesRes.variable ?? []) as Record<string, unknown>[], 'variableId');
  const existingTriggers = extractExisting((triggersRes.trigger ?? []) as Record<string, unknown>[], 'triggerId');

  const entities: DiffEntity[] = [
    ...buildDiffEntities('trigger', packageEntities.triggers, existingTriggers),
    ...buildDiffEntities('variable', packageEntities.variables, existingVariables),
    ...buildDiffEntities('tag', packageEntities.tags, existingTags),
  ];

  return {
    containerId,
    containerName,
    containerPublicId,
    defaultWorkspaceId: wsId,
    entities,
    status: 'ready',
  };
}
