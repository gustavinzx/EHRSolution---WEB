const { test } = require('node:test');
const assert = require('node:assert/strict');
let trucks = [], emitted = [], writes = [];
const db = { query: async (sql, params = []) => {
  writes.push({ sql, params });
  if (sql.includes('SELECT t.id')) return { rows: trucks.map(t => ({ ...t })) };
  if (sql.includes('lat=$1, lng=$2, current_level_liters=$3')) {
    const t = trucks.find(t => t.id === params[7]);
    Object.assign(t, { lat: params[0], lng: params[1], current_level_liters: params[2], speed_kmh: params[3], route_index: params[4] });
  }
  return { rows: [] };
} };
require.cache[require.resolve('../src/config/db')] = { exports: db };
require.cache[require.resolve('../src/services/fleetDataProvider')] = { exports: {
  getFleetSnapshot: async () => trucks.map(t => ({ ...t })), getLiveEvents: async () => ({})
} };
const { simulateFleet } = require('../src/services/simulator');
const io = { emit: (name, data) => emitted.push({ name, data }) };
const fixture = overrides => ({ id: 1, route_geometry: [[-47, -15], [-46.5, -15], [-46, -15]],
  route_index: 0, lat: -15, lng: -47, current_level_liters: 400, capacity_liters: 500,
  consumption_per_100km: 32, route_phase: 'planned', sim_state: 'driving', status: 'ok', ...overrides });

test('active planned and station trips advance and emit updated coordinates', async () => {
  for (const phase of ['planned', 'to_station']) {
    trucks = [fixture({ route_phase: phase })]; emitted = []; writes = [];
    await simulateFleet(io); const first = trucks[0].lng;
    await simulateFleet(io);
    assert.ok(first > -47); assert.ok(trucks[0].lng > first);
    assert.ok(trucks[0].speed_kmh > 0);
    assert.equal(emitted.filter(e => e.name === 'fleetUpdate').length, 2);
    assert.equal(emitted.filter(e => e.name === 'fleetUpdate').at(-1).data[0].lng, trucks[0].lng);
  }
});
test('arrived and awaiting authorization remain stopped without restarting', async () => {
  for (const phase of ['arrived', 'awaiting_fueling_authorization']) {
    trucks = [fixture({ route_phase: phase })]; writes = [];
    await simulateFleet(io); await simulateFleet(io);
    assert.equal(trucks[0].lng, -47);
    assert.equal(writes.filter(w => w.sql.includes('INSERT INTO telemetry_logs')).length, 0);
  }
});
test('empty fuel preserves position and reports the reason, not a moving vehicle', async () => {
  trucks = [fixture({ current_level_liters: 0, route_phase: 'to_station' })]; writes = [];
  await simulateFleet(io);
  assert.equal(trucks[0].lng, -47);
  assert.ok(writes.some(w => w.sql.includes("sim_state='out_of_fuel'")));
});
test('new dispatch advances even after a completed trip', async () => {
  trucks = [fixture({ sim_state: 'arrived', route_phase: 'arrived' })];
  await simulateFleet(io); assert.equal(trucks[0].lng, -47);
  Object.assign(trucks[0], { sim_state: 'driving', route_phase: 'planned', route_index: 0 });
  await simulateFleet(io); assert.ok(trucks[0].lng > -47);
});

test('return trip rejoins planned route without treating the station as destination', async () => {
  const planned = [[-48,-16],[-47,-15],[-46,-14]];
  trucks = [fixture({ route_phase:'returning_to_route', route_index:2, route_resume_index:1, planned_route_geometry:planned })]; writes=[];
  await simulateFleet(io);
  const rejoin = writes.find(w => w.sql.includes("route_phase='planned'") && w.sql.includes('lat=$3'));
  assert.ok(rejoin);
  assert.deepEqual(rejoin.params.slice(0,4), [JSON.stringify(planned),1,-15,-47]);
  assert.equal(writes.some(w => w.sql.includes("status='arrived'")),false);
});
test('fueling completion calculates a road return instead of swapping straight to planned', async () => {
  const originalFetch=global.fetch;
  const returnPoints=[[-47,-15],[-47.1,-15.1],[-47.2,-15.2]];
  global.fetch=async()=>({ok:true,json:async()=>({code:'Ok',routes:[{geometry:{coordinates:returnPoints}}]})});
  try {
    trucks=[fixture({route_phase:'fueling',sim_state:'fueling',fueling_ticks:5,planned_route_geometry:[[-47.2,-15.2],[-46,-14]]})];writes=[];
    await simulateFleet(io);
    const returning=writes.find(w=>w.sql.includes("route_phase='returning_to_route'"));
    assert.ok(returning);assert.equal(returning.params[1],JSON.stringify(returnPoints));
  } finally {global.fetch=originalFetch;}
});
