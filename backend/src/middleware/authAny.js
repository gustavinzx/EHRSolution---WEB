const jwt = require('jsonwebtoken');
const db = require('../config/db');

function allow({ manager = false, driver = false, hardware = false } = {}) {
  return async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const authHeader = req.headers.authorization;

    if (hardware && apiKey) {
      try {
        const { rows } = await db.query('SELECT id, plate FROM trucks WHERE api_key = $1', [apiKey]);
        if (!rows.length) return res.status(401).json({ error: 'Invalid Hardware API Key' });
        req.truck = rows[0];
        req.actor = { type: 'hardware', id: rows[0].id, plate: rows[0].plate };
        return next();
      } catch (err) {
        console.error('Hardware Auth Error:', err);
        return res.status(500).json({ error: 'Internal server error during authentication' });
      }
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token missing or invalid' });
    }

    let decoded;
    try {
      if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not defined');
      decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const tokenRole = decoded.role || 'manager';
    const isDriver = tokenRole === 'driver';
    const isDashboard = !isDriver;

    if (isDriver && !driver) return res.status(403).json({ error: 'Acesso negado para motoristas' });
    if (isDashboard && !manager) return res.status(403).json({ error: 'Acesso restrito ao app do motorista' });

    if (isDriver) {
      try {
        const { rows } = await db.query('SELECT is_active FROM drivers WHERE id = $1', [decoded.id]);
        if (!rows.length || !rows[0].is_active) return res.status(403).json({ error: 'driver_inactive' });
      } catch(e) {
        return res.status(500).json({ error: 'Internal server error during authentication' });
      }
      req.driver = decoded;
      req.actor = { type: 'driver', id: decoded.id, email: decoded.email };
      return next();
    } else {
      try {
        const { rows } = await db.query('SELECT is_active, role FROM users WHERE id = $1', [decoded.id]);
        if (rows.length === 0) return res.status(401).json({ error: 'User not found' });
        if (!rows[0].is_active) return res.status(401).json({ error: 'User is deactivated' });
        const actualRole = rows[0].role;
        
        if (actualRole === 'auditor' && req.method !== 'GET') {
          return res.status(403).json({ error: 'forbidden_role' });
        }
        
        req.user = { ...decoded, role: actualRole };
        req.actor = { type: 'manager', id: decoded.id, email: decoded.email };
        return next();
      } catch (e) {
        return res.status(500).json({ error: 'Internal server error during authentication' });
      }
    }
  };
}

module.exports = { allow };
