import { create } from 'zustand';

export const PROFILE_COLORS = [
  '267 100% 59%', // violet — DK brand
  '217 91% 60%',  // bleu
  '142 60% 45%',  // vert
  '0 70% 55%',    // rouge
  '38 90% 50%',   // orange
  '313 70% 55%',  // rose
];

export interface Profile {
  id: string;
  name: string;
  colorIndex: number;
  createdAt: string;
  lastActiveAt?: string;
}

interface ProfileStore {
  profiles: Profile[];
  activeProfileId: string | null;
  setActiveProfile: (id: string) => void;
  addProfile: (name: string) => Profile | null;
  removeProfile: (id: string) => void;
  updateLastActive: (id: string) => void;
}

const PROFILES_KEY = 'dk_gtm_profiles';
const ACTIVE_PROFILE_KEY = 'dk_gtm_active_profile';

function tryParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

const _profiles = tryParse<Profile[]>(localStorage.getItem(PROFILES_KEY), []);
const _rawActiveId = localStorage.getItem(ACTIVE_PROFILE_KEY);
const _activeId = _rawActiveId && _profiles.find((p) => p.id === _rawActiveId) ? _rawActiveId : null;

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profiles: _profiles,
  activeProfileId: _activeId,

  setActiveProfile: (id) => {
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    set({ activeProfileId: id });
    get().updateLastActive(id);
  },

  addProfile: (name) => {
    const { profiles } = get();
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = trimmed.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!id || profiles.find((p) => p.id === id)) return null;
    const colorIndex = profiles.length % PROFILE_COLORS.length;
    const newProfile: Profile = { id, name: trimmed, colorIndex, createdAt: new Date().toISOString() };
    const next = [...profiles, newProfile];
    localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
    set({ profiles: next });
    return newProfile;
  },

  removeProfile: (id) => {
    const { profiles, activeProfileId } = get();
    const next = profiles.filter((p) => p.id !== id);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
    try { localStorage.removeItem(`dk_gtm_monitoring_v1_${id}`); } catch { /* ignore */ }
    try { localStorage.removeItem(`dk_gtm_ops_v1_${id}`); } catch { /* ignore */ }
    try { localStorage.removeItem(`dk_datalayer_mapping_v1_${id}`); } catch { /* ignore */ }
    const nextActiveId = activeProfileId === id ? null : activeProfileId;
    if (activeProfileId === id) localStorage.removeItem(ACTIVE_PROFILE_KEY);
    set({ profiles: next, activeProfileId: nextActiveId });
  },

  updateLastActive: (id) => {
    const { profiles } = get();
    const next = profiles.map((p) =>
      p.id === id ? { ...p, lastActiveAt: new Date().toISOString() } : p,
    );
    localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
    set({ profiles: next });
  },
}));
