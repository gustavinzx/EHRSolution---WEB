const fs = require('fs');
let c = fs.readFileSync('backend/src/controllers/fuelingController.js', 'utf8');
c = c.replace(/async function authorizeAndUnlock\([\s\S]*?RETURNING \*\`,/m, `async function authorizeAndUnlock(sessionId, releaseMethod, extraMeta = {}) {
  const { rows } = await db.query(
    \`UPDATE fueling_sessions
        SET status='authorized', authorized_at=NOW(), release_method=$2,
            facial_consumed_at = CASE WHEN $2 = 'facial' THEN NOW() ELSE facial_consumed_at END,
            expires_at = NOW() + INTERVAL '\${SESSION_TTL_MIN} minutes',
            metadata = COALESCE(metadata,'{}'::jsonb) || $3::jsonb
      WHERE id=$1 AND status IN ('requested') RETURNING *\`,`);
fs.writeFileSync('backend/src/controllers/fuelingController.js', c);
