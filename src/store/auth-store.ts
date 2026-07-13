import { create } from 'zustand';
import { loadAuthState, saveAuthState, clearAuthState, fetchUserInfo, isEmailAllowed, GTM_SCOPES } from '../lib/auth';
import type { AuthState } from '../lib/auth';

interface AuthStore extends AuthState {
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
}

declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string; expires_in: number; error?: string }) => void;
          }) => { requestAccessToken: () => void };
          revoke: (accessToken: string, callback?: () => void) => void;
        };
      };
    };
  }
}

// Client ID is loaded from env at build time
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

export const useAuthStore = create<AuthStore>((set) => ({
  ...loadAuthState(),
  isLoading: false,
  error: null,

  login: async () => {
    set({ isLoading: true, error: null });

    if (!CLIENT_ID) {
      set({ isLoading: false, error: 'VITE_GOOGLE_CLIENT_ID non configuré — ajoutez-le dans .env.local' });
      return;
    }

    return new Promise<void>((resolve, reject) => {
      if (!window.google?.accounts?.oauth2) {
        set({ isLoading: false, error: 'Google Identity Services non chargé — vérifiez votre connexion.' });
        reject(new Error('Google Identity Services not loaded'));
        return;
      }
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: GTM_SCOPES,
        callback: async (response) => {
          if (response.error) {
            const msg = response.error === 'popup_closed_by_user'
              ? 'Connexion annulée.'
              : `Erreur Google : ${response.error}`;
            set({ isLoading: false, error: msg });
            reject(new Error(response.error));
            return;
          }
          try {
            const userInfo = await fetchUserInfo(response.access_token);

            if (!isEmailAllowed(userInfo.email)) {
              window.google.accounts.oauth2.revoke(response.access_token);
              set({
                isLoading: false,
                error: `Accès restreint — outil en phase de validation interne, réservé à l'équipe Digital Keys. Compte connecté : ${userInfo.email}.`,
              });
              reject(new Error('email_not_allowed'));
              return;
            }

            const state: AuthState = {
              accessToken: response.access_token,
              userEmail: userInfo.email,
              userName: userInfo.name,
              userPicture: userInfo.picture,
              expiresAt: Date.now() + response.expires_in * 1000,
            };
            saveAuthState(state);
            set({ ...state, isLoading: false, error: null });
            resolve();
          } catch (err) {
            set({ isLoading: false, error: 'Impossible de récupérer les infos utilisateur.' });
            reject(err);
          }
        },
      });
      client.requestAccessToken();
    });
  },

  logout: () => {
    clearAuthState();
    set({ accessToken: null, userEmail: null, userName: null, userPicture: null, expiresAt: null, error: null });
  },
}));
