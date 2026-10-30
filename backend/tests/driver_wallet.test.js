const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const { isValidLuhn, detectCardBrand } = require('../src/services/sicoobService');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

const clean = require('./clean');

describe('Driver Wallet API (GET /api/fueling/wallet - Sicoob Open Banking)', () => {
  let driverId, driverToken;
  let otherDriverToken;
  let managerToken;
  let truckId;
  let stationId;

  const addCard = (token, body) =>
    request(app)
      .post('/api/fueling/wallet/cards')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  beforeAll(async () => {
    await clean();

    const drv = await db.query(
      "INSERT INTO drivers (name, email, password_hash, is_active) VALUES ('Driver Sicoob', 'sicoob.driver@test.com', 'hash', true) RETURNING id"
    );
    driverId = drv.rows[0].id;
    driverToken = jwt.sign({ id: driverId, role: 'driver' }, process.env.JWT_SECRET);

    const other = await db.query(
      "INSERT INTO drivers (name, email, password_hash, is_active) VALUES ('Outro Motorista', 'outro.driver@test.com', 'hash', true) RETURNING id"
    );
    otherDriverToken = jwt.sign({ id: other.rows[0].id, role: 'driver' }, process.env.JWT_SECRET);

    const mgr = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Gestor Test', 'mgr.sicoob@test.com', 'hash', 'manager') RETURNING id"
    );
    managerToken = jwt.sign({ id: mgr.rows[0].id, role: 'manager' }, process.env.JWT_SECRET);

    const st = await db.query(
      "INSERT INTO fuel_stations (name, brand, lat, lng, is_authorized) VALUES ('Posto Sicoob Credifrotas', 'Shell', -15.8, -47.9, true) RETURNING id"
    );
    stationId = st.rows[0].id;

    const trk = await db.query(
      "INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id) VALUES ('SCB-1234', 'Scania R450', 500, 200, 'key_scb', $1) RETURNING id",
      [stationId]
    );
    truckId = trk.rows[0].id;

    // 2 abastecimentos no mês corrente
    await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, station_id, volume_liters, release_method, timestamp, station_name)
       VALUES ($1, $2, $3, 100.0, 'facial', NOW() - INTERVAL '2 minutes', 'Posto Sicoob Credifrotas')`,
      [driverId, truckId, stationId]
    );
    await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, station_id, volume_liters, release_method, timestamp, station_name)
       VALUES ($1, $2, $3, 50.0, 'facial', NOW() - INTERVAL '1 minute', 'Posto Sicoob Credifrotas')`,
      [driverId, truckId, stationId]
    );
    // 1 abastecimento de um mês anterior (aparece no extrato, mas não conta no consumo do mês)
    await db.query(
      `INSERT INTO fueling_logs (driver_id, truck_id, station_id, volume_liters, release_method, timestamp, station_name)
       VALUES ($1, $2, $3, 80.0, 'facial', date_trunc('month', NOW()) - INTERVAL '3 days', 'Posto Sicoob Credifrotas')`,
      [driverId, truckId, stationId]
    );
  });

  afterAll(async () => {
    await clean();
  });

  describe('helpers', () => {
    it('valida números de cartão pelo algoritmo de Luhn', () => {
      expect(isValidLuhn('4111111111111111')).toBe(true);
      expect(isValidLuhn('5555555555554444')).toBe(true);
      expect(isValidLuhn('4111111111111112')).toBe(false);
    });

    it('detecta a bandeira do cartão (Elo antes de Visa/Master)', () => {
      expect(detectCardBrand('4111111111111111')).toBe('Visa Frota');
      expect(detectCardBrand('5555555555554444')).toBe('Mastercard Frota');
      expect(detectCardBrand('6362970000457013')).toBe('Elo Frota');
      expect(detectCardBrand('4389350000000000')).toBe('Elo Frota');
    });
  });

  it('retorna 401 quando chamado sem token de autorização', async () => {
    const res = await request(app).get('/api/fueling/wallet');
    expect(res.status).toBe(401);
  });

  it('retorna 403 quando chamado por um usuário gestor (acesso exclusivo do motorista)', async () => {
    const res = await request(app)
      .get('/api/fueling/wallet')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  it('retorna carteira com consumo do mês corrente, limite e extrato', async () => {
    const res = await request(app)
      .get('/api/fueling/wallet')
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.status).toBe(200);

    expect(res.body.bank.code).toBe('756');
    expect(res.body.bank.institution).toContain('Sicoob');
    expect(res.body.bank.developerPortalUrl).toBe('https://developers.sicoob.com.br/portal/apis');
    // Status do banco é sempre not_configured até existir integração bancária real
    expect(res.body.bank.status).toBe('not_configured');

    expect(res.body.wallet.monthlyCreditLimit).toBe(5000.0);
    expect(res.body.wallet.totalLitersMonth).toBe(150.0); // 100 + 50 (mês anterior excluído)
    expect(res.body.wallet.totalSpentMonth).toBe(907.5); // 150L * R$ 6,05
    expect(res.body.wallet.balanceAvailable).toBe(4092.5);
    expect(res.body.wallet.fuelingCount).toBe(2);

    expect(res.body.activeCard).toBeNull();
    expect(res.body.cards).toEqual([]);

    expect(res.body.transactions.length).toBe(3);
    expect(res.body.transactions[0].status).toBe('estimated');
    expect(res.body.transactions[0].authProtocol).toBeUndefined();
  });

  it('cadastra cartão, persiste apenas os 4 últimos dígitos e define como padrão (limite definido pelo servidor)', async () => {
    const res = await addCard(driverToken, {
      cardHolder: 'joao silva frota',
      cardNumber: '4111 1111 1111 1111',
      expirationMonth: 12,
      expirationYear: 2035,
      monthlyLimit: 7500.0, // motorista tenta passar limite, mas servidor ignora
    });

    expect(res.status).toBe(201);
    expect(res.body.cardHolder).toBe('JOAO SILVA FROTA');
    expect(res.body.lastFour).toBe('1111');
    expect(res.body.cardBrand).toBe('Visa Frota');
    expect(res.body.monthlyLimit).toBe(5000.0); // limite padrão do servidor
    expect(res.body.isDefault).toBe(true);
    expect(res.body.cardNumber).toBeUndefined();

    const { rows } = await db.query('SELECT * FROM driver_cards WHERE id = $1', [res.body.id]);
    expect(JSON.stringify(rows[0])).not.toContain('4111111111111111');

    const wallet = await request(app)
      .get('/api/fueling/wallet')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(wallet.body.activeCard.lastFour).toBe('1111');
    expect(wallet.body.wallet.monthlyCreditLimit).toBe(5000.0);
    expect(wallet.body.wallet.balanceAvailable).toBe(4092.5);
  });

  it('usa o limite padrão quando o limite não é informado', async () => {
    const res = await addCard(driverToken, {
      cardHolder: 'JOAO SILVA',
      cardNumber: '5555555555554444',
      expirationMonth: 6,
      expirationYear: 2034,
    });
    expect(res.status).toBe(201);
    expect(res.body.monthlyLimit).toBe(5000);
    expect(res.body.cardBrand).toBe('Mastercard Frota');
  });

  it('rejeita cartão duplicado com 409', async () => {
    const res = await addCard(driverToken, {
      cardHolder: 'JOAO SILVA',
      cardNumber: '5555555555554444',
      expirationMonth: 6,
      expirationYear: 2034,
    });
    expect(res.status).toBe(409);
  });

  it('rejeita número inválido (curto ou com dígito verificador errado)', async () => {
    const short = await addCard(driverToken, {
      cardHolder: 'JOAO SILVA', cardNumber: '123', expirationMonth: 12, expirationYear: 2035,
    });
    expect(short.status).toBe(400);
    expect(short.body.error).toContain('inválido');

    const badLuhn = await addCard(driverToken, {
      cardHolder: 'JOAO SILVA', cardNumber: '4111111111111112', expirationMonth: 12, expirationYear: 2035,
    });
    expect(badLuhn.status).toBe(400);
  });

  it('rejeita cartão vencido e titular inválido', async () => {
    const expired = await addCard(driverToken, {
      cardHolder: 'JOAO SILVA', cardNumber: '4012888888881881', expirationMonth: 1, expirationYear: 2020,
    });
    expect(expired.status).toBe(400);
    expect(expired.body.error).toContain('vencido');

    const holder = await addCard(driverToken, {
      cardHolder: '12', cardNumber: '4012888888881881', expirationMonth: 1, expirationYear: 2035,
    });
    expect(holder.status).toBe(400);
  });

  it('define outro cartão como padrão e impede alterar cartão de outro motorista', async () => {
    const wallet = await request(app)
      .get('/api/fueling/wallet')
      .set('Authorization', `Bearer ${driverToken}`);
    const nonDefault = wallet.body.cards.find((c) => !c.isDefault);

    const res = await request(app)
      .patch(`/api/fueling/wallet/cards/${nonDefault.id}/default`)
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(200);

    const after = await request(app)
      .get('/api/fueling/wallet')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(after.body.activeCard.id).toBe(nonDefault.id);
    expect(after.body.cards.filter((c) => c.isDefault).length).toBe(1);

    const foreign = await request(app)
      .patch(`/api/fueling/wallet/cards/${nonDefault.id}/default`)
      .set('Authorization', `Bearer ${otherDriverToken}`);
    expect(foreign.status).toBe(404);

    const foreignDelete = await request(app)
      .delete(`/api/fueling/wallet/cards/${nonDefault.id}`)
      .set('Authorization', `Bearer ${otherDriverToken}`);
    expect(foreignDelete.status).toBe(404);
  });

  it('remove cartão padrão e promove o restante como padrão', async () => {
    const wallet = await request(app)
      .get('/api/fueling/wallet')
      .set('Authorization', `Bearer ${driverToken}`);
    const current = wallet.body.activeCard;

    const resDel = await request(app)
      .delete(`/api/fueling/wallet/cards/${current.id}`)
      .set('Authorization', `Bearer ${driverToken}`);
    expect(resDel.status).toBe(200);
    expect(resDel.body.success).toBe(true);

    const after = await request(app)
      .get('/api/fueling/wallet')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(after.body.cards.length).toBe(1);
    expect(after.body.activeCard.isDefault).toBe(true);
    expect(after.body.activeCard.id).not.toBe(current.id);

    const again = await request(app)
      .delete(`/api/fueling/wallet/cards/${current.id}`)
      .set('Authorization', `Bearer ${driverToken}`);
    expect(again.status).toBe(404);
  });

  it('retorna 400 para identificador de cartão inválido', async () => {
    const res = await request(app)
      .delete('/api/fueling/wallet/cards/abc')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(400);
  });

  it('garante status estimated em todas as transações e banco not_configured', async () => {
    const res = await request(app)
      .get('/api/fueling/wallet')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(200);
    expect(res.body.bank.status).toBe('not_configured');
    for (const tx of res.body.transactions) {
      expect(tx.status).toBe('estimated');
      expect(tx.authProtocol).toBeUndefined();
    }
  });

  it('ignora monthlyLimit enviado pelo motorista e aplica o limite padrão do servidor', async () => {
    const res = await addCard(driverToken, {
      cardHolder: 'MOTORISTA TESTE LIMITE',
      cardNumber: '4012888888881881',
      expirationMonth: 5,
      expirationYear: 2033,
      monthlyLimit: 12000.0,
    });
    expect(res.status).toBe(201);
    expect(res.body.monthlyLimit).toBe(5000.0);
  });
});
