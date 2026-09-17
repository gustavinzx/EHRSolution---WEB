const fs = require("fs");
let content = fs.readFileSync("src/pages/DashboardPage.jsx", "utf8");

content = content.replace(
  "<span style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }}>{v.value}%</span>",
  "<span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>{v.value}%</span>"
);

content = content.replace(
  "<span style={{ fontSize: '8px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%', textOverflow: 'ellipsis', textAlign: 'center' }}>{v.label}</span>",
  "<span style={{ fontSize: '9px', color: '#8BA3BC', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%', textOverflow: 'ellipsis', textAlign: 'center', fontWeight: 500 }}>{v.label}</span>"
);

fs.writeFileSync("src/pages/DashboardPage.jsx", content);
console.log("DashboardPage MiniBarChart text brightened!");
