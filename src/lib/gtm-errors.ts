// Translates the raw `GTM API ###: {...json...}` strings thrown by gtm-api.ts's request()
// into messages a consultant can act on, instead of dumping Google's raw error JSON on screen.

export interface FriendlyGtmError {
  message: string;
  isAuthError: boolean; // 401 — token expired, needs reconnect rather than "retry"
}

const STATUS_MESSAGES: Record<number, string> = {
  400: "Requête invalide envoyée à l'API GTM.",
  403: "Accès refusé — ce compte Google n'a pas les droits sur ce container GTM.",
  404: 'Ressource introuvable — le compte ou le container a peut-être été supprimé.',
  429: 'Limite de requêtes GTM atteinte. Réessayez dans quelques minutes.',
  500: "Erreur interne de l'API GTM. Réessayez.",
  502: "L'API GTM est temporairement indisponible (502). Réessayez dans quelques secondes.",
  503: "L'API GTM est temporairement indisponible (503). Réessayez dans quelques secondes.",
};

export function friendlyGtmError(raw: string | null | undefined): FriendlyGtmError | null {
  if (!raw) return null;

  const match = raw.match(/GTM API (\d{3}):/);
  const status = match ? parseInt(match[1], 10) : null;

  if (status === 401) {
    return { message: 'Votre session Google a expiré — reconnectez-vous pour continuer.', isAuthError: true };
  }
  if (status && STATUS_MESSAGES[status]) {
    return { message: STATUS_MESSAGES[status], isAuthError: false };
  }
  if (raw.includes('Failed to fetch') || raw.includes('NetworkError')) {
    return { message: 'Connexion interrompue — vérifiez votre connexion internet.', isAuthError: false };
  }

  // Fallback — never show the raw JSON body, keep only the leading sentence if any.
  const cleaned = raw.replace(/^Error:\s*/, '').split('{')[0].trim();
  return { message: cleaned || 'Une erreur inattendue est survenue.', isAuthError: false };
}
