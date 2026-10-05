const db = require('../config/db');

const authHardware = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Hardware API Key missing' });
  }

  try {
    const { rows } = await db.query('SELECT id, plate FROM trucks WHERE api_key = $1', [apiKey]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid Hardware API Key' });
    }
    
    // Attach the truck object to request
    req.truck = rows[0];
    next();
  } catch (error) {
    console.error('Hardware Auth Error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

module.exports = authHardware;
