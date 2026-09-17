import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFleet } from '../hooks/useFleet';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { RefreshCw, MapPin, Users, Gauge, Droplets } from 'lucide-react';
import MapView from '../components/MapView';
const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px', overflow: 'hidden',
};

const STATUS_META = {
  ok:        { label: 'OK',         color: '#34d399', glow: 'rgba(52,211,153,0.15)' },
  low_fuel:  { label: 'Comb. Baixo',color: '#fbbf24', glow: 'rgba(251,191,36,0.15)' },
  no_signal: { label: 'Sem Sinal',  color: '#f87171', glow: 'rgba(248,113,113,0.15)' },
};

export default function FleetPage() {
  const { trucks, loading, error, refetch } = useFleet();

  if (loading && trucks.length === 0) return <LoadingSpinner />;
  if (error && trucks.length === 0) return <ErrorMessage message={error} />;

  const pct = t => t.capacity_liters > 0 ? Math.round((t.current_level_liters / t.capacity_liters) * 100) : 0;
  const counts = {
    total: trucks.length,
    ok:    trucks.filter(t => t.status === 'ok').length,
    low:   trucks.filter(t => t.status === 'low_fuel').length,
    off:   trucks.filter(t => t.status === 'no_signal').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <h1 style={{ fontSize:'28px', fontFamily:'var(--font-display)', fontWeight:800, color:'#fff', margin:0 }}>Frota</h1>
          <p style={{ color:'var(--text-muted)', fontSize:'13px', marginTop:'6px' }}>
            {counts.total} veículos monitorados
          </p>
        </div>
        <button onClick={refetch} style={{
          display:'flex', alignItems:'center', gap:'7px', padding:'9px 16px',
          borderRadius:'10px', fontSize:'13px', fontWeight:500,
          border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)',
          color:'var(--text-secondary)', cursor:'pointer',
        }}>
          <RefreshCw size={14}/> Atualizar
        </button>
      </div>

      {/* Summary pills */}
      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
        {[
          ['Total',       counts.total, '#2FBEB5'],
          ['Operacional', counts.ok,    '#34d399'],
          ['Comb. Baixo', counts.low,   '#fbbf24'],
          ['Sem Sinal',   counts.off,   '#f87171'],
        ].map(([label, val, color]) => (
          <div key={label} style={{
            display:'flex', alignItems:'center', gap:'10px',
            padding:'12px 20px', borderRadius:'12px',
            background:`${color}10`, border:`1px solid ${color}30`,
            minWidth:'120px',
          }}>
            <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:color, boxShadow:`0 0 8px ${color}`, flexShrink:0 }} />
            <div>
              <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.8px', fontWeight:600 }}>{label}</div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:'22px', fontWeight:800, color, lineHeight:1 }}>{val}</div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Map */}
      <div style={{ ...glass, height: '350px' }}>
        <div style={{
          padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>Visão Global da Frota</span>
        </div>
        <div style={{ height: 'calc(100% - 49px)' }}>
          <MapView trucks={trucks} />
        </div>
      </div>

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'16px' }}>
        {Array.isArray(trucks) && trucks.map(truck => {
          const levelPct = pct(truck);
          const levelColor = levelPct < 20 ? '#f87171' : levelPct < 50 ? '#fbbf24' : '#34d399';
          const s = STATUS_META[truck.status] || STATUS_META.ok;
          const drivers = truck.current_drivers?.length > 0
            ? truck.current_drivers.map(d => d.name).join(', ')
            : 'Sem motorista';

          return (
            <Link key={truck.id} to={`/fleet/${truck.id}`} style={{
              ...glass,
              display: 'block',
              textDecoration: 'none',
              background: 'rgba(255,255,255,0.04)',
              transition: 'border-color 0.2s, transform 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {/* Card header */}
              <div style={{
                padding:'16px 18px',
                background: `linear-gradient(135deg, ${s.glow}, transparent)`,
                borderBottom:'1px solid rgba(255,255,255,0.06)',
                display:'flex', justifyContent:'space-between', alignItems:'center',
              }}>
                <div>
                  <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'15px', letterSpacing:'2px', color:'#fff' }}>
                    {truck.plate}
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px' }}>{truck.model}</div>
                </div>
                <span style={{
                  fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'20px',
                  background: s.glow, color: s.color, border:`1px solid ${s.color}44`,
                }}>
                  {s.label}
                </span>
              </div>

              {/* Details */}
              <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:'10px' }}>
                {/* Fuel bar */}
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'6px' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:'5px', color:'var(--text-muted)' }}>
                      <Droplets size={12}/> Combustível
                    </span>
                    <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:levelColor }}>
                      {levelPct}% · {truck.current_level_liters}L
                    </span>
                  </div>
                  <div style={{ height:'5px', background:'rgba(255,255,255,0.07)', borderRadius:'4px', overflow:'hidden' }}>
                    <div style={{ width:`${levelPct}%`, height:'100%', background:`linear-gradient(90deg,${levelColor}88,${levelColor})`,
                      boxShadow:`0 0 8px ${levelColor}66`, borderRadius:'4px', transition:'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize:'10px', color:'var(--text-muted)', marginTop:'3px', fontFamily:'var(--font-mono)' }}>
                    Cap. {truck.capacity_liters}L
                  </div>
                </div>

                {/* Meta rows */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'12px' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:'5px', color:'var(--text-muted)' }}>
                    <Users size={11}/> Motorista
                  </span>
                  <span style={{ color:'var(--teal)', fontWeight:500, fontSize:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                    {truck.current_drivers?.length > 0 && (
                      <img src={`https://i.pravatar.cc/150?u=${truck.current_drivers[0].id + 10}`} alt="avatar" style={{ width:'16px', height:'16px', borderRadius:'50%', objectFit:'cover' }} />
                    )}
                    {drivers}
                  </span>
                </div>
                {[
                  [Gauge,  'Velocidade',   `${truck.speed_kmh} km/h`,   'var(--text-secondary)'],
                  [MapPin, 'Coordenadas',  `${parseFloat(truck.lat||0).toFixed(4)}, ${parseFloat(truck.lng||0).toFixed(4)}`, 'var(--text-muted)'],
                ].map(([Icon, label, val, col]) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'12px' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:'5px', color:'var(--text-muted)' }}>
                      <Icon size={11}/> {label}
                    </span>
                    <span style={{ color:col, fontFamily: label==='Velocidade'||label==='Coordenadas' ? 'var(--font-mono)' : 'inherit', fontWeight:500, fontSize:'12px' }}>
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
