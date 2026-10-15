const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

const clean = require('./clean');

describe('Driver History API (GET /api/fueling/history)', () => {
  let driverAId, driverAToken;
  let driverBId, driverBToken;
  let auditorToken, managerToken;
  let truckAId, truckBId;
  let stationId;

  beforeAll(async () => {
    await clean();

    // Cria Motorista A
    const drvA = await db.query(
      "INSERT INTO drivers (name, email, password_hash, is_active) VALUES ('Driver A', 'drva@test.com', 'hash', true) RETURNING id"
    );
    driverAId = drvA.rows[0].id;
    driverAToken = jwt.sign({ id: driverAId, role: 'driver' }, process.env.JWT_SECRET);

    // Cria Motorista B
    const drvB = await db.query(
      "INSERT INTO drivers (name, email, password_hash, is_active) VALUES ('Driver B', 'drvb@test.com', 'hash', true) RETURNING id"
    );
    driverBId = drvB.rows[0].id;
    driverBToken = jwt.sign({ id: driverBId, role: 'driver' }, process.env.JWT_SECRET);

    // Cria Usuário Auditor e Gestor
    const aud = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Auditor', 'aud@test.com', 'hash', 'auditor') RETURNING id"
    );
    auditorToken = jwt.sign({ id: aud.rows[0].id, role: 'auditor' }, process.env.JWT_SECRET);

    const mgr = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Gestor', 'mgr@test.com', 'hash', 'manager') RETURNING id"
    );
    managerToken = jwt.sign({ id: mgr.rows[0].id, role: 'manager' }, process.env.JWT_SECRET);

    // Posto
    const st = await db.query(
      "INSERT INTO fuel_stations (name, lat, lng) VALUES ('Posto Rodovia', -23.5, -46.6) RETURNING id"
    );
    stationId = st.rows[0].id;

    // Caminhões
    const trkA = await db.query(
      "INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id) VALUES ('TRK-0001', 'Volvo FH', 500, 200, 'key_a', $1) RETURNING id",
      [stationId]
    );
    truckAId = trkA.rows[0].id;

    const trkB = await db.query(
      "INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id) VALUES ('TRK-0002', 'Scania R', 600, 300, 'key_b', $1) RETURNING id",
      [stationId]
    );
    truckBId = trkB.rows[0].id;

    await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [driverAId, truckAId]);
    await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [driverBId, truckBId]);
  });

  beforeEach(async () => {
    await db.query("DELETE FROM fueling_logs");
  });

  it('Isolamento entre dois motoristas (um nunca vê logs do outro)', async () => {
    // Insere logs para Motorista A
    await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, timestamp, volume_liters, duration_minutes, release_method, station_name, data_source)
       VALUES ($1, $2, NOW() - INTERVAL '1 hour', 40.0, 10.0, 'facial', 'Posto Alpha', 'manager')`,
      [driverAId, truckAId]
    );

    // Insere logs para Motorista B
    await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, timestamp, volume_liters, duration_minutes, release_method, station_name, data_source)
       VALUES ($1, $2, NOW() - INTERVAL '2 hours', 75.0, 18.0, 'facial', 'Posto Beta', 'manager')`,
      [driverBId, truckBId]
    );

    // Requisição com token de Driver A
    const resA = await request(app)
      .get('/api/fueling/history')
      .set('Authorization', 'Bearer ' + driverAToken);

    expect(resA.status).toBe(200);
    expect(resA.body.items).toHaveLength(1);
    expect(resA.body.items[0].truck_plate).toBe('TRK-0001');
    expect(resA.body.items[0].station_name).toBe('Posto Alpha');
    expect(resA.body.items[0].volume_liters).toBe(40.0);
    expect(resA.body.total).toBe(1);

    // Requisição com token de Driver B
    const resB = await request(app)
      .get('/api/fueling/history')
      .set('Authorization', 'Bearer ' + driverBToken);

    expect(resB.status).toBe(200);
    expect(resB.body.items).toHaveLength(1);
    expect(resB.body.items[0].truck_plate).toBe('TRK-0002');
    expect(resB.body.items[0].station_name).toBe('Posto Beta');
    expect(resB.body.items[0].volume_liters).toBe(75.0);
    expect(resB.body.total).toBe(1);
  });

  it('Ordenação e paginação (página 2 sem repetir itens, estável por timestamp DESC, id DESC)', async () => {
    // Insere 5 logs para Driver A com horários decrescentes
    for (let i = 1; i <= 5; i++) {
      await db.query(
        `INSERT INTO fueling_logs (id, driver_id, truck_id, timestamp, volume_liters, duration_minutes, release_method, station_name, data_source)
         VALUES ($1, $2, $3, NOW() - ($4 * INTERVAL '1 day'), $5, 10.0, 'facial', 'Posto Paginacao', 'manager')`,
        [100 + i, driverAId, truckAId, i, 10 * i]
      );
    }

    // Página 1 com limit 2
    const resPage1 = await request(app)
      .get('/api/fueling/history?page=1&limit=2')
      .set('Authorization', 'Bearer ' + driverAToken);

    expect(resPage1.status).toBe(200);
    expect(resPage1.body.items).toHaveLength(2);
    expect(resPage1.body.page).toBe(1);
    expect(resPage1.body.limit).toBe(2);
    expect(resPage1.body.total).toBe(5);

    const page1Ids = resPage1.body.items.map((it) => it.id);
    expect(page1Ids).toEqual([101, 102]); // 1 day ago, 2 days ago

    // Página 2 com limit 2
    const resPage2 = await request(app)
      .get('/api/fueling/history?page=2&limit=2')
      .set('Authorization', 'Bearer ' + driverAToken);

    expect(resPage2.status).toBe(200);
    expect(resPage2.body.items).toHaveLength(2);
    expect(resPage2.body.page).toBe(2);
    expect(resPage2.body.limit).toBe(2);
    expect(resPage2.body.total).toBe(5);

    const page2Ids = resPage2.body.items.map((it) => it.id);
    expect(page2Ids).toEqual([103, 104]); // 3 days ago, 4 days ago

    // Sem sobreposição entre páginas
    for (const id of page2Ids) {
      expect(page1Ids).not.toContain(id);
    }

    // Página 3 com limit 2
    const resPage3 = await request(app)
      .get('/api/fueling/history?page=3&limit=2')
      .set('Authorization', 'Bearer ' + driverAToken);

    expect(resPage3.status).toBe(200);
    expect(resPage3.body.items).toHaveLength(1);
    expect(resPage3.body.items[0].id).toBe(105);
  });

  it('Volume null quando "unverified" e não-nulo nos demais data_source', async () => {
    // Log unverified
    await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, timestamp, volume_liters, duration_minutes, release_method, station_name, data_source)
       VALUES ($1, $2, NOW() - INTERVAL '1 hour', 50.0, 15.0, 'facial', 'Posto Unverified', 'unverified')`,
      [driverAId, truckAId]
    );

    // Log simulated
    await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, timestamp, volume_liters, duration_minutes, release_method, station_name, data_source)
       VALUES ($1, $2, NOW() - INTERVAL '2 hours', 40.0, 12.0, 'facial', 'Posto Simulated', 'simulated')`,
      [driverAId, truckAId]
    );

    // Log manager
    await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, timestamp, volume_liters, duration_minutes, release_method, station_name, data_source)
       VALUES ($1, $2, NOW() - INTERVAL '3 hours', 30.0, 10.0, 'facial', 'Posto Manager', 'manager')`,
      [driverAId, truckAId]
    );

    const res = await request(app)
      .get('/api/fueling/history')
      .set('Authorization', 'Bearer ' + driverAToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);

    const unverifiedItem = res.body.items.find((it) => it.station_name === 'Posto Unverified');
    expect(unverifiedItem.volume_liters).toBeNull();
    expect(unverifiedItem.duration_minutes).toBe(15.0);

    const simulatedItem = res.body.items.find((it) => it.station_name === 'Posto Simulated');
    expect(simulatedItem.volume_liters).toBe(40.0);

    const managerItem = res.body.items.find((it) => it.station_name === 'Posto Manager');
    expect(managerItem.volume_liters).toBe(30.0);
  });

  it('Summary cobre apenas os últimos 30 dias (log de 40 dias fica de fora) e desconsidera unverified na soma', async () => {
    // Log de 10 dias atrás (dentro dos 30 dias): 25.0 litros
    await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, timestamp, volume_liters, duration_minutes, release_method, station_name, data_source)
       VALUES ($1, $2, NOW() - INTERVAL '10 days', 25.0, 10.0, 'facial', 'Posto 10d', 'manager')`,
      [driverAId, truckAId]
    );

    // Log de 5 dias atrás unverified: 50.0 litros (não deve somar litros)
    await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, timestamp, volume_liters, duration_minutes, release_method, station_name, data_source)
       VALUES ($1, $2, NOW() - INTERVAL '5 days', 50.0, 10.0, 'facial', 'Posto 5d', 'unverified')`,
      [driverAId, truckAId]
    );

    // Log de 40 dias atrás: 100.0 litros (fora dos 30 dias: não deve somar count nem litros no summary)
    await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, timestamp, volume_liters, duration_minutes, release_method, station_name, data_source)
       VALUES ($1, $2, NOW() - INTERVAL '40 days', 100.0, 20.0, 'facial', 'Posto 40d', 'manager')`,
      [driverAId, truckAId]
    );

    const res = await request(app)
      .get('/api/fueling/history')
      .set('Authorization', 'Bearer ' + driverAToken);

    expect(res.status).toBe(200);
    // Total geral é 3
    expect(res.body.total).toBe(3);
    // Summary dos últimos 30 dias: count = 2 (10d + 5d), total_liters = 25.0 (5d unverified tem volume nulo)
    expect(res.body.summary).toEqual({
      count: 2,
      total_liters: 25.0,
    });
  });

  it('Auditor recebe resposta real do middleware (403 Acesso restrito ao app do motorista)', async () => {
    const res = await request(app)
      .get('/api/fueling/history')
      .set('Authorization', 'Bearer ' + auditorToken);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Acesso restrito ao app do motorista');
  });

  it('Gestor recebe resposta real do middleware (403 Acesso restrito ao app do motorista)', async () => {
    const res = await request(app)
      .get('/api/fueling/history')
      .set('Authorization', 'Bearer ' + managerToken);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Acesso restrito ao app do motorista');
  });

  it('Parâmetros inválidos de page e limit retornam 400 com literais esperados', async () => {
    const r1 = await request(app)
      .get('/api/fueling/history?page=0')
      .set('Authorization', 'Bearer ' + driverAToken);
    expect(r1.status).toBe(400);
    expect(r1.body.error).toBe('page inválido');

    const r2 = await request(app)
      .get('/api/fueling/history?page=-5')
      .set('Authorization', 'Bearer ' + driverAToken);
    expect(r2.status).toBe(400);
    expect(r2.body.error).toBe('page inválido');

    const r3 = await request(app)
      .get('/api/fueling/history?page=abc')
      .set('Authorization', 'Bearer ' + driverAToken);
    expect(r3.status).toBe(400);
    expect(r3.body.error).toBe('page inválido');

    const r4 = await request(app)
      .get('/api/fueling/history?limit=0')
      .set('Authorization', 'Bearer ' + driverAToken);
    expect(r4.status).toBe(400);
    expect(r4.body.error).toBe('limit inválido');

    const r5 = await request(app)
      .get('/api/fueling/history?limit=xyz')
      .set('Authorization', 'Bearer ' + driverAToken);
    expect(r5.status).toBe(400);
    expect(r5.body.error).toBe('limit inválido');
  });

  it('Limit maior que 50 é limitado automaticamente a 50', async () => {
    const res = await request(app)
      .get('/api/fueling/history?limit=99')
      .set('Authorization', 'Bearer ' + driverAToken);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(50);
  });
});
