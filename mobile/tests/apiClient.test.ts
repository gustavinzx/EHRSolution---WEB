import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/storage/secureStorage';
import { Platform } from 'react-native';

jest.mock('../src/storage/secureStorage', () => ({
  secureStorage: {
    getToken: jest.fn(),
  },
}));

const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

describe('apiClient', () => {
  let onUnauthorizedMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onUnauthorizedMock = jest.fn();
    apiClient.setOnUnauthorized(onUnauthorizedMock);
  });

  const getBaseUrl = () => {
    if (Platform.OS === 'android') return 'http://10.0.2.2:3001/api';
    return 'http://localhost:3001/api';
  };

  it('login sends correct data and returns LoginResponse with vehicle', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        token: 'mock_jwt_token',
        driver: {
          id: 1,
          name: 'João Silva',
          email: 'motorista1@ehr.com',
          phone: '11999999999'
        },
        vehicle: {
          id: 10,
          plate: 'ABC-1234',
          model: 'Volvo FH 540',
          brand: 'Volvo',
          capacity: 500
        }
      }),
    });

    const res = await apiClient.login('motorista1@ehr.com', 'Demo@1234');
    expect(res.token).toBe('mock_jwt_token');
    expect(res.driver).toEqual({
      id: 1,
      name: 'João Silva',
      email: 'motorista1@ehr.com',
      phone: '11999999999'
    });
    expect(res.vehicle).toEqual({
      id: 10,
      plate: 'ABC-1234',
      model: 'Volvo FH 540',
      brand: 'Volvo',
      capacity: 500
    });
    expect(mockFetch).toHaveBeenCalledWith(
      `${getBaseUrl()}/auth/driver/login`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'motorista1@ehr.com', password: 'Demo@1234' })
      })
    );
  });

  it('login with vehicle: null returns null vehicle', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        token: 'mock_jwt_token_2',
        driver: {
          id: 2,
          name: 'Maria Oliveira',
          email: 'motorista2@ehr.com',
          phone: '11988888888'
        },
        vehicle: null
      }),
    });

    const res = await apiClient.login('motorista2@ehr.com', 'Demo@1234');
    expect(res.token).toBe('mock_jwt_token_2');
    expect(res.vehicle).toBeNull();
  });

  it('401 on login throws ApiError with Credenciais inválidas and does NOT call onUnauthorized', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'Credenciais inválidas' }),
    });

    await expect(apiClient.login('test@test.com', 'wrong_pass')).rejects.toMatchObject({
      status: 401,
      message: 'Credenciais inválidas',
      code: 'Credenciais inválidas',
    });

    expect(onUnauthorizedMock).not.toHaveBeenCalled();
  });

  it('401 on another route calls onUnauthorized', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'token_expired' }),
    });

    await expect(apiClient.getActiveSession(1)).rejects.toMatchObject({
      status: 401,
      code: 'token_expired',
    });

    expect(onUnauthorizedMock).toHaveBeenCalledWith();
  });

  it('verifyFace sends correct data without data prefix', async () => {
    (secureStorage.getToken as jest.Mock).mockResolvedValue('token123');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ verified: true }),
    });

    await apiClient.verifyFace(99, 'base64_pure_string');
    
    expect(mockFetch).toHaveBeenCalledWith(
      `${getBaseUrl()}/fueling/sessions/99/verify-face`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token123'
        },
        body: JSON.stringify({ image_base64: 'base64_pure_string' })
      })
    );
  });

  it('authorizeSession sends coords only if available', async () => {
    (secureStorage.getToken as jest.Mock).mockResolvedValue('token123');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ id: 99, status: 'authorized' }),
    });

    await apiClient.authorizeSession(99, { lat: -10, lng: -20 });
    expect(mockFetch).toHaveBeenCalledWith(
      `${getBaseUrl()}/fueling/sessions/99/authorize`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ lat: -10, lng: -20 })
      })
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ id: 99, status: 'authorized' }),
    });

    await apiClient.authorizeSession(99);
    expect(mockFetch).toHaveBeenCalledWith(
      `${getBaseUrl()}/fueling/sessions/99/authorize`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({})
      })
    );
  });

  it('handles 403 driver_inactive and calls onUnauthorized with specific message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: 'driver_inactive' }),
    });

    await expect(apiClient.getActiveSession(1)).rejects.toMatchObject({
      status: 403,
      code: 'driver_inactive',
    });
    
    expect(onUnauthorizedMock).toHaveBeenCalledWith('Seu acesso foi desativado. Procure o gestor.');
  });
  
  it('throws ApiError on generic error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({ error: 'face_not_enrolled' }),
    });

    await expect(apiClient.verifyFace(1, 'a')).rejects.toMatchObject({
      status: 409,
      code: 'face_not_enrolled',
      message: 'face_not_enrolled'
    });
  });

  describe('cancelSession', () => {
    it('sends POST without body, includes Bearer token and returns success', async () => {
      (secureStorage.getToken as jest.Mock).mockResolvedValue('token_cancel');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true, status: 'cancelled' }),
      });

      const res = await apiClient.cancelSession(42);
      expect(res).toEqual({ success: true, status: 'cancelled' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${getBaseUrl()}/fueling/sessions/42/cancel`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token_cancel',
          }),
        })
      );
      expect((mockFetch.mock.calls[0][1] as any).body).toBeUndefined();
    });

    it('handles 404 Sessão não encontrada', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ error: 'Sessão não encontrada' }),
      });

      await expect(apiClient.cancelSession(42)).rejects.toMatchObject({
        status: 404,
        code: 'Sessão não encontrada',
        message: 'Sessão não encontrada',
      });
    });

    it('handles 409 Sessão em andamento não pode ser cancelada', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: async () => JSON.stringify({ error: 'Sessão em andamento não pode ser cancelada' }),
      });

      await expect(apiClient.cancelSession(42)).rejects.toMatchObject({
        status: 409,
        code: 'Sessão em andamento não pode ser cancelada',
        message: 'Sessão em andamento não pode ser cancelada',
      });
    });

    it('handles 409 Sessão já foi processada', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: async () => JSON.stringify({ error: 'Sessão já foi processada' }),
      });

      await expect(apiClient.cancelSession(42)).rejects.toMatchObject({
        status: 409,
        code: 'Sessão já foi processada',
        message: 'Sessão já foi processada',
      });
    });

    it('handles 400 id inválido', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: 'id inválido' }),
      });

      await expect(apiClient.cancelSession(0)).rejects.toMatchObject({
        status: 400,
        code: 'id inválido',
        message: 'id inválido',
      });
    });

    it('handles 401 Authorization token missing or invalid and calls onUnauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: 'Authorization token missing or invalid' }),
      });

      await expect(apiClient.cancelSession(42)).rejects.toMatchObject({
        status: 401,
        code: 'Authorization token missing or invalid',
      });
      expect(onUnauthorizedMock).toHaveBeenCalledWith();
    });

    it('handles 403 driver_inactive on cancelSession and calls onUnauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: 'driver_inactive' }),
      });

      await expect(apiClient.cancelSession(42)).rejects.toMatchObject({
        status: 403,
        code: 'driver_inactive',
      });
      expect(onUnauthorizedMock).toHaveBeenCalledWith('Seu acesso foi desativado. Procure o gestor.');
    });
  });

  describe('getSession', () => {
    it('sends GET without body, includes Bearer token and returns Session with result', async () => {
      (secureStorage.getToken as jest.Mock).mockResolvedValue('token_get');
      const sessionPayload = {
        id: 42,
        truck_id: 10,
        status: 'completed',
        release_method: 'facial',
        station_name: 'Posto Central',
        requested_at: '2026-10-11T12:00:00.000Z',
        authorized_at: '2026-10-11T12:01:00.000Z',
        started_at: '2026-10-11T12:01:00.000Z',
        completed_at: '2026-10-11T12:15:00.000Z',
        expires_at: '2026-10-11T12:30:00.000Z',
        result: {
          volume_liters: 45.5,
          duration_minutes: 14.0,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(sessionPayload),
      });

      const res = await apiClient.getSession(42);
      expect(res).toEqual(sessionPayload);

      expect(mockFetch).toHaveBeenCalledWith(
        `${getBaseUrl()}/fueling/sessions/42`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token_get',
          }),
        })
      );
      expect((mockFetch.mock.calls[0][1] as any).body).toBeUndefined();
    });

    it('handles 404 Sessão não encontrada on getSession', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ error: 'Sessão não encontrada' }),
      });

      await expect(apiClient.getSession(999)).rejects.toMatchObject({
        status: 404,
        code: 'Sessão não encontrada',
        message: 'Sessão não encontrada',
      });
    });

    it('handles 400 id inválido on getSession', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: 'id inválido' }),
      });

      await expect(apiClient.getSession(0)).rejects.toMatchObject({
        status: 400,
        code: 'id inválido',
        message: 'id inválido',
      });
    });

    it('handles 401 Authorization token missing or invalid on getSession and calls onUnauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: 'Authorization token missing or invalid' }),
      });

      await expect(apiClient.getSession(42)).rejects.toMatchObject({
        status: 401,
        code: 'Authorization token missing or invalid',
      });
      expect(onUnauthorizedMock).toHaveBeenCalledWith();
    });

    it('handles 403 driver_inactive on getSession and calls onUnauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: 'driver_inactive' }),
      });

      await expect(apiClient.getSession(42)).rejects.toMatchObject({
        status: 403,
        code: 'driver_inactive',
      });
      expect(onUnauthorizedMock).toHaveBeenCalledWith('Seu acesso foi desativado. Procure o gestor.');
    });
  });

  describe('environment error messages (Bloco C2)', () => {
    it('in DEV mode (__DEV__ = true), error messages include server URL', async () => {
      const originalDev = (globalThis as any).__DEV__;
      (globalThis as any).__DEV__ = true;
      try {
        mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

        await expect(apiClient.login('test@ehr.com', 'pass')).rejects.toMatchObject({
          status: 0,
          message: expect.stringContaining('http'),
        });
      } finally {
        (globalThis as any).__DEV__ = originalDev;
      }
    });

    it('in PROD mode (__DEV__ = false), network error messages are generic without server URL', async () => {
      const originalDev = (globalThis as any).__DEV__;
      (globalThis as any).__DEV__ = false;
      try {
        mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

        await expect(apiClient.login('test@ehr.com', 'pass')).rejects.toMatchObject({
          status: 0,
          message: 'Sem conexão com o servidor.',
        });
      } finally {
        (globalThis as any).__DEV__ = originalDev;
      }
    });

    it('in PROD mode (__DEV__ = false), timeout (AbortError) message is generic without URL', async () => {
      const originalDev = (globalThis as any).__DEV__;
      (globalThis as any).__DEV__ = false;
      try {
        const abortError = new Error('The user aborted a request.');
        abortError.name = 'AbortError';
        mockFetch.mockRejectedValueOnce(abortError);

        await expect(apiClient.login('test@ehr.com', 'pass')).rejects.toMatchObject({
          status: 0,
          message: 'Tempo limite da requisição excedido.',
        });
      } finally {
        (globalThis as any).__DEV__ = originalDev;
      }
    });
  });
});
