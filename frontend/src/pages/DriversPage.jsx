import React, { useState, useEffect } from 'react';
import { useDrivers } from '../hooks/useDrivers';
import DriverModal    from '../components/DriverModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { UserPlus, Search, Users, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';


const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
};

export default function DriversPage() {
  const { drivers, loading, createDriver, updateDriver, deactivateDriver, fetchRanking } = useDrivers();
  const [search,       setSearch]       = useState('');
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [editingDriver,setEditingDriver] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [loadingRank, setLoadingRank] = useState(true);

  useEffect(() => {
    fetchRanking().then(res => {
      setRanking(res);
      setLoadingRank(false);
    });
  }, [fetchRanking]);

  const getDriverRankData = (id) => ranking.find(r => r.id === id);

  const filtered = drivers.filter(d => (d.name || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => {
       const scoreA = getDriverRankData(a.id)?.score || 0;
       const scoreB = getDriverRankData(b.id)?.score || 0;
       return scoreB - scoreA;
    });

  const handleSave = async (data) => {
    const ok = editingDriver
      ? await updateDriver(editingDriver.id, data)
      : await createDriver(data);
    if (ok) { setIsModalOpen(false); setEditingDriver(null); }
  };

  const handleDeactivate = async (id) => {
    if (window.confirm('Desativar este motorista?')) await deactivateDriver(id);
  };

  if (loading || loadingRank) return <LoadingSpinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff', margin: 0 }}>
            Motoristas
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
            {drivers.filter(d => d.is_active).length} ativos · {drivers.filter(d => !d.is_active).length} inativos
          </p>
        </div>
        <button
          onClick={() => { setEditingDriver(null); setIsModalOpen(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 18px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
            color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(47,190,181,0.3)',
          }}
        >
          <UserPlus size={16} /> Novo Motorista
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '320px' }}>
        <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text" placeholder="Buscar por nome..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff', padding: '10px 14px 10px 38px', borderRadius: '10px',
            width: '100%', fontSize: '14px', outline: 'none',
          }}
        />
      </div>

      {/* Table card */}
      <div style={glass}>
        <table>
          <thead>
            <tr>
              {['Posição', 'Nome/Status','Consumo','Segurança (Descargas)','Ociosidade','Score','Ações'].map((h,i) => (
                <th key={h} style={{ textAlign: i===6?'right':'left', padding: '16px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Users size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <div>Nenhum motorista encontrado</div>
              </td></tr>
            )}
            {Array.isArray(filtered) && filtered.map(d => (
              <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '16px', fontWeight: 700, color: '#fff', fontSize: '18px', opacity: 0.8 }}>
                  {(() => {
                     const idx = ranking.findIndex(r => r.id === d.id);
                     if (idx === 0) return <span style={{color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px'}}><Trophy size={18}/> 1º</span>;
                     if (idx === 1) return <span style={{color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px'}}>2º</span>;
                     if (idx === 2) return <span style={{color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px'}}>3º</span>;
                     return `${idx + 1}º`;
                  })()}
                </td>
                <td style={{ padding: '16px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={`https://i.pravatar.cc/150?u=${d.id + 10}`} alt={d.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }} />
                  <div>
                    <div style={{ fontSize: '15px' }}>{d.name}</div>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', display: 'inline-block', marginTop: '4px',
                      background: d.is_active ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.1)',
                      color: d.is_active ? '#34d399' : '#f87171',
                      border: `1px solid ${d.is_active ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                    }}>
                      {d.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#e2e8f0' }}>
                  {getDriverRankData(d.id)?.metrics?.consumption || '--'} L/100km
                </td>
                <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#e2e8f0' }}>
                  {getDriverRankData(d.id)?.metrics?.safe_unloads_pct || '0'}% Seguras
                </td>
                <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#e2e8f0' }}>
                  {getDriverRankData(d.id)?.metrics?.idle_time_pct || '0'}% Tempo
                </td>
                <td style={{ padding: '16px' }}>
                  {(() => {
                    const score = getDriverRankData(d.id)?.score || 0;
                    let color = score >= 80 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171';
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800, color }}>{score}</div>
                        <div style={{ width: '40px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                           <div style={{ width: `${score}%`, height: '100%', background: color }} />
                        </div>
                      </div>
                    );
                  })()}
                </td>
                <td style={{ padding: '16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => { setEditingDriver(d); setIsModalOpen(true); }}
                    style={{ background:'rgba(47,190,181,0.1)', border:'1px solid rgba(47,190,181,0.3)', color:'var(--teal)', cursor:'pointer', fontSize:'13px', fontWeight:600, padding: '8px 16px', borderRadius: '8px', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.target.style.background = 'rgba(47,190,181,0.2)'; }}
                    onMouseLeave={e => { e.target.style.background = 'rgba(47,190,181,0.1)'; }}
                  >
                    Detalhes do Score
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DriverModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingDriver(null); }}
        onSave={handleSave}
        driver={editingDriver}
      />
    </div>
  );
}
