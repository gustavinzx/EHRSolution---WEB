const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const { runMigrations } = require('../src/migrations/runner');
const jwt = require('jsonwebtoken');

describe('Web Hardening Tests', () => {
  let managerToken, driverToken, hardwareKey, truckId, driverId, sessionId, alertId;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test_secret';
    await runMigrations();

    // Clean tables
    await db.query(`TRUNCATE users, drivers, trucks, driver_trucks, fleet_alerts, fueling_sessions, fueling_logs CASCADE`);

    // Insert test data
    const { rows: tRows } = await db.query(`INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key) VALUES ('TST-1234', 'Volvo', 500, 100, 'test_hw_key') RETURNING id`);
    truckId = tRows[0].id;
    hardwareKey = 'test_hw_key';

    const { rows: dRows } = await db.query(`INSERT INTO drivers (name, email, password_hash, is_active) VALUES ('Test Driver', 'driver@test.com', 'hash', true) RETURNING id`);
    driverId = dRows[0].id;

    await db.query(`INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)`, [driverId, truckId]);

    const { rows: uRows } = await db.query(`INSERT INTO users (name, email, password_hash) VALUES ('Manager', 'manager@test.com', 'hash') RETURNING id`);
    
    managerToken = jwt.sign({ id: uRows[0].id, name: 'Manager', role: 'manager' }, 'test_secret');
    driverToken = jwt.sign({ id: driverId, role: 'driver' }, 'test_secret');
  });

  afterAll(async () => {
    await db.pool.end();
  });

  it('1. Motorista finalizando sem hardware: volume=null, alerta criado', async () => {
    // Create an active session
    const { rows: sRows } = await db.query(`INSERT INTO fueling_sessions (truck_id, driver_id, status) VALUES ($1, $2, 'active') RETURNING id`, [truckId, driverId]);
    const sid = sRows[0].id;

    const res = await request(app)
      .post(`/api/fueling/sessions/${sid}/finish`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ level_before: 100, level_after: 500 }); // driver tries to send volume

    expect(res.status).toBe(200);

    // Check truck level hasn't changed
    const { rows: tRows } = await db.query(`SELECT current_level_liters FROM trucks WHERE id = $1`, [truckId]);
    expect(parseFloat(tRows[0].current_level_liters)).toBe(100); // unaffected by driver

    // Check log has NULL volume and 'unverified' source
    const { rows: lRows } = await db.query(`SELECT * FROM fueling_logs WHERE session_id = $1`, [sid]);
    expect(lRows.length).toBe(1);
    expect(lRows[0].volume_liters).toBeNull();
    expect(lRows[0].level_after).toBeNull();
    expect(lRows[0].data_source).toBe('unverified');

    // Check alert was created
    const { rows: aRows } = await db.query(`SELECT * FROM fleet_alerts WHERE type = 'unverified_fueling' AND truck_id = $1`, [truckId]);
    expect(aRows.length).toBe(1);
  });

  it('2. pump-reading com chave de outro caminhão -> 403', async () => {
    // Create another truck
    const { rows: tRows } = await db.query(`INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key) VALUES ('TST-9999', 'Scania', 500, 100, 'other_hw_key') RETURNING id`);
    const otherTruckId = tRows[0].id;

    const { rows: sRows } = await db.query(`INSERT INTO fueling_sessions (truck_id, driver_id, status) VALUES ($1, $2, 'active') RETURNING id`, [truckId, driverId]);
    
    const res = await request(app)
      .post(`/api/fueling/sessions/${sRows[0].id}/pump-reading`)
      .set('x-api-key', 'other_hw_key')
      .send({ pump_liters: 100 });
      
    expect(res.status).toBe(403);
  });

  it('3. pump-reading: negativo->400, acima cap->400, requested->409', async () => {
    const { rows: sRows } = await db.query(`INSERT INTO fueling_sessions (truck_id, driver_id, status) VALUES ($1, $2, 'active') RETURNING id`, [truckId, driverId]);
    sessionId = sRows[0].id;

    const resNeg = await request(app).post(`/api/fueling/sessions/${sessionId}/pump-reading`).set('x-api-key', hardwareKey).send({ pump_liters: -10 });
    expect(resNeg.status).toBe(400);

    const resCap = await request(app).post(`/api/fueling/sessions/${sessionId}/pump-reading`).set('x-api-key', hardwareKey).send({ pump_liters: 600 });
    expect(resCap.status).toBe(400);

    const { rows: sReq } = await db.query(`INSERT INTO fueling_sessions (truck_id, driver_id, status) VALUES ($1, $2, 'requested') RETURNING id`, [truckId, driverId]);
    const resReq = await request(app).post(`/api/fueling/sessions/${sReq[0].id}/pump-reading`).set('x-api-key', hardwareKey).send({ pump_liters: 100 });
    expect(resReq.status).toBe(409);
  });

  it('4. pump-reading valor 0 é aceito e gravado como 0', async () => {
    const res = await request(app)
      .post(`/api/fueling/sessions/${sessionId}/pump-reading`)
      .set('x-api-key', hardwareKey)
      .send({ pump_liters: 0 });
    expect(res.status).toBe(200);

    const { rows } = await db.query(`SELECT pump_liters FROM fueling_sessions WHERE id=$1`, [sessionId]);
    expect(parseFloat(rows[0].pump_liters)).toBe(0);
  });

  it('5. resolve alerta: sem nota->400, valido->resolved_by', async () => {
    const { rows } = await db.query(`INSERT INTO fleet_alerts (truck_id, type, severity, message) VALUES ($1, 'teste', 'low', 'msg') RETURNING id`, [truckId]);
    alertId = rows[0].id;

    const resErr = await request(app).patch(`/api/alerts/${alertId}/resolve`).set('Authorization', `Bearer ${managerToken}`).send({ resolution_note: 'ok' });
    expect(resErr.status).toBe(400);

    const resOk = await request(app).patch(`/api/alerts/${alertId}/resolve`).set('Authorization', `Bearer ${managerToken}`).send({ resolution_note: 'resolvido com sucesso' });
    expect(resOk.status).toBe(200);
    expect(resOk.body.resolved_by).toBe('Manager');
  });

  it('6. GET /alerts truck_id invalido -> 400', async () => {
    const res = await request(app).get(`/api/alerts?truck_id=abc`).set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(400);
  });

});
