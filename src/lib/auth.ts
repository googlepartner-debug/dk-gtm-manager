// Google OAuth via GIS (Google Identity Services)
// Scopes required for GTM full access

export const GTM_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/tagmanager.readonly',
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
  'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
  'https://www.googleapis.com/auth/tagmanager.publish',
].join(' ');

// ─── Access allowlist ───────────────────────────────────────────────────────
// TEMPORAIRE (§12 du PRD, plan de validation) : l'outil est en phase de
// validation interne DK, avant l'ouverture à PFS.
//
// La vraie barrière de sécurité est configurée dans GCP (écran de consentement
// OAuth du projet `gtm-wbncv54-ngq1n` passé en type "Interne") : Google refuse
// la connexion à tout compte hors de l'organisation @digitalkeys.fr avant même
// que ce code ne s'exécute — ça, c'est infalsifiable côté client.
//
// Ce check-ci n'est qu'un garde-fou de confort par-dessus : il évite qu'un
// AUTRE consultant @digitalkeys.fr légitime se connecte par erreur à cet outil
// précis pendant la phase interne. Contournable en éditant le bundle JS —
// ne pas s'y fier comme barrière de sécurité.
// Ajouter les comptes @perfectstay.com ici au moment de l'onboarding PFS (§10).
const ALLOWED_EMAILS = ['googlepartner@digitalkeys.fr'];

export function isEmailAllowed(email: string): boolean {
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}

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
    // Invalidate anything persisted under an email removed from the allowlist since
    // (e.g. the allowlist shrank, or a stale session predates this check).
    if (parsed.userEmail && !isEmailAllowed(parsed.userEmail)) {
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
