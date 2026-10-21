import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { secureStorage } from '../../storage/secureStorage';
import { ApiError, LoginResponse } from '../../types/auth';
import { Session, ReleaseMethod } from '../../types/session';
import { HistoryResponse } from '../../types/history';
import { WalletResponse } from '../../types/wallet';

const isLoopbackHost = (host: string): boolean => host === 'localhost' || host === '127.0.0.1';

const isLoopbackUrl = (url: string): boolean => /^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(url);

const getHostFromConstants = (): string | null => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost;
  if (typeof hostUri === 'string' && hostUri) {
    const host = hostUri.split(':')[0];
    if (host && !isLoopbackHost(host)) return host;
  }
  const linkingUri = (Constants as any).linkingUri || (Constants as any).experienceUrl;
  if (typeof linkingUri === 'string' && linkingUri.startsWith('exp://')) {
    const host = linkingUri.replace('exp://', '').split('/')[0].split(':')[0];
    if (host && !isLoopbackHost(host)) return host;
  }
  return null;
};

export const getBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!__DEV__) {
    if (envUrl && envUrl.startsWith('https://')) return envUrl;
    if (process.env.NODE_ENV === 'test') {
      return envUrl || 'https://api.ehrsolutions.com.br/api';
    }
    if (!envUrl || !envUrl.startsWith('https://')) {
      throw new Error('Em produção, EXPO_PUBLIC_API_URL é obrigatório e deve usar HTTPS.');
    }
    return envUrl;
  }

  const isNative = Platform.OS !== 'web';
  if (envUrl && !(isNative && isLoopbackUrl(envUrl))) return envUrl;

  const host = getHostFromConstants();
  if (host) return `http://${host}:3001/api`;

  if (Platform.OS === 'android') return 'http://10.0.2.2:3001/api';
  return 'http://localhost:3001/api';
};

export const API_URL = getBaseUrl();

let onUnauthorizedCb: ((message?: string) => void) | null = null;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await secureStorage.getToken();
  const baseUrl = getBaseUrl();
  
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
    response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
      signal: controller.signal,
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (__DEV__) {
      console.warn(`[API ERROR] ${options.method || 'GET'} ${baseUrl}${endpoint}:`, error);
    }
    if (error.name === 'AbortError') {
      const message = __DEV__
        ? `Tempo limite esgotado ao conectar em ${baseUrl}`
        : 'Tempo limite da requisição excedido.';
      throw { status: 0, message } as ApiError;
    }
    const detail = __DEV__ && error?.message ? ` (${error.message})` : '';
    const message = __DEV__
      ? `Sem conexão com ${baseUrl}${detail}`
      : 'Sem conexão com o servidor.';
    throw { status: 0, message } as ApiError;
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
    if (__DEV__) {
      console.warn(`[API ERROR] ${options.method || 'GET'} ${baseUrl}${endpoint}: HTTP ${response.status}`, data);
    }

    if (response.status === 401) {
      if (endpoint !== '/auth/driver/login' && onUnauthorizedCb) {
        onUnauthorizedCb();
      }
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
  },

  async cancelSession(sessionId: number): Promise<{ success: boolean; status: string }> {
    return await request<{ success: boolean; status: string }>(`/fueling/sessions/${sessionId}/cancel`, {
      method: 'POST'
    });
  },

  async getSession(sessionId: number): Promise<Session> {
    return await request<Session>(`/fueling/sessions/${sessionId}`, {
      method: 'GET'
    });
  },

  async getHistory(page: number = 1, limit: number = 20): Promise<HistoryResponse> {
    return await request<HistoryResponse>(`/fueling/history?page=${page}&limit=${limit}`, {
      method: 'GET'
    });
  },

  async getWallet(): Promise<WalletResponse> {
    return await request<WalletResponse>('/fueling/wallet', {
      method: 'GET'
    });
  }
};
