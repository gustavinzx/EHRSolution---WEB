import React from 'react';

export default function StagingBanner() {
  const env = import.meta.env?.VITE_APP_ENV;
  if (env !== 'staging') return null;

  return (
    <div
      data-testid="staging-banner"
      role="banner"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '28px',
        zIndex: 99999,
        background: 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)',
        color: '#0F172A',
        fontWeight: 700,
        fontSize: '12px',
        letterSpacing: '0.04em',
        textAlign: 'center',
        lineHeight: '28px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
        userSelect: 'none',
      }}
    >
      AMBIENTE DE HOMOLOGAÇÃO — dados simulados
    </div>
  );
}
