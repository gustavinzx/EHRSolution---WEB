// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import DriversPage from './pages/DriversPage';
import { useFleet } from './hooks/useFleet';
import { useFueling } from './hooks/useFueling';
import { useAuth } from './hooks/useAuth';
import { useDrivers } from './hooks/useDrivers';

vi.mock('./hooks/useFleet');
vi.mock('./hooks/useFueling');
vi.mock('./hooks/useAuth');
vi.mock('./hooks/useDrivers');
vi.mock('./components/MapView', () => ({
  default: () => <div data-testid="mock-map-view">MapView Mock</div>,
}));

describe('DashboardPage & Avatar Tests (Bloco C1)', () => {
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
});
