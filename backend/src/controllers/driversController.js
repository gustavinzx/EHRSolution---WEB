const db = require('../config/db');

exports.list = async (req, res) => {
  try {
    const { active } = req.query;
    let query = `
      SELECT 
        d.*, 
        json_agg(DISTINCT jsonb_build_object('id', t.id, 'plate', t.plate, 'model', t.model)) FILTER (WHERE t.id IS NOT NULL) as assigned_trucks,
        (SELECT COUNT(*) FROM fueling_logs f WHERE f.driver_id = d.id) as fueling_count,
        (SELECT COALESCE(SUM(volume_liters), 0) FROM fueling_logs f WHERE f.driver_id = d.id) as fueling_volume
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

const faceProvider = require('../services/faceProvider');
const security = require('../services/securityService');

exports.deactivate = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    
    // fetch driver face_template_ref before transaction if we need to remove it
    const { rows: drvs } = await client.query('SELECT face_template_ref FROM drivers WHERE id = $1', [id]);
    if (drvs.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Driver not found' });
    }
    const templateRef = drvs[0].face_template_ref;

    await client.query('BEGIN');
    
    const result = await client.query(
      'UPDATE drivers SET is_active = false, face_enrolled = false, face_template_ref = NULL WHERE id = $1 RETURNING *',
      [id]
    );
    
    // Cancel open sessions
    const { rows: openSessions } = await client.query(
      "UPDATE fueling_sessions SET status='cancelled' WHERE driver_id=$1 AND status IN ('requested', 'authorized', 'active') RETURNING id",
      [id]
    );
    
    // Cancel them using the proper mechanism (metadata update can be done if needed, but simple update is fine, we must also emit if we have io)
    for (const sess of openSessions) {
      if (req.io) {
        // we emit update
        req.io.emit('fuelingSessionUpdate', { id: sess.id, status: 'cancelled' });
      }
    }
    
    // Security event
    await security.recordSecurityEvent({
      truckId: null,
      type: 'driver_deactivated',
      severity: 'medium',
      source: 'manager',
      payload: { driver_id: id, cancelled_sessions: openSessions.length },
      io: req.io
    }, client);
    
    await client.query('COMMIT');
    client.release();
    
    if (templateRef) {
      try {
        await faceProvider.remove(templateRef);
      } catch (e) {
        console.error('Failed to remove face template on provider:', e);
      }
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Deactivate driver error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.enrollFace = async (req, res) => {
  try {
    const { id } = req.params;
    const { image_base64, consent, consent_version } = req.body;
    
    if (consent !== true) return res.status(400).json({ error: 'consent is required' });
    if (!image_base64) return res.status(400).json({ error: 'image_base64 is required' });

    const { rows: drv } = await db.query('SELECT face_template_ref FROM drivers WHERE id = $1', [id]);
    if (!drv.length) return res.status(404).json({ error: 'Driver not found' });
    
    if (drv[0].face_template_ref) {
      try { await faceProvider.remove(drv[0].face_template_ref); } catch(e) { console.error(e); }
    }
    
    const imageBuffer = Buffer.from(image_base64, 'base64');
    const { templateRef } = await faceProvider.enroll(id, imageBuffer);
    
    const result = await db.query(
      'UPDATE drivers SET face_enrolled=true, face_template_ref=$1, face_consent_at=NOW(), face_consent_version=$2 WHERE id=$3 RETURNING *',
      [templateRef, consent_version || 'v1', id]
    );
    
    await security.recordSecurityEvent({
      truckId: null,
      type: 'face_enrolled',
      severity: 'low',
      source: 'manager',
      payload: { driver_id: id },
      io: req.io
    });
    
    res.json(result.rows[0]);
  } catch(error) {
    console.error('Enroll face error:', error);
    if (error.code === 'PROVIDER_NOT_CONFIGURED') return res.status(503).json({ error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.removeFace = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: drv } = await db.query('SELECT face_template_ref FROM drivers WHERE id = $1', [id]);
    if (!drv.length) return res.status(404).json({ error: 'Driver not found' });
    
    if (drv[0].face_template_ref) {
      try { await faceProvider.remove(drv[0].face_template_ref); } catch(e) { console.error(e); }
    }
    
    const result = await db.query(
      'UPDATE drivers SET face_enrolled=false, face_template_ref=NULL, face_consent_at=NULL, face_consent_version=NULL WHERE id=$1 RETURNING *',
      [id]
    );
    
    await security.recordSecurityEvent({
      truckId: null,
      type: 'face_revoked',
      severity: 'low',
      source: 'manager',
      payload: { driver_id: id },
      io: req.io
    });
    
    res.json(result.rows[0]);
  } catch(error) {
    console.error('Remove face error:', error);
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

