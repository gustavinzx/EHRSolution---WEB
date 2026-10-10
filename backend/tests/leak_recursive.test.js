const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

let tokenManager, driverId;

beforeAll(async () => {
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

  const d = await db.query("INSERT INTO drivers (name, email, phone, password_hash, face_enrolled, face_template_ref) VALUES ('Leaky Driver', 'leakd@test.com', '999', 'secret_hash_123', true, 'secret_template_456') RETURNING id");
  driverId = d.rows[0].id;
});

function checkRecursive(obj) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    obj.forEach(checkRecursive);
    return;
  }
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (key.includes('password') || key.includes('face_template_ref')) {
        throw new Error('LEAK DETECTED: ' + key);
      }
      checkRecursive(obj[key]);
    }
  }
}

describe('Leak Checks', () => {
  it('GET /api/drivers no leak', async () => {
    const r = await request(app).get('/api/drivers').set('Authorization', 'Bearer ' + tokenManager);
    expect(r.status).toBe(200);
    checkRecursive(r.body);
  });
});
