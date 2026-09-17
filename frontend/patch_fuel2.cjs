const fs = require("fs");
let content = fs.readFileSync("src/pages/FuelingPage.jsx", "utf8");

content = content.replace(
  "<td style={{ padding: '16px', color: '#8BA3BC', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>{log.lat}, {log.lng}</td>",
  "<td style={{ padding: '16px', color: '#8BA3BC', fontSize: '13px', fontFamily: 'var(--font-mono)' }}><a href={`https://www.google.com/maps/search/?api=1&query=${log.lat},${log.lng}`} target=\"_blank\" rel=\"noopener noreferrer\" style={{ color: 'var(--teal)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {Number(log.lat).toFixed(4)}, {Number(log.lng).toFixed(4)}</a></td>"
);

content = content.replace("import { CheckCircle, Clock, ShieldCheck, Search, Filter } from 'lucide-react';", "import { CheckCircle, Clock, ShieldCheck, Search, Filter, MapPin } from 'lucide-react';");

fs.writeFileSync("src/pages/FuelingPage.jsx", content);
console.log("FuelingPage coordinates linked!");
