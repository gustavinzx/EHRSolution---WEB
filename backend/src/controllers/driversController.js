const db = require('../config/db');
const bcrypt = require('bcrypt');
const faceProvider = require('../services/faceProvider');
const security = require('../services/securityService');
const { validateImageBase64 } = require('../services/imageValidation');
const dataProvider = require('../services/fleetDataProvider');
const { releaseTruckIfIdle } = require('../services/sessionRelease');

const safeDriver = (driver) => {
  if (!driver) return driver;
  const result = {
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    email: driver.email,
    is_active: driver.is_active,
    face_enrolled: driver.face_enrolled,
    face_consent_at: driver.face_consent_at,
    face_consent_version: driver.face_consent_version,
    created_at: driver.created_at,
    truck_plate: driver.truck_plate,
    truck_model: driver.truck_model,
    face_photo: driver.face_photo || null
  };
  if (driver.assigned_trucks && Array.isArray(driver.assigned_trucks)) {
    result.assigned_trucks = driver.assigned_trucks.map(t => ({ id: t.id, plate: t.plate, model: t.model }));
  }
  return result;
};

exports.list = async (req, res) => {
  try {
    const { active } = req.query;
    let query = `
      SELECT d.*, 
             COALESCE(json_agg(t.*) FILTER (WHERE t.id IS NOT NULL), '[]') as assigned_trucks
      FROM drivers d
      LEFT JOIN driver_trucks dt ON d.id = dt.driver_id
      LEFT JOIN trucks t ON dt.truck_id = t.id
    `;
    const params = [];
    
    if (active !== undefined) {
      query += ` WHERE d.is_active = $1`;
      params.push(active === 'true');
    }
    
    query += ` GROUP BY d.id ORDER BY d.name ASC`;
    
    const { rows } = await db.query(query, params);
    res.json(rows.map(safeDriver));
  } catch (error) {
    console.error('List drivers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, phone, email, password, truck_id, new_truck, auto_enroll_face } = req.body;
    
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'O campo nome é obrigatório' });
    }

    const emailNorm = email && String(email).trim() ? String(email).trim().toLowerCase() : null;
    const rawPass = password && String(password).trim() ? String(password).trim() : 'Demo@1234';
    const password_hash = await bcrypt.hash(rawPass, 10);
    
    // Auto enrollment flag (defaults to true if not specified false)
    const enrollFace = auto_enroll_face !== false;
    const faceTemplate = enrollFace ? ('mock_template_' + Date.now()) : null;

    const { rows } = await db.query(
      `INSERT INTO drivers (name, phone, email, password_hash, face_enrolled, face_template_ref, face_consent_at, face_consent_version) 
       VALUES ($1, $2, $3, $4, $5, $6, ${enrollFace ? 'NOW()' : 'NULL'}, ${enrollFace ? "'v1.0'" : 'NULL'}) 
       RETURNING *`,
      [name.trim(), phone || null, emailNorm, password_hash, enrollFace, faceTemplate]
    );

    const newDriver = rows[0];
    let assignedTrucks = [];

    // Handle new truck creation if provided
    if (new_truck && new_truck.plate && new_truck.model) {
      const cap = parseFloat(new_truck.capacity_liters) || 500;
      const plateUpper = String(new_truck.plate).trim().toUpperCase();
      const modelTrim = String(new_truck.model).trim();
      const { rows: trkIns } = await db.query(
        `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, status, sim_state)
         VALUES ($1, $2, $3, $4, 'ok', 'idle')
         ON CONFLICT (plate) DO UPDATE SET model = EXCLUDED.model, capacity_liters = EXCLUDED.capacity_liters
         RETURNING id, plate, model`,
        [plateUpper, modelTrim, cap, cap]
      );
      if (trkIns.length > 0) {
        await db.query(
          'INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newDriver.id, trkIns[0].id]
        );
        assignedTrucks.push(trkIns[0]);
      }
    } else if (truck_id) {
      await db.query(
        'INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [newDriver.id, truck_id]
      );
      const { rows: trkRows } = await db.query('SELECT id, plate, model FROM trucks WHERE id = $1', [truck_id]);
      if (trkRows.length > 0) {
        assignedTrucks.push(trkRows[0]);
      }
    }

    newDriver.assigned_trucks = assignedTrucks;
    res.status(201).json(safeDriver(newDriver));
  } catch (error) {
    console.error('Create driver error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, password, truck_id, new_truck, auto_enroll_face } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'O campo nome é obrigatório' });
    }

    const emailNorm = email && String(email).trim() ? String(email).trim().toLowerCase() : null;

    let result;
    if (password && String(password).trim()) {
      const password_hash = await bcrypt.hash(String(password).trim(), 10);
      result = await db.query(
        'UPDATE drivers SET name = $1, phone = $2, email = $3, password_hash = $4 WHERE id = $5 RETURNING *',
        [name.trim(), phone || null, emailNorm, password_hash, id]
      );
    } else {
      result = await db.query(
        'UPDATE drivers SET name = $1, phone = $2, email = $3 WHERE id = $4 RETURNING *',
        [name.trim(), phone || null, emailNorm, id]
      );
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    if (auto_enroll_face !== undefined) {
      if (auto_enroll_face) {
        await db.query(
          "UPDATE drivers SET face_enrolled=true, face_template_ref=COALESCE(face_template_ref, $1), face_consent_at=NOW(), face_consent_version='v1.0' WHERE id=$2",
          ['mock_template_' + id, id]
        );
      } else {
        await db.query(
          "UPDATE drivers SET face_enrolled=false WHERE id=$1",
          [id]
        );
      }
    }

    if (new_truck && new_truck.plate && new_truck.model) {
      const cap = parseFloat(new_truck.capacity_liters) || 500;
      const plateUpper = String(new_truck.plate).trim().toUpperCase();
      const modelTrim = String(new_truck.model).trim();
      const { rows: trkIns } = await db.query(
        `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, status, sim_state)
         VALUES ($1, $2, $3, $4, 'ok', 'idle')
         ON CONFLICT (plate) DO UPDATE SET model = EXCLUDED.model, capacity_liters = EXCLUDED.capacity_liters
         RETURNING id, plate, model`,
        [plateUpper, modelTrim, cap, cap]
      );
      if (trkIns.length > 0) {
        await db.query(
          'INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, trkIns[0].id]
        );
      }
    } else if (truck_id) {
      await db.query(
        'INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id, truck_id]
      );
    }

    const { rows: trkRows } = await db.query(`
      SELECT t.id, t.plate, t.model
      FROM driver_trucks dt
      JOIN trucks t ON dt.truck_id = t.id
      WHERE dt.driver_id = $1
    `, [id]);

    const updatedDriver = { ...result.rows[0], assigned_trucks: trkRows };
    res.json(safeDriver(updatedDriver));
  } catch (error) {
    console.error('Update driver error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deactivate = async (req, res) => {
  const client = await db.pool.connect();
  let released = false;
  let committed = false;
  const release = () => { if (!released) { client.release(); released = true; } };
  
  try {
    const { id } = req.params;
    
    const { rows: drvs } = await client.query('SELECT face_template_ref FROM drivers WHERE id = $1', [id]);
    if (drvs.length === 0) {
      release();
      return res.status(404).json({ error: 'Driver not found' });
    }
    const templateRef = drvs[0].face_template_ref;

    await client.query('BEGIN');
    
    const result = await client.query(
      'UPDATE drivers SET is_active = false, face_enrolled = false, face_template_ref = NULL WHERE id = $1 RETURNING *',
      [id]
    );
    
    const { rows: openSessions } = await client.query(
      "UPDATE fueling_sessions SET status='cancelled' WHERE driver_id=$1 AND status IN ('requested', 'authorized', 'active') RETURNING id, truck_id",
      [id]
    );
    
    for (const sess of openSessions) {
      await releaseTruckIfIdle(sess.truck_id, client);
    }
    
    await security.recordSecurityEvent({
      truckId: null,
      type: 'driver_deactivated',
      severity: 'medium',
      source: 'manager',
      payload: { driver_id: id, cancelled_sessions: openSessions.length },
      io: req.io
    }, client);
    
    await client.query('COMMIT');
    committed = true;
    release();
    
    if (req.io && openSessions.length > 0) {
      // Require tardio (dentro da função) para evitar dependência circular com fuelingController
      const { emitSession, loadSession } = require('./fuelingController');
      for (const sess of openSessions) {
        try {
          const fullSession = await loadSession(sess.id);
          if (fullSession) emitSession(req, fullSession);
        } catch (err) {
          console.error("Emit error:", err);
        }
      }
    }
    
    if (templateRef) {
      try {
        await faceProvider.remove(templateRef);
      } catch (e) {
        console.error('Failed to remove face template on provider:', e);
      }
    }
    
    res.json(safeDriver(result.rows[0]));
  } catch (error) {
    if (!committed && !released) {
      try { await client.query('ROLLBACK'); } catch(e){}
    }
    release();
    console.error('Deactivate driver error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    release();
  }
};

exports.enrollFace = async (req, res) => {
  try {
    const { id } = req.params;
    const { image_base64, consent, consent_version } = req.body;
    
    if (consent !== true) return res.status(400).json({ error: 'consent is required' });
    if (!image_base64) return res.status(400).json({ error: 'image_base64 is required' });

    validateImageBase64(image_base64);

    const { rows: drv } = await db.query('SELECT face_template_ref FROM drivers WHERE id = $1', [id]);
    if (!drv.length) return res.status(404).json({ error: 'Driver not found' });
    const oldTemplate = drv[0].face_template_ref;
    
    const imageBuffer = Buffer.from(image_base64, 'base64');
    const { templateRef } = await faceProvider.enroll(id, imageBuffer);
    
    const formattedPhoto = image_base64.startsWith('data:') ? image_base64 : `data:image/jpeg;base64,${image_base64}`;
    const result = await db.query(
      'UPDATE drivers SET face_enrolled=true, face_template_ref=$1, face_consent_at=NOW(), face_consent_version=$2, face_photo=$4 WHERE id=$3 RETURNING *',
      [templateRef, consent_version || 'v1', id, formattedPhoto]
    );
    
    if (oldTemplate && oldTemplate !== templateRef) {
      try { await faceProvider.remove(oldTemplate); } catch(e) { console.error(e); }
    }
    
    await security.recordSecurityEvent({
      truckId: null,
      type: 'face_enrolled',
      severity: 'low',
      source: 'manager',
      payload: { driver_id: id },
      io: req.io
    });
    
    res.json(safeDriver(result.rows[0]));
  } catch(error) {
    console.error('Enroll face error:', error);
    if (error.status === 400) return res.status(400).json({ error: error.message });
    if (error.code === 'PROVIDER_NOT_CONFIGURED' || error.code === 'NOT_IMPLEMENTED') return res.status(503).json({ error: error.message });
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
      'UPDATE drivers SET face_enrolled=false, face_template_ref=NULL, face_consent_at=NULL, face_consent_version=NULL, face_photo=NULL WHERE id=$1 RETURNING *',
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
    
    res.json(safeDriver(result.rows[0]));
  } catch(error) {
    console.error('Remove face error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.activate = async (req, res) => {
  try {
    const { rows } = await db.query('UPDATE drivers SET is_active = true WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Driver not found' });
    res.json(safeDriver(rows[0]));
  } catch (error) {
    console.error('Activate driver error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.assignTruck = async (req, res) => {
  try {
    const { id } = req.params;
    const { truck_id } = req.body;
    
    const driverResult = await db.query('SELECT id FROM drivers WHERE id = $1', [id]);
    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

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
