import type { GTMAccount, GTMContainer, GTMWorkspace, GTMTag, GTMVariable, GTMTrigger } from '../types/gtm';

const BASE = 'https://tagmanager.googleapis.com/tagmanager/v2';

async function request<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GTM API ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export async function listAccounts(token: string): Promise<GTMAccount[]> {
  const data = await request<{ account?: GTMAccount[] }>('/accounts', token);
  return data.account ?? [];
}

// ─── Containers ───────────────────────────────────────────────────────────────

export async function listContainers(token: string, accountId: string): Promise<GTMContainer[]> {
  const data = await request<{ container?: GTMContainer[] }>(
    `/accounts/${accountId}/containers`,
    token
  );
  return data.container ?? [];
}

// ─── Workspaces ───────────────────────────────────────────────────────────────

export async function createWorkspace(
  token: string,
  accountId: string,
  containerId: string,
  name: string,
  description?: string
): Promise<GTMWorkspace> {
  return request<GTMWorkspace>(
    `/accounts/${accountId}/containers/${containerId}/workspaces`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ name, description: description ?? '' }),
    }
  );
}

export async function getDefaultWorkspace(
  token: string,
  accountId: string,
  containerId: string
): Promise<GTMWorkspace> {
  const data = await request<{ workspace?: GTMWorkspace[] }>(
    `/accounts/${accountId}/containers/${containerId}/workspaces`,
    token
  );
  const workspaces = data.workspace ?? [];
  // Use "Default Workspace" if present, otherwise first
  return workspaces.find((w) => w.name === 'Default Workspace') ?? workspaces[0];
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export async function createTag(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string,
  tag: GTMTag
): Promise<unknown> {
  return request(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags`,
    token,
    { method: 'POST', body: JSON.stringify(tag) }
  );
}

export async function listTags(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string
): Promise<{ tag?: { name: string; type: string; tagId: string }[] }> {
  return request(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags`,
    token
  );
}

export async function listTagsFull(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string
): Promise<GTMTag[]> {
  const data = await request<{ tag?: GTMTag[] }>(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags`,
    token
  );
  return data.tag ?? [];
}

// ─── Variables ────────────────────────────────────────────────────────────────

export async function createVariable(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string,
  variable: GTMVariable
): Promise<unknown> {
  return request(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables`,
    token,
    { method: 'POST', body: JSON.stringify(variable) }
  );
}

export async function listVariables(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string
): Promise<{ variable?: { name: string; type: string; variableId: string }[] }> {
  return request(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables`,
    token
  );
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

export async function createTrigger(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string,
  trigger: GTMTrigger
): Promise<unknown> {
  return request(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers`,
    token,
    { method: 'POST', body: JSON.stringify(trigger) }
  );
}

export async function listTriggers(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string
): Promise<{ trigger?: { name: string; type: string; triggerId: string }[] }> {
  return request(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers`,
    token
  );
}

// ─── Update (PUT) ─────────────────────────────────────────────────────────────

export async function updateTag(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string,
  tagId: string,
  tag: GTMTag
): Promise<unknown> {
  return request(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}`,
    token,
    { method: 'PUT', body: JSON.stringify(tag) }
  );
}

export async function updateVariable(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string,
  variableId: string,
  variable: GTMVariable
): Promise<unknown> {
  return request(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
    token,
    { method: 'PUT', body: JSON.stringify(variable) }
  );
}

export async function updateTrigger(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string,
  triggerId: string,
  trigger: GTMTrigger
): Promise<unknown> {
  return request(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`,
    token,
    { method: 'PUT', body: JSON.stringify(trigger) }
  );
}

// ─── Version + Publish ────────────────────────────────────────────────────────

export async function createVersion(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string,
  name: string,
  notes?: string
): Promise<{ containerVersion?: { containerVersionId: string } }> {
  return request(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}:create_version`,
    token,
    { method: 'POST', body: JSON.stringify({ name, notes: notes ?? '' }) }
  );
}

export async function publishVersion(
  token: string,
  accountId: string,
  containerId: string,
  versionId: string
): Promise<unknown> {
  return request(
    `/accounts/${accountId}/containers/${containerId}/versions/${versionId}:publish`,
    token,
    { method: 'POST' }
  );
}
