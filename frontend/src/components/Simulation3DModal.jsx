import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { X } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

import useFleetState from '../store/useFleetState';

export default function Simulation3DModal({ isOpen, onClose, truck: truckProp }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const animationRef = useRef(null);
  
  // Ref always holds the latest truck data so the animation loop reads live values
  const liveTruckRef = useRef(truckProp);

  const truckState = useRef({
    coord: [0, 0],
    bearing: 0,
    routeGeometry: null,
    totalDistance: 0,
    currentDistance: 0,
    isPlaying: false,
    marker: null,
    targetCoord: null,
    isCameraLocked: true
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const [routeColor, setRouteColor] = useState('#2FBEB5');
  const [isCameraLockedUI, setIsCameraLockedUI] = useState(true);
  // Live telemetry display state (updated from WebSocket store)
  const [liveSpeed, setLiveSpeed] = useState(0);
  const [liveSimState, setLiveSimState] = useState('');
  
  const { truckRoutes, fleet } = useFleetState();

  // ── Sync liveTruckRef and UI state with the Zustand/WebSocket fleet store ──
  useEffect(() => {
    if (!truckProp) return;
    const liveTruck = fleet.find(t => t.id === truckProp.id) || truckProp;
    liveTruckRef.current = liveTruck;
    setLiveSpeed(parseFloat(liveTruck.speed_kmh) || 0);
    setLiveSimState(liveTruck.sim_state || liveTruck.status || '');

    // In live mode, feed new GPS coord as target for fallback interpolation
    if (!truckState.current.isPlaying && map.current && map.current.isStyleLoaded()) {
      const lng = Number(liveTruck.lng);
      const lat = Number(liveTruck.lat);
      if (!Number.isNaN(lng) && !Number.isNaN(lat) && lng !== 0 && lat !== 0) {
        truckState.current.targetCoord = [lng, lat];
      }
    }
  }, [fleet, truckProp]);

  // Initialization and Map Lifecycle
  useEffect(() => {
    if (!isOpen || !truckProp || !MAPBOX_TOKEN) {
      setIsSimulating(false);
      truckState.current.isPlaying = false;
      return;
    }
    
    const liveTruck = liveTruckRef.current || truckProp;

    // Check if route is already string or array, or get it from store
    let routeData = typeof liveTruck.route_geometry === 'string' 
      ? JSON.parse(liveTruck.route_geometry) 
      : (liveTruck.route_geometry || truckRoutes[liveTruck.id]);

    // Defensive: handle object with .geometry.coordinates
    if (routeData && !Array.isArray(routeData) && routeData.geometry) {
      routeData = routeData.geometry.coordinates;
    }

    const rawGeo = Array.isArray(routeData) ? routeData : null;
    const hasRoute = rawGeo && rawGeo.length > 1;
    
    // Robust Coordinate Setup — Prioritize current truck position
    const safeLng = Number(liveTruck?.lng);
    const safeLat = Number(liveTruck?.lat);
    const hasValidTruckPos = !Number.isNaN(safeLng) && !Number.isNaN(safeLat) && safeLng !== 0 && safeLat !== 0;

    let startCoord = hasValidTruckPos
      ? [safeLng, safeLat]
      : (hasRoute ? [rawGeo[0][0], rawGeo[0][1]] : [-46.6333, -23.5505]);

    if (Number.isNaN(startCoord[0]) || Number.isNaN(startCoord[1])) {
      startCoord = [-46.6333, -23.5505];
    }

    truckState.current.coord = startCoord;
    truckState.current.targetCoord = startCoord;
    truckState.current.bearing = 0;
    
    if (hasRoute) {
      truckState.current.routeGeometry = turf.lineString(rawGeo);
      truckState.current.totalDistance = turf.length(truckState.current.routeGeometry, { units: 'meters' });
      
      // Calculate current distance along route based on route_index if available
      const routeIdx = Math.min(liveTruck?.route_index || 0, rawGeo.length - 1);
      if (routeIdx > 0 && routeIdx < rawGeo.length - 1) {
        try {
          const sliced = turf.lineSlice(turf.point(rawGeo[0]), turf.point(rawGeo[routeIdx]), truckState.current.routeGeometry);
          truckState.current.currentDistance = turf.length(sliced, { units: 'meters' });
        } catch(e) {
          truckState.current.currentDistance = 0;
        }
      } else {
        truckState.current.currentDistance = 0;
      }
      
      const nextIdx = Math.min(routeIdx + 1, rawGeo.length - 1);
      const nextPt = rawGeo[nextIdx];
      if (nextPt && (nextPt[0] !== startCoord[0] || nextPt[1] !== startCoord[1])) {
        try { truckState.current.bearing = turf.bearing(startCoord, nextPt); } catch(e) {}
      }
    }

    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: startCoord,
        zoom: 16,
        pitch: 55,
        bearing: truckState.current.bearing,
        antialias: true
      });

      // Free Camera Logic (Unlocks instantly on user interaction)
      const unlockCamera = () => {
        setIsCameraLockedUI(false);
        truckState.current.isCameraLocked = false;
      };
      
      map.current.on('mousedown', unlockCamera);
      map.current.on('touchstart', unlockCamera);
      map.current.on('wheel', unlockCamera);

      map.current.on('style.load', () => {
        // Mapbox 3D Terrain
        map.current.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
        map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

        // Mapbox 3D Buildings
        map.current.addLayer({
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 15,
          paint: {
            'fill-extrusion-color': '#cbd5e1', // Cor mais clara para contraste no satélite
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.8
          }
        });

        // GeoJSON Route
        if (hasRoute) {
          map.current.addSource('route', {
            type: 'geojson',
            data: truckState.current.routeGeometry
          });

          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': routeColor, 'line-width': 8, 'line-opacity': 0.6 }
          });
        }

        // -------------------------------------------------------------
        // ESTILO UBER (MARKER 2D - IMAGEM DO USUÁRIO)
        // -------------------------------------------------------------
        const el = document.createElement('div');
        el.className = 'uber-truck-marker';
        el.style.width = '64px';
        el.style.height = '140px';
        el.style.background = 'transparent';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        
        el.innerHTML = `
          <img 
            src="/images/caminhao-Photoroom.png" 
            alt="Truck" 
            style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(4px 10px 10px rgba(0,0,0,0.5));" 
          />
        `;

        const marker = new mapboxgl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
          .setLngLat(startCoord)
          .setRotation(truckState.current.bearing)
          .addTo(map.current);

        truckState.current.marker = marker;

        animateTruck();
      });
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (truckState.current.marker) truckState.current.marker.remove();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Dynamic Route Color Listener
  useEffect(() => {
    if (map.current && map.current.getLayer('route')) {
      map.current.setPaintProperty('route', 'line-color', routeColor);
    }
  }, [routeColor]);

  // Central Animation Engine — reads liveTruckRef so it always has fresh data
  const animateTruck = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    let lastTime = 0;
    
    const loop = (time) => {
      if (!lastTime) lastTime = time;
      const dt = Math.min(time - lastTime, 100); // cap to avoid huge jumps on tab focus
      lastTime = time;

      if (!map.current) return;

      // ── MODO DEMO: cinematic fast playback ──────────────────────────────
      if (truckState.current.isPlaying && truckState.current.routeGeometry) {
        truckState.current.currentDistance += 33 * (dt / 1000); // ~120 km/h

        if (truckState.current.currentDistance >= truckState.current.totalDistance) {
          truckState.current.currentDistance = truckState.current.totalDistance;
          truckState.current.isPlaying = false;
          setIsSimulating(false);
        }
        moveMarkerAlongRoute(truckState.current.currentDistance);
        animationRef.current = requestAnimationFrame(loop);
        return;
      }

      // ── MODO AO VIVO: follows backend route_index from WebSocket ─────────
      const liveTruck = liveTruckRef.current;

      if (liveTruck && liveTruck.route_index !== undefined && truckState.current.routeGeometry) {
        const rawGeo = truckState.current.routeGeometry.geometry.coordinates;
        const idx = Math.min(Math.max(0, liveTruck.route_index), rawGeo.length - 1);
        let targetDist = 0;
        if (idx > 0) {
          try {
            const sliced = turf.lineSlice(turf.point(rawGeo[0]), turf.point(rawGeo[idx]), truckState.current.routeGeometry);
            targetDist = turf.length(sliced, { units: 'meters' });
          } catch(e) {}
        }

        let current = truckState.current.currentDistance;
        // Detect route loop reset
        if (targetDist < current && (current - targetDist) > 500) current = targetDist;

        const diff = targetDist - current;
        if (Math.abs(diff) > 0.5) {
          let next = current + diff * (dt / 2500);
          if (diff > 0 && next > targetDist) next = targetDist;
          if (diff < 0 && next < targetDist) next = targetDist;
          truckState.current.currentDistance = next;
          moveMarkerAlongRoute(next);
        } else {
          truckState.current.currentDistance = targetDist;
        }
      } else if (truckState.current.targetCoord) {
        // Fallback: interpolate toward raw GPS coord when no route_index
        const cur = truckState.current.coord;
        const tgt = truckState.current.targetCoord;
        let dist = 0;
        try { dist = turf.distance(cur, tgt, { units: 'meters' }); } catch(e) {}

        if (dist > 2000) {
          truckState.current.coord = tgt;
          applyMarkerPosition(tgt, truckState.current.bearing);
        } else if (dist > 1) {
          const bearing = turf.bearing(cur, tgt);
          const step = Math.min(dist, Math.max(1, dist * (dt / 2500)));
          const next = turf.destination(cur, step, bearing, { units: 'meters' }).geometry.coordinates;
          truckState.current.coord = next;
          truckState.current.bearing = bearing;
          applyMarkerPosition(next, bearing);
        }
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
  };

  // Helper: move marker to a distance along the stored route geometry
  const moveMarkerAlongRoute = (distance) => {
    const line = truckState.current.routeGeometry;
    if (!line) return;
    const d = Math.min(Math.max(0, distance), truckState.current.totalDistance);
    try {
      const pt = turf.along(line, d, { units: 'meters' });
      const coord = pt.geometry.coordinates;
      const lookAhead = turf.along(line, Math.min(d + 10, truckState.current.totalDistance), { units: 'meters' });
      const bearing = turf.bearing(coord, lookAhead.geometry.coordinates);
      truckState.current.coord = coord;
      truckState.current.bearing = bearing;
      applyMarkerPosition(coord, bearing);
    } catch(e) {}
  };

  const applyMarkerPosition = (coord, bearing) => {
    if (truckState.current.marker) {
      truckState.current.marker.setLngLat(coord);
      truckState.current.marker.setRotation(bearing);
    }
    if (truckState.current.isCameraLocked && map.current) {
      map.current.easeTo({ center: coord, bearing, duration: 0, essential: true });
    }
  };

  const handleCenterCamera = () => {
    setIsCameraLockedUI(true);
    truckState.current.isCameraLocked = true;
  };

  const handleToggleSimulation = () => {
    const newIsSimulating = !isSimulating;
    truckState.current.isPlaying = newIsSimulating;
    setIsSimulating(newIsSimulating);

    if (!newIsSimulating) {
      truckState.current.targetCoord = truckState.current.coord;
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }}>
      <div style={{ position: 'relative', width: '90vw', height: '90vh', background: '#0a101a', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
        
        {!MAPBOX_TOKEN ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a101a', color: '#fff', textAlign: 'center', padding: '24px' }}>
            <X size={48} color="#f87171" style={{ marginBottom: '16px' }} />
            <h2 style={{ margin: '0 0 12px 0', fontSize: '24px' }}>Token do Mapbox Não Configurado</h2>
            <p style={{ maxWidth: '500px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              Para visualizar o mapa 3D cinemático, você precisa configurar um token do Mapbox. <br/><br/>
              Crie um arquivo <code>.env</code> na pasta <code>frontend/</code> contendo:<br/>
              <code style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px', display: 'inline-block', marginTop: '8px', color: '#34d399' }}>VITE_MAPBOX_TOKEN=pk.seu_token_aqui</code>
            </p>
            <button onClick={onClose} style={{ marginTop: '24px', background: 'var(--teal)', color: '#000', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
              Voltar
            </button>
          </div>
        ) : (
          <>
            {/* Top Bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 24px', background: 'linear-gradient(180deg, rgba(0,0,0,0.8), transparent)', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f87171', boxShadow: '0 0 10px #f87171' }} className="pulse" />
              Rastreamento Cinematográfico 2.5D
            </h2>
            <div style={{ color: 'var(--teal)', fontSize: '13px', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              Alvo: {truckProp?.model} | {truckProp?.plate}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
        
        {/* Painel de Controle e Telemetria */}
        <div style={{ position: 'absolute', bottom: '24px', left: '24px', display: 'flex', gap: '16px', zIndex: 10 }}>
          
          <div style={{ background: 'rgba(10,16,26,0.85)', backdropFilter: 'blur(10px)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', minWidth: '200px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.8px' }}>● Ao Vivo</div>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Velocidade</div>
                <div style={{ fontSize: '18px', color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {liveSpeed.toFixed(1)} km/h
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Estado</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 
                  liveSimState === 'fueling' ? '#f87171' :
                  liveSimState === 'low_fuel' ? '#fbbf24' :
                  liveSimState === 'driving' ? '#34d399' : '#94a3b8'
                }}>
                  {liveSimState === 'fueling' ? '⛽ Abastecendo' :
                   liveSimState === 'low_fuel' ? '⚠️ Baixo' :
                   liveSimState === 'driving' ? '🚛 Em Trânsito' :
                   liveSimState || '—'}
                </div>
              </div>
            </div>
          </div>

          {!isCameraLockedUI && (
            <button 
              onClick={handleCenterCamera}
              style={{ 
                background: 'rgba(255,255,255,0.1)', 
                border: '1px solid rgba(255,255,255,0.2)', 
                color: '#fff', 
                padding: '0 20px', 
                borderRadius: '12px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📍 Centralizar Câmera
            </button>
          )}

          {/* Seletor de Cor da Rota */}
          <div style={{ 
            background: 'rgba(10,16,26,0.8)', 
            border: '1px solid rgba(255,255,255,0.1)', 
            borderRadius: '12px', 
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>COR DA ROTA</span>
            <input 
              type="color" 
              value={routeColor} 
              onChange={(e) => setRouteColor(e.target.value)}
              style={{ width: '32px', height: '32px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
            />
          </div>

          {/* Botão Demo — opcional, caminhão já se move ao vivo sem clicar aqui */}
          <button 
            onClick={handleToggleSimulation}
            title="Percorre a rota completa em velocidade acelerada (modo demo)"
            style={{ 
              background: isSimulating ? '#E2574C' : 'rgba(47,190,181,0.15)', 
              border: `1px solid ${isSimulating ? '#E2574C' : '#2FBEB5'}`,
              color: isSimulating ? '#fff' : '#2FBEB5', 
              fontWeight: 700, 
              padding: '0 24px', 
              borderRadius: '12px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: isSimulating ? '0 0 15px rgba(226, 87, 76, 0.4)' : 'none'
            }}
          >
            {isSimulating ? '⏹ Parar Demo' : '⚡ Demo Acelerada'}
          </button>

        </div>
        </>
        )}
      </div>
    </div>
  );
}
