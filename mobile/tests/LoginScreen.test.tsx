import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
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

  it('desbloqueia sessão existente via biometria com token seguro', async () => {
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

    const biometricBtn = await findByText('Entrar com Face ID');
    expect(biometricBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(biometricBtn);
    });

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled();
    expect(apiClient.getMe).toHaveBeenCalled();
    expect(mockUnlockSession).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'João Silva' }),
      expect.objectContaining({ plate: 'ABC-1234' })
    );
  });

  it('trata token expirado no desbloqueio biométrico, remove token e pede login com senha', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([1]);
    (secureStorage.getToken as jest.Mock).mockResolvedValue('expired-jwt-token');
    (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João Silva' });
    (secureStorage.getBiometricOptIn as jest.Mock).mockResolvedValue(true);

    (apiClient.getMe as jest.Mock).mockRejectedValueOnce({ status: 401, message: 'token_expired' });
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { findByText } = render(<LoginScreen />);
    const btn = await findByText('Entrar com Digital');

    await act(async () => {
      fireEvent.press(btn);
    });

    expect(secureStorage.removeToken).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Sessão Expirada',
      expect.stringContaining('Sua sessão expirou')
    );
  });
});
