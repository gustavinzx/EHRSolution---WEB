const db = require('../config/db');
const { detectFuelAnomalies } = require('../services/anomalyDetector');
const { CRITICAL_ALERT_TYPES } = require('../services/securityService');
const fleetDataProvider = require('../services/fleetDataProvider');

// GET /api/alerts — return recent alerts (last 24h)
exports.list = async (req, res) => {
  try {
    let { truck_id, type, severity, status, start, end } = req.query;
    
    // Default status
    if (!status) status = 'active';

    // Validações
    if (truck_id && !/^\d+$/.test(truck_id)) {
      return res.status(400).json({ error: "truck_id deve ser um número inteiro válido." });
    }
    if (severity && !['low', 'medium', 'high', 'critical'].includes(severity)) {
      return res.status(400).json({ error: "severity inválida. Use low, medium, high ou critical." });
    }
    if (status && !['active', 'resolved', 'all'].includes(status)) {
      return res.status(400).json({ error: "status inválido. Use active, resolved ou all." });
    }
    if (start && isNaN(Date.parse(start))) {
      return res.status(400).json({ error: "start deve ser uma data válida." });
    }
    if (end && isNaN(Date.parse(end))) {
      return res.status(400).json({ error: "end deve ser uma data válida." });
    }

    let query = 'SELECT * FROM fleet_alerts WHERE 1=1';
    const params = [];
    let pIdx = 1;

    if (truck_id) { query += ` AND truck_id = $${pIdx++}`; params.push(parseInt(truck_id)); }
    if (type) { query += ` AND type = $${pIdx++}`; params.push(type); }
    if (severity) { query += ` AND severity = $${pIdx++}`; params.push(severity); }
    
    if (status === 'resolved') { query += ` AND resolved_at IS NOT NULL`; }
    else if (status === 'active') { query += ` AND resolved_at IS NULL`; }

    if (start) { query += ` AND created_at >= $${pIdx++}`; params.push(new Date(start).toISOString()); }
    if (end) { query += ` AND created_at <= $${pIdx++}`; params.push(new Date(end).toISOString()); }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('List alerts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.resolve = async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    const { resolution_note } = req.body;
    
    // Validar nota de resolução
    if (!resolution_note || resolution_note.trim().length < 5) {
      return res.status(400).json({ error: "A nota de resolução deve ter pelo menos 5 caracteres." });
    }

    // Identificar gestor a partir do token (authMiddleware)
    if (!req.user) {
      return res.status(401).json({ error: "Usuário não autenticado." });
    }
    const resolved_by = req.user.name || req.user.email;

    // Resolução do alerta + restauração do status do caminhão na MESMA transação,
    // para nunca existir janela com o alerta resolvido e o caminhão ainda em 'security_alert'.
    client = await db.pool.connect();
    await client.query('BEGIN');

    // Trava a linha do caminhão antes de resolver: resoluções simultâneas de alertas do
    // mesmo caminhão são serializadas e a checagem "resta alerta crítico aberto?" é confiável.
    const { rows: target } = await client.query(
      `SELECT truck_id, type FROM fleet_alerts WHERE id = $1 AND resolved_at IS NULL`,
      [id]
    );
    if (target.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Alerta não encontrado ou já resolvido" });
    }
    const isCritical = CRITICAL_ALERT_TYPES.includes(target[0].type);
    if (isCritical && target[0].truck_id) {
      await client.query('SELECT id FROM trucks WHERE id = $1 FOR UPDATE', [target[0].truck_id]);
    }

    const { rows } = await client.query(
      `UPDATE fleet_alerts 
       SET resolved_at = NOW(), resolution_note = $1, resolved_by = $2
       WHERE id = $3 AND resolved_at IS NULL
       RETURNING *`,
      [resolution_note.trim(), resolved_by, id]
    );
    
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Alerta não encontrado ou já resolvido" });
    }

    let truckRestored = false;
    if (isCritical && rows[0].truck_id) {
      const { rowCount } = await client.query(
        `UPDATE trucks SET status = 'ok'
          WHERE id = $1 AND status = 'security_alert'
            AND NOT EXISTS (
              SELECT 1 FROM fleet_alerts a
               WHERE a.truck_id = trucks.id AND a.resolved_at IS NULL AND a.type = ANY($2::text[])
            )`,
        [rows[0].truck_id, CRITICAL_ALERT_TYPES]
      );
      truckRestored = rowCount > 0;
    }

    await client.query('COMMIT');

    // Mesmo evento que o painel já usa para atualizar os caminhões (a etiqueta some sem recarregar)
    if (truckRestored && req.io) {
      try {
        req.io.emit('fleetUpdate', await fleetDataProvider.getFleetSnapshot());
      } catch (emitErr) {
        console.error('Emit fleetUpdate after resolve error:', emitErr.message);
      }
    }
    
    res.json(rows[0]);
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) { /* transação já encerrada */ }
    }
    console.error("Resolve alert error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (client) client.release();
  }
};
