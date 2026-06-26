import { useAuthStore } from '../../store/auth-store';
import { useGTMStore } from '../../store/gtm-store';
import { Button } from '../ui/Button';

export function Header() {
  const { userEmail, userName, userPicture, logout } = useAuthStore();
  const { selectedAccountId, accounts } = useGTMStore();
  const account = accounts.find((a) => a.accountId === selectedAccountId);

  return (
    <header className="h-14 bg-card border-b border-border flex items-center px-5 gap-4 shrink-0 sticky top-0 z-10" style={{ backdropFilter: 'blur(4px)' }}>
      {/* Account pill */}
      {account && (
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border"
          style={{ backgroundColor: 'hsl(267 100% 59% / 0.08)', borderColor: 'hsl(267 100% 59% / 0.2)', color: 'hsl(267 100% 59%)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(267 100% 59%)' }} />
          <span className="max-w-[180px] truncate">{account.name}</span>
        </div>
      )}

      <div className="flex-1" />

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
            className="w-8 h-8 rounded-full ring-2"
            style={{ ringColor: 'hsl(267 100% 59% / 0.3)' }}
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, hsl(267 100% 59%), hsl(283 100% 11%))' }}
          >
            {(userName ?? userEmail ?? 'U').charAt(0).toUpperCase()}
          </div>
        )}

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
