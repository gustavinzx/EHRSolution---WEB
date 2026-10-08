const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');
const { runMigrations } = require('../src/migrations/runner');
const { execSync } = require('child_process');

describe('Migrations and Seed', () => {
  beforeAll(async () => {
    if (!process.env.DB_NAME?.endsWith('_test')) {
      throw new Error(`Guard fail: DB_NAME deve terminar com '_test'. Atual: ${process.env.DB_NAME}`);
    }
    // Ensure clean migrations table
    await db.query(`DROP TABLE IF EXISTS migrations`);
    await db.query(`DROP TABLE IF EXISTS test_table`);
  });

  afterAll(async () => {
    const badPath = path.join(__dirname, '../src/migrations/999_bad.sql');
    if (fs.existsSync(badPath)) fs.unlinkSync(badPath);
    await db.query(`DROP TABLE IF EXISTS test_table`);
    await db.pool.end();
  });

  it('7. Runner: falha não aplica nada; reexecutar funciona; checksum falha; upgrade antigo', async () => {
    // Run normal migrations
    await runMigrations();

    const badPath = path.join(__dirname, '../src/migrations/999_bad.sql');
    try {
      // Inject a bad migration without BEGIN/COMMIT
      const badSql = `
        CREATE TABLE test_table (id INT);
        SELECT * FROM table_that_does_not_exist;
      `;
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

      // Teste do upgrade de banco antigo
      // Vamos simular uma migração que já foi aplicada num banco antigo (checksum = NULL)
      await db.query(`UPDATE migrations SET checksum = NULL WHERE name = '999_bad.sql'`);
      
      // Rodar novamente, o runner deve calcular o baseline e salvar no banco SEM falhar,
      // mesmo que o arquivo atual esteja diferente (porque a política de baseline assume o atual se for NULL).
      // Wait, o runner pega o checksum atual do arquivo e guarda no banco.
      await expect(runMigrations()).resolves.not.toThrow();

      const { rows: mRows2 } = await db.query(`SELECT checksum FROM migrations WHERE name = '999_bad.sql'`);
      expect(mRows2[0].checksum).not.toBeNull();
    } finally {
      // Cleanup
      if (fs.existsSync(badPath)) fs.unlinkSync(badPath);
      await db.query(`DROP TABLE IF EXISTS test_table`);
      await db.query(`DELETE FROM migrations WHERE name = '999_bad.sql'`);
    }
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
