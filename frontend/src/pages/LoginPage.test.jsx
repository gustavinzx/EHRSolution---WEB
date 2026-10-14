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

describe('LoginPage - Credenciais de teste', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('com DEV=false (vi.stubEnv) o botão não aparece', () => {
    vi.stubEnv('DEV', false);
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    expect(screen.queryByRole('button', { name: /credenciais de teste/i })).toBeNull();
  });

  it('com DEV=true o botão aparece', () => {
    vi.stubEnv('DEV', true);
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    expect(screen.getByRole('button', { name: /credenciais de teste/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /credenciais de teste/i })).not.toBeNull();
  });
});
