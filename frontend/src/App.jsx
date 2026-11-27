import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';

import LoginPage     from './pages/LoginPage';
import Sidebar       from './components/Sidebar';
import TopBar        from './components/TopBar';
import StagingBanner from './components/StagingBanner';
import useFleetState from './store/useFleetState';

const DashboardPage      = lazy(() => import('./pages/DashboardPage'));
const DriversPage        = lazy(() => import('./pages/DriversPage'));
const FleetPage          = lazy(() => import('./pages/FleetPage'));
const TruckDetailsPage   = lazy(() => import('./pages/TruckDetailsPage'));
const FuelingPage        = lazy(() => import('./pages/FuelingPage'));
const ReportsPage        = lazy(() => import('./pages/ReportsPage'));
const FacialAttemptsPage = lazy(() => import('./pages/FacialAttemptsPage'));
const InvestigationPage  = lazy(() => import('./pages/InvestigationPage'));
const StationsPage       = lazy(() => import('./pages/StationsPage'));
const AlertsPage         = lazy(() => import('./pages/AlertsPage'));
const SettingsPage       = lazy(() => import('./pages/SettingsPage'));
const UsersPage          = lazy(() => import('./pages/UsersPage'));

const PageLoadingFallback = () => (
  <div
    role="status"
    aria-live="polite"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '240px',
      color: '#94a3b8',
      fontSize: '13px',
      letterSpacing: '0.04em',
    }}
  >
    Carregando módulo…
  </div>
);

export const RequireAdmin = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

export const ProtectedLayout = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const isStaging = import.meta.env?.VITE_APP_ENV === 'staging';

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
      paddingTop: isStaging ? '28px' : 0,
      background: 'radial-gradient(circle at 75% 10%, rgba(0, 212, 255, 0.06) 0%, transparent 45%), radial-gradient(circle at 20% 85%, rgba(0, 196, 208, 0.05) 0%, transparent 45%), #060B13',
    }}>
      <StagingBanner />
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '240px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <TopBar />
        <main style={{ flex: 1, padding: '22px 26px', overflowY: 'auto' }}>
          <ErrorBoundary>
            <Suspense fallback={<PageLoadingFallback />}>
              {children}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
