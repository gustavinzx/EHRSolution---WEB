const request = require('supertest');
const { app, io } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

let tokenManager, driverId, truckId;

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
  
  const s = await db.query("INSERT INTO fuel_stations (name, lat, lng) VALUES ('S', -23, -46) RETURNING id");
  const stationId = s.rows[0].id;
  
  const t = await db.query("INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id) VALUES ('ABC1', 'M', 100, 50, 'hw_secret_123', $1) RETURNING id", [stationId]);
  truckId = t.rows[0].id;
  
  await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [driverId, truckId]);
  
  await db.query("INSERT INTO fueling_sessions (driver_id, truck_id, station_id, status) VALUES ($1, $2, $3, 'active')", [driverId, truckId, stationId]);
});

function checkRecursive(obj) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    obj.forEach(checkRecursive);
    return;
  }
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (key.includes('password') || key.includes('face_template_ref') || key.includes('api_key')) {
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

  it('fleetUpdate via Socket.IO no leak', (done) => {
    // The server emits fleetUpdate periodically or on demand.
    // We can simulate an API call that triggers fleetUpdate if any.
    // Actually we can just call getFleetSnapshot manually and check.
    const { getFleetSnapshot } = require('../src/services/fleetDataProvider');
    getFleetSnapshot().then(snap => {
      checkRecursive(snap);
      done();
    });
  });
});
