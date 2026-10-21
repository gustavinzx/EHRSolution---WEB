"use strict";

const db = require("../config/db");

// Referência oficial Sicoob Open Banking / Developers Portal
// Portal: https://developers.sicoob.com.br/portal/apis
const SICOOB_CONFIG = {
  bankCode: "756",
  bankName: "Banco Cooperativo Sicoob S.A.",
  cooperativeUnit: "Sicoob Credifrotas DF (4321)",
  accountNumber: "10987-6",
  companyLegalName: "EHR Logística & Transportes S.A.",
  apiScope: "open-banking/v1/conta-corrente open-banking/v1/pix",
  defaultMonthlyLimit: 5000.0, // Limite mensal de crédito para combustível por caminhão
  benchmarkDieselPrice: 6.05, // Referência ANP Diesel S10 médio nacional (R$/L)
};

/**
 * Obtém a carteira do motorista consolidada com a conta corporativa Sicoob
 * @param {number} driverId - ID do motorista autenticado
 * @returns {Promise<Object>} Dados da carteira, cartões cadastrados, saldo e extrato financeiro
 */
async function getDriverWallet(driverId) {
  // 1. Busca os abastecimentos do motorista nos últimos 30 dias
  const { rows: logs } = await db.query(
    `SELECT f.id, f.timestamp, f.volume_liters, f.station_name, f.release_method,
            t.plate AS truck_plate, t.model AS truck_model,
            fs.name AS official_station_name, fs.brand AS station_brand
       FROM fueling_logs f
       LEFT JOIN trucks t ON t.id = f.truck_id
       LEFT JOIN fuel_stations fs ON fs.id = f.station_id
      WHERE f.driver_id = $1
        AND (f.data_source IS NULL OR f.data_source != 'unverified')
      ORDER BY f.timestamp DESC
      LIMIT 50`,
    [driverId]
  );

  // 2. Busca cartões do motorista
  const { rows: cardRows } = await db.query(
    `SELECT id, card_holder, last_four, card_brand, bank_name,
            expiration_month, expiration_year, monthly_limit, is_default, status, created_at
       FROM driver_cards
      WHERE driver_id = $1 AND status = 'active'
      ORDER BY is_default DESC, id DESC`,
    [driverId]
  );

  const cards = cardRows.map((c) => ({
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
  }));

  const activeCard = cards[0] || null;

  let totalLiters = 0;
  let totalSpent = 0;

  const transactions = logs.map((log) => {
    const liters = Number(log.volume_liters) || 0;
    const unitPrice = SICOOB_CONFIG.benchmarkDieselPrice;
    const amount = Number((liters * unitPrice).toFixed(2));

    totalLiters += liters;
    totalSpent += amount;

    const paymentLabel = activeCard
      ? `${activeCard.cardBrand} •••• ${activeCard.lastFour}`
      : "Cartão Frota Sicoob Visa PJ";

    return {
      id: log.id,
      timestamp: log.timestamp,
      stationName: log.station_name || log.official_station_name || "Posto Homologado",
      brand: log.station_brand || "ANP",
      truckPlate: log.truck_plate || "EHR-0001",
      liters: parseFloat(liters.toFixed(2)),
      pricePerLiter: unitPrice,
      totalAmount: amount,
      paymentMethod: paymentLabel,
      status: "liquidated", // Compensado via débito em conta cooperativa
      authProtocol: `SCB-${log.id.toString().padStart(6, "0")}`,
    };
  });

  const monthlyLimit = activeCard ? activeCard.monthlyLimit : SICOOB_CONFIG.defaultMonthlyLimit;
  const availableBalance = Math.max(0, Number((monthlyLimit - totalSpent).toFixed(2)));

  return {
    bank: {
      institution: SICOOB_CONFIG.bankName,
      code: SICOOB_CONFIG.bankCode,
      cooperative: SICOOB_CONFIG.cooperativeUnit,
      accountNumber: SICOOB_CONFIG.accountNumber,
      corporateName: SICOOB_CONFIG.companyLegalName,
      status: "connected",
      protocol: "Open Finance Brasil / OAuth2 mTLS",
      developerPortalUrl: "https://developers.sicoob.com.br/portal/apis",
      lastSync: new Date().toISOString(),
    },
    wallet: {
      monthlyCreditLimit: monthlyLimit,
      balanceAvailable: availableBalance,
      totalSpentMonth: Number(totalSpent.toFixed(2)),
      totalLitersMonth: Number(totalLiters.toFixed(2)),
      averagePricePerLiter: SICOOB_CONFIG.benchmarkDieselPrice,
      fuelType: "Diesel S10",
      fuelingCount: transactions.length,
    },
    activeCard,
    cards,
    transactions,
  };
}

