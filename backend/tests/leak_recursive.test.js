const request = require('supertest');
const { app, io } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

let tokenManager, driverId, truckId, stationId;

const clean = require('./clean');
beforeAll(async () => {
  await clean();
  await db.query('DELETE FROM driver_trucks');
  await db.query('DELETE FROM fueling_logs');
  await db.query('DELETE FROM fueling_sessions');
  await db.query('DELETE FROM facial_attempts');
  await db.query('DELETE FROM fleet_alerts');
  await db.query('DELETE FROM security_events');
  await db.query('DELETE FROM drivers');
  await db.query('DELETE FROM users');
  await db.query('DELETE FROM trucks');
  await db.query('DELETE FROM fuel_stations');

  const u = await db.query("INSERT INTO users (name, email, password_hash, role) VALUES ('Manager', 'leak@test.com', 'h', 'manager') RETURNING id");
  tokenManager = jwt.sign({ id: u.rows[0].id, email: 'leak@test.com', role: 'manager' }, process.env.JWT_SECRET);

  const d = await db.query("INSERT INTO drivers (name, email, phone, password_hash, face_enrolled, face_template_ref, is_active) VALUES ('Leaky Driver', 'leakd@test.com', '999', 'secret_hash_123', true, 'secret_template_456', true) RETURNING id");
  driverId = d.rows[0].id;
  tokenDriver = jwt.sign({ id: driverId, role: 'driver' }, process.env.JWT_SECRET);
  
  const s = await db.query("INSERT INTO fuel_stations (name, lat, lng) VALUES ('S', -23, -46) RETURNING id");
  stationId = s.rows[0].id;
  
  const t = await db.query("INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id) VALUES ('ABC1', 'M', 100, 50, 'hw_secret_123', $1) RETURNING id", [stationId]);
  truckId = t.rows[0].id;
  
  await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [driverId, truckId]);
  
  await db.query("INSERT INTO fueling_sessions (driver_id, truck_id, station_id, status) VALUES ($1, $2, $3, 'active')", [driverId, truckId, stationId]);
});

let tokenDriver;

function checkRecursive(obj) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    obj.forEach(checkRecursive);
    return;
  }
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if ((key.includes('password') && key !== 'temporary_password') || key.includes('face_template_ref') || key.includes('api_key')) {
        throw new Error('LEAK DETECTED (KEY): ' + key);
      }
      const val = obj[key];
      if (typeof val === 'string') {
        if (val.includes('secret_hash_123') || val.includes('secret_template_456') || val.includes('hw_secret_123')) {
          throw new Error('LEAK DETECTED (VALUE): ' + val);
        }
      }
      checkRecursive(val);
    }
  }
}

function checkRecursiveSession(obj) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    obj.forEach(checkRecursiveSession);
    return;
  }
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (
        key.includes('password') ||
        key.includes('face_template_ref') ||
        key.includes('api_key') ||
        key.includes('metadata') ||
        key.startsWith('facial_') ||
        key.startsWith('ble_') ||
        key === 'pump_liters' ||
        key === 'data_source' ||
        key === 'anp_station_id' ||
        key.startsWith('station_match') ||
        key === 'cnpj' ||
        key.startsWith('anp_')
      ) {
        throw new Error('SESSION LEAK DETECTED (KEY): ' + key);
      }
      const val = obj[key];
      if (typeof val === 'string') {
        if (
          val.includes('secret_hash_123') ||
          val.includes('secret_template_456') ||
          val.includes('hw_secret_123') ||
          val.includes('secret_meta_val') ||
          val.includes('secret_source')
        ) {
          throw new Error('SESSION LEAK DETECTED (VALUE): ' + val);
        }
      }
      checkRecursiveSession(val);
    }
  }
}

