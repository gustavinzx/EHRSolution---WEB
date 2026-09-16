const db = require('../config/db');

exports.list = async (req, res) => {
  try {
    const { truck_id, driver_id, start, end } = req.query;
    
    let query = `
      SELECT fl.*, 
             d.name as driver_name, 
             t.plate as truck_plate, t.model as truck_model
      FROM fueling_logs fl
      LEFT JOIN drivers d ON fl.driver_id = d.id
      LEFT JOIN trucks t ON fl.truck_id = t.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    if (truck_id) {
      query += ` AND fl.truck_id = $${paramIndex}`;
      queryParams.push(truck_id);
      paramIndex++;
    }
    
    if (driver_id) {
      query += ` AND fl.driver_id = $${paramIndex}`;
      queryParams.push(driver_id);
      paramIndex++;
    }
    
    if (start) {
      query += ` AND fl.timestamp >= $${paramIndex}`;
      queryParams.push(start);
      paramIndex++;
    }
    
    if (end) {
      query += ` AND fl.timestamp <= $${paramIndex}`;
      queryParams.push(end);
      paramIndex++;
    }
    
    query += ` ORDER BY fl.timestamp DESC LIMIT 100`;
    
    const result = await db.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('List fueling logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
