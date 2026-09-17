const bcrypt = require('bcrypt');
const db = require('./src/config/db');

async function resetPassword() {
  const hash = await bcrypt.hash('Demo@1234', 10);
  await db.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'gestor@ehr.com']);
  console.log('Password reset done. Verifying...');
  const r = await db.query('SELECT password_hash FROM users WHERE email = $1', ['gestor@ehr.com']);
  const match = await bcrypt.compare('Demo@1234', r.rows[0].password_hash);
  console.log('Verification:', match);
  process.exit(0);
}
resetPassword().catch(console.error);
