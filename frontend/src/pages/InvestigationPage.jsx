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
import ErrorMessage from '../components/ErrorMessage';
import toast from 'react-hot-toast';

import { getAlertMeta } from '../utils/alertMapping';

const glass = {
  background: 'rgba(11, 22, 40, 0.75)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(0, 212, 255, 0.14)',
  borderRadius: '16px',
};

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
  low:      { color: '#00D4FF', bg: 'rgba(0,212,255,0.15)',   border: 'rgba(0,212,255,0.4)',   label: 'BAIXO' },
};

const SESSION_STATUS_CONFIG = {
  requested:  { color: '#fbbf24', label: 'Solicitado' },
  authorized: { color: '#00F5A0', label: 'Autorizado' },
  active:     { color: '#00D4FF', label: 'Ativo' },
  completed:  { color: '#64748b', label: 'Concluído' },
  expired:    { color: '#f87171', label: 'Expirado' },
  cancelled:  { color: '#94a3b8', label: 'Cancelado' },
};

function SectionTitle({ icon: Icon, title, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 212, 255, 0.15)', border: '1px solid rgba(0, 212, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={16} color="#00D4FF" />
      </div>
      <span style={{ fontWeight: 800, fontSize: '14px', color: '#fff' }}>{title}</span>
      {count != null && (
        <span style={{ fontSize: '11px', color: '#00D4FF', background: 'rgba(0, 212, 255, 0.1)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(0, 212, 255, 0.25)', fontWeight: 700 }}>
          {count}
        </span>
      )}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      ...glass,
      padding: '20px',
      ...style
    }}>
      {children}
    </div>
  );
}

