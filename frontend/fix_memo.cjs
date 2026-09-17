const fs = require("fs");
let content = fs.readFileSync("src/components/LiveTruckMarker.jsx", "utf8");

// Trocar de "export default function" para "function"
content = content.replace("export default function LiveTruckMarker({", "function LiveTruckMarker({");

// Adicionar a exportação com React.memo no final do arquivo
content += `\n
export default React.memo(LiveTruckMarker, (prevProps, nextProps) => {
  // Somente re-renderiza se o estado relevante do caminhão mudar
  return (
    prevProps.truck.id === nextProps.truck.id &&
    prevProps.truck.lat === nextProps.truck.lat &&
    prevProps.truck.lng === nextProps.truck.lng &&
    prevProps.truck.route_index === nextProps.truck.route_index &&
    prevProps.truck.sim_state === nextProps.truck.sim_state &&
    prevProps.truck.route_phase === nextProps.truck.route_phase &&
    prevProps.iconHtml === nextProps.iconHtml &&
    prevProps.isFueling === nextProps.isFueling
  );
});
`;

fs.writeFileSync("src/components/LiveTruckMarker.jsx", content);
console.log("Memoization added to LiveTruckMarker!");
