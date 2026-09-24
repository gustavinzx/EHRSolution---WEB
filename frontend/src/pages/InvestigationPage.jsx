import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, AlertTriangle, ShieldAlert, ShieldCheck, Clock, Fuel, 
  MapPin, User, Truck, CheckCircle, XCircle, Search, FileSearch,
  Activity, Lock, TrendingDown, Info
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtLiters(v) {
  if (v == null) return '—';
  return `${parseFloat(v).toFixed(1)} L`;
}

const SEVERITY_CONFIG = {
  critical: { color: '#f87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.4)', label: 'CRÍTICO' },
  high:     { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.4)',  label: 'ALTO' },
  medium:   { color: '#fb923c', bg: 'rgba(251,146,60,0.15)',  border: 'rgba(251,146,60,0.4)',  label: 'MÉDIO' },
  low:      { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.4)',  label: 'BAIXO' },
};

const ALERT_TYPE_LABEL = {
  suspicious_fuel_drop: 'Queda Suspeita de Combustível',
  unauthorized_station: 'Posto Não Autorizado',
  security_tamper: 'Violação Física da Trava',
  security_unauthorized_movement: 'Movimento Não Autorizado',
  security_theft_signal: 'Sinal de Roubo',
  security_emergency_button: 'Botão de Emergência',
};

const SESSION_STATUS_CONFIG = {
  requested:  { color: '#fbbf24', label: 'Solicitado' },
  authorized: { color: '#34d399', label: 'Autorizado' },
  active:     { color: '#38bdf8', label: 'Ativo' },
  completed:  { color: '#64748b', label: 'Concluído' },
  expired:    { color: '#f87171', label: 'Expirado' },
  cancelled:  { color: '#94a3b8', label: 'Cancelado' },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={16} color="var(--teal)" />
      </div>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: '#fff' }}>{title}</span>
      {count != null && (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.07)', padding: '2px 8px', borderRadius: '20px' }}>
          {count}
        </span>
      )}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px', padding: '20px', ...style
    }}>
      {children}
    </div>
  );
}

function AlertRow({ alert, onResolve }) {
  const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.high;
  const typeLabel = ALERT_TYPE_LABEL[alert.type] || alert.type;
  const isResolved = !!alert.resolved_at;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      padding: '12px', borderRadius: '10px',
      background: isResolved ? 'rgba(255,255,255,0.02)' : cfg.bg,
      border: `1px solid ${isResolved ? 'rgba(255,255,255,0.06)' : cfg.border}`,
      opacity: isResolved ? 0.6 : 1, transition: 'opacity 0.2s'
    }}>
      <div style={{ marginTop: '2px', flexShrink: 0 }}>
        {isResolved 
          ? <CheckCircle size={16} color="#34d399" />
          : <AlertTriangle size={16} color={cfg.color} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: isResolved ? '#64748b' : cfg.color }}>
            {typeLabel}
          </span>
          {!isResolved && (
            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: cfg.bg, color: cfg.color, fontWeight: 700 }}>
              {cfg.label}
            </span>
          )}
          {isResolved && (
            <span style={{ fontSize: '10px', color: '#34d399' }}>Resolvido em {fmtDate(alert.resolved_at)}</span>
          )}
        </div>
        <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '4px 0 0', lineHeight: 1.4 }}>{alert.message}</p>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmtDate(alert.created_at)}</span>
      </div>
      {!isResolved && (
        <button
          onClick={() => onResolve(alert.id)}
          style={{
            flexShrink: 0, padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
            border: '1px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.1)',
            color: '#34d399', cursor: 'pointer', whiteSpace: 'nowrap'
          }}
        >
          Marcar Resolvido
        </button>
      )}
    </div>
  );
}

