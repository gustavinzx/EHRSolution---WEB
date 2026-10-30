const db = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function seedIfEmpty() {
  if (process.env.NODE_ENV === 'production' || process.env.AUTO_SEED_IF_EMPTY !== 'true') {
    return;
  }
  try {
    const { rows } = await db.query('SELECT COUNT(*)::int AS cnt FROM users');
    if (rows[0] && rows[0].cnt > 0) {
      console.log('[AUTO-SEED] Banco já possui usuários cadastrados. Mantendo dados existentes.');
      return;
    }

    console.log('[AUTO-SEED] Banco vazio detectado — populando dados iniciais para homologação...');

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

    await db.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ('gestor@ehr.com', $1, 'Gestor Principal', 'admin')
       ON CONFLICT DO NOTHING`,
      [adminHash]
    );

    const driverRes = await db.query(
      `INSERT INTO drivers (name, phone, email, password_hash, is_active)
       VALUES ('João Silva', '11999990000', 'motorista@ehr.com', $1, true)
       RETURNING id`,
      [driverHash]
    );

    const truckRes = await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, lat, lng, status)
       VALUES ('EHR-0001', 'Volvo FH 540', 600.0, 300.0, -23.5505, -46.6333, 'ok')
       RETURNING id`
    );

    if (driverRes.rows[0] && truckRes.rows[0]) {
      await db.query(
        `INSERT INTO driver_trucks (driver_id, truck_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [driverRes.rows[0].id, truckRes.rows[0].id]
      );
    }

    await db.query(
      `INSERT INTO fuel_stations (name, brand, lat, lng, active)
       VALUES ('Posto EHR Teste', 'BR', -23.5505, -46.6333, true)`
    );

    console.log('[AUTO-SEED] Dados iniciais criados com sucesso.');
    if (generatedAdmin || generatedDriver) {
      console.log('------------------------------------------------------------');
      console.log('[AUTO-SEED] AVISO: Credenciais geradas automaticamente — troque após o primeiro acesso!');
      if (generatedAdmin) {
        console.log(`[AUTO-SEED] Gestor (gestor@ehr.com): ${adminPass}`);
      }
      if (generatedDriver) {
        console.log(`[AUTO-SEED] Motorista (motorista@ehr.com): ${driverPass}`);
      }
      console.log('------------------------------------------------------------');
    }
  } catch (err) {
    console.error('[AUTO-SEED] Erro ao verificar/popular banco:', err.message);
  }
}

module.exports = { seedIfEmpty };
