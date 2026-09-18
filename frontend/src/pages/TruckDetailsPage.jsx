import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useParams, Link } from 'react-router-dom';
import { useFleet } from '../hooks/useFleet';
import LoadingSpinner from '../components/LoadingSpinner';
import RouteModal from '../components/RouteModal';
import Simulation3DModal from '../components/Simulation3DModal';
import { MapContainer, TileLayer, Polyline, Popup, useMap } from 'react-leaflet';

function CenterOnTruck({ lat, lng }) {
  const map = useMap();
  React.useEffect(() => {
    if(lat && lng) { map.setView([parseFloat(lat), parseFloat(lng)], 15, { animate: true }); setTimeout(() => map.invalidateSize(), 200); }
  }, [lat, lng, map]);
  return null;
}
import LiveTruckMarker from '../components/LiveTruckMarker';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ArrowLeft, MapPin, Gauge, Droplets, Users, Navigation, Map } from 'lucide-react';

const glass = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden',
};

const STATUS_META = {
  critical_fuel: { label: 'Sem autonomia — abastecer', color: '#f87171', glow: 'rgba(248,113,113,0.15)' },
  ok:        { label: 'OK',         color: '#34d399', glow: 'rgba(52,211,153,0.15)' },
  low_fuel:  { label: 'Comb. Baixo',color: '#fbbf24', glow: 'rgba(251,191,36,0.15)' },
  no_signal: { label: 'Sem Sinal',  color: '#f87171', glow: 'rgba(248,113,113,0.15)' },
  security_alert: { label: 'Alerta de segurança', color: '#fb7185', glow: 'rgba(251,113,133,0.18)' },
  arrived: { label: 'Chegou ao destino', color: '#60a5fa', glow: 'rgba(96,165,250,0.18)' },
};

import useFleetState from '../store/useFleetState';

import ErrorMessage from '../components/ErrorMessage';

