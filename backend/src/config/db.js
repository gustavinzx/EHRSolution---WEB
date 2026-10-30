const path = require('path');
// Carrega o .env da pasta backend independentemente do diretório de onde o processo foi iniciado.
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { Pool } = require('pg');

function buildPoolConfig(env = process.env, logger = console) {
  if (env.DATABASE_URL) {
    let ssl;
    if (env.DB_SSL === 'false') {
      ssl = false;
    } else if (env.DB_SSL_INSECURE === 'true') {
      if (logger && typeof logger.warn === 'function') {
        logger.warn(
          '[ALERTA DE SEGURANÇA] Conexão com banco de dados usando TLS sem validação de certificado (DB_SSL_INSECURE=true). NÃO recomendado para produção.'
        );
      }
      ssl = { rejectUnauthorized: false };
    } else {
      ssl = { rejectUnauthorized: true };
    }

    return {
      connectionString: env.DATABASE_URL,
      ssl,
    };
  }

  const config = {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD != null ? String(env.DB_PASSWORD) : undefined,
  };

  if (env.DB_SSL === 'true') {
    if (env.DB_SSL_INSECURE === 'true') {
      if (logger && typeof logger.warn === 'function') {
        logger.warn(
          '[ALERTA DE SEGURANÇA] Conexão com banco de dados usando TLS sem validação de certificado (DB_SSL_INSECURE=true). NÃO recomendado para produção.'
        );
      }
      config.ssl = { rejectUnauthorized: false };
    } else {
      config.ssl = { rejectUnauthorized: true };
    }
  }

  return config;
}

const pool = new Pool(buildPoolConfig());

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // process.exit(-1); removed to prevent backend crash
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  buildPoolConfig,
};
