import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Driver } from '../types/driver';
import { Vehicle } from '../types/vehicle';
import { secureStorage } from '../storage/secureStorage';
import { apiClient } from '../services/api/apiClient';
import { Alert } from 'react-native';

let LocalAuthModule: typeof import('expo-local-authentication') | null = null;
try {
  LocalAuthModule = require('expo-local-authentication');
} catch {
  LocalAuthModule = null;
}

export interface BiometricActionResult {
  success: boolean;
  canceled?: boolean;
  error?: any;
}

interface AuthContextData {
  signed: boolean;
  driver: Driver | null;
  vehicle: Vehicle | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  unlockSession: (driver: Driver, vehicle?: Vehicle | null, token?: string | null) => void;
  signOut: () => Promise<void>;
  forgetDevice: () => Promise<void>;
  enableBiometricLogin: (promptTitle?: string) => Promise<BiometricActionResult>;
  disableBiometricLogin: () => Promise<void>;
  onUnauthorized: (message?: string) => void;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  const enableBiometricLogin = useCallback(async (promptTitle?: string): Promise<BiometricActionResult> => {
    if (!LocalAuthModule) {
      return { success: false, error: new Error('Módulo de autenticação biométrica não disponível.') };
    }
    try {
      const hasHardware = await LocalAuthModule.hasHardwareAsync();
      const isEnrolled = await LocalAuthModule.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        return { success: false, error: new Error('Biometria não configurada no dispositivo.') };
      }

      const authResult = await LocalAuthModule.authenticateAsync({
        promptMessage: promptTitle || 'Confirme sua biometria para autorizar o desbloqueio',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar Senha',
        disableDeviceFallback: false,
      });

      if (!authResult.success) {
        const errStr = String(authResult.error || '');
        const isCanceled =
          errStr.toLowerCase().includes('cancel') ||
          authResult.error === 'user_cancel' ||
          authResult.error === 'system_cancel' ||
          authResult.error === 'app_cancel';

        return { success: false, canceled: isCanceled, error: authResult.error };
      }

      const currentToken = apiClient.getAuthToken();
      if (!currentToken) {
        return { success: false, error: new Error('Sessão ativa não encontrada para proteção biométrica.') };
      }

      try {
        await secureStorage.saveToken(currentToken, { requireAuthentication: true });
        await secureStorage.setBiometricOptIn(true);
        return { success: true };
      } catch (err: any) {
        // Falha na gravação protegida NÃO mexe na sessão em memória nem derruba o usuário.
        // Apenas garante opt-in = false.
        await secureStorage.setBiometricOptIn(false);
        return { success: false, error: err };
      }
    } catch (unexpectedErr: any) {
      await secureStorage.setBiometricOptIn(false);
      return { success: false, error: unexpectedErr };
    }
  }, []);

  const disableBiometricLogin = useCallback(async (): Promise<void> => {
    // Remove o token protegido e desativa opt-in; a sessão atual em memória continua
    await secureStorage.removeToken();
    await secureStorage.setBiometricOptIn(false);
  }, []);

  const signOut = useCallback(async () => {
    apiClient.setAuthToken(null);
    const optIn = await secureStorage.getBiometricOptIn();
    if (optIn) {
      // Se o opt-in biométrico estiver LIGADO, MANTÉM o token protegido, o motorista em cache e o opt-in;
      // apenas zera a memória.
    } else {
      await secureStorage.clearAll();
    }
    setDriver(null);
    setVehicle(null);
  }, []);

  const forgetDevice = useCallback(async () => {
    apiClient.setAuthToken(null);
    await secureStorage.clearAll();
    setDriver(null);
    setVehicle(null);
  }, []);

  const unlockSession = useCallback((unlockedDriver: Driver, unlockedVehicle?: Vehicle | null, token?: string | null) => {
    if (token) {
      apiClient.setAuthToken(token);
    }
    setDriver(unlockedDriver);
    setVehicle(unlockedVehicle || null);
  }, []);

  const onUnauthorized = useCallback((message?: string) => {
    apiClient.setAuthToken(null);
    if (message) {
      Alert.alert('Acesso Negado', message);
    }
    // Respostas 401 e 403 continuam limpando TUDO (clearAll + memória)
    secureStorage.clearAll();
    setDriver(null);
    setVehicle(null);
  }, []);

  useEffect(() => {
    apiClient.setOnUnauthorized(onUnauthorized);
  }, [onUnauthorized]);

  useEffect(() => {
    async function loadStorageData() {
      // Migração na inicialização: limpa credenciais legadas em texto puro
      await secureStorage.cleanupLegacyCredentials();

      const optIn = await secureStorage.getBiometricOptIn();

      const storedDriver = await secureStorage.getDriver();
      const storedVehicle = await secureStorage.getVehicle();

      // Se o opt-in de biometria estiver ativo, a sessão não é auto-restaurada diretamente;
      // o motorista desbloqueia explicitamente via biometria na tela de login
      if (optIn) {
        setLoading(false);
        return;
      }

      const storedToken = await secureStorage.getToken();
      if (storedToken && storedDriver) {
        apiClient.setAuthToken(storedToken);
        setDriver(storedDriver);
        if (storedVehicle) {
          setVehicle(storedVehicle);
        }
      }
      setLoading(false);
    }
    loadStorageData();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await apiClient.login(email, password);
      apiClient.setAuthToken(response.token);
      await secureStorage.saveToken(response.token);
      await secureStorage.saveDriver(response.driver);
      
      if (response.vehicle) {
        await secureStorage.saveVehicle(response.vehicle);
        setVehicle(response.vehicle);
      } else {
        setVehicle(null);
      }
      setDriver(response.driver);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = useCallback(async () => {
    try {
      const data = await apiClient.getMe();
      if (data.driver) {
        await secureStorage.saveDriver(data.driver);
        setDriver(data.driver);
      }
      if (data.vehicle) {
        await secureStorage.saveVehicle(data.vehicle);
        setVehicle(data.vehicle);
      } else {
        await secureStorage.saveVehicle(null as any);
        setVehicle(null);
      }
    } catch (err) {
      // Falha de rede ou offline: mantém estado seguro em cache
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        signed: !!driver,
        driver,
        vehicle,
        loading,
        signIn,
        unlockSession,
        signOut,
        forgetDevice,
        enableBiometricLogin,
        disableBiometricLogin,
        onUnauthorized,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
