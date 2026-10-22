require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcrypt');
const db = require('../src/config/db');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      parsed.email = args[++i];
    } else if (args[i] === '--password' && args[i + 1]) {
      parsed.password = args[++i];
    } else if (args[i] === '--name' && args[i + 1]) {
      parsed.name = args[++i];
    }
  }
  return parsed;
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function run() {
  try {
    const cliArgs = parseArgs();
    let email = cliArgs.email || process.env.ADMIN_EMAIL;
    let password = cliArgs.password || process.env.ADMIN_PASSWORD;
    let name = cliArgs.name || process.env.ADMIN_NAME || 'Administrador';

    if (!email && process.stdin.isTTY) {
      email = await prompt('Digite o e-mail do administrador: ');
    }
    if (!password && process.stdin.isTTY) {
      password = await prompt('Digite a senha do administrador (mínimo 8 caracteres): ');
    }

    if (!email || !email.includes('@')) {
      console.error('Erro: e-mail inválido ou não informado. Use --email <email> ou defina ADMIN_EMAIL.');
      process.exit(1);
    }

    if (!password || password.length < 8) {
      console.error('Erro: a senha deve ter no mínimo 8 caracteres. Use --password <senha> ou defina ADMIN_PASSWORD.');
      process.exit(1);
    }

    const emailNorm = email.trim().toLowerCase();
    const passHash = await bcrypt.hash(password, 10);

    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE lower(email) = $1',
      [emailNorm]
    );

    let user;
    if (existing.length > 0) {
      const { rows: updated } = await db.query(
        `UPDATE users
         SET password_hash = $1, name = $2, role = 'admin'
         WHERE id = $3
         RETURNING id, email, name, role`,
        [passHash, name, existing[0].id]
      );
      user = updated[0];
    } else {
      const { rows: inserted } = await db.query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, $3, 'admin')
         RETURNING id, email, name, role`,
        [emailNorm, passHash, name]
      );
      user = inserted[0];
    }

    console.log(`[OK] Administrador configurado com sucesso: ID=${user.id}, Email=${user.email}, Role=${user.role}`);
    process.exit(0);
  } catch (err) {
    console.error('Erro ao criar administrador:', err.message);
    process.exit(1);
  } finally {
    await db.pool.end().catch(() => {});
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
