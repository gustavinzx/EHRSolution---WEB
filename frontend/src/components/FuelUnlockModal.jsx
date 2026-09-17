import React, { useState } from 'react';
import useFleetState from '../store/useFleetState';
import { LockOpen, AlertTriangle, Droplets, MapPin, CheckCircle } from 'lucide-react';

export default function FuelUnlockModal() {
  const fleet = useFleetState(state => state.fleet);
  const [authorizing, setAuthorizing] = useState(false);
  const [successId, setSuccessId] = useState(null);

  // Find the first truck awaiting authorization that hasn't just been authorized
  const awaitingTruck = fleet.find(t => 
    t.route_phase === 'awaiting_fueling_authorization' && 
    t.id !== successId
  );

  if (!awaitingTruck) return null;

  const handleUnlock = async () => {
    setAuthorizing(true);
    try {
      const url = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('token');
      const res = await fetch(url + '/fleet/' + awaitingTruck.id + '/force-fueling', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSuccessId(awaitingTruck.id);
        setTimeout(() => {
          setSuccessId(null);
        }, 3000);
      }
    } catch (e) {
      console.error('Failed to unlock', e);
    } finally {
      setAuthorizing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999
    }}>
      <div style={{
        background: '#1F2E3B', border: '1px solid #33465A', borderRadius: '16px',
        padding: '32px', width: '480px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
      }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(242, 169, 59, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px'
        }}>
          <AlertTriangle size={32} color="#F2A93B" />
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, margin: '0 0 12px 0', color: '#fff' }}>
          Autorização de Abastecimento
        </h2>
        
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
          O caminhão <strong>{awaitingTruck.plate}</strong> ({awaitingTruck.model}) atingiu o nível crítico de combustível e parou no posto para reabastecer.
        </p>

        <div style={{ background: '#0a101a', borderRadius: '12px', padding: '16px', width: '100%', marginBottom: '32px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <MapPin size={16} color="var(--teal)" />
            <span style={{ color: '#fff', fontSize: '14px' }}><strong>Local:</strong> {awaitingTruck.station_name || 'Posto Rota Segura'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Droplets size={16} color="#F2A93B" />
            <span style={{ color: '#fff', fontSize: '14px' }}><strong>Nível Atual:</strong> {awaitingTruck.current_level_liters}L ({Math.round(awaitingTruck.current_level_liters/awaitingTruck.capacity_liters*100)}%)</span>
          </div>
        </div>

        <button 
          onClick={handleUnlock}
          disabled={authorizing}
          style={{
            background: 'var(--teal)', border: 'none', padding: '16px 32px', borderRadius: '12px',
            color: '#0a101a', fontWeight: 800, fontSize: '16px', cursor: 'pointer', fontFamily: 'var(--font-display)',
            display: 'flex', alignItems: 'center', gap: '12px', width: '100%', justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(47,190,181,0.3)', opacity: authorizing ? 0.7 : 1
          }}
        >
          {authorizing ? (
            'Comunicando com Hardware...'
          ) : (
            <>
              <LockOpen size={20} /> Liberar Trava do Bocal (IoT)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
