import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import { FeedbackDrawer } from '../ui/FeedbackDrawer';
import { DKGTMLogo } from '../ui/DKGTMLogo';
import { useGTMStore } from '../../store/gtm-store';

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
        <path d="M8 1.5l1.5 4h4l-3.25 2.5 1.25 4L8 9.5l-3.5 2.5 1.25-4L2.5 5.5h4L8 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" opacity="0.7"/>
        <path d="M8 6v3M6.5 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    label: 'Événements',
    to: '/dashboard/evenements',
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
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.25" opacity="0.5"/>
        <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
        <path d="M5 2.5L11 2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
    label: 'Contexte',
    to: '/dashboard/contexte',
  },
];

export function Sidebar() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const selectedCount = useGTMStore((s) => s.selectedContainerIds.size);

  return (
    <aside className="w-52 shrink-0 flex flex-col border-r border-sidebar-border bg-sidebar-bg">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <DKGTMLogo variant="light" size="sm" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {nav.map((item) => {
          const isDeploy = item.to === '/dashboard/deploy';
          return (
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
              // Note: borderLeftColor uses exact token color (accent) but requires inline style for left-side specificity
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {isDeploy && selectedCount > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none bg-primary text-white"
                >
                  {selectedCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-3 border-t border-sidebar-border space-y-0.5">
        <button
          onClick={() => setFeedbackOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-fg hover:text-foreground transition-colors rounded-lg hover:bg-card"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1C3.24 1 1 3.24 1 6c0 .83.21 1.61.58 2.3L1 11l2.7-.58A5 5 0 1011 6C11 3.24 8.76 1 6 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M4 6h4M4 7.5h2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          Proposer une amélioration
        </button>

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

      {feedbackOpen && <FeedbackDrawer onClose={() => setFeedbackOpen(false)} />}
    </aside>
  );
}
