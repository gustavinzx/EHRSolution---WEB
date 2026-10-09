import React, { useState } from 'react';
import { ShieldAlert, Search, Filter, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';
import { useFleet } from '../hooks/useFleet';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

import { getAlertMeta } from '../utils/alertMapping';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR');
}

export default function AlertsPage() {
  const { user } = require('../hooks/useAuth').useAuth();
  const [filters, setFilters] = useState({ status: 'all' });
  const { alerts, loading, resolveAlert, refetch } = useAlerts(filters);
  const { trucks } = useFleet();
  
  const [resolvingId, setResolvingId] = useState(null);
  const [note, setNote] = useState('');

  const handleApplyFilters = (e) => {
    e.preventDefault();
    refetch(filters);
  };

  const confirmResolve = async () => {
    if (!note || note.trim().length < 5) {
      toast.error('A nota deve ter pelo menos 5 caracteres.');
      return;
    }
    const ok = await resolveAlert(resolvingId, note);
    if (ok) {
      toast.success('Alerta resolvido com sucesso!');
      setResolvingId(null);
      setNote('');
    } else {
      toast.error('Erro ao resolver alerta.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(248,113,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldAlert size={24} color="#f87171" />
        </div>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#fff' }}>Central de Alertas</h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>Histórico completo de incidentes e resoluções.</p>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleApplyFilters} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <select value={filters.status || 'all'} onChange={e => setFilters({...filters, status: e.target.value})} style={inputStyle}>
          <option value="all">Status: Todos</option>
          <option value="active">Status: Ativos</option>
          <option value="resolved">Status: Resolvidos</option>
        </select>
        <select value={filters.truck_id || ''} onChange={e => setFilters({...filters, truck_id: e.target.value})} style={inputStyle}>
          <option value="">Veículo: Todos</option>
          {trucks.map(t => <option key={t.id} value={t.id}>{t.plate}</option>)}
        </select>
        <select value={filters.severity || ''} onChange={e => setFilters({...filters, severity: e.target.value})} style={inputStyle}>
          <option value="">Severidade: Todas</option>
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>
        <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)', color: '#fff', border: 'none', padding: '0 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          <Filter size={14} /> Filtrar
        </button>
      </form>

      {/* List */}
      {loading ? <LoadingSpinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {alerts.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Nenhum alerta encontrado com estes filtros.</div>
          ) : alerts.map(a => {
            const isResolved = !!a.resolved_at;
            const meta = getAlertMeta(a.type);
            let icon = meta.icon;
            let color = '#fbbf24';
            if (a.severity === 'critical') { icon = ShieldAlert; color = '#f87171'; }
            if (isResolved) { icon = CheckCircle; color = '#34d399'; }

            const Icon = icon;

            return (
              <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px', background: isResolved ? 'rgba(255,255,255,0.02)' : `${color}0a`, border: `1px solid ${isResolved ? 'rgba(255,255,255,0.05)' : color+'40'}`, borderRadius: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} color={color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>{a.message}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{fmtDate(a.created_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                      <span style={{ fontWeight: 600, color: '#e2e8f0' }}>Veículo: {a.plate}</span>
                      <span>Tipo: {meta.label}</span>
                    </div>
                  </div>
                  {!isResolved && (
                    <button onClick={() => setResolvingId(a.id)} style={{ padding: '8px 16px', background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                      Resolver
                    </button>
                  )}
                </div>

                {isResolved && (
                  <div style={{ marginTop: '4px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '13px' }}>
                    <div style={{ color: '#34d399', fontWeight: 600, marginBottom: '4px' }}>Resolvido por {a.resolved_by} em {fmtDate(a.resolved_at)}</div>
                    <div style={{ color: '#94a3b8' }}>Nota: {a.resolution_note}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resolve Modal */}
      {resolvingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#111b28', padding: '24px', borderRadius: '16px', width: '400px', border: '1px solid #1f2e3b' }}>
            <h3 style={{ color: '#fff', margin: '0 0 16px 0' }}>Resolver Alerta</h3>
            <textarea
              autoFocus
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Descreva a ação tomada (mínimo 5 caracteres)..."
              rows={4}
              style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid #1f2e3b', borderRadius: '8px', color: '#fff', outline: 'none', resize: 'none' }}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button onClick={() => { setResolvingId(null); setNote(''); }} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #1f2e3b', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={confirmResolve} style={{ flex: 1, padding: '10px', background: '#2FBEB5', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Confirmar Resolução</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const inputStyle = {
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#e2e8f0',
  padding: '8px 12px',
  borderRadius: '8px',
  outline: 'none',
  fontSize: '13px'
};

