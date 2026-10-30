// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import FuelingTable from './components/FuelingTable';
import { getAlertMeta } from './utils/alertMapping';

vi.mock('./api/client', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { divergence_pct: 5, divergence_critical_pct: 10 } }))
  }
}));

afterEach(() => {
  cleanup();
});

describe('FuelingTable & alertMapping (Bloco D / E4)', () => {
  it('alertMapping devolve o rótulo "Posto não reconhecido (ANP)" e ícone para unrecognized_station', () => {
    const meta = getAlertMeta('unrecognized_station');
    expect(meta.label).toBe('Posto não reconhecido (ANP)');
    expect(meta.icon).toBeDefined();
  });

  it('FuelingTable renderiza a coluna "Posto (ANP)" com os 3 estados (matched, unrecognized, no_position) e tolera log legado sem station_match', () => {
    const sampleLogs = [
      {
        id: 101,
        timestamp: '2026-10-12T14:00:00Z',
        driver_id: 1,
        driver_name: 'Carlos Mendes',
        truck_id: 10,
        plate: 'ABC1D23',
        pump_liters: 200,
        tank_liters_delta: 199,
        divergence_liters: 1,
        divergence_pct: 0.5,
        data_source: 'hardware',
        release_method: 'facial',
        station_match: {
          status: 'matched',
          distance_m: 38.4,
          station: {
            cnpj: '48386351000109',
            razao_social: 'AUTO POSTO VICENTTE PIRES LTDA',
            municipio: 'BRASILIA',
            uf: 'DF',
            bandeira: 'VIBRA'
          }
        }
      },
      {
        id: 102,
        timestamp: '2026-10-12T15:00:00Z',
        driver_id: 2,
        driver_name: 'Pedro Alves',
        truck_id: 11,
        plate: 'XYZ9K88',
        pump_liters: 150,
        tank_liters_delta: 150,
        divergence_liters: 0,
        divergence_pct: 0,
        data_source: 'hardware',
        release_method: 'facial',
        station_name: 'Posto Fantasma Rodovia',
        station_match: {
          status: 'unrecognized',
          distance_m: null,
          station: null
        }
      },
      {
        id: 103,
        timestamp: '2026-10-12T16:00:00Z',
        driver_id: 3,
        driver_name: 'Marcos Lima',
        truck_id: 12,
        plate: 'JKL4M56',
        pump_liters: 180,
        tank_liters_delta: 180,
        divergence_liters: 0,
        divergence_pct: 0,
        data_source: 'manager',
        release_method: 'manager_override',
        station_match: {
          status: 'no_position',
          distance_m: null,
          station: null
        }
      },
      {
        id: 104,
        timestamp: '2026-10-10T10:00:00Z',
        driver_id: 4,
        driver_name: 'João Legado',
        truck_id: 13,
        plate: 'LEG0A00',
        pump_liters: null,
        tank_liters_delta: 120,
        divergence_liters: null,
        divergence_pct: null,
        data_source: 'legacy',
        release_method: 'ble_fallback',
        station_name: 'Posto Antigo Legado'
        // sem station_match
      }
    ];

    render(<FuelingTable logs={sampleLogs} />);

    // Cabeçalho da coluna Posto (ANP)
    expect(screen.getByText('Posto (ANP)')).toBeTruthy();

    // 1) Estado matched: badge "ANP regular · a N m" + razão social e município/UF
    expect(screen.getByText('ANP regular · a 38 m')).toBeTruthy();
    expect(screen.getByText(/AUTO POSTO VICENTTE PIRES LTDA/)).toBeTruthy();
    expect(screen.getByText(/BRASILIA\/DF/)).toBeTruthy();

    // 2) Estado unrecognized: badge "Não reconhecido"
    expect(screen.getByText('Não reconhecido')).toBeTruthy();
    expect(screen.getByText('Posto Fantasma Rodovia')).toBeTruthy();

    // 3) Estado no_position: badge "Sem posição"
    expect(screen.getByText('Sem posição')).toBeTruthy();

    // 4) Log legado sem station_match tolerado sem erro
    expect(screen.getByText('Posto Antigo Legado')).toBeTruthy();
  });
});
