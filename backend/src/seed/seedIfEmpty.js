const db = require('../config/db');
const bcrypt = require('bcrypt');

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
    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash('Demo@1234', salt);

    await db.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ('gestor@ehr.com', $1, 'Gestor Principal', 'admin')
       ON CONFLICT DO NOTHING`,
      [passHash]
    );

    const driverRes = await db.query(
      `INSERT INTO drivers (name, phone, email, password_hash, is_active)
       VALUES ('João Silva', '11999990000', 'motorista@ehr.com', $1, true)
       RETURNING id`,
      [passHash]
    );

    const truckRes = await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, lat, lng, status, api_key)
       VALUES ('EHR-0001', 'Volvo FH 540', 600.0, 300.0, -23.5505, -46.6333, 'ok', 'DEV_API_KEY_001')
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

    console.log('[AUTO-SEED] Dados iniciais criados com sucesso (gestor@ehr.com / motorista@ehr.com | Senha: Demo@1234).');
  } catch (err) {
    console.error('[AUTO-SEED] Erro ao verificar/popular banco:', err.message);
  }
}

module.exports = { seedIfEmpty };
