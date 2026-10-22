const db = require('../config/db');
const { detectFuelAnomalies } = require('../services/anomalyDetector');

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
    
    const { rows } = await db.query(
      `UPDATE fleet_alerts 
       SET resolved_at = NOW(), resolution_note = $1, resolved_by = $2
       WHERE id = $3 AND resolved_at IS NULL
       RETURNING *`,
      [resolution_note.trim(), resolved_by, id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Alerta não encontrado ou já resolvido" });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error("Resolve alert error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
