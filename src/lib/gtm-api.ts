import type { GTMAccount, GTMContainer, GTMWorkspace, GTMTag, GTMVariable, GTMTrigger } from '../types/gtm';

const BASE = 'https://tagmanager.googleapis.com/tagmanager/v2';

// ─── Global rate limiter ───────────────────────────────────────────────────────
// GTM API quota: 30 queries/minute/user. We cap at 25 to leave a buffer for
// retries and timing jitter. Every request() call acquires a slot first.
// Sliding-window: tracks actual timestamps so there are no burst-then-starve cycles.

function makeSlidingWindowLimiter(maxCalls: number, windowMs: number) {
  const timestamps: number[] = [];
  return async function acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      const cutoff = now - windowMs;
      while (timestamps.length > 0 && timestamps[0] <= cutoff) timestamps.shift();
      if (timestamps.length < maxCalls) { timestamps.push(now); return; }
      const waitMs = timestamps[0] + windowMs - now + 100;
      await new Promise<void>((r) => setTimeout(r, Math.max(waitMs, 100)));
    }
  };
}

const acquireSlot = makeSlidingWindowLimiter(25, 60_000);

async function request<T>(path: string, token: string, options?: RequestInit, attempt = 0): Promise<T> {
  // Acquire a quota slot before every API call — this is the single chokepoint
  // that prevents 429s regardless of how many callers run concurrently.
  await acquireSlot();

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  // On 429 the limiter was too optimistic (clock skew or server-side burst limit).
  // Back off and retry without re-acquiring a slot (we already have one).
  if ((res.status === 503 || res.status === 429) && attempt < 3) {
    const delay = (attempt + 1) * 15_000; // 15s, 30s, 45s — quota window is 60s
    console.warn(`[GTM] ${res.status} — retry ${attempt + 1}/3 dans ${delay / 1000}s`);
    await new Promise((r) => setTimeout(r, delay));
    return request<T>(path, token, options, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GTM API ${res.status}: ${body}`);
  }
  if (res.status === 204) return null as T;
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
  const containers = data.container ?? [];
  if (containers.length > 0) {
    console.log('[GTM] fingerprint sample:', containers[0].name, '→', containers[0].fingerprint);
  }
  return containers;
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

export async function listVariablesFull(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string
): Promise<import('../types/gtm').GTMVariable[]> {
  const data = await request<{ variable?: import('../types/gtm').GTMVariable[] }>(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables`,
    token
  );
  return data.variable ?? [];
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

export async function listTriggersFull(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string
): Promise<import('../types/gtm').GTMTrigger[]> {
  const data = await request<{ trigger?: import('../types/gtm').GTMTrigger[] }>(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers`,
    token
  );
  return data.trigger ?? [];
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

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteVariable(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string,
  variableId: string,
): Promise<void> {
  await request<null>(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
    token,
    { method: 'DELETE' },
  );
}

export async function deleteTrigger(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string,
  triggerId: string,
): Promise<void> {
  await request<null>(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`,
    token,
    { method: 'DELETE' },
  );
}

export async function deleteTag(
  token: string,
  accountId: string,
  containerId: string,
  workspaceId: string,
  tagId: string,
): Promise<void> {
  await request<null>(
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}`,
    token,
    { method: 'DELETE' },
  );
}

// ─── Live version (publication date) ─────────────────────────────────────────

export async function getLiveVersion(
  token: string,
  accountId: string,
  containerId: string
): Promise<{ fingerprint?: string } | null> {
  try {
    const data = await request<{ fingerprint?: string }>(
      `/accounts/${accountId}/containers/${containerId}/versions:live`,
      token
    );
    return data;
  } catch {
    return null;
  }
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
