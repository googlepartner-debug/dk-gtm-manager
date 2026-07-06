import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { DKGTMLogo } from '../components/ui/DKGTMLogo';
import { useAuthStore } from '../store/auth-store';

const BULLETS = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="1" y="2" width="14" height="3.5" rx="1.75" fill="currentColor"/>
        <rect x="1" y="7.5" width="9" height="2.5" rx="1.25" fill="currentColor" opacity="0.6"/>
        <rect x="1" y="11" width="11" height="2.5" rx="1.25" fill="currentColor" opacity="0.35"/>
      </svg>
    ),
    text: 'Déployez tags, variables et triggers sur N containers en parallèle',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 11.5l3-3 2.5 2.5 3.5-4.5 3 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="1" y="1" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.25" opacity="0.35"/>
      </svg>
    ),
    text: 'Diff visuel avant chaque déploiement — aucune surprise en production',
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.8"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.4"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.4"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.8"/>
      </svg>
    ),
    text: 'Packages GTM réutilisables entre comptes clients',
  },
];

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
        <rect x="1" y="3" width="20" height="4.5" rx="2.25" fill="currentColor"/>
        <rect x="1" y="10" width="13" height="3.5" rx="1.75" fill="currentColor" opacity="0.55"/>
        <rect x="1" y="15" width="16" height="3.5" rx="1.75" fill="currentColor" opacity="0.3"/>
      </svg>
    ),
    title: 'Déploiement batch',
    desc: 'Sélectionnez vos containers, choisissez un package, lancez. Le déploiement s\'exécute container par container avec un journal en temps réel.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
        <path d="M4 16L9.5 9l3.5 3.5L17 7l2 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="1" y="1" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="1.4" opacity="0.3"/>
      </svg>
    ),
    title: 'Diff avant déploiement',
    desc: 'Comparez l\'état actuel du container avec le package à déployer. Choisissez entité par entité ce que vous synchronisez.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
        <path d="M5 11h12M12 5l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 5v12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
    title: 'Packages réutilisables',
    desc: 'Encapsulez une configuration GTM (tags GA4, consent, remarketing…) et déployez-la sur tous vos comptes clients en quelques clics.',
  },
];

