const db = require('../config/db');

function startRetentionRoutine() {
  if (process.env.NODE_ENV === 'test') return;
  
  const days = parseInt(process.env.FACIAL_ATTEMPTS_RETENTION_DAYS || '90', 10);
  
  const run = async () => {
    try {
      const { rowCount } = await db.query(
        "DELETE FROM facial_attempts WHERE created_at < NOW() - INTERVAL '1 day' * $1",
        [days]
      );
      if (rowCount > 0) {
        console.log(`[Retention] Deleted ${rowCount} old facial attempts.`);
      }
    } catch(e) {
      console.error('[Retention] Error deleting old facial attempts:', e.message);
    }
  };
  
  // run once at startup
  run();
  
  // run every 24h
  setInterval(run, 24 * 60 * 60 * 1000);
}

module.exports = { startRetentionRoutine };
