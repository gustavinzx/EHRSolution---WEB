"use strict";

const db = require("../config/db");

// Referência oficial Sicoob Open Banking / Developers Portal
// Portal: https://developers.sicoob.com.br/portal/apis
//
// Todos os dados institucionais vêm de variáveis de ambiente (ver .env.example).
// A conexão com a conta só é reportada como "connected" quando as credenciais
// da API Sicoob (SICOOB_CLIENT_ID) estiverem configuradas. Sem elas, os valores
// da carteira são calculados a partir dos abastecimentos registrados e do preço
// de referência do combustível (FUEL_REFERENCE_PRICE).
const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

function getConfig() {
  return {
    bankCode: "756",
    bankName: "Banco Cooperativo Sicoob S.A.",
    cooperativeUnit: process.env.SICOOB_COOPERATIVE || "Sicoob",
    accountNumber: process.env.SICOOB_ACCOUNT_NUMBER || null,
    companyLegalName: process.env.SICOOB_COMPANY_NAME || null,
    clientId: process.env.SICOOB_CLIENT_ID || null,
    defaultMonthlyLimit: toNumber(process.env.WALLET_DEFAULT_MONTHLY_LIMIT, 5000),
    maxMonthlyLimit: toNumber(process.env.WALLET_MAX_MONTHLY_LIMIT, 50000),
    maxActiveCards: Math.floor(toNumber(process.env.WALLET_MAX_ACTIVE_CARDS, 5)),
    fuelReferencePrice: toNumber(process.env.FUEL_REFERENCE_PRICE, 6.05),
    fuelType: process.env.FUEL_REFERENCE_TYPE || "Diesel S10",
  };
}

// Mantido por compatibilidade com módulos que importam SICOOB_CONFIG
const SICOOB_CONFIG = getConfig();

const DEVELOPER_PORTAL_URL = "https://developers.sicoob.com.br/portal/apis";

/** Algoritmo de Luhn (validação de dígito verificador de cartões) */
function isValidLuhn(number) {
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = parseInt(number[i], 10);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Detecta a bandeira do cartão pelo BIN (Elo é verificado antes de Visa/Master) */
function detectCardBrand(number) {
  if (/^(401178|401179|431274|438935|451416|457393|457631|457632|504175|506699|5067[0-7]\d|509\d{3}|627780|636297|636368|65003[1-3]|6500(3[5-9]|4\d|5[01])|6504(0[5-9]|[1-3]\d)|650(48[5-9]|49\d|5[0-2]\d|53[0-8])|6505(4[1-9]|[5-8]\d|9[0-8])|6507(0\d|1[0-8])|65072[0-7]|6509(0[1-9]|1\d|20)|6516(5[2-9]|[6-7]\d)|6550([0-1]\d|2[1-9]|[3-4]\d|5[0-8]))/.test(number)) {
    return "Elo Frota";
  }
  if (/^4/.test(number)) return "Visa Frota";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(number)) return "Mastercard Frota";
  if (/^(606282|3841)/.test(number)) return "Hipercard Frota";
  return "Cartão Frota";
}

function mapCard(c) {
  return {
    id: c.id,
    cardHolder: c.card_holder,
    lastFour: c.last_four,
    cardBrand: c.card_brand,
    bankName: c.bank_name,
    expirationMonth: c.expiration_month,
    expirationYear: c.expiration_year,
    monthlyLimit: Number(c.monthly_limit),
    isDefault: c.is_default,
    status: c.status,
    createdAt: c.created_at,
  };
}

/**
 * Obtém a carteira do motorista: cartões cadastrados, consumo do mês corrente e extrato.
 * @param {number} driverId - ID do motorista autenticado
 */
