// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(),
  }),
}));

describe('LoginPage - Remocao de credenciais demo', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('botao ou dica de credenciais de teste NUNCA aparece (com DEV=false)', () => {
    vi.stubEnv('DEV', false);
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    expect(screen.queryByRole('button', { name: /credenciais de teste/i })).toBeNull();
    expect(screen.queryByText(/Demo@\d+/i)).toBeNull();
  });

  it('botao ou dica de credenciais de teste NUNCA aparece mesmo com DEV=true', () => {
    vi.stubEnv('DEV', true);
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    expect(screen.queryByRole('button', { name: /credenciais de teste/i })).toBeNull();
    expect(screen.queryByText(/Demo@\d+/i)).toBeNull();
    expect(screen.queryByText(/gestor@ehr.com/i)).toBeNull();
  });

  it('na tela de login: com VITE_APP_ENV=staging a faixa de homologacao aparece', () => {
    vi.stubEnv('VITE_APP_ENV', 'staging');
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    const banner = screen.getByTestId('staging-banner');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('AMBIENTE DE HOMOLOGAÇÃO — dados simulados');
  });

  it('na tela de login: sem VITE_APP_ENV a faixa de homologacao NÃO aparece', () => {
    vi.stubEnv('VITE_APP_ENV', undefined);
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    expect(screen.queryByTestId('staging-banner')).toBeNull();
    expect(screen.queryByText(/AMBIENTE DE HOMOLOGAÇÃO/i)).toBeNull();
  });
});
