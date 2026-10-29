import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { AlertTriangle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { getMapboxToken } from '../utils/mapboxToken';

function BoundsWatcher({ onBoundsChange }) {
  const map = useMap();

  const notifyBounds = () => {
    if (!map || typeof map.getBounds !== 'function') return;
    const b = map.getBounds();
    if (!b) return;
    onBoundsChange({
      minLat: b.getSouth(),
      minLng: b.getWest(),
      maxLat: b.getNorth(),
      maxLng: b.getEast(),
    });
  };

  useEffect(() => {
    notifyBounds();
  }, []);

  useMapEvents({
    moveend: () => notifyBounds(),
    zoomend: () => notifyBounds(),
  });

  return null;
}

const EMPTY_STATIONS = [];

export default function AnpStationsMap({
  stations = EMPTY_STATIONS,
  truncated = false,
  loading = false,
  onBoundsChange,
  onSelectStation,
}) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(15,22,36,0.9)',
      }}
    >
      {truncated && (
        <div
          role="alert"
          data-testid="anp-map-truncated-warning"
          style={{
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(245, 158, 11, 0.95)',
            color: '#0f172a',
            padding: '8px 16px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <AlertTriangle size={15} />
          <span>Exibindo os primeiros 500 postos da área. Aproxime o zoom para refinar a região.</span>
        </div>
      )}

      {loading && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            zIndex: 1000,
            background: 'rgba(15,22,36,0.85)',
            color: '#94a3b8',
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '11px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          Atualizando área visível...
        </div>
      )}

      <div style={{ height: '320px', width: '100%' }}>
        <MapContainer
          center={[-15.793889, -47.882778]}
          zoom={11}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${getMapboxToken()}`}
          />
          {onBoundsChange && <BoundsWatcher onBoundsChange={onBoundsChange} />}
          {stations.map(st => {
            if (st.lat === null || st.lng === null || st.lat === undefined || st.lng === undefined) {
              return null;
            }
            const isInterditado = Boolean(st.interdicted);
            const color = isInterditado ? '#f87171' : '#2FBEB5';
            return (
              <CircleMarker
                key={st.cnpj}
                center={[Number(st.lat), Number(st.lng)]}
                radius={6}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.85,
                  weight: 1.5,
                }}
                eventHandlers={{
                  click: () => onSelectStation && onSelectStation(st),
                }}
              >
                <Popup>
                  <div style={{ fontSize: '12px', lineHeight: 1.4 }}>
                    <strong>{st.razao_social}</strong>
                    <div>CNPJ: {st.cnpj}</div>
                    <div>Bandeira: {st.bandeira || '—'}</div>
                    <div>{st.municipio} - {st.uf}</div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
