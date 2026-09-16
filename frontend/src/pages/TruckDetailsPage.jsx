import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFleet } from '../hooks/useFleet';
import LoadingSpinner from '../components/LoadingSpinner';
import RouteModal from '../components/RouteModal';
import Simulation3DModal from '../components/Simulation3DModal';
import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ArrowLeft, MapPin, Gauge, Droplets, Users, Navigation, Map } from 'lucide-react';

const glass = {
  background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden',
};

const STATUS_META = {
  ok:        { label: 'OK',         color: '#34d399', glow: 'rgba(52,211,153,0.15)' },
  low_fuel:  { label: 'Comb. Baixo',color: '#fbbf24', glow: 'rgba(251,191,36,0.15)' },
  no_signal: { label: 'Sem Sinal',  color: '#f87171', glow: 'rgba(248,113,113,0.15)' },
};

export default function TruckDetailsPage() {
  const { id } = useParams();
  const { fetchTruckDetails } = useFleet();
  const [truck, setTruck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);

  const loadData = () => {
    fetchTruckDetails(id).then(data => {
      setTruck(data);
      setLoading(false);
    });
  };

  // Carrega e atualiza a cada 5s para ver o movimento ao vivo
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [id, fetchTruckDetails]);

  if (loading && !truck) return <LoadingSpinner />;
  if (!truck) return <div style={{ color: 'var(--text-muted)' }}>Caminhão não encontrado.</div>;

  const s = STATUS_META[truck.status] || STATUS_META.ok;
  const pct = truck.capacity_liters > 0 ? Math.round((truck.current_level_liters / truck.capacity_liters) * 100) : 0;
  const levelColor = pct < 20 ? '#f87171' : pct < 50 ? '#fbbf24' : '#34d399';
  const drivers = truck.current_drivers?.length > 0 ? truck.current_drivers.map(d => d.name).join(', ') : 'Sem motorista';

  // O motor de simulador já gera toda a rota. Precisamos extrair os pontos.
  const routePoints = truck.route?.map(r => [parseFloat(r.lat), parseFloat(r.lng)]) || [];
  let currentPos = null;
  
  if (truck.route_geometry && typeof truck.route_geometry === 'string') {
    const geo = JSON.parse(truck.route_geometry);
    // geometry vem no formato [lng, lat], o leaflet precisa de [lat, lng]
    routePoints.length = 0;
    geo.forEach(p => routePoints.push([p[1], p[0]]));
    currentPos = [parseFloat(truck.lat), parseFloat(truck.lng)];
  } else if (routePoints.length > 0) {
    currentPos = routePoints[routePoints.length - 1];
  }

  const chartData = truck.route?.map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    combustivel: Number(r.fuel_level_liters),
    velocidade: Number(r.speed_kmh)
  })) || [];

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
            
            <button onClick={() => setIsModalOpen(true)} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '0 20px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
              color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(47,190,181,0.3)',
            }}>
              <Map size={16} /> Nova Rota
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        {/* Left Column (Map & Chart) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* DRIVER PROFILE FOR SECURITY MONITORING */}
          <div style={{ ...glass, padding: '20px', display: 'flex', gap: '24px', alignItems: 'center', background: 'linear-gradient(90deg, rgba(47,190,181,0.05), transparent)' }}>
            {truck.current_drivers?.length > 0 ? (
              <>
                <img 
                  src={`https://i.pravatar.cc/150?u=${truck.current_drivers[0].id + 10}`} 
                  alt="Driver" 
                  style={{ width: '80px', height: '80px', borderRadius: '12px', border: '2px solid var(--teal)', objectFit: 'cover', boxShadow: '0 4px 15px rgba(47,190,181,0.2)' }} 
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
                    boxShadow: '0 4px 15px rgba(47,190,181,0.3)', transition: 'transform 0.2s'
                  }}
                  onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                >
                  <Map size={16} /> Entrar em Simulação 3D
                </button>
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>Nenhum motorista vinculado no momento.</div>
            )}
          </div>

          {/* MAP */}
          <div style={{ ...glass, height: '400px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
               <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>Trajeto Recente</span>
               <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><Navigation size={12} /> Últimas 3 horas</span>
            </div>
            <div style={{ flex: 1, background: '#0a101a' }}>
              {routePoints.length > 0 ? (
                <MapContainer bounds={routePoints} style={{ height: '100%', width: '100%' }}>
                  <TileLayer 
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                    className="map-tiles"
                  />
                  <Polyline positions={routePoints} pathOptions={{ color: 'var(--teal)', weight: 4, opacity: 0.8 }} />
                  {/* Posição atual (último ponto) */}
                  {routePoints.length > 0 && (() => {
                    const currentDriver = truck.current_drivers?.length > 0 ? truck.current_drivers[0] : null;
                    const driverName = currentDriver ? currentDriver.name.split(' ')[0] : null;
                    return (
                      <Marker 
                        position={routePoints[routePoints.length - 1]}
                        icon={L.divIcon({
                          html: `
                            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
                              ${driverName ? `
                                <div style="
                                  position: absolute;
                                  bottom: 34px;
                                  left: 50%;
                                  transform: translateX(-50%);
                                  white-space: nowrap;
                                  background: rgba(11, 20, 36, 0.92);
                                  border: 1px solid rgba(47, 190, 181, 0.4);
                                  box-shadow: 0 4px 14px rgba(0,0,0,0.6);
                                  padding: 3px 9px;
                                  border-radius: 20px;
                                  font-size: 11px;
                                  font-weight: 700;
                                  color: #fff;
                                  display: flex;
                                  align-items: center;
                                  gap: 5px;
                                  pointer-events: none;
                                  backdrop-filter: blur(8px);
                                  z-index: 10;
                                ">
                                  <span style="width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399;flex-shrink:0;"></span>
                                  <span>${driverName}</span>
                                </div>
                              ` : ''}
                              <div style="width:28px;height:28px;background:${s.color};border-radius:50%;border:2px solid #fff;box-shadow:0 0 12px ${s.color};display:flex;align-items:center;justify-content:center;color:#0a101a;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 17h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg></div>
                            </div>`,
                          className: 'animated-truck',
                          iconSize: [28, 28],
                          iconAnchor: [14, 14],
                        })}
                      >
                        <Popup minWidth={100}><div style={{ color: '#000', fontWeight: 'bold' }}>Posição Atual</div></Popup>
                      </Marker>
                    );
                  })()}
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

          {/* Recent Fueling Logs */}
          <div style={{ ...glass, display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>
              Últimos Abastecimentos
            </div>
            <div style={{ flex: 1, padding: '12px' }}>
              {truck.recent_fueling_logs?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {truck.recent_fueling_logs.map(log => (
                    <div key={log.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleDateString('pt-BR')}</span>
                        <span style={{ fontSize: '11px', color: 'var(--teal)', background: 'rgba(47,190,181,0.1)', padding: '2px 8px', borderRadius: '12px' }}>{log.release_method === 'facial' ? 'Facial' : 'BLE'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{log.driver_name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#34d399', fontWeight: 600 }}>+{log.level_after - log.level_before}L</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Nenhum abastecimento recente.</div>
              )}
            </div>
          </div>

        </div>
      </div>
      
      <RouteModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        truckId={truck.id} 
        onConfigured={loadData} 
      />

      <Simulation3DModal
        isOpen={isSimulationOpen}
        onClose={() => setIsSimulationOpen(false)}
        truck={truck}
      />
    </div>
  );
}
