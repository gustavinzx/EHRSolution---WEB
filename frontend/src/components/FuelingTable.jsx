import React from 'react';

const METHOD_BADGE = {
  facial:       { label: 'Facial',       bg: 'rgba(56,189,248,0.15)', color: '#38BDF8', border: 'rgba(56,189,248,0.3)' },
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
                    background: 'rgba(56,189,248,0.08)', color: 'var(--teal)',
                    padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.2)',
                  }}>
                    {log.truck_plate || `ID ${log.truck_id}`}
                  </span>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  {log.lat != null ? (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${log.lat},${log.lng}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(56,189,248,0.08)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(56,189,248,0.2)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      {Number(log.lat).toFixed(4)}, {Number(log.lng).toFixed(4)}
                    </a>
                  ) : '—'}
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
