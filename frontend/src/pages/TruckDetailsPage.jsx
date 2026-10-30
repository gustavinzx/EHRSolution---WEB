import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useFleet } from '../hooks/useFleet';
import LoadingSpinner from '../components/LoadingSpinner';
import RouteModal from '../components/RouteModal';
import { renderAnpMatchCell } from '../components/FuelingTable';
import { getMapboxToken } from '../utils/mapboxToken';
import { MapContainer, TileLayer, Polyline, Popup, useMap } from 'react-leaflet';

function CenterOnTruck({ lat, lng }) {
  const map = useMap();
  const hasCentered = React.useRef(false);
  React.useEffect(() => {
    if(lat && lng && !hasCentered.current) { 
      hasCentered.current = true;
      map.setView([parseFloat(lat), parseFloat(lng)], 15, { animate: true }); 
      setTimeout(() => map.invalidateSize(), 200); 
    }
  }, [lat, lng, map]);
  return null;
}
import LiveTruckMarker from '../components/LiveTruckMarker';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ArrowLeft, MapPin, Gauge, Droplets, Users, Navigation, Map, ShieldAlert, LockKeyhole, Key, Copy, Check, Radio } from 'lucide-react';

const glass = {
  background: 'rgba(11, 22, 40, 0.75)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(0, 212, 255, 0.14)',
  borderRadius: '16px',
  overflow: 'hidden',
};

const STATUS_META = {
  critical_fuel: { label: 'Sem autonomia — abastecer', color: '#f87171', glow: 'rgba(248,113,113,0.15)' },
  ok:        { label: 'OK',         color: '#00F5A0', glow: 'rgba(0,245,160,0.15)' },
  low_fuel:  { label: 'Comb. Baixo',color: '#fbbf24', glow: 'rgba(251,191,36,0.15)' },
  no_signal: { label: 'Sem Sinal',  color: '#94a3b8', glow: 'rgba(148,163,184,0.15)' },
  security_alert: { label: 'Alerta de segurança', color: '#fb7185', glow: 'rgba(251,113,133,0.18)' },
  arrived: { label: 'Chegou ao destino', color: '#00D4FF', glow: 'rgba(0,212,255,0.18)' },
};

import useFleetState from '../store/useFleetState';
import client from '../api/client';
import ErrorMessage from '../components/ErrorMessage';

