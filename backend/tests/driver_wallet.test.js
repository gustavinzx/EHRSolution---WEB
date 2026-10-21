const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

const clean = require('./clean');

describe('Driver Wallet API (GET /api/fueling/wallet - Sicoob Open Banking)', () => {
  let driverId, driverToken;
  let managerToken;
  let truckId;
  let stationId;

  beforeAll(async () => {
    await clean();

    // Motorista
    const drv = await db.query(
      "INSERT INTO drivers (name, email, password_hash, is_active) VALUES ('Driver Sicoob', 'sicoob.driver@test.com', 'hash', true) RETURNING id"
    );
    driverId = drv.rows[0].id;
    driverToken = jwt.sign({ id: driverId, role: 'driver' }, process.env.JWT_SECRET);

    // Gestor
    const mgr = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Gestor Test', 'mgr.sicoob@test.com', 'hash', 'manager') RETURNING id"
    );
    managerToken = jwt.sign({ id: mgr.rows[0].id, role: 'manager' }, process.env.JWT_SECRET);

    // Posto
    const st = await db.query(
      "INSERT INTO fuel_stations (name, brand, lat, lng, is_authorized) VALUES ('Posto Sicoob Credifrotas', 'Shell', -15.8, -47.9, true) RETURNING id"
    );
    stationId = st.rows[0].id;

    // Caminhão
    const trk = await db.query(
      "INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id) VALUES ('SCB-1234', 'Scania R450', 500, 200, 'key_scb', $1) RETURNING id",
      [stationId]
    );
    truckId = trk.rows[0].id;

    // Insere 2 abastecimentos para o motorista
    await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, station_id, volume_liters, release_method, timestamp, station_name)
       VALUES ($1, $2, $3, 100.0, 'facial', NOW() - INTERVAL '1 day', 'Posto Sicoob Credifrotas')`,
      [driverId, truckId, stationId]
    );

    await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, station_id, volume_liters, release_method, timestamp, station_name)
       VALUES ($1, $2, $3, 50.0, 'facial', NOW() - INTERVAL '2 hours', 'Posto Sicoob Credifrotas')`,
      [driverId, truckId, stationId]
    );
  });

  afterAll(async () => {
    await clean();
  });

  it('retorna 401 quando chamado sem token de autorização', async () => {
    const res = await request(app).get('/api/fueling/wallet');
    expect(res.status).toBe(401);
  });

  it('retorna 403 quando chamado por um usuário gestor (acesso exclusivo do motorista)', async () => {
    const res = await request(app)
      .get('/api/fueling/wallet')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  it('retorna estrutura Sicoob completa com saldo, limite e transações para o motorista autenticado', async () => {
    const res = await request(app)
      .get('/api/fueling/wallet')
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.status).toBe(200);

    // Banco Cooperativo Sicoob
    expect(res.body.bank).toBeDefined();
    expect(res.body.bank.code).toBe('756');
    expect(res.body.bank.institution).toContain('Sicoob');
    expect(res.body.bank.protocol).toContain('Open Finance Brasil');
    expect(res.body.bank.developerPortalUrl).toBe('https://developers.sicoob.com.br/portal/apis');

    // Métricas
    expect(res.body.wallet).toBeDefined();
    expect(res.body.wallet.monthlyCreditLimit).toBe(5000.0);
    expect(res.body.wallet.totalLitersMonth).toBe(150.0); // 100 + 50
    // 150L * R$ 6,05 = R$ 907,50
    expect(res.body.wallet.totalSpentMonth).toBe(907.5);
    expect(res.body.wallet.balanceAvailable).toBe(4092.5); // 5000 - 907.5
    expect(res.body.wallet.fuelingCount).toBe(2);

    // Transações
    expect(Array.isArray(res.body.transactions)).toBe(true);
    expect(res.body.transactions.length).toBe(2);
    expect(res.body.transactions[0].paymentMethod).toContain('Sicoob');
    expect(res.body.transactions[0].status).toBe('liquidated');
    expect(res.body.transactions[0].authProtocol).toMatch(/^SCB-\d+$/);
  });
});
