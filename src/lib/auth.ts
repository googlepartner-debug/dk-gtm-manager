// Google OAuth via GIS (Google Identity Services)
// Scopes required for GTM full access

export const GTM_SCOPES = [
  'https://www.googleapis.com/auth/tagmanager.readonly',
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
  'https://www.googleapis.com/auth/tagmanager.publish',
].join(' ');

export interface AuthState {
  accessToken: string | null;
  userEmail: string | null;
  userName: string | null;
  userPicture: string | null;
  expiresAt: number | null;
}

const STORAGE_KEY = 'dk_gtm_auth';

export function loadAuthState(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyAuth();
    const parsed = JSON.parse(raw) as AuthState;
    // Invalidate if expired
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return emptyAuth();
    }
    return parsed;
  } catch {
    return emptyAuth();
  }
}

export function saveAuthState(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearAuthState() {
  localStorage.removeItem(STORAGE_KEY);
}

function emptyAuth(): AuthState {
  return { accessToken: null, userEmail: null, userName: null, userPicture: null, expiresAt: null };
}

// Parse user info from Google's userinfo endpoint
export async function fetchUserInfo(accessToken: string): Promise<{ email: string; name: string; picture: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch user info');
  return res.json();
}
