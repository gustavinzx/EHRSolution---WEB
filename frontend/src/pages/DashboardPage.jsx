import React, { useState, useEffect } from 'react';
import { Truck, Navigation, Fuel, FileText, ArrowRight, AlertTriangle, CheckCircle, Zap, Map } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useFleet, useLiveEvents }   from '../hooks/useFleet';
import { useFueling } from '../hooks/useFueling';
import useFleetState  from '../store/useFleetState';
import MapView        from '../components/MapView';
import FuelingTable   from '../components/FuelingTable';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage   from '../components/ErrorMessage';
import Simulation3DModal from '../components/Simulation3DModal';

const card = {
  background: 'var(--bg-panel)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '12px',
};

function MiniBarChart({ trucks }) {
  if (!trucks.length) return null;
  const vals = trucks.slice(0,7).map(t => ({
    label: t.plate,
    value: t.capacity_liters > 0 ? Math.round((t.current_level_liters / t.capacity_liters) * 100) : 0,
    color: (t.current_level_liters / t.capacity_liters) < 0.2 ? '#f87171' :
           (t.current_level_liters / t.capacity_liters) < 0.5 ? '#fbbf24' : '#2FBEB5',
  }));
  const max = Math.max(...vals.map(v => v.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '80px', padding: '0 4px' }}>
      {vals.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }}>{v.value}%</span>
          <div style={{
            width: '100%', borderRadius: '4px 4px 0 0',
            background: `${v.color}22`,
            height: `${Math.max((v.value / max) * 56, 4)}px`,
            border: `1px solid ${v.color}55`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
              background: `linear-gradient(to top, ${v.color}88, transparent)`,
            }} />
          </div>
          <span style={{ fontSize: '8px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%', textOverflow: 'ellipsis', textAlign: 'center' }}>{v.label}</span>
        </div>
      ))}
    </div>
  );
}

