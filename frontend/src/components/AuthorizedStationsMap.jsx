import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, CheckCircle2, XCircle, Navigation } from 'lucide-react';
import { getMapboxToken } from '../utils/mapboxToken';

function createCustomPin(isAuthorized) {
  const color = isAuthorized ? '#10B981' : '#EF4444';
  const glow = isAuthorized ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';

  return L.divIcon({
    className: 'custom-station-pin',
    html: `
      <div style="
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: ${color};
        border: 2.5px solid #FFFFFF;
        box-shadow: 0 0 14px ${glow}, 0 3px 8px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s ease;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16px" height="16px">
          <path d="M19 12v-2h-3v-2h3v-2h-5v8h5zm1-10c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2h-18c-1.1 0-2-.9-2-2v-10c0-1.1.9-2 2-2h18zm-2 12v-10h-14v10h14z"/>
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function MapController({ stations, selectedStationId }) {
  const map = useMap();
  const lastSelected = useRef(null);
  const hasFitted = useRef(false);

  useEffect(() => {
    if (selectedStationId && selectedStationId !== lastSelected.current) {
      const station = stations.find(s => s.id === selectedStationId);
      if (station && station.lat && station.lng) {
        lastSelected.current = selectedStationId;
        map.flyTo([parseFloat(station.lat), parseFloat(station.lng)], 14, { duration: 1.2 });
      }
    } else if (!hasFitted.current && stations.length > 0) {
      const valid = stations.filter(s => s.lat && s.lng);
      if (valid.length > 0) {
        const bounds = L.latLngBounds(valid.map(s => [parseFloat(s.lat), parseFloat(s.lng)]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
        hasFitted.current = true;
      }
    }
  }, [stations, selectedStationId, map]);

  return null;
}

const EMPTY_STATIONS = [];

export default function AuthorizedStationsMap({
  stations = EMPTY_STATIONS,
  selectedStationId = null,
  onSelectStation,
  onToggleStation,
}) {
  const validStations = stations.filter(s => s.lat && s.lng);
  const defaultCenter = validStations.length > 0
    ? [parseFloat(validStations[0].lat), parseFloat(validStations[0].lng)]
    : [-15.793889, -47.882778];

  const mapboxToken = getMapboxToken();
  if (!mapboxToken) {
    return (
      <div
        data-testid="mapbox-token-missing"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: '480px',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: '#0B1420',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div>
          <p style={{ fontWeight: 600, fontSize: '14px', color: '#f87171', marginBottom: '4px' }}>
            Token do Mapbox não configurado
          </p>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>
            Defina a variável VITE_MAPBOX_TOKEN para visualizar o mapa de postos autorizados.
          </p>
        </div>
      </div>
    );
  }
  const tileUrl = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxToken}`;



  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '480px',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: '#0B1420',
      }}
    >
      <MapContainer
        center={defaultCenter}
        zoom={10}
        style={{ height: '100%', width: '100%', background: '#0B1420' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url={tileUrl}
        />
        <MapController stations={stations} selectedStationId={selectedStationId} />

        {validStations.map(station => {
          const lat = parseFloat(station.lat);
          const lng = parseFloat(station.lng);
          if (isNaN(lat) || isNaN(lng)) return null;

          return (
            <Marker
              key={station.id}
              position={[lat, lng]}
              icon={createCustomPin(station.is_authorized)}
              eventHandlers={{
                click: () => onSelectStation && onSelectStation(station.id),
              }}
            >
              <Popup minWidth={240} className="custom-popup">
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#1E293B', padding: '4px' }}>
                  <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>
                    {station.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
                    {station.address || 'Endereço não informado'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569', marginBottom: '10px' }}>
                    <Navigation size={12} color="#00C4D0" />
                    GPS: {lat.toFixed(4)}, {lng.toFixed(4)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: station.is_authorized ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: station.is_authorized ? '#10B981' : '#EF4444',
                        textTransform: 'uppercase',
                      }}
                    >
                      {station.is_authorized ? 'Autorizado' : 'Bloqueado'}
                    </span>
                    {onToggleStation && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStation(station.id);
                        }}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          background: station.is_authorized ? '#EF4444' : '#10B981',
                          color: '#FFFFFF',
                        }}
                      >
                        {station.is_authorized ? 'Bloquear' : 'Autorizar'}
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Status Pill */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 400,
          background: 'rgba(7, 16, 27, 0.9)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '6px 14px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 700,
          color: '#00C4D0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        }}
      >
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
        {validStations.length} postos mapeados
      </div>
    </div>
  );
}
