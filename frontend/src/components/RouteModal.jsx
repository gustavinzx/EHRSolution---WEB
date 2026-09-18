import React, { useState } from 'react';
import { X, Map, Info } from 'lucide-react';
import client from '../api/client';
import toast from 'react-hot-toast';
import AddressAutocomplete from './AddressAutocomplete';

export default function RouteModal({ isOpen, onClose, truckId, onConfigured }) {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!origin || !destination) {
      toast.error('Selecione endereços válidos na lista suspensa.');
      return;
    }
    setLoading(true);
    const toastId = toast.loading('Calculando rota pelas rodovias...');
    try {
      const res = await client.post(`/fleet/${truckId}/route`, { origin, destination });
      toast.success(`Rota calculada com sucesso! (${res.data.route_points} pontos)`, { id: toastId });
      onConfigured?.(truckId);
      onClose();
      setOrigin(null); setDestination(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao calcular rota. Verifique as cidades.', { id: toastId });
    } finally {
      setLoading(false);
    }
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
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800, color: '#fff', margin: 0 }}>Definir Viagem</h2>
              <button 
                type="button"
                onClick={() => setShowInfo(!showInfo)}
                style={{ background: 'none', border: 'none', color: showInfo ? 'var(--teal)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}
                title="Como funciona?"
              >
                <Info size={16} />
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>Rastreamento real pelas rodovias</p>
          </div>
        </div>

        {showInfo && (
          <div style={{ 
            background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', 
            padding: '12px', borderRadius: '8px', marginTop: '12px', marginBottom: '16px',
            fontSize: '12px', color: '#bae6fd', lineHeight: 1.5
          }}>
            <strong>Dica de Pesquisa:</strong> Você pode buscar por quadras, bairros, endereços completos, nomes de condomínios, CEPs ou cidades (ex: <i>"Avenida Paulista, 1000"</i> ou <i>"Condomínio Sol Nascente"</i>).
            O sistema autocompleta usando GPS para máxima precisão.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: showInfo ? '8px' : '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Origem</label>
            <AddressAutocomplete 
              placeholder="Digite quadra, endereço, cidade..." 
              value={origin} 
              onChange={setOrigin} 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Destino</label>
            <AddressAutocomplete 
              placeholder="Digite o destino final..." 
              value={destination} 
              onChange={setDestination} 
            />
          </div>

          <button type="submit" disabled={loading || !origin || !destination} style={{
            padding: '14px', borderRadius: '10px', border: 'none',
            background: (loading || !origin || !destination) ? 'rgba(56,189,248,0.5)' : 'linear-gradient(135deg, #38BDF8, #60A5FA)',
            color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px',
            cursor: (loading || !origin || !destination) ? 'not-allowed' : 'pointer', boxShadow: (loading || !origin || !destination) ? 'none' : '0 4px 20px rgba(56,189,248,0.3)', marginTop: '8px',
            transition: 'all 0.2s'
          }}>
            {loading ? 'Traçando...' : 'Iniciar Viagem'}
          </button>
        </form>
      </div>
    </div>
  );
}
