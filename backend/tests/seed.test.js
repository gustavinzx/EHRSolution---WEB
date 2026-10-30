const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('../src/config/db');
const { seedIfEmpty } = require('../src/seed/seedIfEmpty');
const { seed } = require('../src/seed/seed');

describe('Seed and SeedIfEmpty hardening tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    // Limpa tabelas relevantes antes de cada teste
    await db.query(`TRUNCATE users, drivers, trucks, driver_trucks, fuel_stations, fueling_logs, telemetry_logs, fleet_alerts, fueling_sessions, security_events, unloading_events RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    process.env = originalEnv;
    await db.query(`TRUNCATE users, drivers, trucks, driver_trucks, fuel_stations, fueling_logs, telemetry_logs, fleet_alerts, fueling_sessions, security_events, unloading_events RESTART IDENTITY CASCADE`);
  });

  it('1. Varrer o código-fonte de seedIfEmpty.js e seed.js para garantir que Demo@1234 NUNCA é inserido', () => {
    const seedIfEmptySrc = fs.readFileSync(path.join(__dirname, '../src/seed/seedIfEmpty.js'), 'utf8');
    const seedSrc = fs.readFileSync(path.join(__dirname, '../src/seed/seed.js'), 'utf8');

    expect(seedIfEmptySrc).not.toContain('Demo@1234');
    expect(seedSrc).not.toContain('Demo@1234');
    expect(seedIfEmptySrc).not.toContain('DEV_API_KEY_001');
    expect(seedSrc).not.toContain('DEV_API_KEY_001');
  });

  it('2. seedIfEmpty não roda em production nem com AUTO_SEED_IF_EMPTY desligado', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTO_SEED_IF_EMPTY = 'true';
    await seedIfEmpty();
    let res = await db.query('SELECT COUNT(*)::int AS cnt FROM users');
    expect(res.rows[0].cnt).toBe(0);

    process.env.NODE_ENV = 'development';
    process.env.AUTO_SEED_IF_EMPTY = 'false';
    await seedIfEmpty();
    res = await db.query('SELECT COUNT(*)::int AS cnt FROM users');
    expect(res.rows[0].cnt).toBe(0);
  });

  it('3. seedIfEmpty usa SEED_ADMIN_PASSWORD e SEED_DRIVER_PASSWORD quando definidas', async () => {
    process.env.NODE_ENV = 'development';
    process.env.AUTO_SEED_IF_EMPTY = 'true';
    process.env.SEED_ADMIN_PASSWORD = 'AdminCustomPass#2026';
    process.env.SEED_DRIVER_PASSWORD = 'DriverCustomPass#2026';

    await seedIfEmpty();

    const { rows: users } = await db.query("SELECT password_hash FROM users WHERE email = 'gestor@ehr.com'");
    expect(users.length).toBe(1);
    const adminMatches = await bcrypt.compare('AdminCustomPass#2026', users[0].password_hash);
    expect(adminMatches).toBe(true);

    const { rows: drivers } = await db.query("SELECT password_hash FROM drivers WHERE email = 'motorista@ehr.com'");
    expect(drivers.length).toBe(1);
    const driverMatches = await bcrypt.compare('DriverCustomPass#2026', drivers[0].password_hash);
    expect(driverMatches).toBe(true);

    // Caminhão criado sem chave estática
    const { rows: trucks } = await db.query("SELECT api_key, api_key_hash FROM trucks WHERE plate = 'EHR-0001'");
    expect(trucks.length).toBe(1);
    expect(trucks[0].api_key).toBeNull();
  });

  it('4. seedIfEmpty gera senhas aleatórias fortes quando variáveis não estão definidas', async () => {
    process.env.NODE_ENV = 'development';
    process.env.AUTO_SEED_IF_EMPTY = 'true';
    delete process.env.SEED_ADMIN_PASSWORD;
    delete process.env.SEED_DRIVER_PASSWORD;

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await seedIfEmpty();

    const { rows: users } = await db.query("SELECT password_hash FROM users WHERE email = 'gestor@ehr.com'");
    expect(users.length).toBe(1);

    const { rows: drivers } = await db.query("SELECT password_hash FROM drivers WHERE email = 'motorista@ehr.com'");
    expect(drivers.length).toBe(1);

    // Verifica que imprimiu no log com aviso de troca
    const logs = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(logs).toMatch(/AVISO: Credenciais geradas automaticamente — troque após o primeiro acesso!/);
    expect(logs).toMatch(/gestor@ehr\.com/);
    expect(logs).toMatch(/motorista@ehr\.com/);

    logSpy.mockRestore();
  });

  it('5. seed.js recusa rodar em production ou sem ALLOW_SEED_WIPE=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_SEED_WIPE = 'true';
    await expect(seed()).rejects.toThrow(/Ambiente de produção detectado ou ALLOW_SEED_WIPE=true ausente/);

    process.env.NODE_ENV = 'development';
    process.env.ALLOW_SEED_WIPE = 'false';
    await expect(seed()).rejects.toThrow(/Ambiente de produção detectado ou ALLOW_SEED_WIPE=true ausente/);
  });
});
