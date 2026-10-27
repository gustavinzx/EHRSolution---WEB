import React from 'react';
import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/storage/secureStorage';
import { AuthProvider, AuthContext } from '../src/contexts/AuthContext';
import { LoginScreen } from '../src/screens/LoginScreen';
import * as LocalAuthentication from 'expo-local-authentication';

jest.mock('../src/storage/secureStorage', () => ({
  secureStorage: {
    getToken: jest.fn(),
    saveToken: jest.fn(),
    removeToken: jest.fn(),
    getDriver: jest.fn(),
    saveDriver: jest.fn(),
    getVehicle: jest.fn(),
    saveVehicle: jest.fn(),
    getBiometricOptIn: jest.fn(),
    setBiometricOptIn: jest.fn(),
    getRememberedEmail: jest.fn(),
    saveRememberedEmail: jest.fn(),
    removeRememberedEmail: jest.fn(),
    cleanupLegacyCredentials: jest.fn(),
    clearAll: jest.fn(),
  },
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

describe('Biometric Token Cache & In-Memory Session (Regression & Feature Tests)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.setAuthToken(null);
    (secureStorage.cleanupLegacyCredentials as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(false);
    (secureStorage.getRememberedEmail as jest.Mock).mockResolvedValue(null);
    (secureStorage.getDriver as jest.Mock).mockResolvedValue(null);
    (secureStorage.getVehicle as jest.Mock).mockResolvedValue(null);
    (secureStorage.clearAll as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.removeToken as jest.Mock).mockResolvedValue(undefined);
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ success: true, driver: { id: 1, name: 'Test' } }),
    });
  });

  it('a) 5 chamadas ao apiClient depois de setAuthToken("tok") => secureStorage.getToken chamado 0 vezes e header Authorization com "tok"', async () => {
    apiClient.setAuthToken('tok');

    for (let i = 0; i < 5; i++) {
      await apiClient.getMe();
    }

    expect(secureStorage.getToken).toHaveBeenCalledTimes(0);
    expect(mockFetch).toHaveBeenCalledTimes(5);
    for (let i = 1; i <= 5; i++) {
      expect(mockFetch).toHaveBeenNthCalledWith(
        i,
        expect.stringContaining('/auth/driver/me'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer tok',
          }),
        })
      );
    }
  });

  it('b) sem token em memória, request não lê o armazenamento (a chamada segue sem Authorization e/ou cai no fluxo de 401 existente)', async () => {
    apiClient.setAuthToken(null);
    (secureStorage.getToken as jest.Mock).mockResolvedValue('leak_token');

    await apiClient.getMe();

    expect(secureStorage.getToken).toHaveBeenCalledTimes(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const lastHeaders = mockFetch.mock.calls[0][1]?.headers;
    expect(lastHeaders?.Authorization).toBeUndefined();
  });

  it('c) desbloqueio por biometria: exatamente 1 leitura de getToken com requireAuthentication, e depois setAuthToken com o valor lido', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([1]);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });

    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(true);
    (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João Silva' });
    (secureStorage.getToken as jest.Mock).mockResolvedValue('bio_jwt_secret');

    apiClient.setAuthToken(null);

    const { findByText, findByTestId } = render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    );

    const btn = await findByTestId('biometric-login-btn');
    expect(btn).toBeTruthy();

    expect(secureStorage.getToken).toHaveBeenCalledTimes(0);

    await act(async () => {
      fireEvent.press(btn);
    });

    expect(secureStorage.getToken).toHaveBeenCalledTimes(1);
    expect(secureStorage.getToken).toHaveBeenCalledWith({ requireAuthentication: true });
    expect(apiClient.getAuthToken()).toBe('bio_jwt_secret');

    await apiClient.getActiveSession(1);
    expect(secureStorage.getToken).toHaveBeenCalledTimes(1);
  });

  it('d) logout => setAuthToken(null) e token apagado do armazenamento; 401 => token em memória limpo', async () => {
    apiClient.setAuthToken('session_token_123');
    expect(apiClient.getAuthToken()).toBe('session_token_123');

    let authCtx: any;
    render(
      <AuthProvider>
        <AuthContext.Consumer>
          {val => {
            authCtx = val;
            return null;
          }}
        </AuthContext.Consumer>
      </AuthProvider>
    );

    await act(async () => {
      await authCtx.signOut();
    });

    expect(apiClient.getAuthToken()).toBeNull();
    expect(secureStorage.clearAll).toHaveBeenCalled();

    apiClient.setAuthToken('expired_token_456');
    expect(apiClient.getAuthToken()).toBe('expired_token_456');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'token_expired' }),
    });

    try {
      await apiClient.getMe();
    } catch (e) {
      // 401 esperado
    }

    expect(apiClient.getAuthToken()).toBeNull();
  });

  it('e) LoginScreen ao montar NÃO chama getToken', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([1]);
    (secureStorage.getRememberedEmail as jest.Mock).mockResolvedValue('motorista@ehr.com');
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(true);
    (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João Silva' });

    render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    );

    await act(async () => {});

    expect(secureStorage.getRememberedEmail).toHaveBeenCalled();
    expect(secureStorage.getBiometricOptIn).toHaveBeenCalled();
    expect(secureStorage.getDriver).toHaveBeenCalled();
    expect(secureStorage.getToken).not.toHaveBeenCalled();
  });

  it('f) restauração de sessão no início para usuário sem biometria: 1 leitura e token em memória', async () => {
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(false);
    (secureStorage.getToken as jest.Mock).mockResolvedValue('restored_token_789');
    (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 10, name: 'Carlos Motorista' });
    (secureStorage.getVehicle as jest.Mock).mockResolvedValue(null);

    apiClient.setAuthToken(null);

    render(
      <AuthProvider>
        <AuthContext.Consumer>
          {val => null}
        </AuthContext.Consumer>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(secureStorage.getToken).toHaveBeenCalledTimes(1);
      expect(apiClient.getAuthToken()).toBe('restored_token_789');
    });
  });
});
