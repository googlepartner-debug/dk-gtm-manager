import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

const features = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 5h14v2.5H3V5zm0 4h14v2.5H3V9zm0 4h10v2.5H3V13z" fill="currentColor"/>
      </svg>
    ),
    title: 'Déploiement bulk',
    desc: 'Tous vos containers GTM en une seule opération',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="3" width="16" height="5" rx="2" fill="currentColor" opacity="0.7"/>
        <rect x="2" y="10" width="16" height="7" rx="2" fill="currentColor" opacity="0.3"/>
        <path d="M6 13h8M6 15h5" stroke="white" strokeWidth="1.25" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Packages réutilisables',
    desc: 'Sauvegardez et réutilisez vos configurations GTM',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
        <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Historique complet',
    desc: 'Tracez et retrouvez chaque déploiement',
  },
];

export function Landing() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, hsl(283 100% 7%) 0%, hsl(267 80% 12%) 40%, hsl(283 100% 11%) 100%)' }}
    >
      {/* Header */}
      <header className="px-8 py-5 flex items-center gap-3">
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
            <span className="text-white font-bold text-sm tracking-tight">GTM Manager</span>
            <span
              className="ml-2 text-[10px] font-semibold tracking-widest uppercase"
              style={{ color: 'hsl(46 100% 50%)' }}
            >
              by Digital Keys
            </span>
          </div>
        </div>

        <div className="ml-3">
          <span
            className="text-xs font-semibold px-2.5 py-0.5 rounded-full border"
            style={{
              backgroundColor: 'hsl(267 100% 59% / 0.15)',
              borderColor: 'hsl(267 100% 59% / 0.3)',
              color: 'hsl(267 80% 85%)',
            }}
          >
            beta
          </span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full text-center dk-fade-in-up">

          {/* Logo icon */}
          <div className="relative mx-auto mb-8 w-20 h-20">
            <div
              className="absolute inset-0 rounded-2xl opacity-30 blur-xl"
              style={{ background: 'hsl(267 100% 59%)' }}
            />
            <div
              className="relative w-20 h-20 rounded-2xl flex items-center justify-center border"
              style={{
                background: 'hsl(267 100% 59% / 0.15)',
                borderColor: 'hsl(267 100% 59% / 0.3)',
              }}
            >
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <rect x="3" y="9" width="30" height="20" rx="3" stroke="hsl(267 100% 75%)" strokeWidth="2"/>
                <path d="M3 15h30" stroke="hsl(267 100% 75%)" strokeWidth="2"/>
                <rect x="7" y="19" width="6" height="6" rx="1.5" fill="hsl(46 100% 50%)" opacity="0.8"/>
                <rect x="15" y="19" width="6" height="6" rx="1.5" fill="hsl(267 100% 75%)" opacity="0.6"/>
                <rect x="23" y="19" width="6" height="6" rx="1.5" fill="hsl(267 100% 75%)" opacity="0.4"/>
              </svg>
            </div>
          </div>

          <h1
            className="text-4xl font-extrabold mb-4 tracking-tight"
            style={{ color: 'hsl(0 0% 98%)' }}
          >
            GTM Multi-Container
            <br />
            <span style={{ color: 'hsl(46 100% 50%)' }}>Publisher</span>
          </h1>

          <p className="text-base mb-2 leading-relaxed" style={{ color: 'hsl(267 60% 80%)' }}>
            Déployez tags, variables et déclencheurs sur{' '}
            <strong className="text-white">tous vos conteneurs GTM</strong> en un seul clic.
          </p>
          <p className="text-sm mb-10" style={{ color: 'hsl(267 40% 65%)' }}>
            Conçu pour les clients avec datalayer unifié.
          </p>

          {/* Features */}
          <div className="grid grid-cols-3 gap-3 mb-10 text-left">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="rounded-xl p-3.5 border dk-fade-in-up"
                style={{
                  background: 'hsl(267 100% 59% / 0.08)',
                  borderColor: 'hsl(267 100% 59% / 0.2)',
                  '--dk-stagger-delay': `${i * 80}ms`,
                } as React.CSSProperties}
              >
                <div className="mb-2" style={{ color: 'hsl(46 100% 50%)' }}>{f.icon}</div>
                <div className="text-white text-xs font-semibold mb-1">{f.title}</div>
                <div className="text-xs leading-relaxed" style={{ color: 'hsl(267 40% 65%)' }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Button
            size="lg"
            onClick={() => navigate('/dashboard/containers')}
            className="w-full max-w-xs mx-auto"
          >
            Accéder à l'outil →
          </Button>

          <p className="text-xs mt-4" style={{ color: 'hsl(267 40% 55%)' }}>
            Connexion Google à configurer ultérieurement
          </p>
        </div>
      </main>

      <footer className="text-center py-4 text-xs" style={{ color: 'hsl(267 40% 45%)' }}>
        Digital Keys © 2026
      </footer>
    </div>
  );
}
