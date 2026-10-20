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

function renderPage(initialEntry = '/fleet/7') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/fleet/:id" element={<TruckDetailsPage />} />
        <Route path="/fleet" element={<div data-testid="fleet-list-page">Lista da Frota</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TruckDetailsPage — Cartão Chave do hardware & Polimento (Blocos A, B, D1)', () => {
  let mockFetchTruckDetails;
  let mockGetHardwareKeyStatus;
  let mockGenerateHardwareKey;
  let mockRevokeHardwareKey;

  afterEach(() => {
    vi.useRealTimers();
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
      trucks: [],
      loading: false,
      error: null,
      fetchFleet: vi.fn(),
      truckRoutes: {},
      fetchTruckRoute: vi.fn(),
      cancelTruckRoute: vi.fn(),
    });
  });

  it('quando a API devolve 404 mostra "Caminhão não encontrado", mensagem orientativa e botão "Voltar para a Frota"', async () => {
    mockFetchTruckDetails.mockRejectedValue({ response: { status: 404, data: { error: 'Truck not found' } } });

    renderPage('/fleet/999');

    await waitFor(() => {
      expect(screen.getByText('Caminhão não encontrado')).toBeTruthy();
    });

    expect(
      screen.getByText('Nenhum caminhão com esse ID. Volte para a Frota e escolha um da lista.')
    ).toBeTruthy();
    expect(screen.queryByText('Erro de Conexão')).toBeNull();

    const backBtn = screen.getByRole('button', { name: 'Voltar para a Frota' });
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByTestId('fleet-list-page')).toBeTruthy();
    });
  });

  it('erro de rede (sem resposta do servidor) mostra "Erro de Conexão"', async () => {
    mockFetchTruckDetails.mockRejectedValue(new Error('Network Error'));

    renderPage('/fleet/7');

    await waitFor(() => {
      expect(screen.getByText('Erro de Conexão')).toBeTruthy();
    });
    expect(screen.queryByText('Caminhão não encontrado')).toBeNull();
  });

  it('outro status de erro (ex.: 500) mostra "Não foi possível carregar o caminhão." com botão "Tentar novamente"', async () => {
    mockFetchTruckDetails
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce(sampleTruck);

    renderPage('/fleet/7');

    await waitFor(() => {
      expect(screen.getByText('Não foi possível carregar o caminhão.')).toBeTruthy();
    });

    const retryBtn = screen.getByRole('button', { name: 'Tentar novamente' });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(mockFetchTruckDetails).toHaveBeenCalledTimes(2);
      expect(screen.getByText('EHR-0007')).toBeTruthy();
    });
  });

  it('exibe estado de carregamento do status da chave e mostra ID e placa no cartão', async () => {
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

    expect(screen.getByTestId('hardware-key-truck-ident').textContent).toBe(
      'ID do caminhão: 7 • Placa: EHR-0007'
    );

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

  it('exibe ID e comando PowerShell com chave e ID certos na janela, e apaga chave e comando ao fechar', async () => {
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

    expect(screen.getByTestId('hardware-key-truck-ident').textContent).toBe(
      'ID do caminhão: 7 • Placa: EHR-0007'
    );

    const genBtn = screen.getByRole('button', { name: 'Gerar chave' });
    fireEvent.click(genBtn);

    await waitFor(() => {
      expect(mockGenerateHardwareKey).toHaveBeenCalledWith('7');
      expect(screen.getByTestId('hardware-key-modal')).toBeTruthy();
    });

    expect(screen.getByText('Guarde agora; ela não será exibida de novo')).toBeTruthy();
    expect(screen.getByTestId('hardware-key-modal-truck-id').textContent).toContain('ID do caminhão: 7');
    expect(screen.getByTestId('hardware-key-secret-value').textContent).toBe(newSecretKey);

    const psCommandEl = screen.getByTestId('hardware-key-ps-command');
    expect(psCommandEl.textContent).toContain(`$h = @{ "x-api-key" = "${newSecretKey}" }`);
    expect(psCommandEl.textContent).toContain('/api/fueling/sessions/7/active" -Headers $h');

    expect(screen.getByRole('button', { name: 'Copiar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copiar comando' })).toBeTruthy();

    // Não salvou no localStorage
    expect(JSON.stringify(localStorage)).not.toContain(newSecretKey);

    // Status no cartão já reflete chave ativa com último uso 'nunca'
    const activeStatus = screen.getByTestId('hardware-key-active-status');
    expect(activeStatus.textContent).toContain('Chave ativa: a1b2c3d4…');
    expect(activeStatus.textContent).toContain('último uso nunca');

    // Ao fechar a janela, tanto a chave quanto o comando PowerShell desaparecem completamente do DOM
    const closeBtn = screen.getByRole('button', { name: 'Fechar' });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('hardware-key-modal')).toBeNull();
      expect(screen.queryByTestId('hardware-key-ps-command')).toBeNull();
      expect(screen.queryByText(newSecretKey)).toBeNull();
      expect(document.body.textContent).not.toContain('/fueling/sessions/7/active');
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

  it('botão "Atualizar" e evento visibilitychange refazem a consulta; falha na recarga mostra erro discreto sem apagar estado atual', async () => {
    const createdIso = '2026-10-17T10:30:00.000Z';
    const updatedUsedIso = '2026-10-18T15:00:00.000Z';

    mockGetHardwareKeyStatus
      .mockResolvedValueOnce({
        configured: true,
        prefix: '11223344',
        created_at: createdIso,
        last_used_at: null,
      })
      .mockResolvedValueOnce({
        configured: true,
        prefix: '11223344',
        created_at: createdIso,
        last_used_at: updatedUsedIso,
      })
      .mockRejectedValueOnce(new Error('Refresh failed'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('hardware-key-active-status').textContent).toContain('último uso nunca');
    });
    expect(mockGetHardwareKeyStatus).toHaveBeenCalledTimes(1);

    // Clicar em "Atualizar" refaz a consulta e atualiza o último uso
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));

    await waitFor(() => {
      expect(mockGetHardwareKeyStatus).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('hardware-key-active-status').textContent).toContain(
        new Date(updatedUsedIso).toLocaleString('pt-BR')
      );
    });

    // Disparar visibilitychange (aba visível) refaz a consulta; falha mostra erro discreto sem apagar o estado atual
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    fireEvent(document, new Event('visibilitychange'));

    await waitFor(() => {
      expect(mockGetHardwareKeyStatus).toHaveBeenCalledTimes(3);
      expect(screen.getByTestId('hardware-key-refresh-error').textContent).toBe(
        'Não foi possível atualizar o status da chave.'
      );
    });

    // Estado atual continua visível no cartão
    expect(screen.getByTestId('hardware-key-active-status').textContent).toContain('Chave ativa: 11223344…');
  });

  it('intervalo de 30s atualiza o status e é limpo ao desmontar (fake timers)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = renderPage();

    await waitFor(() => {
      expect(mockGetHardwareKeyStatus).toHaveBeenCalledTimes(1);
    });

    await vi.advanceTimersByTimeAsync(30000);

    await waitFor(() => {
      expect(mockGetHardwareKeyStatus).toHaveBeenCalledTimes(2);
    });

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60000);
    expect(mockGetHardwareKeyStatus).toHaveBeenCalledTimes(2);

    clearIntervalSpy.mockRestore();
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

  it('useFleet.fetchTruckDetails não dispara toast.error quando a API responde 404, mas dispara em erro 500', async () => {
    const actualHookModule = await vi.importActual('./hooks/useFleet');
    const clientModule = await import('./api/client');
    const toastModule = await import('react-hot-toast');

    const getSpy = vi.spyOn(clientModule.default, 'get');
    const toastErrorSpy = vi.spyOn(toastModule.default, 'error').mockImplementation(() => {});

    let hookApi;
    function HookHarness() {
      hookApi = actualHookModule.useFleet();
      return null;
    }

    render(<HookHarness />);

    getSpy.mockRejectedValueOnce({ response: { status: 404, data: { error: 'Truck not found' } } });
    await expect(hookApi.fetchTruckDetails('999')).rejects.toEqual({
      response: { status: 404, data: { error: 'Truck not found' } },
    });
    expect(toastErrorSpy).not.toHaveBeenCalled();

    getSpy.mockRejectedValueOnce({ response: { status: 500, data: { error: 'Internal server error' } } });
    await expect(hookApi.fetchTruckDetails('7')).rejects.toEqual({
      response: { status: 500, data: { error: 'Internal server error' } },
    });
    expect(toastErrorSpy).toHaveBeenCalledWith('Erro ao carregar detalhes do caminhão');

    getSpy.mockRestore();
    toastErrorSpy.mockRestore();
  });
});


