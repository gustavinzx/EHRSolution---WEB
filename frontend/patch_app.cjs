const fs = require("fs");
let content = fs.readFileSync("src/App.jsx", "utf8");

content = content.replace(
  "import TopBar from './components/TopBar';",
  "import TopBar from './components/TopBar';\nimport FuelUnlockModal from './components/FuelUnlockModal';"
);

content = content.replace(
  "<div className=\"app-shell\">",
  "<div className=\"app-shell\">\n      <FuelUnlockModal />"
);

fs.writeFileSync("src/App.jsx", content);
console.log("App.jsx patched to include FuelUnlockModal");
