import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { Button } from '../components/ui/Button';

export function Landing() {
  const { accessToken, login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (accessToken) navigate('/dashboard');
  }, [accessToken, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="px-8 py-5 flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12v2H2V3zm0 4h8v2H2V7zm0 4h10v2H2v-2z" fill="white"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">DK GTM Manager</span>
        </div>
        <span className="ml-2 bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full border border-blue-500/30">beta</span>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          {/* Icon */}
          <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="3" y="8" width="26" height="18" rx="2" stroke="#3b82f6" strokeWidth="2"/>
              <path d="M3 13h26" stroke="#3b82f6" strokeWidth="2"/>
              <rect x="7" y="17" width="5" height="5" rx="1" fill="#3b82f6" opacity="0.5"/>
              <rect x="14" y="17" width="5" height="5" rx="1" fill="#3b82f6" opacity="0.5"/>
              <rect x="21" y="17" width="4" height="5" rx="1" fill="#3b82f6"/>
              <path d="M10 6V4M16 6V4M22 6V4" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
            GTM Multi-Container Publisher
          </h1>
          <p className="text-slate-400 mb-2 leading-relaxed">
            Déployez tags, variables et déclencheurs sur <strong className="text-slate-300">tous vos conteneurs GTM</strong> en un seul clic.
          </p>
          <p className="text-slate-500 text-sm mb-8">
            Conçu pour les clients avec datalayer unifié — PerfectStay et au-delà.
          </p>

          {/* Features */}
          <div className="grid grid-cols-3 gap-3 mb-8 text-left">
            {[
              { icon: '⚡', title: 'Déploiement bulk', desc: 'Tous les containers en parallèle' },
              { icon: '📦', title: 'Packages réutilisables', desc: 'Sauvegardez vos configs GTM' },
              { icon: '📋', title: 'Historique complet', desc: 'Tracez chaque déploiement' },
            ].map((f) => (
              <div key={f.title} className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-lg mb-1">{f.icon}</div>
                <div className="text-white text-xs font-medium mb-0.5">{f.title}</div>
                <div className="text-slate-500 text-xs">{f.desc}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Button
            size="lg"
            onClick={login}
            loading={isLoading}
            className="w-full max-w-xs mx-auto flex items-center gap-3 justify-center"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Se connecter avec Google
          </Button>

          <p className="text-slate-600 text-xs mt-4">
            Accès requis : GTM Edit Containers + Publish
          </p>
        </div>
      </main>

      <footer className="text-center py-4 text-slate-700 text-xs">
        Digital Keys © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
