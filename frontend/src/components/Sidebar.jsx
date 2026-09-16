import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Truck, Fuel, FileText, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const links = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/drivers', icon: Users,           label: 'Motoristas' },
  { to: '/fleet',   icon: Truck,           label: 'Frota' },
  { to: '/fueling', icon: Fuel,            label: 'Abastecimentos' },
  { to: '/reports', icon: FileText,        label: 'Relatorios' },
];

export default function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside style={{
      width: '72px',
      background: 'rgba(7,13,26,0.98)',
      backdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'fixed',
      height: '100vh',
      left: 0, top: 0,
      zIndex: 200,
      padding: '0 0 16px',
    }}>
      <div style={{
        width: '72px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(47,190,181,0.4)',
        }}>
          <img src="/images/ehr-logo.webp" alt="" style={{ width: '24px', height: '24px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </div>
      </div>
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '16px 0' }}>
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            title={link.label}
            style={({ isActive }) => ({
              width: '46px', height: '46px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '12px',
              color: isActive ? '#fff' : '#475569',
              background: isActive ? 'linear-gradient(135deg, rgba(47,190,181,0.3), rgba(79,142,247,0.2))' : 'transparent',
              border: isActive ? '1px solid rgba(47,190,181,0.4)' : '1px solid transparent',
              transition: 'all 0.2s',
              boxShadow: isActive ? '0 0 16px rgba(47,190,181,0.2)' : 'none',
            })}
          >
            {({ isActive }) => <link.icon size={19} color={isActive ? '#2FBEB5' : 'currentColor'} />}
          </NavLink>
        ))}
      </nav>
      <button
        onClick={logout}
        title="Sair"
        style={{
          width: '46px', height: '46px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '12px',
          background: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.15)',
          color: '#f87171', cursor: 'pointer',
        }}
      >
        <LogOut size={17} />
      </button>
    </aside>
  );
}
