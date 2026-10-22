require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcrypt');
const db = require('../src/config/db');

function parseArgs(args = process.argv.slice(2)) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      parsed.email = args[++i];
    } else if (args[i] === '--name' && args[i + 1]) {
      parsed.name = args[++i];
    } else if (args[i] === '--reset') {
      parsed.reset = true;
    } else if (args[i].startsWith('-')) {
      parsed.disallowedArg = args[i];
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        i++;
      }
    }
  }
  return parsed;
}

function promptText(question) {
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

function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';
    const onData = (ch) => {
      ch = ch.toString('utf8');
      switch (ch) {
        case '\n':
        case '\r':
        case '\u0004':
          if (stdin.setRawMode) stdin.setRawMode(wasRaw);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password.trim());
          break;
        case '\u0003': // Ctrl+C
          if (stdin.setRawMode) stdin.setRawMode(wasRaw);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          process.exit(1);
          break;
        case '\u0008': // Backspace
        case '\x7f':
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
          break;
        default:
          password += ch;
          break;
      }
    };
    stdin.on('data', onData);
  });
}

async function executeCreateAdmin({ email, password, name = 'Administrador', reset = false, disallowedArg = null }) {
  if (disallowedArg) {
    throw new Error(`Argumentos de senha em linha de comando não são permitidos por segurança (${disallowedArg}). Utilize a variável de ambiente ADMIN_PASSWORD ou o prompt seguro.`);
  }

  if (!email || !email.includes('@')) {
    throw new Error('E-mail inválido ou não informado. Use --email <email> ou defina ADMIN_EMAIL.');
  }

  if (!password || password.length < 12) {
    throw new Error('A senha deve ter no mínimo 12 caracteres. Defina ADMIN_PASSWORD ou informe uma senha válida no prompt.');
  }

  const emailNorm = email.trim().toLowerCase();
  const passHash = await bcrypt.hash(password, 10);

  const { rows: existing } = await db.query(
    'SELECT id, email, name, role FROM users WHERE lower(email) = $1',
    [emailNorm]
  );

  if (existing.length > 0) {
    if (!reset) {
      throw new Error(`Usuário com e-mail "${existing[0].email}" já existe. Para redefinir a senha mantendo seu papel atual (${existing[0].role}), utilize a flag --reset.`);
    }

    // Com --reset: atualiza APENAS a senha, NUNCA altera o papel (role) existente
    const { rows: updated } = await db.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2
       RETURNING id, email, name, role`,
      [passHash, existing[0].id]
    );
    return { user: updated[0], action: 'reset' };
  }

  const { rows: inserted } = await db.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, 'admin')
     RETURNING id, email, name, role`,
    [emailNorm, passHash, name]
  );
  return { user: inserted[0], action: 'created' };
}

async function run() {
  try {
    const cliArgs = parseArgs();
    if (cliArgs.disallowedArg) {
      console.error(`Erro: argumentos de senha em linha de comando não são permitidos por segurança (${cliArgs.disallowedArg}). Utilize a variável de ambiente ADMIN_PASSWORD ou o prompt seguro.`);
      process.exit(1);
    }

    let email = cliArgs.email || process.env.ADMIN_EMAIL;
    let password = process.env.ADMIN_PASSWORD;
    let name = cliArgs.name || process.env.ADMIN_NAME || 'Administrador';
    let reset = Boolean(cliArgs.reset || process.env.ADMIN_RESET === 'true');

    if (!email && process.stdin.isTTY) {
      email = await promptText('Digite o e-mail do administrador: ');
    }

    if (!password) {
      if (process.stdin.isTTY) {
        password = await promptHidden('Digite a senha do administrador (mínimo 12 caracteres, digitação oculta): ');
      } else {
        console.error('Erro: senha não informada. Em ambientes não-interativos (sem TTY), defina a variável de ambiente ADMIN_PASSWORD.');
        process.exit(1);
      }
    }

    const { user, action } = await executeCreateAdmin({
      email,
      password,
      name,
      reset,
      disallowedArg: null,
    });

    if (action === 'reset') {
      console.log(`[OK] Senha redefinida com sucesso para usuário existente: ID=${user.id}, Email=${user.email}, Role=${user.role} (papel preservado)`);
    } else {
      console.log(`[OK] Administrador criado com sucesso: ID=${user.id}, Email=${user.email}, Role=${user.role}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(`Erro: ${err.message}`);
    process.exit(1);
  } finally {
    await db.pool.end().catch(() => {});
  }
}

if (require.main === module) {
  run();
}

module.exports = { parseArgs, executeCreateAdmin, run };
