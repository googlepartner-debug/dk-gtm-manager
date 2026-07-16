import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import { FeedbackDrawer } from '../ui/FeedbackDrawer';

const navGroups = [
  {
    label: 'Config GTM',
    items: [
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
    ],
  },
  {
    label: 'Réalité & Plan',
    items: [
      {
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="6.5" width="4" height="8" rx="1" fill="currentColor" opacity="0.5"/>
            <rect x="6" y="3" width="4" height="11.5" rx="1" fill="currentColor"/>
            <rect x="11" y="1" width="4" height="13.5" rx="1" fill="currentColor" opacity="0.7"/>
          </svg>
        ),
        label: 'DataLayer Mapping',
        to: '/dashboard/datalayer-mapping',
      },
      {
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 2h6l3 3v9H4V2z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" fill="none" opacity="0.7"/>
            <path d="M6 7h4M6 9.5h4M6 12h2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
          </svg>
        ),
        label: 'Plan de tracking',
        to: '/dashboard/tracking-plan',
      },
    ],
  },
  {
    label: 'Publication',
    items: [
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
    ],
  },
];

export function Sidebar() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <aside className="w-52 shrink-0 flex flex-col border-r border-sidebar-border bg-sidebar-bg">
      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-fg/70">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1',
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
              </NavLink>
            ))}
          </div>
        ))}
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
          title="Ouvrir Google Tag Manager (nouvel onglet)"
          className="flex items-center gap-2 px-3 py-2 text-xs text-muted-fg hover:text-foreground transition-colors rounded-lg hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1"
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
