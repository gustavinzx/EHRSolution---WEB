"use strict";
const db = require("../config/db");
const { buildReturnRoute, buildReturnToBase } = require("./returnRoute");

// ─── Constants ────────────────────────────────────────────────────────────────
const TICK_MS             = 3000;   // 3s per tick
const ROUTE_JUMP          = 5;      // route points advanced per tick
const SAFETY_FUEL_MARGIN  = 0.20;   // 20% reserved
const STATION_RADIUS_M    = 150;    // meters — considered "at station"
const MIN_KM_BETWEEN_FUEL = 80;     // minimum km between refuels
const FUELING_TICKS       = 6;      // ~18s of fueling simulation

// ─── Haversine ────────────────────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function haversineM(lat1, lon1, lat2, lon2) {
  return haversineKm(lat1, lon1, lat2, lon2) * 1000;
}

// ─── Estimate remaining distance along route ──────────────────────────────────
function remainingRouteKm(route, currentIndex) {
  let dist = 0;
  for (let i = currentIndex; i < route.length - 1; i++) {
    const [lng1, lat1] = route[i];
    const [lng2, lat2] = route[i + 1];
    dist += haversineKm(lat1, lng1, lat2, lng2);
  }
  return dist;
}

// ─── Route from OSRM (with fallback) ─────────────────────────────────────────
async function fetchOSRMRoute(originLat, originLng, destLat, destLng) {
  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.code === "Ok" && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates; // [[lng, lat], ...]
    }
  } catch (e) {
    // OSRM failed — use straight line
  }
  // Straight line fallback: 10 intermediate points
  const points = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    points.push([originLng + (destLng - originLng) * t, originLat + (destLat - originLat) * t]);
  }
  return points;
}

// ─── Find best reachable station ─────────────────────────────────────────────
async function findBestStation(truck, route, currentIndex) {
  const fuelL       = parseFloat(truck.current_level_liters);
  const consumption = parseFloat(truck.consumption_per_100km || 32);
  const autonomyKm  = (fuelL / consumption) * 100 * (1 - SAFETY_FUEL_MARGIN);
  const truckLat    = parseFloat(truck.lat);
  const truckLng    = parseFloat(truck.lng);

  const { rows: stations } = await db.query("SELECT * FROM fuel_stations WHERE active = true");
  
  const candidates = stations
    .map(s => ({
      ...s,
      distKm: haversineKm(truckLat, truckLng, parseFloat(s.lat), parseFloat(s.lng))
    }))
    .filter(s => s.distKm <= autonomyKm)  // can reach with remaining fuel
    .sort((a, b) => a.distKm - b.distKm);

  return candidates[0] || null;
}

