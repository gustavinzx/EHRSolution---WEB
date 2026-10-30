// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import StagingBanner from './StagingBanner';

describe('StagingBanner - Faixa de Homologação', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('com VITE_APP_ENV=staging a faixa aparece com o texto exato', () => {
    vi.stubEnv('VITE_APP_ENV', 'staging');

    render(<StagingBanner />);

    const banner = screen.getByTestId('staging-banner');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('AMBIENTE DE HOMOLOGAÇÃO — dados simulados');
  });

  it('sem a variável VITE_APP_ENV a faixa NÃO aparece', () => {
    vi.stubEnv('VITE_APP_ENV', undefined);

    render(<StagingBanner />);

    expect(screen.queryByTestId('staging-banner')).toBeNull();
    expect(screen.queryByText(/AMBIENTE DE HOMOLOGAÇÃO/i)).toBeNull();
  });

  it('com VITE_APP_ENV=production a faixa NÃO aparece', () => {
    vi.stubEnv('VITE_APP_ENV', 'production');

    render(<StagingBanner />);

    expect(screen.queryByTestId('staging-banner')).toBeNull();
    expect(screen.queryByText(/AMBIENTE DE HOMOLOGAÇÃO/i)).toBeNull();
  });
});
