import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Driver } from '../types/driver';
import { Vehicle } from '../types/vehicle';
import { secureStorage } from '../storage/secureStorage';
import { apiClient } from '../services/api/apiClient';

interface AuthContextData {
  signed: boolean;
  driver: Driver | null;
  vehicle: Vehicle | null;
  loading: boolean;
  signIn: (identifier: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStorageData() {
      const storedToken = await secureStorage.getToken();
      const storedDriver = await secureStorage.getDriver<Driver>();

      if (storedToken && storedDriver) {
        setDriver(storedDriver);
        // Veículo padrão mockado recuperado para demonstração
        setVehicle({
          id: 'vec_550',
          plate: 'EHR-2A26',
          model: 'Constellation 24.280',
          brand: 'Volkswagen',
          bleDeviceId: 'BLE-TRAVA-EHR-01',
        });
      }
      setLoading(false);
    }
    loadStorageData();
  }, []);

  const signIn = async (identifier: string, pass: string) => {
    setLoading(true);
    try {
      const response = await apiClient.login(identifier, pass);
      await secureStorage.saveToken(response.token);
      await secureStorage.saveDriver(response.driver);

      setDriver(response.driver);
      setVehicle(response.vehicle);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await secureStorage.clearAll();
    setDriver(null);
    setVehicle(null);
  };

  return (
    <AuthContext.Provider
      value={{
        signed: !!driver,
        driver,
        vehicle,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};