// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const rejectWith401 = (client) => {
  client.defaults.adapter = (config) =>
    Promise.reject(
      Object.assign(new Error('Request failed with status code 401'), {
        config,
        response: { status: 401, data: { error: 'Credenciais inválidas' }, config },
      })
    );
};

describe('api/client - interceptor de 401', () => {
  let client;
  let toast;
  let originalLocation;
  let locationMock;

  const setup = async (pathname) => {
    vi.resetModules();
    toast = (await import('react-hot-toast')).default;
    toast.error.mockClear();
    client = (await import('./client')).default;
    rejectWith401(client);
    locationMock = { pathname, href: pathname, replace: vi.fn() };
    Object.defineProperty(window, 'location', { value: locationMock, writable: true, configurable: true });
  };

  beforeEach(() => {
    originalLocation = window.location;
    localStorage.setItem('token', 'tok-123');
    localStorage.setItem('user', JSON.stringify({ id: 1 }));
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
    localStorage.clear();
  });

  it('a) 401 em /auth/login: localStorage intacto, nenhuma navegação e o erro propaga ao chamador', async () => {
    await setup('/login');
    await expect(client.post('/auth/login', { email: 'a@b.c', password: 'x' })).rejects.toMatchObject({
      response: { status: 401, data: { error: 'Credenciais inválidas' } },
    });

    expect(localStorage.getItem('token')).toBe('tok-123');
    expect(localStorage.getItem('user')).not.toBeNull();
    expect(locationMock.replace).not.toHaveBeenCalled();
    expect(locationMock.href).toBe('/login');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('a2) 401 em /auth/driver/login fora da tela de login também não redireciona nem limpa a sessão', async () => {
    await setup('/dashboard');
    await expect(client.post('/auth/driver/login', {})).rejects.toBeDefined();

    expect(localStorage.getItem('token')).toBe('tok-123');
    expect(locationMock.replace).not.toHaveBeenCalled();
    expect(locationMock.href).toBe('/dashboard');
  });

  it('a3) 401 qualquer já estando em /login não redireciona nem apaga a sessão', async () => {
    await setup('/login');
    await expect(client.get('/drivers')).rejects.toBeDefined();

    expect(localStorage.getItem('token')).toBe('tok-123');
    expect(locationMock.replace).not.toHaveBeenCalled();
  });

  it('b) 401 em /drivers: token e user removidos, toast exibido e navegação para /login', async () => {
    await setup('/dashboard');
    await expect(client.get('/drivers')).rejects.toBeDefined();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Sessão expirada. Entre novamente.', expect.anything());
    expect(locationMock.replace).toHaveBeenCalledWith('/login');
  });

  it('c) várias 401 simultâneas geram um único toast', async () => {
    await setup('/dashboard');
    await Promise.allSettled([client.get('/drivers'), client.get('/trucks'), client.get('/fueling/history')]);

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(locationMock.replace).toHaveBeenCalledWith('/login');
  });
});
