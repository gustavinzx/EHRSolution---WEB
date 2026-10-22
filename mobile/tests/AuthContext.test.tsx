import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { AuthProvider, AuthContext } from '../src/contexts/AuthContext';
import { secureStorage } from '../src/storage/secureStorage';
import { apiClient } from '../src/services/api/apiClient';
import { Text, View } from 'react-native';

jest.mock('../src/storage/secureStorage', () => ({
  secureStorage: {
    getToken: jest.fn(),
    getDriver: jest.fn(),
    getVehicle: jest.fn(),
    saveToken: jest.fn(),
    saveDriver: jest.fn(),
    saveVehicle: jest.fn(),
    clearAll: jest.fn(),
    cleanupLegacyCredentials: jest.fn(),
    getBiometricOptIn: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../src/services/api/apiClient', () => ({
  apiClient: {
    login: jest.fn(),
    setOnUnauthorized: jest.fn(),
  },
}));

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (secureStorage.cleanupLegacyCredentials as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(false);
  });

  it('restores vehicle and driver from storage when biometric opt-in is false', async () => {
    (secureStorage.getToken as jest.Mock).mockResolvedValue('token');
    (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João Silva', email: 'motorista1@ehr.com', phone: '11999999999' });
    (secureStorage.getVehicle as jest.Mock).mockResolvedValue({ id: 10, plate: 'ABC-1234', model: 'Volvo FH 540', brand: 'Volvo', capacity: 500 });

    const { getByText } = render(
      <AuthProvider>
        <AuthContext.Consumer>
          {({ driver, vehicle }) => (
            <View>
              <Text>{driver?.name || 'no-driver'}</Text>
              <Text>{vehicle?.plate || 'no-vehicle'}</Text>
            </View>
          )}
        </AuthContext.Consumer>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByText('João Silva')).toBeTruthy();
      expect(getByText('ABC-1234')).toBeTruthy();
    });
    expect(secureStorage.cleanupLegacyCredentials).toHaveBeenCalled();
  });

  it('signIn saves token, driver and vehicle in storage without persisting password', async () => {
    (secureStorage.getToken as jest.Mock).mockResolvedValue(null);
    (secureStorage.getDriver as jest.Mock).mockResolvedValue(null);
    (secureStorage.getVehicle as jest.Mock).mockResolvedValue(null);

    (apiClient.login as jest.Mock).mockResolvedValueOnce({
      token: 'jwt_mock_token',
      driver: {
        id: 1,
        name: 'João Silva',
        email: 'motorista1@ehr.com',
        phone: '11999999999'
      },
      vehicle: {
        id: 10,
        plate: 'ABC-1234',
        model: 'Volvo FH 540',
        brand: 'Volvo',
        capacity: 500
      }
    });

    let contextRef: any;

    render(
      <AuthProvider>
        <AuthContext.Consumer>
          {value => {
            contextRef = value;
            return null;
          }}
        </AuthContext.Consumer>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextRef.loading).toBe(false);
    });

    await act(async () => {
      await contextRef.signIn('motorista1@ehr.com', 'Demo@1234');
    });

    expect(secureStorage.saveToken).toHaveBeenCalledWith('jwt_mock_token');
    expect(secureStorage.saveDriver).toHaveBeenCalledWith({
      id: 1,
      name: 'João Silva',
      email: 'motorista1@ehr.com',
      phone: '11999999999'
    });
    expect(secureStorage.saveVehicle).toHaveBeenCalledWith({
      id: 10,
      plate: 'ABC-1234',
      model: 'Volvo FH 540',
      brand: 'Volvo',
      capacity: 500
    });
    expect(contextRef.vehicle).toEqual({
      id: 10,
      plate: 'ABC-1234',
      model: 'Volvo FH 540',
      brand: 'Volvo',
      capacity: 500
    });
  });

  it('signIn with vehicle: null does NOT call saveVehicle and sets vehicle to null', async () => {
    (secureStorage.getToken as jest.Mock).mockResolvedValue(null);
    (secureStorage.getDriver as jest.Mock).mockResolvedValue(null);
    (secureStorage.getVehicle as jest.Mock).mockResolvedValue(null);

    (apiClient.login as jest.Mock).mockResolvedValueOnce({
      token: 'jwt_mock_token_null',
      driver: {
        id: 2,
        name: 'Maria Oliveira',
        email: 'motorista2@ehr.com',
        phone: '11988888888'
      },
      vehicle: null
    });

    let contextRef: any;

    render(
      <AuthProvider>
        <AuthContext.Consumer>
          {value => {
            contextRef = value;
            return null;
          }}
        </AuthContext.Consumer>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextRef.loading).toBe(false);
    });

    await act(async () => {
      await contextRef.signIn('motorista2@ehr.com', 'Demo@1234');
    });

    expect(secureStorage.saveToken).toHaveBeenCalledWith('jwt_mock_token_null');
    expect(secureStorage.saveDriver).toHaveBeenCalledWith({
      id: 2,
      name: 'Maria Oliveira',
      email: 'motorista2@ehr.com',
      phone: '11988888888'
    });
    expect(secureStorage.saveVehicle).not.toHaveBeenCalled();
    expect(contextRef.vehicle).toBeNull();
  });

  it('onUnauthorized e signOut apagam token e opt-in via clearAll', async () => {
    (secureStorage.getToken as jest.Mock).mockResolvedValue(null);
    (secureStorage.getDriver as jest.Mock).mockResolvedValue(null);
    (secureStorage.getVehicle as jest.Mock).mockResolvedValue(null);

    let contextRef: any;

    render(
      <AuthProvider>
        <AuthContext.Consumer>
          {value => {
            contextRef = value;
            return null;
          }}
        </AuthContext.Consumer>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextRef.loading).toBe(false);
    });

    act(() => {
      contextRef.onUnauthorized();
    });

    expect(secureStorage.clearAll).toHaveBeenCalled();

    await act(async () => {
      await contextRef.signOut();
    });

    expect(secureStorage.clearAll).toHaveBeenCalledTimes(2);
  });
});
