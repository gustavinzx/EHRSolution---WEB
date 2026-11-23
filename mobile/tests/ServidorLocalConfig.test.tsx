import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServidorLocalConfig } from '../src/components/ServidorLocalConfig';
import {
  normalizeServerUrl,
  saveServerOverride,
  loadServerOverride,
  getServerOverride,
  getBaseUrl,
  LOCAL_SERVER_STORAGE_KEY,
} from '../src/services/api/apiClient';

describe('ServidorLocalConfig & Server Override (EHR-Motorista-Local.apk parity)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    globalThis.fetch = jest.fn();
    await AsyncStorage.removeItem(LOCAL_SERVER_STORAGE_KEY);
    await saveServerOverride(null);
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await saveServerOverride(null);
    jest.restoreAllMocks();
  });

  describe('normalizeServerUrl & storage persistence', () => {
    it('normaliza IP puro, IP com porta e URL com /api', () => {
      expect(normalizeServerUrl('')).toBe('');
      expect(normalizeServerUrl('192.168.0.10')).toBe('http://192.168.0.10:3001/api');
      expect(normalizeServerUrl('192.168.0.10:3001')).toBe('http://192.168.0.10:3001/api');
      expect(normalizeServerUrl('http://192.168.0.100:3001/api/')).toBe('http://192.168.0.100:3001/api');
      expect(normalizeServerUrl('https://meu-servidor.local/api')).toBe('https://meu-servidor.local/api');
    });

    it('salva e carrega ehr_local_server_url sobrescrevendo getBaseUrl()', async () => {
      expect(getServerOverride()).toBeNull();
      await saveServerOverride('192.168.1.50');
      expect(getServerOverride()).toBe('http://192.168.1.50:3001/api');
      expect(getBaseUrl()).toBe('http://192.168.1.50:3001/api');
      expect(await AsyncStorage.getItem(LOCAL_SERVER_STORAGE_KEY)).toBe('http://192.168.1.50:3001/api');

      await saveServerOverride(null);
      expect(getServerOverride()).toBeNull();

      await AsyncStorage.setItem(LOCAL_SERVER_STORAGE_KEY, '192.168.1.77:3001');
      const loaded = await loadServerOverride();
      expect(loaded).toBe('http://192.168.1.77:3001/api');
      expect(getBaseUrl()).toBe('http://192.168.1.77:3001/api');
    });
  });

  describe('Componente visual ServidorLocalConfig', () => {
    it('abre ao tocar em "Alterar servidor", salva e testa /health exibindo "Servidor respondeu. Pode entrar."', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const { getByText, getByTestId, findByText } = render(<ServidorLocalConfig />);

      fireEvent.press(getByText('Alterar servidor'));

      const input = getByTestId('servidor-url-input');
      fireEvent.changeText(input, '192.168.0.10');
      fireEvent.press(getByText('Salvar e testar'));

      await findByText('Servidor respondeu. Pode entrar.');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://192.168.0.10:3001/api/health',
        expect.objectContaining({ method: 'GET' })
      );
      expect(getServerOverride()).toBe('http://192.168.0.10:3001/api');
    });

    it('exibe "O servidor respondeu HTTP <status>" quando /health retorna erro HTTP', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const { getByText, getByTestId, findByText } = render(<ServidorLocalConfig />);
      fireEvent.press(getByText('Alterar servidor'));
      fireEvent.changeText(getByTestId('servidor-url-input'), 'http://192.168.0.10:3001/api');
      fireEvent.press(getByText('Salvar e testar'));

      await findByText('O servidor respondeu HTTP 503');
    });

    it('exibe aviso de sem resposta quando a rede falha', async () => {
      (globalThis.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { getByText, getByTestId, findByText } = render(<ServidorLocalConfig />);
      fireEvent.press(getByText('Alterar servidor'));
      fireEvent.changeText(getByTestId('servidor-url-input'), '192.168.0.99');
      fireEvent.press(getByText('Salvar e testar'));

      await waitFor(async () => {
        expect(
          await findByText('Sem resposta. Confira o endereço, o Wi-Fi e se o servidor está ligado no computador.')
        ).toBeTruthy();
      });
    });
  });
});
