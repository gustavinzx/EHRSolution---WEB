import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const createStationIcon = (brand) => {
  let color = '#3b82f6'; // default blue
  const lowerBrand = brand?.toLowerCase() || '';
  if (lowerBrand.includes('shell')) color = '#eab308'; // yellow
  else if (lowerBrand.includes('br') || lowerBrand.includes('petrobras')) color = '#22c55e'; // green
  else if (lowerBrand.includes('ipiranga')) color = '#f97316'; // orange

  return L.divIcon({
    className: 'custom-station-icon',
    html: `
      <div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="12px" height="12px">
          <path d="M19 12v-2h-3v-2h3v-2h-5v8h5zm1-10c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2h-18c-1.1 0-2-.9-2-2v-10c0-1.1.9-2 2-2h18zm-2 12v-10h-14v10h14z"/>
        </svg>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
};

export default function StationMarker({ station_lat, station_lng, station_name }) {
  if (!station_lat || !station_lng) return null;

  return (
    <Marker 
      position={[station_lat, station_lng]} 
      icon={createStationIcon(station_name)}
    >
      <Popup>
        <div className="text-sm font-semibold">Posto Selecionado</div>
        <div className="text-xs text-gray-600">{station_name}</div>
      </Popup>
    </Marker>
  );
}
