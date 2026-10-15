type Env = {
  dev: boolean;
  os: 'android' | 'ios' | 'web';
  envUrl?: string;
  constants?: Record<string, unknown>;
  nodeEnv?: string;
};

const loadBaseUrl = (opts: Env): string => {
  const savedEnvUrl = process.env.EXPO_PUBLIC_API_URL;
  const savedNodeEnv = process.env.NODE_ENV;
  const savedDev = (globalThis as any).__DEV__;

  (globalThis as any).__DEV__ = opts.dev;
  (process.env as any).NODE_ENV = opts.nodeEnv ?? 'development';
  if (opts.envUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_URL;
  } else {
    process.env.EXPO_PUBLIC_API_URL = opts.envUrl;
  }

  try {
    let result = '';
    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({ Platform: { OS: opts.os } }));
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: opts.constants ?? {},
      }));
      jest.doMock('../src/storage/secureStorage', () => ({
        secureStorage: { getToken: jest.fn() },
      }));
      const mod = require('../src/services/api/apiClient');
      result = mod.getBaseUrl();
    });
    return result;
  } finally {
    (globalThis as any).__DEV__ = savedDev;
    (process.env as any).NODE_ENV = savedNodeEnv;
    if (savedEnvUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = savedEnvUrl;
    }
    jest.dontMock('react-native');
    jest.dontMock('expo-constants');
    jest.dontMock('../src/storage/secureStorage');
  }
};

describe('getBaseUrl in development (A2)', () => {
  it('uses a valid https EXPO_PUBLIC_API_URL', () => {
    expect(
      loadBaseUrl({ dev: true, os: 'android', envUrl: 'https://api.example.com/api' })
    ).toBe('https://api.example.com/api');
  });

  it('uses a valid non-loopback http EXPO_PUBLIC_API_URL', () => {
    expect(
      loadBaseUrl({ dev: true, os: 'ios', envUrl: 'http://10.1.2.3:3001/api' })
    ).toBe('http://10.1.2.3:3001/api');
  });

  it('ignores a loopback EXPO_PUBLIC_API_URL on native and uses the detected host', () => {
    expect(
      loadBaseUrl({
        dev: true,
        os: 'android',
        envUrl: 'http://localhost:3001/api',
        constants: { expoConfig: { hostUri: '10.0.0.5:8081' } },
      })
    ).toBe('http://10.0.0.5:3001/api');
  });

  it('ignores a 127.0.0.1 EXPO_PUBLIC_API_URL on native iOS and uses the detected host', () => {
    expect(
      loadBaseUrl({
        dev: true,
        os: 'ios',
        envUrl: 'http://127.0.0.1:3001/api',
        constants: { expoConfig: { hostUri: '10.0.0.5:8081' } },
      })
    ).toBe('http://10.0.0.5:3001/api');
  });

  it('keeps a loopback EXPO_PUBLIC_API_URL on web', () => {
    expect(
      loadBaseUrl({ dev: true, os: 'web', envUrl: 'http://localhost:3001/api' })
    ).toBe('http://localhost:3001/api');
  });

  it('derives the URL from hostUri "10.0.0.5:8081"', () => {
    expect(
      loadBaseUrl({
        dev: true,
        os: 'android',
        constants: { expoConfig: { hostUri: '10.0.0.5:8081' } },
      })
    ).toBe('http://10.0.0.5:3001/api');
  });

  it('derives the URL from debuggerHost', () => {
    expect(
      loadBaseUrl({
        dev: true,
        os: 'android',
        constants: { manifest: { debuggerHost: '10.0.0.5:8081' } },
      })
    ).toBe('http://10.0.0.5:3001/api');
  });

  it('derives the URL from linkingUri "exp://10.0.0.5:8081"', () => {
    expect(
      loadBaseUrl({
        dev: true,
        os: 'android',
        constants: { linkingUri: 'exp://10.0.0.5:8081' },
      })
    ).toBe('http://10.0.0.5:3001/api');
  });

  it('ignores a detected localhost host and falls back to the emulator address on Android', () => {
    expect(
      loadBaseUrl({
        dev: true,
        os: 'android',
        constants: { expoConfig: { hostUri: 'localhost:8081' } },
      })
    ).toBe('http://10.0.2.2:3001/api');
  });

  it('uses 10.0.2.2 on Android without a detected host', () => {
    expect(loadBaseUrl({ dev: true, os: 'android' })).toBe('http://10.0.2.2:3001/api');
  });

  it('uses localhost on iOS without a detected host', () => {
    expect(loadBaseUrl({ dev: true, os: 'ios' })).toBe('http://localhost:3001/api');
  });

  it('uses localhost on web without a detected host', () => {
    expect(loadBaseUrl({ dev: true, os: 'web' })).toBe('http://localhost:3001/api');
  });
});

describe('getBaseUrl in production (A2)', () => {
  it('throws when EXPO_PUBLIC_API_URL is missing', () => {
    expect(() =>
      loadBaseUrl({ dev: false, os: 'android', nodeEnv: 'production' })
    ).toThrow('Em produção, EXPO_PUBLIC_API_URL é obrigatório e deve usar HTTPS.');
  });

  it('throws when EXPO_PUBLIC_API_URL is not https', () => {
    expect(() =>
      loadBaseUrl({
        dev: false,
        os: 'android',
        envUrl: 'http://api.example.com/api',
        nodeEnv: 'production',
      })
    ).toThrow('Em produção, EXPO_PUBLIC_API_URL é obrigatório e deve usar HTTPS.');
  });

  it('returns the https URL', () => {
    expect(
      loadBaseUrl({
        dev: false,
        os: 'android',
        envUrl: 'https://api.example.com/api',
        nodeEnv: 'production',
      })
    ).toBe('https://api.example.com/api');
  });
});
