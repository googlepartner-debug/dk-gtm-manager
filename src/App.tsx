import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { ContainersPage } from './pages/ContainersPage';
import { PackagesPage } from './pages/PackagesPage';
import { DeployPage } from './pages/DeployPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { HistoryPage } from './pages/HistoryPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<Navigate to="containers" replace />} />
          <Route path="containers" element={<ContainersPage />} />
          <Route path="packages" element={<PackagesPage />} />
          <Route path="deploy" element={<DeployPage />} />
          <Route path="monitoring" element={<MonitoringPage />} />
          <Route path="history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
