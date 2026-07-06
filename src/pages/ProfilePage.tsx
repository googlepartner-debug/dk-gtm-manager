import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore, PROFILE_COLORS, type Profile } from '../store/profile-store';
import { useGTMStore } from '../store/gtm-store';
import { DKGTMLogo } from '../components/ui/DKGTMLogo';

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${d}j`;
}

function Avatar({ profile, size = 40 }: { profile: Profile; size?: number }) {
  const color = PROFILE_COLORS[profile.colorIndex];
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: `hsl(${color})` }}
    >
      {profile.name.charAt(0).toUpperCase()}
    </div>
  );
}

export function ProfilePage() {
  const { profiles, activeProfileId, setActiveProfile, addProfile, removeProfile } = useProfileStore();
  const { loadForProfile } = useGTMStore();
  const navigate = useNavigate();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  function handleSelect(id: string) {
    setActiveProfile(id);
    loadForProfile(id);
    navigate('/dashboard/containers', { replace: true });
  }

  function handleAdd() {
    const profile = addProfile(newName);
    if (profile) {
      setNewName('');
      setIsAdding(false);
      handleSelect(profile.id);
    }
  }

  function handleRemove(id: string) {
    removeProfile(id);
    setConfirmRemove(null);
  }

  const hasProfiles = profiles.length > 0;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: 'hsl(220 20% 97%)' }}
    >
      <div style={{ width: '100%', maxWidth: 520 }}>

        {/* Logo */}
        <div className="mb-10 flex justify-center">
          <DKGTMLogo variant="light" size="md" showProduct />
        </div>

        {/* Heading */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-foreground">
            {hasProfiles ? 'Choisissez votre espace de travail' : 'Créez votre premier espace de travail'}
          </h1>
          <p className="text-xs mt-1" style={{ color: 'hsl(220 13% 50%)' }}>
            Chaque consultant a son espace isolé — scan data et actions planifiées sont séparés.
          </p>
        </div>

        {/* Profile grid */}
        <div className="grid grid-cols-2 gap-3">
          {profiles.map((profile) => {
            const color = PROFILE_COLORS[profile.colorIndex];
            const isActive = profile.id === activeProfileId;
            return (
              <div key={profile.id} className="relative group">
                <button
                  onClick={() => handleSelect(profile.id)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border bg-white text-left transition-all hover:shadow-md hover:-translate-y-px"
                  style={{
                    borderColor: isActive ? `hsl(${color})` : 'hsl(220 13% 91%)',
                    boxShadow: isActive ? `0 0 0 2px hsl(${color} / 0.15)` : undefined,
                  }}
                >
                  <Avatar profile={profile} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground truncate">{profile.name}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'hsl(220 13% 55%)' }}>
                      {profile.lastActiveAt
                        ? `Actif ${formatRelative(profile.lastActiveAt)}`
                        : 'Jamais utilisé'}
                    </div>
                  </div>
                  {isActive && (
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: `hsl(${color})` }}
                    />
                  )}
                </button>

                {/* Remove button — visible on hover */}
                {confirmRemove === profile.id ? (
                  <div className="absolute top-2 right-2 flex gap-1 bg-white rounded-lg shadow-sm border p-1"
                    style={{ borderColor: 'hsl(220 13% 88%)' }}>
                    <button
                      onClick={() => handleRemove(profile.id)}
                      className="text-[10px] px-2 py-0.5 rounded font-medium text-white"
                      style={{ backgroundColor: 'hsl(0 70% 50%)' }}
                    >
                      Supprimer
                    </button>
                    <button
                      onClick={() => setConfirmRemove(null)}
                      className="text-[10px] px-2 py-0.5 rounded"
                      style={{ color: 'hsl(220 13% 45%)' }}
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmRemove(profile.id); }}
                    className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: 'hsl(220 13% 93%)', color: 'hsl(220 13% 50%)' }}
                    title="Supprimer cet espace"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
            );
          })}

          {/* Add profile card */}
          {isAdding ? (
            <div
              className="flex flex-col gap-2.5 p-4 rounded-xl border bg-white"
              style={{ borderColor: 'hsl(267 100% 59% / 0.4)' }}
            >
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') { setIsAdding(false); setNewName(''); }
                }}
                placeholder="Votre prénom..."
                autoFocus
                maxLength={30}
                className="text-sm px-3 py-2 rounded-lg border outline-none transition-all"
                style={{ borderColor: newName ? 'hsl(267 100% 59%)' : 'hsl(220 13% 85%)' }}
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim()}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg text-white transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: 'hsl(267 100% 59%)' }}
                >
                  Créer et entrer
                </button>
                <button
                  onClick={() => { setIsAdding(false); setNewName(''); }}
                  className="py-1.5 px-2.5 text-xs rounded-lg border transition-colors"
                  style={{ borderColor: 'hsl(220 13% 85%)', color: 'hsl(220 13% 45%)' }}
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-dashed bg-white transition-all hover:border-foreground hover:shadow-sm"
              style={{ borderColor: 'hsl(220 13% 80%)', minHeight: 80 }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'hsl(220 13% 93%)', color: 'hsl(220 13% 50%)' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="text-xs font-medium" style={{ color: 'hsl(220 13% 50%)' }}>
                Ajouter un profil
              </span>
            </button>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-[11px] mt-8" style={{ color: 'hsl(220 13% 60%)' }}>
          Connecté en tant que <strong>googlepartner@digitalkeys.fr</strong>
        </p>
      </div>
    </div>
  );
}
