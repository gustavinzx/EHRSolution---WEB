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

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([1]),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
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
    (secureStorage.saveToken as jest.Mock).mockReset().mockResolvedValue(undefined);
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

  describe('signIn com fluxo de biometria', () => {
    const mockLoginSuccess = {
      token: 'jwt_mock_token',
      driver: { id: 1, name: 'João Silva', email: 'motorista1@ehr.com', phone: '11999999999' },
      vehicle: { id: 10, plate: 'ABC-1234', model: 'Volvo FH 540', brand: 'Volvo', capacity: 500 },
    };

    it('(a) opt-in ligado: signIn grava o token com { requireAuthentication: true } e NÃO grava versão sem proteção; o opt-in continua true; saveToken protegido acontece ANTES de o driver ser definido (signed só vira true depois)', async () => {
      (secureStorage.getToken as jest.Mock).mockResolvedValue(null);
      (secureStorage.getDriver as jest.Mock).mockResolvedValue(null);
      (secureStorage.getVehicle as jest.Mock).mockResolvedValue(null);
      (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(true);
      (apiClient.login as jest.Mock).mockResolvedValueOnce(mockLoginSuccess);

      let contextRef: any;
      let signedWhenSaveTokenCalled: boolean | undefined;

      (secureStorage.saveToken as jest.Mock).mockImplementation(async (_token, opts) => {
        if (opts?.requireAuthentication) {
          signedWhenSaveTokenCalled = contextRef.signed;
        }
      });

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

      // saveToken protegido chamado
      expect(secureStorage.saveToken).toHaveBeenCalledWith('jwt_mock_token', { requireAuthentication: true });
      // NÃO grava versão desprotegida
      expect(secureStorage.saveToken).not.toHaveBeenCalledWith('jwt_mock_token');
      // opt-in continua true (setBiometricOptIn(false) NÃO chamado)
      expect(secureStorage.setBiometricOptIn).not.toHaveBeenCalledWith(false);
      // saveToken protegido aconteceu ANTES do driver ser definido (signed ainda false)
      expect(signedWhenSaveTokenCalled).toBe(false);
      // driver e signed definidos com sucesso após término
      expect(contextRef.signed).toBe(true);
      expect(contextRef.driver).toEqual(expect.objectContaining({ name: 'João Silva' }));
    });

    it('(b) opt-in ligado, gravação protegida lança erro: signIn termina com sucesso (driver definido), setBiometricOptIn(false) é chamado, o token é gravado sem proteção e o opt-in fica false', async () => {
      (secureStorage.getToken as jest.Mock).mockResolvedValue(null);
      (secureStorage.getDriver as jest.Mock).mockResolvedValue(null);
      (secureStorage.getVehicle as jest.Mock).mockResolvedValue(null);
      (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(true);
      (apiClient.login as jest.Mock).mockResolvedValueOnce(mockLoginSuccess);

      (secureStorage.saveToken as jest.Mock).mockImplementation(async (_token, opts) => {
        if (opts?.requireAuthentication) {
          throw new Error('Falha de hardware de segurança');
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

      // Tentou gravação protegida
      expect(secureStorage.saveToken).toHaveBeenCalledWith('jwt_mock_token', { requireAuthentication: true });
      // Falhou: desativa opt-in e zera prompt dismissed para permitir novo diálogo
      expect(secureStorage.setBiometricOptIn).toHaveBeenCalledWith(false);
      expect(secureStorage.setBiometricPromptDismissed).toHaveBeenCalledWith(false);
      // Gravou token sem proteção como fallback
      expect(secureStorage.saveToken).toHaveBeenCalledWith('jwt_mock_token');
      // Login continuou com sucesso (não derrubou nem bloqueou)
      expect(contextRef.signed).toBe(true);
      expect(contextRef.driver).toEqual(expect.objectContaining({ name: 'João Silva' }));
    });

    it('(c) opt-in ligado, usuário cancela o prompt (erro com cancel no code ou na message): mesmo resultado de (b)', async () => {
      (secureStorage.getToken as jest.Mock).mockResolvedValue(null);
      (secureStorage.getDriver as jest.Mock).mockResolvedValue(null);
      (secureStorage.getVehicle as jest.Mock).mockResolvedValue(null);
      (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(true);
      (apiClient.login as jest.Mock).mockResolvedValueOnce(mockLoginSuccess);

      (secureStorage.saveToken as jest.Mock).mockImplementation(async (_token, opts) => {
        if (opts?.requireAuthentication) {
          const cancelErr = Object.assign(new Error('User cancelled biometric prompt'), { code: 'user_cancel' });
          throw cancelErr;
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

      expect(secureStorage.saveToken).toHaveBeenCalledWith('jwt_mock_token', { requireAuthentication: true });
      expect(secureStorage.setBiometricOptIn).toHaveBeenCalledWith(false);
      expect(secureStorage.setBiometricPromptDismissed).toHaveBeenCalledWith(false);
      expect(secureStorage.saveToken).toHaveBeenCalledWith('jwt_mock_token');
      expect(contextRef.signed).toBe(true);
      expect(contextRef.driver).toEqual(expect.objectContaining({ name: 'João Silva' }));
    });

    it('(d) opt-in desligado: signIn grava só sem proteção e nunca chama gravação protegida', async () => {
      (secureStorage.getToken as jest.Mock).mockResolvedValue(null);
      (secureStorage.getDriver as jest.Mock).mockResolvedValue(null);
      (secureStorage.getVehicle as jest.Mock).mockResolvedValue(null);
      (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(false);
      (apiClient.login as jest.Mock).mockResolvedValueOnce(mockLoginSuccess);

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
      expect(secureStorage.saveToken).not.toHaveBeenCalledWith('jwt_mock_token', { requireAuthentication: true });
      expect(secureStorage.setBiometricOptIn).not.toHaveBeenCalled();
      expect(contextRef.signed).toBe(true);
    });

    it.each([
      ['opt-in true e gravação protegida ok', true, 'ok', true],
      ['opt-in true e gravação protegida com erro', true, 'error', false],
      ['opt-in true e gravação protegida cancelada', true, 'cancel', false],
      ['opt-in false', false, 'n/a', false],
    ])('(e) invariante: em nenhum cenário de signIn o opt-in termina true com saveToken sem requireAuthentication (%s)', async (_desc, initialOptIn, protectedOutcome, expectedOptInAfter) => {
      (secureStorage.getToken as jest.Mock).mockResolvedValue(null);
      (secureStorage.getDriver as jest.Mock).mockResolvedValue(null);
      (secureStorage.getVehicle as jest.Mock).mockResolvedValue(null);
      let currentOptIn = initialOptIn;
      (secureStorage.getBiometricOptIn as jest.Mock).mockImplementation(async () => currentOptIn);
      (secureStorage.setBiometricOptIn as jest.Mock).mockImplementation(async (val: boolean) => {
        currentOptIn = val;
      });
      (apiClient.login as jest.Mock).mockResolvedValueOnce(mockLoginSuccess);

      (secureStorage.saveToken as jest.Mock).mockImplementation(async (_token, opts) => {
        if (opts?.requireAuthentication) {
          if (protectedOutcome === 'error') throw new Error('Biometric hardware error');
          if (protectedOutcome === 'cancel') {
            const err: any = new Error('User cancel');
            err.code = 'user_cancel';
            throw err;
          }
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

      // Validação do estado final do opt-in
      expect(currentOptIn).toBe(expectedOptInAfter);

      // Invariante central: se o opt-in terminou true, JAMAIS pode ter ocorrido saveToken sem requireAuthentication
      const calls = (secureStorage.saveToken as jest.Mock).mock.calls;
      const unprotectedCalls = calls.filter(call => !call[1]?.requireAuthentication);
      if (currentOptIn === true) {
        expect(unprotectedCalls).toHaveLength(0);
      }
    });
  });
});