function DonutRing({ value, color, label }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(value, 100) / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ position: 'relative', width: '64px', height: '64px' }}>
        <svg width="64" height="64" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 30 30)"
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 700, color: '#fff', fontFamily: 'monospace',
        }}>{value}%</div>
      </div>
      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>{label}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { trucks, loading: fl, error, refetch } = useFleet();
  const { logs,   loading: ll }          = useFueling();
  const { fueling_now, recent_logs }     = useLiveEvents();
  const navigate = useNavigate();
  const { selectedTruckId, setSelectedTruckId, alerts, fetchAlerts } = useFleetState();
  const [is3DOpen, setIs3DOpen] = useState(false);

  useEffect(() => {
    if (fetchAlerts) fetchAlerts();
  }, [fetchAlerts]);

  const handleSelectTruck = (id) => {
    if (selectedTruckId === id) setSelectedTruckId(null);
    else setSelectedTruckId(id);
  };

  const selectedTruck = trucks?.find(t => t.id === selectedTruckId);

  const pct = (t) => t.capacity_liters > 0
    ? Math.round((t.current_level_liters / t.capacity_liters) * 100) : 0;

  if (fl && (!trucks || trucks.length === 0)) return <LoadingSpinner />;
  if (error && (!trucks || trucks.length === 0)) return <ErrorMessage message={error} />;

  const safeTrucks = Array.isArray(trucks) ? trucks : [];
  const safeLogs = Array.isArray(logs) ? logs : [];

  const today    = new Date().toISOString().split('T')[0];
  const enRoute  = safeTrucks.filter(t => parseFloat(t.speed_kmh) > 0).length;
  const critical = safeTrucks.filter(t => pct(t) < 20).length;
  const todayFuel= safeLogs.filter(l => l.timestamp?.startsWith(today)).length;
  const statuses = {
    ok:  safeTrucks.filter(t => t.status === 'ok').length,
    low: safeTrucks.filter(t => t.status === 'low_fuel').length,
    off: safeTrucks.filter(t => t.status === 'no_signal').length,
  };
  const avgFuel = safeTrucks.length > 0
    ? Math.round(safeTrucks.reduce((acc, t) => acc + pct(t), 0) / safeTrucks.length) : 0;

  const statCards = [
    { title: 'Total Caminhões', value: safeTrucks.length, sub: `${statuses.ok} operacionais`, icon: Truck, color: '#2FBEB5', bg: 'rgba(47,190,181,0.1)', border: 'rgba(47,190,181,0.2)' },
    { title: 'Em Rota', value: enRoute, sub: `${safeTrucks.length - enRoute} parados`, icon: Navigation, color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
    { title: 'Tanques Críticos', value: critical, sub: 'Abaixo de 20%', icon: Fuel, color: critical > 0 ? '#f87171' : '#34d399', bg: critical > 0 ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)', border: critical > 0 ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)' },
    { title: 'Abastecimentos Hoje', value: todayFuel, sub: 'registros hoje', icon: FileText, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)' },
  ];

  const alertTrucks  = safeTrucks.filter(t => t.status !== 'ok').slice(0, 4);
  const activeTrucks = safeTrucks.filter(t => parseFloat(t.speed_kmh) > 0).slice(0, 4);
  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div className="operations-summary">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="eyebrow">CENTRAL DE OPERAÇÕES</div>
          <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            Visão geral da frota
          </h1>
          <p style={{ margin: '10px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: '14px', maxWidth: '400px' }}>
            Você tem <strong style={{ color: '#fbbf24' }}>{critical} tanque{critical !== 1 ? 's' : ''} crítico{critical !== 1 ? 's' : ''}</strong> e{' '}
            <strong style={{ color: '#2FBEB5' }}>{enRoute} {enRoute === 1 ? 'caminhão' : 'caminhões'} em rota</strong> agora.
          </p>
          <div className="operations-actions">
            <button onClick={() => navigate('/fleet')} className="panel-button primary-button">
              <Truck size={14} /> Ver Frota Completa
            </button>
            <button onClick={refetch} className="panel-button">
              Atualizar Dados
            </button>
          </div>
        </div>
        <div className="operations-rings">
          <DonutRing value={avgFuel} color="#2FBEB5" label="Combustível" />
          <DonutRing value={safeTrucks.length > 0 ? Math.round((enRoute / safeTrucks.length) * 100) : 0} color="#34d399" label="Em rota" />
          <DonutRing value={safeTrucks.length > 0 ? Math.round((statuses.ok / safeTrucks.length) * 100) : 0} color="#4F8EF7" label="Operacional" />
        </div>
      </div>

      <div className="dashboard-stats">
        {statCards.map((s, i) => (
          <div key={i} className="fleet-kpi">
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${s.color}20`, border: `1px solid ${s.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div>
              <div className="eyebrow">{s.title}</div>
              <div className="fleet-kpi-value">{s.value}</div>
              <div className="fleet-kpi-note">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-columns">
        <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="fleet-map-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>Mapa da Frota em Tempo Real</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Posições atualizadas automaticamente</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              {selectedTruckId && (
                <button 
                  onClick={() => setIs3DOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--teal)', color: '#000', border: 'none', padding: '4px 10px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Map size={12} /> Ver no 3D
                </button>
              )}
            </div>
          </div>
          <div style={{ height: '300px' }}>
            <MapView
              trucks={safeTrucks}
              onOpen3D={(truck) => {
                setSelectedTruckId(truck.id);
                setIs3DOpen(true);
              }}
            />
          </div>
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>Nível de Combustível por Veículo</span>
              <Link to="/fleet" style={{ fontSize: '12px', color: '#2FBEB5', display: 'flex', alignItems: 'center', gap: '4px' }}>Ver todos <ArrowRight size={12} /></Link>
            </div>
            <MiniBarChart trucks={safeTrucks} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={card}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
                Rotas Ativas
              </div>
              <span style={{ fontSize: '11px', color: '#2FBEB5', background: 'rgba(47,190,181,0.1)', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>{enRoute} em rota</span>
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {activeTrucks.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#475569', fontSize: '13px', padding: '20px 0' }}>Nenhum caminhão em rota</div>
              ) : activeTrucks.map(t => (
                <div key={t.id} onClick={() => handleSelectTruck(t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', background: selectedTruckId === t.id ? 'rgba(47,190,181,0.15)' : 'rgba(255,255,255,0.03)', border: '1px solid', borderColor: selectedTruckId === t.id ? 'var(--teal)' : 'rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(47,190,181,0.2), rgba(79,142,247,0.2))', border: '1px solid rgba(47,190,181,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Truck size={16} color="#2FBEB5" />
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>{t.plate}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.model}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#34d399', fontFamily: 'monospace' }}>{t.speed_kmh} km/h</div>
                    <div style={{ fontSize: '10px', color: '#475569' }}>velocidade</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <AlertTriangle size={15} color="#fbbf24" /> Alertas
              </div>
              {(alertTrucks.length > 0 || safeAlerts.length > 0) && (
                <span style={{ fontSize: '11px', color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>{alertTrucks.length + safeAlerts.length} atenção</span>
              )}
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {alertTrucks.length === 0 && safeAlerts.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 12px', color: '#34d399', fontSize: '13px' }}>
                  <CheckCircle size={16} /> Todos os veículos estão OK
                </div>
              ) : (
                <>
                  {safeAlerts.map(a => (
                    <div key={`alert-${a.id}`} onClick={() => handleSelectTruck(a.truck_id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(248,113,113,0.15)', border: '1px solid #f87171', cursor: 'pointer' }}
                    >
                      <Fuel size={15} color="#f87171" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>{a.plate}</div>
                        <div style={{ fontSize: '11px', color: '#f87171' }}>{a.message}</div>
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                        {new Date(a.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  ))}
                  {alertTrucks.map(t => {
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
                      <div key={`status-${t.id}`} onClick={() => handleSelectTruck(t.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: selectedTruckId === t.id ? `${color}22` : `${color}0d`, border: `1px solid`, borderColor: selectedTruckId === t.id ? color : `${color}33`, cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        <Icon size={15} color={color} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>{t.plate}</div>
                          <div style={{ fontSize: '11px', color }}>{label}</div>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color, fontFamily: 'monospace' }}>{pct(t)}%</div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Eventos ao Vivo ── */}
      {(Array.isArray(fueling_now) && fueling_now.length > 0) || (Array.isArray(recent_logs) && recent_logs.length > 0) ? (
        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f87171', boxShadow: '0 0 10px #f87171', animation: 'pulse-ring 1.5s infinite' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>Eventos ao Vivo</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Abastecimentos em andamento e recentes</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.isArray(fueling_now) && fueling_now.map(t => (
              <div key={t.id} onClick={() => handleSelectTruck(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: selectedTruckId === t.id ? 'rgba(248,113,113,0.15)' : 'rgba(248,113,113,0.08)', border: '1px solid', borderColor: selectedTruckId === t.id ? '#f87171' : 'rgba(248,113,113,0.3)', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(248,113,113,0.15)', border: '2px solid rgba(248,113,113,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: 'pulse-ring 1.2s infinite' }}>
                  <Fuel size={16} color="#f87171" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'monospace' }}>{t.plate}</span>
                    <span style={{ fontSize: '10px', background: '#f87171', color: '#000', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>⛽ ABASTECENDO AGORA</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{t.model}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '12px', color: '#f87171', fontFamily: 'monospace', fontWeight: 700 }}>
                    {t.capacity_liters > 0 ? Math.round((t.current_level_liters / t.capacity_liters) * 100) : 0}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>nível atual</div>
                </div>
              </div>
            ))}

            {Array.isArray(recent_logs) && recent_logs.map(log => {
              const mins = Math.round((Date.now() - new Date(log.timestamp).getTime()) / 60000);
              const timeStr = mins < 1 ? 'agora' : mins < 60 ? `${mins}min atrás` : `${Math.floor(mins/60)}h atrás`;
              const liters = (parseFloat(log.level_after) - parseFloat(log.level_before)).toFixed(0);
              return (
                <div key={log.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '12px', background: 'rgba(47,190,181,0.05)', border: '1px solid rgba(47,190,181,0.15)' }}
                >
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(47,190,181,0.1)', border: '1px solid rgba(47,190,181,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Zap size={14} color="#2FBEB5" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'monospace' }}>{log.plate}</span>
                      <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700 }}>+{liters}L</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{log.model} • {log.driver_name || 'Desconhecido'}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, fontSize: '11px', color: '#64748b' }}>
                    {timeStr}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {is3DOpen && selectedTruck && (
        <Simulation3DModal isOpen={is3DOpen} truck={selectedTruck} onClose={() => setIs3DOpen(false)} />
      )}
    </div>
  );
}
