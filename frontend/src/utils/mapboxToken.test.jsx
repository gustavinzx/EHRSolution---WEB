// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as mapboxTokenUtil from './mapboxToken';
import MapView from '../components/MapView';
import AuthorizedStationsMap from '../components/AuthorizedStationsMap';
import AnpStationsMap from '../components/AnpStationsMap';

describe('mapboxToken utility & map fallbacks', () => {
  const originalEnv = import.meta.env.VITE_MAPBOX_TOKEN;

  afterEach(() => {
    import.meta.env.VITE_MAPBOX_TOKEN = originalEnv;
    vi.restoreAllMocks();
  });

  describe('getMapboxToken', () => {
    it('devolve string vazia quando VITE_MAPBOX_TOKEN não está definida ou é vazia', () => {
      import.meta.env.VITE_MAPBOX_TOKEN = '';
      expect(mapboxTokenUtil.getMapboxToken()).toBe('');

      delete import.meta.env.VITE_MAPBOX_TOKEN;
      expect(mapboxTokenUtil.getMapboxToken()).toBe('');
    });

    it('devolve o valor da variável quando VITE_MAPBOX_TOKEN está configurada', () => {
      import.meta.env.VITE_MAPBOX_TOKEN = 'test_token_123';
      expect(mapboxTokenUtil.getMapboxToken()).toBe('test_token_123');
    });
  });

  describe('Componentes de Mapa sem token', () => {
    beforeEach(() => {
      import.meta.env.VITE_MAPBOX_TOKEN = '';
    });

    it('MapView exibe "Token do Mapbox não configurado" quando ausente', () => {
      render(
        <MemoryRouter>
          <MapView trucks={[]} />
        </MemoryRouter>
      );
      expect(screen.getByText(/Token do Mapbox não configurado/i)).not.toBeNull();
    });

    it('AuthorizedStationsMap exibe "Token do Mapbox não configurado" quando ausente', () => {
      render(<AuthorizedStationsMap stations={[]} />);
      expect(screen.getByText(/Token do Mapbox não configurado/i)).not.toBeNull();
    });

    it('AnpStationsMap exibe "Token do Mapbox não configurado" quando ausente', () => {
      render(<AnpStationsMap stations={[]} />);
      expect(screen.getByText(/Token do Mapbox não configurado/i)).not.toBeNull();
    });
  });
});
