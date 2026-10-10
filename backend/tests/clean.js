const db = require('../src/config/db');

module.exports = async () => {
  if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
    throw new Error(`ABORT: clean.js was about to wipe database '${process.env.DB_NAME}', which does not end with '_test'`);
  }
  
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
