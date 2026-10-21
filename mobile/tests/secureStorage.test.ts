import { secureStorage } from '../src/storage/secureStorage';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('secureStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses SecureStore for token', async () => {
    await secureStorage.saveToken('abc');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ehr_auth_token', 'abc');
  });

  it('saves and retrieves credentials', async () => {
    await secureStorage.saveCredentials('driver@ehr.com', 'secret123');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'ehr_saved_credentials',
      JSON.stringify({ email: 'driver@ehr.com', pass: 'secret123' })
    );

    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ email: 'driver@ehr.com', pass: 'secret123' })
    );
    const creds = await secureStorage.getSavedCredentials();
    expect(creds).toEqual({ email: 'driver@ehr.com', pass: 'secret123' });
  });

  it('handles biometric opt in preference', async () => {
    await secureStorage.setBiometricOptIn(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ehr_biometric_opt_in', 'true');

    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('true');
    const enabled = await secureStorage.getBiometricOptIn();
    expect(enabled).toBe(true);
  });
});
