import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ShieldCheck, Plus, Check, X, ShieldAlert, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

const glass = {
  background: 'rgba(11, 22, 40, 0.75)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(0, 212, 255, 0.14)',
  borderRadius: '16px',
};

const inputStyle = {
  padding: '11px 14px',
  background: 'rgba(6, 11, 19, 0.7)',
  border: '1px solid rgba(0, 212, 255, 0.2)',
  borderRadius: '10px',
  color: '#fff',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
  fontFamily: 'Inter, sans-serif',
};

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'manager' });

  if (user?.role !== 'admin') {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0', color: '#f87171' }}>
        <ShieldAlert size={64} style={{ marginBottom: '20px' }} />
        <h2>Acesso Negado</h2>
        <p>Apenas administradores podem gerenciar usuários do painel.</p>
      </div>
    );
  }

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await client.get('/users');
      setUsers(res.data);
    } catch (e) {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await client.post('/users', formData);
      toast.success('Usuário criado');
      setShowModal(false);
      fetchUsers();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao criar');
    }
  };

  const handleToggleActive = async (uId, currentStatus) => {
    try {
      await client.patch(`/users/${uId}`, { is_active: !currentStatus });
      toast.success('Status atualizado');
      fetchUsers();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao alterar status');
    }
  };

  const handleChangeRole = async (uId, newRole) => {
    try {
      await client.patch(`/users/${uId}`, { role: newRole });
      toast.success('Papel atualizado');
      fetchUsers();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao alterar papel');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
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
            <UserCheck size={26} color="#00D4FF" />
          </div>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
              Gestão de Usuários
            </h1>
            <p style={{ margin: '4px 0 0', color: '#8899A6', fontSize: '13px' }}>
              Controle de acesso, papéis (RBAC) e credenciais administrativas da plataforma.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
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
            boxShadow: '0 0 16px rgba(0, 212, 255, 0.35)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Plus size={16} /> Novo Usuário
        </button>
      </div>

      <div style={{ ...glass, overflow: 'hidden', background: 'rgba(11, 22, 40, 0.75)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'rgba(6, 11, 19, 0.6)', borderBottom: '1px solid rgba(0, 212, 255, 0.12)' }}>
              <th style={{ padding: '16px 20px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', fontSize: '11px' }}>Nome</th>
              <th style={{ padding: '16px 20px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', fontSize: '11px' }}>E-mail</th>
              <th style={{ padding: '16px 20px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', fontSize: '11px' }}>Papel (Role)</th>
              <th style={{ padding: '16px 20px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', fontSize: '11px' }}>Status</th>
              <th style={{ padding: '16px 20px', textAlign: 'right', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', fontSize: '11px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr
                key={u.id}
                style={{ borderTop: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 212, 255, 0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '14px 20px', color: '#fff', fontWeight: 600 }}>{u.name} {u.id === user.id ? <span style={{ color: '#00D4FF', fontSize: '11px', fontWeight: 800 }}>(Você)</span> : ''}</td>
                <td style={{ padding: '14px 20px', color: '#8899A6', fontFamily: "'IBM Plex Mono', monospace" }}>{u.email}</td>
                <td style={{ padding: '14px 20px' }}>
                  <select 
                    value={u.role} 
                    onChange={e => handleChangeRole(u.id, e.target.value)}
                    style={{ background: 'rgba(6, 11, 19, 0.7)', color: '#00D4FF', border: '1px solid rgba(0, 212, 255, 0.25)', padding: '6px 10px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', outline: 'none' }}
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Gestor</option>
                    <option value="auditor">Auditor</option>
                  </select>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  {u.is_active ? 
                    <span style={{ color: '#00F5A0', display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(0, 245, 160, 0.12)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(0, 245, 160, 0.3)', fontWeight: 700, fontSize: '11px' }}><Check size={13}/> Ativo</span> : 
                    <span style={{ color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(248, 113, 113, 0.12)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(248, 113, 113, 0.3)', fontWeight: 700, fontSize: '11px' }}><X size={13}/> Inativo</span>
                  }
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                  <button 
                    onClick={() => handleToggleActive(u.id, u.is_active)}
                    style={{
                      background: u.is_active ? 'rgba(248,113,113,0.12)' : 'rgba(0,245,160,0.12)',
                      color: u.is_active ? '#f87171' : '#00F5A0',
                      border: u.is_active ? '1px solid rgba(248,113,113,0.35)' : '1px solid rgba(0,245,160,0.35)',
                      padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '12px'
                    }}
                  >
                    {u.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'rgba(11, 22, 40, 0.98)', padding: '28px', borderRadius: '20px', width: '100%', maxWidth: '440px', border: '1px solid rgba(0, 212, 255, 0.35)', boxShadow: '0 24px 80px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 212, 255, 0.2)' }}>
            <h3 style={{ margin: '0 0 20px', color: '#fff', fontSize: '18px', fontWeight: 800 }}>Novo Usuário Administrativo</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input required placeholder="Nome completo" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} style={inputStyle} />
              <input required type="email" placeholder="E-mail corporativo" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} style={inputStyle} />
              <input required type="password" minLength={8} placeholder="Senha segura (mín 8 carac.)" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} style={inputStyle} />
              <select value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})} style={inputStyle}>
                <option value="manager" style={{ background: '#0B1628' }}>Gestor de Frota</option>
                <option value="auditor" style={{ background: '#0B1628' }}>Auditor (Somente Leitura)</option>
                <option value="admin" style={{ background: '#0B1628' }}>Administrador Total</option>
              </select>
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                <button type="submit" style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg, #00D4FF, #0072FF)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 800, boxShadow: '0 0 16px rgba(0, 212, 255, 0.35)' }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
