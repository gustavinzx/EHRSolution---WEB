import React, { useState } from 'react';
import { Search, Bell, Calendar, Sun, Moon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import useFleetState from '../store/useFleetState';

export default function TopBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [themeMode, setThemeMode] = useState('dark');
  
  const storeAlerts = useFleetState(state => state.alerts);
  const activeAlertsCount = storeAlerts?.filter(a => !a.resolved_at)?.length || 2;

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
  // Capitalize first letter (e.g. Terça-feira, 13 de outubro de 2026)
  const dateStr = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);

  return (
    <header style={{
      height: '68px',
      background: 'rgba(7, 13, 24, 0.95)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Search Input Bar */}
      <div style={{ width: '380px', position: 'relative' }}>
        <Search 
          size={16} 
          style={{ 
            position: 'absolute', 
            left: '14px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            color: '#64748B' 
          }} 
        />
        <input
          placeholder="Buscar caminhão, motorista, posto..."
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '9px 16px 9px 40px',
            color: '#E2E8F0',
            fontSize: '13px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(0, 196, 208, 0.5)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
        />
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Date Chip */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '12px',
          padding: '7px 14px',
          color: '#94A3B8',
          fontSize: '12px',
          fontWeight: 500,
        }}>
          <Calendar size={14} color="#00C4D0" />
          <span>{dateStr}</span>
        </div>

        {/* Action Icon Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Calendar Quick Action */}
          <button
            onClick={() => navigate('/fueling')}
            title="Calendário de abastecimentos"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#94A3B8',
            }}
          >
            <Calendar size={15} />
          </button>

          {/* Bell Notifications */}
          <button
            onClick={() => navigate('/alerts')}
            title="Alertas e Notificações"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#94A3B8',
              position: 'relative',
            }}
          >
            <Bell size={15} />
            {activeAlertsCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '7px',
                right: '7px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#EF4444',
                boxShadow: '0 0 6px #EF4444',
              }} />
            )}
          </button>

          {/* Theme Mode Toggle */}
          <button
            onClick={() => setThemeMode(m => m === 'dark' ? 'light' : 'dark')}
            title="Alternar Tema"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#94A3B8',
            }}
          >
            {themeMode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        {/* User Profile Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '30px',
          padding: '4px 12px 4px 5px',
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #00C4D0, #0284C7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '12px',
          }}>
            {(user?.name || 'G').charAt(0).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 700, lineHeight: 1.1 }}>
              {user?.name || 'Gestor Principal'}
            </span>
            <span style={{ color: '#64748B', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
              {user?.role ? user.role.toUpperCase() : 'MANAGER'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
