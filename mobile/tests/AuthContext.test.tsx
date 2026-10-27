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
    setBiometricOptIn: jest.fn().mockResolvedValue(undefined),
    setBiometricPromptDismissed: jest.fn().mockResolvedValue(undefined),
    getBiometricPromptDismissed: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../src/services/api/apiClient', () => ({
  apiClient: {
    login: jest.fn(),
    setOnUnauthorized: jest.fn(),
    setAuthToken: jest.fn(),
    getAuthToken: jest.fn(),
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

  it('a) falha na ativação NÃO apaga token em memória e NÃO derruba o motorista logado; optIn permanece false', async () => {
    (secureStorage.getToken as jest.Mock).mockResolvedValue('jwt_mem_token');
    (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João Silva', email: 'motorista1@ehr.com', phone: '11999999999' });
    (secureStorage.getVehicle as jest.Mock).mockResolvedValue(null);
    (secureStorage.saveToken as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Biometria indisponível neste aparelho. Use e-mail e senha.'), {
        code: 'BIOMETRIC_UNAVAILABLE',
        originalCode: 'ERR_KEYSTORE_FAIL',
      })
    );

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

    let result: any;
    await act(async () => {
      result = await contextRef.enableBiometricLogin();
    });

    expect(result.success).toBe(false);
    expect(result.canceled).toBeFalsy();
    expect(result.error).toBeTruthy();

    // Token em memória e motorista logado permanecem intactos
    expect(contextRef.driver).toEqual(expect.objectContaining({ name: 'João Silva' }));
    expect(apiClient.setAuthToken).not.toHaveBeenCalledWith(null);
    expect(secureStorage.setBiometricOptIn).not.toHaveBeenCalledWith(true);
  });

  it('b) signOut com optIn ativo preserva token protegido, motorista em cache e flag optIn, zera memória; com optIn inativo chama clearAll total', async () => {
    (secureStorage.getToken as jest.Mock).mockResolvedValue('jwt_mem_token');
    (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João Silva', email: 'motorista1@ehr.com', phone: '11999999999' });
    (secureStorage.getVehicle as jest.Mock).mockResolvedValue({ id: 10, plate: 'ABC-1234' });

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

    // Caso 1: optIn ativo => NÃO chama clearAll
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(true);
    await act(async () => {
      await contextRef.signOut();
    });

    expect(secureStorage.clearAll).not.toHaveBeenCalled();
    expect(contextRef.driver).toBeNull();
    expect(contextRef.vehicle).toBeNull();
    expect(apiClient.setAuthToken).toHaveBeenCalledWith(null);

    // Caso 2: optIn inativo => chama clearAll total
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(false);
    await act(async () => {
      await contextRef.signOut();
    });

    expect(secureStorage.clearAll).toHaveBeenCalledTimes(1);
  });

  it('c) forgetDevice chama clearAll total (incluindo optIn e dismissed) e zera memória', async () => {
    (secureStorage.getToken as jest.Mock).mockResolvedValue('jwt_mem_token');
    (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João Silva', email: 'motorista1@ehr.com', phone: '11999999999' });
    (secureStorage.getVehicle as jest.Mock).mockResolvedValue({ id: 10, plate: 'ABC-1234' });
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(true);

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
      await contextRef.forgetDevice();
    });

    expect(secureStorage.clearAll).toHaveBeenCalled();
    expect(contextRef.driver).toBeNull();
    expect(contextRef.vehicle).toBeNull();
    expect(apiClient.setAuthToken).toHaveBeenCalledWith(null);
  });
});
