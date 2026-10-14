import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useFleet } from '../hooks/useFleet';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { RefreshCw, MapPin, Users, Gauge, Droplets, Truck, PlusCircle, Search, Navigation } from 'lucide-react';
import MapView from '../components/MapView';
import RouteModal from '../components/RouteModal';
import NewTruckModal from '../components/NewTruckModal';
import useFleetState from '../store/useFleetState';

const glass = {
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '16px',
};

const STATUS_META = {
  critical_fuel: { label: 'Sem Autonomia', color: '#f87171', glow: 'rgba(248, 113, 113, 0.15)' },
  ok: { label: 'Operacional', color: '#10b981', glow: 'rgba(16, 185, 129, 0.15)' },
  low_fuel: { label: 'Comb. Baixo', color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.15)' },
  no_signal: { label: 'Sem Sinal', color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.15)' },
  security_alert: { label: 'Alerta Segurança', color: '#fb7185', glow: 'rgba(251, 113, 133, 0.18)' },
  arrived: { label: 'No Destino', color: '#4F8EF7', glow: 'rgba(79, 142, 247, 0.18)' },
};

export default function FleetPage() {
  const { trucks, loading, error, refetch, createTruck } = useFleet();
  const fetchTruckRoute = useFleetState(state => state.fetchTruckRoute);
  const cancelTruckRoute = useFleetState(state => state.cancelTruckRoute);
  const [routeTruckId, setRouteTruckId] = useState(null);
  const [isNewTruckModalOpen, setIsNewTruckModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  if (loading && trucks.length === 0) return <LoadingSpinner />;
  if (error && trucks.length === 0) return <ErrorMessage message={error} />;

  const handleCancelRoute = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontWeight: 600, color: '#333' }}>Cancelar esta viagem?</span>
        <span style={{ fontSize: '13px', color: '#666' }}>O caminhão retornará para a base imediatamente.</span>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            style={{ flex: 1, padding: '8px', background: '#f87171', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
            onClick={async () => {
              toast.dismiss(t.id);
              const result = await cancelTruckRoute(id);
              if (result.ok) {
                toast.success('Viagem cancelada com sucesso!');
              } else {
                toast.error('Não foi possível cancelar a rota.');
              }
            }}
          >Sim, cancelar</button>
          <button
            style={{ flex: 1, padding: '8px', background: '#e2e8f0', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
            onClick={() => toast.dismiss(t.id)}
          >Não</button>
        </div>
      </div>
    ), { duration: 8000 });
  };

  const pct = t => t.capacity_liters > 0 ? Math.round((t.current_level_liters / t.capacity_liters) * 100) : 0;

  const counts = {
    total: trucks.length,
    ok: trucks.filter(t => t.status === 'ok').length,
    enRoute: trucks.filter(t => parseFloat(t.speed_kmh) > 0).length,
    low: trucks.filter(t => t.status === 'low_fuel' || t.status === 'critical_fuel').length,
  };

  const filteredTrucks = trucks.filter(t => {
    const matchSearch =
      t.plate?.toLowerCase().includes(search.toLowerCase()) ||
      t.model?.toLowerCase().includes(search.toLowerCase()) ||
      t.current_drivers?.some(d => d.name?.toLowerCase().includes(search.toLowerCase()));

    if (!matchSearch) return false;
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'EN_ROUTE') return parseFloat(t.speed_kmh) > 0;
    if (statusFilter === 'LOW_FUEL') return t.status === 'low_fuel' || t.status === 'critical_fuel';
    if (statusFilter === 'OK') return t.status === 'ok';
    return t.status === statusFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
      {/* ── Page Header ── */}
      <div style={{
        ...glass,
        padding: '24px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(7, 16, 27, 0.95) 0%, rgba(15, 27, 44, 0.95) 100%)',
        border: '1px solid rgba(0, 196, 208, 0.2)',
      }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '26px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
            <Truck size={28} color="#00C4D0" /> Gestão da Frota
          </h1>
          <p style={{ color: '#8899A6', fontSize: '13px', marginTop: '6px', margin: '6px 0 0' }}>
            Monitoramento em tempo real de {counts.total} veículos cadastrados.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => setIsNewTruckModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
              borderRadius: '10px', fontSize: '13px', fontWeight: 700,
              border: 'none', background: 'linear-gradient(135deg, #00C4D0, #0284C7)',
              color: '#FFFFFF', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0, 196, 208, 0.3)',
            }}
          >
            <PlusCircle size={16} /> Cadastrar Caminhão
          </button>
          <button
            onClick={refetch}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
              borderRadius: '10px', fontSize: '13px', fontWeight: 600,
              border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(255, 255, 255, 0.05)',
              color: '#94A3B8', cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: 'Total de Veículos', val: counts.total, sub: 'frota cadastrada', color: '#00C4D0' },
          { label: 'Veículos Operacionais', val: counts.ok, sub: 'sem anomalias', color: '#10B981' },
          { label: 'Em Deslocamento', val: counts.enRoute, sub: 'velocidade > 0 km/h', color: '#38BDF8' },
          { label: 'Tanques em Alerta', val: counts.low, sub: 'nível abaixo do limite', color: '#F59E0B' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            ...glass,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            background: 'rgba(11, 20, 32, 0.65)',
          }}>
            <span style={{ fontSize: '11px', color: '#8899A6', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px' }}>
              {kpi.label}
            </span>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#FFFFFF', marginTop: '2px' }}>
              {kpi.val}
            </div>
            <span style={{ fontSize: '11px', color: kpi.color, fontWeight: 600 }}>
              {kpi.sub}
            </span>
          </div>
        ))}
      </div>

      {/* ── Search & Filter Bar ── */}
      <div style={{
        ...glass,
        padding: '14px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'rgba(11, 20, 32, 0.65)',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input
            type="text"
            placeholder="Buscar por placa, modelo ou motorista..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '9px 14px 9px 38px',
              color: '#FFFFFF',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'OK', label: 'Operacionais' },
            { id: 'EN_ROUTE', label: 'Em Rota' },
            { id: 'LOW_FUEL', label: 'Comb. Baixo' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                border: statusFilter === f.id ? '1px solid rgba(0, 196, 208, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                background: statusFilter === f.id ? 'rgba(0, 196, 208, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: statusFilter === f.id ? '#00C4D0' : '#8899A6',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Layout: Split Cards & Map ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(420px, 1fr) 1.2fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Truck List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredTrucks.length === 0 ? (
            <div style={{
              ...glass,
              padding: '60px 20px',
              textAlign: 'center',
              color: '#64748B',
            }}>
              <Truck size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#E2E8F0' }}>Nenhum veículo encontrado</div>
              <div style={{ fontSize: '13px', marginTop: '6px' }}>Tente alterar os filtros de busca.</div>
            </div>
          ) : (
            filteredTrucks.map(truck => {
              const levelPct = pct(truck);
              const levelColor = levelPct < 20 ? '#f87171' : levelPct < 50 ? '#fbbf24' : '#10b981';
              const s = STATUS_META[truck.status] || STATUS_META.ok;
              const drivers = truck.current_drivers?.length > 0
                ? truck.current_drivers.map(d => d.name).join(', ')
                : 'Sem motorista vinculado';

              return (
                <div
                  key={truck.id}
                  style={{
                    ...glass,
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    background: 'rgba(11, 20, 32, 0.8)',
                    transition: 'border-color 0.2s',
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 900, color: '#FFFFFF', letterSpacing: '1px' }}>
                          {truck.plate}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '12px',
                          background: s.glow,
                          color: s.color,
                          border: `1px solid ${s.color}33`,
                        }}>
                          {s.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#8899A6', marginTop: '3px', fontWeight: 500 }}>
                        {truck.model}
                      </div>
                    </div>

                    {/* Speed indicator */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: parseFloat(truck.speed_kmh) > 0 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}>
                      <Gauge size={13} color={parseFloat(truck.speed_kmh) > 0 ? '#38BDF8' : '#8899A6'} />
                      <span style={{ fontSize: '12px', fontWeight: 800, color: parseFloat(truck.speed_kmh) > 0 ? '#38BDF8' : '#8899A6' }}>
                        {truck.speed_kmh} km/h
                      </span>
                    </div>
                  </div>

                  {/* Fuel Progress Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8899A6', fontWeight: 500 }}>
                        <Droplets size={12} color="#00C4D0" /> Nível do Tanque
                      </span>
                      <span style={{ fontWeight: 800, color: levelColor }}>
                        {levelPct}% ({truck.current_level_liters} L / {truck.capacity_liters} L)
                      </span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.07)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${levelPct}%`,
                        height: '100%',
                        background: levelColor,
                        borderRadius: '3px',
                        transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>

                  {/* Driver & Telemetry Info */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    fontSize: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#CBD5E1' }}>
                      <Users size={13} color="#00C4D0" />
                      <span>{drivers}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8899A6' }}>
                      <MapPin size={12} />
                      <span>{parseFloat(truck.lat || 0).toFixed(4)}, {parseFloat(truck.lng || 0).toFixed(4)}</span>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', paddingTop: '6px' }}>
                    <Link
                      to={`/fleet/${truck.id}`}
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#00C4D0',
                        textDecoration: 'none',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: 'rgba(0, 196, 208, 0.08)',
                        border: '1px solid rgba(0, 196, 208, 0.2)',
                      }}
                    >
                      Ver Detalhes do Veículo →
                    </Link>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(truck.sim_state === 'driving' || truck.route_phase !== 'arrived') && (
                        <button
                          type="button"
                          onClick={e => handleCancelRoute(e, truck.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(248, 113, 113, 0.4)',
                            background: 'rgba(248, 113, 113, 0.1)',
                            color: '#F87171',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          Cancelar Rota
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          setRouteTruckId(truck.id);
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #00C4D0, #0284C7)',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        Definir Viagem
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Fleet Realtime Map */}
        <div style={{
          ...glass,
          height: '700px',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: '20px',
          background: 'rgba(11, 20, 32, 0.85)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF' }}>Mapa em Tempo Real</div>
              <div style={{ fontSize: '11px', color: '#8899A6', marginTop: '2px' }}>Geolocalização via satélite dos veículos</div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '3px', background: '#10B981' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#10B981' }}>Live GPS</span>
            </div>
          </div>

          <div style={{ flex: 1, position: 'relative' }}>
            <MapView trucks={filteredTrucks} />
          </div>
        </div>
      </div>

      <RouteModal
        isOpen={Boolean(routeTruckId)}
        truckId={routeTruckId}
        onClose={() => setRouteTruckId(null)}
        onConfigured={id => {
          refetch();
          fetchTruckRoute(id);
        }}
      />
      <NewTruckModal
        isOpen={isNewTruckModalOpen}
        onClose={() => setIsNewTruckModalOpen(false)}
        onSave={createTruck}
      />
    </div>
  );
}
