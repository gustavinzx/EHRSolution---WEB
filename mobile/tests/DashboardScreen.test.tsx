import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { DashboardScreen } from '../src/screens/DashboardScreen';
import { apiClient } from '../src/services/api/apiClient';
import { getBleLock } from '../src/services/bluetooth/bleLock';
import { useAuth } from '../src/hooks/useAuth';

jest.mock('../src/hooks/useAuth');
jest.mock('../src/services/api/apiClient');
jest.mock('../src/services/bluetooth/bleLock');

const mockNavigation = { navigate: jest.fn() } as any;

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    it('aba Histórico se mostra vazia sem "1.330 L" e exibe estado honesto (Bloco C2)', () => {
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
      expect(getByText('Seu histórico de abastecimentos aparecerá aqui.')).toBeTruthy();

      // Mock numbers and fake data are NOT displayed
      expect(queryByText(/1\.330/i)).toBeNull();
      expect(queryByText(/3 registrados/i)).toBeNull();
      expect(queryByText(/USB04E06/i)).toBeNull();
    });
  });
});
