import * as turf from '@turf/turf';

export function normalizeRoute(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const coordinates = value?.geometry?.coordinates ?? value?.coordinates ?? value;
    return Array.isArray(coordinates) && coordinates.length > 1 &&
      coordinates.every(p => Array.isArray(p) && p.length >= 2 &&
        Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)
      ? coordinates : null;
  } catch { return null; }
}

export function routeDistance(coordinates, truck) {
  const arrived = [truck?.route_phase, truck?.sim_state, truck?.status].includes('arrived');
  const index = arrived ? coordinates.length - 1 : Math.min(coordinates.length - 1,
    Math.max(0, Math.floor(Number(truck?.route_index) || 0)));
  let distance = 0;
  for (let i = 0; i < index; i++) {
    distance += turf.distance(coordinates[i], coordinates[i + 1], { units: 'meters' });
  }
  if (index < coordinates.length - 1 && truck?.lng != null && truck?.lat != null &&
      Number.isFinite(Number(truck.lng)) && Number.isFinite(Number(truck.lat))) {
    const segment = turf.lineString([coordinates[index], coordinates[index + 1]]);
    const point = turf.nearestPointOnLine(segment, [Number(truck.lng), Number(truck.lat)], { units: 'meters' });
    distance += point.properties.location;
  }
  return distance;
}
