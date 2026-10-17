// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import DriversPage from './pages/DriversPage';
import { useFleet } from './hooks/useFleet';
import { useFueling } from './hooks/useFueling';
import { useAuth } from './hooks/useAuth';
import { useDrivers } from './hooks/useDrivers';
import { useAlerts } from './hooks/useAlerts';
import { getTruckVisualState } from './utils/truckVisualState';
import { isSameLocalDay } from './utils/dayRange';

vi.mock('./hooks/useFleet');
vi.mock('./hooks/useFueling');
vi.mock('./hooks/useAuth');
vi.mock('./hooks/useDrivers');
vi.mock('./hooks/useAlerts');
vi.mock('./components/MapView', () => ({
  default: () => <div data-testid="mock-map-view">MapView Mock</div>,
}));

describe('DashboardPage & Avatar Tests (Bloco C1)', () => {
  afterEach(() => {
    cleanup();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { name: 'Admin Teste', email: 'admin@ehr.com' },
    });
    useFueling.mockReturnValue({
      logs: [],
      loading: false,
    });
    useDrivers.mockReturnValue({
      drivers: [
        { id: 1, name: 'João Silva', is_active: true, face_enrolled: false, face_photo: null },
      ],
      loading: false,
      fetchDrivers: vi.fn(),
    });
    useAlerts.mockReturnValue({
      alerts: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('renders empty state when there are 0 trucks and NEVER shows USB04E06 nor Gustavo Silva', () => {
    useFleet.mockReturnValue({
      trucks: [],
      loading: false,
      refetch: vi.fn(),
    });
    useFueling.mockReturnValue({
      logs: [],
      loading: false,
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Empty states
    expect(screen.getByText('Nenhum caminhão cadastrado')).not.toBeNull();
    expect(screen.getByText('Nenhum abastecimento registrado')).not.toBeNull();

    // NEVER shows mock data
    expect(screen.queryByText(/USB04E06/i)).toBeNull();
    expect(screen.queryByText(/Gustavo Silva/i)).toBeNull();
    expect(screen.queryByText(/Hyundai Azera/i)).toBeNull();
  });

  it('renders real truck data when 1 truck is present and NEVER shows USB04E06 nor Gustavo Silva', () => {
    useFleet.mockReturnValue({
      trucks: [
        {
          id: 101,
          plate: 'BRA2E19',
          model: 'Scania R450',
          capacity_liters: 600,
          current_level_liters: 450,
          speed_kmh: 65,
          status: 'ok',
        },
      ],
      loading: false,
      refetch: vi.fn(),
    });
    useFueling.mockReturnValue({
      logs: [
        {
          id: 50,
          truck_plate: 'BRA2E19',
          driver_name: 'Carlos Oliveira',
          timestamp: new Date().toISOString(),
          level_before: 150,
          level_after: 450,
          release_method: 'facial',
        },
      ],
      loading: false,
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Real data is shown
    expect(screen.getAllByText('BRA2E19').length).toBeGreaterThan(0);
    expect(screen.getByText(/Scania R450/i)).not.toBeNull();
    expect(screen.getByText('Carlos Oliveira')).not.toBeNull();

    // NEVER shows mock data
    expect(screen.queryByText(/USB04E06/i)).toBeNull();
    expect(screen.queryByText(/Gustavo Silva/i)).toBeNull();
    expect(screen.queryByText(/Hyundai Azera/i)).toBeNull();
  });

  it('renders driver avatar with initials and makes zero external requests when photo is absent', () => {
    useFleet.mockReturnValue({
      trucks: [],
      loading: false,
      refetch: vi.fn(),
    });
    useDrivers.mockReturnValue({
      drivers: [
        { id: 1, name: 'Rodrigo Faro', is_active: true, face_enrolled: false, face_photo: null },
      ],
      loading: false,
      fetchDrivers: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter>
        <DriversPage />
      </MemoryRouter>
    );

    // Initials displayed
    const initialsEl = screen.getByTestId('driver-initials-1');
    expect(initialsEl).not.toBeNull();
    expect(initialsEl.textContent).toBe('RF');

    // No external image request or pravatar URL
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img.getAttribute('src')).not.toMatch(/pravatar/i);
      expect(img.getAttribute('src')).not.toMatch(/http/i);
    });
  });

  it('renders active alerts with severity badge and message when real alerts exist', () => {
    useFleet.mockReturnValue({
      trucks: [],
      loading: false,
      isConnected: true,
      refetch: vi.fn(),
    });
    useAlerts.mockReturnValue({
      alerts: [
        {
          id: 1,
          type: 'critical_divergence',
          severity: 'critical',
          message: 'Desvio de rota crítico detectado',
          plate: 'BRA2E19',
          model: 'Scania R450',
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Desvio de rota crítico detectado')).not.toBeNull();
    expect(screen.getByText('Crítico')).not.toBeNull();
    expect(screen.getByText(/BRA2E19/)).not.toBeNull();
    expect(screen.queryByText('Nenhum alerta no momento.')).toBeNull();
  });

  it('renders "Nenhum alerta no momento." when alerts array is empty and loaded', () => {
    useFleet.mockReturnValue({
      trucks: [],
      loading: false,
      isConnected: true,
      refetch: vi.fn(),
    });
    useAlerts.mockReturnValue({
      alerts: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Nenhum alerta no momento.')).not.toBeNull();
  });

  it('renders "Não foi possível carregar os alertas" when alerts API fails', () => {
    useFleet.mockReturnValue({
      trucks: [],
      loading: false,
      isConnected: true,
      refetch: vi.fn(),
    });
    useAlerts.mockReturnValue({
      alerts: [],
      loading: false,
      error: new Error('Network error'),
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Não foi possível carregar os alertas')).not.toBeNull();
  });

  it('calculates map legend "Alerta (N)" using MapView alert status rule', () => {
    useFleet.mockReturnValue({
      trucks: [
        { id: 1, plate: 'AAA1111', status: 'ok', speed_kmh: 0, capacity_liters: 500, current_level_liters: 400 },
        { id: 2, plate: 'BBB2222', status: 'no_signal', speed_kmh: 0, capacity_liters: 500, current_level_liters: 300 },
        { id: 3, plate: 'CCC3333', status: 'ok', sim_state: 'security_alert', speed_kmh: 0, capacity_liters: 500, current_level_liters: 200 },
      ],
      loading: false,
      isConnected: true,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // 2 trucks match the alert rule (BBB2222 has no_signal, CCC3333 has security_alert)
    expect(screen.getByText('Alerta (2)')).not.toBeNull();
  });

  it('renders connection indicator reflecting isConnected (Online vs Offline)', () => {
    // 1) isConnected: true
    useFleet.mockReturnValue({
      trucks: [],
      loading: false,
      isConnected: true,
      refetch: vi.fn(),
    });

    const { rerender } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Sistema Online')).not.toBeNull();

    // 2) isConnected: false
    useFleet.mockReturnValue({
      trucks: [],
      loading: false,
      isConnected: false,
      refetch: vi.fn(),
    });

    rerender(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Sistema Offline')).not.toBeNull();
  });

  it('does NOT render fabricated indicators like "+100% vs. ontem" or "Em manutenção"', () => {
    useFleet.mockReturnValue({
      trucks: [
        { id: 1, plate: 'AAA1111', status: 'ok', speed_kmh: 50, capacity_liters: 500, current_level_liters: 400 },
      ],
      loading: false,
      isConnected: true,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.queryByText(/vs\. ontem/i)).toBeNull();
    expect(screen.queryByText(/\+100%/i)).toBeNull();
    expect(screen.queryByText(/Em manutenção/i)).toBeNull();
  });

  it('getTruckVisualState evaluates each state and respects sim_state precedence over status', () => {
    expect(getTruckVisualState(null)).toBe('ok');
    expect(getTruckVisualState({ status: 'ok' })).toBe('ok');
    expect(getTruckVisualState({ status: 'low_fuel' })).toBe('ok');
    expect(getTruckVisualState({ status: 'arrived' })).toBe('ok');

    expect(getTruckVisualState({ status: 'no_signal' })).toBe('alert');
    expect(getTruckVisualState({ status: 'security_alert' })).toBe('alert');
    expect(getTruckVisualState({ status: 'ok', sim_state: 'no_signal' })).toBe('alert');
    expect(getTruckVisualState({ status: 'ok', sim_state: 'security_alert' })).toBe('alert');

    expect(getTruckVisualState({ status: 'ok', sim_state: 'fueling' })).toBe('fueling');
    expect(getTruckVisualState({ status: 'ok', route_phase: 'fueling' })).toBe('fueling');
    expect(getTruckVisualState({ status: 'ok', route_phase: 'awaiting_fueling_authorization' })).toBe('fueling');

    // Precedence: sim_state wins over status and route_phase
    expect(getTruckVisualState({ status: 'no_signal', sim_state: 'fueling' })).toBe('fueling');
    expect(getTruckVisualState({ status: 'no_signal', sim_state: 'ok' })).toBe('ok');
    expect(getTruckVisualState({ status: 'fueling', route_phase: 'fueling', sim_state: 'security_alert' })).toBe('alert');
  });

  it('renders "Alerta (0)" and "Abastecendo (1)" when 1 truck is in fueling state', () => {
    useFleet.mockReturnValue({
      trucks: [
        { id: 1, plate: 'AAA1111', status: 'ok', sim_state: 'fueling', speed_kmh: 0, capacity_liters: 500, current_level_liters: 300 },
      ],
      loading: false,
      isConnected: true,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Alerta (0)')).not.toBeNull();
    expect(screen.getByText('Abastecendo (1)')).not.toBeNull();
  });

  it('renders "Alerta (1)" and "Abastecendo (0)" when 1 truck has no_signal', () => {
    useFleet.mockReturnValue({
      trucks: [
        { id: 2, plate: 'BBB2222', status: 'no_signal', speed_kmh: 0, capacity_liters: 500, current_level_liters: 300 },
      ],
      loading: false,
      isConnected: true,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Alerta (1)')).not.toBeNull();
    expect(screen.getByText('Abastecendo (0)')).not.toBeNull();
  });

  it('counts log at 23:30 local (next day in UTC) as today, log at 00:10 yesterday local as yesterday, and computes local trend', () => {
    vi.useFakeTimers();
    try {
      // 2026-10-16 23:45:00 in America/Sao_Paulo (UTC-3) => 2026-10-17T02:45:00.000Z
      const refNow = new Date('2026-10-17T02:45:00.000Z');
      vi.setSystemTime(refNow);

      const logToday2330Local = '2026-10-17T02:30:00.000Z'; // 2026-10-16 23:30:00 BRT
      const logToday1400Local = '2026-10-16T17:00:00.000Z'; // 2026-10-16 14:00:00 BRT
      const logYesterday0010Local = '2026-10-15T03:10:00.000Z'; // 2026-10-15 00:10:00 BRT

      expect(isSameLocalDay(logToday2330Local, refNow)).toBe(true);
      const refYesterday = new Date(refNow);
      refYesterday.setDate(refNow.getDate() - 1);
      expect(isSameLocalDay(logYesterday0010Local, refYesterday)).toBe(true);

      useFleet.mockReturnValue({
        trucks: [],
        loading: false,
        isConnected: true,
        refetch: vi.fn(),
      });
      useFueling.mockReturnValue({
        logs: [
          { id: 1, truck_plate: 'AAA1111', driver_name: 'Mot 1', timestamp: logToday2330Local, release_method: 'facial' },
          { id: 2, truck_plate: 'AAA1111', driver_name: 'Mot 1', timestamp: logToday1400Local, release_method: 'facial' },
          { id: 3, truck_plate: 'AAA1111', driver_name: 'Mot 1', timestamp: logYesterday0010Local, release_method: 'facial' },
        ],
        loading: false,
      });

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      );

      // 2 logs today vs 1 log yesterday => +100% vs. ontem
      const kpiLabel = screen.getByText('Abastecimentos Hoje');
      const kpiCard = kpiLabel.parentElement;
      expect(kpiCard.textContent).toContain('2');
      expect(kpiCard.textContent).toContain('▲ +100%');
      expect(kpiCard.textContent).toContain('vs. ontem');
    } finally {
      vi.useRealTimers();
    }
  });
});
