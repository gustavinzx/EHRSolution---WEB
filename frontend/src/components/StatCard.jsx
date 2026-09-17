import React from 'react';

const STATUS_META = {
  ok:        { label: 'OK',        color: '#34d399', glow: 'rgba(52,211,153,0.3)' },
  low_fuel:  { label: 'Combustível Baixo', color: '#fbbf24', glow: 'rgba(251,191,36,0.3)' },
  no_signal: { label: 'Sem Sinal', color: '#f87171', glow: 'rgba(248,113,113,0.3)' },
  security_alert: { label: 'Alerta de segurança', color: '#fb7185', glow: 'rgba(251,113,133,0.3)' },
};

export default function StatCard({ title, value, unit, icon: Icon, color = 'teal', subtitle }) {
  const colorMap = {
    teal:   { main: '#2FBEB5', glow: 'rgba(47,190,181,0.2)',  bg: 'rgba(47,190,181,0.1)',  grad: 'linear-gradient(135deg,#2FBEB5,#4F8EF7)' },
    green:  { main: '#34d399', glow: 'rgba(52,211,153,0.2)',  bg: 'rgba(52,211,153,0.1)',  grad: 'linear-gradient(135deg,#34d399,#2FBEB5)' },
    amber:  { main: '#fbbf24', glow: 'rgba(251,191,36,0.2)',  bg: 'rgba(251,191,36,0.1)',  grad: 'linear-gradient(135deg,#fbbf24,#f97316)' },
    red:    { main: '#f87171', glow: 'rgba(248,113,113,0.2)', bg: 'rgba(248,113,113,0.1)', grad: 'linear-gradient(135deg,#f87171,#e11d48)' },
    purple: { main: '#a78bfa', glow: 'rgba(167,139,250,0.2)', bg: 'rgba(167,139,250,0.1)', grad: 'linear-gradient(135deg,#a78bfa,#4F8EF7)' },
  };
  const c = colorMap[color] || colorMap.teal;

  return (
    <div style={{
      background: 'var(--bg-panel)',


      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '12px',
      padding: '22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px',
          textTransform: 'uppercase', color: 'var(--text-muted)',
          fontFamily: 'var(--font-display)',
        }}>
          {title}
        </span>
        {Icon && (
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: c.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${c.main}33`,
          }}>
            <Icon size={18} color={c.main} />
          </div>
        )}
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: '38px', fontWeight: 800,
          color: '#fff', lineHeight: 1, letterSpacing: '-1px',
        }}>
          {value ?? '—'}
        </span>
        {unit && <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{unit}</span>}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div style={{
          fontSize: '12px', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.main, flexShrink: 0 }} />
          {subtitle}
        </div>
      )}

      {/* Bottom accent bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px',
        background: c.bg, opacity: 0.6,
      }} />
    </div>
  );
}
