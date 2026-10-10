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

  it('login sends correct data and returns LoginResponse', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ token: 'abc', driver: { id: 1 } }),
    });

    const res = await apiClient.login('test@test.com', 'pass');
    expect(res.token).toBe('abc');
    expect(mockFetch).toHaveBeenCalledWith(
      `${getBaseUrl()}/auth/driver/login`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'pass' })
      })
    );
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

  it('handles 401 and calls onUnauthorized', async () => {
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
});
