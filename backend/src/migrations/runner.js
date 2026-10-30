const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');

const MIGRATION_LOCK_KEY = 10001; // Arbitrary fixed key for advisory lock

function getChecksums(content) {
  const lf = crypto.createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex');
  const crlf = crypto.createHash('sha256').update(content.replace(/\r?\n/g, '\r\n')).digest('hex');
  return { lf, crlf };
}

async function runMigrations() {
  const migrationsDir = path.join(__dirname);
  const client = await db.pool.connect();

  try {
    // 1. Obtain advisory lock
    console.log('[Migrations] Waiting for advisory lock...');
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    console.log('[Migrations] Lock obtained.');

    // 2. Create migrations table if not exists and add checksum column
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW(),
        checksum VARCHAR(64)
      );
    `);

    // Ensure checksum column exists (in case the table already existed before this update)
    await client.query(`ALTER TABLE migrations ADD COLUMN IF NOT EXISTS checksum VARCHAR(64)`);

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const { lf, crlf } = getChecksums(sql);

      const { rows } = await client.query('SELECT checksum FROM migrations WHERE name = $1', [file]);
      
      if (rows.length > 0) {
        const storedChecksum = rows[0].checksum;
        if (!storedChecksum) {
          // Baseline existing migration without checksum
          await client.query('UPDATE migrations SET checksum = $1 WHERE name = $2', [lf, file]);
          console.log(`[Migrations] Set baseline checksum for existing migration: ${file}`);
        } else if (storedChecksum !== lf && storedChecksum !== crlf) {
          throw new Error(`Checksum mismatch for migration ${file}. Stored: ${storedChecksum}, Current (LF): ${lf}, Current (CRLF): ${crlf}`);
        }
        // Already executed and checksum matches, skip
        continue;
      }

      console.log(`[Migrations] Executing ${file}...`);
      
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO migrations (name, checksum) VALUES ($1, $2)', [file, lf]);
        await client.query('COMMIT');
        console.log(`[Migrations] ${file} executed successfully.`);
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch (rbErr) {
          console.error(`[Migrations] ROLLBACK failed after error in ${file}:`, rbErr);
        }
        console.error(`[Migrations] Error executing ${file}:`, err);
        throw err;
      }
    }
  } finally {
    // 3. Release lock and client
    console.log('[Migrations] Releasing advisory lock.');
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    client.release();
  }
}

module.exports = { runMigrations };
