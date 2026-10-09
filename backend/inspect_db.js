const db = require('./src/config/db');
async function run() {
  const { rows } = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'drivers'");
  console.log(rows);
  process.exit(0);
}
run();
