export interface GTMAccount {
  accountId: string;
  name: string;
  path: string;
}

export interface GTMContainer {
  containerId: string;
  accountId: string;
  name: string;
  publicId: string; // GTM-XXXXXX
  usageContext: string[];
  path: string;
  fingerprint: string;
  tagManagerUrl?: string;
}

export interface GTMWorkspace {
  workspaceId: string;
  accountId: string;
  containerId: string;
  name: string;
  description?: string;
  path: string;
  fingerprint: string;
}

export interface GTMTag {
  name: string;
  type: string;
  parameter?: GTMParameter[];
  firingTriggerId?: string[];
  blockingTriggerId?: string[];
  tagFiringOption?: string;
  monitoringMetadata?: { type: string };
  notes?: string;
}

export interface GTMVariable {
  name: string;
  type: string;
  parameter?: GTMParameter[];
  notes?: string;
}

export interface GTMTrigger {
  name: string;
  type: string;
  triggerId?: string;
  filter?: GTMCondition[];
  customEventFilter?: GTMCondition[];
  parameter?: GTMParameter[];
  notes?: string;
}

export interface GTMParameter {
  type: 'template' | 'boolean' | 'integer' | 'list' | 'map' | 'tagReference' | 'triggerReference';
  key?: string;
  value?: string;
  list?: GTMParameter[];
  map?: GTMParameter[];
}

export interface GTMCondition {
  type: string;
  parameter: GTMParameter[];
}

export interface DeploymentPackage {
  id: string;
  name: string;
  description?: string;
  client: string;
  createdAt: string;
  entities: {
    tags: GTMTag[];
    variables: GTMVariable[];
    triggers: GTMTrigger[];
  };
}

export interface DeploymentResult {
  containerId: string;
  containerName: string;
  containerPublicId: string;
  status: 'pending' | 'running' | 'success' | 'error';
  workspaceId?: string;
  versionId?: string;
  error?: string;
  steps: DeploymentStep[];
}

export interface DeploymentStep {
  label: string;
  status: 'pending' | 'running' | 'success' | 'error';
  detail?: string;
}

export interface DeploymentRecord {
  id: string;
  packageName: string;
  deployedAt: string;
  accountId: string;
  containers: DeploymentResult[];
}

// ─── Diff ─────────────────────────────────────────────────────────────────────

export type EntityKind = 'tag' | 'variable' | 'trigger';
export type EntityStatus = 'new' | 'modified' | 'unchanged';

export interface DiffEntity {
  key: string; // unique: `${kind}::${name}`
  kind: EntityKind;
  name: string;
  status: EntityStatus;
  selected: boolean;
  existingId?: string; // GTM entity ID if already exists
  proposed: GTMTag | GTMVariable | GTMTrigger;
  current?: GTMTag | GTMVariable | GTMTrigger; // current state in GTM (if exists)
}

export interface ContainerDiff {
  containerId: string;
  containerName: string;
  containerPublicId: string;
  defaultWorkspaceId: string;
  entities: DiffEntity[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
}

export interface GlobalDiffSummary {
  newCount: number;
  modifiedCount: number;
  unchangedCount: number;
  selectedCount: number;
}

// ─── Trigger operations queue ─────────────────────────────────────────────────

export type TriggerOpKind = 'remove' | 'sync';

export interface TriggerOpStep {
  containerId: string;
  containerName: string;
  publicId: string;
  unlink?: string[];          // trigger IDs to remove from tag's firingTriggerId
  linkExisting?: string[];    // trigger IDs to add (already exist in container)
  createAndLink?: GTMTrigger[]; // triggers to create then link
}

export interface TriggerOperation {
  id: string;
  kind: TriggerOpKind;
  tagRowKey: string;
  tagCategory: string;
  triggerName?: string;
  triggerSemanticKey?: string;
  referenceContainerId?: string;
  referenceContainerName?: string;
  steps: TriggerOpStep[];
  status: 'pending' | 'applied' | 'failed';
  createdAt: string;
  error?: string;
}

// ─── Rename queue ──────────────────────────────────────────────────────────────

export interface RenameOperation {
  id: string;
  rowKey: string;       // event_name or tag name (display label)
  category: string;
  containerId: string;
  containerName: string;
  publicId: string;
  oldName: string;
  newName: string;
  status: 'pending' | 'applied' | 'failed';
  createdAt: string;
  error?: string;
}
