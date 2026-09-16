import React from 'react';

const METHOD_BADGE = {
  facial:       { label: 'Facial',       bg: 'rgba(47,190,181,0.15)', color: '#2FBEB5', border: 'rgba(47,190,181,0.3)' },
  ble_fallback: { label: 'BLE Fallback', bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
};

export default function FuelingTable({ logs = [] }) {
  if (!logs.length) return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>⛽</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px' }}>Nenhum abastecimento encontrado</div>
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            {['#', 'Data / Hora', 'Motorista', 'Caminhão', 'Coordenadas', 'Antes → Depois', 'Método'].map(h => (
              <th key={h} style={{ textAlign: h === 'Antes → Depois' ? 'right' : 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map(log => {
            const m = METHOD_BADGE[log.release_method] || METHOD_BADGE.facial;
            return (
              <tr key={log.id}>
                <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  #{log.id}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {new Date(log.timestamp).toLocaleString('pt-BR')}
                </td>
                <td style={{ fontWeight: 500 }}>
                  {log.driver_name || `ID ${log.driver_id}`}
                </td>
                <td>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '12px',
                    background: 'rgba(47,190,181,0.08)', color: 'var(--teal)',
                    padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(47,190,181,0.2)',
                  }}>
                    {log.truck_plate || `ID ${log.truck_id}`}
                  </span>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {log.lat != null ? Number(log.lat).toFixed(4) : '—'},&nbsp;
                  {log.lng != null ? Number(log.lng).toFixed(4) : '—'}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{log.level_before}L</span>
                  <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
                  <span style={{ color: '#34d399', fontWeight: 600 }}>{log.level_after}L</span>
                </td>
                <td>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '3px 10px',
                    borderRadius: '20px', letterSpacing: '0.3px',
                    background: m.bg, color: m.color, border: `1px solid ${m.border}`,
                  }}>
                    {m.label}
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
