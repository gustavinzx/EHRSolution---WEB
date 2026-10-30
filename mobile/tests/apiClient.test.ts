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
    apiClient.setAuthToken(null);
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

    const res = await apiClient.login('motorista1@ehr.com', 'SenhaTeste@2026');
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
        body: JSON.stringify({ email: 'motorista1@ehr.com', password: 'SenhaTeste@2026' })
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

    const res = await apiClient.login('motorista2@ehr.com', 'SenhaTeste@2026');
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
    apiClient.setAuthToken('token123');
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
    apiClient.setAuthToken('token123');
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
      apiClient.setAuthToken('token_cancel');
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
      apiClient.setAuthToken('token_get');
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

    it('in DEV mode (__DEV__ = true), network and HTTP errors use console.warn and NEVER console.error (C2/C3)', async () => {
      const originalDev = (globalThis as any).__DEV__;
      (globalThis as any).__DEV__ = true;
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        mockFetch.mockRejectedValueOnce(new Error('Network failure'));
        await expect(apiClient.login('test@ehr.com', 'pass')).rejects.toMatchObject({ status: 0 });

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).not.toHaveBeenCalled();

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => JSON.stringify({ error: 'Internal Server Error' }),
        });
        await expect(apiClient.getHistory(1, 20)).rejects.toMatchObject({ status: 500 });

        expect(warnSpy).toHaveBeenCalledTimes(2);
        expect(errorSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
        errorSpy.mockRestore();
        (globalThis as any).__DEV__ = originalDev;
      }
    });

    it('in PROD mode (__DEV__ = false), neither console.warn nor console.error is called on error', async () => {
      const originalDev = (globalThis as any).__DEV__;
      (globalThis as any).__DEV__ = false;
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        mockFetch.mockRejectedValueOnce(new Error('Network failure'));
        await expect(apiClient.login('test@ehr.com', 'pass')).rejects.toMatchObject({ status: 0 });

        expect(warnSpy).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
        errorSpy.mockRestore();
        (globalThis as any).__DEV__ = originalDev;
      }
    });
  });

  describe('getHistory (Bloco A)', () => {
    it('calls GET /fueling/history with default query parameters, headers, and no body', async () => {
      apiClient.setAuthToken('valid_token_123');
      const mockResponse = {
        items: [
          {
            id: 101,
            kind: 'log',
            status: 'completed',
            timestamp: '2026-10-15T12:00:00.000Z',
            truck_plate: 'ABC-1234',
            volume_liters: 45.5,
            duration_minutes: 15.0,
            release_method: 'facial',
            station_name: 'Posto Central',
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
        summary: {
          count: 1,
          total_liters: 45.5,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      const res = await apiClient.getHistory();
      expect(res).toEqual(mockResponse);

      expect(mockFetch).toHaveBeenCalledWith(
        `${getBaseUrl()}/fueling/history?page=1&limit=20`,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid_token_123',
          },
        })
      );
      const callOptions = mockFetch.mock.calls[0][1];
      expect(callOptions.body).toBeUndefined();
    });

    it('parses legacy items without kind or status defaulting to log and completed', async () => {
      apiClient.setAuthToken('valid_token_123');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          items: [
            {
              id: 99,
              timestamp: '2026-10-15T12:00:00.000Z',
              truck_plate: 'OLD-9999',
              volume_liters: 30.0,
              duration_minutes: 10.0,
              release_method: 'facial',
              station_name: 'Posto Antigo',
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
          summary: { count: 1, total_liters: 30.0 },
        }),
      });

      const res = await apiClient.getHistory();
      expect(res.items[0].kind).toBe('log');
      expect(res.items[0].status).toBe('completed');
    });

    it('passes custom page and limit query parameters', async () => {
      apiClient.setAuthToken('token_abc');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ items: [], page: 3, limit: 10, total: 0, summary: { count: 0, total_liters: 0 } }),
      });

      await apiClient.getHistory(3, 10);
      expect(mockFetch).toHaveBeenCalledWith(
        `${getBaseUrl()}/fueling/history?page=3&limit=10`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('handles 400 page inválido error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: 'page inválido' }),
      });

      await expect(apiClient.getHistory(0, 20)).rejects.toMatchObject({
        status: 400,
        code: 'page inválido',
        message: 'page inválido',
      });
      expect(onUnauthorizedMock).not.toHaveBeenCalled();
    });

    it('handles 400 limit inválido error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: 'limit inválido' }),
      });

      await expect(apiClient.getHistory(1, 0)).rejects.toMatchObject({
        status: 400,
        code: 'limit inválido',
        message: 'limit inválido',
      });
      expect(onUnauthorizedMock).not.toHaveBeenCalled();
    });

    it('handles 401 error and calls onUnauthorized callback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: 'Invalid or expired token' }),
      });

      await expect(apiClient.getHistory()).rejects.toMatchObject({
        status: 401,
        code: 'Invalid or expired token',
      });
      expect(onUnauthorizedMock).toHaveBeenCalled();
    });

    it('handles 403 driver_inactive error and notifies user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: 'driver_inactive' }),
      });

      await expect(apiClient.getHistory()).rejects.toMatchObject({
        status: 403,
        code: 'driver_inactive',
      });
      expect(onUnauthorizedMock).toHaveBeenCalledWith('Seu acesso foi desativado. Procure o gestor.');
    });
  });

  describe('getWallet', () => {
    it('successfully fetches wallet metrics and sicoob transactions', async () => {
      apiClient.setAuthToken('driver_token');
      const mockWalletData = {
        bank: {
          institution: 'Banco Cooperativo Sicoob S.A.',
          code: '756',
          cooperative: 'Sicoob Credifrotas DF (4321)',
          accountNumber: '10987-6',
          corporateName: 'EHR Logística & Transportes S.A.',
          status: 'connected',
          protocol: 'Open Finance Brasil / OAuth2 mTLS',
          developerPortalUrl: 'https://developers.sicoob.com.br/portal/apis',
          lastSync: '2026-10-21T18:00:00Z',
        },
        wallet: {
          monthlyCreditLimit: 5000,
          balanceAvailable: 3450.5,
          totalSpentMonth: 1549.5,
          totalLitersMonth: 256.12,
          averagePricePerLiter: 6.05,
          fuelType: 'Diesel S10',
          fuelingCount: 3,
        },
        transactions: [
          {
            id: 101,
            timestamp: '2026-10-21T12:00:00Z',
            stationName: 'Posto Shell Recanto das Emas',
            brand: 'Shell',
            truckPlate: 'BRA2E19',
            liters: 100,
            pricePerLiter: 6.05,
            totalAmount: 605.0,
            paymentMethod: 'Cartão Frota Sicoob Visa PJ',
            status: 'estimated',

          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockWalletData),
      });

      const res = await apiClient.getWallet();
      expect(res).toEqual(mockWalletData);
      expect(mockFetch).toHaveBeenCalledWith(
        `${getBaseUrl()}/fueling/wallet`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer driver_token',
          }),
        })
      );
    });
  });

  describe('Driver Cards API', () => {
    it('addCard sends POST with card data and returns created card', async () => {
      apiClient.setAuthToken('driver_token');
      const mockCard = {
        id: 1,
        cardHolder: 'JOAO SILVA',
        lastFour: '1234',
        cardBrand: 'Visa Frota',
        bankName: 'Sicoob Credifrotas (756)',
        expirationMonth: 12,
        expirationYear: 2029,
        monthlyLimit: 5000,
        isDefault: true,
        status: 'active',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockCard),
      });

      const res = await apiClient.addCard({
        cardNumber: '4111111111111234',
        cardHolder: 'JOAO SILVA',
        expirationMonth: 12,
        expirationYear: 2029,
        cardBrand: 'Visa Frota',
        bankName: 'Sicoob Credifrotas (756)',
        monthlyLimit: 5000,
      });

      expect(res).toEqual(mockCard);
      expect(mockFetch).toHaveBeenCalledWith(
        `${getBaseUrl()}/fueling/wallet/cards`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer driver_token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            cardNumber: '4111111111111234',
            cardHolder: 'JOAO SILVA',
            expirationMonth: 12,
            expirationYear: 2029,
            cardBrand: 'Visa Frota',
            bankName: 'Sicoob Credifrotas (756)',
            monthlyLimit: 5000,
          }),
        })
      );
    });

    it('deleteCard sends DELETE to /cards/:cardId', async () => {
      apiClient.setAuthToken('driver_token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      });

      const res = await apiClient.deleteCard(42);
      expect(res).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        `${getBaseUrl()}/fueling/wallet/cards/42`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer driver_token',
          }),
        })
      );
    });

    it('setDefaultCard sends PATCH to /cards/:cardId/default', async () => {
      apiClient.setAuthToken('driver_token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      });

      const res = await apiClient.setDefaultCard(42);
      expect(res).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        `${getBaseUrl()}/fueling/wallet/cards/42/default`,
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            Authorization: 'Bearer driver_token',
          }),
        })
      );
    });
  });
});
