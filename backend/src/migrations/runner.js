const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigrations() {
  const migrationsDir = path.join(__dirname);
  
  // Create migrations table if not exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await db.query('SELECT name FROM migrations WHERE name = $1', [file]);
    if (rows.length === 0) {
      console.log(`[Migrations] Executing ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      try {
        await db.query('BEGIN');
        await db.query(sql);
        await db.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await db.query('COMMIT');
        console.log(`[Migrations] ${file} executed successfully.`);
      } catch (err) {
        await db.query('ROLLBACK');
        console.error(`[Migrations] Error executing ${file}:`, err);
        throw err;
      }
    }
  }
}

module.exports = { runMigrations };
