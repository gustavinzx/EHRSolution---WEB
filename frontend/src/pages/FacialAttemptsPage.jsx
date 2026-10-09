import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, XCircle, Search } from 'lucide-react';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

const cardStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
  padding: '24px',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-title)' }}>
            Auditoria Facial
          </h1>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' }}>
            Registro de tentativas de reconhecimento facial
          </p>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: '16px 20px' }}>
        <form onSubmit={handleFilter} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Status</label>
            <select
              value={filters.success}
              onChange={e => setFilters({ ...filters, success: e.target.value })}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0',
              }}
            >
              <option value="">Todos</option>
              <option value="true">Sucesso</option>
              <option value="false">Falha</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Data Inicial</label>
            <input
              type="date"
              value={filters.start}
              onChange={e => setFilters({ ...filters, start: e.target.value })}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0',
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Data Final</label>
            <input
              type="date"
              value={filters.end}
              onChange={e => setFilters({ ...filters, end: e.target.value })}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0',
              }}
            />
          </div>
          <button type="submit" style={{
            background: 'rgba(47,190,181,0.1)', color: '#2FBEB5', border: '1px solid rgba(47,190,181,0.2)',
            padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <Search size={16} /> Filtrar
          </button>
        </form>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div style={{ color: '#f87171', padding: '20px', textAlign: 'center' }}>{error}</div>
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th style={{ padding: '16px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>DATA/HORA</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>MOTORISTA</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>CAMINHÃO</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>RESULTADO</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>SCORE/LIVENESS</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#94a3b8', fontSize: '13px' }}>
                    {new Date(row.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#e2e8f0', fontSize: '14px', fontWeight: 500 }}>
                    {row.driver_name || `ID ${row.driver_id}`}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#e2e8f0', fontSize: '14px' }}>
                    {row.truck_plate || '-'}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '4px 10px', borderRadius: '40px', fontSize: '12px', fontWeight: 600,
                      background: row.success ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                      color: row.success ? '#34d399' : '#f87171', border: `1px solid ${row.success ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`
                    }}>
                      {row.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {row.success ? 'Sucesso' : 'Falha'}
                    </div>
                    {!row.success && row.failure_reason && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', maxWidth: '200px' }}>
                        {row.failure_reason}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#94a3b8', fontSize: '13px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>Score: {row.score ? (row.score * 100).toFixed(0) + '%' : '-'}</span>
                      <span style={{ color: row.liveness_passed ? '#34d399' : (row.liveness_passed === false ? '#f87171' : '#94a3b8') }}>
                        Liveness: {row.liveness_passed ? 'Aprovado' : (row.liveness_passed === false ? 'Reprovado' : '-')}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
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
