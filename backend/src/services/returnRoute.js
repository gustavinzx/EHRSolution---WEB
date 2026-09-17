"use strict";

// Both manual and simulator completion use the same road route back to the trip.
async function buildReturnRoute(truck) {
  const raw = truck.planned_route_geometry || truck.route_geometry;
  const planned = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!Array.isArray(planned) || planned.length < 2) throw new Error('Rota original indisponível para retorno');
  const index = Math.max(0, Math.min(planned.length - 1, Number(truck.route_resume_index) || 0));
  const destination = planned[index];
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${Number(truck.lng)},${Number(truck.lat)};${destination[0]},${destination[1]}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Serviço de retorno rodoviário indisponível');
  const data = await response.json();
  const route = data.routes?.[0]?.geometry?.coordinates;
  if (data.code !== 'Ok' || !Array.isArray(route) || route.length < 2) throw new Error('Não foi possível traçar o retorno à viagem');
  return { route, index };
}
module.exports = { buildReturnRoute };
