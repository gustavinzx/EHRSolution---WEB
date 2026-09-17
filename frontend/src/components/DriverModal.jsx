import React, { useState, useEffect } from 'react';
import { X, Save, Trophy, Activity, Fuel, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function DriverModal({ isOpen, onClose, onSave, driver, fetchDriverScore }) {
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [scoreData, setScoreData] = useState(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [tab, setTab] = useState('score');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (isOpen) setTab(driver ? 'score' : 'profile');
  }, [isOpen, driver?.id]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    if (driver) {
      setFormData({
        name: driver.name || '',
        phone: driver.phone || '',
        email: driver.email || ''
      });
      setLoadingScore(true);
      setScoreData(null);
      Promise.resolve().then(() => fetchDriverScore(driver.id)).then(data => {
        if (active) setScoreData(data);
      }).catch(() => { if (active) setScoreData(null); })
        .finally(() => { if (active) setLoadingScore(false); });
    } else {
      setFormData({ name: '', phone: '', email: '' });
      setScoreData(null);
    }
    return () => { active = false; };
  }, [isOpen, driver, fetchDriverScore, retry]);

  if (!isOpen) return null;

  const inputStyle = {
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', padding: '12px 14px', borderRadius: '10px',
    width: '100%', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const focus = e => { e.target.style.borderColor='rgba(47,190,181,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(47,190,181,0.1)'; };
  const blur  = e => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="driver-modal-title" style={{
        background: 'rgba(11,20,36,0.98)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px',
        width: '100%', maxWidth: driver ? '760px' : '440px', padding: '24px',
        maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        position: 'relative',
      }}>
        {/* Close */}
        <button aria-label="Fechar detalhes do motorista" onClick={onClose} style={{
          position: 'absolute', top: '20px', right: '20px',
          background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '8px',
          width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-muted)',
        }}>
          <X size={16} />
        </button>

        <h2 id="driver-modal-title" style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '6px', paddingRight: '40px' }}>
          {driver ? driver.name : 'Novo Motorista'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '28px' }}>
          {driver ? 'Desempenho e informações do motorista' : 'Preencha os dados para cadastrar'}
        </p>

        {driver && <nav className="driver-score-tabs" aria-label="Seções do motorista">
          <button className="panel-button" aria-pressed={tab === 'score'} onClick={() => setTab('score')}>Detalhes do score</button>
          <button className="panel-button" aria-pressed={tab === 'profile'} onClick={() => setTab('profile')}>Dados cadastrais</button>
        </nav>}
        {driver && tab === 'score' ? (
          loadingScore ? <p role="status">Carregando score do motorista…</p> : !scoreData ? <div role="alert">
            <p>Não foi possível carregar o score deste motorista.</p>
            <button className="panel-button" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button>
          </div> : <>
            <div className="driver-score-summary"><span className="eyebrow">SCORE GERAL</span><strong>{scoreData.score ?? '—'}<small> / 100</small></strong><p>Consumo: 40% · Segurança nas descargas: 30% · Tempo ocioso: 30%</p></div>
            <div className="driver-score-metrics">
              <div><span>Consumo médio</span><strong>{scoreData.metrics?.consumption ?? '—'} L/100 km</strong><small>Quanto menor, melhor</small></div>
              <div><span>Descargas seguras</span><strong>{scoreData.metrics?.safe_unloads_pct ?? '—'}%</strong><small>Quanto maior, melhor</small></div>
              <div><span>Tempo ocioso</span><strong>{scoreData.metrics?.idle_time_pct ?? '—'}%</strong><small>Quanto menor, melhor</small></div>
            </div>
            <p className="driver-score-note">Dados de demonstração: consumo e histórico são simulados nesta versão.</p>
            <h3>Histórico do score</h3>
            {Array.isArray(scoreData.history) && scoreData.history.length > 0 ? <div style={{ height: '220px', marginTop: '16px' }}>
              <ResponsiveContainer width="100%" height="100%"><AreaChart data={scoreData.history} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                <XAxis dataKey="date" tickFormatter={value => value.slice(5).split('-').reverse().join('/')} stroke="var(--text-muted)" fontSize={11} minTickGap={24}/>
                <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={11}/>
                <RechartsTooltip contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8 }}/>
                <Area type="monotone" dataKey="score" name="Score" stroke="var(--teal)" fill="var(--teal-dim)" strokeWidth={2} isAnimationActive={false}/>
              </AreaChart></ResponsiveContainer>
            </div> : <p>Sem histórico disponível para este motorista.</p>}
          </>
        ) : <form onSubmit={e => { e.preventDefault(); onSave(formData); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            { key: 'name',  label: 'Nome *',   type: 'text',  required: true,  placeholder: 'Nome completo' },
            { key: 'phone', label: 'Telefone', type: 'text',  required: false, placeholder: '(11) 99999-9999' },
            { key: 'email', label: 'E-mail',   type: 'email', required: false, placeholder: 'motorista@email.com' },
          ].map(f => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor={`driver-${f.key}`} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                {f.label}
              </label>
              <input
                id={`driver-${f.key}`}
                type={f.type} required={f.required} placeholder={f.placeholder}
                value={formData[f.key]}
                onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                style={inputStyle} onFocus={focus} onBlur={blur}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)',
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button type="submit" style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
              color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(47,190,181,0.3)',
            }}>
              Salvar
            </button>
          </div>
        </form>}
      </div>
    </div>
  );
}
