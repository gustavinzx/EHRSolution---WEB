import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Driver } from '../types/driver';
import { Vehicle } from '../types/vehicle';

const TOKEN_KEY = 'ehr_auth_token';
const DRIVER_KEY = 'ehr_driver_data';
const VEHICLE_KEY = 'ehr_vehicle_data';
const REMEMBERED_EMAIL_KEY = 'ehr_remembered_email';
const BIOMETRIC_KEY = 'ehr_biometric_opt_in';
const LEGACY_CREDENTIALS_KEY = 'ehr_saved_credentials';

const isWeb = Platform.OS === 'web';

export interface StorageOptions {
  requireAuthentication?: boolean;
}

async function setItem(key: string, value: string, options?: StorageOptions): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value);
    return;
  }

  if (options?.requireAuthentication) {
    if (typeof (SecureStore as any).canUseBiometricAuthentication === 'function') {
      try {
        const canUse = (SecureStore as any).canUseBiometricAuthentication();
        if (__DEV__) {
          console.warn(`[BIOMETRIA] canUseBiometricAuthentication: ${Boolean(canUse)}`);
        }
      } catch (_) {
        // Se a função lançar erro ou não existir, ignore sem erro
      }
    }

    const secureOptions: SecureStore.SecureStoreOptions = {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      requireAuthentication: true,
    };
    try {
      await SecureStore.setItemAsync(key, value, secureOptions);
    } catch (err: any) {
      // Quando o chamador pedir requireAuthentication e a gravação protegida falhar:
      // NÃO grave o token sem proteção como se fosse protegido.
      // Desative o opt-in de biometria (setBiometricOptIn(false)),
      // apague qualquer token gravado por essa tentativa e devolva erro claro.
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (_) {}
      try {
        await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
      } catch (_) {}

      const originalCode = String(err?.code || (err && typeof err === 'object' && 'code' in err ? err.code : '') || '');
      const originalMessage = String(err?.message || (typeof err === 'string' ? err : '') || '');

      if (__DEV__) {
        console.warn(`[BIOMETRIA] setItem falhou: ${originalCode} ${originalMessage}`.trimEnd());
      }

      const customError = new Error('Biometria indisponível neste aparelho. Use e-mail e senha.');
      (customError as any).code = 'BIOMETRIC_UNAVAILABLE';
      (customError as any).originalCode = originalCode;
      (customError as any).originalMessage = originalMessage;
      (customError as any).cause = err;
      throw customError;
    }
  } else {
    // Gravação normal (sem requireAuthentication) continua funcionando como hoje
    const secureOptions: SecureStore.SecureStoreOptions = {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    };
    try {
      await SecureStore.setItemAsync(key, value, secureOptions);
    } catch {
      await SecureStore.setItemAsync(key, value);
    }
  }
}

async function getItem(key: string, options?: StorageOptions): Promise<string | null> {
  if (isWeb) {
    return await AsyncStorage.getItem(key);
  }

  if (options?.requireAuthentication) {
    // Na leitura com biometria: se falhar ou o usuário cancelar, volta para e-mail e senha,
    // sem fallback para leitura desprotegida do mesmo token.
    try {
      return await SecureStore.getItemAsync(key, { requireAuthentication: true });
    } catch (err: any) {
      const originalCode = String(err?.code || (err && typeof err === 'object' && 'code' in err ? err.code : '') || '');
      const originalMessage = String(err?.message || (typeof err === 'string' ? err : '') || '');

      if (__DEV__) {
        console.warn(`[BIOMETRIA] getItem falhou: ${originalCode} ${originalMessage}`.trimEnd());
      }

      const customError = new Error('Biometria indisponível neste aparelho. Use e-mail e senha.');
      (customError as any).code = 'BIOMETRIC_UNAVAILABLE';
      (customError as any).originalCode = originalCode;
      (customError as any).originalMessage = originalMessage;
      (customError as any).cause = err;
      throw customError;
    }
  } else {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
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
  // Token da sessão do motorista (pode exigir autenticação biométrica via SecureStore)
  async saveToken(token: string, options?: StorageOptions): Promise<void> {
    await setItem(TOKEN_KEY, token, options);
  },
  async getToken(options?: StorageOptions): Promise<string | null> {
    return await getItem(TOKEN_KEY, options);
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

  // "Lembrar de mim": persiste SOMENTE o e-mail (nunca a senha!)
  async saveRememberedEmail(email: string): Promise<void> {
    await setItem(REMEMBERED_EMAIL_KEY, email);
  },
  async getRememberedEmail(): Promise<string | null> {
    return await getItem(REMEMBERED_EMAIL_KEY);
  },
  async removeRememberedEmail(): Promise<void> {
    await removeItem(REMEMBERED_EMAIL_KEY);
  },

  // Preferência explícita do motorista para desbloquear sessão com biometria
  async setBiometricOptIn(enabled: boolean): Promise<void> {
    await setItem(BIOMETRIC_KEY, enabled ? 'true' : 'false');
  },
  async getBiometricOptIn(): Promise<boolean> {
    const val = await getItem(BIOMETRIC_KEY);
    return val === 'true';
  },

  // Migração segura: remove a chave antiga 'ehr_saved_credentials' que armazenava senha
  async cleanupLegacyCredentials(): Promise<void> {
    try {
      await removeItem(LEGACY_CREDENTIALS_KEY);
    } catch (_) {}
  },

  // Logout completo: apaga token, dados de motorista, veículo e opt-in de biometria
  async clearAll(): Promise<void> {
    await removeItem(TOKEN_KEY);
    await removeItem(DRIVER_KEY);
    await removeItem(VEHICLE_KEY);
    await removeItem(BIOMETRIC_KEY);
    await removeItem(LEGACY_CREDENTIALS_KEY);
  },
};
