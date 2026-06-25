import type { DeploymentPackage, DeploymentRecord } from '../types/gtm';

const PACKAGES_KEY = 'dk_gtm_packages';
const HISTORY_KEY = 'dk_gtm_history';

// ─── Packages ─────────────────────────────────────────────────────────────────

export function loadPackages(): DeploymentPackage[] {
  try {
    const raw = localStorage.getItem(PACKAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePackage(pkg: DeploymentPackage) {
  const packages = loadPackages();
  const idx = packages.findIndex((p) => p.id === pkg.id);
  if (idx >= 0) {
    packages[idx] = pkg;
  } else {
    packages.unshift(pkg);
  }
  localStorage.setItem(PACKAGES_KEY, JSON.stringify(packages));
}

export function deletePackage(id: string) {
  const packages = loadPackages().filter((p) => p.id !== id);
  localStorage.setItem(PACKAGES_KEY, JSON.stringify(packages));
}

// ─── History ──────────────────────────────────────────────────────────────────

export function loadHistory(): DeploymentRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDeploymentRecord(record: DeploymentRecord) {
  const history = loadHistory();
  history.unshift(record);
  // Keep last 50 records
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
}