async function getDriverWallet(driverId) {
  const cfg = getConfig();

  const { rows: logs } = await db.query(
    `SELECT f.id, f.timestamp, f.volume_liters, f.station_name,
            t.plate AS truck_plate,
            fs.name AS official_station_name, fs.brand AS station_brand,
            (f.timestamp >= date_trunc('month', NOW())) AS in_current_month
       FROM fueling_logs f
       LEFT JOIN trucks t ON t.id = f.truck_id
       LEFT JOIN fuel_stations fs ON fs.id = f.station_id
      WHERE f.driver_id = $1
        AND (f.data_source IS NULL OR f.data_source != 'unverified')
      ORDER BY f.timestamp DESC
      LIMIT 50`,
    [driverId]
  );

  const { rows: cardRows } = await db.query(
    `SELECT id, card_holder, last_four, card_brand, bank_name,
            expiration_month, expiration_year, monthly_limit, is_default, status, created_at
       FROM driver_cards
      WHERE driver_id = $1 AND status = 'active'
      ORDER BY is_default DESC, id DESC`,
    [driverId]
  );

  const cards = cardRows.map(mapCard);
  const activeCard = cards[0] || null;
  const bankConnected = Boolean(cfg.clientId);

  let monthLiters = 0;
  let monthSpent = 0;
  let monthCount = 0;

  const transactions = logs.map((log) => {
    const liters = Number(log.volume_liters) || 0;
    const unitPrice = cfg.fuelReferencePrice;
    const amount = Number((liters * unitPrice).toFixed(2));

    if (log.in_current_month) {
      monthLiters += liters;
      monthSpent += amount;
      monthCount += 1;
    }

    return {
      id: log.id,
      timestamp: log.timestamp,
      stationName: log.station_name || log.official_station_name || "Posto não informado",
      brand: log.station_brand || null,
      truckPlate: log.truck_plate || null,
      liters: parseFloat(liters.toFixed(2)),
      pricePerLiter: unitPrice,
      totalAmount: amount,
      paymentMethod: activeCard ? `${activeCard.cardBrand} •••• ${activeCard.lastFour}` : "Sicoob",
      status: bankConnected ? "liquidated" : "registered",
      authProtocol: `SCB-${log.id.toString().padStart(6, "0")}`,
    };
  });

  const monthlyLimit = activeCard ? activeCard.monthlyLimit : cfg.defaultMonthlyLimit;
  const availableBalance = Math.max(0, Number((monthlyLimit - monthSpent).toFixed(2)));

  return {
    bank: {
      institution: cfg.bankName,
      code: cfg.bankCode,
      cooperative: cfg.cooperativeUnit,
      accountNumber: cfg.accountNumber,
      corporateName: cfg.companyLegalName,
      status: bankConnected ? "connected" : "not_configured",
      protocol: "Open Finance Brasil / OAuth2 mTLS",
      developerPortalUrl: DEVELOPER_PORTAL_URL,
      lastSync: new Date().toISOString(),
    },
    wallet: {
      monthlyCreditLimit: monthlyLimit,
      balanceAvailable: availableBalance,
      totalSpentMonth: Number(monthSpent.toFixed(2)),
      totalLitersMonth: Number(monthLiters.toFixed(2)),
      averagePricePerLiter: cfg.fuelReferencePrice,
      fuelType: cfg.fuelType,
      fuelingCount: monthCount,
    },
    activeCard,
    cards,
    transactions,
  };
}

/**
 * Cadastra um novo cartão frota para o motorista.
 * Apenas os 4 últimos dígitos são persistidos — número completo e CVV nunca são armazenados.
 */
