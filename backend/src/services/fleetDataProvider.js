/**
 * Provedor de Dados da Frota (Fleet Data Provider)
 *
 * Esta camada isola toda a obtenção de dados de telemetria, logs e eventos.
 * Atualmente, lê do banco de dados populado pelo simulador (quando DATA_SOURCE=mock).
 * No futuro (DATA_SOURCE=real), essa implementação poderá ser trocada para
 * buscar dados de uma API externa ou de webhooks de hardware real,
 * mantendo exatamente os mesmos formatos de retorno.
 */

const db = require('../config/db');
const dataSource = process.env.DATA_SOURCE || 'mock';

/**
 * getFleetSnapshot()
 * Retorna a posição e o status de toda a frota no momento exato da chamada.
 *
 * @returns {Promise<Array>} Array de objetos de caminhão
 * Formato de Saída Esperado:
 * [
 *   {
 *     id: number,
 *     plate: string,
 *     model: string,
 *     capacity_liters: string|number,
 *     current_level_liters: string|number,
 *     lat: string|number,
 *     lng: string|number,
 *     speed_kmh: string|number,
 *     status: string ('ok' | 'low_fuel' | 'no_signal'),
 *     sim_state: string,
 *     origin_name: string,
 *     dest_name: string,
 *     route_index: number,
 *     route_progress: string|number,
 *     created_at: string (ISO),
 *     current_drivers: Array<{id: number, name: string}> | null
 *   },
 *   ...
 * ]
 */
async function getFleetSnapshot() {
  if (dataSource === 'mock' || dataSource === 'real') {
    const query = `
      SELECT 
        t.id, t.plate, t.model, t.capacity_liters, t.current_level_liters, 
        t.lat, t.lng, t.speed_kmh, t.status, t.sim_state, t.route_index,
        t.origin_name, t.dest_name, t.route_index, t.route_progress, t.created_at,
        json_agg(json_build_object('id', d.id, 'name', d.name)) FILTER (WHERE d.id IS NOT NULL) as current_drivers
      FROM trucks t
      LEFT JOIN driver_trucks dt ON t.id = dt.truck_id
      LEFT JOIN drivers d ON dt.driver_id = d.id AND d.is_active = true
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `;
    const result = await db.query(query);
    return result.rows;
  }
  return [];
}

/**
 * getTruckTelemetry(truckId)
 * Retorna os detalhes de telemetria mais recentes e informações do caminhão.
 *
 * @param {number|string} truckId - O ID do caminhão
 * @returns {Promise<Object>} Objeto com detalhes do caminhão
 * Formato de Saída Esperado:
 * {
 *   id: number,
 *   plate: string,
 *   ... (mesmos campos de getFleetSnapshot),
 *   driver: { name: string, phone: string } | null,
 *   recent_fueling: Array<{ id: number, timestamp: string, level_before: number, level_after: number }>
 * }
 */
async function getTruckTelemetry(truckId) {
  const result = await db.query(`
    SELECT t.*, 
      json_build_object('name', d.name, 'phone', d.phone) as driver
    FROM trucks t
    LEFT JOIN driver_trucks dt ON t.id = dt.truck_id
    LEFT JOIN drivers d ON dt.driver_id = d.id AND d.is_active = true
    WHERE t.id = $1
  `, [truckId]);

  if (result.rows.length === 0) return null;
  const truck = result.rows[0];

  const logsResult = await db.query(`
    SELECT id, timestamp, level_before, level_after, lat, lng, release_method
    FROM fueling_logs
    WHERE truck_id = $1
    ORDER BY timestamp DESC
    LIMIT 5
  `, [truckId]);
  
  truck.recent_fueling = logsResult.rows;
  return truck;
}

/**
 * getFuelingLogs(filters)
 * Retorna o histórico de abastecimentos de acordo com filtros de tempo/frota.
 *
 * @param {Object} filters - Filtros da busca
 * @param {string|number} [filters.truck_id]
 * @param {string|number} [filters.driver_id]
 * @param {string} [filters.start] - Data inicial (YYYY-MM-DD)
 * @param {string} [filters.end] - Data final (YYYY-MM-DD)
 * @returns {Promise<Array>} Array de logs de abastecimento
 * Formato de Saída Esperado:
 * [
 *   {
 *     id: number,
 *     timestamp: string (ISO),
 *     lat: string|number,
 *     lng: string|number,
 *     level_before: string|number,
 *     level_after: string|number,
 *     release_method: string,
 *     driver_name: string,
 *     plate: string,
 *     model: string
 *   }, ...
 * ]
 */
