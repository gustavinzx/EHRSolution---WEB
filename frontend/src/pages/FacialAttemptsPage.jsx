import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, XCircle, Search, ScanFace } from 'lucide-react';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

const glass = {
  background: 'rgba(11, 22, 40, 0.75)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(0, 212, 255, 0.14)',
  borderRadius: '16px',
};

const inputStyle = {
  background: 'rgba(6, 11, 19, 0.7)',
  border: '1px solid rgba(0, 212, 255, 0.2)',
  color: '#e2e8f0',
  padding: '10px 14px',
  borderRadius: '10px',
  outline: 'none',
  fontSize: '13px',
  width: '100%',
};

export default function FacialAttemptsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    success: '',
    start: '',
    end: ''
  });

  const fetchAttempts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.success !== '') params.append('success', filters.success);
      if (filters.start) params.append('start', new Date(filters.start).toISOString());
      if (filters.end) {
        const d = new Date(filters.end);
        d.setHours(23, 59, 59, 999);
        params.append('end', d.toISOString());
      }
      
      const res = await api.get('/facial-attempts?' + params.toString());
      setData(res.data.data);
    } catch (err) {
      setError('Erro ao carregar tentativas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, []);

  const handleFilter = (e) => {
    e.preventDefault();
    fetchAttempts();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{
        ...glass,
        padding: '26px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        background: 'linear-gradient(135deg, rgba(6, 11, 19, 0.95) 0%, rgba(13, 25, 43, 0.95) 100%)',
        border: '1px solid rgba(0, 212, 255, 0.22)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(0, 114, 255, 0.2))',
          border: '1px solid rgba(0, 212, 255, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(0, 212, 255, 0.25)',
        }}>
          <ScanFace size={26} color="#00D4FF" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
            Auditoria Facial
          </h1>
          <p style={{ margin: '4px 0 0', color: '#8899A6', fontSize: '13px' }}>
            Registro de tentativas de reconhecimento facial e verificação de vivacidade (liveness).
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div style={{ ...glass, padding: '16px 20px', background: 'rgba(11, 22, 40, 0.75)' }}>
        <form onSubmit={handleFilter} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#8899A6', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Status</label>
            <select
              value={filters.success}
              onChange={e => setFilters({ ...filters, success: e.target.value })}
              style={inputStyle}
            >
              <option value="">Todos</option>
              <option value="true">Sucesso</option>
              <option value="false">Falha</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#8899A6', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Data Inicial</label>
            <input
              type="date"
              value={filters.start}
              onChange={e => setFilters({ ...filters, start: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#8899A6', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Data Final</label>
            <input
              type="date"
              value={filters.end}
              onChange={e => setFilters({ ...filters, end: e.target.value })}
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            style={{
              background: 'linear-gradient(135deg, #00D4FF, #0072FF)',
              color: '#FFFFFF',
              border: 'none',
              padding: '11px 22px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 800,
              fontSize: '13px',
              boxShadow: '0 0 16px rgba(0, 212, 255, 0.35)',
              transition: 'all 0.2s',
            }}
          >
            <Search size={16} /> Filtrar
          </button>
        </form>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div style={{ color: '#f87171', padding: '20px', textAlign: 'center' }}>{error}</div>
      ) : (
        <div style={{ ...glass, padding: 0, overflow: 'hidden', background: 'rgba(11, 22, 40, 0.75)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(6, 11, 19, 0.6)', borderBottom: '1px solid rgba(0, 212, 255, 0.12)' }}>
                <th style={{ padding: '16px 20px', fontSize: '11px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>DATA/HORA</th>
                <th style={{ padding: '16px 20px', fontSize: '11px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>MOTORISTA</th>
                <th style={{ padding: '16px 20px', fontSize: '11px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>CAMINHÃO</th>
                <th style={{ padding: '16px 20px', fontSize: '11px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>RESULTADO</th>
                <th style={{ padding: '16px 20px', fontSize: '11px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>SCORE/LIVENESS</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 212, 255, 0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                >
                  <td style={{ padding: '16px 20px', fontFamily: "'IBM Plex Mono', monospace", color: '#8899A6', fontSize: '13px' }}>
                    {new Date(row.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#e2e8f0', fontSize: '14px', fontWeight: 600 }}>
                    {row.driver_name || `ID ${row.driver_id}`}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#00D4FF', fontSize: '14px', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
                    {row.truck_plate || '-'}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '4px 12px', borderRadius: '40px', fontSize: '12px', fontWeight: 700,
                      background: row.success ? 'rgba(0, 245, 160, 0.12)' : 'rgba(248, 113, 113, 0.12)',
                      color: row.success ? '#00F5A0' : '#f87171', border: `1px solid ${row.success ? 'rgba(0, 245, 160, 0.35)' : 'rgba(248, 113, 113, 0.35)'}`,
                      boxShadow: row.success ? '0 0 10px rgba(0, 245, 160, 0.2)' : '0 0 10px rgba(248, 113, 113, 0.2)',
                    }}>
                      {row.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {row.success ? 'Sucesso' : 'Falha'}
                    </div>
                    {!row.success && row.failure_reason && (
                      <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px', maxWidth: '220px' }}>
                        {row.failure_reason}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#8899A6', fontSize: '13px', fontFamily: "'IBM Plex Mono', monospace" }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span>Score: <strong style={{ color: '#fff' }}>{row.score ? (row.score * 100).toFixed(0) + '%' : '-'}</strong></span>
                      <span style={{ color: row.liveness_passed ? '#00F5A0' : (row.liveness_passed === false ? '#f87171' : '#8899A6'), fontWeight: 600 }}>
                        Liveness: {row.liveness_passed ? 'Aprovado' : (row.liveness_passed === false ? 'Reprovado' : '-')}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    Nenhuma tentativa encontrada para os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