export function Landing() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();

  async function handleLogin() {
    try {
      await login();
      navigate('/dashboard/containers');
    } catch {
      // error already set in store
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <DKGTMLogo variant="light" size="sm" showProduct={false} />
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] font-bold tracking-[0.2em] uppercase px-2.5 py-1 rounded-full border"
              style={{
                borderColor: 'hsl(267 100% 59% / 0.3)',
                color: 'var(--color-primary)',
                backgroundColor: 'hsl(267 100% 59% / 0.06)',
              }}
            >
              beta · LE LAB
            </span>
            <Button size="sm" onClick={handleLogin} disabled={isLoading}>
              {isLoading ? 'Connexion…' : 'Se connecter'}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pt-14 pb-16 lg:pt-16 lg:pb-20 w-full">
        {/* Radial blobs */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 left-0 h-72 w-72 rounded-full"
          style={{ background: 'radial-gradient(circle, hsl(267 100% 59% / 0.07), transparent 70%)' }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 h-48 w-48 rounded-full"
          style={{ background: 'radial-gradient(circle, hsl(46 100% 50% / 0.12), transparent 70%)' }}
        />

        <div className="relative grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:items-center">
          {/* Left */}
          <div>
            <p className="dk-fade-in-up inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              Digital Keys · Outil interne
            </p>

            <h1
              className="dk-fade-in-up mt-3 text-[28px] sm:text-[34px] lg:text-[40px] font-extrabold leading-[1.1] tracking-tight text-foreground"
              style={{ '--dk-stagger-delay': '80ms' } as React.CSSProperties}
            >
              Déployez GTM sur{' '}
              <span className="text-primary">tous vos containers</span>{' '}
              en un workflow
            </h1>

            <p
              className="dk-fade-in-up mt-4 text-[15px] text-muted-fg leading-relaxed max-w-lg"
              style={{ '--dk-stagger-delay': '160ms' } as React.CSSProperties}
            >
              DK GTM Manager centralise le déploiement batch de tags, variables et déclencheurs
              sur l'ensemble de vos comptes clients — avec diff visuel, packages réutilisables
              et journal de déploiement.
            </p>

            <ul className="mt-5 space-y-2.5" aria-label="Fonctionnalités clés">
              {BULLETS.map((b, i) => (
                <li
                  key={b.text}
                  className="dk-fade-in-up flex items-start gap-2.5 text-sm text-foreground"
                  style={{ '--dk-stagger-delay': `${240 + i * 60}ms` } as React.CSSProperties}
                >
                  <span className="mt-0.5 text-primary flex-shrink-0">{b.icon}</span>
                  <span>{b.text}</span>
                </li>
              ))}
            </ul>

            <div
              className="dk-fade-in-up mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
              style={{ '--dk-stagger-delay': '460ms' } as React.CSSProperties}
            >
              <Button size="lg" onClick={handleLogin} disabled={isLoading}>
                {isLoading ? 'Connexion en cours…' : 'Se connecter avec Google →'}
              </Button>
            </div>

            {error && (
              <p className="mt-3 text-xs text-destructive">{error}</p>
            )}

            {/* Trust strip */}
            <div
              className="dk-fade-in-up mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-fg"
              style={{ '--dk-stagger-delay': '540ms' } as React.CSSProperties}
            >
              <span className="inline-flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                  <path d="M6.5 1.5l1.2 3.7H11L8.1 7.4l1.2 3.7-2.8-2.1-2.8 2.1 1.2-3.7L2 5.2h3.3z" fill="currentColor" opacity="0.6"/>
                </svg>
                Accès OAuth Google sécurisé
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                  <rect x="1" y="1" width="4.5" height="4.5" rx="1" fill="currentColor" opacity="0.7"/>
                  <rect x="7.5" y="1" width="4.5" height="4.5" rx="1" fill="currentColor" opacity="0.4"/>
                  <rect x="1" y="7.5" width="4.5" height="4.5" rx="1" fill="currentColor" opacity="0.4"/>
                  <rect x="7.5" y="7.5" width="4.5" height="4.5" rx="1" fill="currentColor" opacity="0.7"/>
                </svg>
                Multi-comptes · Multi-containers
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                  <path d="M6.5 1.5C4 1.5 2 3.5 2 6s2 4.5 4.5 4.5S11 8.5 11 6 9 1.5 6.5 1.5z" stroke="currentColor" strokeWidth="1.1" fill="none" opacity="0.5"/>
                  <path d="M6.5 4v2.5l2 1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                </svg>
                API GTM v2 officielle
              </span>
            </div>
          </div>

          {/* Right — UI preview */}
          <div
            className="dk-fade-in-up hidden lg:flex justify-center items-center"
            style={{ '--dk-stagger-delay': '200ms' } as React.CSSProperties}
          >
            <div
              className="relative rounded-2xl border overflow-hidden shadow-card-hover"
              style={{
                width: 400,
                backgroundColor: 'hsl(240 12% 9%)',
                borderColor: 'hsl(240 10% 14%)',
              }}
            >
              {/* Window chrome */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b" style={{ borderColor: 'hsl(240 10% 13%)' }}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(0 70% 50% / 0.6)' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(46 100% 50% / 0.5)' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(142 70% 40% / 0.5)' }} />
                <div className="flex-1 mx-3 h-4 rounded" style={{ backgroundColor: 'hsl(240 10% 14%)' }} />
              </div>

              {/* Sidebar + content */}
              <div className="flex">
                {/* Sidebar */}
                <div className="w-36 border-r py-3 shrink-0" style={{ borderColor: 'hsl(240 10% 13%)', backgroundColor: 'hsl(240 14% 7%)' }}>
                  {['Containers', 'Packages', 'Déploiement', 'Historique'].map((item, i) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 px-3 py-2 mx-1.5 rounded-lg text-[10px] font-medium mb-0.5"
                      style={{
                        backgroundColor: i === 0 ? 'hsl(267 100% 59% / 0.12)' : 'transparent',
                        color: i === 0 ? 'hsl(267 80% 75%)' : 'hsl(240 10% 35%)',
                      }}
                    >
                      <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: i === 0 ? 'hsl(267 100% 59%)' : 'hsl(240 10% 22%)' }} />
                      {item}
                    </div>
                  ))}
                </div>

                {/* Content */}
                <div className="flex-1 p-4">
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-3" style={{ color: 'hsl(240 10% 30%)' }}>
                    Containers GTM
                  </div>
                  {[
                    { name: 'PerfectStay · FR', id: 'GTM-W4N2C54', checked: true },
                    { name: 'PerfectStay · UK', id: 'GTM-KX8J31P', checked: true },
                    { name: 'PerfectStay · DE', id: 'GTM-M7RV9QA', checked: false },
                    { name: 'ChaussetteOnline', id: 'GTM-WBNCV54', checked: false },
                    { name: 'Client E-Commerce', id: 'GTM-B3DL82T', checked: false },
                  ].map((row, i) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-2.5 py-2 border-b"
                      style={{ borderColor: 'hsl(240 10% 11%)', opacity: 1 - i * 0.15 }}
                    >
                      <div
                        className="w-3 h-3 rounded border shrink-0 flex items-center justify-center"
                        style={{
                          borderColor: row.checked ? 'hsl(267 100% 59%)' : 'hsl(240 10% 20%)',
                          backgroundColor: row.checked ? 'hsl(267 100% 59%)' : 'transparent',
                        }}
                      >
                        {row.checked && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-medium truncate" style={{ color: 'hsl(240 10% 70%)' }}>{row.name}</div>
                      </div>
                      <div className="text-[8px] font-mono shrink-0" style={{ color: 'hsl(267 50% 50%)' }}>{row.id}</div>
                    </div>
                  ))}
                  {/* Deploy button */}
                  <div className="mt-3 flex justify-end">
                    <div
                      className="text-[9px] font-bold px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: 'hsl(267 100% 59%)', color: 'white' }}
                    >
                      Déployer sur 2 containers →
                    </div>
                  </div>
                </div>
              </div>

              {/* Glow */}
              <div
                className="absolute -bottom-8 -right-8 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ backgroundColor: 'hsl(267 100% 59%)' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-14 lg:py-16">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">
            Fonctionnalités
          </p>
          <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-foreground">
            Tout ce qu'il faut pour gérer GTM à l'échelle d'une agence
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-background p-6">
                <span className="text-primary">{f.icon}</span>
                <h3 className="mt-4 text-base font-bold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-fg leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-6 py-16 w-full">
        <div
          className="rounded-2xl border p-8 sm:p-12 text-center"
          style={{
            borderColor: 'hsl(267 100% 59% / 0.3)',
            background: 'linear-gradient(135deg, hsl(267 100% 59% / 0.06), hsl(0 0% 100%), hsl(46 100% 50% / 0.07))',
          }}
        >
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            Prêt à déployer ?
          </h2>
          <p className="mt-3 text-muted-fg max-w-md mx-auto">
            Connectez-vous avec votre compte Google Digital Keys pour accéder à vos containers GTM.
          </p>
          <div className="mt-6">
            <Button size="lg" onClick={handleLogin} disabled={isLoading}>
              {isLoading ? 'Connexion en cours…' : 'Se connecter avec Google →'}
            </Button>
          </div>
          {error && (
            <p className="mt-3 text-xs text-destructive">{error}</p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DKGTMLogo variant="light" size="sm" showProduct={false} />
            <span className="text-xs text-muted-fg">© 2026 Digital Keys</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: 'hsl(267 100% 59% / 0.5)' }} />
              <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: 'hsl(46 100% 50%)' }} />
            </div>
            <span className="text-xs font-bold tracking-widest uppercase text-muted-fg">Le Lab</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
