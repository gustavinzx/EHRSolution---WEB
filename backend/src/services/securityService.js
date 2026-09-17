const db = require('../config/db');

const ACTIVE_SESSION_MINUTES = 15;

async function ensureSecuritySchema() {
  await db.query(`
    ALTER TABLE fleet_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS fueling_sessions (
      id SERIAL PRIMARY KEY,
      truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
      driver_id INTEGER REFERENCES drivers(id),
      status VARCHAR(20) NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested','authorized','active','completed','expired','cancelled')),
      release_method VARCHAR(20) CHECK (release_method IN ('facial','ble_fallback')),
      requested_at TIMESTAMPTZ DEFAULT NOW(), authorized_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, expires_at TIMESTAMPTZ,
      metadata JSONB DEFAULT '{}'::jsonb
    );
    CREATE TABLE IF NOT EXISTS security_events (
      id SERIAL PRIMARY KEY,
      truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) NOT NULL DEFAULT 'high',
      source VARCHAR(30) NOT NULL DEFAULT 'device',
      payload JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function getTruck(truckId) {
  const { rows } = await db.query('SELECT id, plate, model FROM trucks WHERE id = $1', [truckId]);
  return rows[0] || null;
}

async function requestFuelingSession({ truckId, driverId }) {
  const truck = await getTruck(truckId);
  if (!truck) throw Object.assign(new Error('Truck not found'), { status: 404 });
  await db.query(`UPDATE fueling_sessions SET status = 'expired'
    WHERE truck_id = $1 AND status IN ('requested','authorized','active')
      AND expires_at IS NOT NULL AND expires_at < NOW()`, [truckId]);
  const { rows } = await db.query(`
    INSERT INTO fueling_sessions (truck_id, driver_id, status, expires_at)
    VALUES ($1, $2, 'requested', NOW() + INTERVAL '5 minutes') RETURNING *`, [truckId, driverId || null]);
  return rows[0];
}

async function authorizeFuelingSession(sessionId, releaseMethod = 'facial') {
  const { rows } = await db.query(`
    UPDATE fueling_sessions
    SET status = 'active', release_method = $2, authorized_at = NOW(), started_at = NOW(),
        expires_at = NOW() + INTERVAL '${ACTIVE_SESSION_MINUTES} minutes'
    WHERE id = $1 AND status = 'requested' RETURNING *`, [sessionId, releaseMethod]);
  if (!rows[0]) throw Object.assign(new Error('Fueling session is no longer available'), { status: 409 });
  await db.query(`UPDATE trucks SET sim_state = 'fueling', status = 'fueling' WHERE id = $1`, [rows[0].truck_id]);
  return rows[0];
}

async function finishFuelingSession(sessionId) {
  const { rows } = await db.query(`UPDATE fueling_sessions SET status = 'completed', completed_at = NOW()
    WHERE id = $1 AND status IN ('authorized','active') RETURNING *`, [sessionId]);
  if (!rows[0]) throw Object.assign(new Error('Active fueling session not found'), { status: 404 });
  return rows[0];
}

async function recordSecurityEvent({ truckId, type, severity, source = 'device', payload = {}, io }) {
  const truck = await getTruck(truckId);
  if (!truck) throw Object.assign(new Error('Truck not found'), { status: 404 });
  const criticalTypes = new Set(['tamper', 'unauthorized_movement', 'emergency_button', 'theft_signal']);
  const eventSeverity = severity || (criticalTypes.has(type) ? 'critical' : 'high');
  const { rows: events } = await db.query(`INSERT INTO security_events
    (truck_id, type, severity, source, payload) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [truckId, type, eventSeverity, source, JSON.stringify(payload)]);
  let alert = null;
  if (criticalTypes.has(type)) {
    const messageByType = {
      tamper: 'Violação física da trava detectada.',
      unauthorized_movement: 'Movimento detectado sem abastecimento autorizado.',
      emergency_button: 'Botão de emergência acionado.',
      theft_signal: 'Sinal de possível roubo recebido do dispositivo.'
    };
    const { rows } = await db.query(`INSERT INTO fleet_alerts
      (truck_id, type, severity, message, plate, model) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [truckId, `security_${type}`, eventSeverity, messageByType[type] || 'Evento de segurança detectado.', truck.plate, truck.model]);
    alert = rows[0];
    await db.query(`UPDATE trucks SET status = 'security_alert' WHERE id = $1`, [truckId]);
    if (io && alert) io.emit('newAlert', alert);
  }
  return { event: events[0], alert };
}

module.exports = {
  ensureSecuritySchema,
  requestFuelingSession,
  authorizeFuelingSession,
  finishFuelingSession,
  recordSecurityEvent
};
