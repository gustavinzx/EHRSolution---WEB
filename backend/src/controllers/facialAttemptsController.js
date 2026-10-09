const db = require('../config/db');

exports.list = async (req, res) => {
  try {
    const { page = 1, limit = 20, driver_id, truck_id, success, start, end } = req.query;
    const l = Math.min(parseInt(limit, 10), 100);
    const p = Math.max(parseInt(page, 10), 1);
    const offset = (p - 1) * l;
    
    let where = [];
    let params = [];
    let pIdx = 1;

    if (driver_id) { where.push("a.driver_id = $" + pIdx++); params.push(driver_id); }
    if (truck_id) { where.push("a.truck_id = $" + pIdx++); params.push(truck_id); }
    if (success !== undefined) { where.push("a.success = $" + pIdx++); params.push(success === 'true'); }
    
    if (start) {
      if (isNaN(new Date(start).getTime())) return res.status(400).json({ error: 'Data de início inválida' });
      where.push("a.created_at >= $" + pIdx++); params.push(start);
    }
    if (end) {
      if (isNaN(new Date(end).getTime())) return res.status(400).json({ error: 'Data de fim inválida' });
      where.push("a.created_at <= $" + pIdx++); params.push(end);
    }

    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
    
    const countRes = await db.query("SELECT COUNT(*) FROM facial_attempts a " + whereStr, params);
    const total = parseInt(countRes.rows[0].count, 10);
    
    const query = "SELECT a.*, d.name as driver_name, t.plate as truck_plate " +
                  "FROM facial_attempts a " +
                  "LEFT JOIN drivers d ON a.driver_id = d.id " +
                  "LEFT JOIN trucks t ON a.truck_id = t.id " +
                  whereStr +
                  " ORDER BY a.created_at DESC " +
                  "LIMIT $" + pIdx++ + " OFFSET $" + pIdx++;
    
    params.push(l, offset);
    
    const { rows } = await db.query(query, params);
    res.json({
      data: rows,
      meta: { total, page: p, limit: l, totalPages: Math.ceil(total / l) }
    });
  } catch(error) {
    console.error('List facial attempts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
