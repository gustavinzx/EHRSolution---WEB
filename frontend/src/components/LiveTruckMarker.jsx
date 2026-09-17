import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import useFleetState from '../store/useFleetState';

export function getTruckIcon(truck, color) {
  const driverName = truck.current_drivers?.length > 0 ? truck.current_drivers[0].name.split(' ')[0] : null;
  const driverTag = driverName ? `
    <div style="
      position: absolute;
      bottom: 34px;
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      background: rgba(11, 20, 36, 0.92);
      border: 1px solid rgba(47, 190, 181, 0.4);
      box-shadow: 0 4px 14px rgba(0,0,0,0.6);
      padding: 3px 9px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 5px;
      pointer-events: none;
      backdrop-filter: blur(8px);
      z-index: 10;
    ">
      <span style="width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399;flex-shrink:0;"></span>
      <span>${driverName}</span>
    </div>
  ` : '';

  if (truck.sim_state === 'fueling') {
    return `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;">
        ${driverTag}
        <div style="width: 36px; height: 36px; background: ${color}; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 15px ${color}; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #fff; animation: pulse 1.5s infinite;">
          🚛
        </div>
        <div style="position:absolute; bottom:-5px; right:-5px; background:#ef4444; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:10px; border:2px solid #fff;">⛽</div>
      </div>
    `;
  }
  // Ícone de caminhão padrão com tag do motorista
  return `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;">
      ${driverTag}
      <div style="
        width:28px;height:28px;
        background:${color};
        border-radius:50%;
        border:2px solid #fff;
        box-shadow:0 0 12px ${color};
        display:flex;align-items:center;justify-content:center;
        color:#0a101a;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 17h4V5H2v12h3"/>
          <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/>
          <path d="M14 17h1"/>
          <circle cx="7.5" cy="17.5" r="2.5"/>
          <circle cx="17.5" cy="17.5" r="2.5"/>
        </svg>
      </div>
    </div>`;
}



