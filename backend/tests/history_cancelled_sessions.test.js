const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

const clean = require('./clean');

describe('History Cancelled Sessions & Contracts (BLOCO K1)', () => {
  let driverAId, driverAToken;
  let driverBId, driverBToken;
  let truckAId;

  beforeAll(async () => {
    await clean();
    process.env.JWT_SECRET = 'test_secret';

    const drvA = await db.query(
      "INSERT INTO drivers (name, email, password_hash, is_active) VALUES ('Driver A', 'drva_k1@test.com', 'hash', true) RETURNING id"
    );
    driverAId = drvA.rows[0].id;
    driverAToken = jwt.sign({ id: driverAId, role: 'driver' }, 'test_secret');

    const drvB = await db.query(
      "INSERT INTO drivers (name, email, password_hash, is_active) VALUES ('Driver B', 'drvb_k1@test.com', 'hash', true) RETURNING id"
    );
    driverBId = drvB.rows[0].id;
    driverBToken = jwt.sign({ id: driverBId, role: 'driver' }, 'test_secret');

    const trkA = await db.query(
      "INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key) VALUES ('TRK-K001', 'Volvo FH', 500, 200, 'key_k1') RETURNING id"
    );
    truckAId = trkA.rows[0].id;

    await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [driverAId, truckAId]);
    await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [driverBId, truckAId]);
  });

  beforeEach(async () => {
    await db.query("DELETE FROM fueling_logs");
    await db.query("DELETE FROM fueling_sessions");
  });

  afterAll(async () => {
    await db.pool.end();
  });

  it('a) cancelada aparece no histórico do motorista dono com status cancelled', async () => {
    const sRes = await db.query(
      `INSERT INTO fueling_sessions (driver_id, truck_id, status, release_method, requested_at, authorized_at, metadata)
       VALUES ($1, $2, 'cancelled', 'facial', NOW(), NOW(), '{"cancelled_by": "driver", "cancelled_at": "2026-10-24T12:00:00.000Z"}'::jsonb)
       RETURNING id`,
      [driverAId, truckAId]
    );
    const sessionId = sRes.rows[0].id;

    const res = await request(app)
      .get('/api/fueling/history')
      .set('Authorization', 'Bearer ' + driverAToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    const item = res.body.items[0];
    expect(item.id).toBe(sessionId);
    expect(item.kind).toBe('session');
    expect(item.status).toBe('cancelled');
    expect(item.truck_plate).toBe('TRK-K001');
    expect(item.volume_liters).toBeNull();
    expect(item.duration_minutes).toBeNull();
    expect(item.station_name).toBeNull();
    expect(item.release_method).toBe('facial');
    expect(res.body.total).toBe(1);
  });

  it('b) não aparece no histórico de outro motorista', async () => {
    await db.query(
      `INSERT INTO fueling_sessions (driver_id, truck_id, status, release_method, requested_at, metadata)
       VALUES ($1, $2, 'cancelled', 'facial', NOW(), '{"cancelled_by": "driver"}'::jsonb)`,
      [driverAId, truckAId]
    );

    const resB = await request(app)
      .get('/api/fueling/history')
      .set('Authorization', 'Bearer ' + driverBToken);

    expect(resB.status).toBe(200);
    expect(resB.body.items).toHaveLength(0);
    expect(resB.body.total).toBe(0);
  });

  it('c) completed continua no mesmo formato e com status completed e kind log', async () => {
    const lRes = await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, timestamp, volume_liters, duration_minutes, release_method, station_name, data_source)
       VALUES ($1, $2, NOW(), 55.4, 14.2, 'facial', 'Posto Shell Rodoeste', 'manager')
       RETURNING id`,
      [driverAId, truckAId]
    );
    const logId = lRes.rows[0].id;

    const res = await request(app)
      .get('/api/fueling/history')
      .set('Authorization', 'Bearer ' + driverAToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    const item = res.body.items[0];
    expect(item.id).toBe(logId);
    expect(item.kind).toBe('log');
    expect(item.status).toBe('completed');
    expect(item.truck_plate).toBe('TRK-K001');
    expect(item.volume_liters).toBe(55.4);
    expect(item.duration_minutes).toBe(14.2);
    expect(item.station_name).toBe('Posto Shell Rodoeste');
    expect(item.release_method).toBe('facial');
    expect(res.body.total).toBe(1);
  });

  it('d) summary não muda com cancelados (continua considerando somente logs)', async () => {
    await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, timestamp, volume_liters, duration_minutes, release_method, station_name, data_source)
       VALUES ($1, $2, NOW() - INTERVAL '2 days', 50.0, 10.0, 'facial', 'Posto Teste', 'manager')`,
      [driverAId, truckAId]
    );
    await db.query(
      `INSERT INTO fueling_sessions (driver_id, truck_id, status, release_method, requested_at, metadata)
       VALUES ($1, $2, 'cancelled', 'facial', NOW(), '{"cancelled_by": "driver"}'::jsonb)`,
      [driverAId, truckAId]
    );

    const res = await request(app)
      .get('/api/fueling/history')
      .set('Authorization', 'Bearer ' + driverAToken);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.summary).toEqual({
      count: 1,
      total_liters: 50.0,
    });
  });

  it('e) paginação e total corretos com itens mistos', async () => {
    // 3 logs e 2 sessões canceladas
    for (let i = 1; i <= 3; i++) {
      await db.query(
        `INSERT INTO fueling_logs (id, driver_id, truck_id, timestamp, volume_liters, duration_minutes, release_method, station_name, data_source)
         VALUES ($1, $2, $3, NOW() - ($4 * INTERVAL '2 days'), 10, 5, 'facial', 'Posto', 'manager')`,
        [500 + i, driverAId, truckAId, i]
      );
    }
    await db.query(
      `INSERT INTO fueling_sessions (id, driver_id, truck_id, status, release_method, requested_at, authorized_at, metadata)
       VALUES ($1, $2, $3, 'cancelled', 'facial', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', '{"cancelled_at": "2026-10-23T12:00:00Z"}'::jsonb)`,
      [601, driverAId, truckAId]
    );
    await db.query(
      `INSERT INTO fueling_sessions (id, driver_id, truck_id, status, release_method, requested_at, authorized_at, expires_at)
       VALUES ($1, $2, $3, 'expired', 'facial', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days')`,
      [602, driverAId, truckAId]
    );

    const resPage1 = await request(app)
      .get('/api/fueling/history?page=1&limit=2')
      .set('Authorization', 'Bearer ' + driverAToken);

    expect(resPage1.status).toBe(200);
    expect(resPage1.body.total).toBe(5);
    expect(resPage1.body.items).toHaveLength(2);

    const resPage2 = await request(app)
      .get('/api/fueling/history?page=2&limit=2')
      .set('Authorization', 'Bearer ' + driverAToken);

    expect(resPage2.status).toBe(200);
    expect(resPage2.body.items).toHaveLength(2);

    const resPage3 = await request(app)
      .get('/api/fueling/history?page=3&limit=2')
      .set('Authorization', 'Bearer ' + driverAToken);

    expect(resPage3.status).toBe(200);
    expect(resPage3.body.items).toHaveLength(1);
  });

  it('f) nenhum campo antifraude vaza (sem niveis, alertas, motivos ou quem cancelou)', async () => {
    await db.query(
      `INSERT INTO fueling_sessions (driver_id, truck_id, status, release_method, requested_at, authorized_at, pump_liters, tank_liters_delta, metadata)
       VALUES ($1, $2, 'cancelled', 'facial', NOW(), NOW(), 120.5, 95.0, '{"cancelled_by": "driver", "reason": "suspeita de fraude", "anti_fraud_flags": ["divergence"]}'::jsonb)`,
      [driverAId, truckAId]
    );

    const res = await request(app)
      .get('/api/fueling/history')
      .set('Authorization', 'Bearer ' + driverAToken);

    expect(res.status).toBe(200);
    const item = res.body.items[0];
    const forbiddenKeys = [
      'cancelled_by', 'reason', 'metadata', 'pump_liters', 'tank_liters_delta',
      'anti_fraud_flags', 'divergence', 'flags', 'internal_reason', 'raw'
    ];
    for (const key of forbiddenKeys) {
      expect(item).not.toHaveProperty(key);
    }
  });
});
