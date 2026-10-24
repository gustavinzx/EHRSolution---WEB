import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { DashboardScreen } from '../src/screens/DashboardScreen';
import { apiClient } from '../src/services/api/apiClient';
import { getBleLock } from '../src/services/bluetooth/bleLock';
import { useAuth } from '../src/hooks/useAuth';

let mockLastFocusEffectCallback: (() => void | (() => void)) | null = null;

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return {
    ...actual,
    useFocusEffect: jest.fn((cb) => {
      mockLastFocusEffectCallback = cb;
      React.useEffect(() => {
        cb();
      }, [cb]);
    }),
  };
});

jest.mock('../src/hooks/useAuth');
jest.mock('../src/services/api/apiClient');
jest.mock('../src/services/bluetooth/bleLock');

const mockNavigation = { navigate: jest.fn() } as any;

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.getHistory as jest.Mock).mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      summary: { count: 0, total_liters: 0 },
    });
  });

  it('hides BLE button when BleLock is not available', () => {
    (useAuth as jest.Mock).mockReturnValue({
      driver: { name: 'João' },
      vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
      signOut: jest.fn(),
    });
    (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

    const { queryByText, getByText } = render(<DashboardScreen navigation={mockNavigation} route={{} as any} />);

    expect(getByText('INICIAR ABASTECIMENTO')).toBeTruthy();
    expect(queryByText('Usar Bluetooth')).toBeNull();
  });

  it('shows BLE button when BleLock is available', () => {
    (useAuth as jest.Mock).mockReturnValue({
      driver: { name: 'João' },
      vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
      signOut: jest.fn(),
    });
    (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => true });

    const { getByText } = render(<DashboardScreen navigation={mockNavigation} route={{} as any} />);

    expect(getByText('Usar Bluetooth')).toBeTruthy();
  });

  it('when vehicle is null, displays message and disables action buttons', () => {
    (useAuth as jest.Mock).mockReturnValue({
      driver: { name: 'João' },
      vehicle: null,
      signOut: jest.fn(),
    });
    (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => true });

    const { getByText, getByTestId } = render(<DashboardScreen navigation={mockNavigation} route={{} as any} />);

    expect(getByText('Nenhum veículo vinculado. Procure o gestor.')).toBeTruthy();

    const mainBtn = getByTestId('main-action-btn');
    expect(mainBtn.props.accessibilityState?.disabled || mainBtn.props.disabled).toBe(true);

    const bleBtn = getByTestId('ble-action-btn');
    expect(bleBtn.props.accessibilityState?.disabled || bleBtn.props.disabled).toBe(true);
  });

  it('resumes pending session on 409 error when selecting Retomar sessão', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (useAuth as jest.Mock).mockReturnValue({
      driver: { name: 'João' },
      vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
      signOut: jest.fn(),
    });
    (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

    (apiClient.requestSession as jest.Mock).mockRejectedValueOnce({
      status: 409,
      session: {
        id: 77,
        status: 'requested',
        release_method: 'facial',
      }
    });

    const { getByText } = render(<DashboardScreen navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(getByText('INICIAR ABASTECIMENTO'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Sessão pendente',
        'Já existe uma sessão de abastecimento pendente para este caminhão.',
        expect.any(Array)
      );
    });

    const resumeAction = (alertSpy.mock.calls[0]![2] as any[])[0];
    act(() => {
      resumeAction.onPress();
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith('FacialAuth', {
      sessionId: 77,
      status: 'requested',
      releaseMethod: 'facial',
    });
  });

  describe('409 Session Handling & Cancel/Restart (C4)', () => {
    it('offers Cancelar e começar de novo on pending session and executes cancel then request', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      (apiClient.requestSession as jest.Mock)
        .mockRejectedValueOnce({
          status: 409,
          session: {
            id: 77,
            status: 'requested',
            release_method: 'facial',
          }
        })
        .mockResolvedValueOnce({
          id: 78,
          status: 'requested',
          release_method: 'facial',
        });

      (apiClient.cancelSession as jest.Mock).mockResolvedValueOnce({
        success: true,
        status: 'cancelled',
      });

      const { getByText } = render(<DashboardScreen navigation={mockNavigation} route={{} as any} />);

      fireEvent.press(getByText('INICIAR ABASTECIMENTO'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Sessão pendente',
          'Já existe uma sessão de abastecimento pendente para este caminhão.',
          expect.any(Array)
        );
      });

      const cancelRestartAction = (alertSpy.mock.calls[0]![2] as any[])[1];
      expect(cancelRestartAction.text).toBe('Cancelar e começar de novo');

      await act(async () => {
        await cancelRestartAction.onPress();
      });

      // Verify order: cancelSession called first with 77, then requestSession called with 10
      expect(apiClient.cancelSession).toHaveBeenCalledWith(77);
      expect(apiClient.requestSession).toHaveBeenNthCalledWith(2, 10, 'facial');

      expect(mockNavigation.navigate).toHaveBeenCalledWith('FacialAuth', {
        sessionId: 78,
        status: 'requested',
        releaseMethod: 'facial',
      });
    });

    it('navigates directly and does NOT offer cancellation when 409 session is active', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      (apiClient.requestSession as jest.Mock).mockRejectedValueOnce({
        status: 409,
        session: {
          id: 99,
          status: 'active',
          release_method: 'facial',
        }
      });

      const { getByText } = render(<DashboardScreen navigation={mockNavigation} route={{} as any} />);

      fireEvent.press(getByText('INICIAR ABASTECIMENTO'));

      await waitFor(() => {
        expect(mockNavigation.navigate).toHaveBeenCalledWith('OperationResult', {
          sessionId: 99,
          initialState: 'FUELING',
          releaseMethod: 'facial',
        });
      });

      expect(alertSpy).not.toHaveBeenCalled();
      expect(apiClient.cancelSession).not.toHaveBeenCalled();
    });

    it('shows generic error message and does NOT call requestSession when cancelSession fails with status 500 (B3)', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      (apiClient.requestSession as jest.Mock).mockRejectedValueOnce({
        status: 409,
        session: {
          id: 77,
          status: 'requested',
          release_method: 'facial',
        }
      });

      (apiClient.cancelSession as jest.Mock).mockRejectedValueOnce({
        status: 500,
        message: 'Internal Server Error',
      });

      const { getByText } = render(<DashboardScreen navigation={mockNavigation} route={{} as any} />);

      fireEvent.press(getByText('INICIAR ABASTECIMENTO'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Sessão pendente',
          'Já existe uma sessão de abastecimento pendente para este caminhão.',
          expect.any(Array)
        );
      });

      const cancelRestartAction = (alertSpy.mock.calls[0]![2] as any[])[1];
      expect(cancelRestartAction.text).toBe('Cancelar e começar de novo');

      await act(async () => {
        await cancelRestartAction.onPress();
      });

      expect(apiClient.cancelSession).toHaveBeenCalledWith(77);
      expect(alertSpy).toHaveBeenCalledWith(
        'Erro',
        'Não foi possível cancelar o abastecimento. Tente novamente.'
      );
      expect(apiClient.requestSession).toHaveBeenCalledTimes(1);
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('shows network error message and does NOT call requestSession when cancelSession fails with status 0 (B3)', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      (apiClient.requestSession as jest.Mock).mockRejectedValueOnce({
        status: 409,
        session: {
          id: 77,
          status: 'requested',
          release_method: 'facial',
        }
      });

      (apiClient.cancelSession as jest.Mock).mockRejectedValueOnce({
        status: 0,
        message: 'Sem conexão com o servidor.',
      });

      const { getByText } = render(<DashboardScreen navigation={mockNavigation} route={{} as any} />);

      fireEvent.press(getByText('INICIAR ABASTECIMENTO'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Sessão pendente',
          'Já existe uma sessão de abastecimento pendente para este caminhão.',
          expect.any(Array)
        );
      });

      const cancelRestartAction = (alertSpy.mock.calls[0]![2] as any[])[1];
      expect(cancelRestartAction.text).toBe('Cancelar e começar de novo');

      await act(async () => {
        await cancelRestartAction.onPress();
      });

      expect(apiClient.cancelSession).toHaveBeenCalledWith(77);
      expect(alertSpy).toHaveBeenCalledWith(
        'Erro',
        'Sem conexão. Verifique sua rede e tente novamente.'
      );
      expect(apiClient.requestSession).toHaveBeenCalledTimes(1);
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('aba Início não exibe percentual de nível do tanque e exibe apenas capacidade (Bloco C2)', () => {
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João Silva', email: 'joao@ehr.com', phone: '11999999999' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      const { getByText, queryByText } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      // Shows vehicle capacity
      expect(getByText('Capacidade')).toBeTruthy();
      expect(getByText('500 L')).toBeTruthy();

      // Does NOT show tank fuel level percentage or "Nível atual"
      expect(queryByText(/Nível atual/i)).toBeNull();
      expect(queryByText(/90%/i)).toBeNull();
      expect(queryByText(/USB04E06/i)).toBeNull();
    });

    it('aba Histórico se mostra vazia sem "1.330 L" e exibe estado honesto (Bloco C2)', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João Silva', email: 'joao@ehr.com', phone: '11999999999' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      const { getByText, queryByText } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      // Switch to Histórico tab
      fireEvent.press(getByText('Histórico'));

      // Empty state honest message is displayed
      await waitFor(() => {
        expect(getByText('Seu histórico de abastecimentos aparecerá aqui.')).toBeTruthy();
      });

      // Mock numbers and fake data are NOT displayed
      expect(queryByText(/1\.330/i)).toBeNull();
      expect(queryByText(/3 registrados/i)).toBeNull();
      expect(queryByText(/USB04E06/i)).toBeNull();
    });
  });

  describe('Histórico Tab (Bloco B / E1)', () => {
    it('mostra indicador de carregamento enquanto busca histórico', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João Silva' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      let resolveHistory: (val: any) => void;
      (apiClient.getHistory as jest.Mock).mockReturnValue(
        new Promise((res) => {
          resolveHistory = res;
        })
      );

      const { getByText, getByTestId } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      fireEvent.press(getByText('Histórico'));

      expect(getByTestId('history-loading-indicator')).toBeTruthy();
      expect(getByText('Carregando histórico...')).toBeTruthy();

      await act(async () => {
        resolveHistory!({ items: [], page: 1, limit: 20, total: 0, summary: { count: 0, total_liters: 0 } });
      });
    });

    it('renderiza lista de itens com volume, data local, posto, duração e método formatados', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João Silva' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      const mockItems = [
        {
          id: 1,
          timestamp: '2026-10-14T10:30:00.000Z',
          truck_plate: 'ABC-1234',
          volume_liters: 12.5,
          duration_minutes: 15.0,
          release_method: 'facial',
          station_name: 'Posto Shell Rodoeste',
        },
        {
          id: 2,
          timestamp: '2026-10-13T15:00:00.000Z',
          truck_plate: 'DEF-5678',
          volume_liters: null,
          duration_minutes: null,
          release_method: 'ble_fallback',
          station_name: null,
        },
        {
          id: 3,
          timestamp: '2026-10-12T09:00:00.000Z',
          truck_plate: 'GHI-9012',
          volume_liters: 50,
          duration_minutes: 20.0,
          release_method: 'manager_override',
          station_name: 'Posto Ipiranga Centro',
        },
      ];

      (apiClient.getHistory as jest.Mock).mockResolvedValueOnce({
        items: mockItems,
        page: 1,
        limit: 20,
        total: 3,
        summary: { count: 3, total_liters: 62.5 },
      });

      const { getByText, queryByText, getByTestId } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      fireEvent.press(getByText('Histórico'));

      await waitFor(() => {
        expect(getByTestId('history-item-1')).toBeTruthy();
      });

      // Volume 12.5 in pt-BR => "12,5 L"
      expect(getByText('12,5 L')).toBeTruthy();

      // Volume null => "Volume a confirmar"
      expect(getByText('Volume a confirmar')).toBeTruthy();

      // Station null => "Posto não informado"
      expect(getByText('Posto não informado')).toBeTruthy();
      expect(getByText('Posto Shell Rodoeste')).toBeTruthy();

      // Duration: 15 min shown for item 1, 20 min for item 3
      expect(getByText('15 min')).toBeTruthy();
      expect(getByText('20 min')).toBeTruthy();

      // Method labels
      expect(getByText('Facial')).toBeTruthy();
      expect(getByText('Contingência Bluetooth')).toBeTruthy();
      expect(getByText('Liberação do gestor')).toBeTruthy();

      // Summary badge using summary data
      expect(getByTestId('history-summary-text')).toBeTruthy();
      expect(getByText('Últimos 30 dias: 3 abastecimentos • 62,5 L')).toBeTruthy();

      // NEVER shows invented entries or "1.330 L"
      expect(queryByText(/1\.330/i)).toBeNull();
    });

    it('resumo com count > 0 e total_liters === 0 exibe Volume a confirmar', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João Silva' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      (apiClient.getHistory as jest.Mock).mockResolvedValueOnce({
        items: [
          {
            id: 10,
            timestamp: '2026-10-14T10:00:00.000Z',
            truck_plate: 'ABC-1234',
            volume_liters: null,
            duration_minutes: null,
            release_method: 'facial',
            station_name: 'Posto Teste',
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
        summary: { count: 1, total_liters: 0 },
      });

      const { getByText } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      fireEvent.press(getByText('Histórico'));

      await waitFor(() => {
        expect(getByText('Últimos 30 dias: 1 abastecimento • Volume a confirmar')).toBeTruthy();
      });
    });

    it('exibe mensagem de conexão quando status 0 e botão Tentar novamente refaz chamada', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João Silva' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      (apiClient.getHistory as jest.Mock)
        .mockRejectedValueOnce({ status: 0, message: 'Sem conexão' })
        .mockResolvedValueOnce({
          items: [
            {
              id: 1,
              timestamp: '2026-10-15T10:00:00.000Z',
              truck_plate: 'ABC-1234',
              volume_liters: 30,
              duration_minutes: 10,
              release_method: 'facial',
              station_name: 'Posto ABC',
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
          summary: { count: 1, total_liters: 30 },
        });

      const { getByText, getByTestId } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      fireEvent.press(getByText('Histórico'));

      await waitFor(() => {
        expect(getByText('Sem conexão. Verifique sua rede e tente novamente.')).toBeTruthy();
        expect(getByTestId('history-retry-btn')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-retry-btn'));

      await waitFor(() => {
        expect(getByText('30 L')).toBeTruthy();
      });
      expect(apiClient.getHistory).toHaveBeenCalledTimes(2);
    });

    it('exibe mensagem genérica quando status de erro é diferente de 0', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João Silva' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      (apiClient.getHistory as jest.Mock).mockRejectedValueOnce({ status: 500, message: 'Server error' });

      const { getByText } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      fireEvent.press(getByText('Histórico'));

      await waitFor(() => {
        expect(getByText('Não foi possível carregar o histórico.')).toBeTruthy();
      });
    });

    it('botão Carregar mais pagina e adiciona itens sem duplicar por id', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João Silva' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      (apiClient.getHistory as jest.Mock)
        .mockResolvedValueOnce({
          items: [
            {
              id: 1,
              timestamp: '2026-10-15T10:00:00.000Z',
              truck_plate: 'ABC-1234',
              volume_liters: 20,
              duration_minutes: 5,
              release_method: 'facial',
              station_name: 'Posto 1',
            },
          ],
          page: 1,
          limit: 1,
          total: 2,
          summary: { count: 2, total_liters: 50 },
        })
        .mockResolvedValueOnce({
          items: [
            // Returns id 1 again + id 2
            {
              id: 1,
              timestamp: '2026-10-15T10:00:00.000Z',
              truck_plate: 'ABC-1234',
              volume_liters: 20,
              duration_minutes: 5,
              release_method: 'facial',
              station_name: 'Posto 1',
            },
            {
              id: 2,
              timestamp: '2026-10-14T10:00:00.000Z',
              truck_plate: 'ABC-1234',
              volume_liters: 30,
              duration_minutes: 8,
              release_method: 'facial',
              station_name: 'Posto 2',
            },
          ],
          page: 2,
          limit: 1,
          total: 2,
          summary: { count: 2, total_liters: 50 },
        });

      const { getByText, getByTestId, queryAllByTestId } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      fireEvent.press(getByText('Histórico'));

      await waitFor(() => {
        expect(getByTestId('history-item-1')).toBeTruthy();
        expect(getByTestId('history-load-more-btn')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-load-more-btn'));

      await waitFor(() => {
        expect(getByTestId('history-item-2')).toBeTruthy();
      });

      expect(apiClient.getHistory).toHaveBeenCalledWith(2, 20);
      expect(queryAllByTestId('history-item-1').length).toBe(1);
      expect(queryAllByTestId('history-item-2').length).toBe(1);
    });

    it('recarrega histórico ao ganhar foco através do useFocusEffect', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João Silva' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      (apiClient.getHistory as jest.Mock).mockResolvedValue({
        items: [],
        page: 1,
        limit: 20,
        total: 0,
        summary: { count: 0, total_liters: 0 },
      });

      const { getByText } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      fireEvent.press(getByText('Histórico'));

      await waitFor(() => {
        expect(apiClient.getHistory).toHaveBeenCalledTimes(1);
      });

      act(() => {
        mockLastFocusEffectCallback?.();
      });

      await waitFor(() => {
        expect(apiClient.getHistory).toHaveBeenCalledTimes(2);
      });
    });

    it('ignora resposta de requisição antiga que resolve depois de uma nova requisição', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João Silva' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      let resolveFirstReq: (val: any) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirstReq = resolve;
      });

      (apiClient.getHistory as jest.Mock)
        .mockReturnValueOnce(firstPromise)
        .mockResolvedValueOnce({
          items: [
            {
              id: 99,
              timestamp: '2026-10-15T12:00:00.000Z',
              truck_plate: 'NEW-9999',
              volume_liters: 99,
              duration_minutes: 9,
              release_method: 'facial',
              station_name: 'Posto Recente',
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
          summary: { count: 1, total_liters: 99 },
        });

      const { getByText, queryByText } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      fireEvent.press(getByText('Histórico'));

      act(() => {
        mockLastFocusEffectCallback?.();
      });

      await waitFor(() => {
        expect(getByText('NEW-9999')).toBeTruthy();
      });

      await act(async () => {
        resolveFirstReq!({
          items: [
            {
              id: 11,
              timestamp: '2026-10-10T12:00:00.000Z',
              truck_plate: 'OLD-1111',
              volume_liters: 11,
              duration_minutes: 5,
              release_method: 'facial',
              station_name: 'Posto Antigo',
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
          summary: { count: 1, total_liters: 11 },
        });
      });

      expect(getByText('NEW-9999')).toBeTruthy();
      expect(queryByText('OLD-1111')).toBeNull();
    });

    it('falha em "Carregar mais" com itens já renderizados exibe a mensagem inline mantendo os itens visíveis, e repetir limpa o erro (C1/C3)', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João Silva' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      (apiClient.getHistory as jest.Mock)
        .mockResolvedValueOnce({
          items: [
            {
              id: 1,
              timestamp: '2026-10-15T10:00:00.000Z',
              truck_plate: 'ABC-1234',
              volume_liters: 20,
              duration_minutes: 5,
              release_method: 'facial',
              station_name: 'Posto 1',
            },
          ],
          page: 1,
          limit: 1,
          total: 2,
          summary: { count: 2, total_liters: 50 },
        })
        .mockRejectedValueOnce({ status: 500, message: 'Internal Server Error' })
        .mockResolvedValueOnce({
          items: [
            {
              id: 2,
              timestamp: '2026-10-14T10:00:00.000Z',
              truck_plate: 'ABC-1234',
              volume_liters: 30,
              duration_minutes: 8,
              release_method: 'facial',
              station_name: 'Posto 2',
            },
          ],
          page: 2,
          limit: 1,
          total: 2,
          summary: { count: 2, total_liters: 50 },
        });

      const { getByText, getByTestId, queryByText, queryByTestId } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      fireEvent.press(getByText('Histórico'));

      await waitFor(() => {
        expect(getByTestId('history-item-1')).toBeTruthy();
        expect(getByTestId('history-load-more-btn')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-load-more-btn'));

      await waitFor(() => {
        expect(getByText('Não foi possível carregar mais. Toque para tentar de novo.')).toBeTruthy();
        expect(getByTestId('history-inline-retry-btn')).toBeTruthy();
      });

      expect(getByTestId('history-item-1')).toBeTruthy();
      expect(queryByTestId('history-error-card')).toBeNull();

      fireEvent.press(getByTestId('history-inline-retry-btn'));

      await waitFor(() => {
        expect(getByTestId('history-item-2')).toBeTruthy();
      });

      expect(queryByText('Não foi possível carregar mais. Toque para tentar de novo.')).toBeNull();
      expect(queryByTestId('history-inline-error')).toBeNull();
      expect(getByTestId('history-item-1')).toBeTruthy();
    });

    it('falha com status 0 em "Carregar mais" com itens já renderizados exibe Sem conexão inline sem esconder a lista', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        driver: { name: 'João Silva' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH', capacity: 500 },
        signOut: jest.fn(),
      });
      (getBleLock as jest.Mock).mockReturnValue({ isAvailable: () => false });

      (apiClient.getHistory as jest.Mock)
        .mockResolvedValueOnce({
          items: [
            {
              id: 1,
              timestamp: '2026-10-15T10:00:00.000Z',
              truck_plate: 'ABC-1234',
              volume_liters: 20,
              duration_minutes: 5,
              release_method: 'facial',
              station_name: 'Posto 1',
            },
          ],
          page: 1,
          limit: 1,
          total: 2,
          summary: { count: 2, total_liters: 50 },
        })
        .mockRejectedValueOnce({ status: 0, message: 'Sem conexão' });

      const { getByText, getByTestId, queryByTestId } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      fireEvent.press(getByText('Histórico'));

      await waitFor(() => {
        expect(getByTestId('history-item-1')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-load-more-btn'));

      await waitFor(() => {
        expect(getByText('Sem conexão. Verifique sua rede e tente novamente.')).toBeTruthy();
        expect(getByTestId('history-inline-error')).toBeTruthy();
      });

      expect(getByTestId('history-item-1')).toBeTruthy();
      expect(queryByTestId('history-error-card')).toBeNull();
    });

    it('renderiza etiqueta Cancelado, não mostra litros para cancelado e não quebra com itens antigos sem status (Bloco K2)', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        driver: { id: 1, name: 'João Motorista', email: 'joao@transportadora.com.br' },
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
      });

      const mockMixedItems = [
        {
          id: 201,
          kind: 'session',
          status: 'cancelled',
          timestamp: '2026-10-24T10:00:00.000Z',
          truck_plate: 'CAN-1234',
          volume_liters: null,
          duration_minutes: null,
          release_method: 'facial',
          station_name: null,
        },
        {
          id: 202,
          kind: 'session',
          status: 'expired',
          timestamp: '2026-10-24T09:00:00.000Z',
          truck_plate: 'EXP-5678',
          volume_liters: null,
          duration_minutes: null,
          release_method: 'facial',
          station_name: null,
        },
        {
          id: 203,
          timestamp: '2026-10-24T08:00:00.000Z',
          truck_plate: 'LEG-9999',
          volume_liters: 45.0,
          duration_minutes: 12.0,
          release_method: 'facial',
          station_name: 'Posto Legacy',
        },
      ];

      (apiClient.getHistory as jest.Mock).mockResolvedValueOnce({
        items: mockMixedItems,
        page: 1,
        limit: 20,
        total: 3,
        summary: { count: 1, total_liters: 45.0 },
      });

      const { getByText, getByTestId } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      fireEvent.press(getByText('Histórico'));

      await waitFor(() => {
        expect(getByTestId('history-item-201')).toBeTruthy();
        expect(getByTestId('history-item-202')).toBeTruthy();
        expect(getByTestId('history-item-203')).toBeTruthy();
      });

      expect(getByText('Cancelado')).toBeTruthy();
      expect(getByText('Expirado')).toBeTruthy();
      expect(getByText('CAN-1234')).toBeTruthy();
      expect(getByText('EXP-5678')).toBeTruthy();
      expect(getByText('45 L')).toBeTruthy();
      expect(getByText('Posto Legacy')).toBeTruthy();
      expect(getByText('12 min')).toBeTruthy();
      expect(getByText('LEG-9999')).toBeTruthy();
    });
  });

  describe('Carteira Tab (Sicoob Open Banking)', () => {
    it('switches to Carteira tab and displays Sicoob card, balance, and transaction', async () => {

      (apiClient.getWallet as jest.Mock).mockResolvedValue({
        bank: {
          institution: 'Banco Cooperativo Sicoob S.A.',
          code: '756',
          cooperative: 'Sicoob Credifrotas DF (4321)',
          accountNumber: '10987-6',
          corporateName: 'EHR Logística & Transportes S.A.',
          status: 'connected',
          protocol: 'Open Finance Brasil / OAuth2 mTLS',
          developerPortalUrl: 'https://developers.sicoob.com.br/portal/apis',
          lastSync: '2026-10-21T18:00:00Z',
        },
        wallet: {
          monthlyCreditLimit: 5000,
          balanceAvailable: 3450.5,
          totalSpentMonth: 1549.5,
          totalLitersMonth: 256.12,
          averagePricePerLiter: 6.05,
          fuelType: 'Diesel S10',
          fuelingCount: 1,
        },
        transactions: [
          {
            id: 101,
            timestamp: '2026-10-21T12:00:00Z',
            stationName: 'Posto Shell Recanto das Emas',
            brand: 'Shell',
            truckPlate: 'BRA2E19',
            liters: 100,
            pricePerLiter: 6.05,
            totalAmount: 605.0,
            paymentMethod: 'Cartão Frota Sicoob Visa PJ',
            status: 'estimated',

          },
        ],
      });

      (useAuth as jest.Mock).mockReturnValue({
        driver: { id: 1, name: 'João Silva', email: 'motorista1@ehr.com', phone: '11999999999' },
        vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH 540', capacity: 500 },
        signOut: jest.fn(),
      });

      const { getByText, findByText } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      // Press Carteira in bottom dock
      await act(async () => {
        fireEvent.press(getByText('Carteira'));
      });

      await waitFor(() => {
        expect(apiClient.getWallet).toHaveBeenCalled();
      });

      // Check Sicoob card elements
      expect(await findByText('SICOOB')).toBeTruthy();
      expect(await findByText('CARTÃO FROTA PJ')).toBeTruthy();
      expect(await findByText('Credifrotas DF (756)')).toBeTruthy();

      // Check Open Finance status
      expect(await findByText('Open Finance Brasil • Conexão Ativa mTLS')).toBeTruthy();

      // Check Transaction item
      expect(await findByText('Posto Shell Recanto das Emas')).toBeTruthy();
      expect(await findByText('Estimado')).toBeTruthy();
      expect(await findByText('Valores estimados (litros × preço de referência). Não representam cobrança do cartão.')).toBeTruthy();
    });

    it('opens card registration modal, fills inputs and registers card', async () => {
      (apiClient.addCard as jest.Mock) = jest.fn().mockResolvedValue({
        id: 10,
        cardHolder: 'CARLOS SILVA',
        lastFour: '9988',
        cardBrand: 'Visa Frota',
        bankName: 'Sicoob Credifrotas (756)',
        monthlyLimit: 6000,
        isDefault: true,
        status: 'active',
      });

      const { getByText, getByTestId } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      await act(async () => {
        fireEvent.press(getByText('Carteira'));
      });

      await waitFor(() => {
        expect(apiClient.getWallet).toHaveBeenCalled();
      });

      // Press Cadastrar Cartão
      const addBtn = getByTestId('add-card-btn');
      await act(async () => {
        fireEvent.press(addBtn);
      });

      // Modal should be visible
      expect(getByTestId('card-registration-modal')).toBeTruthy();

      // Fill in card fields
      await act(async () => {
        fireEvent.changeText(getByTestId('input-card-number'), '4111222233339988');
        fireEvent.changeText(getByTestId('input-card-holder'), 'CARLOS SILVA');
        fireEvent.changeText(getByTestId('input-card-expiry'), '12/30');
        fireEvent.changeText(getByTestId('input-card-cvv'), '789');
        fireEvent.changeText(getByTestId('input-card-limit'), '6000');
      });

      // Submit
      await act(async () => {
        fireEvent.press(getByTestId('submit-card-btn'));
      });

      await waitFor(() => {
        expect(apiClient.addCard).toHaveBeenCalledWith(
          expect.objectContaining({
            cardNumber: '4111222233339988',
            cardHolder: 'CARLOS SILVA',
            expirationMonth: 12,
            expirationYear: 2030,
            cardBrand: 'Visa Frota',
            monthlyLimit: 6000,
          })
        );
      });
    });

    it('switches to Perfil tab and displays device biometrics card with test button', async () => {
      const { getByText, getByTestId, findByText } = render(
        <DashboardScreen navigation={mockNavigation} route={{} as any} />
      );

      await act(async () => {
        fireEvent.press(getByText('Perfil'));
      });

      expect(await findByText('Biometria do Smartphone')).toBeTruthy();
      expect(getByTestId('test-biometrics-profile-btn')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId('test-biometrics-profile-btn'));
      });
    });
  });

});