async function addDriverCard(driverId, cardData) {
  const cfg = getConfig();
  const { cardHolder, cardNumber, expirationMonth, expirationYear, monthlyLimit } = cardData;
  const isDefault = cardData.isDefault !== false;

  const holder = String(cardHolder || "").trim().replace(/\s+/g, " ").toUpperCase();
  if (holder.length < 3 || holder.length > 60 || !/^[A-ZÀ-Ý' .-]+$/.test(holder)) {
    throw { status: 400, message: "Nome do titular do cartão é obrigatório (somente letras)." };
  }

  const cleanNumber = String(cardNumber || "").replace(/\D/g, "");
  if (cleanNumber.length < 13 || cleanNumber.length > 19 || !isValidLuhn(cleanNumber)) {
    throw { status: 400, message: "Número de cartão inválido. Confira os dígitos impressos no cartão." };
  }

  const expMonth = parseInt(expirationMonth, 10);
  if (isNaN(expMonth) || expMonth < 1 || expMonth > 12) {
    throw { status: 400, message: "Mês de validade inválido (de 01 a 12)." };
  }

  let expYear = parseInt(expirationYear, 10);
  if (isNaN(expYear)) {
    throw { status: 400, message: "Ano de validade inválido." };
  }
  if (expYear < 100) expYear += 2000;

  const now = new Date();
  const currentYear = now.getFullYear();
  if (expYear < currentYear || (expYear === currentYear && expMonth < now.getMonth() + 1)) {
    throw { status: 400, message: "O cartão informado está vencido." };
  }
  if (expYear > currentYear + 20) {
    throw { status: 400, message: "Ano de validade inválido." };
  }

  let limit = cfg.defaultMonthlyLimit;
  if (monthlyLimit !== undefined && monthlyLimit !== null && monthlyLimit !== "") {
    const requested = Number(monthlyLimit);
    if (!Number.isFinite(requested) || requested < 100 || requested > cfg.maxMonthlyLimit) {
      throw { status: 400, message: `Limite mensal deve estar entre R$ 100 e R$ ${cfg.maxMonthlyLimit}.` };
    }
    limit = Number(requested.toFixed(2));
  }

  const lastFour = cleanNumber.slice(-4);
  const brand = detectCardBrand(cleanNumber);

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    // Serializa operações de cartão do mesmo motorista
    await client.query("SELECT pg_advisory_xact_lock(hashtext('driver_cards'), $1)", [driverId]);

    const { rows: active } = await client.query(
      `SELECT id, last_four, expiration_month, expiration_year
         FROM driver_cards WHERE driver_id = $1 AND status = 'active'`,
      [driverId]
    );

    if (active.some((c) => c.last_four === lastFour && c.expiration_month === expMonth && c.expiration_year === expYear)) {
      throw { status: 409, message: "Este cartão já está cadastrado na sua carteira." };
    }
    if (active.length >= cfg.maxActiveCards) {
      throw { status: 409, message: `Limite de ${cfg.maxActiveCards} cartões ativos atingido. Remova um cartão antes de cadastrar outro.` };
    }

    const makeDefault = isDefault || active.length === 0;
    if (makeDefault) {
      await client.query(
        `UPDATE driver_cards SET is_default = false, updated_at = NOW() WHERE driver_id = $1`,
        [driverId]
      );
    }

    const { rows } = await client.query(
      `INSERT INTO driver_cards (
         driver_id, card_holder, last_four, card_brand, bank_name,
         expiration_month, expiration_year, monthly_limit, is_default, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
       RETURNING id, card_holder, last_four, card_brand, bank_name,
                 expiration_month, expiration_year, monthly_limit, is_default, status, created_at`,
      [driverId, holder, lastFour, brand, cfg.bankName, expMonth, expYear, limit, makeDefault]
    );

    await client.query("COMMIT");
    return mapCard(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Desativa um cartão do motorista e promove outro ativo como padrão, se necessário. */
async function removeDriverCard(driverId, cardId) {
  if (!Number.isInteger(cardId) || cardId <= 0) {
    throw { status: 400, message: "Identificador de cartão inválido." };
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('driver_cards'), $1)", [driverId]);

    const { rowCount } = await client.query(
      `UPDATE driver_cards SET status = 'inactive', is_default = false, updated_at = NOW()
        WHERE id = $1 AND driver_id = $2 AND status = 'active'`,
      [cardId, driverId]
    );
    if (!rowCount) {
      throw { status: 404, message: "Cartão não encontrado." };
    }

    const { rows: defaults } = await client.query(
      `SELECT id FROM driver_cards WHERE driver_id = $1 AND status = 'active' AND is_default = true`,
      [driverId]
    );
    if (defaults.length === 0) {
      await client.query(
        `UPDATE driver_cards SET is_default = true, updated_at = NOW()
          WHERE id = (
            SELECT id FROM driver_cards
             WHERE driver_id = $1 AND status = 'active'
             ORDER BY id DESC LIMIT 1
          )`,
        [driverId]
      );
    }

    await client.query("COMMIT");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Define um cartão ativo como padrão (atômico). */
async function setDefaultDriverCard(driverId, cardId) {
  if (!Number.isInteger(cardId) || cardId <= 0) {
    throw { status: 400, message: "Identificador de cartão inválido." };
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id FROM driver_cards WHERE id = $1 AND driver_id = $2 AND status = 'active'`,
      [cardId, driverId]
    );
    if (!rows.length) {
      throw { status: 404, message: "Cartão não encontrado." };
    }
    await client.query(
      `UPDATE driver_cards SET is_default = (id = $2), updated_at = NOW()
        WHERE driver_id = $1 AND status = 'active'`,
      [driverId, cardId]
    );
    await client.query("COMMIT");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  SICOOB_CONFIG,
  isValidLuhn,
  detectCardBrand,
  getDriverWallet,
  addDriverCard,
  removeDriverCard,
  setDefaultDriverCard,
};
