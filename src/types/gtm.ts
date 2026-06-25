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
