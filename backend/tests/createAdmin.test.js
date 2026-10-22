const db = require('../src/config/db');
const bcrypt = require('bcrypt');
const { parseArgs, executeCreateAdmin } = require('../scripts/createAdmin');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

const clean = require('./clean');

describe('BLOCO G4 — createAdmin seguro', () => {
  beforeAll(async () => {
    await clean();
  });

  afterAll(async () => {
    await clean();
  });

  beforeEach(async () => {
    await db.query("DELETE FROM users WHERE email IN ('operador.teste@ehr.com', 'novo.admin@ehr.com')");
  });

  it('1. Rejeita ausência/uso indevido de --password (evita vazamento em histórico e processos)', async () => {
    // 1.1 parseArgs detecta a flag proibida
    const passArg = '--' + 'password';
    const parsed = parseArgs(['--email', 'admin@ehr.com', passArg, 'vazamento_de_senha_123']);
    expect(parsed.disallowedArg).toBe(passArg);

    // 1.2 executeCreateAdmin recusa execução imediata se disallowedArg for fornecido
    await expect(
      executeCreateAdmin({
        email: 'admin@ehr.com',
        password: 'vazamento_de_senha_123',
        disallowedArg: parsed.disallowedArg,
      })
    ).rejects.toThrow(/não são permitidos por segurança/i);
  });

  it('2. Rejeita senha com menos de 12 caracteres (senha curta)', async () => {
    await expect(
      executeCreateAdmin({
        email: 'novo.admin@ehr.com',
        password: 'curta_12345', // 11 caracteres (< 12)
        reset: false,
      })
    ).rejects.toThrow(/A senha deve ter no mínimo 12 caracteres/i);
  });

  it('3. E-mail existente sem --reset: aborta e NÃO altera senha nem papel', async () => {
    // Cria usuário pré-existente com papel diferente de admin (ex: manager)
    const initialHash = await bcrypt.hash('SenhaInicial@12345', 10);
    const { rows: inserted } = await db.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ('operador.teste@ehr.com', $1, 'Operador Inicial', 'manager')
       RETURNING id, role`,
      [initialHash]
    );
    const userId = inserted[0].id;

    // Tentar executar createAdmin para o mesmo e-mail sem --reset DEVE abortar
    await expect(
      executeCreateAdmin({
        email: 'operador.teste@ehr.com',
        password: 'NovaSenhaForte@123456',
        name: 'Tentativa Invasao',
        reset: false,
      })
    ).rejects.toThrow(/já existe.*utilize a flag --reset/i);

    // Verifica no banco: nada foi alterado
    const { rows: check } = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    expect(check[0].role).toBe('manager');
    expect(check[0].name).toBe('Operador Inicial');
    expect(await bcrypt.compare('SenhaInicial@12345', check[0].password_hash)).toBe(true);
  });

  it('4. E-mail existente com --reset: redefine senha mas NUNCA altera o papel de usuário existente', async () => {
    // Cria usuário pré-existente com papel 'auditor'
    const initialHash = await bcrypt.hash('SenhaInicial@12345', 10);
    const { rows: inserted } = await db.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ('operador.teste@ehr.com', $1, 'Auditor Fiscal', 'auditor')
       RETURNING id, role`,
      [initialHash]
    );
    const userId = inserted[0].id;

    // Executa com reset: true
    const result = await executeCreateAdmin({
      email: 'operador.teste@ehr.com',
      password: 'NovaSenhaForte@Redefinida123',
      name: 'NomeIgnoradoNoReset',
      reset: true,
    });

    expect(result.action).toBe('reset');
    expect(result.user.role).toBe('auditor'); // Papel PRESERVADO

    // Verifica no banco
    const { rows: check } = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    expect(check[0].role).toBe('auditor'); // Não virou admin!
    expect(await bcrypt.compare('NovaSenhaForte@Redefinida123', check[0].password_hash)).toBe(true);
  });

  it('5. Novo usuário criado com sucesso com role admin', async () => {
    const result = await executeCreateAdmin({
      email: 'novo.admin@ehr.com',
      password: 'SenhaAdminValida123!',
      name: 'Administrador Producao',
      reset: false,
    });

    expect(result.action).toBe('created');
    expect(result.user.role).toBe('admin');
    expect(result.user.email).toBe('novo.admin@ehr.com');

    const { rows: check } = await db.query('SELECT * FROM users WHERE id = $1', [result.user.id]);
    expect(check.length).toBe(1);
    expect(check[0].role).toBe('admin');
  });
});
