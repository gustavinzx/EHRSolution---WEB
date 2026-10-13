const db = require('../config/db');
const { isInterdicted } = require('../services/anpStatus');

const ALLOWED_STATION_COLUMNS = `
  cnpj,
  razao_social,
  endereco,
  bairro,
  cep,
  uf,
  municipio,
  bandeira,
  lat,
  lng,
  acuracia_metros,
  situacao_sigaf,
  produtos,
  is_active,
  last_seen_at
`;

function escapeLike(str) {
  return String(str).replace(/[\\%_]/g, '\\$&');
}

function formatAnpStation(row) {
  return {
    cnpj: row.cnpj ? String(row.cnpj).trim() : null,
    razao_social: row.razao_social,
    endereco: row.endereco,
    bairro: row.bairro,
    cep: row.cep ? String(row.cep).trim() : null,
    uf: row.uf ? String(row.uf).trim() : null,
    municipio: row.municipio,
    bandeira: row.bandeira,
    lat: row.lat !== null && row.lat !== undefined ? Number(row.lat) : null,
    lng: row.lng !== null && row.lng !== undefined ? Number(row.lng) : null,
    acuracia_metros: row.acuracia_metros !== null && row.acuracia_metros !== undefined ? Number(row.acuracia_metros) : null,
    situacao_sigaf: row.situacao_sigaf,
    interdicted: isInterdicted(row.situacao_sigaf),
    produtos: row.produtos,
    is_active: Boolean(row.is_active),
    last_seen_at: row.last_seen_at
  };
}

