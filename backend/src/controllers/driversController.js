const db = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const faceProvider = require('../services/faceProvider');
const security = require('../services/securityService');
const { validateImageBase64 } = require('../services/imageValidation');
const dataProvider = require('../services/fleetDataProvider');
const { releaseTruckIfIdle } = require('../services/sessionRelease');

const safeDriver = (driver, actorRole) => {
  if (!driver) return driver;
  const isPanelUser = ['admin', 'manager', 'auditor'].includes(actorRole);
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
  };
  if (isPanelUser) {
    result.face_photo = driver.face_photo || null;
  }
  if (driver.assigned_trucks && Array.isArray(driver.assigned_trucks)) {
    result.assigned_trucks = driver.assigned_trucks.map(t => ({ id: t.id, plate: t.plate, model: t.model }));
  }
  return result;
};

exports.list = async (req, res) => {
  try {
    const { active } = req.query;
    let query = `
      SELECT d.id, d.name, d.phone, d.email, d.is_active, d.face_enrolled,
             d.face_consent_at, d.face_consent_version, d.created_at, d.face_photo,
             COALESCE(json_agg(json_build_object('id', t.id, 'plate', t.plate, 'model', t.model)) FILTER (WHERE t.id IS NOT NULL), '[]') as assigned_trucks
      FROM drivers d
      LEFT JOIN driver_trucks dt ON d.id = dt.driver_id
      LEFT JOIN trucks t ON dt.truck_id = t.id
      WHERE (d.status IS NULL OR d.status != 'deleted')
    `;
    const params = [];
    
    if (active !== undefined) {
      query += ` AND d.is_active = $1`;
      params.push(active === 'true');
    }
    
    query += ` GROUP BY d.id ORDER BY d.name ASC`;
    
    const { rows } = await db.query(query, params);
    res.json(rows.map(d => safeDriver(d, req.user?.role)));
  } catch (error) {
    console.error('List drivers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function processDriverTruckLink(client, driverId, { truck_id, new_truck }) {
  let assignedTrucks = [];

  if (new_truck && typeof new_truck === 'object' && new_truck.plate && new_truck.model) {
    const plateUpper = String(new_truck.plate).trim().toUpperCase();
    const modelTrim = String(new_truck.model).trim();
    const cap = parseFloat(new_truck.capacity_liters) || 500;

    // B2: Check if plate already exists. Never overwrite.
    const { rows: existingTruck } = await client.query(
      'SELECT id FROM trucks WHERE plate = $1',
      [plateUpper]
    );
    if (existingTruck.length > 0) {
      const err = new Error('Já existe um caminhão cadastrado com esta placa.');
      err.status = 409;
      throw err;
    }

    const { rows: trkIns } = await client.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, status, sim_state)
       VALUES ($1, $2, $3, $4, 'ok', 'idle')
       RETURNING id, plate, model`,
      [plateUpper, modelTrim, cap, cap]
    );
    if (trkIns.length > 0) {
      await client.query(
        'INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [driverId, trkIns[0].id]
      );
      assignedTrucks.push(trkIns[0]);
    }
  } else if (truck_id !== undefined && truck_id !== null && truck_id !== '') {
    // B3: Validate positive integer
    const parsedTruckId = Number(truck_id);
    if (!Number.isInteger(parsedTruckId) || parsedTruckId <= 0) {
      const err = new Error('truck_id inválido');
      err.status = 400;
      throw err;
    }

    // Check existence
    const { rows: trkRows } = await client.query(
      'SELECT id, plate, model FROM trucks WHERE id = $1',
      [parsedTruckId]
    );
    if (trkRows.length === 0) {
      const err = new Error('Caminhão não encontrado');
      err.status = 404;
      throw err;
    }

    await client.query(
      'INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [driverId, parsedTruckId]
    );
    assignedTrucks.push(trkRows[0]);
  } else if (truck_id === null || truck_id === 0) {
    await client.query('DELETE FROM driver_trucks WHERE driver_id = $1', [driverId]);
  }

  return assignedTrucks;
}

exports.create = async (req, res) => {
  const client = await db.pool.connect();
  let inTransaction = false;
  try {
    const { name, phone, email, password, truck_id, new_truck, auto_enroll_face } = req.body;
    
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'O campo nome é obrigatório' });
    }

    if (password !== undefined && password !== null && String(password).trim().length > 0) {
      if (String(password).trim().length < 8) {
        return res.status(400).json({ error: 'Senha deve ter ao menos 8 caracteres' });
      }
    }

    // B5 auto_enroll_face: defaults to false.
    let enrollFace = false;
    if (auto_enroll_face === true) {
      const provider = process.env.FACE_PROVIDER || 'mock';
      const isProduction = process.env.NODE_ENV === 'production';
      if (provider !== 'mock' || isProduction) {
        return res.status(400).json({ error: 'Cadastro facial automático disponível apenas em desenvolvimento' });
      }
      enrollFace = true;
    }

    const emailNorm = email && String(email).trim() ? String(email).trim().toLowerCase() : null;
    
    // B4 password
    let temporaryPassword = null;
    let rawPass;
    if (password && String(password).trim()) {
      rawPass = String(password).trim();
    } else {
      temporaryPassword = crypto.randomBytes(8).toString('hex');
      rawPass = temporaryPassword;
    }
    const password_hash = await bcrypt.hash(rawPass, 10);

    await client.query('BEGIN');
    inTransaction = true;

    const { rows } = await client.query(
      `INSERT INTO drivers (name, phone, email, password_hash, face_enrolled, face_consent_at, face_consent_version) 
       VALUES ($1, $2, $3, $4, $5, ${enrollFace ? 'NOW()' : 'NULL'}, ${enrollFace ? "'dev-mock'" : 'NULL'}) 
       RETURNING id, name, phone, email, is_active, face_enrolled, face_consent_at, face_consent_version, created_at, face_photo`,
      [name.trim(), phone || null, emailNorm, password_hash, enrollFace]
    );

    const newDriver = rows[0];
    if (enrollFace) {
      const templateRef = 'mock_template_' + newDriver.id;
      await client.query('UPDATE drivers SET face_template_ref = $1 WHERE id = $2', [templateRef, newDriver.id]);
      newDriver.face_template_ref = templateRef;
    }

    const assignedTrucks = await processDriverTruckLink(client, newDriver.id, { truck_id, new_truck });
    newDriver.assigned_trucks = assignedTrucks;

    await client.query('COMMIT');
    inTransaction = false;

    const response = safeDriver(newDriver, req.user?.role);
    if (temporaryPassword) {
      response.temporary_password = temporaryPassword;
    }
    res.status(201).json(response);
  } catch (error) {
    if (inTransaction) {
      await client.query('ROLLBACK').catch(() => {});
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    if (error.code === '23505') {
      if (error.constraint && error.constraint.includes('plate')) {
        return res.status(409).json({ error: 'Já existe um caminhão cadastrado com esta placa.' });
      }
      return res.status(409).json({ error: 'Dados duplicados já existentes no sistema.' });
    }
    console.error('Create driver error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

exports.update = async (req, res) => {
  const client = await db.pool.connect();
  let inTransaction = false;
  try {
    const { id } = req.params;
    const { name, phone, email, password, truck_id, new_truck, auto_enroll_face } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'O campo nome é obrigatório' });
    }

    if (password !== undefined && password !== null && String(password).trim().length > 0) {
      if (String(password).trim().length < 8) {
        return res.status(400).json({ error: 'Senha deve ter ao menos 8 caracteres' });
      }
    }

    if (auto_enroll_face === true) {
      const provider = process.env.FACE_PROVIDER || 'mock';
      const isProduction = process.env.NODE_ENV === 'production';
      if (provider !== 'mock' || isProduction) {
        return res.status(400).json({ error: 'Cadastro facial automático disponível apenas em desenvolvimento' });
      }
    }

    const emailNorm = email && String(email).trim() ? String(email).trim().toLowerCase() : null;

    await client.query('BEGIN');
    inTransaction = true;

    let result;
    if (password && String(password).trim()) {
      const password_hash = await bcrypt.hash(String(password).trim(), 10);
      result = await client.query(
        'UPDATE drivers SET name = $1, phone = $2, email = $3, password_hash = $4 WHERE id = $5 RETURNING id, name, phone, email, is_active, face_enrolled, face_consent_at, face_consent_version, created_at, face_photo',
        [name.trim(), phone || null, emailNorm, password_hash, id]
      );
    } else {
      result = await client.query(
        'UPDATE drivers SET name = $1, phone = $2, email = $3 WHERE id = $4 RETURNING id, name, phone, email, is_active, face_enrolled, face_consent_at, face_consent_version, created_at, face_photo',
        [name.trim(), phone || null, emailNorm, id]
      );
    }
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return res.status(404).json({ error: 'Driver not found' });
    }

    if (auto_enroll_face !== undefined) {
      if (auto_enroll_face) {
        await client.query(
          "UPDATE drivers SET face_enrolled=true, face_template_ref=COALESCE(face_template_ref, $1), face_consent_at=NOW(), face_consent_version='dev-mock' WHERE id=$2",
          ['mock_template_' + id, id]
        );
      } else {
        await client.query(
          "UPDATE drivers SET face_enrolled=false WHERE id=$1",
          [id]
        );
      }
    }

    await processDriverTruckLink(client, id, { truck_id, new_truck });

    const { rows: trkRows } = await client.query(`
      SELECT t.id, t.plate, t.model
      FROM driver_trucks dt
      JOIN trucks t ON dt.truck_id = t.id
      WHERE dt.driver_id = $1
    `, [id]);

    await client.query('COMMIT');
    inTransaction = false;

    const updatedDriver = { ...result.rows[0], assigned_trucks: trkRows };
    res.json(safeDriver(updatedDriver, req.user?.role));
  } catch (error) {
    if (inTransaction) {
      await client.query('ROLLBACK').catch(() => {});
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    if (error.code === '23505') {
      if (error.constraint && error.constraint.includes('plate')) {
        return res.status(409).json({ error: 'Já existe um caminhão cadastrado com esta placa.' });
      }
      return res.status(409).json({ error: 'Dados duplicados já existentes no sistema.' });
    }
    console.error('Update driver error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

exports.deactivate = async (req, res) => {
  const client = await db.pool.connect();
  let released = false;
  let committed = false;
  const release = () => { if (!released) { client.release(); released = true; } };
  
  try {
    const { id } = req.params;
    
    const { rows: drvs } = await client.query('SELECT face_template_ref, status FROM drivers WHERE id = $1', [id]);
    if (drvs.length === 0 || drvs[0].status === 'deleted') {
      release();
      return res.status(404).json({ error: 'Driver not found' });
    }
    const templateRef = drvs[0].face_template_ref;

    await client.query('BEGIN');
    
    const result = await client.query(
      'UPDATE drivers SET is_active = false, face_enrolled = false, face_template_ref = NULL WHERE id = $1 RETURNING id, name, phone, email, is_active, face_enrolled, face_consent_at, face_consent_version, created_at, face_photo',
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
      'UPDATE drivers SET face_enrolled=true, face_template_ref=$1, face_consent_at=NOW(), face_consent_version=$2, face_photo=$4 WHERE id=$3 RETURNING id, name, phone, email, is_active, face_enrolled, face_consent_at, face_consent_version, created_at, face_photo',
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
    
    res.json(safeDriver(result.rows[0], req.user?.role));
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
      'UPDATE drivers SET face_enrolled=false, face_template_ref=NULL, face_consent_at=NULL, face_consent_version=NULL, face_photo=NULL WHERE id=$1 RETURNING id, name, phone, email, is_active, face_enrolled, face_consent_at, face_consent_version, created_at, face_photo',
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
    
    res.json(safeDriver(result.rows[0], req.user?.role));
  } catch(error) {
    console.error('Remove face error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.activate = async (req, res) => {
  try {
    const { rows } = await db.query('UPDATE drivers SET is_active = true WHERE id = $1 RETURNING id, name, phone, email, is_active, face_enrolled, face_consent_at, face_consent_version, created_at, face_photo', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Driver not found' });
    res.json(safeDriver(rows[0], req.user?.role));
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
    
    await db.query('DELETE FROM driver_trucks WHERE driver_id = $1', [id]);
    await db.query(
      'INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING driver_id, truck_id, assigned_at',
      [id, truck_id]
    );
    
    res.status(201).json({ message: 'Truck assigned successfully' });
  } catch (error) {
    console.error('Assign truck error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.unassignTruck = async (req, res) => {
  try {
    const { id, truck_id } = req.params;
    await db.query(
      'DELETE FROM driver_trucks WHERE driver_id = $1 AND truck_id = $2',
      [id, truck_id]
    );
    res.json({ message: 'Truck unassigned successfully' });
  } catch (error) {
    console.error('Unassign truck error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteDriver = async (req, res) => {
  const client = await db.pool.connect();
  let inTransaction = false;
  try {
    const { id } = req.params;
    const { rows: drvs } = await client.query('SELECT face_template_ref, status FROM drivers WHERE id = $1', [id]);
    if (drvs.length === 0 || drvs[0].status === 'deleted') {
      return res.status(404).json({ error: 'Driver not found' });
    }
    const templateRef = drvs[0].face_template_ref;

    await client.query('BEGIN');
    inTransaction = true;

    await client.query('DELETE FROM driver_trucks WHERE driver_id = $1', [id]);
    await client.query("UPDATE driver_cards SET status = 'cancelled', card_holder = 'ANONIMIZADO' WHERE driver_id = $1", [id]);



    const anonymizedName = `Motorista Anonimizado #${id}`;
    const anonymizedEmail = `anonimizado_${id}@removido.local`;
    const scrambledPasswordHash = `DELETED_${crypto.randomBytes(32).toString('hex')}`;

    await client.query(`
      UPDATE drivers
      SET name = $1,
          email = $2,
          phone = NULL,
          password_hash = $3,
          face_photo = NULL,
          face_template_ref = NULL,
          face_enrolled = false,
          face_consent_at = NULL,
          face_consent_version = NULL,
          is_active = false,
          status = 'deleted',
          deleted_at = NOW()
      WHERE id = $4
    `, [anonymizedName, anonymizedEmail, scrambledPasswordHash, id]);

    await client.query('COMMIT');
    inTransaction = false;

    if (templateRef) {
      try {
        await faceProvider.remove(templateRef);
      } catch (e) {
        console.error('Failed to remove face template on provider:', e);
      }
    }

    res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    if (inTransaction) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error('Delete driver error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
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
