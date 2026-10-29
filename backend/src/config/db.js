const path = require('path');
// Carrega o .env da pasta backend independentemente do diretório de onde o processo foi iniciado.
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD != null ? String(process.env.DB_PASSWORD) : undefined,
      ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // process.exit(-1); removed to prevent backend crash
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
