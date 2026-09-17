const fs = require("fs");
let content = fs.readFileSync("src/pages/FuelingPage.jsx", "utf8");

content = content.replace("const [truckId, setTruckId] = useState('');", "const [truckId, setTruckId] = useState('');\n  useEffect(() => {\n    const awaiting = trucks.find(t => t.route_phase === 'awaiting_fueling_authorization');\n    if (awaiting && !truckId) setTruckId(String(awaiting.id));\n  }, [trucks, truckId]);");

fs.writeFileSync("src/pages/FuelingPage.jsx", content);
console.log("FuelingPage patched to auto-select!");
