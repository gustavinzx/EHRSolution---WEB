import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Popup, useMap, Polyline } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import LiveTruckMarker, { getTruckIcon } from './LiveTruckMarker';
import StationMarker from './StationMarker';
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
  security_alert: '#fb7185',
  arrived: '#60a5fa',
};

// ─── Auto-Fit Camera Bounds around trucks ────────────────────────────────────
function AutoFitBounds({ trucks }) {
  const map = useMap();
  const hasFitted = useRef(false);
  const { selectedTruckId } = useFleetState();

  useEffect(() => {
    if (selectedTruckId && trucks.length > 0) {
      const truck = trucks.find(t => t.id === selectedTruckId);
      if (truck && truck.lat && truck.lng) {
        map.flyTo([truck.lat, truck.lng], 13, { duration: 1.5 });
      }
    } else if (trucks.length > 0 && !hasFitted.current) {
      const validTrucks = trucks.filter(t => t.lat && t.lng);
      if (validTrucks.length > 0) {
        const bounds = L.latLngBounds(validTrucks.map(t => [t.lat, t.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
        hasFitted.current = true;
      }
    }
  }, [trucks, selectedTruckId, map]);

  return null;
}


const MemoizedTruckRoute = React.memo(({ truck, tempRouteRaw, plannedRouteRaw, isSelected }) => {
  let tempRoute = tempRouteRaw;
  if (typeof tempRoute === 'string') {
    try { tempRoute = JSON.parse(tempRoute); } catch(e) {}
  }
  
  let plannedRoute = plannedRouteRaw;
  if (typeof plannedRoute === 'string') {
    try { plannedRoute = JSON.parse(plannedRoute); } catch(e) {}
  }

  const hasTempRoute = truck.route_phase === 'to_station' || truck.route_phase === 'evaluating_station' || truck.route_phase === 'returning_to_route';

  const renderPolyline = (routePoints, isTemp) => {
    if (!Array.isArray(routePoints) || routePoints.length < 2) return null;
    const latLngs = routePoints.map(coord => (Array.isArray(coord) && coord.length >= 2) ? [coord[1], coord[0]] : null).filter(Boolean);
    
    let color = isSelected ? '#F2A93B' : 'rgba(47, 190, 181, 0.4)';
    if (isTemp) color = isSelected ? '#ef4444' : '#f97316'; // Red/Orange for detour

    return (
      <Polyline 
        key={`route-${truck.id}-${isTemp ? 'temp' : 'planned'}`} 
        positions={latLngs} 
        pathOptions={{ 
          color, 
          weight: isSelected ? 6 : (isTemp ? 4 : 3), 
          opacity: isSelected ? 1 : 0.6,
          dashArray: isTemp ? '5, 10' : undefined
        }} 
      />
    );
  };

  return (
    <React.Fragment>
      {hasTempRoute && renderPolyline(plannedRoute, false)}
      {renderPolyline(tempRoute, hasTempRoute)}
      {hasTempRoute && truck.station_lat && truck.station_lng && (
        <StationMarker 
          station_lat={parseFloat(truck.station_lat)}
          station_lng={parseFloat(truck.station_lng)}
          station_name={truck.station_name || 'Posto'}
        />
      )}
    </React.Fragment>
  );
}, (prev, next) => {
  return prev.truck.id === next.truck.id && 
         prev.truck.route_phase === next.truck.route_phase &&
         prev.truck.station_lat === next.truck.station_lat &&
         prev.isSelected === next.isSelected &&
         prev.tempRouteRaw === next.tempRouteRaw &&
         prev.plannedRouteRaw === next.plannedRouteRaw;
});

export default function MapView({ trucks = [], onOpen3D }) {
  const navigate = useNavigate();
  const { truckRoutes, selectedTruckId, setSelectedTruckId } = useFleetState();
  
  const getLevelPct = (t) =>
    t.capacity_liters > 0 ? Math.round((t.current_level_liters / t.capacity_liters) * 100) : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative" style={{ height: '100%' }}>
      <MapContainer 
        center={[-15.7801, -47.9292]} // default center (Brasilia)
        zoom={4} 
        style={{ height: '100%', width: '100%', background: '#1a1a1a' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
          url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`}
          className="map-tiles"
          noWrap={false}
        />
        <AutoFitBounds trucks={trucks} />

        {/* Draw Polylines for each truck route */}
        {Array.isArray(trucks) && trucks.map(truck => {
          let tempRoute = truckRoutes[truck.id];
          if (typeof tempRoute === 'string') {
            try { tempRoute = JSON.parse(tempRoute); } catch(e) {}
          }
          
          let plannedRoute = truck.planned_route_geometry;
          if (typeof plannedRoute === 'string') {
            try { plannedRoute = JSON.parse(plannedRoute); } catch(e) {}
          }

          const hasTempRoute = truck.route_phase === 'to_station' || truck.route_phase === 'evaluating_station' || truck.route_phase === 'returning_to_route';
          const isSelected = selectedTruckId === truck.id;

          const renderPolyline = (routePoints, isTemp) => {
            if (!Array.isArray(routePoints) || routePoints.length < 2) return null;
            const latLngs = routePoints.map(coord => (Array.isArray(coord) && coord.length >= 2) ? [coord[1], coord[0]] : null).filter(Boolean);
            
            let color = isSelected ? '#F2A93B' : 'rgba(47, 190, 181, 0.4)';
            if (isTemp) color = isSelected ? '#ef4444' : '#f97316'; // Red/Orange for detour

            return (
              <Polyline 
                key={`route-${truck.id}-${isTemp ? 'temp' : 'planned'}`} 
                positions={latLngs} 
                pathOptions={{ 
                  color, 
                  weight: isSelected ? 6 : (isTemp ? 4 : 3), 
                  opacity: isSelected ? 1 : 0.6,
                  dashArray: isTemp ? '5, 10' : undefined
                }} 
              />
            );
          };

          return (
            <React.Fragment key={`routes-${truck.id}`}>
              {/* If on a detour, render the planned route under it */}
              {hasTempRoute && renderPolyline(plannedRoute, false)}
              
              {/* Render the active route (which is temp if on detour, else planned) */}
              {renderPolyline(tempRoute, hasTempRoute)}

              {/* Station marker if on a detour to a station */}
              {hasTempRoute && truck.station_lat && truck.station_lng && (
                <StationMarker 
                  station_lat={parseFloat(truck.station_lat)}
                  station_lng={parseFloat(truck.station_lng)}
                  station_name={truck.station_name || 'Posto'}
                />
              )}
            </React.Fragment>
          );
        })}

        {Array.isArray(trucks) && trucks.map(truck => {
          const lat = parseFloat(truck.lat);
          const lng = parseFloat(truck.lng);
          if (!lat || !lng) return null;
          const color = STATUS_COLORS[truck.sim_state] || STATUS_COLORS[truck.status] || '#34d399';
          const pct = getLevelPct(truck);
          const isFueling = truck.route_phase === 'fueling' || truck.route_phase === 'awaiting_fueling_authorization';

          return (
            <LiveTruckMarker
              key={truck.id}
              truck={truck}
              iconHtml={getTruckIcon(truck, color)}
              isFueling={isFueling}
              onClick={() => setSelectedTruckId(truck.id)}
            >
              <Popup minWidth={210} className="custom-popup">
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: '1.7', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="font-semibold text-white">🚛 {truck.plate} — {truck.model}</div>
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Velocidade:</span>
                      <span className="font-mono text-white">{parseFloat(truck.speed_kmh).toFixed(0)} km/h</span>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Combustível:</span>
                      <span className={`font-mono font-bold ${pct < 25 ? 'text-red-500' : 'text-emerald-500'}`}>{pct}% · {parseFloat(truck.current_level_liters).toFixed(0)}L</span>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Status:</span>
                      <span className="font-mono uppercase text-white">{truck.status}</span>
                    </div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-slate-400">Fase da Rota:</span>
                      <span className="font-mono text-slate-300">{truck.route_phase || truck.sim_state}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate(`/fleet/${truck.id}`)}
                    className="w-full mt-2 bg-slate-900 text-white text-xs py-1.5 rounded hover:bg-slate-800 transition-colors border border-slate-700 font-semibold"
                  >
                    Ver Detalhes
                  </button>
                  {onOpen3D && (
                    <button
                      onClick={() => { setSelectedTruckId(truck.id); onOpen3D(truck); }}
                      className="w-full bg-teal-500 text-slate-950 text-xs py-1.5 rounded hover:bg-teal-400 transition-colors font-semibold"
                    >
                      Ver no 3D
                    </button>
                  )}
                </div>
              </Popup>
            </LiveTruckMarker>
          );
        })}
      </MapContainer>
      <div className="absolute top-4 right-4 z-[400] flex gap-2">
        <div className="bg-slate-900/90 text-white px-3 py-1.5 rounded text-xs font-medium backdrop-blur shadow-sm border border-slate-700">
          Frota Ativa: {trucks.length}
        </div>
      </div>
    </div>
  );
}
