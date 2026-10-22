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
  signIn: (email: string, pass: string) => Promise<void>;
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
    await secureStorage.clearAll();
    setDriver(null);
    setVehicle(null);
  }, []);

  const onUnauthorized = useCallback((message?: string) => {
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
      const storedToken = await secureStorage.getToken();
      const storedDriver = await secureStorage.getDriver();
      const storedVehicle = await secureStorage.getVehicle();

      if (storedToken && storedDriver) {
        setDriver(storedDriver);
        if (storedVehicle) {
          setVehicle(storedVehicle);
        }
      }
      setLoading(false);
    }
    loadStorageData();
  }, []);

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const response = await apiClient.login(email, pass);
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
        signOut,
        onUnauthorized,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};