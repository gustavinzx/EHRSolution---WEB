describe('simulator state machine unit tests', () => {
  let trucks = [];
  let emitted = [];
  let writes = [];
  let simulateFleet;

  const fixture = (overrides) => ({
    id: 1,
    route_geometry: [[-47, -15], [-46.5, -15], [-46, -15]],
    route_index: 0,
    lat: -15,
    lng: -47,
    current_level_liters: 400,
    capacity_liters: 500,
    consumption_per_100km: 32,
    route_phase: 'planned',
    sim_state: 'driving',
    status: 'ok',
    ...overrides
  });

  const io = { emit: (name, data) => emitted.push({ name, data }) };

  beforeEach(() => {
    trucks = [];
    emitted = [];
    writes = [];

    const dbMock = {
      query: jest.fn(async (sql, params = []) => {
        writes.push({ sql, params });
        if (sql.includes('SELECT t.id')) return { rows: trucks.map((t) => ({ ...t })) };
        if (sql.includes('lat=$1, lng=$2, current_level_liters=$3')) {
          const t = trucks.find((item) => item.id === params[7]);
          if (t) {
            Object.assign(t, {
              lat: params[0],
              lng: params[1],
              current_level_liters: params[2],
              speed_kmh: params[3],
              route_index: params[4]
            });
          }
        }
        return { rows: [] };
      })
    };

    const fleetDataProviderMock = {
      getFleetSnapshot: async () => trucks.map((t) => ({ ...t })),
      getLiveEvents: async () => ({})
    };

    jest.isolateModules(() => {
      jest.doMock('../src/config/db', () => dbMock);
      jest.doMock('../src/services/fleetDataProvider', () => fleetDataProviderMock);
      const sim = require('../src/services/simulator');
      simulateFleet = sim.simulateFleet;
    });
  });

  afterEach(() => {
    jest.dontMock('../src/config/db');
    jest.dontMock('../src/services/fleetDataProvider');
  });

  it('active planned and station trips advance and emit updated coordinates', async () => {
    for (const phase of ['planned', 'to_station']) {
      trucks = [fixture({ route_phase: phase })];
      emitted = [];
      writes = [];
      await simulateFleet(io);
      const first = trucks[0].lng;
      await simulateFleet(io);
      expect(first).toBeGreaterThan(-47);
      expect(trucks[0].lng).toBeGreaterThan(first);
      expect(trucks[0].speed_kmh).toBeGreaterThan(0);
      expect(emitted.filter((e) => e.name === 'fleetUpdate').length).toBe(2);
      expect(emitted.filter((e) => e.name === 'fleetUpdate').at(-1).data[0].lng).toBe(trucks[0].lng);
    }
  });

  it('arrived and awaiting authorization remain stopped without restarting', async () => {
    for (const phase of ['arrived', 'awaiting_fueling_authorization']) {
      trucks = [fixture({ route_phase: phase })];
      writes = [];
      await simulateFleet(io);
      await simulateFleet(io);
      expect(trucks[0].lng).toBe(-47);
      expect(writes.filter((w) => w.sql.includes('INSERT INTO telemetry_logs')).length).toBe(0);
    }
  });

  it('empty fuel preserves position and reports the reason, not a moving vehicle', async () => {
    trucks = [fixture({ current_level_liters: 0, route_phase: 'to_station' })];
    writes = [];
    await simulateFleet(io);
    expect(trucks[0].lng).toBe(-47);
    expect(writes.some((w) => w.sql.includes("sim_state='out_of_fuel'"))).toBe(true);
  });

  it('new dispatch advances even after a completed trip', async () => {
    trucks = [fixture({ sim_state: 'arrived', route_phase: 'arrived' })];
    await simulateFleet(io);
    expect(trucks[0].lng).toBe(-47);
    Object.assign(trucks[0], { sim_state: 'driving', route_phase: 'planned', route_index: 0 });
    await simulateFleet(io);
    expect(trucks[0].lng).toBeGreaterThan(-47);
  });

  it('return trip rejoins planned route without treating the station as destination', async () => {
    const planned = [[-48, -16], [-47, -15], [-46, -14]];
    trucks = [fixture({
      route_phase: 'returning_to_route',
      route_index: 2,
      route_resume_index: 1,
      planned_route_geometry: planned
    })];
    writes = [];
    await simulateFleet(io);
    const rejoin = writes.find((w) => w.sql.includes("route_phase='planned'") && w.sql.includes('lat=$3'));
    expect(rejoin).toBeDefined();
    expect(rejoin.params.slice(0, 4)).toEqual([JSON.stringify(planned), 1, -15, -47]);
    expect(writes.some((w) => w.sql.includes("status='arrived'"))).toBe(false);
  });

  it('fueling completion calculates a road return instead of swapping straight to planned', async () => {
    const originalFetch = global.fetch;
    const returnPoints = [[-47, -15], [-47.1, -15.1], [-47.2, -15.2]];
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [{ geometry: { coordinates: returnPoints } }] })
    });
    try {
      trucks = [fixture({
        route_phase: 'fueling',
        sim_state: 'fueling',
        fueling_ticks: 5,
        planned_route_geometry: [[-47.2, -15.2], [-46, -14]]
      })];
      writes = [];
      await simulateFleet(io);
      const returning = writes.find((w) => w.sql.includes("route_phase='returning_to_route'"));
      expect(returning).toBeDefined();
      expect(returning.params[1]).toBe(JSON.stringify(returnPoints));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
