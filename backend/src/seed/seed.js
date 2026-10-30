const db = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function seed() {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_SEED_WIPE !== 'true') {
    console.error('Seed falhou: Ambiente de produção detectado ou ALLOW_SEED_WIPE=true ausente.');
    if (require.main === module) {
      process.exit(1);
    }
    const err = new Error('Seed falhou: Ambiente de produção detectado ou ALLOW_SEED_WIPE=true ausente.');
    err.status = 1;
    throw err;
  }

  try {
    const { runMigrations } = require('../migrations/runner');
    await runMigrations();
    console.log('Schema created/verified via migrations.');

    // Wipe all previous demo data to prepare for REAL integration
    await db.query(`TRUNCATE users, drivers, trucks, driver_trucks, fuel_stations, fueling_logs, telemetry_logs, fleet_alerts, fueling_sessions, security_events, unloading_events RESTART IDENTITY CASCADE`);
    console.log('Database cleaned for real usage.');

    let adminPass = process.env.SEED_ADMIN_PASSWORD;
    let generatedAdmin = false;
    if (!adminPass || !String(adminPass).trim()) {
      adminPass = crypto.randomBytes(16).toString('hex');
      generatedAdmin = true;
    } else {
      adminPass = String(adminPass).trim();
    }

    let driverPass = process.env.SEED_DRIVER_PASSWORD;
    let generatedDriver = false;
    if (!driverPass || !String(driverPass).trim()) {
      driverPass = crypto.randomBytes(16).toString('hex');
      generatedDriver = true;
    } else {
      driverPass = String(driverPass).trim();
    }

    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash(adminPass, salt);
    const driverHash = await bcrypt.hash(driverPass, salt);

    // 1. Gestor
    await db.query(`
      INSERT INTO users (email, password_hash, name, role) 
      VALUES ('gestor@ehr.com', $1, 'Gestor Principal', 'admin')
      ON CONFLICT DO NOTHING
    `, [adminHash]);

    // 2. Motorista Real
    await db.query(`
      INSERT INTO drivers (name, phone, email, password_hash, is_active)
      VALUES ('João Silva', '11999990000', 'motorista@ehr.com', $1, true)
    `, [driverHash]);

    // 3. Caminhão Real (sem api_key fixa em texto puro)
    await db.query(`
      INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, lat, lng, status)
      VALUES ('EHR-0001', 'Volvo FH 540', 600.0, 300.0, -23.5505, -46.6333, 'ok')
    `);

    // 4. Vínculo Motorista-Caminhão
    await db.query(`
      INSERT INTO driver_trucks (driver_id, truck_id)
      VALUES (1, 1)
    `);

    // 5. Posto de Teste
    await db.query(`
      INSERT INTO fuel_stations (name, brand, lat, lng, active)
      VALUES ('Posto EHR Teste', 'BR', -23.5505, -46.6333, true)
    `);

    console.log('Seed Complete! Ready for Hardware Integration.');
    if (generatedAdmin || generatedDriver) {
      console.log('------------------------------------------------------------');
      console.log('[SEED] AVISO: Credenciais geradas automaticamente — troque após o primeiro acesso!');
      if (generatedAdmin) {
        console.log(`[SEED] Gestor (gestor@ehr.com): ${adminPass}`);
      }
      if (generatedDriver) {
        console.log(`[SEED] Motorista (motorista@ehr.com): ${driverPass}`);
      }
      console.log('------------------------------------------------------------');
    }

    if (require.main === module) {
      process.exit(0);
    }
  } catch (err) {
    console.error('Seed error:', err);
    if (require.main === module) {
      process.exit(1);
    }
    throw err;
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
