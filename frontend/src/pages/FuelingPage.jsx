import React, { useState, useEffect } from 'react';
import { useFueling } from '../hooks/useFueling';
import { useFleet } from '../hooks/useFleet';
import { useDrivers } from '../hooks/useDrivers';
import FuelingTable from '../components/FuelingTable';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Fuel,
  Filter,
  RotateCcw,
  ShieldCheck,
  LockKeyhole,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Truck,
  Droplets,
  Calendar,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';

const glass = {
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '16px',
};

const inputStyle = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.09)',
  color: '#FFFFFF',
  padding: '9px 12px',
  borderRadius: '10px',
  fontSize: '13px',
  outline: 'none',
  fontFamily: 'inherit',
};

export default function FuelingPage() {
  const [filters, setFilters] = useState({
    truckId: '',
    driverId: '',
    start: '',
    end: '',
    dataSource: '',
    onlyDivergence: false,
  });

  const {
    logs,
    loading,
    refetch,
    requestSession,
    authorizeSession,
    finishSession,
    getActiveSession,
  } = useFueling();
  const { trucks, refetch: fetchFleet } = useFleet();
  const { drivers } = useDrivers();

  const [truckId, setTruckId] = useState('');
  useEffect(() => {
    const awaiting = trucks.find(t => t.route_phase === 'awaiting_fueling_authorization');
    if (awaiting && !truckId) setTruckId(String(awaiting.id));
  }, [trucks, truckId]);

  const [session, setSession] = useState(null);
  const [sessionBusy, setSessionBusy] = useState(false);

  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);

  // When truck is selected, check for active session
  useEffect(() => {
    if (!truckId) {
      setSession(null);
      return;
    }
    let active = true;
    getActiveSession(truckId).then(sess => {
      if (active) setSession(sess);
    });
    return () => {
      active = false;
    };
  }, [truckId, getActiveSession]);

  const activeTruck = trucks.find(t => t.id === parseInt(truckId));

  const startSession = async () => {
    if (!truckId) return toast.error('Selecione um caminhão');
    setSessionBusy(true);
    try {
      const driver = activeTruck?.current_drivers?.[0];
      const newSession = await requestSession(
        truckId,
        driver?.id || null,
        activeTruck?.fuel_station_id,
        'facial'
      );

      if (activeTruck?.station_name) {
        newSession.station_name = activeTruck.station_name;
      }

      setSession(newSession);
      toast.success('Sessão de abastecimento iniciada.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não foi possível solicitar a sessão.');
    } finally {
      setSessionBusy(false);
    }
  };

  const authorize = async () => {
    if (!session?.id) return;
    setSessionBusy(true);
    try {
      const updated = await authorizeSession(session.id);
      setSession({ ...session, ...updated, status: 'authorized' });
      toast.success('Trava autorizada com sucesso.');
    } catch (err) {
      toast.error('Falha ao autorizar trava.');
    } finally {
      setSessionBusy(false);
    }
  };

  const finish = async () => {
    if (!session?.id) return;
    setSessionBusy(true);
    try {
      await finishSession(session.id);
      setSession(null);
      await refetch(filters);
      toast.success('Abastecimento encerrado e registrado no log.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Falha ao encerrar.');
    } finally {
      setSessionBusy(false);
    }
  };

  const handleApplyFilters = () => {
    refetch(filters);
  };

  const handleClearFilters = () => {
    const empty = {
      truckId: '',
      driverId: '',
      start: '',
      end: '',
      dataSource: '',
      onlyDivergence: false,
    };
    setFilters(empty);
    refetch(empty);
  };

  const isAwaitingAuth = activeTruck?.route_phase === 'awaiting_fueling_authorization';

  // KPI calculations
  const totalVolume = logs.reduce((acc, l) => acc + (parseFloat(l.tank_liters_delta || l.pump_liters || 0) || 0), 0);
  const divergenceLogs = logs.filter(l => l.divergence_pct && Math.abs(parseFloat(l.divergence_pct)) > 5);
  const hardwareLogs = logs.filter(l => l.data_source === 'hardware');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
      {/* ── Page Header ── */}
      <div
        style={{
          ...glass,
          padding: '24px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(7, 16, 27, 0.95) 0%, rgba(15, 27, 44, 0.95) 100%)',
          border: '1px solid rgba(0, 196, 208, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'rgba(0, 196, 208, 0.1)',
              border: '1px solid rgba(0, 196, 208, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Fuel size={26} color="#00C4D0" />
          </div>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
              Sessão e Auditoria de Abastecimento
            </h1>
            <p style={{ margin: '4px 0 0', color: '#8899A6', fontSize: '13px' }}>
              Controle de destravamento de bocal, reconciliação volumétrica e auditoria ANP.
            </p>
          </div>
        </div>

        <button
          onClick={() => refetch(filters)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.05)',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={15} /> Sincronizar Logs
        </button>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          {
            label: 'Total Reconciliado',
            val: `${Math.round(totalVolume).toLocaleString('pt-BR')} L`,
            sub: `${logs.length} abastecimentos registrados`,
            color: '#00C4D0',
            icon: Droplets,
            isCritical: false,
          },
          {
            label: 'Origem IoT / Hardware',
            val: `${hardwareLogs.length}`,
            sub: 'telemetria de alta precisão',
            color: '#10B981',
            icon: Radio,
            isCritical: false,
          },
          {
            label: 'Divergências Críticas',
            val: `${divergenceLogs.length}`,
            sub: '> 5% desvio bomba vs tanque',
            color: divergenceLogs.length > 0 ? '#EF4444' : '#10B981',
            icon: AlertTriangle,
            isCritical: divergenceLogs.length > 0,
          },
          {
            label: 'Sessão em Andamento',
            val: session ? (session.status === 'requested' ? 'Aguardando' : 'Ativa') : 'Disponível',
            sub: activeTruck ? `Veículo ${activeTruck.plate}` : 'Nenhum veículo selecionado',
            color: session ? '#38BDF8' : '#8899A6',
            icon: LockKeyhole,
            isCritical: false,
          },
        ].map(kpi => (
          <div
            key={kpi.label}
            style={{
              ...glass,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              background: kpi.isCritical ? 'rgba(239, 68, 68, 0.09)' : 'rgba(11, 20, 32, 0.65)',
              border: kpi.isCritical ? '1.5px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: kpi.isCritical ? '0 0 16px rgba(239, 68, 68, 0.25)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: kpi.isCritical ? '#FCA5A5' : '#8899A6', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px' }}>
                {kpi.label}
              </span>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: kpi.isCritical ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <kpi.icon size={16} color={kpi.color} />
              </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#FFFFFF', marginTop: '2px', fontFamily: 'var(--font-mono, monospace)' }}>
              {kpi.val}
            </div>
            <span style={{ fontSize: '11px', color: kpi.color, fontWeight: 600 }}>
              {kpi.sub}
            </span>
          </div>
        ))}
      </div>

      {/* ── Console de Liberação de Trava (Session Control Panel) ── */}
      <div
        style={{
          ...glass,
          padding: '24px 28px',
          background: 'rgba(11, 20, 32, 0.8)',
          border: '1px solid rgba(0, 196, 208, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: session ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0, 196, 208, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LockKeyhole size={18} color={session ? '#38BDF8' : '#00C4D0'} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                Centro de Autorização e Destravamento de Tanque
              </div>
              <div style={{ fontSize: '12px', color: '#8899A6' }}>
                Libere o bocal de abastecimento para caminhões autorizados em postos homologados.
              </div>
            </div>
          </div>

          {/* Truck Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '320px' }}>
            <label style={{ fontSize: '12px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase' }}>
              Veículo:
            </label>
            <select
              value={truckId}
              onChange={e => setTruckId(e.target.value)}
              style={{
                ...inputStyle,
                flex: 1,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <option value="">Selecione um caminhão...</option>
              {trucks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.plate} • {t.model} {t.route_phase === 'awaiting_fueling_authorization' ? ' (⚡ AGUARDANDO LIBERAÇÃO)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic State Card */}
        {!session && !truckId && (
          <div
            style={{
              padding: '24px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              color: '#64748B',
              fontSize: '13px',
            }}
          >
            <Truck size={18} style={{ opacity: 0.5 }} />
            Selecione um veículo no seletor acima para verificar o status de abastecimento ou forçar liberação de trava.
          </div>
        )}

        {!session && truckId && (
          <div
            style={{
              padding: '20px 24px',
              borderRadius: '14px',
              background: isAwaitingAuth ? 'rgba(0, 196, 208, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: isAwaitingAuth ? '1px solid rgba(0, 196, 208, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: isAwaitingAuth ? 'rgba(0, 196, 208, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                    color: isAwaitingAuth ? '#00C4D0' : '#94A3B8',
                    textTransform: 'uppercase',
                  }}
                >
                  {isAwaitingAuth ? 'Parada Detectada' : 'Sem Parada em Posto'}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
                  {activeTruck?.plate} — {activeTruck?.model}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#94A3B8' }}>
                {isAwaitingAuth ? (
                  <>
                    Caminhão no posto <strong style={{ color: '#FFFFFF' }}>{activeTruck.station_name || 'Autorizado'}</strong> aguardando confirmação do gestor para destrava do bocal.
                  </>
                ) : (
                  <>
                    Veículo em rota normal. É possível iniciar uma sessão avulsa em modo de contingência.
                  </>
                )}
              </div>
            </div>

            <button
              onClick={startSession}
              disabled={sessionBusy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 22px',
                borderRadius: '10px',
                border: 'none',
                cursor: sessionBusy ? 'not-allowed' : 'pointer',
                background: isAwaitingAuth
                  ? 'linear-gradient(135deg, #00C4D0, #0284C7)'
                  : 'rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '13px',
                boxShadow: isAwaitingAuth ? '0 4px 14px rgba(0, 196, 208, 0.3)' : 'none',
              }}
            >
              <ShieldCheck size={16} />
              {isAwaitingAuth ? 'Iniciar Sessão de Autorização' : 'Forçar Sessão Avulsa'}
            </button>
          </div>
        )}

        {session && (
          <div
            style={{
              padding: '20px 24px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(7, 24, 40, 0.9) 0%, rgba(13, 34, 56, 0.9) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38BDF8', boxShadow: '0 0 10px #38BDF8' }} />
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Sessão Ativa: {session.id}
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: session.status === 'requested' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: session.status === 'requested' ? '#F59E0B' : '#10B981',
                  border: session.status === 'requested' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                  textTransform: 'uppercase',
                }}
              >
                Status: {session.status}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#8899A6', textTransform: 'uppercase' }}>Motorista</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', marginTop: '4px' }}>
                  {session.driver_name || activeTruck?.current_drivers?.[0]?.name || 'Não identificado'}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#8899A6', textTransform: 'uppercase' }}>Posto</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', marginTop: '4px' }}>
                  {session.station_name || activeTruck?.station_name || 'Desconhecido'}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#8899A6', textTransform: 'uppercase' }}>Método</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', marginTop: '4px' }}>
                  {session.release_method === 'facial' ? 'Reconhecimento Facial' : 'BLE Fallback'}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#8899A6', textTransform: 'uppercase' }}>Veículo</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', marginTop: '4px', fontFamily: 'var(--font-mono, monospace)' }}>
                  {activeTruck?.plate || '—'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
              {session.status === 'requested' && (
                <button
                  onClick={authorize}
                  disabled={sessionBusy}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '11px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: sessionBusy ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, #00C4D0, #0284C7)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '13px',
                    boxShadow: '0 4px 14px rgba(0, 196, 208, 0.3)',
                  }}
                >
                  <LockKeyhole size={16} /> Autorizar Destravamento
                </button>
              )}

              {(session.status === 'authorized' || session.status === 'active') && (
                <button
                  onClick={finish}
                  disabled={sessionBusy}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '11px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: sessionBusy ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '13px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <CheckCircle2 size={16} /> Encerrar Abastecimento
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Seção de Histórico e Filtros (Full Width) ── */}
      <div
        style={{
          ...glass,
          padding: '24px 28px',
          background: 'rgba(11, 20, 32, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={18} color="#00C4D0" /> Filtros e Auditoria de Registros
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#8899A6' }}>
              Filtre o log por caminhão, condutor, canal de telemetria ou período de auditoria.
            </p>
          </div>
        </div>

        {/* Filters Toolbar (Grid Horizontal Compacto) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(140px, 1.2fr) minmax(140px, 1.2fr) minmax(130px, 1fr) minmax(130px, 1fr) minmax(130px, 1fr) auto auto auto',
            gap: '12px',
            alignItems: 'end',
            padding: '16px 20px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#8899A6', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
              Caminhão
            </label>
            <select
              value={filters.truckId}
              onChange={e => setFilters({ ...filters, truckId: e.target.value })}
              style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
            >
              <option value="">Todos os Caminhões</option>
              {trucks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.plate} - {t.model}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#8899A6', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
              Motorista
            </label>
            <select
              value={filters.driverId}
              onChange={e => setFilters({ ...filters, driverId: e.target.value })}
              style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
            >
              <option value="">Todos os Condutores</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#8899A6', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
              Origem dos Dados
            </label>
            <select
              value={filters.dataSource || ''}
              onChange={e => setFilters({ ...filters, dataSource: e.target.value })}
              style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
            >
              <option value="">Todas as Origens</option>
              <option value="hardware">Hardware IoT</option>
              <option value="manager">Gestor Manual</option>
              <option value="unverified">Não Verificado</option>
              <option value="legacy">Histórico Legado</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#8899A6', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
              Data Inicial
            </label>
            <input
              type="date"
              value={filters.start}
              onChange={e => setFilters({ ...filters, start: e.target.value })}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#8899A6', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
              Data Final
            </label>
            <input
              type="date"
              value={filters.end}
              onChange={e => setFilters({ ...filters, end: e.target.value })}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', height: '40px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#FFFFFF', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={filters.onlyDivergence || false}
                onChange={e => setFilters({ ...filters, onlyDivergence: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#00C4D0', cursor: 'pointer' }}
              />
              Com Divergência
            </label>
          </div>

          <button
            onClick={handleApplyFilters}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #00C4D0, #0284C7)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              height: '40px',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0, 196, 208, 0.25)',
            }}
          >
            <Filter size={14} /> Filtrar
          </button>

          <button
            onClick={handleClearFilters}
            title="Limpar filtros"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#94A3B8',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={15} />
          </button>
        </div>

        {/* Table Content */}
        {loading ? (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LoadingSpinner />
          </div>
        ) : (
          <FuelingTable logs={logs} />
        )}
      </div>
    </div>
  );
}
