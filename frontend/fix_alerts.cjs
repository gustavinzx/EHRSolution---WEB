const fs = require("fs");
let content = fs.readFileSync("src/pages/DashboardPage.jsx", "utf8");

const oldCode = `                  {alertTrucks.map(t => {
                    const isLow = t.status === 'low_fuel';
                    const color = isLow ? '#fbbf24' : '#f87171';
                    return (
                      <div key={\`status-\${t.id}\`} onClick={() => handleSelectTruck(t.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: selectedTruckId === t.id ? \`\${color}22\` : \`\${color}0d\`, border: \`1px solid\`, borderColor: selectedTruckId === t.id ? color : \`\${color}33\`, cursor: 'pointer' }}
                      >
                        <AlertTriangle size={15} color={color} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>{t.plate}</div>
                          <div style={{ fontSize: '11px', color }}>{isLow ? 'Combustível Baixo' : 'Sem Sinal'}</div>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color, fontFamily: 'monospace' }}>{pct(t)}%</div>
                      </div>
                    );
                  })}`;

const newCode = `                  {alertTrucks.map(t => {
                    let color = '#f87171';
                    let label = 'Sem Sinal';
                    let Icon = AlertTriangle;
                    if (t.status === 'low_fuel' || t.status === 'critical_fuel') {
                      color = '#fbbf24';
                      label = 'Combustível Baixo';
                    } else if (t.status === 'arrived' || t.sim_state === 'arrived') {
                      color = '#60a5fa';
                      label = 'Chegou ao Destino';
                      Icon = CheckCircle;
                    }
                    return (
                      <div key={\`status-\${t.id}\`} onClick={() => handleSelectTruck(t.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: selectedTruckId === t.id ? \`\${color}22\` : \`\${color}0d\`, border: \`1px solid\`, borderColor: selectedTruckId === t.id ? color : \`\${color}33\`, cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        <Icon size={15} color={color} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>{t.plate}</div>
                          <div style={{ fontSize: '11px', color }}>{label}</div>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color, fontFamily: 'monospace' }}>{pct(t)}%</div>
                      </div>
                    );
                  })}`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync("src/pages/DashboardPage.jsx", content);
  console.log("DashboardPage alert logic patched!");
} else {
  console.log("oldCode not found!");
}
