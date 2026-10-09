import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Truck, Fuel, FileText, MapPin, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const links = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/drivers', icon: Users,           label: 'Motoristas' },
  { to: '/fleet',   icon: Truck,           label: 'Frota' },
  { to: '/fueling', icon: Fuel,            label: 'Abastecimentos' },
  { to: '/stations',icon: MapPin,          label: 'Postos' },
  { to: '/alerts',  icon: ShieldAlert,     label: 'Alertas' },
  { to: '/reports', icon: FileText,        label: 'Relatórios' },
  { to: '/facial-attempts', icon: ScanFace, label: 'Facial' },
];

export default function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside style={{
      width: '240px',
      background: 'rgba(7,13,26,0.98)',
      backdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      height: '100vh',
      left: 0, top: 0,
      zIndex: 200,
    }}>
      <div style={{
        height: '64px',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(47,190,181,0.4)',
        }}>
          <img src="/images/ehr-logo.webp" alt="" style={{ width: '18px', height: '18px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </div>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '16px', letterSpacing: '0.5px' }}>EHR Solutions</span>
      </div>
      
      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, padding: '24px 24px 8px' }}>
        Menu Principal
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 16px' }}>
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 14px',
              borderRadius: '10px',
              color: isActive ? '#fff' : '#94a3b8',
              background: isActive ? 'linear-gradient(135deg, rgba(47,190,181,0.2), rgba(79,142,247,0.1))' : 'transparent',
              border: isActive ? '1px solid rgba(47,190,181,0.3)' : '1px solid transparent',
              transition: 'all 0.2s',
              boxShadow: isActive ? '0 0 16px rgba(47,190,181,0.1)' : 'none',
              textDecoration: 'none',
              fontWeight: isActive ? 600 : 500,
              fontSize: '14px'
            })}
          >
            {({ isActive }) => (
              <>
                <link.icon size={18} color={isActive ? '#2FBEB5' : 'currentColor'} />
                {link.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      
      <div style={{ padding: '16px' }}>
        <button
          onClick={logout}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '12px',
            borderRadius: '10px',
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.15)',
            color: '#f87171', cursor: 'pointer',
            fontWeight: 600, fontSize: '14px', transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
        >
          <LogOut size={16} /> Sair do Sistema
        </button>
      </div>
    </aside>
  );
}

