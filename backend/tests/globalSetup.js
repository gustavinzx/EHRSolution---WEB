const { Pool } = require('pg');
require('dotenv').config();

module.exports = async () => {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ehr_fleet', // connect to default
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    const { rows } = await pool.query(`SELECT 1 FROM pg_database WHERE datname = 'ehr_fleet_test'`);
    if (rows.length === 0) {
      await pool.query(`CREATE DATABASE ehr_fleet_test`);
    }
  } catch (err) {
    console.error('Error creating test database:', err);
  } finally {
    await pool.end();
  }
};
