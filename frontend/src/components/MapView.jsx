import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Popup, useMap, Polyline } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import LiveTruckMarker, { getTruckIcon } from './LiveTruckMarker';
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
            <LiveTruckMarker
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
            </LiveTruckMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
