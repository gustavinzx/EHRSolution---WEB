import React, { useState, useEffect } from 'react';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import { MapPin, Search, Plus, MapPinOff, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
};

export default function StationsPage() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', lat: '', lng: '', is_authorized: true });

  const fetchStations = async () => {
    try {
      const { data } = await client.get('/fueling/stations');
      setStations(data);
    } catch (err) {
      toast.error('Erro ao carregar postos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStations(); }, []);

  const handleToggle = async (id) => {
    try {
      await client.patch(`/fueling/stations/${id}/toggle`);
      toast.success('Status alterado');
      fetchStations();
    } catch (err) {
      toast.error('Erro ao alterar status');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await client.post('/fueling/stations', formData);
      toast.success('Posto cadastrado');
      setIsModalOpen(false);
      fetchStations();
    } catch (err) {
      toast.error('Erro ao cadastrar');
    }
  };

  const filtered = stations.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff', margin: 0 }}>
            Rede Autorizada
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
            {stations.filter(s => s.is_authorized).length} postos autorizados para destrava
          </p>
        </div>
        <button
          onClick={() => { setFormData({ name: '', address: '', lat: '', lng: '', is_authorized: true }); setIsModalOpen(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 18px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #38BDF8, #60A5FA)',
            color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(56,189,248,0.3)',
          }}
        >
          <Plus size={16} /> Novo Posto
        </button>
      </div>

      <div style={{ position: 'relative', maxWidth: '320px' }}>
        <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text" placeholder="Buscar posto..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff', padding: '10px 14px 10px 38px', borderRadius: '10px',
            width: '100%', fontSize: '14px', outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {filtered.map(s => (
          <div key={s.id} style={{ ...glass, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: s.is_authorized ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.is_authorized ? '#34d399' : '#f87171' }}>
                  {s.is_authorized ? <MapPin size={18} /> : <MapPinOff size={18} />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {s.id} • Lat/Lng</div>
                </div>
              </div>
              <button
                onClick={() => handleToggle(s.id)}
                title={s.is_authorized ? "Bloquear" : "Autorizar"}
                style={{ background: 'transparent', border: 'none', color: s.is_authorized ? '#34d399' : '#f87171', cursor: 'pointer' }}
              >
                {s.is_authorized ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              </button>
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
              {s.address || 'Sem endereço cadastrado.'}
              <br />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>GPS: {s.lat}, {s.lng}</span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <form onSubmit={handleSave} style={{ background: 'rgba(11,20,36,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', width: '100%', maxWidth: '440px', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>Cadastrar Posto</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input placeholder="Nome do posto" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px', borderRadius: '10px' }} />
              <input placeholder="Endereço (opcional)" value={formData.address} onChange={e=>setFormData({...formData, address: e.target.value})} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px', borderRadius: '10px' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input placeholder="Latitude" required type="number" step="any" value={formData.lat} onChange={e=>setFormData({...formData, lat: e.target.value})} style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px', borderRadius: '10px' }} />
                <input placeholder="Longitude" required type="number" step="any" value={formData.lng} onChange={e=>setFormData({...formData, lng: e.target.value})} style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px', borderRadius: '10px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #38BDF8, #60A5FA)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
