"use strict";
const db = require("../config/db");

/**
 * Libera o caminhão se estiver em sim_state='fueling' e não houver
 * outras sessões ativas ou autorizadas para ele.
 * Preserva o campo trucks.status sem alterá-lo.
 */
async function releaseTruckIfIdle(truckId, runner = db) {
  if (!truckId) return;
  await runner.query(
    "UPDATE trucks SET sim_state='idle', route_phase='planned', fueling_ticks=0 WHERE id=$1 AND sim_state='fueling' AND NOT EXISTS (SELECT 1 FROM fueling_sessions WHERE truck_id=$1 AND status IN ('authorized','active'))",
    [truckId]
  );
}

module.exports = {
  releaseTruckIfIdle,
};
