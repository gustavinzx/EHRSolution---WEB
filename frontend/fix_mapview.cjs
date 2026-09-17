const fs = require("fs");
let content = fs.readFileSync("src/components/MapView.jsx", "utf8");

const oldCode = `  function AutoFitBounds({ trucks }) {
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
  }`;

const newCode = `  function AutoFitBounds({ trucks }) {
    const map = useMap();
    const hasFitted = useRef(false);
    const prevSelectedRef = useRef(null);
    const { selectedTruckId } = useFleetState();
  
    useEffect(() => {
      // 1. Initial fit when trucks first load
      if (trucks.length > 0 && !hasFitted.current && !selectedTruckId) {
        const validTrucks = trucks.filter(t => t.lat && t.lng);
        if (validTrucks.length > 0) {
          const bounds = L.latLngBounds(validTrucks.map(t => [t.lat, t.lng]));
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
          hasFitted.current = true;
        }
      }
      
      // 2. Only fly to truck when the selection CHANGES, not every 3s
      if (selectedTruckId && prevSelectedRef.current !== selectedTruckId && trucks.length > 0) {
        const truck = trucks.find(t => t.id === selectedTruckId);
        if (truck && truck.lat && truck.lng) {
          map.flyTo([truck.lat, truck.lng], 13, { duration: 1.5 });
          prevSelectedRef.current = selectedTruckId;
        }
      } else if (!selectedTruckId) {
        prevSelectedRef.current = null;
      }
    }, [trucks, selectedTruckId, map]);
  
    return null;
  }`;

content = content.replace(oldCode, newCode);
fs.writeFileSync("src/components/MapView.jsx", content);
console.log("MapView AutoFitBounds patched!");
