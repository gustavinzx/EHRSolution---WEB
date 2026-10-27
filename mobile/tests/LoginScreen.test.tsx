import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import { LoginScreen } from '../src/screens/LoginScreen';
import { useAuth } from '../src/hooks/useAuth';
import { secureStorage } from '../src/storage/secureStorage';
import { apiClient } from '../src/services/api/apiClient';
import * as LocalAuthentication from 'expo-local-authentication';

jest.mock('../src/hooks/useAuth');
jest.mock('../src/storage/secureStorage');
jest.mock('../src/services/api/apiClient', () => ({
  getBaseUrl: jest.fn().mockReturnValue('http://localhost:3001'),
  apiClient: {
    getMe: jest.fn(),
    setAuthToken: jest.fn(),
    getAuthToken: jest.fn(),
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

describe('LoginScreen (Sessão Segura sem Armazenamento de Senha)', () => {
  const mockSignIn = jest.fn();
  const mockUnlockSession = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
      unlockSession: mockUnlockSession,
    });
    (secureStorage.getRememberedEmail as jest.Mock).mockResolvedValue(null);
    (secureStorage.saveRememberedEmail as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.removeRememberedEmail as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.cleanupLegacyCredentials as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.getToken as jest.Mock).mockResolvedValue(null);
    (secureStorage.getDriver as jest.Mock).mockResolvedValue(null);
    (secureStorage.removeToken as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.setBiometricOptIn as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(false);
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([]);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
  });

  it('renderiza campos de login e limpa credenciais legadas na montagem', async () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    expect(getByText('EHR SOLUTIONS')).toBeTruthy();
    expect(getByPlaceholderText('Digite seu e-mail corporativo')).toBeTruthy();
    expect(getByPlaceholderText('Digite sua senha')).toBeTruthy();
    expect(getByText('Entrar')).toBeTruthy();
    expect(secureStorage.cleanupLegacyCredentials).toHaveBeenCalled();
  });

  it('exibe alerta ao tentar entrar com campos vazios', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<LoginScreen />);

    fireEvent.press(getByText('Entrar'));

    expect(alertSpy).toHaveBeenCalledWith('Atenção', 'Informe o e-mail e a senha.');
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('executa login padrão e salva APENAS e-mail quando "Lembrar de mim" ativo (sem salvar senha nem ativar biometria sozinho)', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('Digite seu e-mail corporativo'), 'motorista1@ehr.com');
    fireEvent.changeText(getByPlaceholderText('Digite sua senha'), 'Demo@1234');

    await act(async () => {
      fireEvent.press(getByText('Entrar'));
    });

    expect(mockSignIn).toHaveBeenCalledWith('motorista1@ehr.com', 'Demo@1234');
    // Salva apenas e-mail
    expect(secureStorage.saveRememberedEmail).toHaveBeenCalledWith('motorista1@ehr.com');
    // "Lembrar de mim" NÃO ativa biometria sozinho
    expect(secureStorage.setBiometricOptIn).not.toHaveBeenCalledWith(true);
  });

  it('d) e e) desbloqueia sessão existente via biometria com token seguro: exatamente 1 getToken protegido, NUNCA chama authenticateAsync, valida com getMe e chama unlockSession', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);
    (secureStorage.getToken as jest.Mock).mockResolvedValue('valid-jwt-token');
    (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João Silva' });
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(true);
    (apiClient.getMe as jest.Mock).mockResolvedValue({
      driver: { id: 1, name: 'João Silva', email: 'motorista1@ehr.com' },
      vehicle: { id: 10, plate: 'ABC-1234' },
    });

    const { findByText } = render(<LoginScreen />);

    // d) exibe o botão com o nome do motorista cacheador
    const biometricBtn = await findByText('Entrar como João Silva');
    expect(biometricBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(biometricBtn);
    });

    // e) exatamente 1 chamada protegida a getToken, NUNCA authenticateAsync
    expect(secureStorage.getToken).toHaveBeenCalledTimes(1);
    expect(secureStorage.getToken).toHaveBeenCalledWith({ requireAuthentication: true });
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    expect(apiClient.getMe).toHaveBeenCalled();
    expect(mockUnlockSession).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'João Silva' }),
      expect.objectContaining({ plate: 'ABC-1234' }),
      'valid-jwt-token'
    );
  });

  it('f) cancelamento do prompt pelo usuário no desbloqueio não exibe Alert e permanece no login', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([1]);
    // secureStorage retorna null no cancelamento (código ou mensagem com 'cancel')
    (secureStorage.getToken as jest.Mock).mockResolvedValue(null);
    (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João Silva' });
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(true);

    const alertSpy = jest.spyOn(Alert, 'alert');
    const { findByText } = render(<LoginScreen />);
    const btn = await findByText('Entrar como João Silva');

    await act(async () => {
      fireEvent.press(btn);
    });

    expect(secureStorage.getToken).toHaveBeenCalledWith({ requireAuthentication: true });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockUnlockSession).not.toHaveBeenCalled();
    expect(apiClient.getMe).not.toHaveBeenCalled();
  });

  it('f2) no cancelamento, se opt-in foi desligado ou driver ausente, esconde o botão biométrico', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([1]);
    (secureStorage.getToken as jest.Mock).mockResolvedValue(null);
    (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João Silva' });
    // Inicialmente opt-in true para montar com o botão visível
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValueOnce(true);

    const alertSpy = jest.spyOn(Alert, 'alert');
    const { findByText, queryByTestId } = render(<LoginScreen />);
    const btn = await findByText('Entrar como João Silva');
    expect(btn).toBeTruthy();

    // Quando o usuário cancela, opt-in é verificado e agora retorna false
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValueOnce(false);

    await act(async () => {
      fireEvent.press(btn);
    });

    expect(alertSpy).not.toHaveBeenCalled();
    // Botão é escondido
    expect(queryByTestId('biometric-login-btn')).toBeNull();
  });

  it('g) erro real no desbloqueio (ex: keystore invalidado): com __DEV__ true inclui "[dev]" + detalhes', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([1]);
    (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João Silva' });
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(true);

    const err = Object.assign(new Error('Biometria indisponível neste aparelho. Use e-mail e senha.'), {
      code: 'BIOMETRIC_UNAVAILABLE',
      originalCode: 'ERR_KEYSTORE_FAIL',
      originalMessage: 'Key permanently invalidated',
    });
    (secureStorage.getToken as jest.Mock).mockRejectedValueOnce(err);

    const alertSpy = jest.spyOn(Alert, 'alert');
    const { findByText } = render(<LoginScreen />);
    const btn = await findByText('Entrar como João Silva');

    await act(async () => {
      fireEvent.press(btn);
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Aviso',
      expect.stringContaining('[dev] ERR_KEYSTORE_FAIL Key permanently invalidated')
    );
  });

  it('g) erro real no desbloqueio: com __DEV__ false NÃO inclui "[dev]"', async () => {
    const originalDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = false;

    try {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([1]);
      (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João Silva' });
      (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(true);

      const err = Object.assign(new Error('Biometria indisponível neste aparelho. Use e-mail e senha.'), {
        code: 'BIOMETRIC_UNAVAILABLE',
        originalCode: 'ERR_KEYSTORE_FAIL',
        originalMessage: 'Key permanently invalidated',
      });
      (secureStorage.getToken as jest.Mock).mockRejectedValueOnce(err);

      const alertSpy = jest.spyOn(Alert, 'alert');
      const { findByText } = render(<LoginScreen />);
      const btn = await findByText('Entrar como João Silva');

      await act(async () => {
        fireEvent.press(btn);
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'Aviso',
        'Biometria indisponível neste aparelho. Use e-mail e senha.'
      );
      expect(alertSpy).not.toHaveBeenCalledWith(
        'Aviso',
        expect.stringContaining('[dev]')
      );
    } finally {
      (globalThis as any).__DEV__ = originalDev;
    }
  });

  it('h) trata 401/403 no desbloqueio biométrico, limpa com clearAll e pede login com senha', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([1]);
    (secureStorage.getToken as jest.Mock).mockResolvedValue('expired-jwt-token');
    (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João Silva' });
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(true);

    (apiClient.getMe as jest.Mock).mockRejectedValueOnce({ status: 401, message: 'token_expired' });
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { findByText } = render(<LoginScreen />);
    const btn = await findByText('Entrar como João Silva');

    await act(async () => {
      fireEvent.press(btn);
    });

    expect(secureStorage.clearAll).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Sessão Expirada',
      expect.stringContaining('Sua sessão expirou')
    );
  });

  it('j) LoginScreen NÃO contém saveToken com requireAuthentication: true', () => {
    const fs = require('fs');
    const src = fs.readFileSync('src/screens/LoginScreen.tsx', 'utf8');
    expect(src).not.toMatch(/saveToken\s*\([^)]*requireAuthentication/);
  });

  it('k) com Platform.OS="android" e tipos [2, 1], mostra "Digital" e NÃO mostra "Face ID"', async () => {
    const originalPlatform = Platform.OS;
    try {
      Platform.OS = 'android';
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([2, 1]);
      (secureStorage.getToken as jest.Mock).mockResolvedValue('valid-token');
      (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João Silva' });
      (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(true);

      const { findByText, queryByText } = render(<LoginScreen />);
      const btn = await findByText('Entrar com Digital');
      expect(btn).toBeTruthy();
      expect(queryByText(/Face ID/i)).toBeNull();
    } finally {
      Platform.OS = originalPlatform;
    }
  });
});
