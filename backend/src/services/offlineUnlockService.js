const crypto = require('crypto');
const db = require('../config/db');

const MAX_TOKEN_TTL_S = 900; // 15 min (mesmo limite TOKEN_MAX_TTL_S do firmware TravaEHR_R4.ino)

class OfflineTokenError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function getMasterSecret() {
  const secret = process.env.HARDWARE_HMAC_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('HARDWARE_HMAC_SECRET ou JWT_SECRET deve estar configurado');
  }
  return secret;
}

// Chave de 32 bytes específica do caminhão (em hex = 64 caracteres para HMAC_KEY_HEX no config.h da placa)
function deriveTruckHmacKey(truckId) {
  return crypto
    .createHmac('sha256', getMasterSecret())
    .update(`EHR_TRUCK_HMAC_R4:${Number(truckId)}`)
    .digest();
}

function deriveTruckHmacKeyHex(truckId) {
  return deriveTruckHmacKey(truckId).toString('hex');
}

// Formato idêntico ao verifyUnlockToken() do TravaEHR_R4.ino:
// msg = "UNLOCK:<truck_id>:<session_id>:<exp>"
function signUnlockToken({ truckId, sessionId, exp }) {
  const key = deriveTruckHmacKey(truckId);
  const msg = `UNLOCK:${Number(truckId)}:${Number(sessionId)}:${Number(exp)}`;
  const mac = crypto.createHmac('sha256', key).update(msg).digest('hex');
  return {
    truck_id: Number(truckId),
    session_id: Number(sessionId),
    exp: Number(exp),
    mac,
  };
}

async function issueSessionUnlockToken({ sessionId, actor, nowMs = Date.now() }) {
  const { rows } = await db.query(
    `SELECT id, truck_id, driver_id, status, expires_at
       FROM fueling_sessions
      WHERE id = $1`,
    [sessionId]
  );
  if (rows.length === 0) {
    throw new OfflineTokenError('Sessão não encontrada', 404);
  }
  const session = rows[0];

  if (actor?.type === 'driver' && session.driver_id !== actor.id) {
    throw new OfflineTokenError('Sessão pertence a outro motorista', 403);
  }

  if (session.status !== 'authorized' && session.status !== 'active') {
    throw new OfflineTokenError('Sessão não está autorizada para desbloqueio local', 409);
  }

  const nowSec = Math.floor(nowMs / 1000);
  let expSec = nowSec + MAX_TOKEN_TTL_S;
  if (session.expires_at) {
    const sessExpSec = Math.floor(new Date(session.expires_at).getTime() / 1000);
    if (sessExpSec <= nowSec) {
      throw new OfflineTokenError('Sessão não está autorizada para desbloqueio local', 409);
    }
    expSec = Math.min(expSec, sessExpSec);
  }

  return signUnlockToken({
    truckId: session.truck_id,
    sessionId: session.id,
    exp: expSec,
  });
}

module.exports = {
  deriveTruckHmacKey,
  deriveTruckHmacKeyHex,
  signUnlockToken,
  issueSessionUnlockToken,
  OfflineTokenError,
  MAX_TOKEN_TTL_S,
};
