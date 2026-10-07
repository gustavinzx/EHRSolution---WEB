const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');
const { runMigrations } = require('../src/migrations/runner');
const { execSync } = require('child_process');

describe('Migrations and Seed', () => {
  beforeAll(async () => {
    // Ensure clean migrations table
    await db.query(`DROP TABLE IF EXISTS migrations`);
    await db.query(`DROP TABLE IF EXISTS test_table`);
  });

  afterAll(async () => {
    await db.pool.end();
  });

  it('7. Runner: falha não aplica nada; reexecutar funciona; checksum falha', async () => {
    // Run normal migrations
    await runMigrations();

    // Inject a bad migration
    const badSql = `
      BEGIN;
      CREATE TABLE test_table (id INT);
      SELECT * FROM table_that_does_not_exist;
      COMMIT;
    `;
    const badPath = path.join(__dirname, '../src/migrations/999_bad.sql');
    fs.writeFileSync(badPath, badSql);

    await expect(runMigrations()).rejects.toThrow();

    // Check nothing was applied (test_table should not exist)
    const { rows: tRows } = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_name = 'test_table'`);
    expect(tRows.length).toBe(0);

    // Check migration was not registered
    const { rows: mRows } = await db.query(`SELECT * FROM migrations WHERE name = '999_bad.sql'`);
    expect(mRows.length).toBe(0);

    // Fix migration
    fs.writeFileSync(badPath, `CREATE TABLE test_table (id INT);`);
    await runMigrations(); // Should succeed
    
    const { rows: tRows2 } = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_name = 'test_table'`);
    expect(tRows2.length).toBe(1);

    // Alter checksum of an already applied migration
    fs.writeFileSync(badPath, `CREATE TABLE test_table (id INT, new_col INT);`);
    await expect(runMigrations()).rejects.toThrow(/Checksum mismatch/);

    // Cleanup
    fs.unlinkSync(badPath);
    await db.query(`DROP TABLE test_table`);
    await db.query(`DELETE FROM migrations WHERE name = '999_bad.sql'`);
  });

  it('8. seed.js recusa rodar em production', () => {
    try {
      execSync('node src/seed/seed.js', { env: { ...process.env, NODE_ENV: 'production', ALLOW_SEED_WIPE: 'true' }, stdio: 'pipe' });
      // Should not reach here
      expect(true).toBe(false);
    } catch (err) {
      expect(err.status).toBe(1);
      expect(err.stderr.toString()).toMatch(/Seed falhou: Ambiente de produção detectado/);
    }
  });
});
