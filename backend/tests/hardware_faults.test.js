const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { app } = require('../src/index');
const db = require('../src/config/db');
const clean = require('./clean');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

describe('Hardware Faults & Edge Cases (Blocos 2, 3, 4)', () => {
  let adminToken;
  let driverToken;
  let driverId;
  let truck1Id;
  let truck2Id;
  let apiKey1;
  let apiKey2;
  let stationId;

  // Helper para gerar placa aleatória única
  const randomPlate = () => `FLT${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  // Helper para provisionar chave de hardware e obter chave bruta
  async function provisionHardwareKey(tId) {
    const rawKey = `hw_${crypto.randomBytes(16).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.slice(0, 8);
    await db.query(
      `UPDATE trucks
       SET api_key_hash = $1, api_key_prefix = $2, api_key_created_at = NOW()
       WHERE id = $3`,
      [hash, prefix, tId]
    );
    return rawKey;
  }

  // Helper para criar uma sessão em estado específico
  async function createSession(status = 'authorized', overrideTruckId = null) {
    const tId = overrideTruckId || truck1Id;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const { rows } = await db.query(
      `INSERT INTO fueling_sessions (
         truck_id, driver_id, station_id, status, release_method,
         requested_at, authorized_at, started_at, expires_at
       ) VALUES ($1, $2, $3, $4, 'facial', NOW(), NOW(), ${status === 'active' || status === 'completed' ? 'NOW()' : 'NULL'}, $5)
       RETURNING id`,
      [tId, driverId, stationId, status, expiresAt]
    );
    return rows[0].id;
  }

  beforeAll(async () => {
    await clean();

    // 1. Criar admin
    const uAdmin = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Admin Faults', 'admin.faults@test.com', 'hash', 'admin') RETURNING id"
    );
    adminToken = jwt.sign({ id: uAdmin.rows[0].id, role: 'admin' }, process.env.JWT_SECRET);

    // 2. Criar posto
    const stRes = await db.query(
      "INSERT INTO fuel_stations (name, lat, lng) VALUES ('Posto Hardware Faults', -23.5505, -46.6333) RETURNING id"
    );
    stationId = stRes.rows[0].id;

    // 3. Criar motorista
    const drvRes = await db.query(
      "INSERT INTO drivers (name, email, is_active) VALUES ('Driver Faults', 'driver.faults@test.com', true) RETURNING id"
    );
    driverId = drvRes.rows[0].id;
    driverToken = jwt.sign({ id: driverId, role: 'driver' }, process.env.JWT_SECRET);

    // 4. Criar caminhão 1 (capacidade 500L, nível 100L)
    const t1Res = await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, fuel_station_id, lat, lng)
       VALUES ($1, 'Volvo FH 540', 500, 100, $2, -23.5505, -46.6333) RETURNING id`,
      [randomPlate(), stationId]
    );
    truck1Id = t1Res.rows[0].id;
    apiKey1 = await provisionHardwareKey(truck1Id);

    // 5. Criar caminhão 2 (capacidade 400L, nível 200L)
    const t2Res = await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, fuel_station_id, lat, lng)
       VALUES ($1, 'Scania R450', 400, 200, $2, -23.5505, -46.6333) RETURNING id`,
      [randomPlate(), stationId]
    );
    truck2Id = t2Res.rows[0].id;
    apiKey2 = await provisionHardwareKey(truck2Id);

    // Vincular motorista ao caminhão 1
    await db.query(
      'INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)',
      [driverId, truck1Id]
    );
  });

  // =========================================================================
  // BLOCO 2: finish e pump-reading com defeitos
  // =========================================================================
  describe('BLOCO 2 — finish e pump-reading com defeitos', () => {
    it('1. finish repetido em sequência com o mesmo corpo: a segunda chamada responde 404, e só existe 1 fueling_log e o estado final é igual', async () => {
      const sessionId = await createSession('active');

      const body = { level_before: 100, level_after: 160 };

      // Primeira chamada: sucesso (200)
      const res1 = await request(app)
        .post(`/api/fueling/sessions/${sessionId}/finish`)
        .set('x-api-key', apiKey1)
        .send(body);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.volume_liters).toBe(60);

      // Segunda chamada (repetida em sequência com mesmo corpo): responde 404 ("Sessão não encontrada ou não está ativa")
      const res2 = await request(app)
        .post(`/api/fueling/sessions/${sessionId}/finish`)
        .set('x-api-key', apiKey1)
        .send(body);

      expect(res2.status).toBe(404);
      expect(res2.body.error).toMatch(/não está ativa/i);

      // Verificação no banco: exatamente 1 fueling_log gravado
      const { rows: logs } = await db.query(
        'SELECT * FROM fueling_logs WHERE session_id = $1',
        [sessionId]
      );
      expect(logs.length).toBe(1);
      expect(Number(logs[0].volume_liters)).toBe(60);
      expect(Number(logs[0].level_before)).toBe(100);
      expect(Number(logs[0].level_after)).toBe(160);

      // Estado final da sessão permanece 'completed'
      const { rows: sessRows } = await db.query(
        'SELECT status, completed_at FROM fueling_sessions WHERE id = $1',
        [sessionId]
      );
      expect(sessRows[0].status).toBe('completed');
      expect(sessRows[0].completed_at).not.toBeNull();
    });

    it('2. finish concorrente (Promise.all de 2 chamadas): exatamente uma sucede (200) e a outra falha (404), com 1 só fueling_log', async () => {
      const sessionId = await createSession('active');

      const body = { level_before: 100, level_after: 180 };

      // Disparar ambas em paralelo
      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/api/fueling/sessions/${sessionId}/finish`)
          .set('x-api-key', apiKey1)
          .send(body),
        request(app)
          .post(`/api/fueling/sessions/${sessionId}/finish`)
          .set('x-api-key', apiKey1)
          .send(body)
      ]);

      const statuses = [resA.status, resB.status].sort();
      // Documentação: Uma transação adquire o registro da sessão e conclui (200); a concorrente não encontra a sessão em status active/authorized e responde 404
      expect(statuses).toEqual([200, 404]);

      // Confere que apenas 1 fueling_log foi inserido
      const { rows: logs } = await db.query(
        'SELECT * FROM fueling_logs WHERE session_id = $1',
        [sessionId]
      );
      expect(logs.length).toBe(1);
      expect(Number(logs[0].volume_liters)).toBe(80);
    });

    it('3. pump-reading repetido com o mesmo corpo: ambas respondem 200 e NÃO surgem alertas de divergência duplicados', async () => {
      const sessionId = await createSession('active');

      // Finish primeiro: 100L -> 160L (delta 60L)
      await request(app)
        .post(`/api/fueling/sessions/${sessionId}/finish`)
        .set('x-api-key', apiKey1)
        .send({ level_before: 100, level_after: 160 });

      // Limpar eventuais alertas deste caminhão
      await db.query('DELETE FROM fleet_alerts WHERE truck_id = $1', [truck1Id]);

      // Primeira chamada de pump-reading: 60L (concorda com delta de 60L)
      const res1 = await request(app)
        .post(`/api/fueling/sessions/${sessionId}/pump-reading`)
        .set('x-api-key', apiKey1)
        .send({ pump_liters: 60 });
      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      // Segunda chamada com mesmo corpo (idempotente)
      const res2 = await request(app)
        .post(`/api/fueling/sessions/${sessionId}/pump-reading`)
        .set('x-api-key', apiKey1)
        .send({ pump_liters: 60 });
      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);

      // Verificar que não foram gerados alertas de divergência
      const { rows: alerts } = await db.query(
        "SELECT * FROM fleet_alerts WHERE truck_id = $1 AND type LIKE '%divergence%'",
        [truck1Id]
      );
      expect(alerts.length).toBe(0);
    });

    it('4. pump-reading antes do finish (sessão authorized): 409. Com sessão active: 200', async () => {
      // 4a. Sessão em status 'authorized'
      const sessionAuthId = await createSession('authorized');

      const resAuth = await request(app)
        .post(`/api/fueling/sessions/${sessionAuthId}/pump-reading`)
        .set('x-api-key', apiKey1)
        .send({ pump_liters: 50 });

      expect(resAuth.status).toBe(409);
      expect(resAuth.body.error).toBe('Sessão não está ativa nem concluída');

      // 4b. Sessão em status 'active'
      const sessionActiveId = await createSession('active');

      const resActive = await request(app)
        .post(`/api/fueling/sessions/${sessionActiveId}/pump-reading`)
        .set('x-api-key', apiKey1)
        .send({ pump_liters: 50 });

      expect(resActive.status).toBe(200);
      expect(resActive.body.success).toBe(true);
      expect(resActive.body.pump_liters).toBe(50);
    });

    it('5. pump-reading fora de ordem (60, depois 90, depois 60): documente o valor final e quantos alertas existem', async () => {
      // Cria sessão active e finaliza com delta tanque = 60L (100 -> 160)
      const sessionId = await createSession('active');
      await request(app)
        .post(`/api/fueling/sessions/${sessionId}/finish`)
        .set('x-api-key', apiKey1)
        .send({ level_before: 100, level_after: 160 });

      await db.query('DELETE FROM fleet_alerts WHERE truck_id = $1', [truck1Id]);

      // 1. Envia 60 (bate com o tanque 60L) => sem divergência
      const r1 = await request(app)
        .post(`/api/fueling/sessions/${sessionId}/pump-reading`)
        .set('x-api-key', apiKey1)
        .send({ pump_liters: 60 });
      expect(r1.status).toBe(200);

      const alertsAfter60 = await db.query(
        "SELECT * FROM fleet_alerts WHERE truck_id = $1 AND type LIKE '%divergence%'",
        [truck1Id]
      );
      expect(alertsAfter60.rows.length).toBe(0);

      // 2. Envia 90 (diverge: bomba 90 vs tanque 60 = diff 30L / 33.3%) => gera alerta de divergência
      const r2 = await request(app)
        .post(`/api/fueling/sessions/${sessionId}/pump-reading`)
        .set('x-api-key', apiKey1)
        .send({ pump_liters: 90 });
      expect(r2.status).toBe(200);

      // Pequeno delay ou aguardo assíncrono caso o event-loop processe o evaluateFuelingLog
      await new Promise(resolve => setTimeout(resolve, 50));

      const alertsAfter90 = await db.query(
        "SELECT * FROM fleet_alerts WHERE truck_id = $1 AND type LIKE '%divergence%'",
        [truck1Id]
      );
      expect(alertsAfter90.rows.length).toBe(1);

      // 3. Envia 60 novamente (sobrescreve para 60)
      const r3 = await request(app)
        .post(`/api/fueling/sessions/${sessionId}/pump-reading`)
        .set('x-api-key', apiKey1)
        .send({ pump_liters: 60 });
      expect(r3.status).toBe(200);

      // Documentação do estado final:
      // O valor de pump_liters tanto na sessão quanto no fueling_log é atualizado para 60.
      const { rows: finalSess } = await db.query(
        'SELECT pump_liters FROM fueling_sessions WHERE id = $1',
        [sessionId]
      );
      expect(Number(finalSess[0].pump_liters)).toBe(60);

      const { rows: finalLog } = await db.query(
        'SELECT pump_liters FROM fueling_logs WHERE session_id = $1',
        [sessionId]
      );
      expect(Number(finalLog[0].pump_liters)).toBe(60);

      // O alerta criado na leitura intermediária (90L) permanece registrado no banco (audit trail)
      const alertsAfterFinal = await db.query(
        "SELECT * FROM fleet_alerts WHERE truck_id = $1 AND type LIKE '%divergence%'",
        [truck1Id]
      );
      expect(alertsAfterFinal.rows.length).toBe(1);
    });

    it('6. pump-reading de outro caminhão: 403. Valor negativo, acima da capacidade, NaN e texto: 400', async () => {
      const sessionIdTruck1 = await createSession('active', truck1Id);

      // 6a. Tentativa usando a chave do caminhão 2 contra a sessão do caminhão 1 => 403
      const resForbidden = await request(app)
        .post(`/api/fueling/sessions/${sessionIdTruck1}/pump-reading`)
        .set('x-api-key', apiKey2)
        .send({ pump_liters: 50 });

      expect(resForbidden.status).toBe(403);
      expect(resForbidden.body.error).toBe('Hardware API Key não pertence a este caminhão');

      // 6b. Valor negativo => 400
      const resNegative = await request(app)
        .post(`/api/fueling/sessions/${sessionIdTruck1}/pump-reading`)
        .set('x-api-key', apiKey1)
        .send({ pump_liters: -10 });

      expect(resNegative.status).toBe(400);
      expect(resNegative.body.error).toMatch(/fora do limite/i);

      // 6c. Acima da capacidade (capacidade = 500L, enviando 501L) => 400
      const resOverCap = await request(app)
        .post(`/api/fueling/sessions/${sessionIdTruck1}/pump-reading`)
        .set('x-api-key', apiKey1)
        .send({ pump_liters: 501 });

      expect(resOverCap.status).toBe(400);
      expect(resOverCap.body.error).toMatch(/fora do limite/i);

      // 6d. NaN => 400
      const resNaN = await request(app)
        .post(`/api/fueling/sessions/${sessionIdTruck1}/pump-reading`)
        .set('x-api-key', apiKey1)
        .send({ pump_liters: 'NaN' });

      expect(resNaN.status).toBe(400);
      expect(resNaN.body.error).toMatch(/obrigatório e numérico/i);

      // 6e. Texto arbitrário => 400
      const resText = await request(app)
        .post(`/api/fueling/sessions/${sessionIdTruck1}/pump-reading`)
        .set('x-api-key', apiKey1)
        .send({ pump_liters: 'cinquenta' });

      expect(resText.status).toBe(400);
      expect(resText.body.error).toMatch(/obrigatório e numérico/i);
    });

    it('7. pump-reading enviado muito depois (sessão já completed): documente o comportamento real', async () => {
      // Cria sessão e conclui via finish
      const sessionId = await createSession('active');
      await request(app)
        .post(`/api/fueling/sessions/${sessionId}/finish`)
        .set('x-api-key', apiKey1)
        .send({ level_before: 100, level_after: 150 });

      // Simula passagem de tempo no banco (envelhece completed_at em 2 horas)
      await db.query(
        "UPDATE fueling_sessions SET completed_at = NOW() - INTERVAL '2 hours' WHERE id = $1",
        [sessionId]
      );

      // Envia pump-reading após a conclusão tardia
      const res = await request(app)
        .post(`/api/fueling/sessions/${sessionId}/pump-reading`)
        .set('x-api-key', apiKey1)
        .send({ pump_liters: 50 });

      // Comportamento real: o endpoint aceita (status 200), pois status = 'completed',
      // atualiza o pump_liters no fueling_logs e reavalia as regras de combustível (evaluateFuelingLog).
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pump_liters).toBe(50);

      const { rows: logs } = await db.query(
        'SELECT pump_liters FROM fueling_logs WHERE session_id = $1',
        [sessionId]
      );
      expect(Number(logs[0].pump_liters)).toBe(50);
    });
  });

  // =========================================================================
  // BLOCO 3: trava, falha fecha (fail-safe lock)
  // =========================================================================
  describe('BLOCO 3 — trava, falha fecha (GET /fueling/sessions/:truckId/active)', () => {
    it('Retorna unlock=false quando não há nenhuma sessão ativa para o caminhão', async () => {
      // Limpa qualquer sessão do caminhão 2
      await db.query('DELETE FROM fueling_sessions WHERE truck_id = $1', [truck2Id]);

      const res = await request(app)
        .get(`/api/fueling/sessions/${truck2Id}/active`)
        .set('x-api-key', apiKey2);

      expect(res.status).toBe(200);
      expect(res.body.unlock).toBe(false);
      expect(res.body.session_id).toBeNull();
      expect(res.body.status).toBeNull();
    });

    it('Retorna unlock=false quando a sessão está em status "requested" (aguardando biometria)', async () => {
      const sessionId = await createSession('requested', truck1Id);

      const res = await request(app)
        .get(`/api/fueling/sessions/${truck1Id}/active`)
        .set('x-api-key', apiKey1);

      expect(res.status).toBe(200);
      expect(res.body.unlock).toBe(false);
      expect(res.body.session_id).toBe(sessionId);
      expect(res.body.status).toBe('requested');
    });

    it('Retorna unlock=false quando a sessão está em status "cancelled"', async () => {
      await createSession('cancelled', truck2Id);

      const res = await request(app)
        .get(`/api/fueling/sessions/${truck2Id}/active`)
        .set('x-api-key', apiKey2);

      expect(res.status).toBe(200);
      expect(res.body.unlock).toBe(false);
      expect(res.body.session_id).toBeNull();
    });

    it('Retorna unlock=false quando a sessão está expirada (timestamps além do TTL)', async () => {
      // Cria sessão authorized e altera expires_at para o passado
      const sessionId = await createSession('authorized', truck2Id);
      await db.query(
        "UPDATE fueling_sessions SET expires_at = NOW() - INTERVAL '10 minutes', requested_at = NOW() - INTERVAL '40 minutes' WHERE id = $1",
        [sessionId]
      );

      const res = await request(app)
        .get(`/api/fueling/sessions/${truck2Id}/active`)
        .set('x-api-key', apiKey2);

      expect(res.status).toBe(200);
      expect(res.body.unlock).toBe(false);

      // Confere que expireStaleSessions marcou a sessão como expired
      const { rows } = await db.query('SELECT status FROM fueling_sessions WHERE id = $1', [sessionId]);
      expect(rows[0].status).toBe('expired');
    });

    it('Retorna unlock=false quando a sessão já está "completed"', async () => {
      await createSession('completed', truck2Id);

      const res = await request(app)
        .get(`/api/fueling/sessions/${truck2Id}/active`)
        .set('x-api-key', apiKey2);

      expect(res.status).toBe(200);
      expect(res.body.unlock).toBe(false);
      expect(res.body.session_id).toBeNull();
    });

    it('Responde 401 quando chave de hardware está ausente, inválida ou revogada', async () => {
      // Chave ausente
      const resMissing = await request(app)
        .get(`/api/fueling/sessions/${truck1Id}/active`);
      expect(resMissing.status).toBe(401);

      // Chave inválida
      const resInvalid = await request(app)
        .get(`/api/fueling/sessions/${truck1Id}/active`)
        .set('x-api-key', 'chave_inexistente_12345');
      expect(resInvalid.status).toBe(401);

      // Chave revogada no banco
      const tRevokedRes = await db.query(
        `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters)
         VALUES ($1, 'Volvo Revoked', 500, 100) RETURNING id`,
        [randomPlate()]
      );
      const revokedTruckId = tRevokedRes.rows[0].id;
      const revokedKey = await provisionHardwareKey(revokedTruckId);

      // Revoga limpando hash/prefixo
      await db.query(
        'UPDATE trucks SET api_key_hash = NULL, api_key_prefix = NULL WHERE id = $1',
        [revokedTruckId]
      );

      const resRevoked = await request(app)
        .get(`/api/fueling/sessions/${revokedTruckId}/active`)
        .set('x-api-key', revokedKey);
      expect(resRevoked.status).toBe(401);
    });

    it('Prova que SÓ sessão autorizada/ativa do caminhão correto responde unlock=true', async () => {
      // Cria sessão authorized no caminhão 1
      const session1Id = await createSession('authorized', truck1Id);

      // Caminhão 1 com chave 1 consulta seu status => unlock = true
      const resTruck1 = await request(app)
        .get(`/api/fueling/sessions/${truck1Id}/active`)
        .set('x-api-key', apiKey1);

      expect(resTruck1.status).toBe(200);
      expect(resTruck1.body.unlock).toBe(true);
      expect(resTruck1.body.session_id).toBe(session1Id);
      expect(resTruck1.body.status).toBe('authorized');

      // Chave 2 tentando consultar caminhão 1 => 403 (chave não pertence a este caminhão)
      const resWrongTruck = await request(app)
        .get(`/api/fueling/sessions/${truck1Id}/active`)
        .set('x-api-key', apiKey2);

      expect(resWrongTruck.status).toBe(403);
      expect(resWrongTruck.body.error).toMatch(/não pertence/i);
    });
  });

  // =========================================================================
  // BLOCO 4: reinício e eventos
  // =========================================================================
  describe('BLOCO 4 — reinício e eventos', () => {
    it('(a) Placa reinicia no meio: sessão active, nova consulta recebe unlock=true e envia finish normalmente', async () => {
      const sessionId = await createSession('active', truck1Id);

      // Simulação: placa reiniciou, faz nova consulta ao endpoint active
      const rebootCheck = await request(app)
        .get(`/api/fueling/sessions/${truck1Id}/active`)
        .set('x-api-key', apiKey1);

      expect(rebootCheck.status).toBe(200);
      expect(rebootCheck.body.unlock).toBe(true);
      expect(rebootCheck.body.session_id).toBe(sessionId);
      expect(rebootCheck.body.status).toBe('active');

      // Placa envia finish normalmente após reinício
      const finishRes = await request(app)
        .post(`/api/fueling/sessions/${sessionId}/finish`)
        .set('x-api-key', apiKey1)
        .send({ level_before: 100, level_after: 175 });

      expect(finishRes.status).toBe(200);
      expect(finishRes.body.success).toBe(true);
      expect(finishRes.body.volume_liters).toBe(75);
    });

    it('(b) Depois do finish, a placa reiniciada consulta active e recebe unlock=false (não reabre)', async () => {
      // Limpa sessões antigas que possam estar abertas para este caminhão
      await db.query("UPDATE fueling_sessions SET status = 'cancelled' WHERE truck_id = $1 AND status IN ('requested','authorized','active')", [truck1Id]);

      const sessionId = await createSession('active', truck1Id);

      // Finaliza a sessão
      await request(app)
        .post(`/api/fueling/sessions/${sessionId}/finish`)
        .set('x-api-key', apiKey1)
        .send({ level_before: 100, level_after: 150 });

      // Placa reiniciada ou ligando novamente consulta active
      const postFinishCheck = await request(app)
        .get(`/api/fueling/sessions/${truck1Id}/active`)
        .set('x-api-key', apiKey1);

      expect(postFinishCheck.status).toBe(200);
      expect(postFinishCheck.body.unlock).toBe(false);
      expect(postFinishCheck.body.session_id).toBeNull();
    });

    it('(c) Violação (tamper) durante sessão ativa: gera alerta crítico e o finish ainda conclui', async () => {
      // Limpa sessões antigas para este caminhão
      await db.query("UPDATE fueling_sessions SET status = 'cancelled' WHERE truck_id = $1 AND status IN ('requested','authorized','active')", [truck1Id]);

      const sessionId = await createSession('active', truck1Id);

      // Placa detecta e envia evento de violação (tamper) durante o abastecimento
      const tamperRes = await request(app)
        .post(`/api/fleet/${truck1Id}/security-events`)
        .set('x-api-key', apiKey1)
        .send({
          type: 'tamper',
          severity: 'critical',
          source: 'device',
          payload: { detail: 'sensor de tampa acionado indevidamente' }
        });

      expect(tamperRes.status).toBe(201);

      // Verifica que o caminhão entrou em security_alert
      const { rows: truckAfterTamper } = await db.query(
        'SELECT status FROM trucks WHERE id = $1',
        [truck1Id]
      );
      expect(truckAfterTamper[0].status).toBe('security_alert');

      // Verifica alerta crítico criado no banco (securityService grava com prefixo security_tamper)
      const { rows: alerts } = await db.query(
        "SELECT * FROM fleet_alerts WHERE truck_id = $1 AND type = 'security_tamper'",
        [truck1Id]
      );
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe('critical');

      // O abastecimento ainda conclui com êxito
      const finishRes = await request(app)
        .post(`/api/fueling/sessions/${sessionId}/finish`)
        .set('x-api-key', apiKey1)
        .send({ level_before: 100, level_after: 160 });

      expect(finishRes.status).toBe(200);
      expect(finishRes.body.success).toBe(true);

      // Status do caminhão NÃO é revertido para 'ok' porque o alerta de segurança continua aberto
      const { rows: truckAfterFinish } = await db.query(
        'SELECT status FROM trucks WHERE id = $1',
        [truck1Id]
      );
      expect(truckAfterFinish[0].status).toBe('security_alert');
    });

    it('(d) Telemetria com valores inválidos e coordenadas fora do intervalo; timestamp não é aceito pelo endpoint (registrado como não aplicável)', async () => {
      // 1. Valores não finitos / inválidos => 400
      const resInvalid = await request(app)
        .post(`/api/fleet/${truck1Id}/telemetry`)
        .set('x-api-key', apiKey1)
        .send({
          fuel_level_liters: 'invalido',
          lat: -23.55,
          lng: -46.63,
          speed_kmh: 0
        });

      expect(resInvalid.status).toBe(400);
      expect(resInvalid.body.error).toBe('Valores de telemetria inválidos');

      // 2. Coordenadas fora do intervalo (lat > 90) => 400
      const resBadLat = await request(app)
        .post(`/api/fleet/${truck1Id}/telemetry`)
        .set('x-api-key', apiKey1)
        .send({
          lat: 95.0,
          lng: -46.63
        });

      expect(resBadLat.status).toBe(400);
      expect(resBadLat.body.error).toBe('Coordenadas fora do intervalo válido');

      // 3. Coordenadas fora do intervalo (lng > 180) => 400
      const resBadLng = await request(app)
        .post(`/api/fleet/${truck1Id}/telemetry`)
        .set('x-api-key', apiKey1)
        .send({
          lat: -23.55,
          lng: -185.0
        });

      expect(resBadLng.status).toBe(400);
      expect(resBadLng.body.error).toBe('Coordenadas fora do intervalo válido');

      // 4. Timestamp do payload:
      // O controller fleetController.js (linhas 283-315) NÃO aceita nem extrai timestamp do corpo da requisição
      // (a tabela telemetry_logs insere automaticamente NOW() via default do banco).
      // Conforme especificação: "se o endpoint aceitar timestamp; se não aceitar, registre 'não aplicável'".
      // Registro: "não aplicável" (o endpoint descarta qualquer campo de timestamp enviado e usa o relógio do servidor).
      const resTimestampIgnored = await request(app)
        .post(`/api/fleet/${truck1Id}/telemetry`)
        .set('x-api-key', apiKey1)
        .send({
          timestamp: '2099-01-01T00:00:00Z',
          fuel_level_liters: 150,
          lat: -23.55,
          lng: -46.63,
          speed_kmh: 40
        });

      expect(resTimestampIgnored.status).toBe(200);
      expect(resTimestampIgnored.body.success).toBe(true);
    });
  });
});
