import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  Users,
  Fuel,
  MapPin,
  Bell,
  FileText,
  Scan,
  UserCog,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import useFleetState from '../store/useFleetState';

const links = [
  { to: '/',                icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/fleet',           icon: Truck,           label: 'Frota' },
  { to: '/drivers',         icon: Users,           label: 'Motoristas' },
  { to: '/fueling',         icon: Fuel,            label: 'Abastecimentos' },
  { to: '/stations',        icon: MapPin,          label: 'Postos' },
  { to: '/alerts',          icon: Bell,            label: 'Alertas' },
  { to: '/facial-attempts', icon: Scan,            label: 'Facial' },
  { to: '/reports',         icon: FileText,        label: 'Relatórios' },
];

export default function Sidebar() {
  const { logout, user } = useAuth();
  const displayLinks = user?.role === 'admin'
    ? [...links, { to: '/users', icon: UserCog, label: 'Usuários' }]
    : links;
  const storeAlerts = useFleetState(state => state.alerts);
  const activeAlertsCount = storeAlerts?.filter(a => !a.resolved_at)?.length || 0;

  return (
    <aside style={{
      width: '240px',
      background: 'linear-gradient(180deg, #060B14 0%, #08101E 60%, #060B13 100%)',
      borderRight: '1px solid rgba(0, 212, 255, 0.14)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      height: '100vh',
      left: 0,
      top: 0,
      zIndex: 200,
      padding: '22px 14px 18px',
      boxSizing: 'border-box',
      boxShadow: '4px 0 28px rgba(0, 0, 0, 0.45)',
    }}>
      {/* Brand Logo EHR SOLUTIONS (Next-Gen Speed Bars + Italic Typography) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 8px 20px',
        borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '11px',
          background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.18) 0%, rgba(0, 140, 255, 0.08) 100%)',
          border: '1px solid rgba(0, 212, 255, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 18px rgba(0, 212, 255, 0.28)',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 3 Cyan Speed Bars Motif */}
          <svg width="24" height="20" viewBox="0 0 24 20" fill="none" aria-hidden="true">
            <path d="M5 4H21L19 7.2H3L5 4Z" fill="#00D4FF" />
            <path d="M3.5 8.5H17.5L15.5 11.7H1.5L3.5 8.5Z" fill="#00C4D0" />
            <path d="M2 13H13.5L11.5 16.2H0L2 13Z" fill="#38BDF8" />
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{
            color: '#FFFFFF',
            fontWeight: 900,
            fontStyle: 'italic',
            fontSize: '20px',
            letterSpacing: '0.8px',
            lineHeight: 1,
            textShadow: '0 0 14px rgba(0, 212, 255, 0.35)',
          }}>
            EHR
          </span>
          <span style={{
            color: '#00D4FF',
            fontSize: '9.5px',
            fontWeight: 800,
            letterSpacing: '2.4px',
            textTransform: 'uppercase',
            marginTop: '2px',
          }}>
            SOLUTIONS
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        marginTop: '16px',
        overflowY: 'auto',
      }}>
        {displayLinks.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 13px',
              borderRadius: '11px',
              color: isActive ? '#FFFFFF' : '#8A9BB2',
              background: isActive
                ? 'linear-gradient(90deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 212, 255, 0.04) 100%)'
                : 'transparent',
              border: isActive
                ? '1px solid rgba(0, 212, 255, 0.42)'
                : '1px solid transparent',
              textDecoration: 'none',
              fontWeight: isActive ? 700 : 500,
              fontSize: '13px',
              transition: 'all 0.18s ease',
              boxShadow: isActive ? '0 0 18px rgba(0, 212, 255, 0.14)' : 'none',
              position: 'relative',
            })}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span style={{
                    position: 'absolute',
                    left: '-1px',
                    top: '20%',
                    bottom: '20%',
                    width: '3px',
                    borderRadius: '0 4px 4px 0',
                    background: '#00D4FF',
                    boxShadow: '0 0 8px #00D4FF',
                  }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                  <link.icon size={17} color={isActive ? '#00D4FF' : '#7E91A8'} />
                  <span>{link.label}</span>
                </div>
                {link.to === '/alerts' && activeAlertsCount > 0 && (
                  <span style={{
                    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 800,
                    borderRadius: '999px',
                    padding: '1px 7px',
                    minWidth: '18px',
                    textAlign: 'center',
                    boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
                  }}>
                    {activeAlertsCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* IoT Security Promo Card (from Next-Gen Mockup) */}
      <div style={{
        margin: '12px 0',
        padding: '12px 13px',
        borderRadius: '13px',
        background: 'linear-gradient(145deg, rgba(13, 27, 46, 0.95) 0%, rgba(7, 16, 30, 0.98) 100%)',
        border: '1px solid rgba(0, 212, 255, 0.22)',
        boxShadow: 'inset 0 0 20px rgba(0, 212, 255, 0.06)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '9px',
          fontWeight: 800,
          color: '#00D4FF',
          letterSpacing: '0.7px',
          textTransform: 'uppercase',
          marginBottom: '6px',
        }}>
          <ShieldCheck size={13} color="#00D4FF" />
          <span>Segurança • Controle • IoT</span>
        </div>
        <div style={{
          fontSize: '11px',
          color: '#CBD5E1',
          lineHeight: 1.35,
          fontWeight: 500,
        }}>
          Tecnologia IoT para um abastecimento sem fraudes.
        </div>
      </div>

      {/* User Footer Profile & Logout */}
      <div style={{
        paddingTop: '12px',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #00D4FF, #0284C7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '13px',
            boxShadow: '0 0 12px rgba(0, 212, 255, 0.4)',
            flexShrink: 0,
          }}>
            {(user?.name || 'Gestor').charAt(0).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'Gestor Principal'}
            </span>
            <span style={{ color: '#00D4FF', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {user?.role ? user.role.toUpperCase() : 'MANAGER'}
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#F87171',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '7px 10px',
            borderRadius: '8px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; }}
        >
          <LogOut size={14} color="#F87171" />
          <span>Sair do Sistema</span>
        </button>
      </div>
    </aside>
  );
}