async function getFuelingLogs(filters) {
  const { truck_id, driver_id, start, end } = filters || {};
  let query = `
    SELECT f.*, d.name as driver_name, t.plate, t.model
    FROM fueling_logs f
    LEFT JOIN drivers d ON f.driver_id = d.id
    JOIN trucks t ON f.truck_id = t.id
    WHERE 1=1
  `;
  const values = [];
  let index = 1;

  if (truck_id) { query += ` AND f.truck_id = $${index++}`; values.push(truck_id); }
  if (driver_id) { query += ` AND f.driver_id = $${index++}`; values.push(driver_id); }
  if (start) { query += ` AND f.timestamp >= $${index++}`; values.push(start); }
  if (end) { query += ` AND f.timestamp <= $${index++}`; values.push(end); }

  query += ` ORDER BY f.timestamp DESC LIMIT 100`;

  const result = await db.query(query, values);
  return result.rows;
}

/**
 * getVibrationEvent(truckId)
 * Retorna o evento mais recente de vibração anômala (Dump Pro) do caminhão.
 *
 * @param {number|string} truckId
 * @returns {Promise<Object|null>} Objeto de evento ou null se não houver
 * Formato de Saída Esperado:
 * {
 *   event_id: string,
 *   truck_id: number,
 *   vibration_level: string ('alta', 'crítica'),
 *   timestamp: string (ISO)
 * }
 */
async function getVibrationEvent(truckId) {
  // Atualmente não há tabela de vibração, então simulamos o retorno.
  // Em DATA_SOURCE=real, buscaríamos do BD ou da API do Dump Pro.
  if (dataSource === 'mock') {
    return null; // Pode retornar mock se necessário
  }
  return null;
}

/**
 * getLiveEvents()
 * Retorna os eventos ao vivo (caminhões abastecendo agora e logs recentes).
 */
async function getLiveEvents() {
  const result = { fueling_now: [], recent_logs: [] };
  if (dataSource === 'mock' || dataSource === 'real') {
    const fueling = await db.query(`SELECT id, plate, model, lat, lng, current_level_liters, capacity_liters FROM trucks WHERE sim_state = 'fueling' ORDER BY id`);
    const recent = await db.query(`SELECT fl.id, fl.timestamp, fl.lat, fl.lng, fl.level_before, fl.level_after, fl.release_method, t.plate, t.model, d.name as driver_name
      FROM fueling_logs fl JOIN trucks t ON fl.truck_id = t.id LEFT JOIN drivers d ON fl.driver_id = d.id
      WHERE fl.timestamp > NOW() - INTERVAL '2 hours' ORDER BY fl.timestamp DESC LIMIT 8`);
    result.fueling_now = fueling.rows;
    result.recent_logs = recent.rows;
  }
  return result;
}

/**
 * getTruckRoute(truckId)
 * Retorna a rota completa planejada pelo OSRM, usada nos mapas 2D e 3D.
 */
async function getTruckRoute(truckId) {
  if (dataSource === 'mock' || dataSource === 'real') {
    const result = await db.query('SELECT route_geometry FROM trucks WHERE id = $1', [truckId]);
    const geometry = result.rows[0]?.route_geometry;
    const route = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
    return { route_geometry: Array.isArray(route) ? route : [] };
  }
  return { route_geometry: [] };
}

/**
 * getTruckTelemetryHistory(truckId)
 * Retorna o histórico de pings reais, separado da rota planejada.
 */
async function getTruckTelemetryHistory(truckId) {
  if (dataSource === 'mock' || dataSource === 'real') {
    const routeQuery = `SELECT lat, lng, speed_kmh, fuel_level_liters, timestamp FROM telemetry_logs WHERE truck_id = $1 ORDER BY timestamp ASC LIMIT 100`;
    const result = await db.query(routeQuery, [truckId]);
    return result.rows;
  }
  return [];
}

/**
 * getUnloadingEvents(filters)
 * Retorna o histórico de descargas e eventos do Dump Pro.
 */
async function getUnloadingEvents(filters) {
  const { truck_id, start, end } = filters || {};
  let query = `
    SELECT u.*, t.plate, t.model
    FROM unloading_events u
    JOIN trucks t ON u.truck_id = t.id
    WHERE 1=1
  `;
  const values = [];
  let index = 1;

  if (truck_id) { query += ` AND u.truck_id = $${index++}`; values.push(truck_id); }
  if (start) { query += ` AND u.timestamp >= $${index++}`; values.push(start); }
  if (end) { query += ` AND u.timestamp <= $${index++}`; values.push(end); }

  query += ` ORDER BY u.timestamp DESC LIMIT 100`;

  if (dataSource === 'mock' || dataSource === 'real') {
    const result = await db.query(query, values);
    return result.rows;
  }
  return [];
}

