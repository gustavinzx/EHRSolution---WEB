const db = require('../config/db');

exports.list = async (req, res) => {
  // TODO: paginar se a frota crescer muito
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
  const { name, phone, email, truck } = req.body || {};
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'INSERT INTO drivers (name, phone, email) VALUES ($1, $2, $3) RETURNING *',
      [name, phone, email]
    );
    if (truck?.plate && truck?.model && Number(truck.capacity_liters) > 0) {
      const createdTruck = await client.query(`INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, status, sim_state, route_phase) VALUES ($1,$2,$3,$3,'ok','driving','planned') RETURNING id, plate, model, capacity_liters`, [String(truck.plate).trim().toUpperCase(), truck.model, Number(truck.capacity_liters)]);
      await client.query('INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1,$2)', [result.rows[0].id, createdTruck.rows[0].id]);
      result.rows[0].assigned_trucks = [createdTruck.rows[0]];
    }
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create driver error:', error);
    res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'A placa informada já está cadastrada' : 'Internal server error' });
  } finally { client.release();
  }
};

exports.update = async (req, res) => {
  // FIX 1.1: truck_id is NOT sent by DriverModal on edit — truck reassignment uses POST /:id/trucks.
  // Removing the stray DELETE FROM driver_trucks call that was referencing undeclared truck_id.
  try {
    const { id } = req.params;
    const { name, phone, email } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'O campo nome é obrigatório' });
    }

    const result = await db.query(
      'UPDATE drivers SET name = $1, phone = $2, email = $3 WHERE id = $4 RETURNING *',
      [name.trim(), phone || null, email || null, id]
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

exports.activate = async (req, res) => {
  try {
    const { rows } = await db.query('UPDATE drivers SET is_active = true WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Driver not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Activate driver error:', error);
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
    
    await db.query(
      'INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
      [id, truck_id]
    );
    
    res.status(201).json({ message: 'Truck assigned successfully' });
  } catch (error) {
    console.error('Assign truck error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const dataProvider = require('../services/fleetDataProvider');

exports.ranking = async (req, res) => {
  try {
    const ranking = await dataProvider.getDriverRanking();
    res.json(ranking);
  } catch (error) {
    console.error('Driver ranking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getScore = async (req, res) => {
  try {
    const score = await dataProvider.getDriverScore(req.params.id);
    res.json(score);
  } catch (error) {
    console.error('Driver score error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
