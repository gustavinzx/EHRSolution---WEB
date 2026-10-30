const db = require('../config/db');
const { clearSettingsCache } = require('../services/fuelRules');

exports.getAlertSettings = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT key, value_num FROM alert_settings');
    const settings = {};
    for (const row of rows) {
      settings[row.key] = parseFloat(row.value_num);
    }
    res.json(settings);
  } catch (err) {
    console.error('getAlertSettings error:', err);
    res.status(500).json({ error: "Erro ao buscar configurações" });
  }
};

exports.updateAlertSettings = async (req, res) => {
  try {
    const {
      divergence_pct, divergence_critical_pct, consumption_deviation_pct,
      offhours_start_hour, offhours_end_hour, offhours_enabled
    } = req.body;

    // Validações
    if ([divergence_pct, divergence_critical_pct].some(v => typeof v !== 'number' || v < 0.1 || v > 100)) {
      return res.status(400).json({ error: "Percentuais devem estar entre 0.1 e 100" });
    }
    if (consumption_deviation_pct !== undefined && (typeof consumption_deviation_pct !== 'number' || consumption_deviation_pct < 0.1 || consumption_deviation_pct > 100)) {
      return res.status(400).json({ error: "Percentuais devem estar entre 0.1 e 100" });
    }
    if (divergence_critical_pct <= divergence_pct) {
      return res.status(400).json({ error: "Divergência crítica deve ser maior que a atenção" });
    }
    if ([offhours_start_hour, offhours_end_hour].some(v => !Number.isInteger(v) || v < 0 || v > 23)) {
      return res.status(400).json({ error: "Horas devem ser inteiros entre 0 e 23" });
    }
    if (![0, 1].includes(offhours_enabled)) {
      return res.status(400).json({ error: "offhours_enabled deve ser 0 ou 1" });
    }

    const updatedBy = req.user.name || req.user.email || 'Sistema';

    const updates = {
      divergence_pct, divergence_critical_pct,
      offhours_start_hour, offhours_end_hour, offhours_enabled
    };
    if (consumption_deviation_pct !== undefined) updates.consumption_deviation_pct = consumption_deviation_pct;

    // Use transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      const keys = Object.keys(updates);
      if (keys.length > 0) {
        // lock existing rows
        const { rows: currentRows } = await client.query(
          `SELECT key, value_num FROM alert_settings WHERE key = ANY($1) FOR UPDATE`,
          [keys]
        );
        const currentMap = {};
        for (const r of currentRows) {
          currentMap[r.key] = parseFloat(r.value_num);
        }

        for (const [key, value] of Object.entries(updates)) {
          const newVal = parseFloat(value);
          const oldVal = currentMap[key];
          
          if (oldVal !== undefined && oldVal !== newVal) {
            await client.query(`
              UPDATE alert_settings 
              SET value_num = $1, updated_by = $2, updated_at = NOW() 
              WHERE key = $3
            `, [newVal, updatedBy, key]);
            
            await client.query(`
              INSERT INTO alert_settings_history (key, old_value, new_value, changed_by)
              VALUES ($1, $2, $3, $4)
            `, [key, oldVal, newVal, updatedBy]);
          }
        }
      }
      
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    clearSettingsCache();
    
    res.json({ success: true, message: "Configurações atualizadas com sucesso" });
  } catch (err) {
    console.error('updateAlertSettings error:', err);
    res.status(500).json({ error: "Erro ao atualizar configurações" });
  }
};




exports.getAlertSettingsHistory = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM alert_settings_history ORDER BY changed_at DESC LIMIT 100');
    res.json(rows);
  } catch (err) {
    console.error('getAlertSettingsHistory error:', err);
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
};
