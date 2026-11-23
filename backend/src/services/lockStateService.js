const db = require('../config/db');
const security = require('./securityService');

const COMMANDS = new Set(['lock', 'unlock']);
const BOOL_FIELDS = ['sol1', 'sol2', 'fc_locked', 'fc_unlocked'];

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

function parseLockState(body) {
  const b = body && typeof body === 'object' ? body : {};
  const out = {};
  for (const f of BOOL_FIELDS) {
    if (typeof b[f] !== 'boolean') throw new ValidationError(`Campo ${f} deve ser booleano`);
    out[f] = b[f];
  }
  if (b.command === undefined || b.command === null) {
    out.command = null;
  } else if (COMMANDS.has(b.command)) {
    out.command = b.command;
  } else {
    throw new ValidationError('command deve ser "lock" ou "unlock"');
  }
  return out;
}

// Fins de curso: ambos acionados é fisicamente impossível (sensor em curto/defeito).
function deriveState({ fc_locked, fc_unlocked }) {
  if (fc_locked && fc_unlocked) return 'fault';
  if (fc_locked) return 'locked';
  if (fc_unlocked) return 'unlocked';
  return 'moving';
}

// 'moving' é transitório e não conta como divergência.
function isMismatch(command, state) {
  if (state === 'fault') return true;
  if (command === 'lock') return state === 'unlocked';
  if (command === 'unlock') return state === 'locked';
  return false;
}

async function recordLockState({ truckId, body, io }) {
  const s = parseLockState(body);
  const derived = deriveState(s);
  const mismatch = isMismatch(s.command, derived);

  const { rows: prev } = await db.query(
    'SELECT mismatch FROM lock_state_logs WHERE truck_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
    [truckId]
  );
  const wasMismatch = prev[0] ? prev[0].mismatch : false;

  const { rows } = await db.query(
    `INSERT INTO lock_state_logs (truck_id, command, sol1, sol2, fc_locked, fc_unlocked, derived_state, mismatch)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, truck_id, command, sol1, sol2, fc_locked, fc_unlocked, derived_state, mismatch, created_at`,
    [truckId, s.command, s.sol1, s.sol2, s.fc_locked, s.fc_unlocked, derived, mismatch]
  );

  // Alerta só na transição para divergência, evitando enxurrada a cada reenvio da placa.
  let alert = null;
  if (mismatch && !wasMismatch) {
    const result = await security.recordSecurityEvent({
      truckId,
      type: 'lock_state_mismatch',
      source: 'device',
      payload: { command: s.command, derived_state: derived, fc_locked: s.fc_locked, fc_unlocked: s.fc_unlocked },
      io,
    });
    alert = result.alert;
  }
  return { log: rows[0], alert };
}

module.exports = { recordLockState, parseLockState, deriveState, isMismatch };
