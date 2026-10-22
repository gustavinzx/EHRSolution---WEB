import { secureStorage } from '../src/storage/secureStorage';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
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

  it('gravação normal sem requireAuthentication funciona normalmente', async () => {
    await secureStorage.saveToken('jwt-token-normal');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'ehr_auth_token',
      'jwt-token-normal',
      expect.not.objectContaining({ requireAuthentication: true })
    );
  });

  it('leitura com biometria: se falhar ou usuário cancelar, retorna null sem fallback para leitura desprotegida', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('User cancelled'));

    const token = await secureStorage.getToken({ requireAuthentication: true });
    expect(token).toBeNull();
    // Apenas 1 chamada a getItemAsync (com requireAuthentication: true), NENHUM fallback desprotegido
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      'ehr_auth_token',
      expect.objectContaining({ requireAuthentication: true })
    );
  });
});
