import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, CheckCircle2, ArrowRight, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import useFleetState from '../store/useFleetState';

export default function TopBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const storeAlerts = useFleetState(state => state.alerts);
  const isConnected = useFleetState(state => state.isConnected);
  const activeAlerts = (storeAlerts || []).filter(a => !a.resolved_at);
  const activeAlertsCount = activeAlerts.length;

  // Close dropdown on outside click & bind Ctrl+K to search input
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsAlertsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate('/fleet');
  };

  return (
    <header style={{
      height: '68px',
      background: 'rgba(6, 11, 20, 0.92)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(0, 212, 255, 0.12)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 26px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Search Input Bar with Ctrl + K badge */}
      <form onSubmit={handleSearchSubmit} style={{ width: '430px', maxWidth: '46%', position: 'relative' }}>
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#00D4FF',
            opacity: 0.85,
          }}
        />
        <input
          ref={searchInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por placa, motorista, posto, etc..."
          style={{
            width: '100%',
            background: 'rgba(13, 25, 43, 0.85)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: '12px',
            padding: '9px 76px 9px 40px',
            color: '#E2E8F0',
            fontSize: '13px',
            outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            boxSizing: 'border-box',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'rgba(0, 212, 255, 0.6)';
            e.target.style.boxShadow = '0 0 14px rgba(0, 212, 255, 0.18)';
          }}
          onBlur={e => {
            e.target.style.borderColor = 'rgba(0, 212, 255, 0.2)';
            e.target.style.boxShadow = 'none';
          }}
        />
        <span style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '6px',
          padding: '2px 7px',
          fontSize: '10px',
          fontWeight: 700,
          color: '#94A3B8',
          fontFamily: 'monospace',
          pointerEvents: 'none',
        }}>
          Ctrl + K
        </span>
      </form>

      {/* Right Controls: IoT Server Status + Notifications + User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* IoT Server Status Chip (matches mockup) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: isConnected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          border: isConnected ? '1px solid rgba(16, 185, 129, 0.28)' : '1px solid rgba(239, 68, 68, 0.28)',
          borderRadius: '12px',
          padding: '6px 13px',
        }}>
          <span style={{
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            background: isConnected ? '#10B981' : '#EF4444',
            boxShadow: isConnected ? '0 0 10px #10B981' : '0 0 10px #EF4444',
            flexShrink: 0,
          }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              color: '#FFFFFF',
              fontSize: '11.5px',
              fontWeight: 700,
              lineHeight: 1.15,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}>
              {isConnected ? 'Servidor IoT Online' : 'Servidor IoT Offline'}
              {isConnected ? <Wifi size={12} color="#10B981" /> : <WifiOff size={12} color="#EF4444" />}
            </span>
            <span style={{ color: '#8A9BB2', fontSize: '10px', fontWeight: 500 }}>
              {isConnected ? 'Todos os sistemas operacionais' : 'Reconectando telemetria...'}
            </span>
          </div>
        </div>

        {/* Bell Notifications */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setIsAlertsOpen(prev => !prev)}
            title="Alertas e Notificações"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '11px',
              background: isAlertsOpen ? 'rgba(0, 212, 255, 0.16)' : 'rgba(13, 25, 43, 0.85)',
              border: isAlertsOpen ? '1px solid rgba(0, 212, 255, 0.45)' : '1px solid rgba(0, 212, 255, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: isAlertsOpen ? '#00D4FF' : '#CBD5E1',
              position: 'relative',
              transition: 'all 0.2s',
            }}
          >
            <Bell size={16} />
            {activeAlertsCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                minWidth: '18px',
                height: '18px',
                borderRadius: '999px',
                background: '#EF4444',
                color: '#FFFFFF',
                fontSize: '10px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                boxShadow: '0 0 10px rgba(239, 68, 68, 0.7)',
              }}>
                {activeAlertsCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Popover */}
          {isAlertsOpen && (
            <div style={{
              position: 'absolute',
              top: '48px',
              right: 0,
              width: '380px',
              background: '#091322',
              border: '1px solid rgba(0, 212, 255, 0.28)',
              borderRadius: '16px',
              boxShadow: '0 18px 44px rgba(0, 0, 0, 0.75)',
              padding: '16px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={16} color="#00D4FF" />
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
                  border: '1px solid rgba(0, 212, 255, 0.35)',
                  background: 'rgba(0, 212, 255, 0.1)',
                  color: '#00D4FF',
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
        </div>

        {/* User Profile Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(13, 25, 43, 0.85)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '12px',
          padding: '5px 12px 5px 6px',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, #00D4FF, #0284C7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '13px',
            boxShadow: '0 0 10px rgba(0, 212, 255, 0.35)',
          }}>
            {(user?.name || 'G').charAt(0).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 700, lineHeight: 1.15 }}>
              {user?.name || 'Gestor Principal'}
            </span>
            <span style={{ color: '#8A9BB2', fontSize: '10px', fontWeight: 600 }}>
              Gestor de Frota
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