export default function TruckDetailsPage() {
  const { id } = useParams();
  const { fetchTruckDetails, error } = useFleet();
  const [truckDetails, setTruckDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);
  
  const { fleet, truckRoutes, fetchTruckRoute } = useFleetState();

  const loadData = () => {
    fetchTruckDetails(id).then(data => {
      if (data) setTruckDetails(data);
      else setLocalError('Não foi possível encontrar o caminhão.');
      setLoading(false);
    });
  };

  // Carrega apenas na montagem (para pegar dados detalhados)
  useEffect(() => {
    loadData();
    // No more polling, live telemetry comes from useFleetState
  }, [id, fetchTruckDetails]);

  // Combine live telemetry from global store with detailed data
  const liveTruck = fleet.find(t => t.id === Number(id));
  const truck = liveTruck && truckDetails ? { ...truckDetails, ...liveTruck } : truckDetails;

  if (loading && !truck) return <LoadingSpinner />;
  if (localError || error) return <ErrorMessage message={localError || error} />;
  const handleCancelRoute = async () => {
    if (!window.confirm('Deseja realmente cancelar esta viagem? O caminhão irá parar imediatamente.')) return;
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${API_URL}/fleet/${truck.id}/cancel-route`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        refetch();
        fetchTruckRoute(truck.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!truck) return <div style={{ color: '#fff', padding: '40px' }}>Caminhão não encontrado.</div>;

  const s = STATUS_META[truck.status] || STATUS_META.ok;
  const pct = truck.capacity_liters > 0 ? Math.round((truck.current_level_liters / truck.capacity_liters) * 100) : 0;
  const levelColor = pct < 20 ? '#f87171' : pct < 50 ? '#fbbf24' : '#34d399';
  const drivers = truck.current_drivers?.length > 0 ? truck.current_drivers.map(d => d.name).join(', ') : 'Sem motorista';

  // O motor de simulador já gera toda a rota via truck.route_geometry.
  const routePoints = [];
  let currentPos = null;
  
  const routeGeometry = truckRoutes[truck.id] ?? truck.route_geometry;
  if (routeGeometry) {
    try {
      const geo = typeof routeGeometry === 'string' ? JSON.parse(routeGeometry) : routeGeometry;
      if (Array.isArray(geo)) {
        // geometry vem no formato [lng, lat], o leaflet precisa de [lat, lng]
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

  // Fallback map if geometry fails
  if (!currentPos && !isNaN(truck.lat) && !isNaN(truck.lng)) {
    currentPos = [parseFloat(truck.lat), parseFloat(truck.lng)];
    if (routePoints.length === 0) routePoints.push(currentPos);
  }

  
  // Combine fueling and unloading events
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <Link to="/fleet" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px', marginBottom: '12px', transition: 'color 0.2s' }} onMouseEnter={e=>e.target.style.color='#fff'} onMouseLeave={e=>e.target.style.color='var(--text-muted)'}>
          <ArrowLeft size={14} /> Voltar para Frota
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              {truck.plate}
              <span style={{ fontSize:'12px', fontWeight:700, padding:'4px 12px', borderRadius:'20px', background: s.glow, color: s.color, border:`1px solid ${s.color}44`, verticalAlign: 'middle' }}>
                {s.label}
              </span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>{truck.model}</p>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '24px', background: 'rgba(255,255,255,0.03)', padding: '16px 24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
               <div>
                 <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Motorista Atual</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 500, color: '#fff' }}><Users size={14} color="var(--teal)" /> {drivers}</div>
               </div>
               <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
               <div>
                 <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Velocidade</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontFamily: 'var(--font-mono)', color: '#fff' }}><Gauge size={14} color="var(--blue)" /> {truck.speed_kmh} km/h</div>
               </div>
            </div>
            
            <div style={{ display: 'flex', gap: '16px' }}>
              {(truck.sim_state === 'driving' || truck.route_phase !== 'arrived') && (
                <button onClick={handleCancelRoute} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '0 20px', borderRadius: '12px', border: '1px solid rgba(248,113,113,0.4)',
                  background: 'rgba(248,113,113,0.1)',
                  color: '#f87171', fontFamily: 'var(--font-display)', fontWeight: 700,
                  fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
                }}>
                  Cancelar Viagem
                </button>
              )}
              <button onClick={() => setIsModalOpen(true)} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '0 20px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #38BDF8, #60A5FA)',
                color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(56,189,248,0.3)',
              }}>
                <Map size={16} /> Nova Rota
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="detail-columns">
        {/* Left Column (Map & Chart) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* DRIVER PROFILE FOR SECURITY MONITORING */}
          <div style={{ ...glass, padding: '20px', display: 'flex', gap: '24px', alignItems: 'center', background: 'linear-gradient(90deg, rgba(56,189,248,0.05), transparent)' }}>
            {truck.current_drivers?.length > 0 ? (
              <>
                <img 
                  src={`https://i.pravatar.cc/150?u=${truck.current_drivers[0].id + 10}`} 
                  alt="Driver" 
                  style={{ width: '80px', height: '80px', borderRadius: '12px', border: '2px solid var(--teal)', objectFit: 'cover', boxShadow: '0 4px 15px rgba(56,189,248,0.2)' }} 
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, marginBottom: '4px' }}>Motorista Ativo</div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#fff', fontFamily: 'var(--font-display)' }}>{truck.current_drivers[0].name}</h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', gap: '20px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} /> Identidade Validada (Facial)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} color="var(--blue)" /> Em Rota de Transporte
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSimulationOpen(true)}
                  style={{
                    background: 'var(--teal)', border: 'none', padding: '12px 24px', borderRadius: '12px', color: '#0a101a',
                    fontWeight: 800, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 15px rgba(56,189,248,0.3)', transition: 'transform 0.2s'
                  }}
                  onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                >
                  <Map size={16} /> Abrir rastreamento 3D
                </button>
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>Nenhum motorista vinculado no momento.</div>
            )}
          </div>

          {/* MAP */}
          <div style={{ ...glass, height: '600px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
               <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>Rota e posição atual</span>
               <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><Navigation size={12} /> Rota completa</span>
            </div>
            <div style={{ flex: 1, background: '#0a101a' }}>
              {routePoints.length > 0 ? (
                <MapContainer center={[parseFloat(truck.lat), parseFloat(truck.lng)]} zoom={15} style={{ height: '100%', width: '100%' }}>
                    <CenterOnTruck lat={truck.lat} lng={truck.lng} />
                  <TileLayer 
                    attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                    url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`}
                    className="map-tiles"
                    noWrap={true}
                  />
                  <Polyline positions={routePoints} pathOptions={{ color: 'var(--teal)', weight: 4, opacity: 0.8 }} />
                  <LiveTruckMarker key={truck.id} truck={truck}>
                    <Popup minWidth={100}><div style={{ color: '#000', fontWeight: 'bold' }}>Posição Atual</div></Popup>
                  </LiveTruckMarker>
                </MapContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Sem dados de rota</div>
              )}
            </div>
          </div>

          {/* CHART */}
          <div style={{ ...glass, padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', marginBottom: '20px' }}>
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
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" fontSize={11} tickMargin={10} minTickGap={30} />
                  <YAxis stroke="rgba(255,255,255,0.2)" fontSize={11} tickFormatter={val => `${val}L`} />
                  <RechartsTooltip 
                    contentStyle={{ background: 'rgba(15,29,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: '#fff', fontSize: '13px' }} labelStyle={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="combustivel" name="Volume (L)" stroke={levelColor} strokeWidth={3} fillOpacity={1} fill="url(#colorFuel)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Right Column (Status & Logs) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Fuel Status Widget */}
          <div style={{ ...glass, padding: '24px', background: `linear-gradient(180deg, rgba(255,255,255,0.04) 0%, ${levelColor}11 100%)` }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600, marginBottom: '16px' }}>
               <Droplets size={14} color={levelColor} /> Nível do Tanque
             </div>
             <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
               <span style={{ fontFamily: 'var(--font-display)', fontSize: '48px', fontWeight: 800, color: levelColor, lineHeight: 1 }}>{pct}%</span>
               <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{truck.current_level_liters} L</span>
             </div>
             <div style={{ height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: levelColor, boxShadow: `0 0 12px ${levelColor}` }} />
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
               <span>0</span><span>Capacidade: {truck.capacity_liters}L</span>
             </div>
          </div>

          {/* Timeline de Eventos */}
          <div style={{ ...glass, display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>
              Linha do Tempo
            </div>
            <div style={{ flex: 1, padding: '12px' }}>
              {timelineEvents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '20px', top: '10px', bottom: '10px', width: '2px', background: 'rgba(255,255,255,0.1)' }} />
                  {timelineEvents.map((ev, i) => {
                    const isFueling = ev.type === 'fueling';
                    
                    let bg = 'rgba(0,0,0,0.2)';
                    let borderColor = 'rgba(255,255,255,0.03)';
                    let iconColor = 'var(--blue)';
                    
                    if (!isFueling) {
                       if (ev.status === 'low') { borderColor = 'rgba(251,191,36,0.3)'; iconColor = '#fbbf24'; }
                       else if (ev.status === 'high') { borderColor = 'rgba(248,113,113,0.3)'; iconColor = '#f87171'; }
                       else { borderColor = 'rgba(52,211,153,0.3)'; iconColor = '#34d399'; }
                    }

                    return (
                    <div key={ev.type + ev.id} style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                      <div style={{ width: '40px', display: 'flex', justifyContent: 'center', paddingTop: '12px' }}>
                         <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: iconColor, border: '2px solid #0a101a', boxShadow: `0 0 8px ${iconColor}` }} />
                      </div>
                      <div style={{ flex: 1, background: bg, padding: '12px 16px', borderRadius: '10px', border: `1px solid ${borderColor}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(ev.timestamp).toLocaleString('pt-BR')}</span>
                          {isFueling ? (
                             <span style={{ fontSize: '11px', color: 'var(--blue)', background: 'rgba(79,142,247,0.1)', padding: '2px 8px', borderRadius: '12px' }}>Abastecimento ({ev.release_method})</span>
                          ) : (
                             <span style={{ fontSize: '11px', color: iconColor, background: `${iconColor}22`, padding: '2px 8px', borderRadius: '12px' }}>Descarga (Dump Pro)</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '13px', fontWeight: 500 }}>
                            {isFueling ? (ev.driver_name || 'Desconhecido') : (ev.status === 'safe' ? 'Segura' : ev.status === 'low' ? 'Risco Tombamento' : 'Vibração Excessiva')}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: iconColor, fontWeight: 600 }}>
                            {isFueling ? `+${(ev.level_after - ev.level_before).toFixed(2)}L` : `${ev.vibration_level}%`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Nenhum evento recente.</div>
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

      <Simulation3DModal
        isOpen={isSimulationOpen}
        onClose={() => setIsSimulationOpen(false)}
        truck={truck}
      />
    </div>
  );
}
