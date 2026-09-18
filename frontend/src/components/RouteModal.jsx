import React, { useState } from 'react';
import { X, Map } from 'lucide-react';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function RouteModal({ isOpen, onClose, truckId, onConfigured }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Calculando rota pelas rodovias...');
    try {
      const res = await client.post(`/fleet/${truckId}/route`, { origin, destination });
      toast.success(`Rota calculada com sucesso! (${res.data.route_points} pontos de rodovia)`, { id: toastId });
      onConfigured?.(truckId);
      onClose();
      setOrigin(''); setDestination('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao calcular rota. Verifique as cidades.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', padding: '12px 14px', borderRadius: '10px',
    width: '100%', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'rgba(11,20,36,0.98)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px',
        width: '100%', maxWidth: '440px', padding: '32px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)', position: 'relative',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.07)',
          border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', color: 'var(--text-muted)',
        }}>
          <X size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg,#38BDF8,#60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Map size={18} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800, color: '#fff', margin: 0 }}>Definir Viagem</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>Rastreamento real pelas rodovias</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Origem</label>
            <input required pattern="[^,]+,.+" title="Informe qualquer cidade brasileira e UF/estado, por exemplo: Brasília, DF" placeholder="Ex: Brasília, DF" value={origin} onChange={e => setOrigin(e.target.value)} style={inputStyle}
              onFocus={e => { e.target.style.borderColor='rgba(56,189,248,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(56,189,248,0.1)'; }}
              onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Destino</label>
            <input required pattern="[^,]+,.+" title="Informe qualquer cidade brasileira e UF/estado, por exemplo: Rio de Janeiro, RJ" placeholder="Ex: Rio de Janeiro, RJ" value={destination} onChange={e => setDestination(e.target.value)} style={inputStyle}
              onFocus={e => { e.target.style.borderColor='rgba(56,189,248,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(56,189,248,0.1)'; }}
              onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; }}
            />
          </div>

          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            O simulador traçará a rota real usando GPS (OSRM) e iniciará a movimentação do veículo instantaneamente a partir da Origem.
          </div>

          <button type="submit" disabled={loading} style={{
            padding: '14px', borderRadius: '10px', border: 'none',
            background: loading ? 'rgba(56,189,248,0.5)' : 'linear-gradient(135deg, #38BDF8, #60A5FA)',
            color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 20px rgba(56,189,248,0.3)', marginTop: '8px'
          }}>
            {loading ? 'Traçando...' : 'Iniciar Viagem'}
          </button>
        </form>
      </div>
    </div>
  );
}
