// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('./api/client', () => ({
  default: apiMocks,
}));

vi.mock('./components/AnpStationsMap', () => ({
  default: ({ stations, truncated, onSelectStation }) => (
    <div data-testid="mock-anp-map">
      <span>Mapa ({stations.length} postos)</span>
      {truncated && (
        <div data-testid="anp-map-truncated-warning">
          Mais de 500 postos na área visível — aproxime o zoom para visualizar todos os pontos da região.
        </div>
      )}
      {stations[0] && (
        <button type="button" onClick={() => onSelectStation(stations[0])}>
          Selecionar no mapa
        </button>
      )}
    </div>
  ),
}));

import StationsPage, { getAnpStationBadge } from './pages/StationsPage';

describe('StationsPage - Aba ANP (Brasil)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renderiza linhas da tabela ANP, badges a partir do booleano interdicted (Regular, Interditado, Sem coordenadas), cabeçalho e gaveta de detalhes', async () => {
    // Verifica diretamente que o selo usa o booleano interdicted e NÃO regex em situacao_sigaf
    expect(
      getAnpStationBadge({ situacao_sigaf: 'Desinterdição', interdicted: false, lat: -15.8, lng: -47.8 }).label
    ).toBe('Regular');
    expect(
      getAnpStationBadge({ situacao_sigaf: 'Interdição', interdicted: true, lat: -15.8, lng: -47.8 }).label
    ).toBe('Interditado');
    expect(
      getAnpStationBadge({ situacao_sigaf: null, interdicted: false, lat: null, lng: null }).label
    ).toBe('Sem coordenadas');

    apiMocks.get.mockImplementation((url) => {
      if (url === '/fueling/stations') {
        return Promise.resolve({
          data: [{ id: 1, name: 'Posto Rede Interna', address: 'Via 040', lat: -15.8, lng: -47.9, is_authorized: true }],
        });
      }
      if (url === '/anp/stations/summary') {
        return Promise.resolve({
          data: {
            total_active: 392,
            total_without_coordinates: 12,
            by_uf: [{ uf: 'DF', total: 392 }],
            last_sync_at: '2026-10-13T03:00:00.000Z',
          },
        });
      }
      if (url === '/anp/stations') {
        return Promise.resolve({
          data: {
            page: 1,
            limit: 20,
            total: 3,
            items: [
              {
                cnpj: '00306597003112',
                razao_social: 'CASCOL COMBUSTIVEIS PARA VEICULOS LTDA',
                endereco: 'QI 11 LOTE 01',
                bairro: 'LAGO SUL',
                cep: '71625175',
                uf: 'DF',
                municipio: 'BRASILIA',
                bandeira: 'VIBRA',
                lat: -15.8399235,
                lng: -47.8758677,
                acuracia_metros: 4,
                situacao_sigaf: 'Desinterdição',
                interdicted: false,
                produtos: [
                  { produto: 'OLEO DIESEL B S10 - COMUM', tancagem: 30, unidMedidaTancagem: 'm³', qtdeBicos: 4 },
                ],
                is_active: true,
                last_seen_at: '2026-10-13T03:00:00.000Z',
              },
              {
                cnpj: '48386351000109',
                razao_social: 'AC2 COMBUSTIVEIS LTDA',
                endereco: 'QUADRA QNM 34',
                bairro: 'TAGUATINGA',
                cep: '72145450',
                uf: 'DF',
                municipio: 'BRASILIA',
                bandeira: 'BANDEIRA BRANCA',
                lat: null,
                lng: null,
                acuracia_metros: null,
                situacao_sigaf: null,
                interdicted: false,
                produtos: [],
                is_active: true,
                last_seen_at: '2026-10-13T03:00:00.000Z',
              },
              {
                cnpj: '10461013000161',
                razao_social: 'POSTO EXEMPLO INTERDITADO LTDA',
                endereco: 'RODOVIA DF 180',
                bairro: 'SAMAMBAIA',
                cep: '72300000',
                uf: 'DF',
                municipio: 'BRASILIA',
                bandeira: 'IPIRANGA',
                lat: -15.9,
                lng: -48.1,
                acuracia_metros: 4,
                situacao_sigaf: 'Interdição',
                interdicted: true,
                produtos: [],
                is_active: true,
                last_seen_at: '2026-10-13T03:00:00.000Z',
              },
            ],
          },
        });
      }
      if (url === '/anp/stations/in-bounds') {
        return Promise.resolve({
          data: {
            items: [{ cnpj: '00306597003112', razao_social: 'CASCOL COMBUSTIVEIS PARA VEICULOS LTDA', lat: -15.83, lng: -47.87, interdicted: false }],
            total: 520,
            truncated: true,
          },
        });
      }
      if (url === '/anp/stations/00306597003112') {
        return Promise.resolve({
          data: {
            cnpj: '00306597003112',
            razao_social: 'CASCOL COMBUSTIVEIS PARA VEICULOS LTDA',
            endereco: 'QI 11 LOTE 01',
            bairro: 'LAGO SUL',
            cep: '71625175',
            uf: 'DF',
            municipio: 'BRASILIA',
            bandeira: 'VIBRA',
            lat: -15.8399235,
            lng: -47.8758677,
            acuracia_metros: 4,
            situacao_sigaf: 'Desinterdição',
            interdicted: false,
            produtos: [
              { produto: 'OLEO DIESEL B S10 - COMUM', tancagem: 30, unidMedidaTancagem: 'm³', qtdeBicos: 4 },
            ],
            is_active: true,
            last_seen_at: '2026-10-13T03:00:00.000Z',
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(<StationsPage />);

    // Inicia na aba Rede Autorizada e troca para a aba ANP (Brasil)
    const anpTabBtn = await screen.findByRole('tab', { name: /ANP \(Brasil\)/i });
    fireEvent.click(anpTabBtn);

    // Cabeçalho com contagem e data
    await waitFor(() => {
      expect(screen.getByTestId('anp-header-summary').textContent).toMatch(/392 postos ativos • atualizado em/i);
    });

    // Linhas da tabela
    expect(await screen.findByText('CASCOL COMBUSTIVEIS PARA VEICULOS LTDA')).not.toBeNull();
    expect(screen.getByText('00.306.597/0031-12')).not.toBeNull();
    expect(screen.getByText('AC2 COMBUSTIVEIS LTDA')).not.toBeNull();
    expect(screen.getByText('POSTO EXEMPLO INTERDITADO LTDA')).not.toBeNull();

    // Badges de situação (a partir do booleano interdicted)
    expect(screen.getByText('Regular')).not.toBeNull();
    expect(screen.getByText('Sem coordenadas')).not.toBeNull();
    expect(screen.getByText('Interditado')).not.toBeNull();

    // Aviso de truncamento do mapa (> 500 postos)
    expect(screen.getByTestId('anp-map-truncated-warning').textContent).toMatch(/aproxime o zoom/i);

    // Clicar na linha abre a gaveta de detalhes com produtos, tancagem e bicos
    fireEvent.click(screen.getByText('CASCOL COMBUSTIVEIS PARA VEICULOS LTDA'));
    expect(await screen.findByRole('dialog', { name: /Detalhes do Posto ANP/i })).not.toBeNull();
    expect(await screen.findByText('OLEO DIESEL B S10 - COMUM')).not.toBeNull();
  });

  it('chama a API /anp/stations quando os filtros UF, município, bandeira e busca (q) são alterados', async () => {
    apiMocks.get.mockImplementation((url) => {
      if (url === '/fueling/stations') return Promise.resolve({ data: [] });
      if (url === '/anp/stations/summary') {
        return Promise.resolve({
          data: {
            total_active: 100,
            total_without_coordinates: 0,
            by_uf: [{ uf: 'DF', total: 100 }],
            last_sync_at: '2026-10-13T03:00:00.000Z',
          },
        });
      }
      if (url === '/anp/stations') {
        return Promise.resolve({
          data: { items: [], page: 1, limit: 20, total: 0 },
        });
      }
      if (url === '/anp/stations/in-bounds') {
        return Promise.resolve({
          data: { items: [], total: 0, truncated: false },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(<StationsPage initialTab="anp" />);

    const ufSelect = await screen.findByLabelText('Filtrar por UF');
    fireEvent.change(ufSelect, { target: { value: 'DF' } });

    await waitFor(() => {
      expect(apiMocks.get).toHaveBeenCalledWith(
        '/anp/stations',
        expect.objectContaining({
          params: expect.objectContaining({ uf: 'DF', page: 1, limit: 20 }),
        })
      );
    });

    const municipioInput = screen.getByLabelText('Filtrar por município');
    fireEvent.change(municipioInput, { target: { value: 'BRASILIA' } });

    await waitFor(() => {
      expect(apiMocks.get).toHaveBeenCalledWith(
        '/anp/stations',
        expect.objectContaining({
          params: expect.objectContaining({ uf: 'DF', municipio: 'BRASILIA' }),
        })
      );
    });

    const bandeiraInput = screen.getByLabelText('Filtrar por bandeira');
    fireEvent.change(bandeiraInput, { target: { value: 'VIBRA' } });

    await waitFor(() => {
      expect(apiMocks.get).toHaveBeenCalledWith(
        '/anp/stations',
        expect.objectContaining({
          params: expect.objectContaining({ uf: 'DF', municipio: 'BRASILIA', bandeira: 'VIBRA' }),
        })
      );
    });

    const qInput = screen.getByLabelText('Buscar por nome ou CNPJ');
    fireEvent.change(qInput, { target: { value: '00306597003112' } });

    await waitFor(() => {
      expect(apiMocks.get).toHaveBeenCalledWith(
        '/anp/stations',
        expect.objectContaining({
          params: expect.objectContaining({
            uf: 'DF',
            municipio: 'BRASILIA',
            bandeira: 'VIBRA',
            q: '00306597003112',
          }),
        })
      );
    });
  });

  it('exibe estado vazio orientando "rode npm run anp:sync" quando ainda não foi sincronizado', async () => {
    apiMocks.get.mockImplementation((url) => {
      if (url === '/fueling/stations') return Promise.resolve({ data: [] });
      if (url === '/anp/stations/summary') {
        return Promise.resolve({
          data: {
            total_active: 0,
            total_without_coordinates: 0,
            by_uf: [],
            last_sync_at: null,
          },
        });
      }
      if (url === '/anp/stations') {
        return Promise.resolve({
          data: { items: [], page: 1, limit: 20, total: 0 },
        });
      }
      if (url === '/anp/stations/in-bounds') {
        return Promise.resolve({
          data: { items: [], total: 0, truncated: false },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(<StationsPage initialTab="anp" />);

    const emptyBox = await screen.findByTestId('anp-empty-state');
    expect(emptyBox.textContent).toMatch(/rode npm run anp:sync/i);
  });
});
