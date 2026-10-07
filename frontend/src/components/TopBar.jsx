import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Mail, ChevronDown, User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import useFleetState from '../store/useFleetState';

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;
    client.get('/alerts?status=active').then(res => {
      if (isMounted) setActiveAlertsCount(res.data.length);
    }).catch(console.error);
    
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const unsub = useFleetState.subscribe((state) => state.lastAlert, (newAlert) => {
      if (newAlert) {
        setActiveAlertsCount(prev => prev + 1);
      }
    });
    return unsub;
  }, []);

  return (
    <header style={{
      height: '64px',
      background: 'rgba(15,22,36,0.95)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 28px',
      gap: '16px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ flex: 1, maxWidth: '380px', position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
        <input
          placeholder="Buscar caminhão, motorista..."
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '9px 14px 9px 36px',
            color: '#e2e8f0',
            fontSize: '13px',
            outline: 'none',
          }}
        />
      </div>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'capitalize' }}>{dateStr}</span>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button onClick={() => toast('Caixa de entrada vazia', { icon: '📬' })} style={{
          width: '38px', height: '38px', borderRadius: '10px',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#94a3b8', position: 'relative',
        }}>
          <Mail size={16} />
        </button>
        <button onClick={() => navigate('/alerts')} style={{
          width: '38px', height: '38px', borderRadius: '10px',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#94a3b8', position: 'relative',
        }}>
          <Bell size={16} />
          {activeAlertsCount > 0 && (
            <span style={{
              position: 'absolute', top: '-6px', right: '-6px',
              minWidth: '18px', height: '18px', borderRadius: '9px',
              background: '#f87171', border: '2px solid #0f1624',
              color: '#fff', fontSize: '10px', fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px'
            }}>
              {activeAlertsCount > 99 ? '99+' : activeAlertsCount}
            </span>
          )}
        </button>
      </div>
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <div 
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '6px 12px 6px 6px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '40px',
            cursor: 'pointer',
          }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '13px', color: '#fff', flexShrink: 0,
          }}>
            {(user?.name || 'G').charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{user?.name || 'Gestor'}</span>
          <ChevronDown size={14} color="#64748b" />
        </div>
        
        {dropdownOpen && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: '8px',
            width: '200px', background: 'rgba(15,22,36,0.98)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', overflow: 'hidden',
            padding: '4px', zIndex: 200
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{user?.name || 'Gestor Demo'}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{user?.email || 'gestor@ehr.com'}</div>
            </div>
            <div style={{ padding: '4px' }}>
              <button onClick={() => { setDropdownOpen(false); toast('Perfil em breve'); }} style={dropdownBtnStyle}><User size={14} /> Meu Perfil</button>
              <button onClick={() => { setDropdownOpen(false); toast('Configurações em breve'); }} style={dropdownBtnStyle}><Settings size={14} /> Configurações</button>
            </div>
            <div style={{ padding: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={logout} style={{...dropdownBtnStyle, color: '#f87171'}}><LogOut size={14} /> Sair</button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

const dropdownBtnStyle = {
  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
  padding: '8px 12px', background: 'transparent', border: 'none',
  color: '#e2e8f0', fontSize: '13px', cursor: 'pointer', borderRadius: '6px',
  textAlign: 'left'
};
