import React, { useState, useEffect } from 'react';
import { useFueling } from '../hooks/useFueling';
import { useFleet } from '../hooks/useFleet';
import { useDrivers } from '../hooks/useDrivers';
import FuelingTable   from '../components/FuelingTable';
import LoadingSpinner from '../components/LoadingSpinner';
import { Filter, RotateCcw, ShieldCheck, LockKeyhole, CheckCircle2, Clock, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
};

const inputStyle = {
  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff', padding: '10px 14px', borderRadius: '10px',
  fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif',
};

const primaryButton = {
  display:'inline-flex', alignItems:'center', gap:'7px', padding:'10px 16px', borderRadius:'10px', border:'none', cursor:'pointer',
  background:'linear-gradient(135deg,#2FBEB5,#4F8EF7)', color:'#fff', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'12px'
};

export default function FuelingPage() {
  const [filters, setFilters] = useState({ truckId:'', driverId:'', start:'', end:'' });
  const { logs, loading, refetch, requestSession, authorizeSession, finishSession, getActiveSession } = useFueling();
  const { trucks, fetchFleet } = useFleet();
  const { drivers } = useDrivers();

  const [truckId, setTruckId] = useState('');
  const [session, setSession] = useState(null);
  const [sessionBusy, setSessionBusy] = useState(false);

  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);

  // When truck is selected, check for active session
  useEffect(() => {
    if (truckId) {
      getActiveSession(truckId).then(sess => {
        setSession(sess);
      });
    } else {
      setSession(null);
    }
  }, [truckId, getActiveSession]);

  const activeTruck = trucks.find(t => t.id === parseInt(truckId));

  const startSession = async () => {
    if (!truckId) return toast.error('Selecione um caminhão');
    setSessionBusy(true);
    try {
      const driver = activeTruck?.current_drivers?.[0];
      const newSession = await requestSession(truckId, driver?.id || null, activeTruck?.fuel_station_id, 'facial');
      
      // Add mock station name if the truck had it
      if (activeTruck?.station_name) {
        newSession.station_name = activeTruck.station_name;
      }
      
      setSession(newSession);
      toast.success('Sessão de abastecimento iniciada.');
    } catch (err) { 
      toast.error(err.response?.data?.error || 'Não foi possível solicitar a sessão.'); 
    } finally { setSessionBusy(false); }
  };

  const authorize = async () => {
    if (!session?.id) return;
    setSessionBusy(true);
    try {
      const updated = await authorizeSession(session.id);
      setSession({ ...session, ...updated, status: 'authorized' });
      toast.success('Trava autorizada com sucesso.');
    } catch (err) { toast.error('Falha ao autorizar trava.'); }
    finally { setSessionBusy(false); }
  };

  const finish = async () => {
    if (!session?.id) return;
    setSessionBusy(true);
    try {
      await finishSession(session.id);
      setSession(null);
      await refetch(filters);
      toast.success('Abastecimento encerrado e registrado no log.');
    } catch (err) { toast.error(err.response?.data?.error || 'Falha ao encerrar.'); }
    finally { setSessionBusy(false); }
  };

  const handleApplyFilters = () => { refetch(filters); };
  const handleClearFilters = () => {
    const empty = { truckId:'', driverId:'', start:'', end:'' };
    setFilters(empty);
    refetch(empty);
  };

  const isAwaitingAuth = activeTruck?.route_phase === 'awaiting_fueling_authorization';

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: '#fff' }}>
      <header style={{ marginBottom: '24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, margin: '0 0 4px 0' }}>Sessão de Abastecimento</h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>Autorize travas e monitore logs de combustível</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Painel de Controle (Esquerda) */}
        <div style={{ ...glass, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display:'block', fontSize:'12px', color:'#94a3b8', marginBottom:'8px', fontWeight:600 }}>Caminhão Solicitante</label>
            <select value={truckId} onChange={e => setTruckId(e.target.value)} style={{ ...inputStyle, width: '100%', cursor:'pointer' }}>
              <option value="">Selecione um caminhão...</option>
              {trucks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.plate} - {t.model} {t.route_phase === 'awaiting_fueling_authorization' ? ' (Aguardando Liberação)' : ''}
                </option>
              ))}
            </select>
          </div>

          {!session && truckId && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '16px', lineHeight: 1.5 }}>
                {isAwaitingAuth ? (
                  <>Este caminhão chegou ao posto <strong>{activeTruck.station_name || 'desconhecido'}</strong> e está aguardando liberação da trava.</>
                ) : (
                  <>Este caminhão <strong>não</strong> reportou parada no posto. Deseja forçar a abertura de uma sessão avulsa?</>
                )}
              </div>
              <button onClick={startSession} disabled={sessionBusy} style={{ ...primaryButton, width: '100%', justifyContent: 'center' }}>
                <ShieldCheck size={16}/> {isAwaitingAuth ? 'Iniciar Sessão de Autorização' : 'Forçar Sessão Avulsa'}
              </button>
            </div>
          )}

          {session && (
            <div style={{ background: 'rgba(47, 190, 181, 0.05)', border: '1px solid rgba(47, 190, 181, 0.2)', padding: '20px', borderRadius: '12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'16px', color: '#2FBEB5', marginBottom: '16px' }}>
                <LockKeyhole size={18} /> Sessão Ativa
              </div>
              
              <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Motorista</span>
                  <strong style={{ color: '#fff' }}>{session.driver_name || activeTruck?.current_drivers?.[0]?.name || 'Não identificado'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Posto</span>
                  <strong style={{ color: '#fff' }}>{session.station_name || activeTruck?.station_name || 'Desconhecido'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Status</span>
                  <strong style={{ color: session.status === 'requested' ? '#f59e0b' : '#10b981', textTransform: 'uppercase' }}>{session.status}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Método</span>
                  <strong style={{ color: '#fff' }}>{session.release_method === 'facial' ? 'Reconhecimento Facial' : 'BLE Fallback'}</strong>
                </div>
              </div>

              {session.status === 'requested' && (
                <button onClick={authorize} disabled={sessionBusy} style={{ ...primaryButton, width: '100%', justifyContent: 'center' }}>
                  <LockKeyhole size={16}/> Autorizar Destravamento
                </button>
              )}

              {(session.status === 'authorized' || session.status === 'active') && (
                <button onClick={finish} disabled={sessionBusy} style={{ ...primaryButton, background:'linear-gradient(135deg,#10b981,#059669)', width: '100%', justifyContent: 'center' }}>
                  <CheckCircle2 size={16}/> Encerrar Abastecimento
                </button>
              )}
            </div>
          )}
        </div>

        {/* Histórico e Logs (Direita) */}
        <div style={{ ...glass, padding: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={18} color="var(--teal)"/> Filtros do Histórico
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto auto', gap: '12px', alignItems: 'end', marginBottom: '24px' }}>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#94a3b8', marginBottom:'6px' }}>Caminhão</label>
              <select value={filters.truckId} onChange={e=>setFilters({...filters, truckId:e.target.value})} style={{...inputStyle, width:'100%'}}>
                <option value="">Todos</option>
                {trucks.map(t => <option key={t.id} value={t.id}>{t.plate}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#94a3b8', marginBottom:'6px' }}>Motorista</label>
              <select value={filters.driverId} onChange={e=>setFilters({...filters, driverId:e.target.value})} style={{...inputStyle, width:'100%'}}>
                <option value="">Todos</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#94a3b8', marginBottom:'6px' }}>Data Inicial</label>
              <input type="date" value={filters.start} onChange={e=>setFilters({...filters, start:e.target.value})} style={{...inputStyle, width:'100%'}}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#94a3b8', marginBottom:'6px' }}>Data Final</label>
              <input type="date" value={filters.end} onChange={e=>setFilters({...filters, end:e.target.value})} style={{...inputStyle, width:'100%'}}/>
            </div>
            <button onClick={handleApplyFilters} style={primaryButton}><Filter size={14}/> Filtrar</button>
            <button onClick={handleClearFilters} style={{...primaryButton, background:'rgba(255,255,255,0.1)', color:'#fff'}}><RotateCcw size={14}/></button>
          </div>

          {loading ? <div style={{ height:'300px', display:'flex', alignItems:'center', justifyContent:'center' }}><LoadingSpinner/></div>
                   : <FuelingTable logs={logs} />}
        </div>
      </div>
    </div>
  );
}