function LiveTruckMarker({ truck, iconHtml, isFueling = truck.sim_state === 'fueling', children, onClick }) {
  const map = useMap();
  const markerRef = useRef(null);
  const { truckRoutes } = useFleetState();
  const rawGeometry = truckRoutes[truck.id] ?? truck.route_geometry;
  const routeGeometry = useMemo(() => {
    try {
      const geometry = typeof rawGeometry === 'string' ? JSON.parse(rawGeometry) : rawGeometry;
      return Array.isArray(geometry) && geometry.length > 1 ? geometry : null;
    } catch {
      return null;
    }
  }, [rawGeometry]);
  const color = { ok: '#34d399', low_fuel: '#fbbf24', no_signal: '#f87171', fueling: '#f87171', security_alert: '#fb7185', arrived: '#60a5fa' }[truck.sim_state === 'fueling' ? 'fueling' : truck.status] || '#34d399';
  const markerHtml = iconHtml ?? getTruckIcon(truck, color);
  
  const currentDistanceRef = useRef(0);
  const targetDistanceRef = useRef(0);
  const animationRef = useRef(null);
  const totalDistRef = useRef(0);
  const lineRef = useRef(null);
  const routeInitializedRef = useRef(false);
  const transitionsRef = useRef({ zoom: false, move: false });
  const isMapTransitioning = useRef(false);
  const initialPosition = useRef([parseFloat(truck.lat), parseFloat(truck.lng)]);
  const icon = useMemo(() => L.divIcon({
    html: markerHtml,
    className: 'route-truck',
    iconSize: isFueling ? [34, 34] : [28, 28],
    iconAnchor: isFueling ? [17, 17] : [14, 14],
  }), [markerHtml, isFueling]);
  const initialIcon = useRef(icon);
  const latestRef = useRef(null);
  latestRef.current = { lat: parseFloat(truck.lat), lng: parseFloat(truck.lng), isFueling, icon };

  const syncMarker = useCallback(() => {
    const marker = markerRef.current;
    if (!marker || isMapTransitioning.current) return;
    const latest = latestRef.current;
    if (marker.getIcon() !== latest.icon) marker.setIcon(latest.icon);
    if (lineRef.current && routeInitializedRef.current && !latest.isFueling) {
      const point = turf.along(lineRef.current, currentDistanceRef.current, { units: 'meters' });
      const [lng, lat] = point.geometry.coordinates;
      marker.setLatLng([lat, lng]);
    } else {
      marker.setLatLng([latest.lat, latest.lng]);
    }
  }, []);

  useEffect(() => {
    const onStart = ({ type }) => {
      transitionsRef.current[type === 'zoomstart' ? 'zoom' : 'move'] = true;
      isMapTransitioning.current = true;
    };
    const onEnd = ({ type }) => {
      const transitions = transitionsRef.current;
      transitions[type === 'zoomend' ? 'zoom' : 'move'] = false;
      // A zoom can finish before its accompanying pan. Wait for both.
      isMapTransitioning.current = transitions.zoom || transitions.move;
      if (!isMapTransitioning.current) syncMarker();
    };
    map.on('zoomstart movestart', onStart);
    map.on('zoomend moveend', onEnd);
    return () => {
      map.off('zoomstart movestart', onStart);
      map.off('zoomend moveend', onEnd);
      transitionsRef.current = { zoom: false, move: false };
      isMapTransitioning.current = false;
    };
  }, [map, syncMarker]);

  // Initialize line and total distance when route loads
  useEffect(() => {
    routeInitializedRef.current = false;
    lineRef.current = null;
    totalDistRef.current = 0;
    if (routeGeometry && routeGeometry.length > 1) {
      lineRef.current = turf.lineString(routeGeometry);
      totalDistRef.current = turf.length(lineRef.current, { units: 'meters' });
    }
  }, [routeGeometry]);

  // Calculate target distance using turf whenever route_index updates
  useEffect(() => {
    if (!lineRef.current || truck.route_index == null || !Number.isFinite(Number(truck.route_index)) || !routeGeometry) return;
    
    const idx = Math.min(Math.max(0, truck.route_index), routeGeometry.length - 1);
    let dist = 0;
    if (idx > 0) {
      for (let i = 0; i < idx; i++) {
        dist += turf.distance(turf.point(routeGeometry[i]), turf.point(routeGeometry[i+1]), { units: 'meters' });
      }
    }
    // Adiciona a distância do último nó até a posição física atual (evita travamento do marcador)
    if (idx < routeGeometry.length - 1 && truck.lat && truck.lng) {
      const nodePos = routeGeometry[idx];
      const truckPos = [parseFloat(truck.lng), parseFloat(truck.lat)];
      dist += turf.distance(turf.point(nodePos), turf.point(truckPos), { units: 'meters' });
    }

    if (!routeInitializedRef.current || Math.abs(dist - currentDistanceRef.current) > 50000) {
      // Start at the current route position, or reset when a new trip starts.
      currentDistanceRef.current = dist;
      routeInitializedRef.current = true;
    }
    targetDistanceRef.current = dist;
  }, [truck.route_index, truck.lat, truck.lng, routeGeometry]);

  // Animation Loop
  useEffect(() => {
    if (!markerRef.current || !lineRef.current) return;
    
    let lastTime = performance.now();

    const animate = (time) => {
      const dt = time - lastTime;
      lastTime = time;

      if (!routeInitializedRef.current || latestRef.current.isFueling) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const current = currentDistanceRef.current;
      const target = targetDistanceRef.current;
      
      if (Math.abs(target - current) > 0.1) {
        // Move at constant speed to reach target in ~2.8s
        const step = (target - current) * (dt / 3400);
        let next = current + step;
        
        // Prevent overshooting
        if ((target > current && next > target) || (target < current && next < target)) {
          next = target;
        }

        currentDistanceRef.current = next;

        // Keep route progress in sync with other views while Leaflet handles zoom.
        // syncMarker defers all pixel/position writes until the transition ends.
        syncMarker();
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [routeGeometry, truck.id, syncMarker]); // Re-run if route changes

  // All imperative updates share the same transition guard, including telemetry
  // and icon changes arriving during a zoom or pan.
  useEffect(() => {
    syncMarker();
  }, [isFueling, truck.lat, truck.lng, truck.route_index, routeGeometry, icon, syncMarker]);

  return (
    <Marker
      ref={markerRef}
      // Stable props prevent React Leaflet from bypassing the transition guard.
      position={initialPosition.current}
      icon={initialIcon.current}
      eventHandlers={onClick ? { click: onClick } : undefined}
    >
      {children}
    </Marker>
  );
}


export default React.memo(LiveTruckMarker, (prevProps, nextProps) => {
  // Somente re-renderiza se o estado relevante do caminhão mudar
  return (
    prevProps.truck.id === nextProps.truck.id &&
    prevProps.truck.lat === nextProps.truck.lat &&
    prevProps.truck.lng === nextProps.truck.lng &&
    prevProps.truck.route_index === nextProps.truck.route_index &&
    prevProps.truck.sim_state === nextProps.truck.sim_state &&
    prevProps.truck.route_phase === nextProps.truck.route_phase &&
    prevProps.iconHtml === nextProps.iconHtml &&
    prevProps.isFueling === nextProps.isFueling
  );
});
