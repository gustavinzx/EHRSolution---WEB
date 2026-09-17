import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import * as turf from '@turf/turf';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import useFleetState from '../store/useFleetState';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const STATUS_COLORS = {
  ok:        '#34d399',
  low_fuel:  '#fbbf24',
  no_signal: '#f87171',
  fueling:   '#f87171',
};

// ─── Auto-Fit Camera Bounds around trucks ────────────────────────────────────
function AutoFitBounds({ trucks }) {
  const map = useMap();
  const hasFitted = useRef(false);
  const { selectedTruckId } = useFleetState();

  useEffect(() => {
    if (trucks.length > 0 && !hasFitted.current && !selectedTruckId) {
      const validCoords = trucks
        .map(t => [parseFloat(t.lat), parseFloat(t.lng)])
        .filter(([lat, lng]) => lat && lng && !isNaN(lat) && !isNaN(lng));

      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 9 });
        hasFitted.current = true;
      }
    }
  }, [trucks, map, selectedTruckId]);

  useEffect(() => {
    if (selectedTruckId) {
      const t = trucks.find(tr => tr.id === selectedTruckId);
      if (t && t.lat && t.lng) {
        map.flyTo([parseFloat(t.lat), parseFloat(t.lng)], 13, { duration: 1.5 });
      }
    } else {
      // Re-fit bounds when deselected
      const validCoords = trucks
        .map(t => [parseFloat(t.lat), parseFloat(t.lng)])
        .filter(([lat, lng]) => lat && lng && !isNaN(lat) && !isNaN(lng));
      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 9 });
      }
    }
  }, [selectedTruckId, trucks, map]);

  return null;
}

