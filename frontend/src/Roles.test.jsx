/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
afterEach(cleanup);
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { useAuth } from './hooks/useAuth';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';
import Sidebar from './components/Sidebar';

vi.mock('./api/client', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: {} })), put: vi.fn() } }));
vi.mock('./hooks/useAuth', () => ({
  useAuth: vi.fn()
}));

vi.mock('./hooks/useAlerts', () => ({
  useAlerts: () => ({
    alerts: [{ id: 1, type: 'critical', truck_plate: 'ABC-1234', message: 'Test', resolved: false }],
    loading: false,
    resolveAlert: vi.fn()
  })
}));

describe('Roles Frontend Tests', () => {
  it('auditor doesn\'t see resolve alert button', async () => {
    useAuth.mockReturnValue({ user: { role: 'auditor', name: 'A' } });
    render(<MemoryRouter><AlertsPage /></MemoryRouter>);
    await screen.findByText('Test');
    expect(screen.queryByText('Resolver')).toBeNull();
  });

  it('manager sees resolve alert button', async () => {
    useAuth.mockReturnValue({ user: { role: 'manager', name: 'M' } });
    render(<MemoryRouter><AlertsPage /></MemoryRouter>);
    expect(await screen.findByText('Resolver')).toBeDefined();
  });

  it('auditor doesn\'t see save settings button', async () => {
    useAuth.mockReturnValue({ user: { role: 'auditor', name: 'A' } });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await screen.findByText('Configurações do Sistema');
    expect(screen.queryByText('Salvar Regras')).toBeNull();
  });

  it('manager doesn\'t see save settings button', async () => {
    useAuth.mockReturnValue({ user: { role: 'manager', name: 'M' } });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await screen.findByText('Configurações do Sistema');
    expect(screen.queryByText('Salvar Regras')).toBeNull();
  });

  it('admin sees save settings button', async () => {
    useAuth.mockReturnValue({ user: { role: 'admin', name: 'Ad' } });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    expect(await screen.findByText('Salvar Regras')).toBeDefined();
  });

  it('admin sees /users link in sidebar', async () => {
    useAuth.mockReturnValue({ user: { role: 'admin', name: 'Ad' }, logout: vi.fn() });
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(await screen.findByText('Usuários')).toBeDefined();
  });

  it('manager doesn\'t see /users link in sidebar', async () => {
    useAuth.mockReturnValue({ user: { role: 'manager', name: 'M' }, logout: vi.fn() });
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    await screen.findByText('Motoristas');
    expect(screen.queryByText('Usuários')).toBeNull();
  });
});









