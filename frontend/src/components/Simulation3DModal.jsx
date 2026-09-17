import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { X, LocateFixed, Gauge, Route, Truck } from 'lucide-react';
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
    marker: null,
    stationMarker: null,
    targetCoord: null,
    isCameraLocked: true
  });

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
    if (map.current && map.current.isStyleLoaded()) {
      const lng = Number(liveTruck.lng);
      const lat = Number(liveTruck.lat);
      if (!Number.isNaN(lng) && !Number.isNaN(lat) && lng !== 0 && lat !== 0) {
        truckState.current.targetCoord = [lng, lat];
      }
    }
  }, [fleet, truckProp]);

  // Mantém o posto visível no Mapbox 3D quando o simulador entra em desvio.
  useEffect(() => {
    const liveTruck = truckProp && (fleet.find(t => t.id === truckProp.id) || truckProp);
    if (!map.current || !liveTruck || !map.current.isStyleLoaded()) return;
    const lat = Number(liveTruck.station_lat);
    const lng = Number(liveTruck.station_lng);
    const hasStation = Number.isFinite(lat) && Number.isFinite(lng) && liveTruck.route_phase && liveTruck.route_phase !== 'planned' && liveTruck.route_phase !== 'arrived';
    if (!hasStation) {
      if (truckState.current.stationMarker) { truckState.current.stationMarker.remove(); truckState.current.stationMarker = null; }
      return;
    }
    if (!truckState.current.stationMarker) {
      const el = document.createElement('div');
      el.style.cssText = 'width:30px;height:30px;border-radius:50%;background:#f59e0b;border:3px solid #fff;box-shadow:0 0 0 6px rgba(245,158,11,.25),0 4px 12px rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;font-size:15px';
      el.textContent = '⛽';
      truckState.current.stationMarker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map.current);
    } else {
      truckState.current.stationMarker.setLngLat([lng, lat]);
    }
  }, [fleet, truckProp]);

  // Initialization and Map Lifecycle
  useEffect(() => {
    if (!isOpen || !truckProp || !MAPBOX_TOKEN) {
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
            paint: { 'line-color': routeColor, 'line-width': 10, 'line-opacity': 0.9, 'line-emissive-strength': 0.35 }
          });
        }

        // -------------------------------------------------------------
        // ESTILO UBER (MARKER 2D - IMAGEM DO USUÁRIO)
        // -------------------------------------------------------------
        const el = document.createElement('div');
        el.className = 'uber-truck-marker';
        el.style.width = '64px';
        el.style.height = '140px';
        
        
        el.style.borderRadius = '12px';
        
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

        const truckImage = el.querySelector('img');
        truckImage.onerror = () => {
          el.innerHTML = '<div style="width:34px;height:54px;border-radius:10px;background:#2fbeb5;border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;font-size:22px">🚛</div>';
        };

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center', rotationAlignment: 'map', pitchAlignment: 'viewport' })
          .setLngLat(startCoord)
          .setRotation(truckState.current.bearing)
          .addTo(map.current);

        truckState.current.marker = marker;

        // Garante que a câmera comece na posição viva do caminhão e que o mapa
        // tenha dimensões corretas mesmo quando o modal acabou de abrir.
        map.current.resize();
        map.current.jumpTo({ center: startCoord, zoom: Math.max(map.current.getZoom(), 15), pitch: 55, bearing: truckState.current.bearing });

        animateTruck();
      });
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (truckState.current.marker) truckState.current.marker.remove();
      if (truckState.current.stationMarker) truckState.current.stationMarker.remove();
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
          const speedKmh = Math.max(0, Number(liveTruck?.speed_kmh) || 0);
          const step = Math.min(dist, dist * (dt / 2500), (speedKmh / 3.6) * (dt / 1000));
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

  if (!isOpen) return null;

  const stateLabel = { 
    driving: 'Em trânsito', 
    fueling: 'Abastecendo', 
    low_fuel: 'Combustível baixo', 
    no_signal: 'Sem sinal', 
    security_alert: 'Alerta de segurança', 
    arrived: 'Chegou ao destino', 
    ok: 'Operacional',
    planned: 'Rota Original',
    evaluating_station: 'Buscando posto',
    to_station: 'A caminho do posto',
    awaiting_fueling_authorization: 'Aguardando liberação',
    returning_to_route: 'Retornando à rota'
  }[liveTruckRef.current?.route_phase || liveSimState] || 'Aguardando dados';
  return (
    <div className="tracking-overlay">
      <section className="tracking-dialog" role="dialog" aria-modal="true" aria-labelledby="tracking-title">
        <header className="tracking-header">
          <div className="tracking-heading">
            <span className="tracking-symbol"><Truck size={20} /></span>
            <div><span className="eyebrow">MONITORAMENTO DA FROTA</span><h2 id="tracking-title">Rastreamento 3D <span>{truckProp?.plate}</span></h2><p>{truckProp?.model}</p></div>
          </div>
          <button className="icon-button" aria-label="Fechar rastreamento" onClick={onClose}><X size={20} /></button>
        </header>
        {MAPBOX_TOKEN ? <div ref={mapContainer} className="tracking-map" /> : <div className="tracking-empty"><Route size={32}/><h3>Mapa indisponível</h3><p>Configure o token do Mapbox para visualizar o rastreamento.</p></div>}
        <footer className="tracking-toolbar">
          <div className="tracking-metric"><span className="eyebrow"><Gauge size={14}/> VELOCIDADE</span><strong>{liveSpeed.toFixed(0)} <small>km/h</small></strong></div>
          <div className="tracking-metric"><span className="eyebrow">SITUAÇÃO DO VEÍCULO</span><span className={`vehicle-status ${liveSimState === 'no_signal' || liveSimState === 'low_fuel' ? 'vehicle-status-warning' : ''}`}><i/>{stateLabel}</span></div>
          <div className="tracking-actions">
            <label className="route-color"><Route size={16}/><span>Cor da rota</span><input type="color" aria-label="Cor da rota" value={routeColor} onChange={e=>setRouteColor(e.target.value)}/></label>
            <button className="panel-button" onClick={handleCenterCamera} disabled={isCameraLockedUI}><LocateFixed size={16}/>{isCameraLockedUI ? 'Seguindo veículo' : 'Seguir veículo'}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
