import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDrivers } from '../hooks/useDrivers';
import { useFleet } from '../hooks/useFleet';
import DriverModal from '../components/DriverModal';
import EnrollmentModal from '../components/EnrollmentModal';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  UserPlus,
  Search,
  Users,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Trash2,
  Truck,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

const glass = {
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '16px',
};

export default function DriversPage() {
  const { user } = useAuth();
  const {
    drivers,
    loading,
    createDriver,
    updateDriver,
    deactivateDriver,
    activateDriver,
    assignTruck,
    enrollFace,
    removeFace,
  } = useDrivers();
  const { trucks } = useFleet();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, ACTIVE, BIO, NO_BIO
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [assigning, setAssigning] = useState({});
  const [enrollDriverTarget, setEnrollDriverTarget] = useState(null);

  const filtered = drivers
    .filter(d => {
      const matchSearch =
        (d.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.phone || '').includes(search);
      if (!matchSearch) return false;

      if (filterType === 'ACTIVE') return d.is_active;
      if (filterType === 'BIO') return d.face_enrolled;
      if (filterType === 'NO_BIO') return !d.face_enrolled;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSave = async data => {
    const res = editingDriver
      ? await updateDriver(editingDriver.id, data)
      : await createDriver(data);
    if (res) {
      if (!res.temporary_password) {
        setIsModalOpen(false);
        setEditingDriver(null);
      }
      return res;
    }
    return null;
  };

  const handleToggleActive = async driver => {
    const action = driver.is_active ? deactivateDriver : activateDriver;
    if (
      window.confirm(
        `${
          driver.is_active
            ? 'Atenção: desativar o motorista cancelará imediatamente qualquer sessão de abastecimento em andamento e cortará o acesso dele ao sistema. Confirmar desativação?'
            : 'Reativar acesso facial e operações deste motorista?'
        }`
      )
    ) {
      await action(driver.id);
    }
  };

  const handleAssign = async driverId => {
    const truckId = assigning[driverId];
    if (!truckId) return;
    await assignTruck(driverId, truckId);
    setAssigning(prev => ({ ...prev, [driverId]: '' }));
  };

  if (loading && drivers.length === 0) return <LoadingSpinner />;

  const activeCount = drivers.filter(d => d.is_active).length;
  const bioCount = drivers.filter(d => d.face_enrolled).length;
  const totalAssigned = drivers.filter(d => (d.assigned_trucks || []).length > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
      {/* ── Page Header ── */}
      <div style={{
        ...glass,
        padding: '24px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(7, 16, 27, 0.95) 0%, rgba(15, 27, 44, 0.95) 100%)',
        border: '1px solid rgba(0, 196, 208, 0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'rgba(0, 196, 208, 0.1)',
            border: '1px solid rgba(0, 196, 208, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Users size={26} color="#00C4D0" />
          </div>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
              Gestão de Motoristas
            </h1>
            <p style={{ margin: '4px 0 0', color: '#8899A6', fontSize: '13px' }}>
              Identidades, validação biométrica facial e permissões da frota.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {user?.role !== 'auditor' && (
            <button
              onClick={() => {
                setEditingDriver(null);
                setIsModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #00C4D0, #0284C7)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 196, 208, 0.3)',
              }}
            >
              <UserPlus size={16} /> Cadastrar Motorista
            </button>
          )}
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: 'Total de Motoristas', val: drivers.length, sub: 'cadastros no sistema', color: '#00C4D0' },
          { label: 'Motoristas Ativos', val: activeCount, sub: 'com permissão de acesso', color: '#10B981' },
          { label: 'Biometria Facial Ativa', val: bioCount, sub: 'reconhecimento liberado', color: '#38BDF8' },
          { label: 'Caminhões Vinculados', val: totalAssigned, sub: 'motoristas com veículo', color: '#F59E0B' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            ...glass,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            background: 'rgba(11, 20, 32, 0.65)',
          }}>
            <span style={{ fontSize: '11px', color: '#8899A6', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px' }}>
              {kpi.label}
            </span>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#FFFFFF', marginTop: '2px' }}>
              {kpi.val}
            </div>
            <span style={{ fontSize: '11px', color: kpi.color, fontWeight: 600 }}>
              {kpi.sub}
            </span>
          </div>
        ))}
      </div>

      {/* ── Search & Filters Toolbar ── */}
      <div style={{
        ...glass,
        padding: '14px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'rgba(11, 20, 32, 0.65)',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', width: '340px' }}>
          <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input
            type="text"
            placeholder="Buscar motorista por nome, e-mail ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '9px 14px 9px 38px',
              color: '#FFFFFF',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'ACTIVE', label: 'Ativos' },
            { id: 'BIO', label: 'Com Biometria' },
            { id: 'NO_BIO', label: 'Não Cadastrados' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                border: filterType === f.id ? '1px solid rgba(0, 196, 208, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                background: filterType === f.id ? 'rgba(0, 196, 208, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: filterType === f.id ? '#00C4D0' : '#8899A6',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Drivers Grid ── */}
      {filtered.length === 0 ? (
        <div style={{
          ...glass,
          padding: '80px 20px',
          textAlign: 'center',
          color: '#64748B',
          background: 'rgba(11, 20, 32, 0.65)',
        }}>
          <Users size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#E2E8F0' }}>Nenhum motorista encontrado</div>
          <div style={{ marginTop: '8px', fontSize: '13px' }}>Tente alterar os termos de busca ou cadastre um novo motorista.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {filtered.map(d => {
            const assignedList = d.assigned_trucks || [];

            return (
              <div
                key={d.id}
                style={{
                  ...glass,
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  background: 'rgba(11, 20, 32, 0.8)',
                  position: 'relative',
                  opacity: d.is_active ? 1 : 0.65,
                }}
              >
                {/* Header: Avatar, Name & Edit Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '14px',
                      backgroundColor: '#1E293B',
                      border: '1.5px solid rgba(0, 196, 208, 0.35)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                    }}>
                      <img
                        src={d.face_photo || `https://i.pravatar.cc/150?u=${d.id + 10}`}
                        alt={d.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                          {d.name}
                        </span>
                        {!d.is_active && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            Inativo
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8899A6', marginTop: '2px' }}>
                        {d.email || 'Sem e-mail cadastrado'}
                      </div>
                    </div>
                  </div>

                  {user?.role !== 'auditor' && (
                    <button
                      onClick={() => {
                        setEditingDriver(d);
                        setIsModalOpen(true);
                      }}
                      title="Editar motorista"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '6px',
                        color: '#94A3B8',
                        cursor: 'pointer',
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>

                {/* Biometrics Status Card */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: d.face_enrolled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                  border: d.face_enrolled ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {d.face_enrolled ? (
                      <ShieldCheck size={16} color="#10B981" />
                    ) : (
                      <ShieldAlert size={16} color="#F59E0B" />
                    )}
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: d.face_enrolled ? '#10B981' : '#F59E0B',
                    }}>
                      {d.face_enrolled ? 'Biometria Ativa' : 'Sem Biometria'}
                    </span>
                  </div>

                  {user?.role !== 'auditor' && (
                    d.face_enrolled ? (
                      <button
                        onClick={() => removeFace(d.id)}
                        title="Remover biometria"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#EF4444',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => setEnrollDriverTarget(d)}
                        style={{
                          background: '#00C4D0',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '5px 12px',
                          cursor: 'pointer',
                        }}
                      >
                        Cadastrar
                      </button>
                    )
                  )}
                </div>

                {/* Veículos Vinculados */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8899A6', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                    Veículos Vinculados
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                    {assignedList.length > 0 ? (
                      assignedList.map(t => (
                        <span
                          key={t.id || t.plate}
                          style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            padding: '4px 10px',
                            borderRadius: '8px',
                            background: 'rgba(0, 196, 208, 0.1)',
                            border: '1px solid rgba(0, 196, 208, 0.3)',
                            color: '#00C4D0',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {t.plate && <span>{t.plate}</span>}
                          {t.model && <span style={{ opacity: 0.7, marginLeft: '4px' }}>• {t.model}</span>}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>
                        Nenhum caminhão vinculado
                      </span>
                    )}
                  </div>

                  {/* Vincular novo caminhão */}
                  {user?.role !== 'auditor' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={assigning[d.id] || ''}
                        onChange={e => setAssigning({ ...assigning, [d.id]: e.target.value })}
                        style={{
                          flex: 1,
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          color: '#FFFFFF',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="">+ Vincular caminhão...</option>
                        {trucks.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.plate} - {t.model}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAssign(d.id)}
                        disabled={!assigning[d.id]}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: assigning[d.id] ? '#00C4D0' : 'rgba(255, 255, 255, 0.05)',
                          color: assigning[d.id] ? '#FFFFFF' : '#64748B',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: assigning[d.id] ? 'pointer' : 'default',
                        }}
                      >
                        Vincular
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  marginTop: 'auto',
                }}>
                  <div style={{ fontSize: '12px', color: '#8899A6' }}>
                    Tel: {d.phone || '—'}
                  </div>

                  {user?.role !== 'auditor' && (
                    <button
                      type="button"
                      onClick={() => handleToggleActive(d)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: d.is_active ? '#F87171' : '#10B981',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '4px 8px',
                      }}
                    >
                      {d.is_active ? 'Bloquear Acesso' : 'Reativar Acesso'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <DriverModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingDriver(null);
        }}
        onSave={handleSave}
        driver={editingDriver}
      />

      <EnrollmentModal
        isOpen={Boolean(enrollDriverTarget)}
        driver={enrollDriverTarget}
        onClose={() => setEnrollDriverTarget(null)}
        onEnroll={enrollFace}
      />
    </div>
  );
}