function getPanelApiBaseUrl() {
  const base = String(client?.defaults?.baseURL || '/api').replace(/\/+$/, '');
  if (/^https?:\/\//i.test(base)) return base;
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  return `${origin}${base.startsWith('/') ? '' : '/'}${base}`;
}

function HardwareKeyModal({ generatedData, truckId, truckPlate, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  if (!generatedData || !generatedData.api_key) return null;

  const rawKey = generatedData.api_key;
  const apiBaseUrl = getPanelApiBaseUrl();
  const psCommand = `$h = @{ "x-api-key" = "${rawKey}" }\nInvoke-RestMethod -Uri "${apiBaseUrl}/fueling/sessions/${truckId}/active" -Headers $h`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hw-key-modal-title"
        data-testid="hardware-key-modal"
        style={{
          background: 'rgba(11, 22, 40, 0.98)',
          border: '1px solid rgba(0, 212, 255, 0.4)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '540px',
          padding: '28px',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 212, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#00D4FF', fontWeight: 800, fontSize: '18px' }}>
          <Key size={22} color="#00D4FF" />
          <span id="hw-key-modal-title">Nova Chave do Hardware Gerada</span>
        </div>

        <div
          data-testid="hardware-key-modal-truck-id"
          style={{
            fontSize: '13px',
            color: '#cbd5e1',
            fontFamily: "'IBM Plex Mono', monospace",
            userSelect: 'text',
          }}
        >
          {`ID do caminhão: ${truckId}${truckPlate ? ` • Placa: ${truckPlate}` : ''}`}
        </div>

        <p style={{ margin: 0, fontSize: '14px', color: '#fbbf24', fontWeight: 600 }}>
          Guarde agora; ela não será exibida de novo
        </p>

        <div
          data-testid="hardware-key-secret-value"
          style={{
            background: 'rgba(6, 11, 19, 0.8)',
            padding: '12px 14px',
            borderRadius: '10px',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '14px',
            color: '#00D4FF',
            wordBreak: 'break-all',
            border: '1px solid rgba(0, 212, 255, 0.35)',
            boxShadow: 'inset 0 0 10px rgba(0, 212, 255, 0.1)',
            userSelect: 'text',
          }}
        >
          {rawKey}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
            Exemplo para testar no PowerShell:
          </span>
          <pre
            data-testid="hardware-key-ps-command"
            style={{
              margin: 0,
              background: 'rgba(6, 11, 19, 0.8)',
              padding: '12px 14px',
              borderRadius: '10px',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '12px',
              color: '#e2e8f0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              userSelect: 'text',
            }}
          >
            {psCommand}
          </pre>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '6px' }}>
          <button
            type="button"
            onClick={() => {
              if (navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(rawKey);
              }
              setCopied(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: copied ? '#00F5A0' : 'linear-gradient(135deg, #00D4FF, #0072FF)',
              color: copied ? '#060B13' : '#FFFFFF',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 0 16px rgba(0, 212, 255, 0.3)',
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(psCommand);
              }
              setCopiedCmd(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(0, 212, 255, 0.4)',
              background: 'rgba(0, 212, 255, 0.12)',
              color: '#00D4FF',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {copiedCmd ? <Check size={15} /> : <Copy size={15} />}
            {copiedCmd ? 'Comando copiado!' : 'Copiar comando'}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TruckDetailsPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    fetchTruckDetails,
    getHardwareKeyStatus,
    generateHardwareKey,
    revokeHardwareKey,
    error,
  } = useFleet();
  const [truckDetails, setTruckDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [hwKeyStatus, setHwKeyStatus] = useState(null);
  const [hwKeyLoading, setHwKeyLoading] = useState(false);
  const [hwKeyError, setHwKeyError] = useState(null);
  const [hwKeyRefreshError, setHwKeyRefreshError] = useState(null);
  const [hwKeyBusy, setHwKeyBusy] = useState(false);
  const [generatedKeyModalData, setGeneratedKeyModalData] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const hwKeyStatusRef = React.useRef(null);
  useEffect(() => {
    hwKeyStatusRef.current = hwKeyStatus;
  }, [hwKeyStatus]);

  const { fleet, truckRoutes, fetchTruckRoute, cancelTruckRoute } = useFleetState();

  const loadHardwareKeyStatus = React.useCallback(async (isRefresh = false) => {
    if (user?.role === 'auditor' || !getHardwareKeyStatus) return;
    const hasExistingStatus = hwKeyStatusRef.current !== null;
    if (!isRefresh && !hasExistingStatus) {
      setHwKeyLoading(true);
      setHwKeyError(null);
    }
    setHwKeyRefreshError(null);
    try {
      const statusData = await getHardwareKeyStatus(id);
      setHwKeyStatus(statusData);
      setHwKeyError(null);
      setHwKeyRefreshError(null);
    } catch {
      if (hasExistingStatus) {
        setHwKeyRefreshError('Não foi possível atualizar o status da chave.');
      } else {
        setHwKeyError('Não foi possível carregar o status da chave.');
      }
    } finally {
      setHwKeyLoading(false);
    }
  }, [id, user?.role, getHardwareKeyStatus]);

  const loadData = React.useCallback(() => {
    setLoading(true);
    setLocalError(null);
    Promise.resolve(fetchTruckDetails(id))
      .then((data) => {
        if (data) {
          setTruckDetails(data);
          setLocalError(null);
        } else {
          setLocalError({
            type: 'not_found',
            title: 'Caminhão não encontrado',
            message: 'Nenhum caminhão com esse ID. Volte para a Frota e escolha um da lista.',
          });
        }
      })
      .catch((err) => {
        const status = err?.response?.status ?? err?.status;
        if (status === 404) {
          setLocalError({
            type: 'not_found',
            title: 'Caminhão não encontrado',
            message: 'Nenhum caminhão com esse ID. Volte para a Frota e escolha um da lista.',
          });
        } else if (!err?.response && !err?.status) {
          setLocalError({
            type: 'network',
            title: 'Erro de Conexão',
            message: 'Não foi possível carregar os dados. Tente novamente mais tarde.',
          });
        } else {
          setLocalError({
            type: 'other',
            title: 'Erro ao carregar caminhão',
            message: 'Não foi possível carregar o caminhão.',
          });
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, fetchTruckDetails]);

  useEffect(() => {
    loadData();
    loadHardwareKeyStatus(false);
  }, [id, loadData, loadHardwareKeyStatus]);

  useEffect(() => {
    if (user?.role === 'auditor' || !getHardwareKeyStatus) return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadHardwareKeyStatus(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = setInterval(() => {
      loadHardwareKeyStatus(true);
    }, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [user?.role, getHardwareKeyStatus, loadHardwareKeyStatus]);

  const executeGenerateKey = async () => {
    setHwKeyBusy(true);
    setConfirmAction(null);
    try {
      const created = await generateHardwareKey(id);
      setGeneratedKeyModalData(created);
      setHwKeyStatus({
        configured: true,
        prefix: created.prefix,
        created_at: created.created_at,
        last_used_at: null,
      });
      setHwKeyError(null);
    } catch {
      toast.error('Erro ao gerar chave do hardware.');
    } finally {
      setHwKeyBusy(false);
    }
  };

  const executeRevokeKey = async () => {
    setHwKeyBusy(true);
    setConfirmAction(null);
    try {
      await revokeHardwareKey(id);
      setHwKeyStatus({
        configured: false,
        prefix: null,
        created_at: null,
        last_used_at: null,
      });
      setHwKeyError(null);
      toast.success('Chave do hardware revogada.');
    } catch {
      toast.error('Erro ao revogar chave do hardware.');
    } finally {
      setHwKeyBusy(false);
    }
  };

  const liveTruck = fleet.find(t => t.id === Number(id));
  const truck = liveTruck && truckDetails ? { ...truckDetails, ...liveTruck } : truckDetails;

  if (loading && !truck) return <LoadingSpinner />;
  if (localError) {
    return (
      <ErrorMessage title={localError.title} message={localError.message}>
        {localError.type === 'not_found' && (
          <button
            type="button"
            onClick={() => navigate('/fleet')}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(0, 212, 255, 0.4)',
              background: 'rgba(0, 212, 255, 0.12)',
              color: '#00D4FF',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Voltar para a Frota
          </button>
        )}
        {localError.type === 'other' && (
          <button
            type="button"
            onClick={loadData}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        )}
      </ErrorMessage>
    );
  }
  if (error) return <ErrorMessage message={error} />;

  const handleCancelRoute = () => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontWeight: 600, color: '#333' }}>Cancelar esta viagem?</span>
        <span style={{ fontSize: '13px', color: '#666' }}>O caminhão retornará para a base imediatamente.</span>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            style={{ flex: 1, padding: '8px', background: '#f87171', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
            onClick={async () => {
              toast.dismiss(t.id);
              const result = await cancelTruckRoute(truck.id);
              if (result.ok) {
                toast.success('Viagem cancelada — caminhão retornando à base!', { duration: 3000 });
              } else {
                toast.error('Não foi possível cancelar. Tente novamente.', { duration: 4000 });
              }
            }}
          >Sim, cancelar</button>
          <button
            style={{ flex: 1, padding: '8px', background: '#e2e8f0', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
            onClick={() => toast.dismiss(t.id)}
          >Não</button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  if (!truck) return <div style={{ color: '#fff', padding: '40px' }}>Caminhão não encontrado.</div>;

  const s = STATUS_META[truck.status] || STATUS_META.ok;
  const pct = truck.capacity_liters > 0 ? Math.round((truck.current_level_liters / truck.capacity_liters) * 100) : 0;
  const levelColor = pct < 20 ? '#f87171' : pct < 50 ? '#fbbf24' : '#00F5A0';
  const drivers = truck.current_drivers?.length > 0 ? truck.current_drivers.map(d => d.name).join(', ') : 'Sem motorista';

  const routePoints = [];
  let currentPos = null;
  const isArrived = truck.status === 'arrived' || truck.sim_state === 'arrived' || truck.route_phase === 'arrived' || truck.sim_state === 'idle';
  
  const routeGeometry = truckRoutes[truck.id] ?? truck.route_geometry;
  if (routeGeometry && !isArrived) {
    try {
      const geo = typeof routeGeometry === 'string' ? JSON.parse(routeGeometry) : routeGeometry;
      if (Array.isArray(geo)) {
        geo.forEach(p => {
          if (Array.isArray(p) && p.length >= 2) routePoints.push([p[1], p[0]]);
        });
      }
    } catch (e) {
      console.error('Failed to parse route_geometry', e);
    }
  }

  if (routePoints.length > 0) {
    currentPos = [parseFloat(truck.lat), parseFloat(truck.lng)];
  }

  const safeLat = parseFloat(truck.lat);
  const safeLng = parseFloat(truck.lng);
  if (!currentPos && Number.isFinite(safeLat) && Number.isFinite(safeLng)) {
    currentPos = [safeLat, safeLng];
    if (routePoints.length === 0) routePoints.push(currentPos);
  }

  const fuelingLogs = Array.isArray(truck.recent_fueling_logs) ? truck.recent_fueling_logs.map(log => ({ ...log, type: 'fueling' })) : (Array.isArray(truck.recent_fueling) ? truck.recent_fueling.map(log => ({ ...log, type: 'fueling' })) : []);
  const unloadingEvents = Array.isArray(truck.unloading_events) ? truck.unloading_events.map(ev => ({ ...ev, type: 'unloading' })) : [];
  
  const timelineEvents = [...fuelingLogs, ...unloadingEvents].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const rawTelemetry = Array.isArray(truck.telemetry) ? truck.telemetry : [];
  const chartData = rawTelemetry.map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    combustivel: Number(r.fuel_level_liters) || 0,
    velocidade: Number(r.speed_kmh) || 0
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div>
        <Link
          to="/fleet"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#8899A6',
            textDecoration: 'none',
            fontSize: '13px',
            marginBottom: '14px',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#00D4FF'}
          onMouseLeave={e => e.currentTarget.style.color = '#8899A6'}
        >
          <ArrowLeft size={14} /> Voltar para Frota
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Cyber Mercosul Plate Display */}
            <div style={{
              display: 'inline-flex',
              flexDirection: 'column',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '2px solid #00D4FF',
              boxShadow: '0 0 20px rgba(0, 212, 255, 0.35)',
              background: '#070D18',
            }}>
              <div style={{
                background: 'linear-gradient(90deg, #0052CC, #00D4FF)',
                height: '7px',
              }} />
              <div style={{
                padding: '4px 14px',
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 900,
                fontSize: '24px',
                color: '#FFFFFF',
                letterSpacing: '2px',
                textAlign: 'center',
              }}>
                {truck.plate}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize:'12px', fontWeight:700, padding:'4px 12px', borderRadius:'20px', background: s.glow, color: s.color, border:`1px solid ${s.color}55`, verticalAlign: 'middle', boxShadow: `0 0 10px ${s.color}33` }}>
                  {s.label}
                </span>
              </div>
              <p style={{ color: '#8899A6', fontSize: '14px', marginTop: '6px', margin: '6px 0 0' }}>{truck.model}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '20px', background: 'rgba(11, 22, 40, 0.8)', padding: '14px 20px', borderRadius: '14px', border: '1px solid rgba(0, 212, 255, 0.15)' }}>
               <div>
                 <div style={{ fontSize: '11px', color: '#8899A6', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Motorista Atual</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#fff' }}><Users size={14} color="#00D4FF" /> {drivers}</div>
               </div>
               <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
               <div>
                 <div style={{ fontSize: '11px', color: '#8899A6', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Velocidade</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontFamily: "'IBM Plex Mono', monospace", color: '#00F5A0', fontWeight: 800 }}><Gauge size={14} color="#00F5A0" /> {truck.speed_kmh} km/h</div>
               </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {user?.role !== 'auditor' && (
                <button
                  onClick={() => {
                    if (window.confirm("Você tem certeza? Isso abrirá a trava de segurança fisicamente no veículo via GPRS de emergência.")) {
                      toast.success('Comando de liberação emergencial enviado para o hardware!', { icon: '🔓' });
                    }
                  }}
                  style={{
                    padding: '0 16px', borderRadius: '10px',
                    background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)',
                    color: '#f87171', fontWeight: 700, fontSize: '13px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    cursor: 'pointer', height: '42px', transition: 'all 0.2s',
                  }}
                >
                  <LockKeyhole size={15} /> Liberação de Emergência
                </button>
              )}

              {(user?.role !== 'auditor' && (truck.sim_state === 'driving' || truck.route_phase !== 'arrived')) && (
                <button onClick={handleCancelRoute} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '0 16px', borderRadius: '10px', border: '1px solid rgba(248,113,113,0.4)',
                  background: 'rgba(248,113,113,0.12)',
                  color: '#f87171', fontWeight: 700,
                  fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s',
                  height: '42px'
                }}>
                  Cancelar Viagem
                </button>
              )}
              
              <Link to={`/investigation/${id}`} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '0 16px', borderRadius: '10px', border: '1px solid rgba(251,191,36,0.4)',
                background: 'rgba(251,191,36,0.1)',
                color: '#fbbf24', fontWeight: 700,
                fontSize: '13px', cursor: 'pointer', textDecoration: 'none',
                height: '42px', transition: 'all 0.2s'
              }}>
                <ShieldAlert size={15} /> Investigar
              </Link>
              
              {user?.role !== 'auditor' && (
                <button onClick={() => setIsModalOpen(true)} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '0 18px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #00D4FF, #0072FF)',
                  color: '#fff', fontWeight: 700,
                  fontSize: '13px', cursor: 'pointer', boxShadow: '0 0 16px rgba(0, 212, 255, 0.35)',
                  height: '42px', transition: 'all 0.2s',
                }}>
                  <Map size={15} /> Nova Rota
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="detail-columns" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '22px', alignItems: 'start' }}>
        {/* Left Column (Map & Chart) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* DRIVER PROFILE FOR SECURITY MONITORING */}
          <div style={{ ...glass, padding: '20px 24px', display: 'flex', gap: '20px', alignItems: 'center', background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.08), rgba(11, 22, 40, 0.75))' }}>
            {truck.current_drivers?.length > 0 ? (
              <>
                <div style={{ width: '64px', height: '64px', borderRadius: '16px', border: '2px solid #00D4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 212, 255, 0.1)', boxShadow: '0 0 20px rgba(0, 212, 255, 0.25)' }}>
                  <Users size={30} color="#00D4FF" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, marginBottom: '4px' }}>Motorista Ativo</div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', color: '#fff', fontWeight: 800 }}>{truck.current_drivers[0].name}</h3>
                  <div style={{ fontSize: '12px', color: '#8899A6', display: 'flex', gap: '18px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00F5A0', boxShadow: '0 0 8px #00F5A0' }} /> Identidade Validada (Facial)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={13} color="#00D4FF" /> Em Rota de Transporte
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: '#8899A6', fontSize: '13px' }}>Nenhum motorista vinculado no momento.</div>
            )}
          </div>

          {/* MAP */}
          <div style={{ ...glass, height: '560px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0, 212, 255, 0.12)', display: 'flex', justifyContent: 'space-between', background: 'rgba(6, 11, 19, 0.6)' }}>
               <span style={{ fontWeight: 800, fontSize: '14px', color: '#FFFFFF' }}>Rota e posição atual</span>
               <span style={{ color: '#8899A6', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><Navigation size={12} color="#00D4FF" /> Rota telemétrica</span>
            </div>
            <div style={{ flex: 1, background: '#060B13' }}>
              {!getMapboxToken() ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontWeight: 600 }}>
                  Token do Mapbox não configurado
                </div>
              ) : routePoints.length > 0 ? (
                <MapContainer center={[parseFloat(truck.lat), parseFloat(truck.lng)]} zoom={15} style={{ height: '100%', width: '100%' }}>
                    <CenterOnTruck lat={truck.lat} lng={truck.lng} />
                  <TileLayer 
                    attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                    url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${getMapboxToken()}`}
                    className="map-tiles"
                    noWrap={true}
                  />
                  <Polyline positions={routePoints} pathOptions={{ color: '#00D4FF', weight: 4, opacity: 0.85 }} />
                  <LiveTruckMarker key={truck.id} truck={truck}>
                    <Popup minWidth={100}><div style={{ color: '#000', fontWeight: 'bold' }}>Posição Atual</div></Popup>
                  </LiveTruckMarker>
                </MapContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8899A6' }}>Sem dados de rota</div>
              )}
            </div>
          </div>

          {/* CHART */}
          <div style={{ ...glass, padding: '22px' }}>
            <div style={{ fontWeight: 800, fontSize: '15px', color: '#FFFFFF', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Droplets size={16} color="#00D4FF" />
              Consumo de Combustível (Histórico)
            </div>
            <div style={{ height: '240px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={levelColor} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={levelColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" fontSize={11} tickMargin={10} minTickGap={30} fontFamily="'IBM Plex Mono', monospace" />
                  <YAxis stroke="rgba(255,255,255,0.2)" fontSize={11} tickFormatter={val => `${val}L`} fontFamily="'IBM Plex Mono', monospace" />
                  <RechartsTooltip 
                    contentStyle={{ background: 'rgba(11,22,40,0.96)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}
                    itemStyle={{ color: '#fff', fontSize: '13px' }} labelStyle={{ color: '#8899A6', fontSize: '12px', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="combustivel" name="Volume (L)" stroke={levelColor} strokeWidth={3} fillOpacity={1} fill="url(#colorFuel)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Right Column (Status & Logs) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Fuel Status Widget */}
          <div style={{ ...glass, padding: '24px', background: `linear-gradient(180deg, rgba(11, 22, 40, 0.85) 0%, ${levelColor}15 100%)` }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8899A6', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700, marginBottom: '16px' }}>
               <Droplets size={14} color={levelColor} /> Nível do Tanque
             </div>
             <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
               <span style={{ fontSize: '48px', fontWeight: 900, color: levelColor, lineHeight: 1, fontFamily: "'IBM Plex Mono', monospace" }}>{pct}%</span>
               <span style={{ fontSize: '15px', color: '#8899A6', fontFamily: "'IBM Plex Mono', monospace" }}>{truck.current_level_liters} L</span>
             </div>
             <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: levelColor, boxShadow: `0 0 14px ${levelColor}` }} />
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#8899A6', fontFamily: "'IBM Plex Mono', monospace" }}>
               <span>0 L</span><span>Capacidade: {truck.capacity_liters}L</span>
             </div>
          </div>

          {/* Hardware Key Provisioning Card (hidden for auditor) */}
          {user?.role !== 'auditor' && (
            <div data-testid="hardware-key-card" style={{ ...glass, padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8899A6', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>
                  <Key size={14} color="#00D4FF" /> Chave do hardware
                </div>
                <button
                  type="button"
                  disabled={hwKeyLoading || hwKeyBusy}
                  onClick={() => loadHardwareKeyStatus(true)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    background: 'rgba(0, 212, 255, 0.08)',
                    color: '#00D4FF',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: hwKeyLoading || hwKeyBusy ? 'not-allowed' : 'pointer',
                  }}
                >
                  Atualizar
                </button>
              </div>

              <div
                data-testid="hardware-key-truck-ident"
                style={{
                  fontSize: '12px',
                  color: '#cbd5e1',
                  fontFamily: "'IBM Plex Mono', monospace",
                  marginBottom: '12px',
                  userSelect: 'text',
                }}
              >
                {`ID do caminhão: ${truck.id} • Placa: ${truck.plate}`}
              </div>

              {hwKeyLoading ? (
                <div style={{ fontSize: '13px', color: '#8899A6' }}>Carregando status da chave...</div>
              ) : hwKeyError ? (
                <div style={{ fontSize: '13px', color: '#f87171' }}>{hwKeyError}</div>
              ) : hwKeyStatus?.configured ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div data-testid="hardware-key-active-status" style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.5 }}>
                    {`Chave ativa: ${hwKeyStatus.prefix}… • criada em ${new Date(hwKeyStatus.created_at).toLocaleString('pt-BR')} • último uso ${hwKeyStatus.last_used_at ? new Date(hwKeyStatus.last_used_at).toLocaleString('pt-BR') : 'nunca'}`}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={hwKeyBusy}
                      onClick={() => setConfirmAction('rotate')}
                      style={{
                        padding: '9px 16px',
                        borderRadius: '10px',
                        border: '1px solid rgba(0, 212, 255, 0.4)',
                        background: 'rgba(0, 212, 255, 0.12)',
                        color: '#00D4FF',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: hwKeyBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Trocar chave
                    </button>
                    <button
                      type="button"
                      disabled={hwKeyBusy}
                      onClick={() => setConfirmAction('revoke')}
                      style={{
                        padding: '9px 16px',
                        borderRadius: '10px',
                        border: '1px solid rgba(248,113,113,0.4)',
                        background: 'rgba(248,113,113,0.12)',
                        color: '#f87171',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: hwKeyBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Revogar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div data-testid="hardware-key-empty-status" style={{ fontSize: '13px', color: '#8899A6' }}>
                    Nenhuma chave configurada
                  </div>
                  <div>
                    <button
                      type="button"
                      disabled={hwKeyBusy}
                      onClick={executeGenerateKey}
                      style={{
                        padding: '9px 18px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #00D4FF, #0072FF)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '13px',
                        cursor: hwKeyBusy ? 'not-allowed' : 'pointer',
                        boxShadow: '0 0 16px rgba(0, 212, 255, 0.35)',
                      }}
                    >
                      Gerar chave
                    </button>
                  </div>
                </div>
              )}

              {hwKeyRefreshError && (
                <div
                  data-testid="hardware-key-refresh-error"
                  style={{ marginTop: '10px', fontSize: '12px', color: '#fbbf24' }}
                >
                  {hwKeyRefreshError}
                </div>
              )}

              {confirmAction && (
                <div
                  role="alertdialog"
                  aria-modal="true"
                  data-testid="hardware-key-confirm-dialog"
                  style={{
                    marginTop: '14px',
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(248,113,113,0.1)',
                    border: '1px solid rgba(248,113,113,0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '13px', color: '#fca5a5', fontWeight: 600 }}>
                    A chave atual para de funcionar imediatamente e a placa precisará ser reconfigurada.
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      disabled={hwKeyBusy}
                      onClick={() => {
                        if (confirmAction === 'rotate') executeGenerateKey();
                        else if (confirmAction === 'revoke') executeRevokeKey();
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#f87171',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      disabled={hwKeyBusy}
                      onClick={() => setConfirmAction(null)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.06)',
                        color: '#e2e8f0',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline de Eventos */}
          <div style={{ ...glass, display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0, 212, 255, 0.12)', fontWeight: 800, fontSize: '14px', color: '#FFFFFF', background: 'rgba(6, 11, 19, 0.6)' }}>
              Linha do Tempo
            </div>
            <div style={{ flex: 1, padding: '16px' }}>
              {timelineEvents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '20px', top: '10px', bottom: '10px', width: '2px', background: 'rgba(0, 212, 255, 0.15)' }} />
                  {timelineEvents.map((ev) => {
                    const isFueling = ev.type === 'fueling';
                    
                    let bg = 'rgba(6, 11, 19, 0.5)';
                    let borderColor = 'rgba(0, 212, 255, 0.1)';
                    let iconColor = '#00D4FF';
                    
                    if (!isFueling) {
                       if (ev.status === 'low') { borderColor = 'rgba(251,191,36,0.3)'; iconColor = '#fbbf24'; }
                       else if (ev.status === 'high') { borderColor = 'rgba(248,113,113,0.3)'; iconColor = '#f87171'; }
                       else { borderColor = 'rgba(0,245,160,0.3)'; iconColor = '#00F5A0'; }
                    }

                    return (
                    <div key={ev.type + ev.id} style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                      <div style={{ width: '40px', display: 'flex', justifyContent: 'center', paddingTop: '12px' }}>
                         <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: iconColor, border: '2px solid #060B13', boxShadow: `0 0 10px ${iconColor}` }} />
                      </div>
                      <div style={{ flex: 1, background: bg, padding: '12px 16px', borderRadius: '12px', border: `1px solid ${borderColor}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#8899A6', fontFamily: "'IBM Plex Mono', monospace" }}>{new Date(ev.timestamp).toLocaleString('pt-BR')}</span>
                          {isFueling ? (
                             <span style={{ fontSize: '11px', color: '#00D4FF', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', padding: '2px 8px', borderRadius: '12px' }}>Abastecimento ({ev.release_method})</span>
                          ) : (
                             <span style={{ fontSize: '11px', color: iconColor, background: `${iconColor}22`, padding: '2px 8px', borderRadius: '12px' }}>Descarga (Dump Pro)</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>
                            {isFueling ? (ev.driver_name || 'Desconhecido') : (ev.status === 'safe' ? 'Segura' : ev.status === 'low' ? 'Risco Tombamento' : 'Vibração Excessiva')}
                          </span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px', color: iconColor, fontWeight: 700 }}>
                            {isFueling ? `+${(ev.level_after - ev.level_before).toFixed(2)}L` : `${ev.vibration_level}%`}
                          </span>
                        </div>
                        {isFueling && (
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#8899A6' }}>Posto (ANP)</span>
                            <div>{renderAnpMatchCell(ev)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: '#8899A6', fontSize: '13px' }}>Nenhum evento recente.</div>
              )}
            </div>
          </div>

        </div>
      </div>
      
      <RouteModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        truckId={truck.id} 
        onConfigured={(truckId) => { loadData(); fetchTruckRoute(truckId); }}
      />
      <HardwareKeyModal
        generatedData={generatedKeyModalData}
        truckId={truck.id}
        truckPlate={truck.plate}
        onClose={() => setGeneratedKeyModalData(null)}
      />
    </div>
  );
}
