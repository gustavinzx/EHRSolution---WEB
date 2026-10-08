import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import client from '../api/client';

const METHOD_BADGE = {
  facial:           { label: 'Facial',           bg: 'rgba(56,189,248,0.15)', color: '#38BDF8', border: 'rgba(56,189,248,0.3)' },
  ble_fallback:     { label: 'BLE Fallback',     bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  manager_override: { label: 'Override Gestor',  bg: 'rgba(248,113,113,0.15)', color: '#f87171', border: 'rgba(248,113,113,0.3)' },
};

const DATA_SOURCE_BADGE = {
  hardware:   { label: 'Hardware',       bg: 'rgba(52,211,153,0.15)', color: '#34d399', border: 'rgba(52,211,153,0.3)' },
  manager:    { label: 'Gestor',         bg: 'rgba(56,189,248,0.15)', color: '#38BDF8', border: 'rgba(56,189,248,0.3)' },
  unverified: { label: 'Não Verificado', bg: 'rgba(248,113,113,0.15)', color: '#f87171', border: 'rgba(248,113,113,0.3)' },
  legacy:     { label: 'Legado',         bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: 'rgba(148,163,184,0.3)' },
};

export default function FuelingTable({ logs = [] }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    client.get('/settings/alerts').then(res => setSettings(res.data)).catch(() => {});
  }, []);

  if (!logs.length) return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>⛽</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px' }}>Nenhum abastecimento encontrado</div>
    </div>
  );

  const formatVal = (v) => v != null ? parseFloat(v).toFixed(1) : <span title="sem medição">—</span>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['#', 'Data / Hora', 'Motorista', 'Caminhão', 'Bomba (L)', 'Tanque (L)', 'Divergência (L / %)', 'Origem', 'Liberação'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
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
              <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: divColor ? `${divColor}11` : 'transparent' }}>
                <td style={{ padding: '12px 16px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '12px' }}>#{log.id}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>
                  {new Date(log.timestamp).toLocaleString('pt-BR')}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 500, fontSize: '13px', color: '#fff' }}>
                  {log.driver_name || `ID ${log.driver_id}`}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', background: 'rgba(47,190,181,0.1)', color: '#2FBEB5', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(47,190,181,0.2)' }}>
                    {log.plate || `ID ${log.truck_id}`}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#fff' }}>
                  {formatVal(log.pump_liters)}
                </td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#fff' }}>
                  {formatVal(log.tank_liters_delta)}
                </td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', color: divColor || '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {DivIcon && <DivIcon size={14} />}
                  {divText}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: dsBadge.bg, color: dsBadge.color, border: `1px solid ${dsBadge.border}` }}>
                    {dsBadge.label}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: mBadge.bg, color: mBadge.color, border: `1px solid ${mBadge.border}` }}>
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
