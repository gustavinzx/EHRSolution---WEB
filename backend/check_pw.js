const bcrypt = require('bcrypt');
const db = require('./src/config/db');
db.query('SELECT password_hash FROM users WHERE email = $1', ['gestor@ehr.com']).then(async r => {
  const hash = r.rows[0].password_hash;
  const match = await bcrypt.compare('Demo@1234', hash);
  console.log('Password match:', match);
  process.exit(0);
}).catch(console.error);
