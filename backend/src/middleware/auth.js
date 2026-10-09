const jwt = require('jsonwebtoken');
const db = require('../config/db');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined');
    }
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (decoded.role === 'driver') {
    return res.status(403).json({ error: 'Acesso restrito ao gestor' });
  }

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
    next();
  } catch (error) {
    console.error('Auth DB error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

authMiddleware.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden_role' });
    }
    next();
  };
};

module.exports = authMiddleware;
