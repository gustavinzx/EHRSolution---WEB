const crypto = require('crypto');
const db = require('../config/db');

const failedIpBuckets = new Map();
const deviceBuckets = new Map();

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(Buffer.from(String(apiKey), 'utf8')).digest('hex');
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getMaxFailures() {
  const val = Number(process.env.HARDWARE_AUTH_MAX_FAILURES);
  return Number.isFinite(val) && val > 0 ? val : 20;
}

function getFailureWindowMs() {
  const val = Number(process.env.HARDWARE_AUTH_WINDOW_MS);
  return Number.isFinite(val) && val > 0 ? val : 15 * 60 * 1000;
}

function getDeviceMaxPerMin() {
  const val = Number(process.env.HARDWARE_RATE_LIMIT_PER_MIN);
  return Number.isFinite(val) && val > 0 ? val : 120;
}

function isIpBlocked(ip) {
  const now = Date.now();
  const entry = failedIpBuckets.get(ip);
  if (!entry) return false;
  if (now >= entry.resetAt) {
    failedIpBuckets.delete(ip);
    return false;
  }
  return entry.count >= getMaxFailures();
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const windowMs = getFailureWindowMs();
  const entry = failedIpBuckets.get(ip);
  if (!entry || now >= entry.resetAt) {
    failedIpBuckets.set(ip, { count: 1, resetAt: now + windowMs });
  } else {
    entry.count += 1;
  }
}

function checkDeviceRateLimit(keyHash) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxPerMin = getDeviceMaxPerMin();
  const entry = deviceBuckets.get(keyHash);
  if (!entry || now >= entry.resetAt) {
    deviceBuckets.set(keyHash, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxPerMin) {
    return false;
  }
  entry.count += 1;
  return true;
}

function resetRateLimits() {
  failedIpBuckets.clear();
  deviceBuckets.clear();
}

async function authenticateHardwareRequest(req, res) {
  const ip = getClientIp(req);
  if (isIpBlocked(ip)) {
    res.status(429).json({ error: 'Too many invalid hardware authentication attempts. Try again later.' });
    return null;
  }

  const apiKey = req.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    recordFailedAttempt(ip);
    res.status(401).json({ error: 'Hardware API Key missing' });
    return null;
  }

  if (apiKey.length > 200) {
    recordFailedAttempt(ip);
    res.status(401).json({ error: 'Invalid Hardware API Key' });
    return null;
  }

  try {
    const keyHash = hashApiKey(apiKey);
    const { rows } = await db.query('SELECT id, plate FROM trucks WHERE api_key_hash = $1', [keyHash]);
    if (rows.length === 0) {
      recordFailedAttempt(ip);
      res.status(401).json({ error: 'Invalid Hardware API Key' });
      return null;
    }

    if (!checkDeviceRateLimit(keyHash)) {
      res.status(429).json({ error: 'Hardware device rate limit exceeded. Try again in a moment.' });
      return null;
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

    return rows[0];
  } catch (error) {
    console.error('Hardware Auth Error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
    return null;
  }
}

const authHardware = async (req, res, next) => {
  const truck = await authenticateHardwareRequest(req, res);
  if (!truck) return;
  req.truck = truck;
  next();
};

authHardware.hashApiKey = hashApiKey;
authHardware.authenticateHardwareRequest = authenticateHardwareRequest;
authHardware.resetRateLimits = resetRateLimits;

module.exports = authHardware;

