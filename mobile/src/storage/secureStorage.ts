import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Driver } from '../types/driver';
import { Vehicle } from '../types/vehicle';

const TOKEN_KEY = 'ehr_auth_token';
const DRIVER_KEY = 'ehr_driver_data';
const VEHICLE_KEY = 'ehr_vehicle_data';
const CREDENTIALS_KEY = 'ehr_saved_credentials';
const BIOMETRIC_KEY = 'ehr_biometric_opt_in';

const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    console.warn(`[secureStorage fallback] Usando AsyncStorage para salvar ${key} (Apenas DEV Web)`);
    await AsyncStorage.setItem(key, value);
  } else {
    const options = SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
      ? { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
      : undefined;
    if (options) {
      await SecureStore.setItemAsync(key, value, options);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  }
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return await AsyncStorage.getItem(key);
  } else {
    return await SecureStore.getItemAsync(key);
  }
}

async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export const secureStorage = {
  async saveToken(token: string): Promise<void> {
    await setItem(TOKEN_KEY, token);
  },
  async getToken(): Promise<string | null> {
    return await getItem(TOKEN_KEY);
  },
  async removeToken(): Promise<void> {
    await removeItem(TOKEN_KEY);
  },
  
  async saveDriver(driver: Driver): Promise<void> {
    await setItem(DRIVER_KEY, JSON.stringify(driver));
  },
  async getDriver(): Promise<Driver | null> {
    const data = await getItem(DRIVER_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      await removeItem(DRIVER_KEY);
      return null;
    }
  },

  async saveVehicle(vehicle: Vehicle): Promise<void> {
    await setItem(VEHICLE_KEY, JSON.stringify(vehicle));
  },
  async getVehicle(): Promise<Vehicle | null> {
    const data = await getItem(VEHICLE_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      await removeItem(VEHICLE_KEY);
      return null;
    }
  },

  async saveCredentials(email: string, pass: string): Promise<void> {
    await setItem(CREDENTIALS_KEY, JSON.stringify({ email, pass }));
  },
  async getSavedCredentials(): Promise<{ email: string; pass: string } | null> {
    const data = await getItem(CREDENTIALS_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      await removeItem(CREDENTIALS_KEY);
      return null;
    }
  },
  async removeSavedCredentials(): Promise<void> {
    await removeItem(CREDENTIALS_KEY);
  },

  async setBiometricOptIn(enabled: boolean): Promise<void> {
    await setItem(BIOMETRIC_KEY, enabled ? 'true' : 'false');
  },
  async getBiometricOptIn(): Promise<boolean> {
    const val = await getItem(BIOMETRIC_KEY);
    return val === 'true';
  },

  async clearAll(): Promise<void> {
    await removeItem(TOKEN_KEY);
    await removeItem(DRIVER_KEY);
    await removeItem(VEHICLE_KEY);
  },
};
