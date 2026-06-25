import { create } from 'zustand';
import { loadAuthState, saveAuthState, clearAuthState, fetchUserInfo, GTM_SCOPES } from '../lib/auth';
import type { AuthState } from '../lib/auth';

interface AuthStore extends AuthState {
  isLoading: boolean;
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

  login: async () => {
    set({ isLoading: true });
    return new Promise<void>((resolve, reject) => {
      if (!window.google?.accounts?.oauth2) {
        set({ isLoading: false });
        reject(new Error('Google Identity Services not loaded'));
        return;
      }
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: GTM_SCOPES,
        callback: async (response) => {
          if (response.error) {
            set({ isLoading: false });
            reject(new Error(response.error));
            return;
          }
          try {
            const userInfo = await fetchUserInfo(response.access_token);
            const state: AuthState = {
              accessToken: response.access_token,
              userEmail: userInfo.email,
              userName: userInfo.name,
              userPicture: userInfo.picture,
              expiresAt: Date.now() + response.expires_in * 1000,
            };
            saveAuthState(state);
            set({ ...state, isLoading: false });
            resolve();
          } catch (err) {
            set({ isLoading: false });
            reject(err);
          }
        },
      });
      client.requestAccessToken();
    });
  },

  logout: () => {
    clearAuthState();
    set({ accessToken: null, userEmail: null, userName: null, userPicture: null, expiresAt: null });
  },
}));
