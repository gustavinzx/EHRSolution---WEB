const jwt = require('jsonwebtoken');
const db = require('../config/db');

const authDriver = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Driver Authorization token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not defined');
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired driver token' });
  }

  if (decoded.role !== 'driver') {
    return res.status(403).json({ error: 'Forbidden: Drivers only' });
  }

  try {
    const { rows } = await db.query('SELECT is_active FROM drivers WHERE id = $1', [decoded.id]);
    if (!rows.length || !rows[0].is_active) {
      return res.status(403).json({ error: 'driver_inactive' });
    }
  } catch(e) {
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }

  req.driver = decoded;
  next();
};

module.exports = authDriver;
