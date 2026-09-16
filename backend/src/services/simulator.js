const db = require('../config/db');

// ─── Haversine distance ───────────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const TICK_MS       = 3000;  // 3s por tick (atualização rápida e constante)
const ROUTE_JUMP    = 4;     // 4 pontos da rota por tick (movimento fluido sem saltos gigantes)
const FUEL_STOP_PCT = 25;    // % de combustível para parar no posto
const FUELING_TICKS = 4;     // quantos ticks fica parado abastecendo (~12s)


// ─── Máquina de estados por caminhão ─────────────────────────────────────────
// Estados: 'driving' | 'fueling' | 'resuming'
// 'driving'  → caminhão anda, consome combustível
// 'fueling'  → parou no posto, velocidade=0, conta ticks
// 'resuming' → tick de transição, registra o fueling_log e volta a 'driving'

async function simulateFleet() {
  try {
    const { rows: trucks } = await db.query(`
      SELECT id, current_level_liters, capacity_liters,
             route_geometry, route_index,
             sim_state, fueling_ticks,
             lat, lng
      FROM trucks
      WHERE route_geometry IS NOT NULL
    `);

    for (const truck of trucks) {
      const route = typeof truck.route_geometry === 'string'
        ? JSON.parse(truck.route_geometry)
        : truck.route_geometry;

      if (!route || !Array.isArray(route) || route.length < 2) continue;

      let { route_index, sim_state, fueling_ticks, current_level_liters, capacity_liters } = truck;
      sim_state    = sim_state    || 'driving';
      fueling_ticks = fueling_ticks || 0;

      // ── Estado: FUELING ───────────────────────────────────────────────────
      if (sim_state === 'fueling') {
        const newTicks = fueling_ticks + 1;

        if (newTicks >= FUELING_TICKS) {
          // ── Abastecimento completo! Registrar log + voltar a driving ──────
          const levelBefore = parseFloat(current_level_liters);
          const levelAfter  = parseFloat(capacity_liters); // tanque cheio
          const method      = Math.random() < 0.85 ? 'facial' : 'ble_fallback';

          // Pega o driver vinculado ao caminhão (se houver)
          const { rows: driverRows } = await db.query(
            `SELECT driver_id FROM driver_trucks WHERE truck_id = $1 LIMIT 1`,
            [truck.id]
          );
          const driverId = driverRows[0]?.driver_id || null;

          // Cria o fueling_log
          await db.query(`
            INSERT INTO fueling_logs (driver_id, truck_id, lat, lng, level_before, level_after, release_method)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [driverId, truck.id, truck.lat, truck.lng, levelBefore, levelAfter, method]);

          // Insere telemetria do reabastecimento
          await db.query(`
            INSERT INTO telemetry_logs (truck_id, lat, lng, speed_kmh, fuel_level_liters)
            VALUES ($1, $2, $3, 0, $4)
          `, [truck.id, truck.lat, truck.lng, levelAfter]);

          // Atualiza caminhão: tanque cheio, volta a dirigir
          await db.query(`
            UPDATE trucks
            SET current_level_liters = $1,
                speed_kmh = 0,
                status = 'ok',
                sim_state = 'driving',
                fueling_ticks = 0
            WHERE id = $2
          `, [levelAfter, truck.id]);

          console.log(`[SIM] Truck #${truck.id} abasteceu | ${levelBefore.toFixed(0)}L → ${levelAfter.toFixed(0)}L | método: ${method}`);
        } else {
          // Ainda abastecendo — permanece parado
          await db.query(`
            UPDATE trucks
            SET speed_kmh = 0, fueling_ticks = $1, status = 'fueling'
            WHERE id = $2
          `, [newTicks, truck.id]);
        }
        continue; // pula o movimento neste tick
      }

      // ── Estado: DRIVING ───────────────────────────────────────────────────
      // Verifica se chegou no fim da rota → loop
      if (route_index >= route.length - 1) {
        route_index = 0;
        await db.query(
          `UPDATE trucks SET route_index = 0 WHERE id = $1`,
          [truck.id]
        );
      }

      // Avança na rota
      const nextIndex = Math.min(route_index + ROUTE_JUMP, route.length - 1);
      const [nextLng, nextLat] = route[nextIndex];
      const [prevLng, prevLat] = route[route_index];

      const distKm = haversineKm(prevLat, prevLng, nextLat, nextLng);
      const speed  = Math.min(120, Math.max(5, (distKm / (TICK_MS / 3_600_000)) * 10));

      // Consome combustível: 0.6–1.8L por tick (~90km/h médio, ~30L/100km)
      const consumed  = Math.random() * 1.2 + 0.6;
      const newFuel   = Math.max(0, parseFloat(current_level_liters) - consumed);
      const fuelPct   = (newFuel / parseFloat(capacity_liters)) * 100;

      // Decide próximo estado
      let nextState  = 'driving';
      let nextStatus = 'ok';

      if (fuelPct <= FUEL_STOP_PCT) {
        // Para no posto
        nextState  = 'fueling';
        nextStatus = 'fueling';
        console.log(`[SIM] Truck #${truck.id} parou para abastecer (${fuelPct.toFixed(0)}%)`);
      } else if (fuelPct <= 40) {
        nextStatus = 'low_fuel';
      }

      // Atualiza posição e estado
      await db.query(`
        UPDATE trucks
        SET lat = $1, lng = $2,
            current_level_liters = $3,
            speed_kmh = $4,
            route_index = $5,
            status = $6,
            sim_state = $7,
            fueling_ticks = 0
        WHERE id = $8
      `, [nextLat, nextLng, newFuel, nextState === 'fueling' ? 0 : speed,
          nextIndex, nextStatus, nextState, truck.id]);

      // Telemetria
      await db.query(`
        INSERT INTO telemetry_logs (truck_id, lat, lng, speed_kmh, fuel_level_liters)
        VALUES ($1, $2, $3, $4, $5)
      `, [truck.id, nextLat, nextLng, speed, newFuel]);
    }
  } catch (err) {
    console.error('[SIM] Erro no simulador:', err.message);
  }
}

function startSimulator() {
  console.log('[SIM] Iniciando simulador de frota com máquina de estados...');
  simulateFleet(); // roda imediatamente no boot
  setInterval(simulateFleet, TICK_MS);
}

module.exports = { startSimulator };

