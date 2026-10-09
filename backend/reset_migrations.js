const db = require('./src/config/db');
async function run() {
  await db.query('DELETE FROM migrations;');
  console.log("Migrations table cleared.");
  process.exit(0);
}
run();
