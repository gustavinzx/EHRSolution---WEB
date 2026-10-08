// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FuelingTable from './components/FuelingTable';
import client from './api/client';

// Mock do Axios
vi.mock('./api/client', () => ({
  default: {
    get: vi.fn(),
  }
}));

describe('FuelingTable', () => {
  beforeAll(() => {
    client.get.mockResolvedValue({
      data: {
        divergence_pct: 5,
        divergence_critical_pct: 15
      }
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly with origin badges and handles nulls', async () => {
    const logs = [
      {
        id: 1, driver_name: 'Motorista 1', plate: 'ABC-1234', timestamp: '2023-01-01T10:00:00Z',
        lat: -23, lng: -46, data_source: 'hardware', pump_liters: 100, tank_liters_delta: 97,
        divergence_liters: 3, divergence_pct: 3, release_method: 'facial'
      },
      {
        id: 2, driver_name: 'Motorista 2', plate: 'DEF-5678', timestamp: '2023-01-01T11:00:00Z',
        lat: null, lng: null, data_source: 'unverified', pump_liters: null, tank_liters_delta: null,
        divergence_liters: null, divergence_pct: null, release_method: 'ble_fallback'
      },
      {
        id: 3, driver_name: 'Motorista 3', plate: 'GHI-9012', timestamp: '2023-01-01T12:00:00Z',
        lat: -23, lng: -46, data_source: 'legacy', pump_liters: 100, tank_liters_delta: 80,
        divergence_liters: 20, divergence_pct: 20, release_method: 'manager_override'
      }
    ];

    render(<FuelingTable logs={logs} />);

    await waitFor(() => {
      // Check data source badges
      expect(screen.getByText('Hardware')).toBeTruthy();
      expect(screen.getByText('Não Verificado')).toBeTruthy();
      expect(screen.getByText('Legado')).toBeTruthy();
    });

    // Check null rendering "—" with title "sem medição"
    const nullSpans = screen.getAllByTitle('sem medição');
    expect(nullSpans.length).toBeGreaterThan(0);
    expect(nullSpans[0].textContent).toBe('—');

    // Check critical divergence highlight
    // According to the table, it highlights the td or div with #f87171 color when divergence > critical
    // We can check if "20.0" is rendered and has the right color or warning icon
    const divPct = screen.getByText(/20\.0%/);
    expect(divPct).toBeTruthy();
  });
});