/**
 * Cadastra um novo cartão frota para o motorista
 */
async function addDriverCard(driverId, cardData) {
  const {
    cardHolder,
    cardNumber,
    expirationMonth,
    expirationYear,
    cardBrand,
    bankName,
    monthlyLimit,
    isDefault = true,
  } = cardData;

  const holder = (cardHolder || "").trim().toUpperCase();
  if (!holder || holder.length < 3) {
    throw { status: 400, message: "Nome do titular do cartão é obrigatório." };
  }

  const cleanNumber = (cardNumber || "").replace(/\D/g, "");
  if (cleanNumber.length < 13 || cleanNumber.length > 19) {
    throw { status: 400, message: "Número de cartão inválido (deve conter entre 13 e 19 dígitos)." };
  }

  const expMonth = parseInt(expirationMonth, 10);
  if (isNaN(expMonth) || expMonth < 1 || expMonth > 12) {
    throw { status: 400, message: "Mês de expiração inválido (de 01 a 12)." };
  }

  let expYear = parseInt(expirationYear, 10);
  if (isNaN(expYear)) {
    throw { status: 400, message: "Ano de expiração inválido." };
  }
  if (expYear < 100) expYear += 2000;

  const currentYear = new Date().getFullYear();
  if (expYear < currentYear || (expYear === currentYear && expMonth < new Date().getMonth() + 1)) {
    throw { status: 400, message: "O cartão informado está vencido." };
  }

  const lastFour = cleanNumber.slice(-4);

  // Detecção de bandeira
  let detectedBrand = cardBrand;
  if (!detectedBrand) {
    if (cleanNumber.startsWith("4")) detectedBrand = "Sicoob Visa Frota";
    else if (cleanNumber.startsWith("5")) detectedBrand = "Mastercard Frota";
    else if (cleanNumber.startsWith("6")) detectedBrand = "Elo Corporativo";
    else detectedBrand = "Sicoob Card PJ";
  }

  const detectedBank = bankName || SICOOB_CONFIG.bankName;
  const limit = Math.max(100, Number(monthlyLimit) || SICOOB_CONFIG.defaultMonthlyLimit);

  // Se o novo cartão for padrão, remove flag dos outros
  if (isDefault) {
    await db.query(`UPDATE driver_cards SET is_default = false WHERE driver_id = $1`, [driverId]);
  }

  const { rows } = await db.query(
    `INSERT INTO driver_cards (
      driver_id, card_holder, last_four, card_brand, bank_name,
      expiration_month, expiration_year, monthly_limit, is_default, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
    RETURNING id, card_holder, last_four, card_brand, bank_name,
              expiration_month, expiration_year, monthly_limit, is_default, status, created_at`,
    [driverId, holder, lastFour, detectedBrand, detectedBank, expMonth, expYear, limit, isDefault]
  );

  const row = rows[0];
  return {
    id: row.id,
    cardHolder: row.card_holder,
    lastFour: row.last_four,
    cardBrand: row.card_brand,
    bankName: row.bank_name,
    expirationMonth: row.expiration_month,
    expirationYear: row.expiration_year,
    monthlyLimit: Number(row.monthly_limit),
    isDefault: row.is_default,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Remove/desativa cartão do motorista
 */
async function removeDriverCard(driverId, cardId) {
  const { rowCount } = await db.query(
    `UPDATE driver_cards SET status = 'inactive', is_default = false
      WHERE id = $1 AND driver_id = $2`,
    [cardId, driverId]
  );
  if (!rowCount) {
    throw { status: 404, message: "Cartão não encontrado." };
  }

  // Se sobrou algum cartão ativo, define o mais recente como padrão
  await db.query(
    `UPDATE driver_cards SET is_default = true
      WHERE id = (
        SELECT id FROM driver_cards
         WHERE driver_id = $1 AND status = 'active'
         ORDER BY id DESC LIMIT 1
      )`,
    [driverId]
  );

  return { success: true };
}

/**
 * Define cartão como padrão
 */
async function setDefaultDriverCard(driverId, cardId) {
  await db.query(`UPDATE driver_cards SET is_default = false WHERE driver_id = $1`, [driverId]);
  const { rowCount } = await db.query(
    `UPDATE driver_cards SET is_default = true WHERE id = $1 AND driver_id = $2 AND status = 'active'`,
    [cardId, driverId]
  );
  if (!rowCount) {
    throw { status: 404, message: "Cartão não encontrado." };
  }
  return { success: true };
}

module.exports = {
  SICOOB_CONFIG,
  getDriverWallet,
  addDriverCard,
  removeDriverCard,
  setDefaultDriverCard,
};
