import { secureStorage } from '../src/storage/secureStorage';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  canUseBiometricAuthentication: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('secureStorage (Sem persistência de senhas e com proteção biométrica)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('salva token da sessão com requireAuthentication quando solicitado', async () => {
    await secureStorage.saveToken('jwt-token-123', { requireAuthentication: true });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'ehr_auth_token',
      'jwt-token-123',
      expect.objectContaining({ requireAuthentication: true })
    );
  });

  it('salva e recupera apenas e-mail para "lembrar de mim" (nunca a senha)', async () => {
    await secureStorage.saveRememberedEmail('motorista@ehr.com');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'ehr_remembered_email',
      'motorista@ehr.com',
      expect.any(Object)
    );

    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('motorista@ehr.com');
    const email = await secureStorage.getRememberedEmail();
    expect(email).toBe('motorista@ehr.com');

    await secureStorage.removeRememberedEmail();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ehr_remembered_email');
  });

  it('executa migração e apaga a chave legada de credenciais com senha', async () => {
    await secureStorage.cleanupLegacyCredentials();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ehr_saved_credentials');
  });

  it('apaga token, perfil e opt-in biométrico no logout (clearAll)', async () => {
    await secureStorage.clearAll();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ehr_auth_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ehr_biometric_opt_in');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ehr_driver_data');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ehr_vehicle_data');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ehr_saved_credentials');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ehr_biometric_prompt_dismissed');
  });

  it('gerencia a preferência explícita de opt-in biométrico', async () => {
    await secureStorage.setBiometricOptIn(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'ehr_biometric_opt_in',
      'true',
      expect.any(Object)
    );

    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('true');
    const enabled = await secureStorage.getBiometricOptIn();
    expect(enabled).toBe(true);
  });

  it('quando requireAuthentication falha na gravação: NÃO grava sem proteção, desativa opt-in, apaga token e lança erro claro', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('Hardware security failure'));

    await expect(
      secureStorage.saveToken('jwt-token-123', { requireAuthentication: true })
    ).rejects.toThrow('Biometria indisponível neste aparelho. Use e-mail e senha.');

    // Não deve tentar gravar de novo sem proteção (apenas 1 chamada para setItemAsync)
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ehr_auth_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ehr_biometric_opt_in');
  });

  it('setItem protegido falhando com erro {code: "ERR_TESTE", message: "falha simulada"}: o erro lançado tem code BIOMETRIC_UNAVAILABLE, mensagem genérica, originalCode e originalMessage, e apaga token/opt-in', async () => {
    const err = Object.assign(new Error('falha simulada'), { code: 'ERR_TESTE' });
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(err);

    let caughtError: any;
    try {
      await secureStorage.saveToken('jwt-token-secret-123', { requireAuthentication: true });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError.code).toBe('BIOMETRIC_UNAVAILABLE');
    expect(caughtError.message).toBe('Biometria indisponível neste aparelho. Use e-mail e senha.');
    expect(caughtError.originalCode).toBe('ERR_TESTE');
    expect(caughtError.originalMessage).toBe('falha simulada');
    expect(caughtError.cause).toBe(err);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ehr_auth_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ehr_biometric_opt_in');
  });

  it('console.warn em __DEV__ contém código e mensagem, e NÃO contém o valor do token', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const secretToken = 'RECONHECIVEL_TOKEN_XYZ_789';
    const err = Object.assign(new Error('detalhe_segredo_msg'), { code: 'ERR_DIAGNOSTICO_123' });
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(err);

    try {
      await secureStorage.saveToken(secretToken, { requireAuthentication: true });
    } catch (_) {}

    expect(warnSpy).toHaveBeenCalled();
    const allCalls = warnSpy.mock.calls.map(call => call.join(' '));
    const biometriaWarn = allCalls.find(c => c.includes('[BIOMETRIA] setItem falhou:'));
    expect(biometriaWarn).toBeDefined();
    expect(biometriaWarn).toContain('ERR_DIAGNOSTICO_123');
    expect(biometriaWarn).toContain('detalhe_segredo_msg');

    for (const line of allCalls) {
      expect(line).not.toContain(secretToken);
    }
    warnSpy.mockRestore();
  });

  it('com __DEV__ = false não há console.warn de biometria', async () => {
    const originalDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = false;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const err = Object.assign(new Error('falha silenciosa'), { code: 'ERR_SILENT' });
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(err);
      try {
        await secureStorage.saveToken('jwt-token-123', { requireAuthentication: true });
      } catch (_) {}

      const biometricCalls = warnSpy.mock.calls
        .map(call => call.join(' '))
        .filter(c => c.includes('[BIOMETRIA]'));
      expect(biometricCalls).toHaveLength(0);
    } finally {
      (globalThis as any).__DEV__ = originalDev;
      warnSpy.mockRestore();
    }
  });

  it('se canUseBiometricAuthentication existir, é chamado antes da gravação e logado em __DEV__', async () => {
    (SecureStore.canUseBiometricAuthentication as jest.Mock).mockReturnValue(true);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await secureStorage.saveToken('token-teste', { requireAuthentication: true });

    expect(SecureStore.canUseBiometricAuthentication).toHaveBeenCalled();
    const allCalls = warnSpy.mock.calls.map(c => c.join(' '));
    expect(allCalls.some(c => c.includes('[BIOMETRIA] canUseBiometricAuthentication: true'))).toBe(true);

    warnSpy.mockRestore();
  });

  it('gravação normal sem requireAuthentication funciona normalmente', async () => {
    await secureStorage.saveToken('jwt-token-normal');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'ehr_auth_token',
      'jwt-token-normal',
      expect.not.objectContaining({ requireAuthentication: true })
    );
  });

  it('leitura protegida falhando (getItem) preserva originalCode/originalMessage da mesma forma', async () => {
    const err = Object.assign(new Error('erro leitura protegida'), { code: 'ERR_READ_FAIL' });
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(err);

    let caughtError: any;
    try {
      await secureStorage.getToken({ requireAuthentication: true });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError.code).toBe('BIOMETRIC_UNAVAILABLE');
    expect(caughtError.message).toBe('Biometria indisponível neste aparelho. Use e-mail e senha.');
    expect(caughtError.originalCode).toBe('ERR_READ_FAIL');
    expect(caughtError.originalMessage).toBe('erro leitura protegida');
    expect(caughtError.cause).toBe(err);
    // Chamou apenas 1 vez com requireAuthentication: true, sem fallback desprotegido
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      'ehr_auth_token',
      expect.objectContaining({ requireAuthentication: true })
    );
  });

  it('leitura protegida cancelada pelo usuário (código ou mensagem cancel) retorna null sem lançar erro', async () => {
    const cancelErr = Object.assign(new Error('User cancelled biometric prompt'), { code: 'user_cancel' });
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(cancelErr);

    const token = await secureStorage.getToken({ requireAuthentication: true });
    expect(token).toBeNull();
  });

  it('gerencia a preferência de prompt de biometria dispensado', async () => {
    await secureStorage.setBiometricPromptDismissed(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'ehr_biometric_prompt_dismissed',
      'true',
      expect.any(Object)
    );

    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('true');
    const dismissed = await secureStorage.getBiometricPromptDismissed();
    expect(dismissed).toBe(true);
  });
});
