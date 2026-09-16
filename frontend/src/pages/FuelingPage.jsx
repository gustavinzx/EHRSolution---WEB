import React, { useState } from 'react';
import { useFueling } from '../hooks/useFueling';
import FuelingTable   from '../components/FuelingTable';
import LoadingSpinner from '../components/LoadingSpinner';
import { Filter, RotateCcw } from 'lucide-react';

const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
};

const inputStyle = {
  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff', padding: '10px 14px', borderRadius: '10px',
  fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif',
};

export default function FuelingPage() {
  const [filters, setFilters] = useState({ truckId:'', driverId:'', start:'', end:'' });
  const { logs, loading, refetch } = useFueling();

  const handleFilter = () => refetch(filters);
  const handleReset  = () => { setFilters({ truckId:'', driverId:'', start:'', end:'' }); refetch({}); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff', margin: 0 }}>
          Log de Abastecimentos
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
          Somente leitura · registros gerados automaticamente pelo sistema
        </p>
      </div>

      {/* Filters */}
      <div style={{ ...glass, padding: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {[
            { key:'truckId',  label:'ID Caminhão', placeholder:'Ex: 3' },
            { key:'driverId', label:'ID Motorista', placeholder:'Ex: 2' },
            { key:'start',    label:'Data Inicial', type:'date' },
            { key:'end',      label:'Data Final',   type:'date' },
          ].map(f => (
            <div key={f.key} style={{ display:'flex', flexDirection:'column', gap:'6px', flex:1, minWidth:'140px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.8px', textTransform:'uppercase' }}>
                {f.label}
              </label>
              <input
                type={f.type || 'text'} placeholder={f.placeholder}
                value={filters[f.key]}
                onChange={e => setFilters({ ...filters, [f.key]: e.target.value })}
                style={inputStyle}
              />
            </div>
          ))}
          <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
            <button onClick={handleFilter} style={{
              display:'flex', alignItems:'center', gap:'6px',
              padding:'10px 18px', borderRadius:'10px', border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#2FBEB5,#4F8EF7)', color:'#fff',
              fontFamily:'var(--font-display)', fontWeight:700, fontSize:'13px',
              boxShadow:'0 4px 16px rgba(47,190,181,0.25)',
            }}>
              <Filter size={14}/> Filtrar
            </button>
            <button onClick={handleReset} style={{
              display:'flex', alignItems:'center', gap:'6px',
              padding:'10px 14px', borderRadius:'10px', cursor:'pointer',
              background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
              color:'var(--text-secondary)', fontSize:'13px',
            }}>
              <RotateCcw size={14}/>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={glass}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'15px' }}>Registros</span>
          {!loading && (
            <span style={{ fontSize:'12px', fontFamily:'var(--font-mono)', color:'var(--teal)',
              background:'rgba(47,190,181,0.1)', padding:'2px 10px', borderRadius:'20px', border:'1px solid rgba(47,190,181,0.2)' }}>
              {logs.length} registros
            </span>
          )}
        </div>
        {loading
          ? <div style={{ padding:'60px', display:'flex', justifyContent:'center' }}><LoadingSpinner /></div>
          : <FuelingTable logs={logs} />
        }
      </div>
    </div>
  );
}
