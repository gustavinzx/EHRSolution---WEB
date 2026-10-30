const { checkNonProductionWarning } = require('../src/index');

describe('checkNonProductionWarning - Aviso de ambiente não-produtivo', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      warn: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
    };
  });

  test('com NODE_ENV != production e DATABASE_URL definido: emite console.warn visível', () => {
    const env = {
      NODE_ENV: 'staging',
      DATABASE_URL: 'postgres://user:pass@render.com:5432/ehr_fleet',
    };

    const warned = checkNonProductionWarning(env, mockLogger);

    expect(warned).toBe(true);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[AMBIENTE NÃO-PRODUTIVO] Reconhecimento facial MOCK, hardware virtual e CORS aberto: NÃO use dados reais.'
    );
  });

  test('com NODE_ENV = development e DATABASE_URL definido: emite aviso', () => {
    const env = {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/ehr_fleet',
    };

    const warned = checkNonProductionWarning(env, mockLogger);

    expect(warned).toBe(true);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });

  test('com NODE_ENV = production (mesmo com DATABASE_URL): NÃO emite aviso', () => {
    const env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:pass@prod.db.com:5432/ehr_fleet',
    };

    const warned = checkNonProductionWarning(env, mockLogger);

    expect(warned).toBe(false);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('sem DATABASE_URL: NÃO emite aviso (apenas banco remoto dispara o alerta de homologação)', () => {
    const env = {
      NODE_ENV: 'staging',
      DATABASE_URL: undefined,
    };

    const warned = checkNonProductionWarning(env, mockLogger);

    expect(warned).toBe(false);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