describe('Leak Checks', () => {
  it('GET /api/drivers no leak and has assigned_trucks', async () => {
    const r = await request(app).get('/api/drivers').set('Authorization', 'Bearer ' + tokenManager);
    expect(r.status).toBe(200);
    checkRecursive(r.body);
    expect(r.body[0].assigned_trucks[0]).toHaveProperty('plate', 'ABC1');
    expect(r.body[0].assigned_trucks[0]).toHaveProperty('id');
    expect(r.body[0].assigned_trucks[0]).toHaveProperty('model');
  });

  it('POST /api/drivers no leak', async () => {
    const r = await request(app).post('/api/drivers').set('Authorization', 'Bearer ' + tokenManager).send({ name: 'D2' });
    checkRecursive(r.body);
  });

  it('PUT /api/drivers/:id no leak', async () => {
    const r = await request(app).put(`/api/drivers/${driverId}`).set('Authorization', 'Bearer ' + tokenManager).send({ name: 'D2_Updated' });
    checkRecursive(r.body);
  });

  it('PATCH /api/drivers/:id/deactivate no leak', async () => {
    const r = await request(app).patch(`/api/drivers/${driverId}/deactivate`).set('Authorization', 'Bearer ' + tokenManager);
    checkRecursive(r.body);
  });

  it('PATCH /api/drivers/:id/activate no leak', async () => {
    const r = await request(app).patch(`/api/drivers/${driverId}/activate`).set('Authorization', 'Bearer ' + tokenManager);
    checkRecursive(r.body);
  });

  it('GET /api/fleet no leak', async () => {
    const r = await request(app).get('/api/fleet').set('Authorization', 'Bearer ' + tokenManager);
    checkRecursive(r.body);
  });

  it('GET /api/fleet/:id no leak', async () => {
    const r = await request(app).get(`/api/fleet/${truckId}`).set('Authorization', 'Bearer ' + tokenManager);
    checkRecursive(r.body);
  });

  it('GET /api/fleet/:id/investigation no leak', async () => {
    const r = await request(app).get(`/api/fleet/${truckId}/investigation`).set('Authorization', 'Bearer ' + tokenManager);
    checkRecursive(r.body);
  });

  it('fleetUpdate e liveEventsUpdate via Socket.IO no leak (nem campos ANP)', async () => {
    const { getFleetSnapshot, getLiveEvents } = require('../src/services/fleetDataProvider');
    const snap = await getFleetSnapshot();
    checkRecursive(snap);
    checkRecursiveSession(snap);

    const live = await getLiveEvents();
    checkRecursive(live);
    checkRecursiveSession(live);
  });

  it('GET /api/fueling/sessions/:id e POST .../cancel sem leak de chaves ou valores secretos (nem anp_station_id / station_match*)', async () => {
    const s = await db.query(`
      INSERT INTO fueling_sessions
        (driver_id, truck_id, status, release_method, metadata, facial_consumed_at, ble_consumed_at, pump_liters, data_source, station_match_status, station_match_distance_m, station_match_source)
      VALUES
        ($1, $2, 'requested', 'facial', $3, NOW(), NOW(), 42.5, 'manager', 'matched', 18.2, 'truck_telemetry')
      RETURNING id
    `, [driverId, truckId, JSON.stringify({ secret_meta_val: 'secret_meta_val', facial_failures: 2 })]);
    const sessId = s.rows[0].id;

    const rGetDriver = await request(app).get(`/api/fueling/sessions/${sessId}`).set('Authorization', 'Bearer ' + tokenDriver);
    expect(rGetDriver.status).toBe(200);
    checkRecursiveSession(rGetDriver.body);

    const rGetMgr = await request(app).get(`/api/fueling/sessions/${sessId}`).set('Authorization', 'Bearer ' + tokenManager);
    expect(rGetMgr.status).toBe(200);
    checkRecursiveSession(rGetMgr.body);

    const rCancel = await request(app).post(`/api/fueling/sessions/${sessId}/cancel`).set('Authorization', 'Bearer ' + tokenDriver);
    expect(rCancel.status).toBe(200);
    checkRecursiveSession(rCancel.body);
  });

  it('GET /api/fueling/history sem leak recursivo de chaves e valores secretos', async () => {
    const anp = await db.query(`
      INSERT INTO anp_stations (cnpj, razao_social, uf, lat, lng)
      VALUES ('99887766000155', 'secret_razao', 'SP', -23, -46)
      ON CONFLICT (cnpj) DO UPDATE SET razao_social = 'secret_razao'
      RETURNING id
    `);
    const anpId = anp.rows[0].id;

    await db.query(`
      INSERT INTO fueling_logs
        (driver_id, truck_id, timestamp, lat, lng, level_before, level_after, release_method, station_id, station_name, duration_minutes, volume_liters, pump_liters, tank_liters_delta, data_source, anp_station_id, station_match_status, station_match_source)
      VALUES
        ($1, $2, NOW(), -23.55, -46.63, 10.0, 55.5, 'facial', $3, 'Posto Seguro', 15.0, 45.5, 99.0, 88.0, 'manager', $4, 'matched', 'truck_telemetry')
    `, [driverId, truckId, stationId, anpId]);

    const res = await request(app)
      .get('/api/fueling/history')
      .set('Authorization', 'Bearer ' + tokenDriver);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);

    function checkRecursiveHistory(obj) {
      if (!obj) return;
      if (Array.isArray(obj)) {
        obj.forEach(checkRecursiveHistory);
        return;
      }
      if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          if (
            key.includes('password') ||
            key.includes('face_template_ref') ||
            key.includes('api_key') ||
            key.includes('metadata') ||
            key.startsWith('facial_') ||
            key.startsWith('ble_') ||
            key === 'pump_liters' ||
            key === 'tank_liters_delta' ||
            key === 'data_source' ||
            key === 'level_before' ||
            key === 'level_after' ||
            key === 'lat' ||
            key === 'lng' ||
            key === 'session_id' ||
            key === 'station_id' ||
            key === 'anp_station_id' ||
            key.startsWith('station_match') ||
            key === 'cnpj' ||
            key.startsWith('anp_')
          ) {
            throw new Error('HISTORY LEAK DETECTED (KEY): ' + key);
          }
          const val = obj[key];
          if (typeof val === 'string' && val.includes('secret_')) {
            throw new Error('HISTORY LEAK DETECTED (VALUE): ' + val);
          }
          checkRecursiveHistory(val);
        }
      }
    }

    checkRecursiveHistory(res.body);

    for (const item of res.body.items) {
      expect(Object.keys(item).sort()).toEqual([
        "duration_minutes",
        "id",
        "release_method",
        "station_name",
        "timestamp",
        "truck_plate",
        "volume_liters"
      ]);
    }
  });
});
