import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { LoginScreen } from '../src/screens/LoginScreen';
import { useAuth } from '../src/hooks/useAuth';
import { secureStorage } from '../src/storage/secureStorage';
import * as LocalAuthentication from 'expo-local-authentication';

jest.mock('../src/hooks/useAuth');
jest.mock('../src/storage/secureStorage');
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

describe('LoginScreen', () => {
  const mockSignIn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
    });
    (secureStorage.getSavedCredentials as jest.Mock).mockResolvedValue(null);
    (secureStorage.saveCredentials as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.setBiometricOptIn as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.removeSavedCredentials as jest.Mock).mockResolvedValue(undefined);
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([]);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
  });

  it('renders login fields and brand title', async () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    expect(getByText('EHR SOLUTIONS')).toBeTruthy();
    expect(getByPlaceholderText('Digite seu e-mail corporativo')).toBeTruthy();
    expect(getByPlaceholderText('Digite sua senha')).toBeTruthy();
    expect(getByText('Entrar')).toBeTruthy();
  });

  it('shows alert when attempting login with empty fields', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<LoginScreen />);

    fireEvent.press(getByText('Entrar'));

    expect(alertSpy).toHaveBeenCalledWith('Atenção', 'Informe o e-mail e a senha.');
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('performs standard login and saves credentials when rememberMe is active', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('Digite seu e-mail corporativo'), 'motorista1@ehr.com');
    fireEvent.changeText(getByPlaceholderText('Digite sua senha'), 'Demo@1234');

    await act(async () => {
      fireEvent.press(getByText('Entrar'));
    });

    expect(mockSignIn).toHaveBeenCalledWith('motorista1@ehr.com', 'Demo@1234');
    expect(secureStorage.saveCredentials).toHaveBeenCalledWith('motorista1@ehr.com', 'Demo@1234');
    expect(secureStorage.setBiometricOptIn).toHaveBeenCalledWith(true);
  });

  it('displays biometric unlock option when hardware and biometrics are enrolled', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);
    (secureStorage.getSavedCredentials as jest.Mock).mockResolvedValue({
      email: 'motorista1@ehr.com',
      pass: 'Demo@1234',
    });

    const { findByText } = render(<LoginScreen />);

    const biometricBtn = await findByText('Entrar com Face ID');
    expect(biometricBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(biometricBtn);
    });

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled();
    expect(mockSignIn).toHaveBeenCalledWith('motorista1@ehr.com', 'Demo@1234');
  });
});
