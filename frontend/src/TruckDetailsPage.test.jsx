// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import TruckDetailsPage from './pages/TruckDetailsPage';
import { useAuth } from './hooks/useAuth';
import { useFleet } from './hooks/useFleet';
import useFleetState from './store/useFleetState';

vi.mock('./hooks/useAuth');
vi.mock('./hooks/useFleet');
vi.mock('./store/useFleetState');

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="mock-map">{children}</div>,
  TileLayer: () => null,
  Polyline: () => null,
  Popup: ({ children }) => <div>{children}</div>,
  useMap: () => ({ setView: vi.fn(), invalidateSize: vi.fn() }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  AreaChart: ({ children }) => <svg>{children}</svg>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));

vi.mock('./components/LiveTruckMarker', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock('./components/RouteModal', () => ({
  default: () => null,
}));

const sampleTruck = {
  id: 7,
  plate: 'EHR-0007',
  model: 'Volvo FH 540',
  status: 'ok',
  capacity_liters: 500,
  current_level_liters: 350,
  speed_kmh: 60,
  lat: -23.5505,
  lng: -46.6333,
  recent_logs: [],
  recent_dump_logs: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/fleet/7']}>
      <Routes>
        <Route path="/fleet/:id" element={<TruckDetailsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TruckDetailsPage — Cartão Chave do hardware (Bloco E & F4)', () => {
  let mockFetchTruckDetails;
  let mockGetHardwareKeyStatus;
  let mockGenerateHardwareKey;
  let mockRevokeHardwareKey;

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  beforeEach(() => {
    mockFetchTruckDetails = vi.fn().mockResolvedValue(sampleTruck);
    mockGetHardwareKeyStatus = vi.fn().mockResolvedValue({
      configured: false,
      prefix: null,
      created_at: null,
      last_used_at: null,
    });
    mockGenerateHardwareKey = vi.fn();
    mockRevokeHardwareKey = vi.fn();

    useAuth.mockReturnValue({
      user: { id: 1, name: 'Gestor Teste', role: 'manager' },
    });

    useFleet.mockReturnValue({
      fetchTruckDetails: mockFetchTruckDetails,
      getHardwareKeyStatus: mockGetHardwareKeyStatus,
      generateHardwareKey: mockGenerateHardwareKey,
      revokeHardwareKey: mockRevokeHardwareKey,
      error: null,
    });

    useFleetState.mockReturnValue({
      fleet: [],
      truckRoutes: {},
      fetchTruckRoute: vi.fn(),
      cancelTruckRoute: vi.fn(),
    });
  });

  it('exibe estado de carregamento do status da chave', async () => {
    let resolveStatus;
    mockGetHardwareKeyStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve;
      })
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Carregando status da chave...')).toBeTruthy();
    });

    resolveStatus({
      configured: false,
      prefix: null,
      created_at: null,
      last_used_at: null,
    });

    await waitFor(() => {
      expect(screen.getByText('Nenhuma chave configurada')).toBeTruthy();
    });
  });

  it('exibe estado de erro quando a API falha ao carregar o status da chave', async () => {
    mockGetHardwareKeyStatus.mockRejectedValue(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Não foi possível carregar o status da chave.')).toBeTruthy();
    });
  });

  it('exibe estado sem chave configurada e gera chave exibindo modal único, apagando ao fechar', async () => {
    const newSecretKey = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
    mockGenerateHardwareKey.mockResolvedValue({
      api_key: newSecretKey,
      prefix: 'a1b2c3d4',
      created_at: '2026-10-18T12:00:00.000Z',
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nenhuma chave configurada')).toBeTruthy();
    });

    const genBtn = screen.getByRole('button', { name: 'Gerar chave' });
    fireEvent.click(genBtn);

    await waitFor(() => {
      expect(mockGenerateHardwareKey).toHaveBeenCalledWith('7');
      expect(screen.getByTestId('hardware-key-modal')).toBeTruthy();
    });

    expect(screen.getByText('Guarde agora; ela não será exibida de novo')).toBeTruthy();
    expect(screen.getByTestId('hardware-key-secret-value').textContent).toBe(newSecretKey);
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeTruthy();

    // Não salvou no localStorage
    expect(JSON.stringify(localStorage)).not.toContain(newSecretKey);

    // Status no cartão já reflete chave ativa com último uso 'nunca'
    const activeStatus = screen.getByTestId('hardware-key-active-status');
    expect(activeStatus.textContent).toContain('Chave ativa: a1b2c3d4…');
    expect(activeStatus.textContent).toContain('último uso nunca');

    // Ao fechar a janela, a chave em texto puro desaparece completamente do DOM
    const closeBtn = screen.getByRole('button', { name: 'Fechar' });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('hardware-key-modal')).toBeNull();
      expect(screen.queryByText(newSecretKey)).toBeNull();
    });
  });

  it('exibe chave ativa com data de último uso e exige confirmação antes de trocar e de revogar', async () => {
    const createdIso = '2026-10-17T10:30:00.000Z';
    const usedIso = '2026-10-18T02:15:00.000Z';
    mockGetHardwareKeyStatus.mockResolvedValue({
      configured: true,
      prefix: '99887766',
      created_at: createdIso,
      last_used_at: usedIso,
    });

    const rotatedSecret = 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
    mockGenerateHardwareKey.mockResolvedValue({
      api_key: rotatedSecret,
      prefix: 'ffeeddcc',
      created_at: '2026-10-18T14:00:00.000Z',
    });
    mockRevokeHardwareKey.mockResolvedValue({ success: true });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('hardware-key-active-status')).toBeTruthy();
    });

    const statusText = screen.getByTestId('hardware-key-active-status').textContent;
    expect(statusText).toContain('Chave ativa: 99887766…');
    expect(statusText).toContain(new Date(createdIso).toLocaleString('pt-BR'));
    expect(statusText).toContain(new Date(usedIso).toLocaleString('pt-BR'));
    expect(statusText).not.toContain('último uso nunca');

    // Clicar em "Trocar chave" pede confirmação antes de chamar a API
    fireEvent.click(screen.getByRole('button', { name: 'Trocar chave' }));
    expect(mockGenerateHardwareKey).not.toHaveBeenCalled();
    expect(
      screen.getByText('A chave atual para de funcionar imediatamente e a placa precisará ser reconfigurada.')
    ).toBeTruthy();

    // Cancelar fecha o diálogo sem chamar a API
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByTestId('hardware-key-confirm-dialog')).toBeNull();
    expect(mockGenerateHardwareKey).not.toHaveBeenCalled();

    // Clicar em "Trocar chave" novamente e confirmar
    fireEvent.click(screen.getByRole('button', { name: 'Trocar chave' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(mockGenerateHardwareKey).toHaveBeenCalledWith('7');
      expect(screen.getByTestId('hardware-key-secret-value').textContent).toBe(rotatedSecret);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    // Clicar em "Revogar" pede a mesma confirmação antes de chamar a API
    fireEvent.click(screen.getByRole('button', { name: 'Revogar' }));
    expect(mockRevokeHardwareKey).not.toHaveBeenCalled();
    expect(
      screen.getByText('A chave atual para de funcionar imediatamente e a placa precisará ser reconfigurada.')
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(mockRevokeHardwareKey).toHaveBeenCalledWith('7');
      expect(screen.getByText('Nenhuma chave configurada')).toBeTruthy();
    });
  });

  it('oculta o cartão Chave do hardware para o papel auditor e não consulta a rota de status', async () => {
    useAuth.mockReturnValue({
      user: { id: 9, name: 'Auditor Teste', role: 'auditor' },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('EHR-0007')).toBeTruthy();
    });

    expect(screen.queryByTestId('hardware-key-card')).toBeNull();
    expect(screen.queryByText('Chave do hardware')).toBeNull();
    expect(mockGetHardwareKeyStatus).not.toHaveBeenCalled();
  });
});
