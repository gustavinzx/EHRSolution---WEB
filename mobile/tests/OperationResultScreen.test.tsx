import React from 'react';
import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { OperationResultScreen } from '../src/screens/OperationResultScreen';
import { apiClient } from '../src/services/api/apiClient';
import * as Location from 'expo-location';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 }
}));

jest.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ vehicle: { id: 10 } })
}));

jest.mock('../src/services/api/apiClient', () => ({
  apiClient: {
    authorizeSession: jest.fn(),
    getActiveSession: jest.fn(),
    cancelSession: jest.fn(),
    getSession: jest.fn(),
  }
}));

const mockNavigation = { popToTop: jest.fn(), replace: jest.fn() } as any;

describe('OperationResultScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({ coords: { latitude: -23.55, longitude: -46.63 } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Authorization Flow & Error Mapping (D3)', () => {
    it('authorizes with GPS granted sending lat and lng', async () => {
      (apiClient.authorizeSession as jest.Mock).mockResolvedValueOnce({ id: 1, status: 'authorized' });

      render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'AUTHORIZING' } } as any} 
        />
      );

      await waitFor(() => {
        expect(apiClient.authorizeSession).toHaveBeenCalledWith(1, { lat: -23.55, lng: -46.63 });
      });
    });

    it('authorizes with GPS denied sending empty body', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
      (apiClient.authorizeSession as jest.Mock).mockResolvedValueOnce({ id: 1, status: 'authorized' });

      render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'AUTHORIZING' } } as any} 
        />
      );

      await waitFor(() => {
        expect(apiClient.authorizeSession).toHaveBeenCalledWith(1, undefined);
      });
    });

    it('handles geofence 403 with real server error message', async () => {
      (apiClient.authorizeSession as jest.Mock).mockRejectedValueOnce({
        status: 403,
        message: 'Caminhão fora da área do posto autorizado. Tentativa bloqueada e alertada.'
      });

      const { findByText } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'AUTHORIZING' } } as any} 
        />
      );

      const msg = await findByText('Caminhão fora da área do posto autorizado.');
      expect(msg).toBeTruthy();
    });

    it('handles facial_verification_expired showing retry button', async () => {
      (apiClient.authorizeSession as jest.Mock).mockRejectedValueOnce({
        status: 403,
        code: 'facial_verification_expired'
      });

      const { findByText, getByText } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'AUTHORIZING' } } as any} 
        />
      );

      const msg = await findByText('Validação facial expirada. Refaça a captura.');
      expect(msg).toBeTruthy();

      const retryBtn = getByText('Refazer Validação Facial');
      expect(retryBtn).toBeTruthy();
    });

    it('handles facial_verification_required', async () => {
      (apiClient.authorizeSession as jest.Mock).mockRejectedValueOnce({
        status: 403,
        code: 'facial_verification_required'
      });

      const { findByText } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'AUTHORIZING' } } as any} 
        />
      );

      expect(await findByText('Validação facial obrigatória não realizada.')).toBeTruthy();
    });

    it('handles facial_verification_already_used', async () => {
      (apiClient.authorizeSession as jest.Mock).mockRejectedValueOnce({
        status: 403,
        code: 'facial_verification_already_used'
      });

      const { findByText } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'AUTHORIZING' } } as any} 
        />
      );

      expect(await findByText('Validação facial já utilizada.')).toBeTruthy();
    });

    it('handles ble_confirmation_required, expired, and already_used', async () => {
      (apiClient.authorizeSession as jest.Mock).mockRejectedValueOnce({
        status: 403,
        code: 'ble_confirmation_required'
      });

      const { findByText } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'AUTHORIZING' } } as any} 
        />
      );

      expect(await findByText('Confirmação Bluetooth necessária.')).toBeTruthy();
    });

    it('handles 404 or 409 session already processed or expired', async () => {
      (apiClient.authorizeSession as jest.Mock).mockRejectedValueOnce({
        status: 409,
        message: 'Sessão já foi processada'
      });

      const { findByText } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'AUTHORIZING' } } as any} 
        />
      );

      expect(await findByText('Sessão já processada ou expirada.')).toBeTruthy();
    });

    it('handles unknown error without displaying raw code', async () => {
      (apiClient.authorizeSession as jest.Mock).mockRejectedValueOnce({
        status: 500,
        code: 'internal_error_xyz',
        message: 'Database crash'
      });

      const { findByText } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'AUTHORIZING' } } as any} 
        />
      );

      expect(await findByText('Não foi possível autorizar. Tente novamente ou procure o gestor.')).toBeTruthy();
    });
  });

  describe('Polling Flow & Edge Cases (D1, D2)', () => {
    it('polls active session and finishes with Abastecimento concluído', async () => {
      (apiClient.getActiveSession as jest.Mock)
        .mockResolvedValueOnce({ id: 1, status: 'authorized' })
        .mockResolvedValueOnce({ id: 1, status: 'active' })
        .mockResolvedValue(null);

      const { getByText, unmount } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'WAITING_HARDWARE' } } as any} 
        />
      );

      expect(getByText('Aguardando liberação da bomba')).toBeTruthy();

      act(() => { jest.advanceTimersByTime(2000); });
      await waitFor(() => {
        expect(apiClient.getActiveSession).toHaveBeenCalledTimes(1);
      });

      act(() => { jest.advanceTimersByTime(2000); });
      await waitFor(() => {
        expect(getByText('Abastecendo...')).toBeTruthy();
      });

      act(() => { jest.advanceTimersByTime(2000); });
      await waitFor(() => {
        expect(getByText('Abastecimento concluído')).toBeTruthy();
      });

      unmount();
    });

    it('handles session ended without fueling (null without active)', async () => {
      (apiClient.getActiveSession as jest.Mock).mockResolvedValue(null);

      const { getByText, unmount } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'WAITING_HARDWARE' } } as any} 
        />
      );

      act(() => { jest.advanceTimersByTime(2000); });
      await waitFor(() => {
        expect(getByText('Sessão encerrada sem abastecimento. Se precisar, inicie novamente.')).toBeTruthy();
      });

      unmount();
    });

    it('handles cancelled session from polling', async () => {
      (apiClient.getActiveSession as jest.Mock).mockResolvedValueOnce({
        id: 1,
        status: 'cancelled'
      });

      const { getByText, unmount } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'WAITING_HARDWARE' } } as any} 
        />
      );

      act(() => { jest.advanceTimersByTime(2000); });
      await waitFor(() => {
        expect(getByText('Sessão cancelada.')).toBeTruthy();
      });

      unmount();
    });

    it('handles expired session from polling', async () => {
      (apiClient.getActiveSession as jest.Mock).mockResolvedValueOnce({
        id: 1,
        status: 'expired'
      });

      const { getByText, unmount } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'WAITING_HARDWARE' } } as any} 
        />
      );

      act(() => { jest.advanceTimersByTime(2000); });
      await waitFor(() => {
        expect(getByText('Tempo da sessão esgotado. Inicie novamente.')).toBeTruthy();
      });

      unmount();
    });

    it('shows network notice after 3 consecutive failures without stopping polling', async () => {
      (apiClient.getActiveSession as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { getByText, findByText, unmount } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'WAITING_HARDWARE' } } as any} 
        />
      );

      // 1st failure
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      // 2nd failure
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      // 3rd failure
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      const banner = await findByText('Sem conexão. Tentando novamente...');
      expect(banner).toBeTruthy();
      // Still in WAITING_HARDWARE
      expect(getByText('Aguardando liberação da bomba')).toBeTruthy();

      unmount();
    });

    it('stops polling when unmounted', () => {
      const { unmount } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'WAITING_HARDWARE' } } as any} 
        />
      );

      unmount();
      const callCount = (apiClient.getActiveSession as jest.Mock).mock.calls.length;
      act(() => { jest.advanceTimersByTime(10000); });
      expect((apiClient.getActiveSession as jest.Mock).mock.calls.length).toBe(callCount);
    });
  });

  describe('Cancellation Flow in OperationResultScreen (C2)', () => {
    it('shows cancel button in AUTHORIZING, WAITING_HARDWARE, and BLOCKED_NEEDS_MANAGER, but NOT in FUELING', () => {
      const { queryByTestId: queryAuth } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'AUTHORIZING' } } as any} 
        />
      );
      expect(queryAuth('cancel-btn')).toBeTruthy();

      const { queryByTestId: queryWait } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'WAITING_HARDWARE' } } as any} 
        />
      );
      expect(queryWait('cancel-btn')).toBeTruthy();

      const { queryByTestId: queryBlock } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'BLOCKED_NEEDS_MANAGER' } } as any} 
        />
      );
      expect(queryBlock('cancel-btn')).toBeTruthy();

      const { queryByTestId: queryFuel } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'FUELING' } } as any} 
        />
      );
      expect(queryFuel('cancel-btn')).toBeNull();
    });

    it('shows specific confirmation text in WAITING_HARDWARE', () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const { getByTestId } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'WAITING_HARDWARE' } } as any} 
        />
      );

      fireEvent.press(getByTestId('cancel-btn'));
      expect(alertSpy).toHaveBeenCalledWith(
        'Cancelar abastecimento',
        'Se a bomba já foi liberada, ela será travada novamente.',
        expect.any(Array)
      );
    });

    it('shows general confirmation text in AUTHORIZING', () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const { getByTestId } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'AUTHORIZING' } } as any} 
        />
      );

      fireEvent.press(getByTestId('cancel-btn'));
      expect(alertSpy).toHaveBeenCalledWith(
        'Cancelar abastecimento',
        'Deseja realmente cancelar o abastecimento?',
        expect.any(Array)
      );
    });

    it('cancels successfully and returns to Dashboard', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (apiClient.cancelSession as jest.Mock).mockResolvedValueOnce({ success: true, status: 'cancelled' });

      const { getByTestId } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'WAITING_HARDWARE' } } as any} 
        />
      );

      fireEvent.press(getByTestId('cancel-btn'));
      const confirmAction = (alertSpy.mock.calls[0]![2] as any[])[1];
      await act(async () => {
        confirmAction.onPress();
      });

      await waitFor(() => {
        expect(apiClient.cancelSession).toHaveBeenCalledWith(1);
        expect(mockNavigation.popToTop).toHaveBeenCalled();
      });
    });

    it('handles 409 Sessão em andamento não pode ser cancelada by alerting and continuing FUELING', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (apiClient.cancelSession as jest.Mock).mockRejectedValueOnce({
        status: 409,
        message: 'Sessão em andamento não pode ser cancelada',
      });

      const { getByTestId, findByText } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'WAITING_HARDWARE' } } as any} 
        />
      );

      fireEvent.press(getByTestId('cancel-btn'));
      const confirmAction = (alertSpy.mock.calls[0]![2] as any[])[1];
      await act(async () => {
        confirmAction.onPress();
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Aviso', 'O abastecimento já começou e não pode ser cancelado.');
      });
      const fuelingText = await findByText('Abastecendo...');
      expect(fuelingText).toBeTruthy();
    });

    it('handles 404 Sessão não encontrada by returning to Dashboard', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (apiClient.cancelSession as jest.Mock).mockRejectedValueOnce({
        status: 404,
        message: 'Sessão não encontrada',
      });

      const { getByTestId } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'WAITING_HARDWARE' } } as any} 
        />
      );

      fireEvent.press(getByTestId('cancel-btn'));
      const confirmAction = (alertSpy.mock.calls[0]![2] as any[])[1];
      await act(async () => {
        confirmAction.onPress();
      });

      await waitFor(() => {
        expect(mockNavigation.popToTop).toHaveBeenCalled();
      });
    });

    it('handles network error on cancel showing alert and allows repeating', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (apiClient.cancelSession as jest.Mock).mockRejectedValueOnce({
        status: 0,
        message: 'Sem conexão com o servidor.',
      });

      const { getByTestId } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'WAITING_HARDWARE' } } as any} 
        />
      );

      fireEvent.press(getByTestId('cancel-btn'));
      const confirmAction = (alertSpy.mock.calls[0]![2] as any[])[1];
      await act(async () => {
        confirmAction.onPress();
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Erro', 'Sem conexão. Verifique sua rede e tente novamente.');
      });
      expect(getByTestId('cancel-btn')).toBeTruthy();
    });

    it('handles 500 server error on cancel showing generic alert and allows repeating', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (apiClient.cancelSession as jest.Mock).mockRejectedValueOnce({
        status: 500,
        message: 'Internal Server Error',
      });

      const { getByTestId } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'WAITING_HARDWARE' } } as any} 
        />
      );

      fireEvent.press(getByTestId('cancel-btn'));
      const confirmAction = (alertSpy.mock.calls[0]![2] as any[])[1];
      await act(async () => {
        confirmAction.onPress();
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Erro', 'Não foi possível cancelar o abastecimento. Tente novamente.');
      });
      expect(getByTestId('cancel-btn')).toBeTruthy();
      expect(mockNavigation.popToTop).not.toHaveBeenCalled();
    });
  });

  describe('ERROR Screen Cancellation (C3)', () => {
    it('shows Cancelar sessão button on ERROR state and calls cancelSession when pressed', async () => {
      (apiClient.cancelSession as jest.Mock).mockResolvedValueOnce({ success: true, status: 'cancelled' });

      const { getByTestId } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 77, initialState: 'ERROR' } } as any} 
        />
      );

      const cancelBtn = getByTestId('cancel-session-error-btn');
      expect(cancelBtn).toBeTruthy();

      await act(async () => {
        fireEvent.press(cancelBtn);
      });

      await waitFor(() => {
        expect(apiClient.cancelSession).toHaveBeenCalledWith(77);
        expect(mockNavigation.popToTop).toHaveBeenCalled();
      });
    });
  });

  describe('Result Display on DONE (C5)', () => {
    it('displays volume and duration formatted in pt-BR when result is present', async () => {
      (apiClient.getSession as jest.Mock).mockResolvedValueOnce({
        id: 1,
        status: 'completed',
        result: {
          volume_liters: 45.5,
          duration_minutes: 14,
        }
      });

      const { findByText } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'DONE' } } as any} 
        />
      );

      const volText = await findByText(/Volume abastecido: 45,5 L/);
      expect(volText).toBeTruthy();

      const durText = await findByText(/Duração: 14 min/);
      expect(durText).toBeTruthy();
    });

    it('displays confirmation pending message when volume_liters is null', async () => {
      (apiClient.getSession as jest.Mock).mockResolvedValueOnce({
        id: 1,
        status: 'completed',
        result: {
          volume_liters: null,
          duration_minutes: 10,
        }
      });

      const { findByText } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'DONE' } } as any} 
        />
      );

      const pendingText = await findByText('O volume ainda será confirmado pela operação.');
      expect(pendingText).toBeTruthy();

      const durText = await findByText(/Duração: 10 min/);
      expect(durText).toBeTruthy();
    });

    it('shows simple Abastecimento concluído message when getSession fails', async () => {
      (apiClient.getSession as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      const { findByText, queryByTestId } = render(
        <OperationResultScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, initialState: 'DONE' } } as any} 
        />
      );

      const doneText = await findByText('Abastecimento concluído');
      expect(doneText).toBeTruthy();

      expect(queryByTestId('result-card')).toBeNull();
    });
  });
});
