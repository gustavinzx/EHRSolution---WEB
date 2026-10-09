import React, { useState } from 'react';
import { useDrivers } from '../hooks/useDrivers';
import { useFleet } from '../hooks/useFleet';
import DriverModal    from '../components/DriverModal';
import EnrollmentModal from '../components/EnrollmentModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { UserPlus, Search, Users, UserX, UserCheck, Truck, Fuel, ShieldCheck, ShieldAlert, Edit2, Camera, Trash2 } from 'lucide-react';

const glass = {
  background: 'rgba(255,255,255,0.03)', 
  border: '1px solid rgba(255,255,255,0.06)', 
  borderRadius: '20px',
  transition: 'transform 0.2s ease, border-color 0.2s',
};

export default function DriversPage() {
  const { drivers, loading, createDriver, updateDriver, deactivateDriver, activateDriver, assignTruck, enrollFace, removeFace } = useDrivers();
  const { trucks } = useFleet();
  const [search,       setSearch]       = useState('');
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [editingDriver,setEditingDriver] = useState(null);
  const [assigning, setAssigning] = useState({});
  const [enrollDriverTarget, setEnrollDriverTarget] = useState(null);

  const filtered = drivers.filter(d => (d.name || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => a.name.localeCompare(b.name));

  const handleSave = async (data) => {
    const ok = editingDriver
      ? await updateDriver(editingDriver.id, data)
      : await createDriver(data);
    if (ok) { setIsModalOpen(false); setEditingDriver(null); }
  };

  const handleToggleActive = async (driver) => {
    const action = driver.is_active ? deactivateDriver : activateDriver;
    if (window.confirm(`${driver.is_active ? 'Atenção: desativar o motorista cancelará imediatamente qualquer sessão de abastecimento em andamento e cortará o acesso dele ao sistema. Confirmar desativação?' : 'Reativar acesso facial e operações deste motorista?'}`)) {
      await action(driver.id);
    }
  };

  const handleAssign = async (driverId) => {
    const truckId = assigning[driverId];
    if (!truckId) return;
    await assignTruck(driverId, truckId);
    setAssigning(prev => ({ ...prev, [driverId]: '' }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>

      {/* Hero Header */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '32px 40px', borderRadius: '24px',
        background: 'linear-gradient(135deg, #111b28 0%, #1a2a3a 100%)',
        border: '1px solid rgba(47,190,181,0.2)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(47,190,181,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(47,190,181,0.3)' }}>
            <Users size={32} color="#2FBEB5" />
          </div>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
              Gestão de Motoristas
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '15px' }}>
              Controle de identidades, biometria e permissões da frota.
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingRight: '24px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#2FBEB5' }}>{drivers.filter(d => d.is_active).length}</span>
            <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Ativos</span>
          </div>
          <button
            onClick={() => { setEditingDriver(null); setIsModalOpen(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '14px 24px', borderRadius: '14px', border: 'none',
              background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
              color: '#fff', fontWeight: 700, fontSize: '15px', 
              cursor: 'pointer', boxShadow: '0 8px 24px rgba(47,190,181,0.3)',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <UserPlus size={18} /> Cadastrar Motorista
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '380px' }}>
          <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text" placeholder="Buscar motorista por nome..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: '#111b28', border: '1px solid #1f2e3b',
              color: '#fff', padding: '12px 16px 12px 42px', borderRadius: '12px',
              width: '100%', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s'
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#2FBEB5'}
            onBlur={e => e.currentTarget.style.borderColor = '#1f2e3b'}
          />
        </div>
      </div>

      {/* Drivers Grid */}
      {filtered.length === 0 ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#64748b', background: '#111b28', borderRadius: '20px', border: '1px dashed #1f2e3b' }}>
          <Users size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#e2e8f0' }}>Nenhum motorista encontrado</div>
          <div style={{ marginTop: '8px' }}>Tente buscar por um nome diferente ou cadastre um novo.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
          {filtered.map(d => (
            <div key={d.id} 
              style={{ 
                ...glass, 
                display: 'flex', flexDirection: 'column',
                background: '#111b28',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(47,190,181,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
            >
              
              {/* Card Header (Profile Info) */}
              <div style={{ padding: '24px', display: 'flex', gap: '16px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ position: 'relative' }}>
                  <img src={`https://i.pravatar.cc/150?u=${d.id + 10}`} alt={d.name} 
                       style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #1f2e3b' }} />
                  <div style={{ 
                    position: 'absolute', bottom: '-4px', right: '-4px', width: '22px', height: '22px', 
                    borderRadius: '50%', background: d.is_active ? '#34d399' : '#f87171', border: '3px solid #111b28',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' 
                  }}>
                    {d.is_active ? <ShieldCheck size={10} color="#000" /> : <ShieldAlert size={10} color="#fff" />}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    {d.email || d.phone || 'Sem contato'}
                  </div>
                </div>
                <button onClick={() => { setEditingDriver(d); setIsModalOpen(true); }} 
                        style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        title="Editar Perfil">
                  <Edit2 size={16} />
                </button>
              </div>

              {/* Card Body (Stats & Vehicles) */}
              <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Biometria */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: d.face_enrolled ? 'rgba(47,190,181,0.1)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Camera size={16} color={d.face_enrolled ? '#2FBEB5' : '#64748b'} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: d.face_enrolled ? '#e2e8f0' : '#94a3b8' }}>{d.face_enrolled ? 'Biometria Ativa' : 'Sem Biometria'}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Autenticação facial</div>
                    </div>
                  </div>
                  {d.face_enrolled ? (
                    <button onClick={() => window.confirm('Revogar biometria deste motorista?') && removeFace(d.id)} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }} title="Revogar Biometria">
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <button onClick={() => setEnrollDriverTarget(d)} style={{ background: 'rgba(47,190,181,0.1)', border: '1px solid rgba(47,190,181,0.2)', color: '#2FBEB5', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      Cadastrar
                    </button>
                  )}
                </div>

                {/* Vehicles Tags */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Veículos Vinculados</div>
                  {d.assigned_trucks && d.assigned_trucks.length > 0 ? (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {d.assigned_trucks.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(47,190,181,0.08)', border: '1px solid rgba(47,190,181,0.2)', padding: '6px 10px', borderRadius: '8px', color: '#2FBEB5', fontSize: '13px', fontWeight: 600 }}>
                          <Truck size={14} /> {t.plate}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>Nenhum veículo vinculado</div>
                  )}
                </div>

                {/* KPI Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: 'auto' }}>
                  <div style={{ background: '#182430', padding: '12px', borderRadius: '12px', border: '1px solid #1f2e3b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                      <Fuel size={14} /> Histórico
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{d.fueling_count || 0}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>abastecimentos</div>
                  </div>
                  <div style={{ background: '#182430', padding: '12px', borderRadius: '12px', border: '1px solid #1f2e3b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                      Volume Total
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{parseFloat(d.fueling_volume || 0).toFixed(0)}L</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>litros liberados</div>
                  </div>
                </div>

              </div>

              {/* Card Footer (Quick Actions) */}
              <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.04)', padding: '12px' }}>
                <button 
                  onClick={() => { setEditingDriver(d); setIsModalOpen(true); }}
                  style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '8px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: 'pointer', borderRadius: '8px', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                  <Edit2 size={14} />
                  Editar Cadastro
                </button>
                
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.04)', margin: '0 12px' }} />
                
                <button 
                  onClick={() => handleToggleActive(d)} 
                  style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '8px', background: 'transparent', border: 'none', color: d.is_active ? '#f87171' : '#34d399', fontSize: '12px', fontWeight: 600, cursor: 'pointer', borderRadius: '8px', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = d.is_active ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {d.is_active ? <UserX size={14}/> : <UserCheck size={14}/>}
                  {d.is_active ? 'Bloquear Acesso' : 'Desbloquear'}
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      <DriverModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingDriver(null); }}
        onSave={handleSave}
        driver={editingDriver}
      />
      <EnrollmentModal
        isOpen={!!enrollDriverTarget}
        onClose={() => setEnrollDriverTarget(null)}
        onEnroll={enrollFace}
        driver={enrollDriverTarget}
      />
    </div>
  );
}






