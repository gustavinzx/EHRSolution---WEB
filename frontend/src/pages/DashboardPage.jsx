import React from 'react';
import {
  Truck,
  Navigation,
  Fuel,
  FileText,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  Calendar,
  MapPin,
  ShieldAlert,
  TrendingDown,
  Lock,
  Activity,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useFleet } from '../hooks/useFleet';
import { useFueling } from '../hooks/useFueling';
import { useAlerts } from '../hooks/useAlerts';
import { getTruckVisualState } from '../utils/truckVisualState';
import { isSameLocalDay } from '../utils/dayRange';
import MapView from '../components/MapView';
import LoadingSpinner from '../components/LoadingSpinner';

const panelStyle = {
  background: 'linear-gradient(160deg, rgba(13, 25, 43, 0.92) 0%, rgba(8, 16, 30, 0.96) 100%)',
  border: '1px solid rgba(0, 212, 255, 0.14)',
  borderRadius: '16px',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
};

const alertTypeMeta = {
  fuel_drop:            { label: 'Queda abrupta de combustível', icon: TrendingDown, color: '#EF4444' },
  unauthorized_station: { label: 'Posto não autorizado',         icon: MapPin,       color: '#F59E0B' },
  tampering:            { label: 'Violação de trava',            icon: Lock,         color: '#EF4444' },
  facial_fail:          { label: 'Falha de biometria facial',    icon: ShieldAlert,  color: '#F59E0B' },
  low_fuel:             { label: 'Combustível crítico',          icon: Fuel,         color: '#F59E0B' },
};

function getAlertMeta(type) {
  return alertTypeMeta[type] || { label: type || 'Alerta de Segurança', icon: AlertTriangle, color: '#F59E0B' };
}

function getSeverityBadge(severity) {
  switch (severity) {
    case 'critical':
      return { label: 'Crítico', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)' };
    case 'high':
      return { label: 'Alto', color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.35)' };
    case 'medium':
      return { label: 'Médio', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)' };
    default:
      return { label: 'Baixo', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.35)' };
  }
}

