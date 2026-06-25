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
