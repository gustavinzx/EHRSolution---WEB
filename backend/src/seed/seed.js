const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

async function seed() {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_SEED_WIPE !== 'true') {
    console.error('Seed falhou: Ambiente de produção detectado ou ALLOW_SEED_WIPE=true ausente.');
    process.exit(1);
  }

  try {
    const { runMigrations } = require('../migrations/runner');
    await runMigrations();
    console.log('Schema created/verified via migrations.');

    // Wipe all previous demo data to prepare for REAL integration
    await db.query(`TRUNCATE users, drivers, trucks, driver_trucks, fuel_stations, fueling_logs, telemetry_logs, fleet_alerts, fueling_sessions, security_events, unloading_events RESTART IDENTITY CASCADE`);
    console.log('Database cleaned for real usage.');

    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash('Demo@1234', salt);

    // 1. Gestor
    await db.query(`
      INSERT INTO users (email, password_hash, name) 
      VALUES ('gestor@ehr.com', $1, 'Gestor Principal')
      ON CONFLICT DO NOTHING
    `, [passHash]);

    // 2. Motorista Real
    await db.query(`
      INSERT INTO drivers (name, phone, email, password_hash, is_active)
      VALUES ('João Silva', '11999990000', 'motorista@ehr.com', $1, true)
    `, [passHash]);

    // 3. Caminhão Real (com api_key para o hardware)
    await db.query(`
      INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, lat, lng, status, api_key)
      VALUES ('EHR-0001', 'Volvo FH 540', 600.0, 300.0, -23.5505, -46.6333, 'ok', 'DEV_API_KEY_001')
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

    console.log('Production Base Seed Complete! Ready for Hardware Integration.');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