/* Glowing Cyan Donut Chart for Fleet Activity */
function DonutChart({ percent }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(percent, 0), 100);
  const strokeDasharray = `${(clamped / 100) * circumference} ${circumference}`;

  return (
    <div style={{ position: 'relative', width: '154px', height: '154px', margin: '8px auto 12px' }}>
      <svg width="154" height="154" viewBox="0 0 154 154">
        <defs>
          <linearGradient id="iotCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#0095FF" />
          </linearGradient>
        </defs>
        {/* Outer subtle ticks ring */}
        <circle
          cx="77"
          cy="77"
          r="69"
          fill="none"
          stroke="rgba(0, 212, 255, 0.12)"
          strokeWidth="1.5"
          strokeDasharray="3 5"
        />
        {/* Track */}
        <circle
          cx="77"
          cy="77"
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth="13"
        />
        {/* Glowing Cyan Progress */}
        <circle
          cx="77"
          cy="77"
          r={radius}
          fill="none"
          stroke="url(#iotCyanGrad)"
          strokeWidth="13"
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          transform="rotate(-90 77 77)"
          style={{
            filter: 'drop-shadow(0 0 10px rgba(0, 212, 255, 0.65))',
            transition: 'stroke-dasharray 0.5s ease',
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
      }}>
        <span style={{
          fontSize: '28px',
          fontWeight: 900,
          color: '#FFFFFF',
          fontFamily: 'monospace',
          lineHeight: 1,
          textShadow: '0 0 12px rgba(0, 212, 255, 0.4)',
        }}>
          {clamped}%
        </span>
        <span style={{
          fontSize: '10px',
          color: '#00D4FF',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          marginTop: '5px',
          fontWeight: 800,
        }}>
          ATIVOS
        </span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { trucks, loading: fl, isConnected, refetch: refetchFleet } = useFleet();
  const { logs, refetch: refetchFueling } = useFueling();
  const { alerts, loading: al, error: ae, refetch: refetchAlerts } = useAlerts();
  const navigate = useNavigate();

  const pct = (t) => t.capacity_liters > 0
    ? Math.round((t.current_level_liters / t.capacity_liters) * 100) : 0;

  if (fl && trucks.length === 0) return <LoadingSpinner />;

  const now = new Date();
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  const totalTrucks = trucks.length;
  const enRoute = trucks.filter(t => parseFloat(t.speed_kmh) > 0).length;
  const critical = trucks.filter(t => pct(t) < 20).length;
  const todayFuel = logs.filter(l => isSameLocalDay(l.timestamp, now)).length;
  const yesterdayFuel = logs.filter(l => isSameLocalDay(l.timestamp, yesterdayDate)).length;

  const hasFuelTrend = yesterdayFuel > 0;
  const fuelTrendPct = hasFuelTrend
    ? Math.round(((todayFuel - yesterdayFuel) / yesterdayFuel) * 100)
    : null;

  const statuses = {
    ok: trucks.filter(t => t.status === 'ok').length,
    low: trucks.filter(t => t.status === 'low_fuel').length,
    off: trucks.filter(t => t.status === 'no_signal').length,
  };

  const fuelingTrucksCount = trucks.filter(t => getTruckVisualState(t) === 'fueling').length;
  const alertTrucksCount = trucks.filter(t => getTruckVisualState(t) === 'alert').length;
  const activeAlerts = (alerts || []).filter(a => !a.resolved_at && !a.resolved).slice(0, 3);

  const enRoutePercent = totalTrucks > 0 ? Math.round((enRoute / totalTrucks) * 100) : 0;
  const operationalPercent = totalTrucks > 0 ? Math.round((statuses.ok / totalTrucks) * 100) : 0;
  const criticalPercent = totalTrucks > 0 ? Math.round((critical / totalTrucks) * 100) : 0;

  const dateFormatted = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const dateDisplay = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);

  const handleRefresh = () => {
    refetchFleet();
    if (refetchFueling) refetchFueling();
    if (refetchAlerts) refetchAlerts();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* ── Top Header Card (Next-Gen Command Bar) ── */}
      <div style={{
        ...panelStyle,
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        background: 'linear-gradient(120deg, rgba(13, 27, 48, 0.95) 0%, rgba(8, 17, 32, 0.98) 100%)',
        border: '1px solid rgba(0, 212, 255, 0.2)',
      }}>
        {/* Left Title & Live Status */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.3px' }}>
              Painel de Controle da Frota
            </h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: isConnected ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
              border: isConnected ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
              color: isConnected ? '#10B981' : '#EF4444',
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 11px',
              borderRadius: '20px',
              letterSpacing: '0.3px',
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isConnected ? '#10B981' : '#EF4444',
                boxShadow: isConnected ? '0 0 8px #10B981' : '0 0 8px #EF4444',
              }} />
              {isConnected ? 'Sistema Online' : 'Sistema Offline'}
            </span>
          </div>
          <p style={{ margin: '5px 0 0', fontSize: '12.5px', color: '#8A9BB2', fontWeight: 500 }}>
            Monitoramento de Abastecimento e Segurança IoT em Tempo Real
          </p>
        </div>

        {/* Right Date & Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '8px 13px',
            color: '#CBD5E1',
            fontSize: '12px',
            fontWeight: 500,
          }}>
            <Calendar size={14} color="#00D4FF" />
            <span>{dateDisplay}</span>
          </div>

          <button
            onClick={() => navigate('/reports')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.28)',
              color: '#E2E8F0',
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Download size={14} color="#00D4FF" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handleRefresh}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              background: 'linear-gradient(135deg, #00D4FF 0%, #0095FF 100%)',
              border: 'none',
              color: '#04101E',
              padding: '8px 16px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 0 18px rgba(0, 212, 255, 0.35)',
              transition: 'all 0.2s',
            }}
          >
            <RefreshCw size={14} color="#04101E" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* ── 4 Next-Gen KPI Cards Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>

        {/* Card 1: Total Caminhões */}
        <div style={{
          ...panelStyle,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(0, 212, 255, 0.12)',
              border: '1px solid rgba(0, 212, 255, 0.32)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 16px rgba(0, 212, 255, 0.18)',
            }}>
              <Truck size={22} color="#00D4FF" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#8A9BB2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Total Caminhões
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '28px', fontWeight: 900, color: '#FFFFFF', fontFamily: 'monospace' }}>{totalTrucks}</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#10B981',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.28)',
                  padding: '2px 7px',
                  borderRadius: '999px',
                }}>
                  {statuses.ok} operacionais
                </span>
              </div>
            </div>
          </div>
          <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${operationalPercent}%`, height: '100%', background: 'linear-gradient(90deg, #00D4FF, #10B981)' }} />
          </div>
        </div>

        {/* Card 2: Em Rota */}
        <div style={{
          ...panelStyle,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.32)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 16px rgba(16, 185, 129, 0.18)',
            }}>
              <Navigation size={22} color="#10B981" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#8A9BB2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Em Rota
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '28px', fontWeight: 900, color: '#FFFFFF', fontFamily: 'monospace' }}>{enRoute}</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#00D4FF',
                  background: 'rgba(0, 212, 255, 0.12)',
                  border: '1px solid rgba(0, 212, 255, 0.28)',
                  padding: '2px 7px',
                  borderRadius: '999px',
                }}>
                  {enRoutePercent}% ativos
                </span>
              </div>
            </div>
          </div>
          <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${enRoutePercent}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #00D4FF)' }} />
          </div>
        </div>

        {/* Card 3: Tanques Críticos */}
        <div style={{
          ...panelStyle,
          border: critical > 0 ? '1px solid rgba(239, 68, 68, 0.42)' : panelStyle.border,
          boxShadow: critical > 0
            ? '0 10px 30px rgba(239, 68, 68, 0.12), inset 0 0 22px rgba(239, 68, 68, 0.06)'
            : panelStyle.boxShadow,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.14)',
              border: '1px solid rgba(239, 68, 68, 0.38)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 16px rgba(239, 68, 68, 0.22)',
            }}>
              <Fuel size={22} color="#EF4444" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#8A9BB2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Tanques Críticos
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '28px', fontWeight: 900, color: '#FFFFFF', fontFamily: 'monospace' }}>{critical}</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: critical > 0 ? '#EF4444' : '#8A9BB2',
                  background: critical > 0 ? 'rgba(239, 68, 68, 0.14)' : 'rgba(255, 255, 255, 0.05)',
                  border: critical > 0 ? '1px solid rgba(239, 68, 68, 0.32)' : '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '2px 7px',
                  borderRadius: '999px',
                }}>
                  Abaixo de 20%
                </span>
              </div>
            </div>
          </div>
          <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${criticalPercent}%`, height: '100%', background: 'linear-gradient(90deg, #EF4444, #F59E0B)' }} />
          </div>
        </div>

        {/* Card 4: Abastecimentos Hoje (Preserves exact parentElement hierarchy for DashboardPage.test.jsx) */}
        <div style={{
          ...panelStyle,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.32)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 16px rgba(245, 158, 11, 0.18)',
            }}>
              <FileText size={22} color="#F59E0B" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#8A9BB2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Abastecimentos Hoje
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '28px', fontWeight: 900, color: '#FFFFFF', fontFamily: 'monospace' }}>{todayFuel}</span>
                {hasFuelTrend && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: fuelTrendPct >= 0 ? '#10B981' : '#EF4444' }}>
                    {fuelTrendPct >= 0 ? `▲ +${fuelTrendPct}%` : `▼ ${fuelTrendPct}%`}{' '}
                    <span style={{ color: '#64748B', fontWeight: 500 }}>vs. ontem</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: todayFuel > 0 ? '100%' : '15%', height: '100%', background: 'linear-gradient(90deg, #F59E0B, #10B981)' }} />
          </div>
        </div>
      </div>

      {/* ── Main 3-Column Bento Grid ── */}
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
            borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} color="#00D4FF" />
                <span style={{ fontWeight: 800, fontSize: '15px', color: '#FFFFFF' }}>Mapa da Frota em Tempo Real</span>
              </div>
              <div style={{ fontSize: '12px', color: '#8A9BB2', marginTop: '3px' }}>
                Acompanhe a localização dos veículos e o status de abastecimento.
              </div>
            </div>
            <Link to="/fleet" style={{ color: '#00D4FF', fontSize: '12px', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Ver todos →
            </Link>
          </div>

          <div style={{ height: '380px', position: 'relative', flex: 1 }}>
            <MapView trucks={trucks} />
          </div>

          {/* Map bottom legend (keeps exact test labels) */}
          <div style={{
            padding: '13px 18px',
            borderTop: '1px solid rgba(0, 212, 255, 0.1)',
            background: 'rgba(6, 11, 20, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '11.5px',
            color: '#94A3B8',
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
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00D4FF', boxShadow: '0 0 6px #00D4FF' }} />
              <span>Abastecendo ({fuelingTrucksCount})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 6px #EF4444' }} />
              <span>Alerta ({alertTrucksCount})</span>
            </div>
          </div>
        </div>

        {/* COLUMN 2: NÍVEL DE COMBUSTÍVEL + ALERTAS RECENTES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Card: Nível de Combustível por Veículo */}
          <div style={{ ...panelStyle, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Fuel size={15} color="#00D4FF" />
                <span style={{ fontWeight: 800, fontSize: '14px', color: '#FFFFFF' }}>Nível de Combustível por Veículo</span>
              </div>
              <Link to="/fleet" style={{ color: '#00D4FF', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
                Ver todos →
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {trucks.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: '#8A9BB2', fontSize: '13px' }}>
                  Nenhum caminhão cadastrado
                </div>
              ) : (
                trucks.slice(0, 3).map((t, i) => {
                  const currentPct = pct(t);
                  const barColor = currentPct < 20 ? '#EF4444' : currentPct < 50 ? '#F59E0B' : '#00D4FF';
                  return (
                    <div key={t.id || i} style={{
                      background: 'rgba(6, 12, 24, 0.65)',
                      border: '1px solid rgba(0, 212, 255, 0.12)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            background: `${barColor}18`,
                            border: `1px solid ${barColor}45`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <Truck size={15} color={barColor} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div>
                              <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '13px', fontFamily: 'monospace' }}>{t.plate}</span>
                              <span style={{ color: '#8A9BB2', fontSize: '11px', marginLeft: '6px' }}>- {t.model}</span>
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 900, color: barColor, fontFamily: 'monospace' }}>
                          {currentPct}%
                        </span>
                      </div>

                      {/* Glowing Progress Track */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}>
                        <div style={{
                          flex: 1,
                          height: '8px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          borderRadius: '6px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${currentPct}%`,
                            height: '100%',
                            background: barColor,
                            boxShadow: `0 0 10px ${barColor}88`,
                            borderRadius: '6px',
                          }} />
                        </div>
                        <span style={{ fontSize: '10.5px', color: '#94A3B8', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                          {parseFloat(t.current_level_liters).toFixed(1)} L / {parseFloat(t.capacity_liters).toFixed(1)} L
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Card: Alertas Recentes */}
          <div style={{ ...panelStyle, padding: '18px 20px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={15} color="#EF4444" />
                <span style={{ fontWeight: 800, fontSize: '14px', color: '#FFFFFF' }}>Alertas Recentes</span>
              </div>
              <Link to="/alerts" style={{ color: '#00D4FF', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
                Ver todos →
              </Link>
            </div>

            {al ? (
              <div style={{ padding: '24px 12px', display: 'flex', justifyContent: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : ae ? (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.28)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
                <AlertTriangle size={20} color="#EF4444" style={{ flexShrink: 0 }} />
                <span style={{ color: '#EF4444', fontSize: '13px', fontWeight: 600 }}>
                  Não foi possível carregar os alertas
                </span>
              </div>
            ) : activeAlerts.length === 0 ? (
              <div style={{
                background: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.22)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
                <CheckCircle size={20} color="#10B981" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '13px' }}>
                    Nenhum alerta no momento.
                  </div>
                  <div style={{ color: '#8A9BB2', fontSize: '11px', marginTop: '2px' }}>
                    A frota está operando sem divergências ativas.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {activeAlerts.map((alert) => {
                  const meta = getAlertMeta(alert.type);
                  const Icon = meta.icon;
                  const sev = getSeverityBadge(alert.severity);
                  return (
                    <div
                      key={alert.id}
                      style={{
                        background: 'rgba(6, 12, 24, 0.65)',
                        border: `1px solid ${sev.border}`,
                        borderRadius: '11px',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '8px',
                          background: sev.bg,
                          border: `1px solid ${sev.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Icon size={14} color={sev.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {alert.message || meta.label}
                          </div>
                          {alert.plate && (
                            <div style={{ color: '#8A9BB2', fontSize: '11px', fontFamily: 'monospace' }}>
                              {alert.plate} {alert.model ? `• ${alert.model}` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        color: sev.color,
                        background: sev.bg,
                        border: `1px solid ${sev.border}`,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        textTransform: 'uppercase',
                        flexShrink: 0,
                      }}>
                        {sev.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: ATIVIDADE DA FROTA + ÚLTIMOS ABASTECIMENTOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Card: Atividade da Frota (Glowing Donut Gauge) */}
          <div style={{ ...panelStyle, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={15} color="#00D4FF" />
                <span style={{ fontWeight: 800, fontSize: '14px', color: '#FFFFFF' }}>Atividade da Frota</span>
              </div>
              <Link to="/fleet" style={{ color: '#00D4FF', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
                Ver todos →
              </Link>
            </div>

            <DonutChart percent={enRoutePercent} />

            {/* Donut Legend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px', color: '#8A9BB2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00D4FF', boxShadow: '0 0 6px #00D4FF' }} />
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
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                <span>Operacionais: <strong style={{ color: '#FFFFFF' }}>{statuses.ok}</strong></span>
              </div>
            </div>
          </div>

          {/* Card: Últimos Abastecimentos */}
          <div style={{ ...panelStyle, padding: '18px 20px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={15} color="#00D4FF" />
                <span style={{ fontWeight: 800, fontSize: '14px', color: '#FFFFFF' }}>Últimos Abastecimentos</span>
              </div>
              <Link to="/fueling" style={{ color: '#00D4FF', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
                Ver todos →
              </Link>
            </div>
            {logs.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: '#8A9BB2', fontSize: '13px' }}>
                Nenhum abastecimento registrado
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ color: '#64748B', borderBottom: '1px solid rgba(0, 212, 255, 0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 700 }}>DATA / HORA</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 700 }}>MOTORISTA</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 700 }}>VEÍCULO</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 700 }}>VOLUME</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 5).map((log, idx) => {
                    const d = log.timestamp ? new Date(log.timestamp) : new Date();
                    const dateFormatted = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <tr key={log.id || idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '8px 4px', color: '#94A3B8', fontFamily: 'monospace' }}>
                          {dateFormatted}
                        </td>
                        <td style={{ padding: '8px 4px', color: '#FFFFFF', fontWeight: 600 }}>
                          {log.driver_name || 'Motorista'}
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                          <span style={{
                            background: 'rgba(0, 212, 255, 0.12)',
                            color: '#00D4FF',
                            border: '1px solid rgba(0, 212, 255, 0.3)',
                            borderRadius: '6px',
                            padding: '2px 6px',
                            fontSize: '10px',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                          }}>
                            {log.truck_plate || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', color: '#10B981', fontWeight: 800, fontFamily: 'monospace' }}>
                          {log.level_after != null ? `${parseFloat(log.level_after).toFixed(1)} L` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
