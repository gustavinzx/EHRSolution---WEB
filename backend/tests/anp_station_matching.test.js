const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../src/config/db');
const { app } = require('../src/index');
const stationMatcher = require('../src/services/stationMatcher');
const { checkAndProcessSessions } = require('../src/services/virtualHardware');
const { simulateFleet } = require('../src/services/simulator');
const { loadSession, safeSessionProjection } = require('../src/controllers/fuelingController');
const { getFleetSnapshot, getLiveEvents } = require('../src/services/fleetDataProvider');
const clean = require('./clean');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

describe('ANP Station Matching (Bloco A, B, C, E)', () => {
  let tokenManager;
  let tokenDriver;
  let managerId;
  let driverId;
  let truckId;
  const hwKey = 'hw_key_anp_matching_test_123';
  let fetchSpy;

  beforeAll(async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'Ok',
        routes: [
          {
            distance: 5000,
            duration: 300,
            geometry: {
              coordinates: [
                [-48.0158659, -15.7944167],
                [-48.0168659, -15.7954167]
              ]
            }
          }
        ]
      })
    }));

    await clean();
    await db.query('DELETE FROM anp_stations');
    await db.query('DELETE FROM anp_sync_runs');

    const uRes = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Gestor ANP Match', 'gestor.match@test.com', 'hash', 'manager') RETURNING id"
    );
    managerId = uRes.rows[0].id;
    tokenManager = jwt.sign(
      { id: managerId, email: 'gestor.match@test.com', role: 'manager' },
      process.env.JWT_SECRET
    );

    const dRes = await db.query(
      "INSERT INTO drivers (name, email, phone, password_hash, face_enrolled, face_template_ref, is_active) VALUES ('Motorista Match', 'driver.match@test.com', '61999990000', 'hash', true, 'FACE:match_driver_ok', true) RETURNING id"
    );
    driverId = dRes.rows[0].id;
    tokenDriver = jwt.sign({ id: driverId, role: 'driver' }, process.env.JWT_SECRET);

    const tRes = await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, lat, lng, api_key, status, sim_state)
       VALUES ('ANP1A23', 'Volvo FH 540', 600, 200, -15.7944167, -48.0158659, $1, 'ok', 'idle')
       RETURNING id`,
      [hwKey]
    );
    truckId = tRes.rows[0].id;

    await db.query('INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)', [driverId, truckId]);
  });

  afterAll(async () => {
    if (fetchSpy) {
      fetchSpy.mockRestore();
    }
    await clean();
    await db.query('DELETE FROM anp_stations');
  });

  describe('E1) Unitários de stationMatcher', () => {
    beforeEach(async () => {
      await db.query('DELETE FROM fueling_logs');
      await db.query('DELETE FROM fueling_sessions');
      await db.query('DELETE FROM anp_stations');
    });

    it('posto a ~40m => matched com distanceM ~40 e o mais próximo escolhido quando há 2 candidatos', async () => {
      const originLat = -15.7944167;
      const originLng = -48.0158659;
      // ~40 metros ao norte (~0.00036 graus de latitude)
      const lat40m = originLat + (40 / 111320);
      // ~110 metros ao norte (~0.00099 graus de latitude)
      const lat110m = originLat + (110 / 111320);

      const sFar = await db.query(
        `INSERT INTO anp_stations (cnpj, razao_social, uf, municipio, bandeira, lat, lng, situacao_sigaf, is_active)
         VALUES ('11111111000101', 'POSTO MAIS DISTANTE 110M LTDA', 'DF', 'BRASILIA', 'VIBRA', $1, $2, NULL, true)
         RETURNING id`,
        [lat110m, originLng]
      );
      const sNear = await db.query(
        `INSERT INTO anp_stations (cnpj, razao_social, uf, municipio, bandeira, lat, lng, situacao_sigaf, is_active)
         VALUES ('22222222000102', 'POSTO MAIS PROXIMO 40M LTDA', 'DF', 'BRASILIA', 'IPIRANGA', $1, $2, 'Desinterdição', true)
         RETURNING id`,
        [lat40m, originLng]
      );

      const res = await stationMatcher.resolveStation({ lat: originLat, lng: originLng, radiusM: 150 });
      expect(res.status).toBe('matched');
      expect(res.station).not.toBeNull();
      expect(res.station.id).toBe(sNear.rows[0].id);
      expect(res.station.id).not.toBe(sFar.rows[0].id);
      expect(res.station.cnpj).toBe('22222222000102');
      expect(res.station.razao_social).toBe('POSTO MAIS PROXIMO 40M LTDA');
      expect(res.station.interdicted).toBe(false);
      expect(res.distanceM).toBeGreaterThanOrEqual(38);
      expect(res.distanceM).toBeLessThanOrEqual(42);
    });

    it('posto a ~300m (fora do raio 150m) => unrecognized', async () => {
      const originLat = -15.7944167;
      const originLng = -48.0158659;
      const lat300m = originLat + (300 / 111320);

      await db.query(
        `INSERT INTO anp_stations (cnpj, razao_social, uf, municipio, bandeira, lat, lng, is_active)
         VALUES ('33333333000103', 'POSTO A 300M LTDA', 'DF', 'BRASILIA', 'SHELL', $1, $2, true)`,
        [lat300m, originLng]
      );

      const res = await stationMatcher.resolveStation({ lat: originLat, lng: originLng, radiusM: 150 });
      expect(res).toEqual({
        status: 'unrecognized',
        station: null,
        distanceM: null
      });
    });

    it('posto inativo a 20m => ignorado', async () => {
      const originLat = -15.7944167;
      const originLng = -48.0158659;
      const lat20m = originLat + (20 / 111320);

      await db.query(
        `INSERT INTO anp_stations (cnpj, razao_social, uf, municipio, bandeira, lat, lng, is_active)
         VALUES ('44444444000104', 'POSTO INATIVO 20M LTDA', 'DF', 'BRASILIA', 'BRANCA', $1, $2, false)`,
        [lat20m, originLng]
      );

      const res = await stationMatcher.resolveStation({ lat: originLat, lng: originLng, radiusM: 150 });
      expect(res).toEqual({
        status: 'unrecognized',
        station: null,
        distanceM: null
      });
    });

    it('posto sem coordenadas => ignorado por geo, mas encontrado por CNPJ se passado', async () => {
      const originLat = -15.7944167;
      const originLng = -48.0158659;

      const sNoGeo = await db.query(
        `INSERT INTO anp_stations (cnpj, razao_social, uf, municipio, bandeira, lat, lng, situacao_sigaf, is_active)
         VALUES ('55555555000105', 'POSTO SEM COORDENADAS LTDA', 'DF', 'BRASILIA', 'VIBRA', NULL, NULL, NULL, true)
         RETURNING id`
      );

      const resGeoOnly = await stationMatcher.resolveStation({ lat: originLat, lng: originLng, radiusM: 150 });
      expect(resGeoOnly.status).toBe('unrecognized');
      expect(resGeoOnly.station).toBeNull();

      const resByCnpj = await stationMatcher.resolveStation({
        lat: null,
        lng: null,
        cnpj: '55.555.555/0001-05'
      });
      expect(resByCnpj.status).toBe('matched');
      expect(resByCnpj.station.id).toBe(sNoGeo.rows[0].id);
      expect(resByCnpj.station.cnpj).toBe('55555555000105');
      expect(resByCnpj.distanceM).toBeNull();

      // E quando há coordenadas do caminhão junto com CNPJ de posto sem coordenadas:
      const resByCnpjWithTruckGeo = await stationMatcher.resolveStation({
        lat: originLat,
        lng: originLng,
        cnpj: '55555555000105'
      });
      expect(resByCnpjWithTruckGeo.status).toBe('matched');
      expect(resByCnpjWithTruckGeo.station.id).toBe(sNoGeo.rows[0].id);
      expect(resByCnpjWithTruckGeo.distanceM).toBeNull();
    });

    it('lat/lng nulos ou fora do globo => no_position', async () => {
      await db.query(
        `INSERT INTO anp_stations (cnpj, razao_social, uf, municipio, bandeira, lat, lng, is_active)
         VALUES ('66666666000106', 'POSTO NORMAL LTDA', 'DF', 'BRASILIA', 'VIBRA', -15.7944167, -48.0158659, true)`
      );

      const rNull = await stationMatcher.resolveStation({ lat: null, lng: null });
      expect(rNull).toEqual({ status: 'no_position', station: null, distanceM: null });

      const rOutLat = await stationMatcher.resolveStation({ lat: -95.0, lng: -48.0 });
      expect(rOutLat).toEqual({ status: 'no_position', station: null, distanceM: null });

      const rOutLng = await stationMatcher.resolveStation({ lat: -15.0, lng: 195.0 });
      expect(rOutLng).toEqual({ status: 'no_position', station: null, distanceM: null });

      const rZeroZero = await stationMatcher.resolveStation({ lat: 0, lng: 0 });
      expect(rZeroZero).toEqual({ status: 'no_position', station: null, distanceM: null });
    });

    it('STATION_MATCH_RADIUS_M inválido => erro fatal no boot (validateStationMatchRadius)', () => {
      expect(stationMatcher.validateStationMatchRadius(undefined)).toBe(150);
      expect(stationMatcher.validateStationMatchRadius('')).toBe(150);
      expect(stationMatcher.validateStationMatchRadius('30')).toBe(30);
      expect(stationMatcher.validateStationMatchRadius('1000')).toBe(1000);

      expect(() => stationMatcher.validateStationMatchRadius('29')).toThrow(/STATION_MATCH_RADIUS_M inválido/);
      expect(() => stationMatcher.validateStationMatchRadius('1001')).toThrow(/STATION_MATCH_RADIUS_M inválido/);
      expect(() => stationMatcher.validateStationMatchRadius('abc')).toThrow(/STATION_MATCH_RADIUS_M inválido/);
      expect(() => stationMatcher.validateStationMatchRadius('-50')).toThrow(/STATION_MATCH_RADIUS_M inválido/);
    });
  });

  describe('E2) Integração no fluxo de sessão, logs, alertas e simuladores', () => {
    const baseLat = -15.7944167;
    const baseLng = -48.0158659;
    const validFaceJpegBase64 = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from('MATCH')
    ]).toString('base64');

    async function createAndAuthorizeDriverSession() {
      const reqRes = await request(app)
        .post('/api/fueling/sessions')
        .set('Authorization', 'Bearer ' + tokenDriver)
        .send({ truck_id: truckId, driver_id: driverId });
      expect(reqRes.status).toBe(201);
      const sessionId = reqRes.body.id;

      const vfRes = await request(app)
        .post(`/api/fueling/sessions/${sessionId}/verify-face`)
        .set('Authorization', 'Bearer ' + tokenDriver)
        .send({ image_base64: validFaceJpegBase64 });
      expect(vfRes.status).toBe(200);
      expect(vfRes.body.verified).toBe(true);

      const authRes = await request(app)
        .post(`/api/fueling/sessions/${sessionId}/authorize`)
        .set('Authorization', 'Bearer ' + tokenDriver)
        .send({});
      expect(authRes.status).toBe(200);
      return sessionId;
    }

    beforeEach(async () => {
      await db.query('DELETE FROM facial_attempts');
      await db.query('DELETE FROM fleet_alerts');
      await db.query('DELETE FROM fueling_logs');
      await db.query('DELETE FROM fueling_sessions');
      await db.query('DELETE FROM anp_stations');
      await db.query(
        `UPDATE trucks SET lat = $1, lng = $2, current_level_liters = 200, status = 'ok', sim_state = 'idle', route_phase = 'planned', fuel_station_id = NULL WHERE id = $3`,
        [baseLat, baseLng, truckId]
      );
    });

    it('authorize + finish (hardware ou manager) perto de um anp_station ativo grava anp_station_id, station_match_status = matched e station_match_distance_m em fueling_sessions e fueling_logs, e aparece em GET /api/fueling com station_match', async () => {
      const lat35m = baseLat + (35 / 111320);
      const stRes = await db.query(
        `INSERT INTO anp_stations (cnpj, razao_social, uf, municipio, bandeira, lat, lng, situacao_sigaf, is_active)
         VALUES ('77777777000107', 'AUTO POSTO EIXO SUL LTDA', 'DF', 'BRASILIA', 'VIBRA', $1, $2, 'Desinterdição', true)
         RETURNING id`,
        [lat35m, baseLng]
      );
      const anpId = stRes.rows[0].id;

      const sessionId = await createAndAuthorizeDriverSession();

      // Conferir colunas gravadas em fueling_sessions no banco
      const { rows: sessDb } = await db.query(
        `SELECT anp_station_id, station_match_status, station_match_distance_m, station_match_source
         FROM fueling_sessions WHERE id = $1`,
        [sessionId]
      );
      expect(sessDb[0].anp_station_id).toBe(anpId);
      expect(sessDb[0].station_match_status).toBe('matched');
      expect(sessDb[0].station_match_source).toBe('truck_telemetry');
      expect(Number(sessDb[0].station_match_distance_m)).toBeGreaterThanOrEqual(33);
      expect(Number(sessDb[0].station_match_distance_m)).toBeLessThanOrEqual(37);

      // Finalizar sessão via hardware (x-api-key)
      const finRes = await request(app)
        .post(`/api/fueling/sessions/${sessionId}/finish`)
        .set('x-api-key', hwKey)
        .send({ level_before: 200, level_after: 450, pump_liters: 250 });
      expect(finRes.status).toBe(200);

      // Conferir colunas copiadas para fueling_logs no banco
      const { rows: logDb } = await db.query(
        `SELECT anp_station_id, station_match_status, station_match_distance_m, station_match_source, data_source
         FROM fueling_logs WHERE session_id = $1`,
        [sessionId]
      );
      expect(logDb.length).toBe(1);
      expect(logDb[0].anp_station_id).toBe(anpId);
      expect(logDb[0].station_match_status).toBe('matched');
      expect(logDb[0].station_match_source).toBe('truck_telemetry');
      expect(logDb[0].data_source).toBe('hardware');
      expect(Number(logDb[0].station_match_distance_m)).toBeCloseTo(Number(sessDb[0].station_match_distance_m), 1);

      // Nenhum alerta de posto não reconhecido ou interditado deve ter sido criado
      const { rows: alertsDb } = await db.query(
        `SELECT type FROM fleet_alerts WHERE truck_id = $1 AND type IN ('unrecognized_station', 'unauthorized_station')`,
        [truckId]
      );
      expect(alertsDb.length).toBe(0);

      // Conferir GET /api/fueling no painel do gestor
      const listRes = await request(app)
        .get(`/api/fueling?truck_id=${truckId}`)
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(listRes.status).toBe(200);
      expect(listRes.body.length).toBe(1);
      expect(listRes.body[0].station_match).toEqual({
        status: 'matched',
        distance_m: Number(sessDb[0].station_match_distance_m),
        station: {
          cnpj: '77777777000107',
          razao_social: 'AUTO POSTO EIXO SUL LTDA',
          municipio: 'BRASILIA',
          uf: 'DF',
          bandeira: 'VIBRA'
        }
      });
    });

    it('longe de qualquer anp_station e data_source = hardware => station_match_status = unrecognized e cria 1 alerta unrecognized_station (dedup: segundo log em <2h não duplica)', async () => {
      await db.query(
        `INSERT INTO anp_stations (cnpj, razao_social, uf, municipio, bandeira, lat, lng, is_active)
         VALUES ('88888888000108', 'POSTO DISTANTE SP LTDA', 'SP', 'SAO PAULO', 'SHELL', -23.55052, -46.633308, true)`
      );

      // Sessão 1
      const sess1 = await createAndAuthorizeDriverSession();

      const fin1 = await request(app)
        .post(`/api/fueling/sessions/${sess1}/finish`)
        .set('x-api-key', hwKey)
        .send({ level_before: 200, level_after: 300, pump_liters: 100 });
      expect(fin1.status).toBe(200);

      const { rows: alertsAfter1 } = await db.query(
        `SELECT id, type, severity, message FROM fleet_alerts WHERE truck_id = $1 AND type = 'unrecognized_station'`,
        [truckId]
      );
      expect(alertsAfter1.length).toBe(1);
      expect(alertsAfter1[0].severity).toBe('high');

      // Sessão 2 (<2h depois no mesmo caminhão) => dedup impede segundo alerta
      const sess2 = await createAndAuthorizeDriverSession();

      const fin2 = await request(app)
        .post(`/api/fueling/sessions/${sess2}/finish`)
        .set('x-api-key', hwKey)
        .send({ level_before: 300, level_after: 400, pump_liters: 100 });
      expect(fin2.status).toBe(200);

      const { rows: alertsAfter2 } = await db.query(
        `SELECT id FROM fleet_alerts WHERE truck_id = $1 AND type = 'unrecognized_station'`,
        [truckId]
      );
      expect(alertsAfter2.length).toBe(1);

      const listRes = await request(app)
        .get(`/api/fueling?truck_id=${truckId}`)
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(listRes.body[0].station_match).toEqual({
        status: 'unrecognized',
        distance_m: null,
        station: null
      });
    });

    it('longe de qualquer anp_station mas data_source = simulated (virtualHardware e simulator) => station_match_status = unrecognized, porém ZERO alerta criado', async () => {
      // 1) Fluxo via virtualHardware (data_source = 'simulated')
      const sessId = await createAndAuthorizeDriverSession();

      // Força sessão ativa há >8s para o virtualHardware finalizar
      await db.query(
        `UPDATE fueling_sessions SET status = 'active', started_at = NOW() - INTERVAL '15 seconds' WHERE id = $1`,
        [sessId]
      );
      await checkAndProcessSessions(null);

      const { rows: vhLogs } = await db.query(
        `SELECT data_source, station_match_status, station_match_source FROM fueling_logs WHERE session_id = $1`,
        [sessId]
      );
      expect(vhLogs.length).toBe(1);
      expect(vhLogs[0].data_source).toBe('simulated');
      expect(vhLogs[0].station_match_status).toBe('unrecognized');
      expect(vhLogs[0].station_match_source).toBe('truck_telemetry');

      // 2) Fluxo via simulator.js (simulateFleet em fase fueling no último tick)
      const simRoute = JSON.stringify([
        [baseLng, baseLat],
        [baseLng + 0.01, baseLat + 0.01]
      ]);
      await db.query(
        `UPDATE trucks
         SET route_geometry = $1, planned_route_geometry = $1,
             route_phase = 'fueling', sim_state = 'fueling', fueling_ticks = 5,
             lat = $2, lng = $3
         WHERE id = $4`,
        [simRoute, baseLat, baseLng, truckId]
      );

      await simulateFleet(null);

      const { rows: simLogs } = await db.query(
        `SELECT data_source, station_match_status, station_match_source
         FROM fueling_logs WHERE truck_id = $1 AND session_id IS NULL ORDER BY id DESC LIMIT 1`,
        [truckId]
      );
      expect(simLogs.length).toBe(1);
      expect(simLogs[0].data_source).toBe('simulated');
      expect(simLogs[0].station_match_status).toBe('unrecognized');
      expect(simLogs[0].station_match_source).toBe('truck_telemetry');

      // Verificar que ZERO alertas ANP foram criados para ambos os fluxos simulados
      const { rows: alerts } = await db.query(
        `SELECT id, type FROM fleet_alerts WHERE truck_id = $1 AND type IN ('unrecognized_station', 'unauthorized_station')`,
        [truckId]
      );
      expect(alerts.length).toBe(0);
    });

    it('posto casado com interdicted = true e data_source != simulated => cria alerta unauthorized_station crítico', async () => {
      const lat25m = baseLat + (25 / 111320);
      await db.query(
        `INSERT INTO anp_stations (cnpj, razao_social, uf, municipio, bandeira, lat, lng, situacao_sigaf, is_active)
         VALUES ('99999999000109', 'POSTO INTERDITADO PELA ANP LTDA', 'DF', 'BRASILIA', 'BRANCA', $1, $2, 'Interdição', true)`,
        [lat25m, baseLng]
      );

      const sessId = await createAndAuthorizeDriverSession();

      const finRes = await request(app)
        .post(`/api/fueling/sessions/${sessId}/finish`)
        .set('Authorization', 'Bearer ' + tokenManager)
        .send({ level_before: 200, level_after: 400, pump_liters: 200 });
      expect(finRes.status).toBe(200);

      const { rows: alerts } = await db.query(
        `SELECT type, severity, message FROM fleet_alerts WHERE truck_id = $1 AND type = 'unauthorized_station'`,
        [truckId]
      );
      expect(alerts.length).toBe(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].message).toContain('POSTO INTERDITADO PELA ANP LTDA');
      expect(alerts[0].message).toContain('99999999000109');
    });

    it('sem coordenadas => station_match_status = no_position e ZERO alerta', async () => {
      await db.query(`UPDATE trucks SET lat = NULL, lng = NULL WHERE id = $1`, [truckId]);

      const sessId = await createAndAuthorizeDriverSession();

      const finRes = await request(app)
        .post(`/api/fueling/sessions/${sessId}/finish`)
        .set('x-api-key', hwKey)
        .send({ level_before: 200, level_after: 350, pump_liters: 150 });
      expect(finRes.status).toBe(200);

      const { rows: logRows } = await db.query(
        `SELECT station_match_status, station_match_distance_m, station_match_source, anp_station_id
         FROM fueling_logs WHERE session_id = $1`,
        [sessId]
      );
      expect(logRows[0]).toEqual({
        station_match_status: 'no_position',
        station_match_distance_m: null,
        station_match_source: null,
        anp_station_id: null
      });

      const { rows: alerts } = await db.query(
        `SELECT id FROM fleet_alerts WHERE truck_id = $1 AND type IN ('unrecognized_station', 'unauthorized_station')`,
        [truckId]
      );
      expect(alerts.length).toBe(0);

      const listRes = await request(app)
        .get(`/api/fueling?truck_id=${truckId}`)
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(listRes.body[0].station_match).toEqual({
        status: 'no_position',
        distance_m: null,
        station: null
      });
    });
  });

  describe('E3) Contrato intocado de Driver/Hardware e ausência de vazamento em Sockets', () => {
    const EXPECTED_LOAD_SESSION_KEYS = [
      'authorized_at',
      'ble_confirmed_at',
      'ble_consumed_at',
      'completed_at',
      'data_source',
      'driver_id',
      'driver_name',
      'duration_minutes',
      'expires_at',
      'facial_attempt_id',
      'facial_consumed_at',
      'facial_verified_at',
      'id',
      'metadata',
      'model',
      'plate',
      'pump_liters',
      'release_method',
      'requested_at',
      'started_at',
      'station_id',
      'station_name',
      'status',
      'tank_liters_delta',
      'truck_id'
    ].sort();

    const EXPECTED_ACTIVE_DRIVER_KEYS = [
      'authorized_at',
      'ble_confirmed_at',
      'ble_consumed_at',
      'completed_at',
      'data_source',
      'driver_id',
      'driver_name',
      'duration_minutes',
      'expires_at',
      'facial_attempt_id',
      'facial_consumed_at',
      'facial_verified_at',
      'id',
      'metadata',
      'pump_liters',
      'release_method',
      'requested_at',
      'started_at',
      'station_id',
      'station_name',
      'status',
      'tank_liters_delta',
      'truck_id'
    ].sort();

    const EXPECTED_ACTIVE_HARDWARE_KEYS = [
      'expires_at',
      'session_id',
      'status',
      'unlock'
    ].sort();

    function assertNoAnpFieldsDeep(obj) {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.forEach(assertNoAnpFieldsDeep);
        return;
      }
      for (const k of Object.keys(obj)) {
        if (k === 'anp_station_id' || k.startsWith('station_match') || k === 'cnpj' || k.startsWith('anp_')) {
          throw new Error(`Campo ANP não permitido encontrado no payload de driver/hardware/socket: ${k}`);
        }
        assertNoAnpFieldsDeep(obj[k]);
      }
    }

    it('Respostas de driver (/sessions, /authorize, /active) e hardware (/active, /finish) têm exatamente as mesmas chaves que tinham antes e ZERO campos ANP', async () => {
      await db.query('DELETE FROM facial_attempts');
      await db.query('DELETE FROM fueling_logs');
      await db.query('DELETE FROM fueling_sessions');
      await db.query(
        `UPDATE trucks SET lat = -15.7944167, lng = -48.0158659, status = 'ok', sim_state = 'idle' WHERE id = $1`,
        [truckId]
      );
      await db.query(
        `INSERT INTO anp_stations (cnpj, razao_social, uf, municipio, bandeira, lat, lng, is_active)
         VALUES ('12121212000112', 'POSTO CONTRATO TESTE LTDA', 'DF', 'BRASILIA', 'VIBRA', -15.7944167, -48.0158659, true)
         ON CONFLICT (cnpj) DO NOTHING`
      );

      // 1. POST /api/fueling/sessions (driver)
      const createRes = await request(app)
        .post('/api/fueling/sessions')
        .set('Authorization', 'Bearer ' + tokenDriver)
        .send({ truck_id: truckId, driver_id: driverId });
      expect(createRes.status).toBe(201);
      expect(Object.keys(createRes.body).sort()).toEqual(EXPECTED_LOAD_SESSION_KEYS);
      assertNoAnpFieldsDeep(createRes.body);

      const sessId = createRes.body.id;

      // 2. POST /api/fueling/sessions/:id/verify-face (driver)
      const validFaceJpegBase64 = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        Buffer.from('MATCH')
      ]).toString('base64');
      const vfRes = await request(app)
        .post(`/api/fueling/sessions/${sessId}/verify-face`)
        .set('Authorization', 'Bearer ' + tokenDriver)
        .send({ image_base64: validFaceJpegBase64 });
      expect(vfRes.status).toBe(200);
      expect(Object.keys(vfRes.body).sort()).toEqual(['verified']);
      assertNoAnpFieldsDeep(vfRes.body);

      // 3. POST /api/fueling/sessions/:id/authorize (driver)
      const authRes = await request(app)
        .post(`/api/fueling/sessions/${sessId}/authorize`)
        .set('Authorization', 'Bearer ' + tokenDriver)
        .send({});
      expect(authRes.status).toBe(200);
      expect(Object.keys(authRes.body).sort()).toEqual(EXPECTED_LOAD_SESSION_KEYS);
      assertNoAnpFieldsDeep(authRes.body);

      // 4. GET /api/fueling/sessions/:truckId/active (driver)
      const activeDriverRes = await request(app)
        .get(`/api/fueling/sessions/${truckId}/active`)
        .set('Authorization', 'Bearer ' + tokenDriver);
      expect(activeDriverRes.status).toBe(200);
      expect(Object.keys(activeDriverRes.body).sort()).toEqual(EXPECTED_ACTIVE_DRIVER_KEYS);
      assertNoAnpFieldsDeep(activeDriverRes.body);

      // 5. GET /api/fueling/sessions/:truckId/active (hardware)
      const activeHwRes = await request(app)
        .get(`/api/fueling/sessions/${truckId}/active`)
        .set('x-api-key', hwKey);
      expect(activeHwRes.status).toBe(200);
      expect(Object.keys(activeHwRes.body).sort()).toEqual(EXPECTED_ACTIVE_HARDWARE_KEYS);
      assertNoAnpFieldsDeep(activeHwRes.body);

      // 6. POST /api/fueling/sessions/:id/finish (hardware)
      const finishRes = await request(app)
        .post(`/api/fueling/sessions/${sessId}/finish`)
        .set('x-api-key', hwKey)
        .send({ level_before: 200, level_after: 350, pump_liters: 150 });
      expect(finishRes.status).toBe(200);
      expect(Object.keys(finishRes.body).sort()).toEqual(['duration_minutes', 'success', 'volume_liters']);
      assertNoAnpFieldsDeep(finishRes.body);

      // 7. Payloads de Socket (fuelingSessionUpdate, fleetUpdate, liveEventsUpdate) não contêm anp_station_id, station_match* ou cnpj
      const loadedSession = await loadSession(sessId);
      const projectedSocketSession = safeSessionProjection(loadedSession);
      assertNoAnpFieldsDeep(loadedSession);
      assertNoAnpFieldsDeep(projectedSocketSession);

      const fleetSnap = await getFleetSnapshot();
      assertNoAnpFieldsDeep(fleetSnap);

      const liveEvents = await getLiveEvents();
      assertNoAnpFieldsDeep(liveEvents);
    });
  });
});
