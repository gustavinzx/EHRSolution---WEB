const { buildPoolConfig } = require('../src/config/db');

describe('buildPoolConfig - TLS do banco de dados', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    };
  });

  test('com DATABASE_URL: padrão exige validação estrita de TLS (rejectUnauthorized: true)', () => {
    const env = {
      DATABASE_URL: 'postgres://user:pass@db.render.com:5432/ehr_fleet',
    };

    const config = buildPoolConfig(env, mockLogger);

    expect(config.connectionString).toBe(env.DATABASE_URL);
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('com DATABASE_URL e DB_SSL_INSECURE=true: relaxa para rejectUnauthorized: false e emite aviso explícito', () => {
    const env = {
      DATABASE_URL: 'postgres://user:pass@db.render.com:5432/ehr_fleet',
      DB_SSL_INSECURE: 'true',
    };

    const config = buildPoolConfig(env, mockLogger);

    expect(config.connectionString).toBe(env.DATABASE_URL);
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('DB_SSL_INSECURE=true')
    );
  });

  test('com DATABASE_URL e DB_SSL=false: desliga SSL completamente (ssl: false)', () => {
    const env = {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/ehr_fleet',
      DB_SSL: 'false',
    };

    const config = buildPoolConfig(env, mockLogger);

    expect(config.connectionString).toBe(env.DATABASE_URL);
    expect(config.ssl).toBe(false);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('com DATABASE_URL, DB_SSL=false tem precedência sobre DB_SSL_INSECURE=true', () => {
    const env = {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/ehr_fleet',
      DB_SSL: 'false',
      DB_SSL_INSECURE: 'true',
    };

    const config = buildPoolConfig(env, mockLogger);

    expect(config.ssl).toBe(false);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('sem DATABASE_URL: monta configuração a partir de host/port/database sem SSL por padrão', () => {
    const env = {
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'ehr_fleet_dev',
      DB_USER: 'postgres',
      DB_PASSWORD: 'secretpassword',
    };

    const config = buildPoolConfig(env, mockLogger);

    expect(config).toEqual({
      host: 'localhost',
      port: '5432',
      database: 'ehr_fleet_dev',
      user: 'postgres',
      password: 'secretpassword',
    });
    expect(config.ssl).toBeUndefined();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('sem DATABASE_URL com DB_SSL=true: padrão exige validação estrita (rejectUnauthorized: true)', () => {
    const env = {
      DB_HOST: 'remote.postgres.com',
      DB_PORT: '5432',
      DB_NAME: 'ehr_fleet',
      DB_USER: 'postgres',
      DB_PASSWORD: 'secretpassword',
      DB_SSL: 'true',
    };

    const config = buildPoolConfig(env, mockLogger);

    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('sem DATABASE_URL com DB_SSL=true e DB_SSL_INSECURE=true: relaxa e emite aviso', () => {
    const env = {
      DB_HOST: 'remote.postgres.com',
      DB_PORT: '5432',
      DB_NAME: 'ehr_fleet',
      DB_USER: 'postgres',
      DB_PASSWORD: 'secretpassword',
      DB_SSL: 'true',
      DB_SSL_INSECURE: 'true',
    };

    const config = buildPoolConfig(env, mockLogger);

    expect(config.ssl).toEqual({ rejectUnauthorized: false });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('DB_SSL_INSECURE=true')
    );
  });
});
