import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ShieldAlert, Search, Filter, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';
import { useFleet } from '../hooks/useFleet';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

import { getAlertMeta } from '../utils/alertMapping';

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
};

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR');
}

export default function AlertsPage() {
  const { user } = useAuth();
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      
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
          background: 'rgba(248, 113, 113, 0.12)',
          border: '1px solid rgba(248, 113, 113, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(248, 113, 113, 0.25)',
        }}>
          <ShieldAlert size={26} color="#f87171" />
        </div>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: '#FFFFFF', letterSpacing: '-0.3px' }}>
            Central de Alertas e Incidentes
          </h1>
          <p style={{ margin: '4px 0 0', color: '#8899A6', fontSize: '13px' }}>
            Auditoria em tempo real de divergências volumétricas, rotas não autorizadas e violações.
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <form
        onSubmit={handleApplyFilters}
        style={{
          ...glass,
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          background: 'rgba(11, 22, 40, 0.75)',
          padding: '16px 20px',
          alignItems: 'center',
        }}
      >
        <select value={filters.status || 'all'} onChange={e => setFilters({...filters, status: e.target.value})} style={inputStyle}>
          <option value="all">Status: Todos</option>
          <option value="active">Status: Ativos</option>
          <option value="resolved">Status: Resolvidos</option>
        </select>
        <select value={filters.truck_id || ''} onChange={e => setFilters({...filters, truck_id: e.target.value})} style={inputStyle}>
          <option value="">Veículo: Todos</option>
          {trucks.map(t => <option key={t.id} value={t.id}>{t.plate} - {t.model}</option>)}
        </select>
        <select value={filters.severity || ''} onChange={e => setFilters({...filters, severity: e.target.value})} style={inputStyle}>
          <option value="">Severidade: Todas</option>
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>
        <button
          type="submit"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, #00D4FF, #0072FF)',
            color: '#FFFFFF',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '13px',
            boxShadow: '0 0 16px rgba(0, 212, 255, 0.35)',
            transition: 'all 0.2s',
          }}
        >
          <Filter size={14} /> Filtrar
        </button>
      </form>

      {/* List */}
      {loading ? <LoadingSpinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {alerts.length === 0 ? (
            <div style={{ ...glass, padding: '80px 20px', textAlign: 'center', color: '#64748B' }}>
              <ShieldAlert size={48} style={{ opacity: 0.2, marginBottom: '14px' }} />
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#E2E8F0' }}>Nenhum alerta registrado</div>
              <div style={{ fontSize: '13px', marginTop: '6px' }}>Todos os veículos estão operando dentro dos parâmetros de segurança.</div>
            </div>
          ) : alerts.map(a => {
            const isResolved = !!a.resolved_at;
            const meta = getAlertMeta(a.type);
            let icon = meta.icon;
            let color = '#fbbf24';
            if (a.severity === 'critical') { icon = ShieldAlert; color = '#f87171'; }
            if (isResolved) { icon = CheckCircle; color = '#00F5A0'; }

            const Icon = icon;

            return (
              <div
                key={a.id}
                style={{
                  ...glass,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '20px 24px',
                  background: isResolved ? 'rgba(11, 22, 40, 0.6)' : `${color}0d`,
                  border: `1px solid ${isResolved ? 'rgba(255,255,255,0.06)' : color + '44'}`,
                  boxShadow: isResolved ? 'none' : `0 0 16px ${color}15`,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: `${color}18`,
                    border: `1px solid ${color}35`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={20} color={color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: '15px', color: '#FFFFFF' }}>{a.message}</div>
                      <div style={{ fontSize: '12px', color: '#8899A6', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(a.created_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', color: '#8899A6' }}>
                      <span style={{ fontWeight: 800, color: '#00D4FF', fontFamily: "'IBM Plex Mono', monospace" }}>Veículo: {a.plate}</span>
                      <span>Tipo: <strong style={{ color: '#e2e8f0' }}>{meta.label}</strong></span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: `${color}20`,
                        color: color,
                        textTransform: 'uppercase',
                      }}>
                        {a.severity}
                      </span>
                    </div>
                  </div>
                  {!isResolved && user?.role !== 'auditor' && (
                    <button
                      onClick={() => setResolvingId(a.id)}
                      style={{
                        padding: '9px 18px',
                        background: 'rgba(0, 245, 160, 0.12)',
                        color: '#00F5A0',
                        border: '1px solid rgba(0, 245, 160, 0.4)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '13px',
                        boxShadow: '0 0 10px rgba(0, 245, 160, 0.2)',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 245, 160, 0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 245, 160, 0.12)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      Resolver
                    </button>
                  )}
                </div>

                {isResolved && (
                  <div style={{ marginTop: '4px', padding: '12px 16px', background: 'rgba(6, 11, 19, 0.6)', borderRadius: '10px', fontSize: '13px', border: '1px solid rgba(0, 245, 160, 0.2)' }}>
                    <div style={{ color: '#00F5A0', fontWeight: 700, marginBottom: '4px' }}>Resolvido por {a.resolved_by} em {fmtDate(a.resolved_at)}</div>
                    <div style={{ color: '#cbd5e1' }}>Nota: {a.resolution_note}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resolve Modal */}
      {resolvingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'rgba(11, 22, 40, 0.98)', padding: '28px', borderRadius: '20px', width: '100%', maxWidth: '440px', border: '1px solid rgba(0, 212, 255, 0.35)', boxShadow: '0 24px 80px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 212, 255, 0.2)' }}>
            <h3 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: '18px', fontWeight: 800 }}>Resolver Alerta</h3>
            <textarea
              autoFocus
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Descreva a ação tomada (mínimo 5 caracteres)..."
              rows={4}
              style={{ width: '100%', padding: '12px 14px', background: 'rgba(6, 11, 19, 0.8)', border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: '10px', color: '#fff', outline: 'none', resize: 'none', fontSize: '13px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '18px' }}>
              <button onClick={() => { setResolvingId(null); setNote(''); }} style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmResolve} style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg, #00D4FF, #0072FF)', border: 'none', color: '#fff', borderRadius: '10px', cursor: 'pointer', fontWeight: 800, boxShadow: '0 0 16px rgba(0, 212, 255, 0.35)' }}>Confirmar Resolução</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
