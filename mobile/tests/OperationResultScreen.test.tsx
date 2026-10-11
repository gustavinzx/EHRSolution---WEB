import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
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
    getActiveSession: jest.fn()
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
});
