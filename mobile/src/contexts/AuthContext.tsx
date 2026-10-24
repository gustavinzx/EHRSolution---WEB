import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Driver } from '../types/driver';
import { Vehicle } from '../types/vehicle';
import { secureStorage } from '../storage/secureStorage';
import { apiClient } from '../services/api/apiClient';
import { Alert } from 'react-native';

interface AuthContextData {
  signed: boolean;
  driver: Driver | null;
  vehicle: Vehicle | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  unlockSession: (driver: Driver, vehicle?: Vehicle | null, token?: string | null) => void;
  signOut: () => Promise<void>;
  onUnauthorized: (message?: string) => void;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    apiClient.setAuthToken(null);
    // Apaga token, dados e opt-in de biometria ao deslogar
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
    signOut();
  }, [signOut]);

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
        onUnauthorized,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
