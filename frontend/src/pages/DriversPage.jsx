import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDrivers } from '../hooks/useDrivers';
import { useFleet } from '../hooks/useFleet';
import DriverModal from '../components/DriverModal';
import EnrollmentModal from '../components/EnrollmentModal';
import LoadingSpinner from '../components/LoadingSpinner';
import DriverDetailsModal from '../components/DriverDetailsModal';
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
  X,
  ScanFace,
  Eye
} from 'lucide-react';


const glass = {
  background: 'rgba(11, 22, 40, 0.75)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(0, 212, 255, 0.14)',
  borderRadius: '16px',
};

function getInitials(name) {
  if (!name) return 'M';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

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
    unassignTruck,
    deleteDriver,
    enrollFace,
    removeFace,
    fetchDriverScore,
    fetchDriverPassword
  } = useDrivers();
  const { trucks } = useFleet();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [assigning, setAssigning] = useState({});
  const [enrollDriverTarget, setEnrollDriverTarget] = useState(null);
  const [detailsDriver, setDetailsDriver] = useState(null);

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
        `${driver.is_active
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

  const handleUnassign = async (driverId, truckId) => {
    if (window.confirm('Deseja realmente desvincular este caminhão do motorista?')) {
      await unassignTruck(driverId, truckId);
    }
  };

  const handleDeleteDriver = async driver => {
    if (window.confirm(`Deseja realmente excluir permanentemente o cadastro de ${driver.name}?`)) {
      await deleteDriver(driver.id);
    }
  };

  if (loading && drivers.length === 0) return <LoadingSpinner />;

  const activeCount = drivers.filter(d => d.is_active).length;
  const bioCount = drivers.filter(d => d.face_enrolled).length;
  const totalAssigned = drivers.filter(d => (d.assigned_trucks || []).length > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
      {/* ── Page Header ── */}
      <div style={{
        ...glass,
        padding: '26px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(6, 11, 19, 0.95) 0%, rgba(13, 25, 43, 0.95) 100%)',
        border: '1px solid rgba(0, 212, 255, 0.22)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(0, 114, 255, 0.2))',
            border: '1px solid rgba(0, 212, 255, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0, 212, 255, 0.25)',
          }}>
            <Users size={26} color="#00D4FF" />
          </div>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
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
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #00D4FF, #0072FF)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(0, 212, 255, 0.35)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <UserPlus size={16} /> Cadastrar Motorista
            </button>
          )}
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: 'Total de Motoristas', val: drivers.length, sub: 'cadastros ativos', color: '#00D4FF', icon: Users, bg: 'rgba(0, 212, 255, 0.08)' },
          { label: 'Motoristas Ativos', val: activeCount, sub: 'com permissão de acesso', color: '#00F5A0', icon: CheckCircle2, bg: 'rgba(0, 245, 160, 0.08)' },
          { label: 'Biometria Facial Ativa', val: bioCount, sub: 'reconhecimento liberado', color: '#38BDF8', icon: ScanFace, bg: 'rgba(56, 189, 248, 0.08)' },
          { label: 'Caminhões Vinculados', val: totalAssigned, sub: 'motoristas escalados', color: '#F59E0B', icon: Truck, bg: 'rgba(245, 158, 11, 0.08)' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            ...glass,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            background: kpi.bg,
            border: `1px solid ${kpi.color}33`,
            boxShadow: `0 4px 20px ${kpi.color}15`,
            transition: 'transform 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#8899A6', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px' }}>
                {kpi.label}
              </span>
              <kpi.icon size={16} color={kpi.color} />
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF', marginTop: '2px', fontFamily: "'IBM Plex Mono', monospace" }}>
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
        background: 'rgba(11, 22, 40, 0.75)',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', width: '340px' }}>
          <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(6, 11, 19, 0.7)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: '10px',
              padding: '9px 14px 9px 38px',
              color: '#FFFFFF',
              fontSize: '13px',
              outline: 'none',
              fontFamily: 'Inter, sans-serif',
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
                border: filterType === f.id ? '1px solid #00D4FF' : '1px solid rgba(255, 255, 255, 0.08)',
                background: filterType === f.id ? 'rgba(0, 212, 255, 0.16)' : 'rgba(255, 255, 255, 0.03)',
                color: filterType === f.id ? '#00D4FF' : '#8899A6',
                boxShadow: filterType === f.id ? '0 0 12px rgba(0, 212, 255, 0.2)' : 'none',
                transition: 'all 0.2s',
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
          background: 'rgba(11, 22, 40, 0.75)',
        }}>
          <Users size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#E2E8F0' }}>Nenhum motorista encontrado</div>
          <div style={{ marginTop: '8px', fontSize: '13px' }}>Tente alterar os termos de busca ou cadastre um novo motorista.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filtered.map(d => {
            const assignedList = d.assigned_trucks || [];
            const avatarBorder = !d.is_active
              ? '2px solid #EF4444'
              : d.face_enrolled
                ? '2px solid #00F5A0'
                : '2px solid #F59E0B';
            const avatarGlow = !d.is_active
              ? '0 0 10px rgba(239, 68, 68, 0.35)'
              : d.face_enrolled
                ? '0 0 12px rgba(0, 245, 160, 0.35)'
                : '0 0 8px rgba(245, 158, 11, 0.25)';

            return (
              <div
                key={d.id}
                style={{
                  ...glass,
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  background: 'rgba(11, 22, 40, 0.82)',
                  position: 'relative',
                  opacity: d.is_active ? 1 : 0.65,
                  transition: 'border-color 0.2s, transform 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.4)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.14)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {/* Header: Avatar, Name & Edit Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div
                      data-testid={`driver-avatar-${d.id}`}
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '14px',
                        backgroundColor: '#070D18',
                        border: avatarBorder,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: avatarGlow,
                      }}
                    >
                      {d.face_photo && d.face_photo !== 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=' ? (
                        <img
                          src={d.face_photo}
                          alt={d.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <span
                        data-testid={`driver-initials-${d.id}`}
                        style={{
                          display:
                            d.face_photo &&
                              d.face_photo !== 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
                              ? 'none'
                              : 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          height: '100%',
                          fontSize: '15px',
                          fontWeight: 800,
                          color: '#00D4FF',
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}
                      >
                        {getInitials(d.name)}
                      </span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF' }}>
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
                  <button
                    onClick={() => setDetailsDriver(d)}
                    title="Ver detalhes, score e senha"
                    style={{ width: '28px', height: '28px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Eye size={14} />
                  </button>

                  {user?.role !== 'auditor' && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => {
                          setEditingDriver(d);
                          setIsModalOpen(true);
                        }}
                        title="Editar motorista"
                        style={{
                          width: '28px',
                          height: '28px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          color: '#64748B',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#00D4FF'; e.currentTarget.style.borderColor = '#00D4FF'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteDriver(d)}
                        title="Excluir motorista"
                        style={{
                          width: '28px',
                          height: '28px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: '8px',
                          color: '#EF4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Biometrics Status Card */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: d.face_enrolled ? 'rgba(0, 245, 160, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                  border: d.face_enrolled ? '1px solid rgba(0, 245, 160, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {d.face_enrolled ? (
                      <ShieldCheck size={16} color="#00F5A0" />
                    ) : (
                      <ShieldAlert size={16} color="#F59E0B" />
                    )}
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: d.face_enrolled ? '#00F5A0' : '#F59E0B',
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
                          background: 'linear-gradient(135deg, #00D4FF, #0072FF)',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '6px 14px',
                          cursor: 'pointer',
                          boxShadow: '0 0 12px rgba(0, 212, 255, 0.35)',
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
                            background: 'rgba(0, 212, 255, 0.1)',
                            border: '1px solid rgba(0, 212, 255, 0.35)',
                            color: '#00D4FF',
                            letterSpacing: '0.5px',
                            fontFamily: "'IBM Plex Mono', monospace",
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {t.plate && <span>{t.plate}</span>}
                          {t.model && <span style={{ opacity: 0.7, marginLeft: '4px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>• {t.model}</span>}
                          {user?.role !== 'auditor' && (
                            <button
                              type="button"
                              title="Desvincular caminhão"
                              onClick={() => handleUnassign(d.id, t.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#EF4444',
                                cursor: 'pointer',
                                padding: '0 2px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginLeft: '2px',
                              }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>
                        Nenhum caminhão vinculado
                      </span>
                    )}
                  </div>

                  {/* Vincular novo caminhão — apenas se o motorista não tiver nenhum caminhão vinculado */}
                  {user?.role !== 'auditor' && assignedList.length === 0 && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={assigning[d.id] || ''}
                        onChange={e => setAssigning({ ...assigning, [d.id]: e.target.value })}
                        style={{
                          flex: 1,
                          background: 'rgba(6, 11, 19, 0.7)',
                          border: '1px solid rgba(0, 212, 255, 0.15)',
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
                          background: assigning[d.id] ? 'linear-gradient(135deg, #00D4FF, #0072FF)' : 'rgba(255, 255, 255, 0.05)',
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
                  borderTop: '1px solid rgba(0, 212, 255, 0.08)',
                  marginTop: 'auto',
                }}>
                  <div style={{ fontSize: '12px', color: '#8899A6', fontFamily: "'IBM Plex Mono', monospace" }}>
                    Tel: {d.phone || '—'}
                  </div>

                  {user?.role !== 'auditor' && (
                    <button
                      type="button"
                      onClick={() => handleToggleActive(d)}
                      style={{
                        background: d.is_active ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0, 245, 160, 0.12)',
                        border: d.is_active ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(0, 245, 160, 0.35)',
                        color: d.is_active ? '#EF4444' : '#00F5A0',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '6px 12px',
                        transition: 'all 0.2s ease',
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
        trucks={trucks}
      />

      <DriverDetailsModal
        driver={detailsDriver}
        onClose={() => setDetailsDriver(null)}
        onEdit={d => { setEditingDriver(d); setIsModalOpen(true); }}
        loadScore={fetchDriverScore}
        loadPassword={fetchDriverPassword}
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
