const fs = require("fs");
let content = fs.readFileSync("src/pages/DashboardPage.jsx", "utf8");

const oldAlertRow = `<Fuel size={15} color="#f87171" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>{a.plate}</div>
                          <div style={{ fontSize: '11px', color: '#f87171' }}>{a.message}</div>
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {new Date(a.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>`;

const newAlertRow = `{a.type === 'destination_arrived' ? <CheckCircle size={15} color="#34d399" style={{ flexShrink: 0 }} /> : <Fuel size={15} color="#f87171" style={{ flexShrink: 0 }} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>{a.plate}</div>
                          <div style={{ fontSize: '11px', color: a.type === 'destination_arrived' ? '#34d399' : '#f87171' }}>{a.message}</div>
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {new Date(a.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>`;

content = content.replace(oldAlertRow, newAlertRow);

const oldAlertStyle = `style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(248,113,113,0.15)', border: '1px solid #f87171', cursor: 'pointer' }}`;
const newAlertStyle = `style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: a.type === 'destination_arrived' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.15)', border: \`1px solid \${a.type === 'destination_arrived' ? 'rgba(52,211,153,0.3)' : '#f87171'}\`, cursor: 'pointer' }}`;

content = content.replace(oldAlertStyle, newAlertStyle);

fs.writeFileSync("src/pages/DashboardPage.jsx", content);
console.log("DashboardPage alert icons patched!");
