const fs = require("fs");
let content = fs.readFileSync("src/pages/DashboardPage.jsx", "utf8");

content = content.replace("export default function DashboardPage() {", `export default function DashboardPage() {\n  const [alertFilter, setAlertFilter] = useState('all');`);
content = content.replace("import React, { useEffect, useState } from 'react';", "import React, { useEffect, useState, useMemo } from 'react';");

const alertFilterLogic = `
  const alertTrucks  = safeTrucks.filter(t => t.status !== 'ok').slice(0, 4);
  const activeTrucks = safeTrucks.filter(t => parseFloat(t.speed_kmh) > 0).slice(0, 4);
  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  const filteredAlerts = useMemo(() => {
    let combined = [...alertTrucks.map(t => ({
      id: 'truck-'+t.id, truck_id: t.id, type: 'critical_fuel', plate: t.plate, message: t.status === 'no_signal' ? 'Sem sinal de GPS' : 'Combustível Crítico', created_at: new Date().toISOString()
    })), ...safeAlerts];
    if (alertFilter === 'critical') {
      return combined.filter(a => a.type !== 'destination_arrived' && a.type !== 'info');
    }
    return combined;
  }, [alertTrucks, safeAlerts, alertFilter]);`;

content = content.replace(
  "const alertTrucks  = safeTrucks.filter(t => t.status !== 'ok').slice(0, 4);\n  const activeTrucks = safeTrucks.filter(t => parseFloat(t.speed_kmh) > 0).slice(0, 4);\n  const safeAlerts = Array.isArray(alerts) ? alerts : [];",
  alertFilterLogic
);

const oldAlertRender = `            <div style={card}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <AlertTriangle size={15} color="#fbbf24" /> Alertas
                </div>
                {(alertTrucks.length > 0 || safeAlerts.length > 0) && (
                  <span style={{ fontSize: '11px', color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>{alertTrucks.length + safeAlerts.length} atenção</span>
                )}
              </div>
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {alertTrucks.length === 0 && safeAlerts.length === 0 ? (`;

const newAlertRender = `            <div style={card}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <AlertTriangle size={15} color="#fbbf24" /> Alertas
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setAlertFilter('all')} style={{ background: alertFilter === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: alertFilter === 'all' ? '#fff' : '#8BA3BC', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Todos</button>
                  <button onClick={() => setAlertFilter('critical')} style={{ background: alertFilter === 'critical' ? 'rgba(248,113,113,0.15)' : 'transparent', border: 'none', color: alertFilter === 'critical' ? '#f87171' : '#8BA3BC', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Críticos</button>
                </div>
              </div>
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '300px' }}>
                {filteredAlerts.length === 0 ? (`;

content = content.replace(oldAlertRender, newAlertRender);

const oldAlertMap = `                ) : (
                  <>
                    {safeAlerts.map(a => (
                      <div key={\`alert-\${a.id}\`} onClick={() => handleSelectTruck(a.truck_id)}`;

const newAlertMap = `                ) : (
                  <>
                    {filteredAlerts.map(a => (
                      <div key={\`alert-\${a.id}\`} onClick={() => handleSelectTruck(a.truck_id)}`;

content = content.replace(oldAlertMap, newAlertMap);

const alertTrucksMap = `{alertTrucks.map(t => (
                      <div key={\`at-\${t.id}\`} onClick={() => handleSelectTruck(t.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', cursor: 'pointer', transition: 'background 0.2s' }}
                      >
                        <Fuel size={15} color="#f87171" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>{t.plate}</div>
                          <div style={{ fontSize: '11px', color: '#f87171' }}>Combustível Crítico ({Math.round(t.current_level_liters/t.capacity_liters*100)}%)</div>
                        </div>
                      </div>
                    ))}`;

content = content.replace(alertTrucksMap, "");

fs.writeFileSync("src/pages/DashboardPage.jsx", content);
console.log("DashboardPage alerts patched!");
