import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { localLockClient, DEFAULT_LOCAL_LOCK_URL, OfflineUnlockToken } from '../src/services/hardware/localLockClient';
import { OperationResultScreen } from '../src/screens/OperationResultScreen';
import { apiClient } from '../src/services/api/apiClient';

jest.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ vehicle: { id: 10, plate: 'ABC-1234', capacity: 400 } }),
}));

describe('localLockClient (Wi-Fi Local da Trava R4 e Bancada v2.0)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const validToken: OfflineUnlockToken = {
    truck_id: 1,
    session_id: 42,
    exp: 1763930000,
    mac: 'a'.repeat(64),
  };

  describe('getStatus()', () => {
    it('consulta GET /status no IP padrão 192.168.4.1 e devolve estado físico', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          truck_id: 1,
          estado: 'TRAVADO',
          pulso: false,
          gps_fix: true,
          sd: true,
          lora: true,
        }),
      });

      const st = await localLockClient.getStatus();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${DEFAULT_LOCAL_LOCK_URL}/status`,
        expect.objectContaining({ method: 'GET' })
      );
      expect(st.estado).toBe('TRAVADO');
      expect(st.truck_id).toBe(1);
    });

    it('lança erro quando a trava responde HTTP de erro ou payload inválido', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });
      await expect(localLockClient.getStatus()).rejects.toThrow('HTTP 500');

      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ invalido: true }),
      });
      await expect(localLockClient.getStatus()).rejects.toThrow('Resposta inválida');
    });

    it('mapeia falha de rede e AbortError para mensagens claras', async () => {
      (globalThis.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network request failed'));
      await expect(localLockClient.getStatus()).rejects.toThrow('Sem conexão com o Wi-Fi da trava');

      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      (globalThis.fetch as jest.Mock).mockRejectedValueOnce(abortErr);
      await expect(localLockClient.getStatus()).rejects.toThrow('Tempo esgotado');
    });
  });

  describe('unlockWithToken() — Revisão R4 (HMAC anti-replay)', () => {
    it('envia POST /unlock form-urlencoded com session, exp e mac e retorna ok:true', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });

      const res = await localLockClient.unlockWithToken(validToken);
      expect(res).toEqual({ ok: true, msg: undefined });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${DEFAULT_LOCAL_LOCK_URL}/unlock`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `session=42&exp=1763930000&mac=${'a'.repeat(64)}`,
        })
      );
    });

    it('valida campos do token antes de chamar a rede', async () => {
      await expect(
        localLockClient.unlockWithToken({ ...validToken, session_id: 0 })
      ).rejects.toThrow('session_id');
      await expect(
        localLockClient.unlockWithToken({ ...validToken, exp: -5 })
      ).rejects.toThrow('exp');
      await expect(
        localLockClient.unlockWithToken({ ...validToken, mac: 'curto' })
      ).rejects.toThrow('mac');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('lança erro quando a trava nega o token (HTTP 403 ou ok:false)', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ ok: false, msg: 'negado' }),
      });
      await expect(localLockClient.unlockWithToken(validToken)).rejects.toThrow('negado');
    });
  });

  describe('unlockLegacyPin() — Firmware de bancada v2.0', () => {
    it('envia POST /destravar?pin=... e retorna sucesso', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, msg: 'Destravado' }),
      });

      const res = await localLockClient.unlockLegacyPin('1234', 'http://192.168.4.1/');
      expect(res).toEqual({ ok: true, msg: 'Destravado' });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://192.168.4.1/destravar?pin=1234',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('rejeita PIN vazio e erro 403 de PIN incorreto', async () => {
      await expect(localLockClient.unlockLegacyPin('   ')).rejects.toThrow('PIN é obrigatório');
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ ok: false, msg: 'PIN Incorreto' }),
      });
      await expect(localLockClient.unlockLegacyPin('9999')).rejects.toThrow('PIN Incorreto');
    });
  });

  describe('OperationResultScreen — Integração do botão local-wifi-unlock-btn', () => {
    const mockNav = { popToTop: jest.fn(), replace: jest.fn(), canGoBack: () => true, goBack: jest.fn() } as any;

    it('busca o token offline e destrava via Wi-Fi avançando para FUELING', async () => {
      jest.spyOn(apiClient, 'getOfflineUnlockToken').mockResolvedValueOnce(validToken);
      jest.spyOn(localLockClient, 'unlockWithToken').mockResolvedValueOnce({ ok: true });

      const { getByTestId, findByText } = render(
        <OperationResultScreen
          navigation={mockNav}
          route={{ params: { sessionId: 42, initialState: 'WAITING_HARDWARE' } } as any}
        />
      );

      fireEvent.press(getByTestId('local-wifi-unlock-btn'));

      await findByText('Abastecendo...');
      expect(apiClient.getOfflineUnlockToken).toHaveBeenCalledWith(42);
      expect(localLockClient.unlockWithToken).toHaveBeenCalledWith(validToken);
    });

    it('guarda o token em cache se o 1º clique ocorrer antes de conectar no Wi-Fi da trava e usa o cache no 2º clique', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const tokenSpy = jest.spyOn(apiClient, 'getOfflineUnlockToken').mockResolvedValueOnce(validToken);
      const unlockSpy = jest
        .spyOn(localLockClient, 'unlockWithToken')
        .mockRejectedValueOnce(new Error('Sem conexão com o Wi-Fi da trava (192.168.4.1).'))
        .mockResolvedValueOnce({ ok: true });

      const { getByTestId, findByText } = render(
        <OperationResultScreen
          navigation={mockNav}
          route={{ params: { sessionId: 42, initialState: 'WAITING_HARDWARE' } } as any}
        />
      );

      // 1º clique (ainda no 4G): obtém e guarda o token, falha ao falar com 192.168.4.1
      fireEvent.press(getByTestId('local-wifi-unlock-btn'));
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Wi-Fi da Trava', expect.stringContaining('Sem conexão'));
      });
      expect(tokenSpy).toHaveBeenCalledTimes(1);

      // 2º clique (já no Wi-Fi TRAVA-EHR-01): não chama a nuvem de novo, usa o token em cache
      fireEvent.press(getByTestId('local-wifi-unlock-btn'));
      await findByText('Abastecendo...');
      expect(tokenSpy).toHaveBeenCalledTimes(1);
      expect(unlockSpy).toHaveBeenCalledTimes(2);
    });
  });
});
