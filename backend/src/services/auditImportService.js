const crypto = require('crypto');
const db = require('../config/db');

const MAX_LINES = 5000;
const EVENTS = new Set(['TRAVAR', 'DESTRAVAR']);
const RESULTS = new Set(['SUCESSO', 'FALHA']);
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

class ImportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Data do cartão SD é interpretada como UTC (o firmware deve gravar o RTC em UTC).
function parseDate(str) {
  const m = DATE_RE.exec(str);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const sameParts = dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
    && dt.getUTCHours() === h && dt.getUTCMinutes() === mi && dt.getUTCSeconds() === s;
  return sameParts ? dt : null;
}

function strictNumber(str) {
  if (!/^-?\d+(\.\d+)?$/.test(str)) return null;
  return Number(str);
}

// Formato: data;lat;lng;evento;resultado[;seq]. Cabeçalho opcional (começa com "data").
function parseAuditCsv(text, { now = Date.now() } = {}) {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new ImportError('CSV vazio ou ausente');
  }
  const lines = text.split(/\r?\n/);
  if (lines.length > MAX_LINES + 2) {
    throw new ImportError(`CSV excede o limite de ${MAX_LINES} linhas`, 413);
  }

  const valid = [];
  const rejected = [];
  lines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const line = raw.trim();
    if (line === '') return;
    if (idx === 0 && /^data;/i.test(line)) return;

    const f = line.split(';').map((p) => p.trim());
    if (f.length !== 5 && f.length !== 6) {
      rejected.push({ line: lineNo, reason: 'número de colunas inválido' });
      return;
    }
    const at = parseDate(f[0]);
    if (!at) return rejected.push({ line: lineNo, reason: 'data inválida (esperado YYYY-MM-DD HH:MM:SS)' });
    if (at.getTime() > now + MAX_FUTURE_MS) return rejected.push({ line: lineNo, reason: 'data no futuro' });
    const lat = strictNumber(f[1]);
    const lng = strictNumber(f[2]);
    if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return rejected.push({ line: lineNo, reason: 'coordenadas inválidas' });
    }
    const event = f[3].toUpperCase();
    const result = f[4].toUpperCase();
    if (!EVENTS.has(event)) return rejected.push({ line: lineNo, reason: 'evento desconhecido' });
    if (!RESULTS.has(result)) return rejected.push({ line: lineNo, reason: 'resultado desconhecido' });
    let seq = null;
    if (f.length === 6) {
      if (!/^\d{1,9}$/.test(f[5])) return rejected.push({ line: lineNo, reason: 'seq inválido' });
      seq = Number(f[5]);
    }
    valid.push({ at, lat, lng, event, result, seq });
  });
  return { valid, rejected };
}

function lineHash(truckId, e) {
  const canon = [truckId, e.at.toISOString(), e.lat, e.lng, e.event, e.result, e.seq ?? ''].join('|');
  return crypto.createHash('sha256').update(canon).digest('hex');
}

async function importAudit({ truckId, csv }) {
  const { valid, rejected } = parseAuditCsv(csv);
  let imported = 0;
  if (valid.length > 0) {
    const rows = valid.map((e) => ({ ...e, hash: lineHash(truckId, e) }));
    const { rowCount } = await db.query(
      `INSERT INTO hardware_audit_entries (truck_id, occurred_at, lat, lng, event, result, seq, line_hash)
       SELECT $1, t.at, t.lat, t.lng, t.event, t.result, t.seq, t.hash
       FROM unnest($2::timestamptz[], $3::numeric[], $4::numeric[], $5::text[], $6::text[], $7::int[], $8::text[])
         AS t(at, lat, lng, event, result, seq, hash)
       ON CONFLICT (truck_id, line_hash) DO NOTHING`,
      [
        truckId,
        rows.map((r) => r.at.toISOString()),
        rows.map((r) => r.lat),
        rows.map((r) => r.lng),
        rows.map((r) => r.event),
        rows.map((r) => r.result),
        rows.map((r) => r.seq),
        rows.map((r) => r.hash),
      ]
    );
    imported = rowCount;
  }
  return { imported, duplicates: valid.length - imported, rejected };
}

module.exports = { importAudit, parseAuditCsv, lineHash, ImportError, MAX_LINES };
