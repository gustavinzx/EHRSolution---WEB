import React from 'react';
import { Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_META = {
  ok:        { label: 'OK',    color: '#34d399', glow: 'rgba(52,211,153,0.2)' },
  low_fuel:  { label: 'Baixo', color: '#fbbf24', glow: 'rgba(251,191,36,0.2)' },
  no_signal: { label: '✕ Sinal', color: '#f87171', glow: 'rgba(248,113,113,0.2)' },
  security_alert: { label: 'Alerta segurança', color: '#fb7185', glow: 'rgba(251,113,133,0.2)' },
  arrived: { label: 'Chegou ao destino', color: '#60a5fa', glow: 'rgba(96,165,250,0.2)' },
};

export default function TruckCard({ truck }) {
  const levelPct = truck.capacity_liters > 0
    ? Math.round((truck.current_level_liters / truck.capacity_liters) * 100)
    : 0;

  const levelColor = levelPct < 20 ? '#f87171' : levelPct < 50 ? '#fbbf24' : '#34d399';
  const status = STATUS_META[truck.status] || STATUS_META.ok;
  const driverNames = truck.current_drivers?.length > 0
    ? truck.current_drivers.map(d => d.name).join(', ')
    : 'Sem motorista';

  return (
    <Link to={`/fleet/${truck.id}`} style={{
      display: 'block',
      textDecoration: 'none',
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '12px',
      padding: '14px 16px',
      marginBottom: '8px',
      transition: 'border-color 0.2s, background 0.2s, transform 0.2s',
      cursor: 'pointer',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {/* Plate + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px',
          letterSpacing: '1.5px', color: '#fff',
        }}>
          {truck.plate}
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 700, padding: '2px 8px',
          borderRadius: '20px', letterSpacing: '0.5px',
          background: status.glow,
          color: status.color,
          border: `1px solid ${status.color}44`,
        }}>
          {status.label}
        </span>
      </div>

      {/* Model */}
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
        {truck.model}
      </div>

      {/* Driver */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
        {truck.current_drivers?.length > 0 ? (
          <img src={`https://i.pravatar.cc/150?u=${truck.current_drivers[0].id + 10}`} alt="avatar" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <Users size={14} color="var(--teal)" />
        )}
        <span>{driverNames}</span>
      </div>

      {/* Fuel bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '5px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Combustível</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: levelColor, fontWeight: 600 }}>
            {levelPct}%
          </span>
        </div>
        <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            width: `${levelPct}%`, height: '100%', borderRadius: '4px',
            background: `linear-gradient(90deg, ${levelColor}88, ${levelColor})`,
            boxShadow: `0 0 8px ${levelColor}66`,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
          {truck.current_level_liters}L / {truck.capacity_liters}L
        </div>
      </div>

      {/* Speed */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
          <Zap size={11} /> Velocidade
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          {truck.speed_kmh} km/h
        </span>
      </div>
    </Link>
  );
}
