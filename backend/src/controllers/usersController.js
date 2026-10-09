const bcrypt = require('bcrypt');
const db = require('../config/db');
const security = require('../services/securityService');

const safeUser = (u) => {
  if (!u) return u;
  const { password_hash, ...safe } = u;
  return safe;
};

exports.list = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY id ASC');
    res.json(rows.map(safeUser));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    const exist = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exist.rows.length > 0) return res.status(409).json({ error: 'Email already exists' });
    
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, hash, role]
    );
    
    await security.recordSecurityEvent({
      truckId: null,
      type: 'user_created',
      severity: 'high',
      source: 'manager',
      payload: { user_id: rows[0].id, role },
      io: req.io
    });
    
    res.status(201).json(safeUser(rows[0]));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.update = async (req, res) => {
  const client = await db.pool.connect();
  let released = false;
  const release = () => { if(!released){ client.release(); released=true; } };
  try {
    const { id } = req.params;
    const { role, is_active } = req.body;
    
    await client.query('BEGIN');
    
    const currRes = await client.query('SELECT role, is_active FROM users WHERE id = $1 FOR UPDATE', [id]);
    if (currRes.rows.length === 0) {
      release();
      return res.status(404).json({ error: 'User not found' });
    }
    const curr = currRes.rows[0];
    
    if (curr.role === 'admin' && (role !== 'admin' || is_active === false)) {
      const adminCount = await client.query("SELECT count(*) FROM users WHERE role = 'admin' AND is_active = true");
      if (parseInt(adminCount.rows[0].count) <= 1) {
        await client.query('ROLLBACK');
        release();
        return res.status(409).json({ error: 'Cannot demote or deactivate the last admin' });
      }
    }
    
    let updates = [];
    let vals = [];
    let idx = 1;
    if (role) { updates.push(`role = $${idx++}`); vals.push(role); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); vals.push(is_active); }
    
    if (updates.length === 0) {
      await client.query('ROLLBACK');
      release();
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    vals.push(id);
    const { rows } = await client.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    
    await security.recordSecurityEvent({
      truckId: null,
      type: 'user_updated',
      severity: 'high',
      source: 'manager',
      payload: { user_id: id, role, is_active },
      io: req.io
    }, client);
    
    await client.query('COMMIT');
    res.json(safeUser(rows[0]));
  } catch (error) {
    await client.query('ROLLBACK').catch(e=>{});
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    release();
  }
};
