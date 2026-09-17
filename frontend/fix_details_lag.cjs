const fs = require("fs");
let content = fs.readFileSync("src/pages/TruckDetailsPage.jsx", "utf8");

const oldLogic = `  const routePoints = [];
  let currentPos = null;
  
  const routeGeometry = truckRoutes[truck.id] ?? truck.route_geometry;
  if (routeGeometry) {
    try {
      const geo = typeof routeGeometry === 'string' ? JSON.parse(routeGeometry) : routeGeometry;
      if (Array.isArray(geo)) {
        // geometry vem no formato [lng, lat], o leaflet precisa de [lat, lng]
        geo.forEach(p => {
          if (Array.isArray(p) && p.length >= 2) routePoints.push([p[1], p[0]]);
        });
      }
    } catch (e) {
      console.error('Failed to parse route_geometry', e);
    }
  }

  if (routePoints.length > 0) {
    currentPos = [parseFloat(truck.lat), parseFloat(truck.lng)];
  }

  // Fallback map if geometry fails
  if (!currentPos && !isNaN(truck.lat) && !isNaN(truck.lng)) {
    currentPos = [parseFloat(truck.lat), parseFloat(truck.lng)];
    if (routePoints.length === 0) routePoints.push(currentPos);
  }`;

const newLogic = `  const routeGeometryRaw = truckRoutes[truck.id] ?? truck.route_geometry;
  const routePoints = React.useMemo(() => {
    const points = [];
    if (routeGeometryRaw) {
      try {
        const geo = typeof routeGeometryRaw === 'string' ? JSON.parse(routeGeometryRaw) : routeGeometryRaw;
        if (Array.isArray(geo)) {
          geo.forEach(p => {
            if (Array.isArray(p) && p.length >= 2) points.push([p[1], p[0]]);
          });
        }
      } catch (e) {
        console.error('Failed to parse route_geometry', e);
      }
    }
    
    if (points.length === 0 && !isNaN(truck.lat) && !isNaN(truck.lng)) {
      points.push([parseFloat(truck.lat), parseFloat(truck.lng)]);
    }
    return points;
  }, [routeGeometryRaw, truck.lat, truck.lng]);`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync("src/pages/TruckDetailsPage.jsx", content);
console.log("TruckDetailsPage routePoints memoized!");
