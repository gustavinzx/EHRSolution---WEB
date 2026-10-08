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
    if ([divergence_pct, divergence_critical_pct, consumption_deviation_pct].some(v => typeof v !== 'number' || v < 0.1 || v > 100)) {
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
      divergence_pct, divergence_critical_pct, consumption_deviation_pct,
      offhours_start_hour, offhours_end_hour, offhours_enabled
    };

    // Use transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const [key, value] of Object.entries(updates)) {
        await client.query(`
          UPDATE alert_settings 
          SET value_num = $1, updated_by = $2, updated_at = NOW() 
          WHERE key = $3
        `, [value, updatedBy, key]);
      }
      
      // Audit removed (requires truck_id)
      
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
