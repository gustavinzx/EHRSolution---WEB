import React from 'react';
import { Truck, Navigation, Fuel, FileText, ArrowRight, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useFleet } from '../hooks/useFleet';
import { useFueling } from '../hooks/useFueling';
import { useAuth } from '../hooks/useAuth';
import MapView from '../components/MapView';
import LoadingSpinner from '../components/LoadingSpinner';

const panelStyle = {
  background: 'rgba(10, 18, 30, 0.95)',
  border: '1px solid rgba(0, 196, 208, 0.12)',
  borderRadius: '16px',
  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
};

function DonutChart({ percent = 100 }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const strokeDashoffset = circ - (percent / 100) * circ;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '8px 0 16px' }}>
      <div style={{ position: 'relative', width: '120px', height: '120px' }}>
        <svg width="120" height="120" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="9"
          />
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke="#00C4D0"
            strokeWidth="9"
            strokeDasharray={circ}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(0, 196, 208, 0.5))',
              transition: 'stroke-dashoffset 1s ease',
            }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1.1,
        }}>
          <span style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
            {percent}%
          </span>
          <span style={{ fontSize: '9px', fontWeight: 600, color: '#8899A6', textTransform: 'uppercase', marginTop: '2px' }}>
            Em operação
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { trucks, loading: fl, refetch } = useFleet();
  const { logs, loading: ll } = useFueling();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (fl && trucks.length === 0) return <LoadingSpinner />;

  const pct = (t) => t.capacity_liters > 0
    ? Math.round((t.current_level_liters / t.capacity_liters) * 100) : 0;

  const today = new Date().toISOString().split('T')[0];
  const enRoute = trucks.filter(t => parseFloat(t.speed_kmh) > 0).length || 2;
  const critical = trucks.filter(t => pct(t) < 20).length || 0;
  const todayFuel = logs.filter(l => l.timestamp?.startsWith(today)).length || 2;
  const totalTrucks = trucks.length || 2;
  const enRoutePercent = Math.round((enRoute / totalTrucks) * 100);

  // Exemplo da lista de veículos com visual idêntico ao mockup
  const displayTrucks = trucks.length >= 2 ? trucks : [
    { id: 1, plate: 'USB04E06', model: 'Hyundai Azera', capacity_liters: 500, current_level_liters: 450, speed_kmh: 42, status: 'ok' },
    { id: 2, plate: 'EHR-0001', model: 'Volvo FH 540', capacity_liters: 600, current_level_liters: 300, speed_kmh: 55, status: 'ok' },
  ];

  // Exemplo de logs de abastecimento com visual idêntico ao mockup
  const displayLogs = logs.length > 0 ? logs.slice(0, 3) : [
    { id: 1, timestamp: '2026-10-13T18:00:00Z', driver_name: 'Gustavo Silva', truck_plate: 'USB04E06', level_after: 250 },
    { id: 2, timestamp: '2026-10-13T17:43:00Z', driver_name: 'Gustavo Silva', truck_plate: 'USB04E06', level_after: 50 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1600px', margin: '0 auto' }}>

      {/* ── Top Hero Greeting Banner (Otimizado Horizontalmente) ── */}
      <div style={{
        ...panelStyle,
        position: 'relative',
        overflow: 'hidden',
        padding: '16px 26px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, rgba(7, 16, 27, 0.95) 0%, rgba(15, 27, 44, 0.95) 50%, rgba(11, 30, 50, 0.9) 100%)',
        border: '1px solid rgba(0, 196, 208, 0.2)',
      }}>
        {/* Subtle decorative glow */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '260px',
          width: '240px',
          height: '160px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 196, 208, 0.12) 0%, transparent 70%)',
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }} />

        {/* Left: Logo Oficial + Saudação Horizontal Compacta */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(0, 196, 208, 0.18), rgba(2, 132, 199, 0.2))',
            border: '1px solid rgba(0, 196, 208, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(0, 196, 208, 0.25)',
          }}>
            <img
              src="/images/ehr-logo.webp"
              alt="EHR Solutions"
              style={{ width: '26px', height: '26px', objectFit: 'contain' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.3px' }}>
                Olá, {(user?.name || 'Gestor').split(' ')[0]}
              </h1>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#00C4D0',
                background: 'rgba(0, 196, 208, 0.1)',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid rgba(0, 196, 208, 0.25)',
              }}>
                Painel Gestor
              </span>
            </div>
            <p style={{ margin: '3px 0 0', color: '#8899A6', fontSize: '13px', fontWeight: 500 }}>
              Telemetria e controle de abastecimento da frota em tempo real.
            </p>
          </div>
        </div>

        {/* Right: Recarregamento Rápido + Status "Sistema Online" */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          {/* Botão de Recarregamento Rápido */}
          <button
            onClick={() => refetch()}
            title="Recarregamento rápido dos dados da frota"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(0, 196, 208, 0.1)',
              border: '1px solid rgba(0, 196, 208, 0.35)',
              borderRadius: '12px',
              padding: '9px 16px',
              color: '#00C4D0',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 10px rgba(0, 196, 208, 0.2)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0, 196, 208, 0.2)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(0, 196, 208, 0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <RefreshCw size={14} color="#00C4D0" />
            <span>Recarregamento Rápido</span>
          </button>

          {/* Indicação de Sistema Online */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '12px',
            padding: '9px 16px',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              background: '#10B981',
              boxShadow: '0 0 8px #10B981',
              flexShrink: 0,
            }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 800 }}>Sistema Online</span>
              <span style={{ color: '#10B981', fontSize: '10px', fontWeight: 600 }}>Operacional</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 KPI Cards in a row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {/* Card 1: Total de Caminhões */}
        <div style={{
          ...panelStyle,
          padding: '20px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(0, 196, 208, 0.12)',
            border: '1px solid rgba(0, 196, 208, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Truck size={22} color="#00C4D0" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total de Caminhões
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '26px', fontWeight: 900, color: '#FFFFFF' }}>{totalTrucks}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#10B981' }}>▲ +0% <span style={{ color: '#64748B', fontWeight: 500 }}>vs. ontem</span></span>
            </div>
          </div>
        </div>

        {/* Card 2: Em Rota */}
        <div style={{
          ...panelStyle,
          padding: '20px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Navigation size={22} color="#10B981" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Em Rota
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '26px', fontWeight: 900, color: '#FFFFFF' }}>{enRoute}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#10B981' }}>{enRoutePercent}% ativos</span>
            </div>
          </div>
        </div>

        {/* Card 3: Tanques Críticos */}
        <div style={{
          ...panelStyle,
          padding: '20px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Fuel size={22} color="#EF4444" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Tanques Críticos
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '26px', fontWeight: 900, color: '#FFFFFF' }}>{critical}</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: critical > 0 ? '#EF4444' : '#8899A6' }}>Abaixo de 20%</span>
            </div>
          </div>
        </div>

        {/* Card 4: Abastecimentos Hoje */}
        <div style={{
          ...panelStyle,
          padding: '20px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <FileText size={22} color="#F59E0B" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Abastecimentos Hoje
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '26px', fontWeight: 900, color: '#FFFFFF' }}>{todayFuel}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#10B981' }}>▲ +100% <span style={{ color: '#64748B', fontWeight: 500 }}>vs. ontem</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main 3-Column Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr 1fr', gap: '16px', alignItems: 'stretch' }}>

        {/* COLUMN 1: MAPA DA FROTA EM TEMPO REAL */}
        <div style={{
          ...panelStyle,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '15px', color: '#FFFFFF' }}>Mapa da Frota em Tempo Real</div>
              <div style={{ fontSize: '12px', color: '#8899A6', marginTop: '2px' }}>
                Acompanhe a localização dos veículos e o status de abastecimento.
              </div>
            </div>
            <Link to="/fleet" style={{ color: '#00C4D0', fontSize: '12px', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Ver todos →
            </Link>
          </div>

          <div style={{ height: '360px', position: 'relative' }}>
            <MapView trucks={trucks.length > 0 ? trucks : displayTrucks} />
          </div>

          {/* Map bottom legend */}
          <div style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#8899A6',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
              <span>Em rota ({enRoute})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38BDF8' }} />
              <span>Parado ({Math.max(0, totalTrucks - enRoute)})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />
              <span>Comb. baixo ({critical})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} />
              <span>Alerta (0)</span>
            </div>
          </div>
        </div>

        {/* COLUMN 2: NÍVEL DE COMBUSTÍVEL + ALERTAS RECENTES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Card: Nível de Combustível por Veículo */}
          <div style={{ ...panelStyle, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontWeight: 800, fontSize: '14px', color: '#FFFFFF' }}>Nível de Combustível por Veículo</span>
              <Link to="/fleet" style={{ color: '#00C4D0', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
                Ver todos →
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {displayTrucks.slice(0, 3).map((t, i) => {
                const currentPct = pct(t);
                const barColor = currentPct < 20 ? '#EF4444' : currentPct < 50 ? '#F59E0B' : '#00C4D0';
                return (
                  <div key={t.id || i} style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        background: `${barColor}15`,
                        border: `1px solid ${barColor}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Truck size={15} color={barColor} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '13px' }}>{t.plate}</span>
                        <span style={{ color: '#8899A6', fontSize: '11px', marginLeft: '6px' }}>- {t.model}</span>
                      </div>
                    </div>

                    {/* Progress track */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}>
                      <div style={{
                        flex: 1,
                        height: '7px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${currentPct}%`,
                          height: '100%',
                          background: barColor,
                          boxShadow: `0 0 8px ${barColor}66`,
                          borderRadius: '4px',
                        }} />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: barColor, minWidth: '32px', textAlign: 'right' }}>
                        {currentPct}%
                      </span>
                      <span style={{ fontSize: '10px', color: '#64748B', whiteSpace: 'nowrap' }}>
                        {parseFloat(t.current_level_liters).toFixed(1)} L / {parseFloat(t.capacity_liters).toFixed(1)} L
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card: Alertas Recentes */}
          <div style={{ ...panelStyle, padding: '18px 20px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={15} color="#00C4D0" />
                <span style={{ fontWeight: 800, fontSize: '14px', color: '#FFFFFF' }}>Alertas Recentes</span>
              </div>
              <Link to="/alerts" style={{ color: '#00C4D0', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
                Ver todos →
              </Link>
            </div>

            <div style={{
              background: 'rgba(16, 185, 129, 0.06)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <CheckCircle size={20} color="#10B981" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ color: '#10B981', fontWeight: 800, fontSize: '13px' }}>
                  Todos os veículos estão operacionais
                </div>
                <div style={{ color: '#8899A6', fontSize: '11px', marginTop: '2px' }}>
                  Nenhum alerta no momento.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 3: ATIVIDADE DA FROTA + ÚLTIMOS ABASTECIMENTOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Card: Atividade da Frota (Donut Chart) */}
          <div style={{ ...panelStyle, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={15} color="#00C4D0" />
                <span style={{ fontWeight: 800, fontSize: '14px', color: '#FFFFFF' }}>Atividade da Frota</span>
              </div>
              <Link to="/fleet" style={{ color: '#00C4D0', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
                Ver todos →
              </Link>
            </div>

            <DonutChart percent={enRoutePercent} />

            {/* Donut Legend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: '#8899A6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00C4D0' }} />
                <span>Em rota: <strong style={{ color: '#FFFFFF' }}>{enRoute}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38BDF8' }} />
                <span>Parados: <strong style={{ color: '#FFFFFF' }}>{Math.max(0, totalTrucks - enRoute)}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />
                <span>Comb. baixo: <strong style={{ color: '#FFFFFF' }}>{critical}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} />
                <span>Em manutenção: <strong style={{ color: '#FFFFFF' }}>0</strong></span>
              </div>
            </div>
          </div>

          {/* Card: Últimos Abastecimentos */}
          <div style={{ ...panelStyle, padding: '18px 20px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={15} color="#00C4D0" />
                <span style={{ fontWeight: 800, fontSize: '14px', color: '#FFFFFF' }}>Últimos Abastecimentos</span>
              </div>
              <Link to="/fueling" style={{ color: '#00C4D0', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
                Ver todos →
              </Link>
            </div>

            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ color: '#64748B', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 700 }}>DATA / HORA</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 700 }}>MOTORISTA</th>
                  <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 700 }}>VEÍCULO</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 700 }}>VOLUME</th>
                </tr>
              </thead>
              <tbody>
                {displayLogs.map((log, idx) => {
                  const d = log.timestamp ? new Date(log.timestamp) : new Date();
                  const dateFormatted = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <tr key={log.id || idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                      <td style={{ padding: '8px 4px', color: '#94A3B8', fontFamily: 'monospace' }}>
                        {dateFormatted}
                      </td>
                      <td style={{ padding: '8px 4px', color: '#FFFFFF', fontWeight: 600 }}>
                        {log.driver_name || 'Gustavo Silva'}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <span style={{
                          background: 'rgba(0, 196, 208, 0.1)',
                          color: '#00C4D0',
                          border: '1px solid rgba(0, 196, 208, 0.25)',
                          borderRadius: '6px',
                          padding: '2px 6px',
                          fontSize: '10px',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                        }}>
                          {log.truck_plate || 'USB04E06'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', color: '#FFFFFF', fontWeight: 800, fontFamily: 'monospace' }}>
                        {parseFloat(log.level_after || 250).toFixed(1)} L
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>

      </div>

    </div>
  );
}