function SessionRow({ session }) {
  const cfg = SESSION_STATUS_CONFIG[session.status] || { color: '#94a3b8', label: session.status };
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
      gap: '8px', alignItems: 'center',
      padding: '10px 12px', borderRadius: '8px',
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
      fontSize: '12px'
    }}>
      <span style={{ color: '#cbd5e1' }}>{fmtDate(session.requested_at)}</span>
      <span style={{ color: '#94a3b8' }}>{session.driver_name || '—'}</span>
      <span style={{ color: '#94a3b8' }}>{session.station_name || '—'}</span>
      <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
    </div>
  );
}

function FuelingRow({ log }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr',
      gap: '8px', alignItems: 'center',
      padding: '10px 12px', borderRadius: '8px',
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
      fontSize: '12px'
    }}>
      <span style={{ color: '#cbd5e1' }}>{fmtDate(log.timestamp)}</span>
      <span style={{ color: '#94a3b8' }}>{log.driver_name || '—'}</span>
      <span style={{ color: '#94a3b8' }}>{log.station_name || '—'}</span>
      <span style={{ color: '#fbbf24' }}>{fmtLiters(log.level_before)}</span>
      <span style={{ color: '#34d399' }}>{fmtLiters(log.level_after)}</span>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function InvestigationPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [note, setNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(null); // alert id

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await client.get(`/fleet/${id}/investigation`);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar dados de investigação.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleResolve = async (alertId) => {
    setShowNoteModal(alertId);
  };

  const confirmResolve = async () => {
    const alertId = showNoteModal;
    setShowNoteModal(null);
    setResolvingId(alertId);
    try {
      await client.patch(`/fleet/alerts/${alertId}/resolve`, {
        resolution_note: note || null,
        resolved_by: JSON.parse(localStorage.getItem('user') || '{}')?.name || 'Gestor'
      });
      toast.success('Alerta marcado como resolvido.');
      setNote('');
      await fetchData();
    } catch {
      toast.error('Erro ao resolver alerta.');
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <LoadingSpinner />
    </div>
  );

  if (error) return (
    <div style={{ padding: '32px', color: '#f87171', textAlign: 'center' }}>
      <AlertTriangle size={32} style={{ marginBottom: '8px' }} />
      <p>{error}</p>
      <button onClick={() => navigate(-1)} style={{ marginTop: '16px', padding: '8px 16px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}>
        Voltar
      </button>
    </div>
  );

  const { truck, telemetry, fuelingLogs, sessions, alerts } = data;
  const unresolvedAlerts = alerts.filter(a => !a.resolved_at);
  const resolvedAlerts   = alerts.filter(a =>  a.resolved_at);

  // Build chart data (reverse so oldest is on left)
  const chartData = [...telemetry].reverse().map((t, i) => ({
    name: new Date(t.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    nivel: parseFloat(t.fuel_level_liters || 0).toFixed(1),
    index: i
  }));

  // Find suspicious drops for reference lines in chart
  const suspiciousIndexes = [];
  for (let i = 1; i < chartData.length; i++) {
    const diff = parseFloat(chartData[i - 1].nivel) - parseFloat(chartData[i].nivel);
    const cap = parseFloat(truck.capacity_liters || 500);
    if (diff / cap > 0.05) suspiciousIndexes.push(chartData[i].index);
  }

  return (
    <div style={{ padding: '24px 32px', overflowY: 'auto', height: '100%', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Note modal */}
      {showNoteModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={e => e.target === e.currentTarget && setShowNoteModal(null)}>
          <div style={{ background: 'rgba(11,20,36,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px' }}>
            <h3 style={{ color: '#fff', margin: '0 0 16px', fontFamily: 'var(--font-display)' }}>Nota de Resolução</h3>
            <textarea
              placeholder="Descreva como o caso foi resolvido (opcional)..."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px', borderRadius: '8px', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNoteModal(null)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmResolve} style={{ padding: '8px 16px', background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)', borderRadius: '8px', color: '#34d399', cursor: 'pointer', fontWeight: 700 }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px' }}>
          <ArrowLeft size={15} /> Voltar
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSearch size={20} color="var(--teal)" />
            <h1 style={{ margin: 0, fontSize: '20px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff' }}>
              Painel de Investigação
            </h1>
            {unresolvedAlerts.length > 0 && (
              <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '20px', background: 'rgba(248,113,113,0.15)', color: '#f87171', fontWeight: 700 }}>
                {unresolvedAlerts.length} alertas ativos
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            {truck.plate} — {truck.model}
          </p>
        </div>
        <button onClick={fetchData} title="Atualizar" style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '8px', padding: '8px', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <Search size={16} />
        </button>
      </div>

      {/* Info do veículo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { icon: Truck,  label: 'Motorista',    value: truck.driver_name || 'Sem motorista' },
          { icon: Fuel,   label: 'Nível Atual',  value: `${parseFloat(truck.current_level_liters || 0).toFixed(0)} L` },
          { icon: Activity, label: 'Status', value: truck.status === 'ok' ? 'Normal' : truck.status },
          { icon: MapPin, label: 'Origem → Destino', value: truck.origin_name ? `${truck.origin_name} → ${truck.dest_name || '?'}` : 'Sem rota ativa' },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label} style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Icon size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{value}</span>
          </Card>
        ))}
      </div>

      {/* Grid principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        
        {/* Gráfico telemetria */}
        <Card>
          <SectionTitle icon={TrendingDown} title="Telemetria de Combustível" count={`${chartData.length} leituras`} />
          {chartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Sem dados de telemetria disponíveis
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#cbd5e1' }}
                  formatter={(v) => [`${v} L`, 'Nível']}
                />
                {suspiciousIndexes.map(idx => (
                  <ReferenceLine key={idx} x={chartData[idx]?.name} stroke="#f87171" strokeDasharray="4 4" label={{ value: '⚠', fill: '#f87171', fontSize: 12 }} />
                ))}
                <Area type="monotone" dataKey="nivel" stroke="#38bdf8" fill="url(#fuelGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          {suspiciousIndexes.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '11px', color: '#f87171' }}>
              <AlertTriangle size={12} /> {suspiciousIndexes.length} queda(s) suspeita(s) detectada(s) no período
            </div>
          )}
        </Card>

        {/* Alertas ativos */}
        <Card>
          <SectionTitle icon={ShieldAlert} title="Alertas Ativos" count={unresolvedAlerts.length} />
          {unresolvedAlerts.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '24px', color: '#34d399', fontSize: '13px', justifyContent: 'center' }}>
              <ShieldCheck size={18} /> Nenhum alerta ativo para este veículo
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {unresolvedAlerts.map(a => (
                <AlertRow key={a.id} alert={a} onResolve={handleResolve} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Sessões de abastecimento */}
      <Card style={{ marginBottom: '20px' }}>
        <SectionTitle icon={Lock} title="Histórico de Liberações de Trava" count={sessions.length} />
        {sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>Sem sessões registradas</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', padding: '8px 12px', marginBottom: '6px' }}>
              {['Data/Hora', 'Motorista', 'Posto', 'Status'].map(h => (
                <span key={h} style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</span>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' }}>
              {sessions.map(s => <SessionRow key={s.id} session={s} />)}
            </div>
          </>
        )}
      </Card>

      {/* Logs de abastecimento */}
      <Card style={{ marginBottom: '20px' }}>
        <SectionTitle icon={Fuel} title="Logs de Abastecimento" count={fuelingLogs.length} />
        {fuelingLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>Sem logs de abastecimento</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr', gap: '8px', padding: '8px 12px', marginBottom: '6px' }}>
              {['Data/Hora', 'Motorista', 'Posto', 'Nível Antes', 'Nível Depois'].map(h => (
                <span key={h} style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</span>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' }}>
              {fuelingLogs.map(l => <FuelingRow key={l.id} log={l} />)}
            </div>
          </>
        )}
      </Card>

      {/* Alertas resolvidos */}
      {resolvedAlerts.length > 0 && (
        <Card>
          <SectionTitle icon={CheckCircle} title="Ocorrências Resolvidas" count={resolvedAlerts.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {resolvedAlerts.map(a => (
              <AlertRow key={a.id} alert={a} onResolve={() => {}} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
