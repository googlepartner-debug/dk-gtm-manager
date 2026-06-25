import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';

const nav = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.5"/>
        <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor"/>
        <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor"/>
        <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.5"/>
      </svg>
    ),
    label: 'Containers',
    to: '/dashboard/containers',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12v2H2V4zm0 3h12v2H2V7zm0 3h8v2H2v-2z" fill="currentColor"/>
      </svg>
    ),
    label: 'Packages',
    to: '/dashboard/packages',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1l2.5 4.5L16 6.5l-4 4 .9 5.5L8 13.5l-4.9 2.5.9-5.5-4-4L5.5 5.5 8 1z" fill="currentColor" opacity="0.7"/>
      </svg>
    ),
    label: 'Déployer',
    to: '/dashboard/deploy',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1 3h14v2H1V3zm2 4h10v2H3V7zm2 4h6v2H5v-2z" fill="currentColor"/>
      </svg>
    ),
    label: 'Historique',
    to: '/dashboard/history',
  },
];

export function Sidebar() {
  return (
    <aside className="w-52 shrink-0 bg-white border-r border-slate-200 flex flex-col py-4">
      <div className="px-3 mb-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3">Navigation</span>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 mt-4 pt-4 border-t border-slate-100">
        <a
          href="https://tagmanager.google.com"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" transform="rotate(45 6 6)"/>
          </svg>
          Ouvrir GTM
        </a>
      </div>
    </aside>
  );
}
