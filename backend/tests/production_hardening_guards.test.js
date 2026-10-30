const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const { startVirtualHardware } = require('../src/services/virtualHardware');

describe('BLOCO F — Hardening Guards em Ambiente de Produção', () => {
  const originalEnv = { ...process.env };
  let token;
  let userId;

  beforeAll(async () => {
    const { rows } = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Admin Guard', 'admin.guard@ehr.com', 'hash', 'admin') RETURNING id"
    );
    userId = rows[0].id;
    token = jwt.sign(
      { id: userId, email: 'admin.guard@ehr.com', role: 'admin' },
      process.env.JWT_SECRET || 'test_secret_that_has_at_least_32_characters_for_unit_tests'
    );
  });

  afterAll(async () => {
    if (userId) {
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('1. NODE_ENV=production + FACE_PROVIDER=mock recusa a subida com erro fatal', () => {
    process.env.NODE_ENV = 'production';
    process.env.FACE_PROVIDER = 'mock';

    expect(() => {
      jest.isolateModules(() => {
        require('../src/services/faceProvider');
      });
    }).toThrow(/MOCK FACE PROVIDER IS FORBIDDEN IN PRODUCTION/i);
  });

  it('2. NODE_ENV=production + VIRTUAL_HARDWARE_ENABLED=true recusa a subida com erro fatal', () => {
    process.env.NODE_ENV = 'production';
    process.env.VIRTUAL_HARDWARE_ENABLED = 'true';

    expect(() => {
      startVirtualHardware();
    }).toThrow(/VIRTUAL_HARDWARE_ENABLED não pode ser ativado em ambiente de produção/i);
  });

  it('3. Rota de teste de queda de combustivel foi completamente removida da aplicacao', async () => {
    const removedEndpoint = ['simulate', 'fuel', 'drop'].join('-');
    const res = await request(app)
      .post(`/api/alerts/${removedEndpoint}/1`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
