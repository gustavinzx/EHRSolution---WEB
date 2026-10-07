import { Platform } from 'react-native';
import { Driver } from '../../types/driver';
import { Vehicle } from '../../types/vehicle';
import { FuelOperation } from '../../types/operation';
import { secureStorage } from '../../storage/secureStorage';

// Para Web e Emuladores Android o localhost varia, e em dispositivo físico precisa do IP da rede.
const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'android') return 'http://10.0.2.2:3001/api';
  return 'http://localhost:3001/api';
};

const API_URL = getBaseUrl();

// Helper to inject token
const getHeaders = async () => {
  const token = await secureStorage.getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const apiClient = {
  async login(identifier: string, pass: string) {
    const response = await fetch(`${API_URL}/auth/driver/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: identifier, password: pass })
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Credenciais inválidas.');
    }
    
    return await response.json();
  },

  async requestSession(truckId: number, stationId?: number, releaseMethod: 'facial'|'ble_fallback' = 'facial') {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/fueling/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ truck_id: truckId, station_id: stationId, release_method: releaseMethod })
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao solicitar sessão.');
    }
    
    return await response.json();
  },

  async authorizeSession(sessionId: number, lat?: number, lng?: number) {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/fueling/sessions/${sessionId}/authorize`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lat, lng })
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao autorizar trava.');
    }
    
    return await response.json();
  },

  async reportFacialFailure(sessionId: number) {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/fueling/sessions/${sessionId}/facial-failure`, {
      method: 'POST',
      headers
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao reportar falha facial.');
    }
    
    return await response.json();
  },

  async finishSession(sessionId: number, levelBefore?: number, levelAfter?: number) {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/fueling/sessions/${sessionId}/finish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ level_before: levelBefore, level_after: levelAfter })
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao finalizar abastecimento.');
    }
    
    return await response.json();
  },

  async validateBiometrics(photoBase64: string): Promise<boolean> {
    // Simulando uma validação local (em produção chamaria uma API de IA como AWS Rekognition)
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return true; 
  },

  async syncOperation(operation: FuelOperation): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return true;
  },
};