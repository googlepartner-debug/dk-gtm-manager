import { useAuthStore } from '../../store/auth-store';
import { useGTMStore } from '../../store/gtm-store';
import { Button } from '../ui/Button';

export function Header() {
  const { userEmail, userName, userPicture, logout } = useAuthStore();
  const { selectedAccountId, accounts } = useGTMStore();
  const account = accounts.find((a) => a.accountId === selectedAccountId);

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-4 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-4">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 2.5h12v2H1v-2zm0 3.5h7v2H1V6zm0 3.5h9v2H1v-2z" fill="white"/>
          </svg>
        </div>
        <span className="font-semibold text-slate-900 text-sm">DK GTM Manager</span>
      </div>

      {/* Account pill */}
      {account && (
        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-full px-3 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-xs font-medium text-blue-700 max-w-[160px] truncate">{account.name}</span>
        </div>
      )}

      <div className="flex-1" />

      {/* User */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-xs font-medium text-slate-900 leading-none">{userName}</div>
          <div className="text-xs text-slate-400 mt-0.5">{userEmail}</div>
        </div>
        {userPicture ? (
          <img src={userPicture} alt={userName ?? ''} className="w-8 h-8 rounded-full ring-2 ring-slate-200" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
            {(userName ?? userEmail ?? 'U').charAt(0).toUpperCase()}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={logout}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5M9 9.5l3-2.5-3-2.5M5.5 7h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Déconnexion
        </Button>
      </div>
    </header>
  );
}
