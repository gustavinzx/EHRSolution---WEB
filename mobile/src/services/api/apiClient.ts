import { Platform } from 'react-native';
import { secureStorage } from '../../storage/secureStorage';
import { ApiError, LoginResponse } from '../../types/auth';
import { Session, ReleaseMethod } from '../../types/session';

const getBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!__DEV__) {
    if (!envUrl || !envUrl.startsWith('https://')) {
      throw new Error('Em produção, EXPO_PUBLIC_API_URL é obrigatório e deve usar HTTPS.');
    }
    return envUrl;
  }
  if (envUrl) return envUrl;
  if (Platform.OS === 'android') return 'http://10.0.2.2:3001/api';
  return 'http://localhost:3001/api';
};

const API_URL = getBaseUrl();

let onUnauthorizedCb: ((message?: string) => void) | null = null;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await secureStorage.getToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
      signal: controller.signal,
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw { status: 0, message: 'Tempo limite da requisição excedido.' } as ApiError;
    }
    throw { status: 0, message: 'Sem conexão com o servidor.' } as ApiError;
  }
  clearTimeout(timeoutId);

  let data: any = {};
  try {
    const text = await response.text();
    if (text) {
      data = JSON.parse(text);
    }
  } catch (e) {
    // If it's not JSON, we keep data as {}
  }

  if (!response.ok) {
    const errorMessage = data.error || 'Ocorreu um erro inesperado.';
    
    if (response.status === 401) {
      if (onUnauthorizedCb) onUnauthorizedCb();
    } else if (response.status === 403 && errorMessage === 'driver_inactive') {
      if (onUnauthorizedCb) onUnauthorizedCb('Seu acesso foi desativado. Procure o gestor.');
    }

    throw {
      status: response.status,
      code: data.error,
      message: errorMessage,
      session_id: data.session_id,
      session: data.session,
    } as ApiError;
  }

  return data as T;
}

export const apiClient = {
  setOnUnauthorized(cb: (message?: string) => void) {
    onUnauthorizedCb = cb;
  },

  async login(email: string, pass: string): Promise<LoginResponse> {
    return await request<LoginResponse>('/auth/driver/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass })
    });
  },

  async requestSession(truckId: number, releaseMethod: ReleaseMethod): Promise<Session> {
    return await request<Session>('/fueling/sessions', {
      method: 'POST',
      body: JSON.stringify({ truck_id: truckId, release_method: releaseMethod })
    });
  },

  async verifyFace(sessionId: number, imageBase64: string): Promise<{ verified: boolean; attempts?: number; attempts_left?: number; error?: string }> {
    return await request<{ verified: boolean; attempts?: number; attempts_left?: number; error?: string }>(`/fueling/sessions/${sessionId}/verify-face`, {
      method: 'POST',
      body: JSON.stringify({ image_base64: imageBase64 })
    });
  },

  async authorizeSession(sessionId: number, coords?: { lat: number; lng: number }): Promise<Session> {
    return await request<Session>(`/fueling/sessions/${sessionId}/authorize`, {
      method: 'POST',
      body: JSON.stringify(coords || {})
    });
  },

  async reportFacialFailure(sessionId: number): Promise<{ success: boolean }> {
    return await request<{ success: boolean }>(`/fueling/sessions/${sessionId}/facial-failure`, {
      method: 'POST'
    });
  },

  async getActiveSession(truckId: number): Promise<Session | null> {
    return await request<Session | null>(`/fueling/sessions/${truckId}/active`, {
      method: 'GET'
    });
  }
};