const fs = require("fs");
let content = fs.readFileSync("src/components/MapView.jsx", "utf8");

const memoComponent = `
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
        key={\`route-\${truck.id}-\${isTemp ? 'temp' : 'planned'}\`} 
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
`;

// Insert the component before MapView
content = content.replace("export default function MapView({ trucks = [], onOpen3D }) {", memoComponent + "\nexport default function MapView({ trucks = [], onOpen3D }) {");

const oldRender = `{Array.isArray(trucks) && trucks.map(truck => {
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
                  key={\`route-\${truck.id}-\${isTemp ? 'temp' : 'planned'}\`} 
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
              <React.Fragment key={\`routes-\${truck.id}\`}>
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
          })}`;

const newRender = `{Array.isArray(trucks) && trucks.map(truck => (
            <MemoizedTruckRoute 
              key={\`routes-\${truck.id}\`} 
              truck={truck} 
              tempRouteRaw={truckRoutes[truck.id]} 
              plannedRouteRaw={truck.planned_route_geometry} 
              isSelected={selectedTruckId === truck.id} 
            />
          ))}`;

content = content.replace(oldRender, newRender);
fs.writeFileSync("src/components/MapView.jsx", content);
console.log("MapView polylines memoized!");
