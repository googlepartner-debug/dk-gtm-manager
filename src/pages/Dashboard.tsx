import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { useGTMStore } from '../store/gtm-store';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';

export function Dashboard() {
  const { accessToken } = useAuthStore();
  const { fetchAccounts } = useGTMStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!accessToken) {
      navigate('/');
      return;
    }
    fetchAccounts(accessToken);
  }, [accessToken]);

  if (!accessToken) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