/**
 * getDashboardStats()
 * Retorna as estatísticas para o Dashboard.
 */
async function getDashboardStats() {
  if (dataSource === 'mock' || dataSource === 'real') {
    const today = new Date().toISOString().split('T')[0];
    const { rows: stats } = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'safe' THEN 1 ELSE 0 END) as safe,
        SUM(CASE WHEN status != 'safe' THEN 1 ELSE 0 END) as unsafe
      FROM unloading_events
      WHERE timestamp >= $1::date
    `, [today]);
    return {
      unloading_today: {
        total: parseInt(stats[0].total) || 0,
        safe: parseInt(stats[0].safe) || 0,
        unsafe: parseInt(stats[0].unsafe) || 0
      }
    };
  }
  return { unloading_today: { total: 0, safe: 0, unsafe: 0 } };
}


/**
 * getDriverScore(driverId)
 * Retorna os detalhes de eficiencia do motorista.
 *
 * FÓRMULA DE EFICIÊNCIA (V1) - Pode ser recalibrada com dados reais:
 * - 40% peso: Consumo (Ideal ~ 30L/100km). Penalidade se maior.
 * - 30% peso: % de Descargas Seguras (Dump Pro).
 * - 30% peso: % de Tempo Ocioso (Menor é melhor).
 */
async function getDriverScore(driverId) {
  if (dataSource === 'mock' || dataSource === 'real') {
    // Busca do banco para o cálculo:
    const { rows: events } = await db.query(
      "SELECT status FROM unloading_events u JOIN driver_trucks dt ON u.truck_id = dt.truck_id WHERE dt.driver_id = $1", [driverId]
    );
    let safeUnloads = 0;
    if (events.length > 0) {
      safeUnloads = events.filter(e => e.status === 'safe').length / events.length;
    } else {
      safeUnloads = 1; // neutro se nao tiver descargas
    }

    // Telemetry: since we don't have driver_id in telemetry, we get it via truck_id from driver_trucks
    const { rows: telemetry } = await db.query(
      "SELECT speed_kmh FROM telemetry_logs t JOIN driver_trucks dt ON t.truck_id = dt.truck_id WHERE dt.driver_id = $1 LIMIT 500", [driverId]
    );
    
    let idlePct = 0.2; // default
    if (telemetry.length > 0) {
      const idleCount = telemetry.filter(t => Number(t.speed_kmh) === 0).length;
      idlePct = idleCount / telemetry.length;
    }

    // Simulando o Consumo para a demo com base no ID do motorista para variar
    const mockConsumption = 28 + ((driverId * 13) % 15); // Valores entre 28 e 43 L/100km
    let consumptionScore = 1 - Math.max(0, (mockConsumption - 28) / 20); // 28L = 100%, 48L = 0%
    
    let idleScore = 1 - Math.min(1, idlePct * 2); // 0% idle = 100%, 50%+ idle = 0%

    // Pesos
    const score = Math.round((consumptionScore * 0.4 + safeUnloads * 0.3 + idleScore * 0.3) * 100);

    // Historico de 30 dias (mockado)
    const history = [];
    let curScore = score;
    for(let i=30; i>=0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      history.push({ date: d.toISOString().split('T')[0], score: Math.min(100, Math.max(0, curScore + Math.round((Math.random()-0.5)*10))) });
    }

    return {
      score,
      metrics: {
        consumption: mockConsumption.toFixed(1),
        safe_unloads_pct: Math.round(safeUnloads * 100),
        idle_time_pct: Math.round(idlePct * 100)
      },
      history
    };
  }
  return { score: 0, metrics: {}, history: [] };
}

async function getDriverRanking() {
  if (dataSource === 'mock' || dataSource === 'real') {
    const { rows: drivers } = await db.query("SELECT id, name, is_active FROM drivers WHERE is_active = true");
    const ranking = [];
    for(const d of drivers) {
      const s = await getDriverScore(d.id);
      ranking.push({
        id: d.id,
        name: d.name,
        score: s.score,
        metrics: s.metrics
      });
    }
    ranking.sort((a,b) => b.score - a.score);
    return ranking;
  }
  return [];
}

module.exports = {
  getUnloadingEvents,
  getDashboardStats,
  getLiveEvents,
  getTruckRoute,
  getTruckTelemetryHistory,
  getFleetSnapshot,
  getTruckTelemetry,
  getFuelingLogs,
  getVibrationEvent,
  getDriverScore,
  getDriverRanking,
  getUnloadingEvents
};



