const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const { evaluateFuelingLog, getAlertSettings } = require('../src/services/fuelRules');
const jwt = require('jsonwebtoken');

// Guard
if (!process.env.DB_NAME?.endsWith('_test')) {
  throw new Error("DB_NAME must end with '_test' to run tests safely.");
}

describe('Divergence and Fuel Rules Tests', () => {
  let tokenManager;
  let truckId;
  let driverId;

  const clean = require('./clean');
beforeAll(async () => {
  await clean();
    process.env.JWT_SECRET = 'test_secret';
    tokenManager = jwt.sign({ id: 999, type: 'manager', email: 'manager@test.com', name: 'Gestor' }, process.env.JWT_SECRET);
    await db.query("INSERT INTO users (id, name, email, password_hash, role) VALUES (999, 'Gestor', 'manager@test.com', 'hash', 'admin') ON CONFLICT DO NOTHING");

    const drv = await db.query("INSERT INTO drivers (name) VALUES ('Test Driver') RETURNING id");
    driverId = drv.rows[0].id;

    const trk = await db.query(`
      INSERT INTO trucks (plate, model, capacity_liters, current_level_liters) 
      VALUES ('DIV-9999', 'Test Model', 500, 100) RETURNING id
    `);
    truckId = trk.rows[0].id;
  });

  afterAll(async () => {
    await db.query("DELETE FROM fleet_alerts");
    await db.query("DELETE FROM fueling_logs");
    await db.query("DELETE FROM trucks WHERE id = $1", [truckId]);
    await db.query("DELETE FROM drivers WHERE id = $1", [driverId]);

    await db.query("UPDATE alert_settings SET value_num=5 WHERE key='divergence_pct'");
    await db.query("UPDATE alert_settings SET value_num=15 WHERE key='divergence_critical_pct'");
    await db.query("UPDATE alert_settings SET value_num=30 WHERE key='consumption_deviation_pct'");
    await db.query("UPDATE alert_settings SET value_num=22 WHERE key='offhours_start_hour'");
    await db.query("UPDATE alert_settings SET value_num=5 WHERE key='offhours_end_hour'");
    await db.query("UPDATE alert_settings SET value_num=1 WHERE key='offhours_enabled'");
    const { clearSettingsCache } = require('../src/services/fuelRules');
    clearSettingsCache();
  });

  it('1. GET and PUT /api/settings/alerts validations', async () => {
    const resGet = await request(app)
      .get('/api/settings/alerts')
      .set('Authorization', `Bearer ${tokenManager}`);
    expect(resGet.status).toBe(200);

    const resBad = await request(app)
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${tokenManager}`)
      .send({
        divergence_pct: 20,
        divergence_critical_pct: 10,
        offhours_start_hour: 22,
        offhours_end_hour: 5,
        offhours_enabled: 1
      });
    expect(resBad.status).toBe(400);

    const resBadTime = await request(app)
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${tokenManager}`)
      .send({
        divergence_pct: 5,
        divergence_critical_pct: 10,
        offhours_start_hour: 25,
        offhours_end_hour: 5,
        offhours_enabled: 1
      });
    expect(resBadTime.status).toBe(400);

    const resOk = await request(app)
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${tokenManager}`)
      .send({
        divergence_pct: 5,
        divergence_critical_pct: 15,
        offhours_start_hour: 22,
        offhours_end_hour: 5,
        offhours_enabled: 1
      });
    expect(resOk.status).toBe(200);
  });

  it('2. evaluateFuelingLog divergence scenarios', async () => {
    // High divergence
    const logHigh = await db.query(`INSERT INTO fueling_logs (truck_id, driver_id, data_source, pump_liters, tank_liters_delta) VALUES ($1, $2, 'hardware', 100, 90) RETURNING id`, [truckId, driverId]);
    await evaluateFuelingLog(logHigh.rows[0].id, null);
    const alHigh = await db.query("SELECT * FROM fleet_alerts WHERE fueling_log_id = $1 AND type='fuel_divergence'", [logHigh.rows[0].id]);
    expect(alHigh.rows.length).toBe(1);
    expect(alHigh.rows[0].severity).toBe('high');

    // Critical divergence
    const logCrit = await db.query(`INSERT INTO fueling_logs (truck_id, driver_id, data_source, pump_liters, tank_liters_delta) VALUES ($1, $2, 'hardware', 100, 80) RETURNING id`, [truckId, driverId]);
    await evaluateFuelingLog(logCrit.rows[0].id, null);
    const alCrit = await db.query("SELECT * FROM fleet_alerts WHERE fueling_log_id = $1 AND type='fuel_divergence'", [logCrit.rows[0].id]);
    expect(alCrit.rows.length).toBe(1);
    expect(alCrit.rows[0].severity).toBe('critical');

    // Below limit
    const logOk = await db.query(`INSERT INTO fueling_logs (truck_id, driver_id, data_source, pump_liters, tank_liters_delta) VALUES ($1, $2, 'hardware', 100, 97) RETURNING id`, [truckId, driverId]);
    await evaluateFuelingLog(logOk.rows[0].id, null);
    const alOk = await db.query("SELECT * FROM fleet_alerts WHERE fueling_log_id = $1 AND type='fuel_divergence'", [logOk.rows[0].id]);
    expect(alOk.rows.length).toBe(0);

    // pump_liters NULL
    const logNull = await db.query(`INSERT INTO fueling_logs (truck_id, driver_id, data_source, pump_liters, tank_liters_delta) VALUES ($1, $2, 'hardware', NULL, 90) RETURNING id`, [truckId, driverId]);
    await evaluateFuelingLog(logNull.rows[0].id, null);
    const alNull = await db.query("SELECT * FROM fleet_alerts WHERE fueling_log_id = $1 AND type='fuel_divergence'", [logNull.rows[0].id]);
    expect(alNull.rows.length).toBe(0);

    // pump_liters = 0
    const logZero = await db.query(`INSERT INTO fueling_logs (truck_id, driver_id, data_source, pump_liters, tank_liters_delta) VALUES ($1, $2, 'hardware', 0, 90) RETURNING id`, [truckId, driverId]);
    await evaluateFuelingLog(logZero.rows[0].id, null);
    const alZero = await db.query("SELECT * FROM fleet_alerts WHERE fueling_log_id = $1 AND type='fuel_divergence'", [logZero.rows[0].id]);
    expect(alZero.rows.length).toBe(0);

    // deduplicação
    await evaluateFuelingLog(logHigh.rows[0].id, null);
    const alHighD = await db.query("SELECT * FROM fleet_alerts WHERE fueling_log_id = $1 AND type='fuel_divergence'", [logHigh.rows[0].id]);
    expect(alHighD.rows.length).toBe(1);

    // PUT config cache invalidation
    await request(app)
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${tokenManager}`)
      .send({ divergence_pct: 20, divergence_critical_pct: 30, offhours_start_hour: 22, offhours_end_hour: 5, offhours_enabled: 1 });
    
    // next evaluation 10% won't alert
    const logHigh2 = await db.query(`INSERT INTO fueling_logs (truck_id, driver_id, data_source, pump_liters, tank_liters_delta) VALUES ($1, $2, 'hardware', 100, 90) RETURNING id`, [truckId, driverId]);
    await evaluateFuelingLog(logHigh2.rows[0].id, null);
    const alHigh2 = await db.query("SELECT * FROM fleet_alerts WHERE fueling_log_id = $1 AND type='fuel_divergence'", [logHigh2.rows[0].id]);
    expect(alHigh2.rows.length).toBe(0); // 10% < 20%
  });

  it('3. evaluateFuelingLog off-hours logic', async () => {
    await db.query("UPDATE alert_settings SET value_num=1 WHERE key='offhours_enabled'");
    await db.query("UPDATE alert_settings SET value_num=22 WHERE key='offhours_start_hour'");
    await db.query("UPDATE alert_settings SET value_num=5 WHERE key='offhours_end_hour'");
    const { clearSettingsCache } = require('../src/services/fuelRules');
    clearSettingsCache();

    const checkLog = async (timeStr) => {
      const { rows } = await db.query("INSERT INTO fueling_logs (truck_id, driver_id, started_at) VALUES ($1, $2, $3) RETURNING id", [truckId, driverId, timeStr]);
      await evaluateFuelingLog(rows[0].id, null);
      const res = await db.query("SELECT * FROM fleet_alerts WHERE fueling_log_id = $1 AND type='fueling_off_hours'", [rows[0].id]);
      return res.rows.length;
    };

    expect(await checkLog('2023-01-02T02:00:00Z')).toBe(1); // 23h SP (UTC-3) => 02:00 UTC
    expect(await checkLog('2023-01-02T06:00:00Z')).toBe(1); // 03h SP => 06:00 UTC
    expect(await checkLog('2023-01-02T17:00:00Z')).toBe(0); // 14h SP => 17:00 UTC

    await db.query("UPDATE alert_settings SET value_num=8 WHERE key='offhours_start_hour'");
    await db.query("UPDATE alert_settings SET value_num=18 WHERE key='offhours_end_hour'");
    clearSettingsCache();

    expect(await checkLog('2023-01-02T11:00:00Z')).toBe(1); // 08h SP => 11:00 UTC
    expect(await checkLog('2023-01-02T21:00:00Z')).toBe(0); // 18h SP => 21:00 UTC
    expect(await checkLog('2023-01-02T13:00:00Z')).toBe(1); // 10h SP => 13:00 UTC
    
    await db.query("UPDATE alert_settings SET value_num=0 WHERE key='offhours_enabled'");
    clearSettingsCache();
    expect(await checkLog('2023-01-02T13:00:00Z')).toBe(0);
  });

  it('4. pump-reading newAlert and finishSession 200 on error', async () => {
    const io = { emit: jest.fn() };
    const req = { io, params: {}, body: { pump_liters: 100 }, actor: { type: 'hardware', id: truckId }, truck: { id: truckId } };
    const { rows: sessionRows } = await db.query(`INSERT INTO fueling_sessions (truck_id, status) VALUES ($1, 'completed') RETURNING id`, [truckId]);
    const sessionId = sessionRows[0].id;
    req.params.id = sessionId;
    
    await db.query(`INSERT INTO fueling_logs (truck_id, session_id, pump_liters, tank_liters_delta, data_source) VALUES ($1, $2, null, 70, 'hardware')`, [truckId, sessionId]);
    
    const { reportPumpReading, finishSession } = require('../src/controllers/fuelingController');
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    
    await reportPumpReading(req, res);
    expect(res.json).toHaveBeenCalled();
    expect(io.emit).toHaveBeenCalledWith('newAlert', expect.any(Object));

    const fuelRules = require('../src/services/fuelRules');
    const spy = jest.spyOn(fuelRules, 'evaluateFuelingLog').mockImplementation(() => { throw new Error('mock error'); });
    
    await db.query(`UPDATE fueling_sessions SET status = 'active' WHERE id = $1`, [sessionId]);
    req.actor.type = 'manager';
    
    res.json.mockClear();
    res.status.mockClear();
    
    await finishSession(req, res);
    
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(res.status).not.toHaveBeenCalledWith(500);
    spy.mockRestore();
  });

  it('5. settings history validation', async () => {
    // start by ensuring divergence_pct is 5
    await request(app).put('/api/settings/alerts').set('Authorization', `Bearer ${tokenManager}`)
      .send({ divergence_pct: 5, divergence_critical_pct: 15, offhours_start_hour: 22, offhours_end_hour: 5, offhours_enabled: 1 });
      
    await db.query('DELETE FROM alert_settings_history');

    // change 5 -> 7
    await request(app).put('/api/settings/alerts').set('Authorization', `Bearer ${tokenManager}`)
      .send({ divergence_pct: 7, divergence_critical_pct: 15, offhours_start_hour: 22, offhours_end_hour: 5, offhours_enabled: 1 });

    const hist1 = await request(app).get('/api/settings/alerts/history').set('Authorization', `Bearer ${tokenManager}`);
    expect(hist1.body.length).toBe(1);
    expect(hist1.body[0].key).toBe('divergence_pct');
    expect(parseFloat(hist1.body[0].old_value)).toBe(5);
    expect(parseFloat(hist1.body[0].new_value)).toBe(7);
    expect(hist1.body[0].changed_by).toBe('Gestor');

    // repeat 7 -> 7
    await request(app).put('/api/settings/alerts').set('Authorization', `Bearer ${tokenManager}`)
      .send({ divergence_pct: 7, divergence_critical_pct: 15, offhours_start_hour: 22, offhours_end_hour: 5, offhours_enabled: 1 });
      
    const hist2 = await request(app).get('/api/settings/alerts/history').set('Authorization', `Bearer ${tokenManager}`);
    expect(hist2.body.length).toBe(1); // No new line

    // restore to 5
    await request(app).put('/api/settings/alerts').set('Authorization', `Bearer ${tokenManager}`)
      .send({ divergence_pct: 5, divergence_critical_pct: 15, offhours_start_hour: 22, offhours_end_hour: 5, offhours_enabled: 1 });
  });

  it('6. GET /api/fueling?onlyDivergence=true', async () => {
    await request(app)
      .put('/api/settings/alerts')
      .set('Authorization', `Bearer ${tokenManager}`)
      .send({ divergence_pct: 5, divergence_critical_pct: 15, offhours_start_hour: 22, offhours_end_hour: 5, offhours_enabled: 1 });

    await db.query(`INSERT INTO fueling_logs (truck_id, driver_id, data_source, pump_liters, tank_liters_delta) VALUES ($1, $2, 'hardware', 100, 97)`, [truckId, driverId]);
    await db.query(`INSERT INTO fueling_logs (truck_id, driver_id, data_source, pump_liters, tank_liters_delta) VALUES ($1, $2, 'hardware', 100, 92)`, [truckId, driverId]);

    const res2 = await request(app)
      .get('/api/fueling?onlyDivergence=true')
      .set('Authorization', `Bearer ${tokenManager}`);
    
    expect(res2.status).toBe(200);
    const logs = res2.body;
    
    const log8 = logs.find(l => parseFloat(l.divergence_pct) > 7.9 && parseFloat(l.divergence_pct) < 8.1);
    const log3 = logs.find(l => parseFloat(l.divergence_pct) > 2.9 && parseFloat(l.divergence_pct) < 3.1);
    
    expect(log8).toBeDefined();
    expect(log3).toBeUndefined();
  });

  it('7. GET /api/reports/export?onlyDivergence=true (CSV)', async () => {
    // Relying on the data inserted in test 6
    const res = await request(app)
      .get('/api/reports/export?onlyDivergence=true')
      .set('Authorization', `Bearer ${tokenManager}`);
      
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    
    const csv = res.text;
    
    // Check that 8% divergence log is in CSV, but not 3% divergence log
    // Because CSV format strings differ, we search for '8.0' (since 100-92=8) and not '3.0'
    // But since there might be other values, we rely on the specific divergence format in reportsController
    expect(csv).toContain('8.00,8.00');
    expect(csv).not.toContain('3.00,3.00');
  });
});

