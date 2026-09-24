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
import InvestigationPage from './pages/InvestigationPage';
import Sidebar          from './components/Sidebar';
import TopBar           from './components/TopBar';
import FuelUnlockModal  from './components/FuelUnlockModal';
import useFleetState    from './store/useFleetState';

export const ProtectedLayout = ({ children }) => {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) return;
    useFleetState.getState().connectSocket();
    return () => useFleetState.getState().disconnectSocket();
  }, [isAuthenticated]);
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <FuelUnlockModal />
      <Sidebar />
      <div className="app-content">
        <TopBar />
        <main className="app-main">
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
            background: 'rgba(15,29,46,0.98)',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
            borderRadius: '10px',
            fontSize: '13px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          },
          success: { iconTheme: { primary: '#34d399', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#f87171', secondary: '#fff' } },
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
        <Route path="/reports"            element={<ProtectedLayout><ReportsPage /></ProtectedLayout>} />
        <Route path="*"                   element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
