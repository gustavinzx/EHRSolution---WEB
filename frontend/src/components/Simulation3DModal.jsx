import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { X } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ['pk', 'eyJ1IjoiZ3VzdGF2aW56eCIsImEiOiJjbXU0ZGR5Zm8wazN1Mnhwc3Fvdzh2cWpyIn0', 'rHkcwOwN3wgW5uK5Hpxr4w'].join('.');

export default function Simulation3DModal({ isOpen, onClose, truck }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const animationRef = useRef(null);
  
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

  // Initialization and Map Lifecycle
  useEffect(() => {
    if (!isOpen) {
      setIsSimulating(false);
      truckState.current.isPlaying = false;
      return;
    }
    
    const rawGeo = typeof truck?.route_geometry === 'string' ? JSON.parse(truck.route_geometry) : truck?.route_geometry;
    const hasRoute = rawGeo && rawGeo.length > 0;
    
    // Robust Coordinate Setup — Prioritize current truck position
    const safeLng = Number(truck?.lng);
    const safeLat = Number(truck?.lat);
    const hasValidTruckPos = !Number.isNaN(safeLng) && !Number.isNaN(safeLat) && safeLng !== 0 && safeLat !== 0;

    const startCoord = hasValidTruckPos
      ? [safeLng, safeLat]
      : (hasRoute ? [rawGeo[0][0], rawGeo[0][1]] : [-46.6333, -23.5505]);

    if (Number.isNaN(startCoord[0]) || Number.isNaN(startCoord[1])) {
      startCoord[0] = -46.6333;
      startCoord[1] = -23.5505;
    }

    truckState.current.coord = startCoord;
    truckState.current.targetCoord = startCoord;
    truckState.current.bearing = 0;
    
    if (hasRoute) {
      truckState.current.routeGeometry = turf.lineString(rawGeo);
      truckState.current.totalDistance = turf.length(truckState.current.routeGeometry, { units: 'meters' });
      
      // Calculate current distance along route based on route_index if available
      const routeIdx = Math.min(truck?.route_index || 0, rawGeo.length - 1);
      if (routeIdx > 0 && routeIdx < rawGeo.length - 1) {
        const sliced = turf.lineSlice(turf.point(rawGeo[0]), turf.point(rawGeo[routeIdx]), truckState.current.routeGeometry);
        truckState.current.currentDistance = turf.length(sliced, { units: 'meters' });
      } else {
        truckState.current.currentDistance = 0;
      }
      
      const nextPt = rawGeo[routeIdx + 1] || startCoord;
      truckState.current.bearing = turf.bearing(startCoord, nextPt);
    }

    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/navigation-night-v1',
        center: startCoord,
        zoom: 17,
        pitch: 65,
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
            'fill-extrusion-color': '#1E293B',
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

  // Live Telemetry Listener (smooth update targetCoord without resetting coord)
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded() && truck && !truckState.current.isPlaying) {
      const safeLng = Number(truck.lng);
      const safeLat = Number(truck.lat);
      if (safeLng && safeLat && !Number.isNaN(safeLng) && !Number.isNaN(safeLat)) {
        truckState.current.targetCoord = [safeLng, safeLat];
      }
    }
  }, [truck]);

  // Central Animation Engine
  const animateTruck = () => {
    let lastTime = 0;
    
    const loop = (time) => {
      if (!lastTime) lastTime = time;
      const deltaTime = time - lastTime;
      lastTime = time;

      // --- MODO 1: CINEMATOGRÁFICO (Simulação Rápida) ---
      if (truckState.current.isPlaying && truckState.current.routeGeometry) {
        if (deltaTime < 100) {
          const step = 33 * (deltaTime / 1000);
          truckState.current.currentDistance += step; 
        }

        if (truckState.current.currentDistance > truckState.current.totalDistance) {
          truckState.current.currentDistance = truckState.current.totalDistance;
          truckState.current.isPlaying = false;
          setIsSimulating(false);
        } else {
          const currentPt = turf.along(truckState.current.routeGeometry, truckState.current.currentDistance, { units: 'meters' });
          const nextPoint = currentPt.geometry.coordinates;
          const nextNextPoint = turf.along(truckState.current.routeGeometry, Math.min(truckState.current.currentDistance + 1, truckState.current.totalDistance), { units: 'meters' }).geometry.coordinates;
          
          const bearing = turf.bearing(nextPoint, nextNextPoint);

          truckState.current.coord = nextPoint;
          truckState.current.bearing = bearing;
        }

        if (truckState.current.isCameraLocked && map.current) {
          map.current.easeTo({
            center: truckState.current.coord,
            bearing: truckState.current.bearing,
            duration: 0,
            essential: true
          });
        }
        
        if (truckState.current.marker) {
          truckState.current.marker.setLngLat(truckState.current.coord);
          truckState.current.marker.setRotation(truckState.current.bearing);
        }

        animationRef.current = requestAnimationFrame(loop);
        return;
      }

      // --- MODO 2: TELEMETRIA AO VIVO (Movimento Suave) ---
      if (map.current && truckState.current.targetCoord) {
        const currentCenter = truckState.current.coord || truckState.current.targetCoord;
        const targetCoord = truckState.current.targetCoord;
        const distance = turf.distance(currentCenter, targetCoord, { units: 'meters' });

        let nextCoord = currentCenter;
        let bearing = truckState.current.bearing;

        if (distance > 2000) {
          // Snap if very far (e.g. route loop reset)
          nextCoord = targetCoord;
        } else if (distance > 0.2) {
          // Smooth glide towards target
          bearing = turf.bearing(currentCenter, targetCoord);
          const moveStep = Math.min(distance, Math.max(0.3, distance * 0.05));
          nextCoord = turf.destination(currentCenter, moveStep, bearing, { units: 'meters' }).geometry.coordinates;
        }

        truckState.current.coord = nextCoord;
        truckState.current.bearing = bearing;

        if (truckState.current.isCameraLocked && map.current) {
          map.current.easeTo({
            center: nextCoord,
            bearing: bearing,
            duration: 0,
            essential: true
          });
        }

        if (truckState.current.marker) {
          truckState.current.marker.setLngLat(nextCoord);
          truckState.current.marker.setRotation(bearing);
        }
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
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
      <div style={{ width: '90vw', height: '90vh', background: '#0a101a', borderRadius: '16px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(47,190,181,0.3)', boxShadow: '0 0 30px rgba(47,190,181,0.2)' }}>
        
        {/* Top Bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 24px', background: 'linear-gradient(180deg, rgba(0,0,0,0.8), transparent)', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f87171', boxShadow: '0 0 10px #f87171' }} className="pulse" />
              Rastreamento Cinematográfico 2.5D
            </h2>
            <div style={{ color: 'var(--teal)', fontSize: '13px', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              Alvo: {truck.model} | {truck.plate}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
        
        {/* Painel de Controle e Telemetria */}
        <div style={{ position: 'absolute', bottom: '24px', left: '24px', display: 'flex', gap: '16px', zIndex: 10 }}>
          
          <div style={{ background: 'rgba(10,16,26,0.8)', backdropFilter: 'blur(10px)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Telemetria</div>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Velocidade</div>
                <div style={{ fontSize: '18px', color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {isSimulating ? '120.0' : truck.speed_kmh} km/h
                </div>
              </div>
              {!isSimulating && truck.sim_state === 'fueling' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(248,113,113,0.15)',
                  border: '1px solid rgba(248,113,113,0.4)',
                  borderRadius: '10px', padding: '6px 14px',
                  animation: 'pulse-ring 1.4s ease-out infinite',
                }}>
                  <span style={{ fontSize: '16px' }}>⛽</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#f87171' }}>ABASTECENDO</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>Trava eletrônica ativa</div>
                  </div>
                </div>
              )}
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

          {/* Botão de Rota Completa (Modo Cinematográfico) */}
          <button 
            onClick={handleToggleSimulation}
            style={{ 
              background: isSimulating ? '#E2574C' : '#2FBEB5', 
              border: 'none', 
              color: '#000', 
              fontWeight: 'bold', 
              padding: '0 24px', 
              borderRadius: '12px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              boxShadow: isSimulating ? '0 0 15px rgba(226, 87, 76, 0.5)' : '0 0 15px rgba(47, 190, 181, 0.5)'
            }}
          >
            {isSimulating ? '⏹ Parar Simulação' : '▶️ Simular Rota Completa'}
          </button>

        </div>
      </div>
    </div>
  );
}