function AlertRow({ alert, onResolve }) {
  const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.high;
  const typeLabel = getAlertMeta(alert.type).label;
  const isResolved = !!alert.resolved_at;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      padding: '14px', borderRadius: '12px',
      background: isResolved ? 'rgba(6, 11, 19, 0.4)' : cfg.bg,
      border: `1px solid ${isResolved ? 'rgba(255,255,255,0.06)' : cfg.border}`,
      opacity: isResolved ? 0.6 : 1, transition: 'all 0.2s',
      boxShadow: isResolved ? 'none' : `0 0 12px ${cfg.color}15`,
    }}>
      <div style={{ marginTop: '2px', flexShrink: 0 }}>
        {isResolved 
          ? <CheckCircle size={16} color="#00F5A0" />
          : <AlertTriangle size={16} color={cfg.color} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: isResolved ? '#64748b' : cfg.color }}>
            {typeLabel}
          </span>
          {!isResolved && (
            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: cfg.bg, color: cfg.color, fontWeight: 800 }}>
              {cfg.label}
            </span>
          )}
          {isResolved && (
            <span style={{ fontSize: '10px', color: '#00F5A0', fontWeight: 600 }}>Resolvido em {fmtDate(alert.resolved_at)}</span>
          )}
        </div>
        <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '4px 0 0', lineHeight: 1.4 }}>{alert.message}</p>
        <span style={{ fontSize: '11px', color: '#8899A6', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(alert.created_at)}</span>
      </div>
      {!isResolved && (
        <button
          onClick={() => onResolve(alert.id)}
          style={{
            flexShrink: 0, padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
            border: '1px solid rgba(0, 245, 160, 0.4)', background: 'rgba(0, 245, 160, 0.12)',
            color: '#00F5A0', cursor: 'pointer', whiteSpace: 'nowrap',
            boxShadow: '0 0 10px rgba(0, 245, 160, 0.2)',
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
      display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
      gap: '8px', alignItems: 'center',
      padding: '10px 12px', borderRadius: '10px',
      background: 'rgba(6, 11, 19, 0.5)', border: '1px solid rgba(0, 212, 255, 0.08)',
      fontSize: '12px'
    }}>
      <span style={{ color: '#cbd5e1', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(session.requested_at)}</span>
      <span style={{ color: '#8899A6', fontWeight: 600 }}>{session.driver_name || '—'}</span>
      <span style={{ color: '#8899A6' }}>{session.station_name || '—'}</span>
      <span style={{ color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>
    </div>
  );
}

function FuelingRow({ log }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr',
      gap: '8px', alignItems: 'center',
      padding: '10px 12px', borderRadius: '10px',
      background: 'rgba(6, 11, 19, 0.5)', border: '1px solid rgba(0, 212, 255, 0.08)',
      fontSize: '12px'
    }}>
      <span style={{ color: '#cbd5e1', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(log.timestamp)}</span>
      <span style={{ color: '#8899A6', fontWeight: 600 }}>{log.driver_name || '—'}</span>
      <span style={{ color: '#8899A6' }}>{log.station_name || '—'}</span>
      <span style={{ color: '#fbbf24', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{fmtLiters(log.level_before)}</span>
      <span style={{ color: '#00F5A0', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{fmtLiters(log.level_after)}</span>
    </div>
  );
}

export default function InvestigationPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [note, setNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await client.get(`/fleet/${id}/investigation`);
      setData(res.data);
      setError(null);
    } catch (err) {
      const status = err?.response?.status ?? err?.status;
      if (status === 404) {
        setError({
          type: 'not_found',
          title: 'Caminhão não encontrado',
          message: 'Nenhum caminhão com esse ID. Volte para a Frota e escolha um da lista.',
        });
      } else if (!err?.response && !err?.status) {
        setError({
          type: 'network',
          title: 'Erro de Conexão',
          message: 'Não foi possível carregar os dados. Tente novamente mais tarde.',
        });
      } else {
        setError({
          type: 'other',
          title: 'Erro ao carregar caminhão',
          message: 'Não foi possível carregar o caminhão.',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleResolve = async (alertId) => {
    setShowNoteModal(alertId);
  };

  const confirmResolve = async () => {
    if (!note || note.trim().length < 5) {
      toast.error('A nota de resolução deve ter pelo menos 5 caracteres.');
      return;
    }
    const alertId = showNoteModal;
    setResolvingId(alertId);
    try {
      await client.patch(`/fleet/alerts/${alertId}/resolve`, {
        resolution_note: note.trim()
      });
      toast.success('Alerta marcado como resolvido.');
      setNote('');
      setShowNoteModal(null);
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
    <ErrorMessage title={error.title} message={error.message}>
      {error.type === 'not_found' && (
        <button
          type="button"
          onClick={() => navigate('/fleet')}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: '1px solid rgba(0, 212, 255, 0.4)',
            background: 'rgba(0, 212, 255, 0.12)',
            color: '#00D4FF',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Voltar para a Frota
        </button>
      )}
      {error.type === 'other' && (
        <button
          type="button"
          onClick={fetchData}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>
      )}
    </ErrorMessage>
  );

  const { truck, telemetry, fuelingLogs, sessions, alerts } = data;
  const unresolvedAlerts = alerts.filter(a => !a.resolved_at);
  const resolvedAlerts   = alerts.filter(a =>  a.resolved_at);

  const chartData = [...telemetry].reverse().map((t, i) => ({
    name: new Date(t.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    nivel: parseFloat(t.fuel_level_liters || 0).toFixed(1),
    index: i
  }));

  const suspiciousIndexes = [];
  for (let i = 1; i < chartData.length; i++) {
    const diff = parseFloat(chartData[i - 1].nivel) - parseFloat(chartData[i].nivel);
    const cap = parseFloat(truck.capacity_liters || 500);
    if (diff / cap > 0.05) suspiciousIndexes.push(chartData[i].index);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
      
      {/* Note modal */}
      {showNoteModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={e => e.target === e.currentTarget && setShowNoteModal(null)}>
          <div style={{ background: 'rgba(11, 22, 40, 0.98)', border: '1px solid rgba(0, 212, 255, 0.35)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '440px', boxShadow: '0 24px 80px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 212, 255, 0.2)' }}>
            <h3 style={{ color: '#fff', margin: '0 0 16px', fontSize: '18px', fontWeight: 800 }}>Nota de Resolução</h3>
            <textarea
              placeholder="Descreva como o caso foi resolvido (mínimo 5 caracteres)..."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              style={{ width: '100%', background: 'rgba(6, 11, 19, 0.8)', border: '1px solid rgba(0, 212, 255, 0.25)', color: '#fff', padding: '12px 14px', borderRadius: '10px', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNoteModal(null)} style={{ padding: '9px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={confirmResolve} style={{ padding: '9px 18px', background: 'linear-gradient(135deg, #00D4FF, #0072FF)', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer', fontWeight: 800, boxShadow: '0 0 16px rgba(0, 212, 255, 0.35)' }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        ...glass,
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        background: 'linear-gradient(135deg, rgba(6, 11, 19, 0.95) 0%, rgba(13, 25, 43, 0.95) 100%)',
        border: '1px solid rgba(0, 212, 255, 0.22)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(0, 212, 255, 0.08)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            borderRadius: '10px',
            padding: '8px 14px',
            color: '#00D4FF',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 700,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 212, 255, 0.16)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 212, 255, 0.08)'}
        >
          <ArrowLeft size={15} /> Voltar
        </button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(0, 114, 255, 0.2))',
            border: '1px solid rgba(0, 212, 255, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <FileSearch size={22} color="#00D4FF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#fff' }}>
                Painel de Investigação Forense
              </h1>
              {unresolvedAlerts.length > 0 && (
                <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', fontWeight: 800 }}>
                  {unresolvedAlerts.length} alertas ativos
                </span>
              )}
            </div>
            <p style={{ margin: '3px 0 0', color: '#8899A6', fontSize: '13px', fontFamily: "'IBM Plex Mono', monospace" }}>
              {truck.plate} — {truck.model}
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          title="Atualizar dados de telemetria"
          style={{
            background: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            borderRadius: '10px',
            padding: '10px 14px',
            color: '#00D4FF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          <Search size={15} /> Recarregar
        </button>
      </div>

      {/* Info do veículo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { icon: Truck,  label: 'Motorista',    value: truck.driver_name || 'Sem motorista', color: '#00D4FF' },
          { icon: Fuel,   label: 'Nível Atual',  value: `${parseFloat(truck.current_level_liters || 0).toFixed(0)} L`, color: '#00F5A0' },
          { icon: Activity, label: 'Status', value: truck.status === 'ok' ? 'Operacional' : truck.status, color: '#38BDF8' },
          { icon: MapPin, label: 'Origem → Destino', value: truck.origin_name ? `${truck.origin_name} → ${truck.dest_name || '?'}` : 'Sem rota ativa', color: '#F59E0B' },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label} style={{ padding: '16px 20px', background: 'rgba(11, 22, 40, 0.75)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Icon size={14} color={color} />
              <span style={{ fontSize: '11px', color: '#8899A6', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700 }}>{label}</span>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff', fontFamily: "'IBM Plex Mono', monospace" }}>{value}</span>
          </Card>
        ))}
      </div>

      {/* Grid principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* Gráfico telemetria */}
        <Card style={{ display: 'flex', flexDirection: 'column', height: '360px' }}>
          <SectionTitle icon={TrendingDown} title="Telemetria de Combustível" count={`${chartData.length} leituras`} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {chartData.length === 0 ? (
              <div style={{ margin: 'auto', color: '#8899A6', fontSize: '13px' }}>
                Sem dados de telemetria disponíveis
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: '#8899A6', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} />
                  <YAxis tick={{ fill: '#8899A6', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(11,22,40,0.96)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '10px', fontSize: '12px' }}
                    labelStyle={{ color: '#8899A6' }}
                    formatter={(v) => [`${v} L`, 'Nível']}
                  />
                  {suspiciousIndexes.map(idx => (
                    <ReferenceLine key={idx} x={chartData[idx]?.name} stroke="#f87171" strokeDasharray="4 4" label={{ value: '⚠', fill: '#f87171', fontSize: 13 }} />
                  ))}
                  <Area type="monotone" dataKey="nivel" stroke="#00D4FF" fill="url(#fuelGrad)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {suspiciousIndexes.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '12px', color: '#f87171', flexShrink: 0, fontWeight: 700 }}>
                <AlertTriangle size={14} /> {suspiciousIndexes.length} queda(s) abrupta(s) detectada(s) no intervalo monitorado
              </div>
            )}
          </div>
        </Card>

        {/* Alertas ativos */}
        <Card style={{ display: 'flex', flexDirection: 'column', height: '360px' }}>
          <SectionTitle icon={ShieldAlert} title="Alertas Ativos" count={unresolvedAlerts.length} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {unresolvedAlerts.length === 0 ? (
              <div style={{ margin: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#00F5A0', fontSize: '14px', fontWeight: 600 }}>
                <ShieldCheck size={20} /> Nenhum alerta pendente para este veículo
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', paddingRight: '4px' }}>
                {unresolvedAlerts.map(a => (
                  <AlertRow key={a.id} alert={a} onResolve={handleResolve} />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Logs e Sessões lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* Sessões de abastecimento */}
        <Card style={{ display: 'flex', flexDirection: 'column', height: '330px' }}>
          <SectionTitle icon={Lock} title="Histórico de Liberações de Trava" count={sessions.length} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {sessions.length === 0 ? (
              <div style={{ margin: 'auto', color: '#8899A6', fontSize: '13px' }}>Sem sessões registradas</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '8px', padding: '8px 12px', marginBottom: '6px' }}>
                  {['Data/Hora', 'Motorista', 'Posto', 'Status'].map(h => (
                    <span key={h} style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#8899A6', fontWeight: 700 }}>{h}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', paddingRight: '4px' }}>
                  {sessions.map(s => <SessionRow key={s.id} session={s} />)}
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Logs de abastecimento */}
        <Card style={{ display: 'flex', flexDirection: 'column', height: '330px' }}>
          <SectionTitle icon={Fuel} title="Logs de Abastecimento" count={fuelingLogs.length} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {fuelingLogs.length === 0 ? (
              <div style={{ margin: 'auto', color: '#8899A6', fontSize: '13px' }}>Sem logs de abastecimento</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr', gap: '8px', padding: '8px 12px', marginBottom: '6px' }}>
                  {['Data/Hora', 'Motorista', 'Posto', 'Nível Antes', 'Nível Depois'].map(h => (
                    <span key={h} style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#8899A6', fontWeight: 700 }}>{h}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', paddingRight: '4px' }}>
                  {fuelingLogs.map(l => <FuelingRow key={l.id} log={l} />)}
                </div>
              </>
            )}
          </div>
        </Card>

      </div>

      {/* Alertas resolvidos */}
      {resolvedAlerts.length > 0 && (
        <Card>
          <SectionTitle icon={CheckCircle} title="Ocorrências Resolvidas" count={resolvedAlerts.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
            {resolvedAlerts.map(a => (
              <AlertRow key={a.id} alert={a} onResolve={() => {}} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
