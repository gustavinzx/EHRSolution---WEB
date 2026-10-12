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
  });
});
