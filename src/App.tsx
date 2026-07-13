import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { ProfilePage } from './pages/ProfilePage';
import { ContainersPage } from './pages/ContainersPage';
import { PackagesPage } from './pages/PackagesPage';
import { DeployPage } from './pages/DeployPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { EventsPage } from './pages/EventsPage';
import { HistoryPage } from './pages/HistoryPage';
import { ContextePage } from './pages/ContextePage';
import { DataLayerMappingPage } from './features/datalayer-mapping/pages/DataLayerMappingPage';
import { DatalayerKanbanPage } from './features/datalayer-mapping/pages/DatalayerKanbanPage';
import { useAuthStore } from './store/auth-store';
import { useProfileStore } from './store/profile-store';
import { useGTMStore } from './store/gtm-store';
import { useDatalayerStore } from './features/datalayer-mapping/stores/datalayerStore';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuthStore();
  if (!accessToken) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireProfile({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuthStore();
  const { activeProfileId } = useProfileStore();
  if (!accessToken) return <Navigate to="/" replace />;
  if (!activeProfileId) return <Navigate to="/profile" replace />;
  return <>{children}</>;
}

export default function App() {
  const { accessToken } = useAuthStore();
  const { activeProfileId } = useProfileStore();
  const { loadForProfile, activeProfileId: gtmProfileId } = useGTMStore();
  const { loadForProfile: loadDatalayerForProfile, activeProfileId: datalayerProfileId } = useDatalayerStore();

  // On app start, restore the active profile's data into the GTM store
  useEffect(() => {
    if (accessToken && activeProfileId && activeProfileId !== gtmProfileId) {
      loadForProfile(activeProfileId);
    }
    if (accessToken && activeProfileId && activeProfileId !== datalayerProfileId) {
      loadDatalayerForProfile(activeProfileId);
    }
  }, [accessToken, activeProfileId]);

  const defaultRoute = !accessToken ? '/'
    : activeProfileId ? '/dashboard/containers'
    : '/profile';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={accessToken ? <Navigate to={defaultRoute} replace /> : <Landing />} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireProfile><Dashboard /></RequireProfile>}>
          <Route index element={<Navigate to="containers" replace />} />
          <Route path="containers" element={<ContainersPage />} />
          <Route path="packages" element={<PackagesPage />} />
          <Route path="deploy" element={<DeployPage />} />
          <Route path="monitoring" element={<MonitoringPage />} />
          <Route path="evenements" element={<EventsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="contexte" element={<ContextePage />} />
          <Route path="datalayer-mapping" element={<DataLayerMappingPage />} />
          <Route path="datalayer-kanban" element={<DatalayerKanbanPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
