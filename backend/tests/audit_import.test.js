const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { app } = require('../src/index');
const db = require('../src/config/db');
const authHardware = require('../src/middleware/authHardware');
const { parseAuditCsv } = require('../src/services/auditImportService');
const clean = require('./clean');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

describe('Importação do log de auditoria do cartão SD (CSV)', () => {
  let truckId;
  let otherTruckId;
  let mgrToken;
  const key = crypto.randomBytes(16).toString('hex');
  const otherKey = crypto.randomBytes(16).toString('hex');

  const send = (id, csv, k = key, type = 'text/csv') =>
    request(app).post(`/api/fleet/${id}/audit-import`).set('x-api-key', k).set('Content-Type', type).send(csv);
  const count = async (id) => (await db.query(
    'SELECT count(*)::int AS n FROM hardware_audit_entries WHERE truck_id = $1', [id])).rows[0].n;

  beforeAll(async () => {
    await clean();
    const u = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Mgr', 'mgr.aud@test.com', 'h', 'manager') RETURNING id"
    );
    mgrToken = jwt.sign({ id: u.rows[0].id, email: 'mgr.aud@test.com', role: 'manager' }, process.env.JWT_SECRET);
    truckId = (await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key)
       VALUES ('AUD-0001','Volvo FH',500,250,$1) RETURNING id`, [key])).rows[0].id;
    otherTruckId = (await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key)
       VALUES ('AUD-0002','Scania R450',500,250,$1) RETURNING id`, [otherKey])).rows[0].id;
  });

  beforeEach(async () => {
    authHardware.resetRateLimits();
    await db.query('DELETE FROM hardware_audit_entries');
  });

  afterAll(async () => {
    await clean();
    await db.pool.end();
  });

  const L1 = '2026-10-20 21:30:00;-19.9245;-43.9352;DESTRAVAR;SUCESSO';
  const L2 = '2026-10-20 21:42:10;-19.9245;-43.9352;TRAVAR;SUCESSO';

  it('importa linhas válidas (com cabeçalho e CRLF) e grava no banco', async () => {
    const csv = `data;lat;lng;evento;resultado\r\n${L1}\r\n${L2}\r\n`;
    const r = await send(truckId, csv);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ success: true, imported: 2, duplicates: 0, rejected: [] });
    expect(await count(truckId)).toBe(2);
    const { rows } = await db.query(
      'SELECT occurred_at, event FROM hardware_audit_entries WHERE truck_id = $1 ORDER BY occurred_at', [truckId]);
    expect(rows[0].occurred_at.toISOString()).toBe('2026-10-20T21:30:00.000Z');
    expect(rows[0].event).toBe('DESTRAVAR');
  });

  it('idempotente: reenviar o mesmo arquivo não duplica', async () => {
    await send(truckId, `${L1}\n${L2}\n`);
    const r = await send(truckId, `${L1}\n${L2}\n`);
    expect(r.body).toMatchObject({ imported: 0, duplicates: 2 });
    expect(await count(truckId)).toBe(2);
  });

  it('arquivo parcialmente repetido importa só o que é novo', async () => {
    await send(truckId, `${L1}\n`);
    const r = await send(truckId, `${L1}\n${L2}\n`);
    expect(r.body).toMatchObject({ imported: 1, duplicates: 1 });
  });

  it('seq diferencia linhas idênticas com o mesmo carimbo de tempo', async () => {
    const r = await send(truckId, `${L1};1\n${L1};2\n${L1};2\n`);
    expect(r.body).toMatchObject({ imported: 2, duplicates: 1 });
  });

  it('linhas inválidas são rejeitadas com número da linha; válidas entram', async () => {
    const csv = [
      L1,
      '2026-13-40 99:99:99;-19.9;-43.9;TRAVAR;SUCESSO',
      '2026-10-20 21:30:00;-91;-43.9;TRAVAR;SUCESSO',
      '2026-10-20 21:30:00;abc;-43.9;TRAVAR;SUCESSO',
      '2026-10-20 21:30:00;-19.9;-43.9;EXPLODIR;SUCESSO',
      '2026-10-20 21:30:00;-19.9;-43.9;TRAVAR;TALVEZ',
      '2026-10-20 21:30:00;-19.9;-43.9',
      '2099-01-01 00:00:00;-19.9;-43.9;TRAVAR;SUCESSO',
      `${L2};x1`,
    ].join('\n');
    const r = await send(truckId, csv);
    expect(r.status).toBe(201);
    expect(r.body.imported).toBe(1);
    expect(r.body.rejected.map((x) => x.line)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(await count(truckId)).toBe(1);
  });

  it('parser: data passada distante é aceita, futuro além de 24h é recusado', () => {
    const now = Date.UTC(2026, 10, 23, 12, 0, 0);
    const old = parseAuditCsv('2001-01-01 00:00:00;0;0;TRAVAR;FALHA', { now });
    expect(old.valid).toHaveLength(1);
    const fut = parseAuditCsv('2026-11-25 00:00:00;0;0;TRAVAR;FALHA', { now });
    expect(fut.rejected[0].reason).toBe('data no futuro');
  });

  it('CSV vazio: 400; Content-Type errado: 415; excesso de linhas: 413', async () => {
    expect((await send(truckId, '   \n')).status).toBe(400);
    const json = await request(app).post(`/api/fleet/${truckId}/audit-import`)
      .set('x-api-key', key).send({ csv: L1 });
    expect(json.status).toBe(415);
    const big = Array(5003).fill(L1).join('\n');
    expect((await send(truckId, big)).status).toBe(413);
    expect(await count(truckId)).toBe(0);
  });

  it('autenticação: sem chave/inválida 401; chave de outro caminhão 403 e nada gravado', async () => {
    const noKey = await request(app).post(`/api/fleet/${truckId}/audit-import`)
      .set('Content-Type', 'text/csv').send(L1);
    expect(noKey.status).toBe(401);
    expect((await send(truckId, L1, 'chave-invalida')).status).toBe(401);
    expect((await send(truckId, L1, otherKey)).status).toBe(403);
    expect(await count(truckId)).toBe(0);
    expect(await count(otherTruckId)).toBe(0);
  });

  it('mesma linha em caminhões diferentes não colide', async () => {
    await send(truckId, L1);
    const r = await send(otherTruckId, L1, otherKey);
    expect(r.body.imported).toBe(1);
  });

  it('GET /api/fleet/:id/audit-entries: consulta histórico do cartão SD com paginação por cursor', async () => {
    await send(truckId, `${L1};1\n${L2};2\n${L1};3\n`);

    const page1 = await request(app)
      .get(`/api/fleet/${truckId}/audit-entries?limit=2`)
      .set('Authorization', `Bearer ${mgrToken}`);
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.next_cursor).not.toBeNull();

    const page2 = await request(app)
      .get(`/api/fleet/${truckId}/audit-entries?limit=2&cursor=${page1.body.next_cursor}`)
      .set('Authorization', `Bearer ${mgrToken}`);
    expect(page2.status).toBe(200);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.next_cursor).toBeNull();

    const badCursor = await request(app)
      .get(`/api/fleet/${truckId}/audit-entries?cursor=-1`)
      .set('Authorization', `Bearer ${mgrToken}`);
    expect(badCursor.status).toBe(400);
  });
});
