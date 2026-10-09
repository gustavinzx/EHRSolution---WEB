const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Middleware flexível: aceita qualquer um dos papéis permitidos.
 *   - manager  → JWT do painel (role ausente ou 'manager')
 *   - driver   → JWT do app (role 'driver')
 *   - hardware → header x-api-key cadastrado em trucks.api_key
 *
 * Define req.actor = { type: 'manager'|'driver'|'hardware', id, ... }
 * e mantém compatibilidade com req.user / req.driver / req.truck.
 */
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
        return res.status(500).json({ error: 'Internal server error during authentication', detail: e.message });
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

    const role = decoded.role === 'driver' ? 'driver' : 'manager';
    if (role === 'driver' && !driver) return res.status(403).json({ error: 'Acesso negado para motoristas' });
    if (role === 'manager' && !manager) return res.status(403).json({ error: 'Acesso restrito ao app do motorista' });

    if (role === 'driver') {
      try {
        const { rows } = await db.query('SELECT is_active FROM drivers WHERE id = $1', [decoded.id]);
        if (!rows.length || !rows[0].is_active) return res.status(403).json({ error: 'driver_inactive' });
      } catch(e) {
        return res.status(500).json({ error: 'Internal server error during authentication', detail: e.message });
      }
      req.driver = decoded;
    }
    else req.user = decoded;
    req.actor = { type: role, id: decoded.id, email: decoded.email };
    next();
  };
}

module.exports = { allow };


