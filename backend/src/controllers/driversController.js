const db = require('../config/db');

exports.list = async (req, res) => {
  try {
    const { active } = req.query;
    let query = `
      SELECT d.*, 
        json_agg(json_build_object('id', t.id, 'plate', t.plate, 'model', t.model)) FILTER (WHERE t.id IS NOT NULL) as assigned_trucks
      FROM drivers d
      LEFT JOIN driver_trucks dt ON d.id = dt.driver_id
      LEFT JOIN trucks t ON dt.truck_id = t.id
    `;
    
    const queryParams = [];
    if (active !== undefined) {
      query += ` WHERE d.is_active = $1`;
      queryParams.push(active === 'true');
    }

    query += ` GROUP BY d.id ORDER BY d.name ASC`;
    
    const result = await db.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('List drivers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    const result = await db.query(
      'INSERT INTO drivers (name, phone, email) VALUES ($1, $2, $3) RETURNING *',
      [name, phone, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create driver error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email } = req.body;
    
    const result = await db.query(
      'UPDATE drivers SET name = $1, phone = $2, email = $3 WHERE id = $4 RETURNING *',
      [name, phone, email, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update driver error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deactivate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'UPDATE drivers SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Deactivate driver error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.assignTruck = async (req, res) => {
  try {
    const { id } = req.params;
    const { truck_id } = req.body;
    
    // Check if driver exists
    const driverResult = await db.query('SELECT id FROM drivers WHERE id = $1', [id]);
    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Check if truck exists
    const truckResult = await db.query('SELECT id FROM trucks WHERE id = $1', [truck_id]);
    if (truckResult.rows.length === 0) {
      return res.status(404).json({ error: 'Truck not found' });
    }
    
    const result = await db.query(
      'INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
      [id, truck_id]
    );
    
    res.status(201).json({ message: 'Truck assigned successfully' });
  } catch (error) {
    console.error('Assign truck error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
