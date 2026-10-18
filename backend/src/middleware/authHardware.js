const crypto = require('crypto');
const db = require('../config/db');

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(Buffer.from(String(apiKey), 'utf8')).digest('hex');
}

const authHardware = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(401).json({ error: 'Hardware API Key missing' });
  }

  if (apiKey.length > 200) {
    return res.status(401).json({ error: 'Invalid Hardware API Key' });
  }

  try {
    const keyHash = hashApiKey(apiKey);
    const { rows } = await db.query('SELECT id, plate FROM trucks WHERE api_key_hash = $1', [keyHash]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid Hardware API Key' });
    }

    try {
      await db.query(
        `UPDATE trucks
         SET api_key_last_used_at = NOW()
         WHERE id = $1
           AND (api_key_last_used_at IS NULL OR api_key_last_used_at < NOW() - INTERVAL '1 minute')`,
        [rows[0].id]
      );
    } catch (updateErr) {
      console.error('Failed to update api_key_last_used_at:', updateErr.message);
    }

    req.truck = rows[0];
    next();
  } catch (error) {
    console.error('Hardware Auth Error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

authHardware.hashApiKey = hashApiKey;

module.exports = authHardware;