function getTruckIcon(truck, color) {
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
    // Ícone de bomba de combustível, pulsando
    return `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;">
        ${driverTag}
        <div style="
          width:34px;height:34px;
          background:${color};
          border-radius:50%;
          border:2px solid #fff;
          box-shadow:0 0 0 4px ${color}55;
          display:flex;align-items:center;justify-content:center;
          color:#0a101a;
          animation: pulse-ring 1.2s ease-out infinite;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 22V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15"/>
            <path d="M3 11h12"/>
            <path d="M12 7h4l3 3v5h-7"/>
            <circle cx="17.5" cy="18.5" r="1.5"/>
          </svg>
        </div>
      </div>`;
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



function AnimatedTruckMarker({ truck, iconHtml, isFueling, children }) {
  const markerRef = useRef(null);
  const { truckRoutes } = useFleetState();
  const routeGeometry = truckRoutes[truck.id];
  
  const currentDistanceRef = useRef(0);
  const targetDistanceRef = useRef(0);
  const animationRef = useRef(null);
  const totalDistRef = useRef(0);
  const lineRef = useRef(null);

  // Initialize line and total distance when route loads
  useEffect(() => {
    if (routeGeometry && routeGeometry.length > 1) {
      lineRef.current = turf.lineString(routeGeometry);
      totalDistRef.current = turf.length(lineRef.current, { units: 'meters' });
    }
  }, [routeGeometry]);

  // Calculate target distance using turf whenever route_index updates
  useEffect(() => {
    if (!lineRef.current || truck.route_index === undefined || !routeGeometry) return;
    
    const idx = Math.min(truck.route_index, routeGeometry.length - 1);
    let dist = 0;
    if (idx > 0) {
      const sliced = turf.lineSlice(
        turf.point(routeGeometry[0]), 
        turf.point(routeGeometry[idx]), 
        lineRef.current
      );
      dist = turf.length(sliced, { units: 'meters' });
    }

    if (dist < currentDistanceRef.current && (currentDistanceRef.current - dist) > 500) {
      // Loop reset
      currentDistanceRef.current = dist;
    }
    targetDistanceRef.current = dist;
  }, [truck.route_index, routeGeometry]);

  // Animation Loop
  useEffect(() => {
    if (!markerRef.current || !lineRef.current) return;
    
    let lastTime = performance.now();

    const animate = (time) => {
      const dt = time - lastTime;
      lastTime = time;

      const current = currentDistanceRef.current;
      const target = targetDistanceRef.current;
      
      if (Math.abs(target - current) > 0.1) {
        // Move at constant speed to reach target in ~2.8s
        const step = (target - current) * (dt / 2500); 
        let next = current + step;
        
        // Prevent overshooting
        if ((target > current && next > target) || (target < current && next < target)) {
          next = target;
        }

        currentDistanceRef.current = next;

        const point = turf.along(lineRef.current, next, { units: 'meters' });
        const [lng, lat] = point.geometry.coordinates;
        
        markerRef.current.setLatLng([lat, lng]);
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [routeGeometry, truck.id]); // Re-run if route changes

  // Snap position if fueling or no route
  useEffect(() => {
    if ((isFueling || !routeGeometry) && markerRef.current) {
      markerRef.current.setLatLng([parseFloat(truck.lat), parseFloat(truck.lng)]);
    }
  }, [isFueling, truck.lat, truck.lng, routeGeometry]);

  return (
    <Marker
      ref={markerRef}
      position={[parseFloat(truck.lat), parseFloat(truck.lng)]}
      icon={L.divIcon({
        html: iconHtml,
        className: 'route-truck',
        iconSize: isFueling ? [34, 34] : [28, 28],
        iconAnchor: isFueling ? [17, 17] : [14, 14],
      })}
    >
      {children}
    </Marker>
  );
}

export default function MapView({ trucks = [] }) {
  const navigate = useNavigate();
  const { truckRoutes, selectedTruckId } = useFleetState();
  
  const getLevelPct = (t) =>
    t.capacity_liters > 0 ? Math.round((t.current_level_liters / t.capacity_liters) * 100) : 0;

  const getDrivers = (t) =>
    t.current_drivers?.length > 0 ? t.current_drivers.map(d => d.name).join(', ') : 'Sem motorista';

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
      <MapContainer 
        center={[-22.9, -45.5]} 
        zoom={7} 
        minZoom={5}
        maxBounds={[[-38, -75], [5, -30]]}
        style={{ height: '100%', width: '100%' }}
      >
        <AutoFitBounds trucks={trucks} />
        <TileLayer
          attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
          url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`}
          className="map-tiles"
          noWrap={true}
        />
        {/* Draw Polylines for each truck route */}
        {Array.isArray(trucks) && trucks.map(truck => {
          let route = truckRoutes[truck.id];
          if (typeof route === 'string') {
            try { route = JSON.parse(route); } catch(e) {}
          }
          if (!Array.isArray(route) || route.length < 2) return null;
          // routeGeometry is [lng, lat], Leaflet expects [lat, lng]
          const latLngs = route.map(coord => (Array.isArray(coord) && coord.length >= 2) ? [coord[1], coord[0]] : null).filter(Boolean);
          const isSelected = selectedTruckId === truck.id;
          return (
            <Polyline 
              key={`route-${truck.id}`} 
              positions={latLngs} 
              pathOptions={{ 
                color: isSelected ? '#F2A93B' : 'rgba(47, 190, 181, 0.4)', 
                weight: isSelected ? 6 : 3, 
                opacity: isSelected ? 1 : 0.6 
              }} 
            />
          );
        })}

        {Array.isArray(trucks) && trucks.map(truck => {
          const lat = parseFloat(truck.lat);
          const lng = parseFloat(truck.lng);
          if (!lat || !lng) return null;
          const color = STATUS_COLORS[truck.sim_state] || STATUS_COLORS[truck.status] || '#34d399';
          const pct = getLevelPct(truck);
          const isFueling = truck.sim_state === 'fueling';

          return (
            <AnimatedTruckMarker 
              key={truck.id}
              truck={truck}
              iconHtml={getTruckIcon(truck, color)}
              isFueling={isFueling}
            >
              <Popup minWidth={210}>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: '1.7', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff' }}>
                    🚛 {truck.plate} — {truck.model}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div><span style={{ color: '#64748b' }}>Motorista: </span><strong>{getDrivers(truck)}</strong></div>
                    <div>
                      <span style={{ color: '#64748b' }}>Combustível: </span>
                      <strong style={{ color: pct < 20 ? '#f87171' : pct < 50 ? '#fbbf24' : '#34d399' }}>
                        {pct}% · {truck.current_level_liters}L
                      </strong>
                    </div>
                    <div><span style={{ color: '#64748b' }}>Velocidade: </span><strong>{truck.speed_kmh} km/h</strong></div>
                  </div>
                  
                  <button 
                    onClick={() => navigate(`/fleet/${truck.id}`)}
                    style={{
                      marginTop: '4px',
                      background: 'var(--teal)',
                      border: 'none',
                      color: '#0a101a',
                      fontWeight: 700,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      width: '100%',
                      transition: '0.2s',
                      boxShadow: '0 0 10px rgba(47, 190, 181, 0.3)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    📍 Acompanhar Rota
                  </button>
                </div>
              </Popup>
            </AnimatedTruckMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
