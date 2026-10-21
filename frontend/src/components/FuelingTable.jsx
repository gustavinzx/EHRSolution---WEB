import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import client from '../api/client';

const METHOD_BADGE = {
  facial:           { label: 'Facial',           bg: 'rgba(0, 212, 255, 0.12)', color: '#00D4FF', border: 'rgba(0, 212, 255, 0.3)' },
  ble_fallback:     { label: 'BLE Fallback',     bg: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' },
  manager_override: { label: 'Override Gestor',  bg: 'rgba(248, 113, 113, 0.12)', color: '#f87171', border: 'rgba(248, 113, 113, 0.3)' },
};

const DATA_SOURCE_BADGE = {
  hardware:   { label: 'Hardware IoT',   bg: 'rgba(0, 245, 160, 0.12)', color: '#00F5A0', border: 'rgba(0, 245, 160, 0.35)' },
  manager:    { label: 'Gestor',         bg: 'rgba(0, 212, 255, 0.12)', color: '#00D4FF', border: 'rgba(0, 212, 255, 0.3)' },
  simulated:  { label: 'Simulado',       bg: 'rgba(148, 163, 184, 0.12)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.25)' },
  unverified: { label: 'Não Verificado', bg: 'rgba(248, 113, 113, 0.12)', color: '#f87171', border: 'rgba(248, 113, 113, 0.3)' },
  legacy:     { label: 'Legado',         bg: 'rgba(148, 163, 184, 0.12)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.25)' },
};

export function renderAnpMatchCell(log) {
  const sm = log?.station_match;
  if (!sm || !sm.status) {
    return (
      <span title="log legado sem aferição ANP" style={{ fontSize: '12px', color: '#8899A6' }}>
        {log?.station_name || '—'}
      </span>
    );
  }

  if (sm.status === 'matched') {
    const distM = sm.distance_m != null && Number.isFinite(Number(sm.distance_m))
      ? Math.round(Number(sm.distance_m))
      : 0;
    const stationName = sm.station?.razao_social || log?.station_name || null;
    const municipio = sm.station?.municipio
      ? (sm.station?.uf ? `${sm.station.municipio}/${sm.station.uf}` : sm.station.municipio)
      : null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <span style={{
          display: 'inline-block', alignSelf: 'flex-start',
          fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
          background: 'rgba(0, 245, 160, 0.12)', color: '#00F5A0',
          border: '1px solid rgba(0, 245, 160, 0.3)', whiteSpace: 'nowrap',
          fontWeight: 700,
        }}>
          {`ANP regular · a ${distM} m`}
        </span>
        {(stationName || municipio) && (
          <span style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.2 }}>
            {stationName || ''}
            {stationName && municipio ? ' — ' : ''}
            {municipio || ''}
          </span>
        )}
      </div>
    );
  }

  if (sm.status === 'unrecognized') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <span style={{
          display: 'inline-block', alignSelf: 'flex-start',
          fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
          background: 'rgba(248,113,113,0.15)', color: '#f87171',
          border: '1px solid rgba(248,113,113,0.3)', whiteSpace: 'nowrap',
          fontWeight: 700,
        }}>
          Não reconhecido
        </span>
        {log?.station_name && (
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{log.station_name}</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span style={{
        display: 'inline-block', alignSelf: 'flex-start',
        fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
        background: 'rgba(148,163,184,0.15)', color: '#94a3b8',
        border: '1px solid rgba(148,163,184,0.3)', whiteSpace: 'nowrap',
        fontWeight: 600,
      }}>
        Sem posição
      </span>
      {log?.station_name && (
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{log.station_name}</span>
      )}
    </div>
  );
}

const EMPTY_LOGS = [];

export default function FuelingTable({ logs = EMPTY_LOGS }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    client.get('/settings/alerts').then(res => setSettings(res.data)).catch(() => {});
  }, []);

  if (!logs.length) return (
    <div style={{ padding: '60px', textAlign: 'center', color: '#8899A6' }}>
      <div style={{ fontSize: '40px', marginBottom: '14px', opacity: 0.8 }}>⛽</div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: '#E2E8F0' }}>Nenhum abastecimento encontrado</div>
      <div style={{ fontSize: '13px', marginTop: '6px', color: '#64748B' }}>Ajuste os filtros de busca para visualizar os registros.</div>
    </div>
  );

  const formatVal = (v) => v != null ? parseFloat(v).toFixed(1) : <span title="sem medição" style={{ color: '#64748B' }}>—</span>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: 'rgba(6, 11, 19, 0.6)', borderBottom: '1px solid rgba(0, 212, 255, 0.12)' }}>
            {['#', 'Data / Hora', 'Motorista', 'Caminhão', 'Posto (ANP)', 'Bomba (L)', 'Tanque (L)', 'Divergência (L / %)', 'Origem', 'Liberação'].map(h => (
              <th key={h} style={{ padding: '14px 16px', fontSize: '11px', color: '#8899A6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const mBadge = METHOD_BADGE[log.release_method] || { label: log.release_method, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'transparent' };
            const dsBadge = DATA_SOURCE_BADGE[log.data_source] || DATA_SOURCE_BADGE.legacy;
            
            let divColor = null;
            let DivIcon = null;
            let divText = formatVal(log.divergence_liters);
            
            if (log.divergence_pct != null && settings) {
              const pct = parseFloat(log.divergence_pct);
              divText = `${parseFloat(log.divergence_liters).toFixed(1)} L (${pct.toFixed(1)}%)`;
              if (pct > settings.divergence_critical_pct) {
                divColor = '#f87171';
                DivIcon = ShieldAlert;
              } else if (pct > settings.divergence_pct) {
                divColor = '#fbbf24';
                DivIcon = AlertTriangle;
              }
            }

            return (
              <tr
                key={log.id}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: divColor ? `${divColor}0a` : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!divColor) e.currentTarget.style.background = 'rgba(0, 212, 255, 0.04)'; }}
                onMouseLeave={e => { if (!divColor) e.currentTarget.style.background = 'transparent'; }}
              >
                <td style={{ padding: '12px 16px', color: '#8899A6', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px' }}>#{log.id}</td>
                <td style={{ padding: '12px 16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>
                  {new Date(log.timestamp).toLocaleString('pt-BR')}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', color: '#fff' }}>
                  {log.driver_name || `ID ${log.driver_id}`}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 700, background: 'rgba(0, 212, 255, 0.1)', color: '#00D4FF', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(0, 212, 255, 0.25)' }}>
                    {log.plate || `ID ${log.truck_id}`}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {renderAnpMatchCell(log)}
                </td>
                <td style={{ padding: '12px 16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#fff' }}>
                  {formatVal(log.pump_liters)}
                </td>
                <td style={{ padding: '12px 16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#fff' }}>
                  {formatVal(log.tank_liters_delta)}
                </td>
                <td style={{ padding: '12px 16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: divColor || '#e2e8f0', fontWeight: divColor ? 700 : 500 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {DivIcon && <DivIcon size={14} color={divColor} />}
                    <span>{divText}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: dsBadge.bg, color: dsBadge.color, border: `1px solid ${dsBadge.border}` }}>
                    {dsBadge.label}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: mBadge.bg, color: mBadge.color, border: `1px solid ${mBadge.border}` }}>
                    {mBadge.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