exports.listStations = async (req, res) => {
  try {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.query.uf !== undefined && String(req.query.uf).trim() !== '') {
      conditions.push(`uf = $${idx++}`);
      params.push(String(req.query.uf).trim().toUpperCase());
    }

    if (req.query.municipio !== undefined && String(req.query.municipio).trim() !== '') {
      conditions.push(`municipio ILIKE $${idx++} ESCAPE '\\'`);
      params.push(`%${escapeLike(String(req.query.municipio).trim())}%`);
    }

    if (req.query.bandeira !== undefined && String(req.query.bandeira).trim() !== '') {
      conditions.push(`bandeira ILIKE $${idx++} ESCAPE '\\'`);
      params.push(`%${escapeLike(String(req.query.bandeira).trim())}%`);
    }

    if (req.query.q !== undefined && String(req.query.q).trim() !== '') {
      const qRaw = String(req.query.q).trim();
      const qEscaped = `%${escapeLike(qRaw)}%`;
      const isFormattedCnpjQuery = /^[\d.\-/\s]+$/.test(qRaw);
      const qDigits = isFormattedCnpjQuery ? qRaw.replace(/\D/g, '') : '';
      if (qDigits && qDigits !== qRaw) {
        const qDigitsEscaped = `%${escapeLike(qDigits)}%`;
        conditions.push(
          `(razao_social ILIKE $${idx} ESCAPE '\\' OR cnpj ILIKE $${idx} ESCAPE '\\' OR cnpj ILIKE $${idx + 1} ESCAPE '\\')`
        );
        params.push(qEscaped, qDigitsEscaped);
        idx += 2;
      } else {
        conditions.push(`(razao_social ILIKE $${idx} ESCAPE '\\' OR cnpj ILIKE $${idx} ESCAPE '\\')`);
        params.push(qEscaped);
        idx += 1;
      }
    }

    if (req.query.is_active !== undefined && String(req.query.is_active).trim() !== '') {
      const val = String(req.query.is_active).trim().toLowerCase();
      if (val === 'true' || val === '1') {
        conditions.push(`is_active = $${idx++}`);
        params.push(true);
      } else if (val === 'false' || val === '0') {
        conditions.push(`is_active = $${idx++}`);
        params.push(false);
      }
    }

    if (req.query.has_geo !== undefined && String(req.query.has_geo).trim() !== '') {
      const val = String(req.query.has_geo).trim().toLowerCase();
      if (val === 'true' || val === '1') {
        conditions.push('(lat IS NOT NULL AND lng IS NOT NULL)');
      } else if (val === 'false' || val === '0') {
        conditions.push('(lat IS NULL OR lng IS NULL)');
      }
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const parsedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(100, parsedLimit) : 25;
    const offset = (page - 1) * limit;

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await db.query(
      `SELECT COUNT(*)::int AS total FROM anp_stations ${whereSql}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const dataParams = [...params, limit, offset];
    const { rows } = await db.query(
      `SELECT ${ALLOWED_STATION_COLUMNS}
       FROM anp_stations
       ${whereSql}
       ORDER BY uf ASC, municipio ASC NULLS LAST, razao_social ASC, cnpj ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      dataParams
    );

    res.json({
      items: rows.map(formatAnpStation),
      page,
      limit,
      total
    });
  } catch (error) {
    console.error('List ANP stations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getSummary = async (req, res) => {
  try {
    const countsRes = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_active = true)::int AS total_active,
         COUNT(*) FILTER (WHERE is_active = true AND (lat IS NULL OR lng IS NULL))::int AS total_without_coordinates
       FROM anp_stations`
    );

    const ufRes = await db.query(
      `SELECT uf, COUNT(*)::int AS total
       FROM anp_stations
       WHERE is_active = true
       GROUP BY uf
       ORDER BY uf ASC`
    );

    const syncRes = await db.query(
      `SELECT MAX(finished_at) AS last_sync_at
       FROM anp_sync_runs
       WHERE status = 'succeeded'`
    );

    const byUfList = ufRes.rows.map(r => ({
      uf: r.uf ? String(r.uf).trim() : '',
      total: r.total
    }));

    const totalsByUf = {};
    for (const item of byUfList) {
      totalsByUf[item.uf] = item.total;
    }

    const counts = countsRes.rows[0] || { total_active: 0, total_without_coordinates: 0 };

    res.json({
      total_active: counts.total_active || 0,
      total_without_coordinates: counts.total_without_coordinates || 0,
      by_uf: byUfList,
      totals_by_uf: totalsByUf,
      last_sync_at: syncRes.rows[0]?.last_sync_at || null
    });
  } catch (error) {
    console.error('ANP stations summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getInBounds = async (req, res) => {
  try {
    const { minLat, minLng, maxLat, maxLng } = req.query;
    if (
      minLat === undefined || minLat === '' ||
      minLng === undefined || minLng === '' ||
      maxLat === undefined || maxLat === '' ||
      maxLng === undefined || maxLng === ''
    ) {
      return res.status(400).json({ error: 'Parâmetros minLat, minLng, maxLat e maxLng são obrigatórios' });
    }

    const nMinLat = Number(minLat);
    const nMinLng = Number(minLng);
    const nMaxLat = Number(maxLat);
    const nMaxLng = Number(maxLng);

    if (
      !Number.isFinite(nMinLat) ||
      !Number.isFinite(nMinLng) ||
      !Number.isFinite(nMaxLat) ||
      !Number.isFinite(nMaxLng) ||
      nMinLat > nMaxLat ||
      nMinLng > nMaxLng
    ) {
      return res.status(400).json({ error: 'Parâmetros de limites geográficos inválidos' });
    }

    const conditions = [
      'is_active = true',
      'lat IS NOT NULL',
      'lng IS NOT NULL',
      'lat >= $1',
      'lat <= $2',
      'lng >= $3',
      'lng <= $4'
    ];
    const params = [nMinLat, nMaxLat, nMinLng, nMaxLng];
    let idx = 5;

    if (req.query.uf !== undefined && String(req.query.uf).trim() !== '') {
      conditions.push(`uf = $${idx++}`);
      params.push(String(req.query.uf).trim().toUpperCase());
    }

    if (req.query.municipio !== undefined && String(req.query.municipio).trim() !== '') {
      conditions.push(`municipio ILIKE $${idx++} ESCAPE '\\'`);
      params.push(`%${escapeLike(String(req.query.municipio).trim())}%`);
    }

    if (req.query.bandeira !== undefined && String(req.query.bandeira).trim() !== '') {
      conditions.push(`bandeira ILIKE $${idx++} ESCAPE '\\'`);
      params.push(`%${escapeLike(String(req.query.bandeira).trim())}%`);
    }

    if (req.query.q !== undefined && String(req.query.q).trim() !== '') {
      const qRaw = String(req.query.q).trim();
      const qEscaped = `%${escapeLike(qRaw)}%`;
      conditions.push(`(razao_social ILIKE $${idx} ESCAPE '\\' OR cnpj ILIKE $${idx} ESCAPE '\\')`);
      params.push(qEscaped);
      idx += 1;
    }

    const { rows } = await db.query(
      `SELECT ${ALLOWED_STATION_COLUMNS}
       FROM anp_stations
       WHERE ${conditions.join(' AND ')}
       ORDER BY cnpj ASC
       LIMIT 501`,
      params
    );

    const truncated = rows.length > 500;
    const slice = truncated ? rows.slice(0, 500) : rows;

    res.json({
      items: slice.map(formatAnpStation),
      truncated
    });
  } catch (error) {
    console.error('ANP in-bounds error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getByCnpj = async (req, res) => {
  try {
    const cnpj = String(req.params.cnpj || '').trim();
    if (!/^\d{14}$/.test(cnpj)) {
      return res.status(400).json({ error: 'cnpj inválido' });
    }

    const { rows } = await db.query(
      `SELECT ${ALLOWED_STATION_COLUMNS}
       FROM anp_stations
       WHERE cnpj = $1
       LIMIT 1`,
      [cnpj]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Posto não encontrado' });
    }

    res.json(formatAnpStation(rows[0]));
  } catch (error) {
    console.error('Get ANP station by CNPJ error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
