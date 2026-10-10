import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { OperationResultScreen } from '../src/screens/OperationResultScreen';
import { apiClient } from '../src/services/api/apiClient';



jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: -10, longitude: -20 } }),
  Accuracy: { Balanced: 3 }
}));

jest.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ vehicle: { id: 1 } })
}));

jest.mock('../src/services/api/apiClient', () => ({
  apiClient: {
    authorizeSession: jest.fn(),
    getActiveSession: jest.fn()
  }
}));

const mockNavigation = { popToTop: jest.fn() } as any;

describe('OperationResultScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('polls active session and transitions to DONE', async () => {
    (apiClient.getActiveSession as jest.Mock)
      .mockResolvedValueOnce({ id: 1, status: 'authorized' })
      .mockResolvedValueOnce({ id: 1, status: 'active' })
      .mockResolvedValue(null);

    const { getByText, findByText, unmount } = render(
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

    act(() => { jest.advanceTimersByTime(4000); });
    await waitFor(() => {
      expect(getByText('Sessão encerrada')).toBeTruthy();
    });
    
    unmount();
  });
});
