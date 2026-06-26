import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';

const nav = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5"/>
      </svg>
    ),
    label: 'Containers',
    to: '/dashboard/containers',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="2" width="14" height="3" rx="1" fill="currentColor"/>
        <rect x="1" y="7" width="10" height="2.5" rx="1" fill="currentColor" opacity="0.6"/>
        <rect x="1" y="11.5" width="12" height="2.5" rx="1" fill="currentColor" opacity="0.4"/>
      </svg>
    ),
    label: 'Packages',
    to: '/dashboard/packages',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5L10.5 6H15L11.5 9l1.5 5L8 11.5 3 14l1.5-5L1 6h4.5L8 1.5z" fill="currentColor" opacity="0.8"/>
      </svg>
    ),
    label: 'Déployer',
    to: '/dashboard/deploy',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="4" height="4" rx="1" fill="currentColor" opacity="0.4"/>
        <rect x="6" y="1" width="4" height="4" rx="1" fill="currentColor"/>
        <rect x="11" y="1" width="4" height="4" rx="1" fill="currentColor" opacity="0.6"/>
        <rect x="1" y="6" width="4" height="4" rx="1" fill="currentColor"/>
        <rect x="6" y="6" width="4" height="4" rx="1" fill="currentColor" opacity="0.3"/>
        <rect x="11" y="6" width="4" height="4" rx="1" fill="currentColor"/>
        <rect x="1" y="11" width="4" height="4" rx="1" fill="currentColor" opacity="0.6"/>
        <rect x="6" y="11" width="4" height="4" rx="1" fill="currentColor"/>
        <rect x="11" y="11" width="4" height="4" rx="1" fill="currentColor" opacity="0.2"/>
      </svg>
    ),
    label: 'Monitoring',
    to: '/dashboard/monitoring',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12v1.5H2V4zm1.5 3.5h9v1.5h-9V7.5zm1.5 3.5h6v1.5H5V11z" fill="currentColor"/>
      </svg>
    ),
    label: 'Historique',
    to: '/dashboard/history',
  },
];

export function Sidebar() {
  return (
    <aside className="w-52 shrink-0 flex flex-col border-r" style={{ backgroundColor: 'hsl(220 20% 97%)', borderColor: 'hsl(220 13% 91%)' }}>
      {/* Logo */}
      <div className="px-4 py-5 border-b" style={{ borderColor: 'hsl(220 13% 91%)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, hsl(267 100% 59%), hsl(283 100% 11%))' }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M2 3.5h11v2H2v-2zm0 3.5h7v2H2V7zm0 3.5h9v2H2v-2z" fill="white"/>
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold tracking-tight text-foreground leading-none">GTM Manager</div>
            <div className="text-[10px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: 'hsl(267 100% 59%)' }}>
              Digital Keys
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-card text-foreground shadow-card border border-border'
                  : 'text-muted-fg hover:bg-card hover:text-foreground'
              )
            }
            style={({ isActive }) =>
              isActive
                ? { borderLeftWidth: '3px', borderLeftColor: 'hsl(46 100% 50%)', paddingLeft: 'calc(0.75rem - 3px + 2px)' }
                : { borderLeftWidth: '3px', borderLeftColor: 'transparent' }
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-3 border-t" style={{ borderColor: 'hsl(220 13% 91%)' }}>
        <a
          href="https://tagmanager.google.com"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-xs text-muted-fg hover:text-foreground transition-colors rounded-lg hover:bg-card"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M7 1h4v4M11 1L5 7M3 2H1.5A1.5 1.5 0 000 3.5v7A1.5 1.5 0 001.5 12h7A1.5 1.5 0 0010 10.5V9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Ouvrir GTM
        </a>
      </div>
    </aside>
  );
}
