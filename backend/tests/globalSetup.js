const { Pool } = require('pg');
require('dotenv').config();

module.exports = async () => {
  // Conecta no DB padrão para criar o DB de teste se não existir
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    const { rows } = await pool.query(`SELECT 1 FROM pg_database WHERE datname = 'ehr_fleet_test'`);
    if (rows.length === 0) {
      await pool.query(`CREATE DATABASE ehr_fleet_test`);
      console.log('Database ehr_fleet_test created.');
    }
  } catch (err) {
    console.error('Error creating test database:', err);
  } finally {
    await pool.end();
  }

  // Agora vamos rodar as migrations DE FATO contra o banco de teste recém-criado
  process.env.DB_NAME = 'ehr_fleet_test';
  const { runMigrations } = require('../src/migrations/runner');
  
  // Como db.js é cacheado e usa process.env, ao requerer runner.js, db.js será carregado com DB_NAME=ehr_fleet_test.
  try {
    console.log('Running migrations on ehr_fleet_test...');
    await runMigrations();
    console.log('Migrations completed on test DB.');
  } catch (err) {
    console.error('Error running migrations:', err);
    throw err;
  }
};
