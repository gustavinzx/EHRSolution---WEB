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
    expect(screen.queryByText(/Demo@1234/i)).toBeNull();
  });

  it('botao ou dica de credenciais de teste NUNCA aparece mesmo com DEV=true', () => {
    vi.stubEnv('DEV', true);
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    expect(screen.queryByRole('button', { name: /credenciais de teste/i })).toBeNull();
    expect(screen.queryByText(/Demo@1234/i)).toBeNull();
    expect(screen.queryByText(/gestor@ehr.com/i)).toBeNull();
  });
});
