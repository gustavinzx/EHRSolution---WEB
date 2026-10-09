import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ShieldCheck, Plus, Check, X, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck color="#2FBEB5" /> Gestão de Usuários
        </h1>
        <button onClick={() => setShowModal(true)} style={btnStyle}>
          <Plus size={16} /> Novo Usuário
        </button>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.2)', color: '#94a3b8' }}>
              <th style={{ padding: '12px 16px' }}>Nome</th>
              <th style={{ padding: '12px 16px' }}>E-mail</th>
              <th style={{ padding: '12px 16px' }}>Papel (Role)</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '12px 16px', color: '#fff' }}>{u.name} {u.id === user.id ? '(Você)' : ''}</td>
                <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{u.email}</td>
                <td style={{ padding: '12px 16px' }}>
                  <select 
                    value={u.role} 
                    onChange={e => handleChangeRole(u.id, e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.2)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px' }}
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Gestor</option>
                    <option value="auditor">Auditor</option>
                  </select>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {u.is_active ? 
                    <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14}/> Ativo</span> : 
                    <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}><X size={14}/> Inativo</span>
                  }
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button 
                    onClick={() => handleToggleActive(u.id, u.is_active)}
                    style={{ background: u.is_active ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)', color: u.is_active ? '#f87171' : '#34d399', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#111d27', padding: '24px', borderRadius: '12px', width: '400px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 20px', color: '#fff' }}>Novo Usuário</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input required placeholder="Nome" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} style={inputStyle} />
              <input required type="email" placeholder="E-mail" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} style={inputStyle} />
              <input required type="password" minLength={8} placeholder="Senha (mín 8 carac.)" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} style={inputStyle} />
              <select value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})} style={inputStyle}>
                <option value="manager">Gestor</option>
                <option value="auditor">Auditor</option>
                <option value="admin">Admin</option>
              </select>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ flex: 1, padding: '10px', background: '#2FBEB5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = { background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 };
const inputStyle = { padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' };
