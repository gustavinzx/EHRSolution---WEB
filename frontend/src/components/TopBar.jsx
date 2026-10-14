import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Calendar, Sun, Moon, CheckCircle2, AlertTriangle, ShieldAlert, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import useFleetState from '../store/useFleetState';

export default function TopBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [themeMode, setThemeMode] = useState('dark');
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const storeAlerts = useFleetState(state => state.alerts);
  const activeAlerts = (storeAlerts || []).filter(a => !a.resolved_at);
  const activeAlertsCount = activeAlerts.length;

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
  const dateStr = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsAlertsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }} ref={dropdownRef}>
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
            onClick={() => setIsAlertsOpen(prev => !prev)}
            title="Alertas e Notificações"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: isAlertsOpen ? 'rgba(0, 196, 208, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: isAlertsOpen ? '1px solid rgba(0, 196, 208, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: isAlertsOpen ? '#00C4D0' : '#94A3B8',
              position: 'relative',
            }}
          >
            <Bell size={15} />
            {activeAlertsCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                minWidth: '17px',
                height: '17px',
                borderRadius: '999px',
                background: '#EF4444',
                color: '#FFFFFF',
                fontSize: '10px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
              }}>
                {activeAlertsCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Popover */}
          {isAlertsOpen && (
            <div style={{
              position: 'absolute',
              top: '46px',
              right: 0,
              width: '380px',
              background: '#0B1424',
              border: '1px solid rgba(0, 196, 208, 0.25)',
              borderRadius: '16px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
              padding: '16px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={16} color="#00C4D0" />
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFFFFF' }}>Notificações da Frota</span>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: activeAlertsCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: activeAlertsCount > 0 ? '#EF4444' : '#10B981',
                }}>
                  {activeAlertsCount > 0 ? `${activeAlertsCount} pendentes` : 'Tudo limpo'}
                </span>
              </div>

              {/* Alert List or Empty State */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {activeAlertsCount === 0 ? (
                  <div style={{ padding: '24px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={22} color="#10B981" />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>Nenhum alerta crítico ativo</span>
                    <span style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.4 }}>
                      Toda a telemetria, postos autorizados e níveis de combustível operando em conformidade.
                    </span>
                  </div>
                ) : (
                  activeAlerts.map(alert => (
                    <div
                      key={alert.id}
                      onClick={() => {
                        setIsAlertsOpen(false);
                        navigate('/alerts');
                      }}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'background 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF' }}>
                          {alert.plate ? `Veículo ${alert.plate}` : 'Alerta Geral'}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: alert.severity === 'critical' ? '#EF4444' : '#F59E0B',
                          textTransform: 'uppercase',
                        }}>
                          {alert.severity || 'Atenção'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8', lineHeight: 1.3 }}>
                        {alert.message}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Footer Link */}
              <button
                type="button"
                onClick={() => {
                  setIsAlertsOpen(false);
                  navigate('/alerts');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 196, 208, 0.3)',
                  background: 'rgba(0, 196, 208, 0.08)',
                  color: '#00C4D0',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '4px',
                }}
              >
                <span>Ver Central de Alertas</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}

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
