import React, { useState } from 'react';
import { useDrivers } from '../hooks/useDrivers';
import DriverModal    from '../components/DriverModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { UserPlus, Search, Users } from 'lucide-react';

const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
};

export default function DriversPage() {
  const { drivers, loading, createDriver, updateDriver, deactivateDriver } = useDrivers();
  const [search,       setSearch]       = useState('');
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [editingDriver,setEditingDriver] = useState(null);

  const filtered = drivers.filter(d => (d.name || '').toLowerCase().includes(search.toLowerCase()));

  const handleSave = async (data) => {
    const ok = editingDriver
      ? await updateDriver(editingDriver.id, data)
      : await createDriver(data);
    if (ok) { setIsModalOpen(false); setEditingDriver(null); }
  };

  const handleDeactivate = async (id) => {
    if (window.confirm('Desativar este motorista?')) await deactivateDriver(id);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff', margin: 0 }}>
            Motoristas
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
            {drivers.filter(d => d.is_active).length} ativos · {drivers.filter(d => !d.is_active).length} inativos
          </p>
        </div>
        <button
          onClick={() => { setEditingDriver(null); setIsModalOpen(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 18px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
            color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(47,190,181,0.3)',
          }}
        >
          <UserPlus size={16} /> Novo Motorista
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '320px' }}>
        <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text" placeholder="Buscar por nome..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff', padding: '10px 14px 10px 38px', borderRadius: '10px',
            width: '100%', fontSize: '14px', outline: 'none',
          }}
        />
      </div>

      {/* Table card */}
      <div style={glass}>
        <table>
          <thead>
            <tr>
              {['Nome','Telefone','Email','Status','Caminhões','Ações'].map((h,i) => (
                <th key={h} style={{ textAlign: i===5?'right':'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Users size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <div>Nenhum motorista encontrado</div>
              </td></tr>
            )}
            {filtered.map(d => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={`https://i.pravatar.cc/150?u=${d.id + 10}`} alt={d.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
                  {d.name}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {d.phone || '—'}
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{d.email || '—'}</td>
                <td>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                    background: d.is_active ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.1)',
                    color: d.is_active ? '#34d399' : '#f87171',
                    border: `1px solid ${d.is_active ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                  }}>
                    {d.is_active ? '● Ativo' : '● Inativo'}
                  </span>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--teal)' }}>
                  {d.assigned_trucks?.length > 0 ? d.assigned_trucks.map(t => t.plate).join(', ') : '—'}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => { setEditingDriver(d); setIsModalOpen(true); }}
                    style={{ background:'none', border:'none', color:'var(--teal)', cursor:'pointer', fontSize:'13px', fontWeight:500, marginRight:'12px' }}
                  >
                    Editar
                  </button>
                  {d.is_active && (
                    <button
                      onClick={() => handleDeactivate(d.id)}
                      style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:'13px', fontWeight:500 }}
                    >
                      Desativar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DriverModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingDriver(null); }}
        onSave={handleSave}
        driver={editingDriver}
      />
    </div>
  );
}
