import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth-store';
import { useGTMStore } from '../../store/gtm-store';
import { useProfileStore, PROFILE_COLORS } from '../../store/profile-store';
import { Button } from '../ui/Button';
import { DKGTMLogo } from '../ui/DKGTMLogo';

export function Header() {
  const { userEmail, userName, userPicture, logout } = useAuthStore();
  const { selectedAccountId, accounts, selectedContainerIds } = useGTMStore();
  const { profiles, activeProfileId } = useProfileStore();
  const selectedCount = selectedContainerIds.size;
  const navigate = useNavigate();
  const account = accounts.find((a) => a.accountId === selectedAccountId);
  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  return (
    <header className="h-14 bg-card border-b border-border flex items-center px-5 gap-4 shrink-0 sticky top-0 z-10" style={{ backdropFilter: 'blur(4px)' }}>
      {/* DK GTM Logo */}
      <DKGTMLogo variant="light" size="sm" />

      {/* Account pill */}
      {account && (
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border"
          style={{ backgroundColor: 'hsl(267 100% 59% / 0.08)', borderColor: 'hsl(267 100% 59% / 0.2)', color: 'hsl(267 100% 59%)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="max-w-[180px] truncate">{account.name}</span>
        </div>
      )}

      <div className="flex-1" />

      {/* Active profile pill */}
      {activeProfile && (
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all hover:shadow-sm"
          style={{ borderColor: `hsl(${PROFILE_COLORS[activeProfile.colorIndex]} / 0.3)`, backgroundColor: `hsl(${PROFILE_COLORS[activeProfile.colorIndex]} / 0.07)` }}
          title="Changer d'espace de travail"
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            style={{ backgroundColor: `hsl(${PROFILE_COLORS[activeProfile.colorIndex]})` }}
          >
            {activeProfile.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-medium" style={{ color: `hsl(${PROFILE_COLORS[activeProfile.colorIndex]})` }}>
            {activeProfile.name}
          </span>
        </button>
      )}

      {/* CTA "Publier" — en haut à droite du header global, comme le bouton Submit de GTM,
          plutôt qu'un badge dans le menu de gauche ou un bouton dupliqué dans le contenu de
          ContainersPage (retour utilisateur 2026-07-14). Visible dès qu'une sélection de
          containers existe, peu importe la page consultée. */}
      {selectedCount > 0 && (
        <Button size="sm" onClick={() => navigate('/dashboard/deploy')}>
          Publier
          <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold bg-white/20">
            {selectedCount}
          </span>
        </Button>
      )}

      {/* Séparateur — l'espace de travail DK (pill ci-dessus) et le compte Google (ci-dessous)
          sont deux notions distinctes (un compte Google partagé entre plusieurs consultants
          DK, cf. CLAUDE.md) qui se ressemblaient trop visuellement sans cette coupure. */}
      {activeProfile && <div className="w-px h-6 bg-border" />}

      {/* User */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-xs font-semibold text-foreground leading-none">{userName}</div>
          <div className="text-xs text-muted-fg mt-0.5">{userEmail}</div>
        </div>

        {userPicture ? (
          <img
            src={userPicture}
            alt={userName ?? ''}
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full"
            style={{ outline: '2px solid hsl(267 100% 59% / 0.3)' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex'); }}
          />
        ) : null}
        <div
          className="w-8 h-8 rounded-full items-center justify-center text-xs font-bold text-white"
          style={{ background: 'linear-gradient(135deg, hsl(267 100% 59%), hsl(283 100% 11%))', display: userPicture ? 'none' : 'flex' }}
        >
          {(userName ?? userEmail ?? 'U').charAt(0).toUpperCase()}
        </div>

        <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5M9 9.5l3-2.5-3-2.5M5.5 7h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Déconnexion
        </Button>
      </div>
    </header>
  );
}
