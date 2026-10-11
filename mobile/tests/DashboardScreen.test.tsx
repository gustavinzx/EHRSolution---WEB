import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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

  it('resumes session on 409 error according to session status', async () => {
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
      expect(mockNavigation.navigate).toHaveBeenCalledWith('FacialAuth', {
        sessionId: 77,
        status: 'requested',
        releaseMethod: 'facial',
      });
    });
  });
});
