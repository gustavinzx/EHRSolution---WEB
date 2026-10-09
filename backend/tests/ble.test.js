const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

let tokenManager, tokenDriver, driverId, truckId, stationId;

beforeAll(async () => {
  await db.query("DELETE FROM fleet_alerts");
  await db.query("DELETE FROM security_events");
  await db.query("DELETE FROM facial_attempts");
  await db.query("DELETE FROM fueling_logs");
  await db.query("DELETE FROM fueling_sessions");
  await db.query("DELETE FROM driver_trucks");
  await db.query("DELETE FROM trucks");
  await db.query("DELETE FROM drivers");
  await db.query("DELETE FROM fuel_stations");
  await db.query("DELETE FROM users");

  const drvRes = await db.query("INSERT INTO drivers (name, is_active) VALUES ('Driver B', true) RETURNING id");
  driverId = drvRes.rows[0].id;
  tokenDriver = jwt.sign({ id: driverId, role: 'driver' }, process.env.JWT_SECRET);

  const stRes = await db.query("INSERT INTO fuel_stations (name, lat, lng) VALUES ('Posto B', -23, -46) RETURNING id");
  stationId = stRes.rows[0].id;

  const trkRes = await db.query("INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id, lat, lng) VALUES ('BLE-0000', 'Test', 100, 50, 'key_ble', $1, -23, -46) RETURNING id", [stationId]);
  truckId = trkRes.rows[0].id;

  await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [driverId, truckId]);
});

describe('BLE Single Use', () => {
  it('BLE segunda autorização => 403 ble_confirmation_already_used', async () => {
    const s = await db.query("INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method, ble_confirmed_at) VALUES ($1, $2, $3, 'requested', 'ble_fallback', NOW()) RETURNING id", [truckId, driverId, stationId]);
    
    // First authorization
    const res1 = await request(app).post('/api/fueling/sessions/' + s.rows[0].id + '/authorize')
      .set('Authorization', 'Bearer ' + tokenDriver).send({});
    expect(res1.status).toBe(200);

    // Make it requested again to test the block logic on consumed confirmation
    await db.query("UPDATE fueling_sessions SET status='requested' WHERE id=$1", [s.rows[0].id]);
    
    const res2 = await request(app).post('/api/fueling/sessions/' + s.rows[0].id + '/authorize')
      .set('Authorization', 'Bearer ' + tokenDriver).send({});
    expect(res2.status).toBe(403);
    expect(res2.body.error).toBe('ble_confirmation_already_used');
  });

  it('BLE confirmação mais de 2 min => 403 ble_confirmation_expired', async () => {
    const s = await db.query("INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method, ble_confirmed_at) VALUES ($1, $2, $3, 'requested', 'ble_fallback', NOW() - INTERVAL '3 minutes') RETURNING id", [truckId, driverId, stationId]);
    const res = await request(app).post('/api/fueling/sessions/' + s.rows[0].id + '/authorize')
      .set('Authorization', 'Bearer ' + tokenDriver).send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ble_confirmation_expired');
  });
});
