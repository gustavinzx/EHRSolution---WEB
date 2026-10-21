import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';

import LoginPage        from './pages/LoginPage';
import DashboardPage    from './pages/DashboardPage';
import DriversPage      from './pages/DriversPage';
import FleetPage        from './pages/FleetPage';
import TruckDetailsPage from './pages/TruckDetailsPage';
import FuelingPage      from './pages/FuelingPage';
import ReportsPage      from './pages/ReportsPage';
import FacialAttemptsPage from './pages/FacialAttemptsPage';
import InvestigationPage from './pages/InvestigationPage';
import StationsPage     from './pages/StationsPage';
import AlertsPage       from './pages/AlertsPage';
import SettingsPage     from './pages/SettingsPage';
import UsersPage        from './pages/UsersPage';
import Sidebar          from './components/Sidebar';
import TopBar           from './components/TopBar';
import useFleetState    from './store/useFleetState';

export const RequireAdmin = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

export const ProtectedLayout = ({ children }) => {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) return;
    useFleetState.getState().connectSocket();
    return () => useFleetState.getState().disconnectSocket();
  }, [isAuthenticated]);
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'radial-gradient(circle at 75% 10%, rgba(0, 212, 255, 0.06) 0%, transparent 45%), radial-gradient(circle at 20% 85%, rgba(0, 196, 208, 0.05) 0%, transparent 45%), #060B13',
    }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '240px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <TopBar />
        <main style={{ flex: 1, padding: '22px 26px', overflowY: 'auto' }}>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(11, 21, 36, 0.98)',
            color: '#e2e8f0',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
            fontSize: '13px',
            boxShadow: '0 10px 36px rgba(0, 0, 0, 0.55)',
          },
          success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login"              element={<LoginPage />} />
        <Route path="/"                   element={<ProtectedLayout><DashboardPage /></ProtectedLayout>} />
        <Route path="/drivers"            element={<ProtectedLayout><DriversPage /></ProtectedLayout>} />
        <Route path="/fleet"              element={<ProtectedLayout><FleetPage /></ProtectedLayout>} />
        <Route path="/fleet/:id"          element={<ProtectedLayout><TruckDetailsPage /></ProtectedLayout>} />
        <Route path="/investigation/:id"  element={<ProtectedLayout><InvestigationPage /></ProtectedLayout>} />
        <Route path="/fueling"            element={<ProtectedLayout><FuelingPage /></ProtectedLayout>} />
        <Route path="/stations"           element={<ProtectedLayout><StationsPage /></ProtectedLayout>} />
        <Route path="/reports"            element={<ProtectedLayout><ReportsPage /></ProtectedLayout>} />
        <Route path="/facial-attempts"    element={<ProtectedLayout><FacialAttemptsPage /></ProtectedLayout>} />
        <Route path="/alerts"             element={<ProtectedLayout><AlertsPage /></ProtectedLayout>} />
        <Route path="/settings"           element={<ProtectedLayout><SettingsPage /></ProtectedLayout>} />
        <Route path="/users"               element={<ProtectedLayout><UsersPage /></ProtectedLayout>} />
        <Route path="*"                   element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
