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
  LogOut 
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import useFleetState from '../store/useFleetState';

const links = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/fleet',   icon: Truck,           label: 'Frota' },
  { to: '/drivers', icon: Users,           label: 'Motoristas' },
  { to: '/fueling', icon: Fuel,            label: 'Abastecimentos' },
  { to: '/stations',icon: MapPin,          label: 'Postos' },
  { to: '/alerts',  icon: Bell,            label: 'Alertas' },
  { to: '/reports', icon: FileText,        label: 'Relatórios' },
  { to: '/facial-attempts', icon: Scan,    label: 'Facial' },
];

export default function Sidebar() {
  const { logout, user } = useAuth();
  const displayLinks = user?.role === 'admin' ? [...links, { to: '/users', icon: UserCog, label: 'Usuários' }] : links;
  const storeAlerts = useFleetState(state => state.alerts);
  const activeAlertsCount = storeAlerts?.filter(a => !a.resolved_at)?.length || 0;

  return (
    <aside style={{
      width: '240px',
      background: '#070D18',
      borderRight: '1px solid rgba(0, 196, 208, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      height: '100vh',
      left: 0, 
      top: 0,
      zIndex: 200,
      padding: '24px 16px 20px',
      boxSizing: 'border-box',
    }}>
      {/* Brand Logo EHR SOLUTIONS */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 8px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'rgba(0, 196, 208, 0.12)',
          border: '1px solid rgba(0, 196, 208, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 16px rgba(0, 196, 208, 0.3)',
          flexShrink: 0,
        }}>
          <img 
            src="/ehr-logo-official.png" 
            alt="EHR" 
            style={{ width: '26px', height: '26px', objectFit: 'contain' }} 
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ 
            color: '#00C4D0', 
            fontWeight: 900, 
            fontSize: '18px', 
            letterSpacing: '1px', 
            lineHeight: 1.1 
          }}>
            EHR
          </span>
          <span style={{ 
            color: '#94A3B8', 
            fontSize: '9px', 
            fontWeight: 700, 
            letterSpacing: '2px', 
            textTransform: 'uppercase' 
          }}>
            SOLUTIONS
          </span>
        </div>
      </div>

      {/* Nav List */}
      <nav style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '6px', 
        marginTop: '20px' 
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
              padding: '11px 14px',
              borderRadius: '12px',
              color: isActive ? '#FFFFFF' : '#8899A6',
              background: isActive ? 'rgba(0, 196, 208, 0.15)' : 'transparent',
              border: isActive ? '1px solid rgba(0, 196, 208, 0.45)' : '1px solid transparent',
              textDecoration: 'none',
              fontWeight: isActive ? 700 : 500,
              fontSize: '13px',
              transition: 'all 0.18s ease',
              boxShadow: isActive ? '0 0 14px rgba(0, 196, 208, 0.18)' : 'none',
            })}
          >
            {({ isActive }) => (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <link.icon size={17} color={isActive ? '#00C4D0' : '#8899A6'} />
                  <span>{link.label}</span>
                </div>
                {link.to === '/alerts' && activeAlertsCount > 0 && (
                  <span style={{
                    background: '#EF4444',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 800,
                    borderRadius: '10px',
                    padding: '1px 6px',
                    minWidth: '16px',
                    textAlign: 'center',
                  }}>
                    {activeAlertsCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Footer Profile & Logout */}
      <div style={{ 
        paddingTop: '16px', 
        borderTop: '1px solid rgba(255,255,255,0.06)', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #00C4D0, #0284C7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '13px',
            boxShadow: '0 0 10px rgba(0, 196, 208, 0.4)',
            flexShrink: 0,
          }}>
            {(user?.name || 'Gestor').charAt(0).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'Gestor Principal'}
            </span>
            <span style={{ color: '#64748B', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
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
            background: 'transparent',
            border: 'none',
            color: '#EF4444',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '6px 4px',
            borderRadius: '6px',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <LogOut size={15} color="#EF4444" />
          <span>Sair do Sistema</span>
        </button>
      </div>
    </aside>
  );
}
