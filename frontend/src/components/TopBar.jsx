import React from 'react';
import { Search, Bell, Mail, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function TopBar() {
  const { user } = useAuth();
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

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
          placeholder="Buscar caminhao, motorista..."
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
        {[Mail, Bell].map((Icon, i) => (
          <button key={i} style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#94a3b8', position: 'relative',
          }}>
            <Icon size={16} />
            {i === 1 && (
              <span style={{
                position: 'absolute', top: '8px', right: '8px',
                width: '7px', height: '7px', borderRadius: '50%',
                background: '#f87171', border: '2px solid #0f1624',
              }} />
            )}
          </button>
        ))}
      </div>
      <div style={{
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
    </header>
  );
}
