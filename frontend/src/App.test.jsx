// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
const calls = vi.hoisted(() => ({ connectSocket: vi.fn(), disconnectSocket: vi.fn(), auth: true }));
vi.mock('./hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: calls.auth }) }));
vi.mock('./store/useFleetState', () => {
  const fn = () => [];
  fn.getState = () => calls;
  return { default: fn };
});
vi.mock('react-router-dom', () => ({ Navigate: () => null, BrowserRouter: () => null, Routes: () => null, Route: () => null }));
vi.mock('./pages/LoginPage', () => ({ default: () => null }));
vi.mock('./pages/DashboardPage', () => ({ default: () => null }));
vi.mock('./pages/DriversPage', () => ({ default: () => null }));
vi.mock('./pages/FleetPage', () => ({ default: () => null }));
vi.mock('./pages/TruckDetailsPage', () => ({ default: () => null }));
vi.mock('./pages/FuelingPage', () => ({ default: () => null }));
vi.mock('./pages/ReportsPage', () => ({ default: () => null }));
vi.mock('./components/Sidebar', () => ({ default: () => null }));
vi.mock('./components/TopBar', () => ({ default: () => null }));
import { ProtectedLayout } from './App';
it('connects authenticated pages, survives rerenders and disconnects on logout', () => {
  const { rerender, unmount } = render(<ProtectedLayout><div>Frota</div></ProtectedLayout>);
  expect(calls.connectSocket).toHaveBeenCalledTimes(1);
  rerender(<ProtectedLayout><div>Detalhes</div></ProtectedLayout>);
  expect(calls.connectSocket).toHaveBeenCalledTimes(1);
  calls.auth = false;
  rerender(<ProtectedLayout><div>Detalhes</div></ProtectedLayout>);
  expect(calls.disconnectSocket).toHaveBeenCalledTimes(1);
  unmount();
});
