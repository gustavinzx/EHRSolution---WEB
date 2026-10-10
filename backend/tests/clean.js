const db = require('../src/config/db');

module.exports = async () => {
  await db.query('DELETE FROM driver_trucks');
  await db.query('DELETE FROM fueling_logs');
  await db.query('DELETE FROM facial_attempts');
  await db.query('DELETE FROM security_events');
  await db.query('DELETE FROM fueling_sessions');
  await db.query('DELETE FROM fleet_alerts');
  await db.query('DELETE FROM alert_settings_history');
  await db.query('DELETE FROM trucks');
  await db.query('DELETE FROM fuel_stations');
  await db.query('DELETE FROM drivers');
  await db.query('DELETE FROM users');
};
