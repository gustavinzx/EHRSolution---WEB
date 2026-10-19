import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ErrorMessage({ title = 'Erro de Conexão', message, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', textAlign: 'center' }}>
      <AlertTriangle size={48} color="#f87171" style={{ marginBottom: '16px' }} />
      <h2 style={{ color: '#fff', margin: '0 0 8px 0', fontFamily: 'var(--font-display)' }}>{title}</h2>
      <p style={{ color: 'var(--text-muted)', margin: 0 }}>{message || 'Não foi possível carregar os dados. Tente novamente mais tarde.'}</p>
      {children && <div style={{ marginTop: '16px' }}>{children}</div>}
    </div>
  );
}
