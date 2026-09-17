// @vitest-environment jsdom
import React from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, act, cleanup, screen } from '@testing-library/react';
import * as turf from '@turf/turf';
import { normalizeRoute } from '../utils/routeGeometry';

const mocks = vi.hoisted(() => ({ maps: [], markers: [], frames: [], handlers: {}, get: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: () => ({ on: (event, callback) => { mocks.handlers[event] = callback; }, disconnect: () => {} }) }));
vi.mock('../api/client', () => ({ default: { get: mocks.get } }));
vi.mock('mapbox-gl', () => ({ default: {
  Map: class {
    constructor() { this.events = {}; this.sources = {}; this.layers = {}; mocks.maps.push(this); }
    on(name, callback) { this.events[name] = callback; }
    addSource(id, data) { this.sources[id] = { data: data.data, setData: vi.fn(value => { this.sources[id].data = value; }) }; }
    getSource(id) { return this.sources[id]; }
    addLayer(layer) { this.layers[layer.id] = layer; }
    getLayer(id) { return this.layers[id]; }
    isStyleLoaded() { return !!this.loaded; }
    load() { this.loaded = true; this.events['style.load'](); }
    setTerrain() {} resize() {} jumpTo() {} easeTo() {} setPaintProperty() {}
    getZoom() { return 16; } remove() {}
  },
  Marker: class {
    constructor(options) { this.element = options.element; this.options = options; mocks.markers.push(this); }
    setLngLat(coord) { this.coord = coord; return this; }
    setRotation(value) { this.rotation = value; return this; } addTo() { return this; } remove() {}
  }
} }));
vi.stubEnv('VITE_MAPBOX_TOKEN', 'test-token');
const { default: Modal } = await import('./Simulation3DModal');
const { default: store } = await import('../store/useFleetState');
const route = [[-47.9, -15.8], [-47.8, -15.8], [-47.7, -15.8]];
const truck = id => ({ id, plate: `TRUCK-${id}`, route_index: 1, lng: -47.75, lat: -15.8, speed_kmh: 75, route_phase: 'planned' });
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
beforeEach(() => {
  vi.useFakeTimers(); mocks.maps.length = 0; mocks.markers.length = 0; mocks.frames.length = 0; mocks.get.mockReset();
  vi.stubGlobal('requestAnimationFrame', callback => { mocks.frames.push(callback); return mocks.frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  store.setState({ fleet: [], truckRoutes: {}, routeErrors: {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('3D asynchronous routes', () => {
  it.each(Array.from({ length: 11 }, (_, i) => i + 1))('late route for truck %i updates without reopening', async id => {
    let resolve; mocks.get.mockImplementation(() => new Promise(done => { resolve = done; }));
    const current = truck(id); store.setState({ fleet: [current] });
    render(<Modal isOpen truck={current} onClose={() => {}} />);
    expect(mocks.get).toHaveBeenCalledWith(`/fleet/${id}/route`, expect.any(Object));
    act(() => mocks.maps[0].load());
    expect(screen.getByRole('status').textContent).toContain('Carregando rota');
    expect(mocks.maps[0].getSource('route')).toBeUndefined();
    await act(async () => resolve({ data: { route_geometry: route } }));
    expect(mocks.maps).toHaveLength(1);
    expect(mocks.maps[0].getSource('route').data.geometry.coordinates).toEqual(route);
    expect(screen.queryByRole('status')).toBeNull();
    expect(mocks.markers[0].coord[0]).toBeCloseTo(-47.75, 4);
    act(() => store.setState({ fleet: [{ ...current, lng: -47.72 }] }));
    act(() => { mocks.frames.shift()(100); mocks.frames.shift()(200); });
    expect(mocks.markers[0].coord[0]).toBeGreaterThan(-47.75);
    expect(turf.pointToLineDistance(mocks.markers[0].coord, turf.lineString(route), { units: 'meters' })).toBeLessThan(1);
  });
  it('handles route before style, replacement, and arrived state', async () => {
    mocks.get.mockResolvedValue({ data: { route_geometry: route } });
    const current = truck(1); render(<Modal isOpen truck={current} onClose={() => {}} />);
    await flush(); act(() => mocks.maps[0].load());
    const replacement = [[-48, -16], [-47.9, -16], [-47.8, -16]];
    act(() => store.setState({ fleet: [{ ...current, route_phase: 'arrived' }], truckRoutes: { 1: replacement } }));
    expect(mocks.maps).toHaveLength(1);
    expect(mocks.maps[0].getSource('route').setData).toHaveBeenCalled();
    expect(mocks.markers[0].coord[0]).toBeCloseTo(-47.8, 5);
  });
  it('retries twice, deduplicates calls, and shows terminal error', async () => {
    mocks.get.mockRejectedValue(new Error('offline'));
    const current = truck(1); render(<Modal isOpen truck={current} onClose={() => {}} />);
    act(() => mocks.maps[0].load());
    const pending = store.getState().fetchTruckRoute(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); await pending; });
    expect(mocks.get).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('status').textContent).toContain('Não foi possível');
    expect(mocks.maps[0].getSource('route')).toBeUndefined();
  });
  it('does not update a closed map when its request resolves, and loads on reopen', async () => {
    let resolve; mocks.get.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const current = truck(1);
    const { rerender } = render(<Modal isOpen truck={current} onClose={() => {}} />);
    act(() => mocks.maps[0].load());
    rerender(<Modal isOpen={false} truck={current} onClose={() => {}} />);
    await act(async () => resolve({ data: { route_geometry: route } }));
    expect(mocks.maps[0].getSource('route')).toBeUndefined();
    mocks.get.mockResolvedValue({ data: { route_geometry: route } });
    rerender(<Modal isOpen truck={current} onClose={() => {}} />);
    await flush();
    act(() => mocks.maps[1].load());
    expect(mocks.maps[1].getSource('route').data.geometry.coordinates).toEqual(route);
  });
  it('renders accepted detour when optional sources are still loading', async () => {
    mocks.get.mockResolvedValue({ data: { route_geometry: route } });
    const current = { ...truck(1), speed_kmh: 0, route_phase: 'to_station' };
    render(<Modal isOpen truck={current} onClose={() => {}} />);
    await flush();
    act(() => {
      mocks.maps[0].setTerrain = () => { mocks.maps[0].loaded = false; };
      mocks.maps[0].load();
    });
    console.log('[diagnostic] route accepted:', !!store.getState().truckRoutes[1], 'source:', !!mocks.maps[0].getSource('route'), 'style fully loaded:', mocks.maps[0].isStyleLoaded());
    expect(mocks.maps[0].getSource('route')).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('releases a hung request at 15s, retries, and ignores its late response', async () => {
    let late;
    mocks.get.mockImplementationOnce(() => new Promise(resolve => { late = resolve; }));
    render(<Modal isOpen truck={truck(1)} onClose={() => {}} />);
    act(() => mocks.maps[0].load());
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(store.getState().routeErrors[1]).toContain('15 segundos');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeDefined();
    mocks.get.mockResolvedValue({ data: { route_geometry: route } });
    await act(async () => { await store.getState().fetchTruckRoute(1); });
    await act(async () => { late({ data: { route_geometry: [[0, 0], [1, 1]] } }); });
    expect(store.getState().truckRoutes[1]).toEqual(route);
  });
  it('phase refresh supersedes an in-flight request', async () => {
    let late; mocks.get.mockImplementationOnce(() => new Promise(resolve => { late = resolve; }));
    const old = store.getState().fetchTruckRoute(1);
    mocks.get.mockResolvedValue({ data: { route_geometry: route } });
    await act(async () => { await store.getState().fetchTruckRoute(1, { force: true }); await old; });
    await act(async () => { late({ data: { route_geometry: [[0, 0], [1, 1]] } }); });
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(store.getState().truckRoutes[1]).toEqual(route);
  });
  it('keeps a visible marker if the PNG cannot load', async () => {
    mocks.get.mockResolvedValue({ data: { route_geometry: route } });
    render(<Modal isOpen truck={truck(1)} onClose={() => {}} />);
    await flush(); act(() => mocks.maps[0].load());
    const element = mocks.markers[0].element;
    act(() => element.querySelector('img').dispatchEvent(new Event('error')));
    expect(element.querySelector('[role="img"]').getAttribute('aria-label')).toContain('imagem indisponível');
  });
  it('accepts the eleven-point fallback route', () => {
    const fallback = Array.from({ length: 11 }, (_, i) => [-47.9 + i * .01, -15.8]);
    expect(normalizeRoute(JSON.stringify(fallback))).toEqual(fallback);
  });
  it('socket phase change fetches the detour even with a cached route', async () => {
    store.setState({ truckPhases: { 1: 'planned' }, truckRoutes: { 1: route } });
    store.getState().connectSocket();
    mocks.get.mockResolvedValue({ data: { route_geometry: route } });
    await act(async () => {
      mocks.handlers.fleetUpdate([{ ...truck(1), route_phase: 'to_station', speed_kmh: 0 }]);
      await store.getState().fetchTruckRoute(1);
    });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    console.log('[diagnostic] phase change requested /fleet/1/route');
    store.getState().disconnectSocket();
  });
  it('keeps the original PNG visible and centered at the arrived destination', async () => {
    mocks.get.mockResolvedValue({ data: { route_geometry: route } });
    render(<Modal isOpen truck={{ ...truck(1), route_phase: 'arrived', speed_kmh: 0 }} onClose={() => {}} />);
    await flush(); act(() => mocks.maps[0].load());
    const marker = mocks.markers[0];
    const img = marker.element.querySelector('img');
    expect(img.src).toContain('/images/caminhao-Photoroom.png');
    expect(img.style.transform).toBe('');
    // Measured opaque bounds must fill the clipping box, not sit outside it.
    const scale = parseFloat(img.style.width) / 2400;
    expect(parseFloat(img.style.left) + 1033 * scale).toBeCloseTo(0, 4);
    expect(parseFloat(img.style.top) + 90 * scale).toBeCloseTo(0, 4);
    expect(parseFloat(img.style.top) + 1231 * scale).toBeCloseTo(76, 4);
    expect(parseFloat(img.style.left) + 1367 * scale).toBeCloseTo(parseFloat(marker.element.style.width), 4);
    expect(marker.options.anchor).toBe('center');
    expect(marker.coord[0]).toBeCloseTo(route[2][0], 5);
    expect(marker.coord[1]).toBeCloseTo(route[2][1], 5);
    expect(marker.rotation).toBeGreaterThan(80);
    expect(marker.rotation).toBeLessThan(100);
  });
  it('recovers from transient network failure', async () => {
    mocks.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: { route_geometry: route } });
    render(<Modal isOpen truck={truck(1)} onClose={() => {}} />);
    act(() => mocks.maps[0].load());
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.maps[0].getSource('route')).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
