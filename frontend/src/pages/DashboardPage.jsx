import React from 'react';
import { Truck, Navigation, Fuel, FileText, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useFleet }   from '../hooks/useFleet';
import { useFueling } from '../hooks/useFueling';
import { useAuth }    from '../hooks/useAuth';
import MapView        from '../components/MapView';
import FuelingTable   from '../components/FuelingTable';
import LoadingSpinner from '../components/LoadingSpinner';

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
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
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
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
  const { trucks, loading: fl, refetch } = useFleet();
  const { logs,   loading: ll }          = useFueling();
  const { user } = useAuth();
  const navigate = useNavigate();

  const pct = (t) => t.capacity_liters > 0
    ? Math.round((t.current_level_liters / t.capacity_liters) * 100) : 0;

  if (fl && trucks.length === 0) return <LoadingSpinner />;

  const today    = new Date().toISOString().split('T')[0];
  const enRoute  = trucks.filter(t => parseFloat(t.speed_kmh) > 0).length;
  const critical = trucks.filter(t => pct(t) < 20).length;
  const todayFuel= logs.filter(l => l.timestamp?.startsWith(today)).length;
  const statuses = {
    ok:  trucks.filter(t => t.status === 'ok').length,
    low: trucks.filter(t => t.status === 'low_fuel').length,
    off: trucks.filter(t => t.status === 'no_signal').length,
  };
  const avgFuel = trucks.length > 0
    ? Math.round(trucks.reduce((acc, t) => acc + pct(t), 0) / trucks.length) : 0;

  const statCards = [
    { title: 'Total Caminhões', value: trucks.length, sub: `${statuses.ok} operacionais`, icon: Truck, color: '#2FBEB5', bg: 'rgba(47,190,181,0.1)', border: 'rgba(47,190,181,0.2)' },
    { title: 'Em Rota', value: enRoute, sub: `${trucks.length - enRoute} parados`, icon: Navigation, color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
    { title: 'Tanques Críticos', value: critical, sub: 'Abaixo de 20%', icon: Fuel, color: critical > 0 ? '#f87171' : '#34d399', bg: critical > 0 ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)', border: critical > 0 ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)' },
    { title: 'Abastecimentos Hoje', value: todayFuel, sub: 'registros hoje', icon: FileText, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)' },
  ];

  const alertTrucks  = trucks.filter(t => t.status !== 'ok').slice(0, 4);
  const activeTrucks = trucks.filter(t => parseFloat(t.speed_kmh) > 0).slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* ── Hero Banner ── */}
      <div style={{
        borderRadius: '24px',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '32px 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden', minHeight: '160px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
      }}>
        {/* Decorative background glows */}
        <div style={{ position: 'absolute', top: '-60px', left: '-40px', width: '250px', height: '250px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(47,190,181,0.15) 0%, transparent 70%)', filter: 'blur(30px)', zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: '-80px', right: '150px', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,142,247,0.15) 0%, transparent 70%)', filter: 'blur(40px)', zIndex: 0 }} />
        
        <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>
            Visão Geral do Sistema
          </div>
          <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.2, letterSpacing: '-0.5px' }}>
            Olá, {(user?.name || 'Gestor').split(' ')[0]}! 👋
          </h1>
          <p style={{ margin: '12px 0 0', color: '#cbd5e1', fontSize: '15px', maxWidth: '450px', lineHeight: 1.5 }}>
            No momento, há <strong style={{ color: '#f87171' }}>{critical} tanque{critical !== 1 ? 's' : ''} crítico{critical !== 1 ? 's' : ''}</strong> e{' '}
            <strong style={{ color: '#34d399' }}>{enRoute} caminh{enRoute !== 1 ? 'ões' : 'ão'} em rota</strong> operando.
          </p>
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button onClick={() => navigate('/fleet')} style={{ 
              background: 'linear-gradient(135deg, #2FBEB5 0%, #209991 100%)', 
              border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '12px', 
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', 
              boxShadow: '0 8px 16px rgba(47,190,181,0.25)', 
              display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'transform 0.1s',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
              <Truck size={16} /> Frota Completa
            </button>
            <button onClick={refetch} style={{ 
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', 
              color: '#f8fafc', padding: '10px 20px', borderRadius: '12px', 
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}>
              Atualizar
            </button>
          </div>
        </div>

        <div style={{ 
          display: 'flex', gap: '28px', position: 'relative', zIndex: 1, 
          background: 'rgba(15, 23, 42, 0.4)', padding: '24px 32px', 
          borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)',
          backdropFilter: 'blur(10px)',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)'
        }}>
          <DonutRing value={avgFuel} color="#2FBEB5" label="Tanques" />
          <DonutRing value={trucks.length > 0 ? Math.round((enRoute / trucks.length) * 100) : 0} color="#34d399" label="Em Rota" />
          <DonutRing value={trucks.length > 0 ? Math.round((statuses.ok / trucks.length) * 100) : 0} color="#4F8EF7" label="Operacional" />
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {statCards.map((s, i) => (
          <div key={i} style={{ ...card, background: s.bg, border: `1px solid ${s.border}`, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px', transition: 'transform 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${s.color}20`, border: `1px solid ${s.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>{s.title}</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', lineHeight: 1.1, marginTop: '4px', fontFamily: 'monospace' }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px', alignItems: 'start' }}>

        {/* Map card */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>Mapa da Frota em Tempo Real</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Atualiza automaticamente a cada 15s</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              {[['#34d399','OK',statuses.ok],['#fbbf24','Baixo',statuses.low],['#f87171','Off',statuses.off]].map(([c,l,n]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c, boxShadow: `0 0 5px ${c}`, flexShrink: 0 }} />
                  {l} ({n})
                </span>
              ))}
            </div>
          </div>
          <div style={{ height: '300px' }}>
            <MapView trucks={trucks} />
          </div>
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>Nível de Combustível por Veículo</span>
              <Link to="/fleet" style={{ fontSize: '12px', color: '#2FBEB5', display: 'flex', alignItems: 'center', gap: '4px' }}>Ver todos <ArrowRight size={12} /></Link>
            </div>
            <MiniBarChart trucks={trucks} />
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Active routes */}
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
                <div key={t.id} onClick={() => navigate(`/fleet/${t.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(47,190,181,0.08)'; e.currentTarget.style.borderColor = 'rgba(47,190,181,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
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

          {/* Alerts */}
          <div style={card}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <AlertTriangle size={15} color="#fbbf24" /> Alertas
              </div>
              {alertTrucks.length > 0 && (
                <span style={{ fontSize: '11px', color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>{alertTrucks.length} atenção</span>
              )}
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {alertTrucks.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 12px', color: '#34d399', fontSize: '13px' }}>
                  <CheckCircle size={16} /> Todos os veículos estão OK
                </div>
              ) : alertTrucks.map(t => {
                const isLow = t.status === 'low_fuel';
                const color = isLow ? '#fbbf24' : '#f87171';
                return (
                  <div key={t.id} onClick={() => navigate(`/fleet/${t.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: `${color}0d`, border: `1px solid ${color}33`, cursor: 'pointer' }}
                  >
                    <AlertTriangle size={15} color={color} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>{t.plate}</div>
                      <div style={{ fontSize: '11px', color }}>{isLow ? 'Combustível Baixo' : 'Sem Sinal'}</div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color, fontFamily: 'monospace' }}>{pct(t)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: Recent Fueling ── */}
      <div style={card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>Últimos Abastecimentos</div>
            <div style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>Registros mais recentes da frota</div>
          </div>
          <Link to="/fueling" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#2FBEB5', fontWeight: 600 }}>Ver todos <ArrowRight size={14} /></Link>
        </div>
        <div>
          {ll
            ? <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}><LoadingSpinner /></div>
            : <FuelingTable logs={logs.slice(0, 5)} />}
        </div>
      </div>

    </div>
  );
}
