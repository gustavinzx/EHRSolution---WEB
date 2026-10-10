const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const rows = require('./contractRows');

if (!process.env.DB_NAME?.endsWith('_test')) {
  process.exit(1);
}

describe('API Contract Tests (Table Driven)', () => {
  const ids = { db };

  const clean = require('./clean');
beforeAll(async () => {
  await clean();
    await db.query('DELETE FROM driver_trucks');
    await db.query('DELETE FROM fueling_logs');
    await db.query('DELETE FROM facial_attempts');
    await db.query('DELETE FROM security_events');
    await db.query('DELETE FROM fueling_sessions');
    await db.query('DELETE FROM fleet_alerts');
    await db.query('DELETE FROM trucks');
    await db.query('DELETE FROM fuel_stations');
    await db.query('DELETE FROM drivers');
    await db.query('DELETE FROM users');

    const u = await db.query("INSERT INTO users (name, email, password_hash, role) VALUES ('M', 'm2@c.com', 'h', 'manager') RETURNING id");
    ids.mgrId = u.rows[0].id;
    ids.mgrToken = jwt.sign({ id: ids.mgrId, email: 'm2@c.com', role: 'manager' }, process.env.JWT_SECRET);
    
    const au = await db.query("INSERT INTO users (name, email, password_hash, role) VALUES ('A', 'a@c.com', 'h', 'auditor') RETURNING id");
    ids.auditorToken = jwt.sign({ id: au.rows[0].id, email: 'a@c.com', role: 'auditor' }, process.env.JWT_SECRET);

    const d = await db.query("INSERT INTO drivers (name, email, password_hash, is_active, face_enrolled, face_template_ref) VALUES ('D', 'd@c.com', 'h', true, true, 'valid_ref') RETURNING id");
    ids.drvId = d.rows[0].id;
    ids.drvToken = jwt.sign({ id: ids.drvId, role: 'driver' }, process.env.JWT_SECRET);

    const od = await db.query("INSERT INTO drivers (name, is_active, face_enrolled) VALUES ('OD', true, false) RETURNING id");
    ids.otherDrvId = od.rows[0].id;
    ids.otherDrvToken = jwt.sign({ id: ids.otherDrvId, role: 'driver' }, process.env.JWT_SECRET);

    const d2 = await db.query("INSERT INTO drivers (name, is_active) VALUES ('Inact', false) RETURNING id");
    ids.inactDrvId = d2.rows[0].id;
    ids.inactDrvToken = jwt.sign({ id: ids.inactDrvId, role: 'driver' }, process.env.JWT_SECRET);
    
    ids.deletedUserToken = jwt.sign({ id: 99999, role: 'driver' }, process.env.JWT_SECRET);
    ids.deletedUserMgrToken = jwt.sign({ id: 99999, role: 'manager' }, process.env.JWT_SECRET);
    
    const deactMgr = await db.query("INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Deact', 'deact@mgr.com', 'h', 'manager', false) RETURNING id");
    ids.deactMgrToken = jwt.sign({ id: deactMgr.rows[0].id, role: 'manager' }, process.env.JWT_SECRET);

    const s = await db.query("INSERT INTO fuel_stations (name, lat, lng) VALUES ('S', -23, -46) RETURNING id");
    ids.stationId = s.rows[0].id;

    ids.hwKey = 'hw_secret_123';
    const t = await db.query("INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id) VALUES ('ABC2', 'M', 100, 50, $1, $2) RETURNING id", [ids.hwKey, ids.stationId]);
    ids.truckId = t.rows[0].id;
    await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [ids.drvId, ids.truckId]);
    
    const ot = await db.query("INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key) VALUES ('XYZ8', 'M', 100, 50, 'hw_other') RETURNING id");
    ids.otherTruckId = ot.rows[0].id;
    await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [ids.otherDrvId, ids.otherTruckId]);

    ids.validBase64 = Buffer.from('ffd8ffe0' + Buffer.from('MATCH_123').toString('hex'), 'hex').toString('base64');
    ids.validBase64Fail = Buffer.from('ffd8ffe0' + Buffer.from('FAIL_123').toString('hex'), 'hex').toString('base64');

    ids.newSession = async (truck_id) => {
      await db.query("UPDATE fueling_sessions SET status = 'completed' WHERE truck_id = $1 AND status != 'completed'", [truck_id]);
    };
    
    ids.createSess = async (truck_id, release_method) => {
      const res = await request(app).post('/api/fueling/sessions')
        .set('Authorization', 'Bearer ' + (truck_id === ids.truckId ? ids.drvToken : ids.otherDrvToken))
        .send({ truck_id, release_method });
      return res.body;
    };
  });
  
  afterEach(() => {
    process.env.FACE_PROVIDER = 'mock'; // reset mock
  });

  const runCase = async (c) => {
    if (c.setup) await c.setup(ids);
    const resolvedPath = typeof c.path === 'function' ? c.path(ids) : c.path;
    let req = request(app)[c.method](resolvedPath);
    
    if (c.auth === 'mgr') req = req.set('Authorization', 'Bearer ' + ids.mgrToken);
    else if (c.auth === 'drv') req = req.set('Authorization', 'Bearer ' + ids.drvToken);
    else if (c.auth === 'otherDrv') req = req.set('Authorization', 'Bearer ' + ids.otherDrvToken);
    else if (c.auth === 'inactDrv') req = req.set('Authorization', 'Bearer ' + ids.inactDrvToken);
    else if (c.auth === 'auditor') req = req.set('Authorization', 'Bearer ' + ids.auditorToken);
    else if (c.auth === 'deletedUser') req = req.set('Authorization', 'Bearer ' + ids.deletedUserToken);
    else if (c.auth === 'deletedUserMgr') req = req.set('Authorization', 'Bearer ' + ids.deletedUserMgrToken);
    else if (c.auth === 'deactMgr') req = req.set('Authorization', 'Bearer ' + ids.deactMgrToken);
    else if (c.auth === 'hw') req = req.set('x-api-key', ids.hwKey);
    else if (c.auth === 'hwWrong') req = req.set('x-api-key', 'wrong');
    else if (c.auth === 'hwOther') req = req.set('x-api-key', 'hw_other');
    else if (c.auth === 'bad') req = req.set('Authorization', 'Bearer bad');

    if (c.body) {
      const resolvedBody = typeof c.body === 'function' ? c.body(ids) : c.body;
      req = req.send(resolvedBody);
    }

    const res = await req;
    
    if (ids.providerSpy) ids.providerSpy.mockRestore();

    expect(res.status).toBe(c.status);
    if (c.error) expect(res.body.error).toBe(c.error);
    if (c.assertBody) c.assertBody(res.body, ids);
  };

  for (const t of rows) {
    it(t.name, async () => await runCase(t));
  }
});