// ─── Main simulator tick ───────────────────────────────────────────────────────
async function simulateFleet(io) {
  try {
    const { rows: trucks } = await db.query(`
      SELECT t.id, t.plate, t.model, t.dest_name,
             t.current_level_liters, t.capacity_liters,
             t.consumption_per_100km,
             t.route_geometry, t.planned_route_geometry,
             t.route_index, t.route_resume_index,
             t.route_phase, t.fuel_station_id,
             t.sim_state, t.fueling_ticks,
             t.lat, t.lng, t.status,
             fs.lat AS station_lat, fs.lng AS station_lng, fs.name AS station_name
      FROM trucks t
      LEFT JOIN fuel_stations fs ON t.fuel_station_id = fs.id
      WHERE t.route_geometry IS NOT NULL
    `);

    for (const truck of trucks) {
      try {
      let route;
      try { route = typeof truck.route_geometry === "string" ? JSON.parse(truck.route_geometry) : truck.route_geometry; }
      catch { console.error(`[SIM] Rota inválida ignorada no caminhão #${truck.id}`); continue; }

      if (!route || !Array.isArray(route) || route.length < 2) continue;

      const phase         = truck.route_phase || "planned";
      const simState      = truck.sim_state   || "driving";
      const fuelL         = parseFloat(truck.current_level_liters);
      const capacityL     = parseFloat(truck.capacity_liters);
      const consumption   = parseFloat(truck.consumption_per_100km || 32);
      let   routeIndex    = parseInt(truck.route_index) || 0;

      // ── ARRIVED — do nothing ──────────────────────────────────────────────
      if (simState === "arrived" || phase === "arrived") {
        await db.query("UPDATE trucks SET speed_kmh=0, status='arrived', route_phase='arrived', sim_state='arrived' WHERE id=$1", [truck.id]);
        continue;
      }

      // ── AWAITING FUELING AUTHORIZATION — stay still ───────────────────────
      if (phase === "awaiting_fueling_authorization") {
        await db.query("UPDATE trucks SET speed_kmh=0 WHERE id=$1", [truck.id]);
        continue;
      }

      // ── FUELING (session active, simulator manages short animation) ───────
      if (phase === "fueling" || simState === "fueling") {
        const newTicks = (parseInt(truck.fueling_ticks) || 0) + 1;
        if (newTicks >= FUELING_TICKS) {
          const returning = await buildReturnRoute(truck);
          // Fueling complete — fill tank, create log, return to route
          const levelBefore = fuelL;
          const levelAfter  = capacityL;
          const method      = Math.random() < 0.85 ? "facial" : "ble_fallback";
          const { rows: driverRows } = await db.query(
            "SELECT driver_id FROM driver_trucks WHERE truck_id=$1 LIMIT 1", [truck.id]
          );
          const driverId = driverRows[0]?.driver_id || null;

          await db.query(
            `INSERT INTO fueling_logs (driver_id, truck_id, lat, lng, level_before, level_after, release_method, station_id, station_name, started_at, completed_at, volume_liters)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW() - INTERVAL '3 minutes',NOW(),$10)`,
            [driverId, truck.id, truck.lat, truck.lng, levelBefore, levelAfter, method,
             truck.fuel_station_id || null, truck.station_name || null, levelAfter - levelBefore]
          );

          // Fecha a sessão autorizada correspondente quando o abastecimento automático termina.
          await db.query(`UPDATE fueling_sessions
            SET status='completed', completed_at=NOW(), duration_minutes=18
            WHERE truck_id=$1 AND status IN ('authorized','active')`, [truck.id]);

          await db.query(`
            UPDATE trucks SET
              current_level_liters=$1, speed_kmh=0, status='ok',
              sim_state='driving', route_phase='returning_to_route',
              fueling_ticks=0, route_geometry=$2, route_index=0, route_resume_index=$3
            WHERE id=$4
          `, [levelAfter, JSON.stringify(returning.route), returning.index, truck.id]);

          console.log(`[SIM] Truck #${truck.id} abasteceu | ${levelBefore.toFixed(0)}L -> ${levelAfter.toFixed(0)}L`);
        } else {
          await db.query("UPDATE trucks SET speed_kmh=0, fueling_ticks=$1 WHERE id=$2", [newTicks, truck.id]);
        }
        continue;
      }

      // ── TO_STATION — moving toward fuel station ───────────────────────────
      if (phase === "to_station") {
        // Check if arrived at station
        if (truck.station_lat && truck.station_lng) {
          const distToStation = haversineM(
            parseFloat(truck.lat), parseFloat(truck.lng),
            parseFloat(truck.station_lat), parseFloat(truck.station_lng)
          );

          if (distToStation <= STATION_RADIUS_M || routeIndex >= route.length - 1) {
            // Arrived at station!
            await db.query(`
              UPDATE trucks SET
                lat=$1, lng=$2, speed_kmh=0, sim_state='fueling',
                route_phase='awaiting_fueling_authorization'
              WHERE id=$3
            `, [parseFloat(truck.station_lat), parseFloat(truck.station_lng), truck.id]);
            console.log(`[SIM] Truck #${truck.id} chegou ao posto: ${truck.station_name}`);
            continue;
          }
        }
        // Keep moving on temporary route toward station (fall through to movement logic below)
      }

      if (phase === 'returning_to_route' && routeIndex >= route.length - 1) {
        const planned = typeof truck.planned_route_geometry === 'string' ? JSON.parse(truck.planned_route_geometry) : truck.planned_route_geometry;
        const resumeIndex = Math.min(planned.length - 1, Math.max(0, Number(truck.route_resume_index) || 0));
        await db.query(`UPDATE trucks SET route_geometry=$1, route_index=$2, lat=$3, lng=$4,
          route_phase='planned', sim_state='driving', fuel_station_id=NULL WHERE id=$5`,
          [JSON.stringify(planned), resumeIndex, planned[resumeIndex][1], planned[resumeIndex][0], truck.id]);
        continue;
      }

      // ── End of route check ─────────────────────────────────────────────────
      if (routeIndex >= route.length - 1) {
        // Final destination reached
        await db.query(`
          UPDATE trucks SET route_index=$1, speed_kmh=0, status='arrived',
          sim_state='arrived', route_phase='arrived' WHERE id=$2
        `, [route.length - 1, truck.id]);

        const { rows: existing } = await db.query(
          "SELECT id FROM fleet_alerts WHERE truck_id=$1 AND type='destination_arrived' AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1",
          [truck.id]
        );
        if (existing.length === 0) {
          const { rows: alert } = await db.query(
            "INSERT INTO fleet_alerts (truck_id,type,severity,message,plate,model) VALUES ($1,'destination_arrived','low',$2,$3,$4) RETURNING *",
            [truck.id, `Caminhão chegou ao destino: ${truck.dest_name || "destino final"}.`, truck.plate, truck.model]
          );
          if (io && alert[0]) io.emit("newAlert", alert[0]);
        }
        console.log(`[SIM] Truck #${truck.id} chegou ao destino.`);
        continue;
      }

      // Preserve the trip, but expose why a vehicle cannot advance.
      // A later authorized refuel resumes this same trip through the normal flow.
      if (fuelL <= 0) {
        await db.query("UPDATE trucks SET speed_kmh=0, status='critical_fuel', sim_state='out_of_fuel' WHERE id=$1", [truck.id]);
        continue;
      }

      // ── MOVEMENT (planned or to_station) ─────────────────────────────────
      const speed = 75 + Math.random() * 15; // 75-90 km/h
          const TIME_MULTIPLIER = 15; // Velocidade visual e logica (15x o tempo real) // acelera moderadamente a simulação sem saltos perceptíveis
          const distToTravelM = (speed * 1000 / 3600) * (TICK_MS / 1000) * TIME_MULTIPLIER;
        let remainingM = distToTravelM;
        
        let nextIndex = routeIndex;
        let curLat = parseFloat(truck.lat);
        let curLng = parseFloat(truck.lng);
        
        while (remainingM > 0 && nextIndex < route.length - 1) {
          const [targetLng, targetLat] = route[nextIndex + 1];
          const segDistM = haversineM(curLat, curLng, targetLat, targetLng);
          
          if (segDistM <= remainingM) {
            curLat = targetLat;
            curLng = targetLng;
            remainingM -= segDistM;
            nextIndex++;
          } else {
            const ratio = remainingM / segDistM;
            curLat = curLat + (targetLat - curLat) * ratio;
            curLng = curLng + (targetLng - curLng) * ratio;
            remainingM = 0;
          }
        }
        
        const nextLat = curLat;
        const nextLng = curLng;
        const prevLat = parseFloat(truck.lat);
        const prevLng = parseFloat(truck.lng);
        const distKm = (distToTravelM - remainingM) / 1000;

      // Realistic consumption: L per 100km, ±15% speed variation
      const speedFactor   = 1 + (speed - 80) / 800; // faster = slightly more consumption
      const consumedL     = (distKm * consumption / 100) * speedFactor; // distKm já está com o TIME_MULTIPLIER embutido!
      let newFuel = fuelL - consumedL;
      const fuelPct       = (newFuel / capacityL) * 100;

      // ── Autonomy-based fueling decision (only in 'planned' phase) ────────
      let nextPhase  = phase;
      let nextStatus = truck.status === "security_alert" ? "security_alert" : "ok";
      let stationId  = truck.fuel_station_id;

      if (phase === "planned" && !stationId) {
        const autonomyKm     = (newFuel / consumption) * 100 * (1 - SAFETY_FUEL_MARGIN);
        const distToDestKm   = remainingRouteKm(route, nextIndex);

        if (fuelPct < 25 && autonomyKm < distToDestKm) {
          // Need to refuel — find station
          nextPhase = "evaluating_station";
          const station = await findBestStation(truck, route, nextIndex);

          if (station) {
            // Check there hasn't been a recent refuel within MIN_KM_BETWEEN_FUEL
            const { rows: recentFuel } = await db.query(
              "SELECT id FROM fueling_logs WHERE truck_id=$1 AND timestamp > NOW() - INTERVAL '3 hours' LIMIT 1",
              [truck.id]
            );

            if (true) {
              console.log(`[SIM] Truck #${truck.id} calculando rota ao posto: ${station.name} (${station.distKm?.toFixed(1)}km)`);
              // Calculate route to station
              const tempRoute = await fetchOSRMRoute(
                parseFloat(truck.lat), parseFloat(truck.lng),
                parseFloat(station.lat), parseFloat(station.lng)
              );
              // Save planned route before overwriting
              const plannedRoute = truck.planned_route_geometry
                ? truck.planned_route_geometry
                : route;

              await db.query(`
                UPDATE trucks SET
                  route_geometry=$1,
                  planned_route_geometry=$2,
                  route_resume_index=$3,
                  route_index=0,
                  fuel_station_id=$4,
                  route_phase='to_station'
                WHERE id=$5
              `, [
                JSON.stringify(tempRoute),
                typeof plannedRoute === "string" ? plannedRoute : JSON.stringify(plannedRoute),
                nextIndex,
                station.id,
                truck.id
              ]);
              continue; // will process on next tick
            }
          }
          // No suitable station found — continue driving, alert
          nextPhase = "planned";
        }
      }

      let actualSpeed = speed;
      let finalLat = nextLat;
      let finalLng = nextLng;
      let finalIndex = nextIndex;
      if (newFuel <= 0) {
        newFuel = 0;
        actualSpeed = 0;
        nextStatus = 'critical_fuel';
        finalLat = prevLat;
        finalLng = prevLng;
        finalIndex = routeIndex;
      } else {
        if (fuelPct <= 40 && nextStatus !== 'security_alert') nextStatus = 'low_fuel';
        if (fuelPct <= 15) nextStatus = 'critical_fuel';
      }

      await db.query(`
        UPDATE trucks SET
          lat=$1, lng=$2, current_level_liters=$3, speed_kmh=$4,
          route_index=$5, status=$6, sim_state='driving',
          route_phase=$7, fueling_ticks=0, updated_at=NOW()
        WHERE id=$8
      `, [finalLat, finalLng, newFuel, actualSpeed, finalIndex, nextStatus, nextPhase, truck.id]);

      await db.query(
        "INSERT INTO telemetry_logs (truck_id, lat, lng, speed_kmh, fuel_level_liters) VALUES ($1,$2,$3,$4,$5)",
        [truck.id, finalLat, finalLng, actualSpeed, newFuel]
      );
      } catch (error) {
        console.error(`[SIM] Caminhão #${truck.id}: ${error.message}`);
      }
    }

    // Emit fleet update to all connected clients
    if (io) {
      const fleetDataProvider = require("./fleetDataProvider");
      const snap = await fleetDataProvider.getFleetSnapshot();
      io.emit("fleetUpdate", snap);
      const liveEvents = await fleetDataProvider.getLiveEvents();
      io.emit("liveEventsUpdate", liveEvents);
    }
  } catch (err) {
    console.error("[SIM] Erro:", err.message);
  }
}

const { detectFuelAnomalies, detectUnauthorizedStationFueling } = require("./anomalyDetector");

function startSimulator(io) {
  console.log("[SIM] Iniciando simulador realista de frota...");
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await simulateFleet(io); await detectFuelAnomalies(io); await detectUnauthorizedStationFueling(io); }
    finally { running = false; }
  };
  tick();
  setInterval(tick, TICK_MS);
}

module.exports = { startSimulator, simulateFleet };
