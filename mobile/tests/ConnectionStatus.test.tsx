import React from 'react';
import { AppState, Text } from 'react-native';
import { render, act, screen } from '@testing-library/react-native';
import { checkServerHealth } from '../src/services/api/healthCheck';
import { ConnectionProvider, ConnectionContext } from '../src/contexts/ConnectionContext';
import { ConnectionStatus } from '../src/components/ConnectionStatus';
import { useConnection } from '../src/hooks/useConnection';

const okResponse = { ok: true, status: 200 } as Response;
const errorResponse = { ok: false, status: 503 } as Response;

const renderWithStatus = (status: 'online' | 'offline' | 'server_unavailable') =>
  render(
    <ConnectionContext.Provider value={{ status, refresh: async () => {} }}>
      <ConnectionStatus />
    </ConnectionContext.Provider>
  );

const StatusProbe = () => {
  const { status } = useConnection();
  return <Text testID="probe">{status}</Text>;
};

describe('checkServerHealth (endpoint de saúde existente /api/health)', () => {
  it('online: chama GET <API>/health e retorna "online" quando a API responde ok', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse);
    await expect(checkServerHealth(fetchMock as any)).resolves.toBe('online');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/health$/);
    expect(init.method).toBe('GET');
    // Não envia token nem corpo: checagem leve e isolada
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it('sem internet: falha de rede antes de qualquer resposta retorna "offline"', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(checkServerHealth(fetchMock as any)).resolves.toBe('offline');
  });

  it('servidor indisponível: resposta HTTP de erro retorna "server_unavailable"', async () => {
    const fetchMock = jest.fn().mockResolvedValue(errorResponse);
    await expect(checkServerHealth(fetchMock as any)).resolves.toBe('server_unavailable');
  });

  it('servidor indisponível: timeout curto aborta e retorna "server_unavailable"', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = jest.fn((_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
      );
      const promise = checkServerHealth(fetchMock as any, 5000);
      jest.advanceTimersByTime(5000);
      await expect(promise).resolves.toBe('server_unavailable');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ConnectionStatus (faixa informativa)', () => {
  it('NÃO aparece quando está online', () => {
    renderWithStatus('online');
    expect(screen.queryByTestId('connection-status')).toBeNull();
    expect(screen.queryByText('Sem internet')).toBeNull();
    expect(screen.queryByText('Servidor indisponível')).toBeNull();
  });

  it('NÃO aparece sem Provider (padrão online), sem quebrar a tela', () => {
    render(<ConnectionStatus />);
    expect(screen.queryByTestId('connection-status')).toBeNull();
  });

  it('mostra "Sem internet" quando offline, em uma única linha e sem capturar toques', () => {
    renderWithStatus('offline');
    const bar = screen.getByTestId('connection-status');
    expect(bar.props.pointerEvents).toBe('none');
    const label = screen.getByText('Sem internet');
    expect(label.props.numberOfLines).toBe(1);
  });

  it('mostra "Servidor indisponível" quando a API não responde', () => {
    renderWithStatus('server_unavailable');
    expect(screen.getByTestId('connection-status')).toBeTruthy();
    expect(screen.getByText('Servidor indisponível')).toBeTruthy();
  });
});

describe('ConnectionProvider (checagem a cada 30 s e ao voltar ao primeiro plano)', () => {
  let appStateHandler: ((state: string) => void) | null;
  let removeMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    appStateHandler = null;
    removeMock = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type: any, handler: any) => {
      appStateHandler = handler;
      return { remove: removeMock } as any;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  it('checa ao montar, a cada 30 s e ao app voltar a "active"; reflete os 3 estados', async () => {
    const checkFn = jest
      .fn()
      .mockResolvedValueOnce('online')
      .mockResolvedValueOnce('offline')
      .mockResolvedValueOnce('server_unavailable');

    render(
      <ConnectionProvider checkFn={checkFn}>
        <StatusProbe />
        <ConnectionStatus />
      </ConnectionProvider>
    );
    await flush();
    expect(checkFn).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('probe').props.children).toBe('online');
    expect(screen.queryByTestId('connection-status')).toBeNull();

    // 30 s depois: nova checagem automática
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    await flush();
    expect(checkFn).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Sem internet')).toBeTruthy();

    // Ir para segundo plano não dispara checagem; voltar a "active" dispara
    await act(async () => {
      appStateHandler?.('background');
    });
    expect(checkFn).toHaveBeenCalledTimes(2);
    await act(async () => {
      appStateHandler?.('active');
    });
    await flush();
    expect(checkFn).toHaveBeenCalledTimes(3);
    expect(screen.getByText('Servidor indisponível')).toBeTruthy();
  });

  it('para o intervalo e remove o listener ao desmontar', async () => {
    const checkFn = jest.fn().mockResolvedValue('online');
    const { unmount } = render(
      <ConnectionProvider checkFn={checkFn}>
        <StatusProbe />
      </ConnectionProvider>
    );
    await flush();
    unmount();
    expect(removeMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(90000);
    });
    expect(checkFn).toHaveBeenCalledTimes(1);
  });

  it('é só informativo: erro inesperado na checagem vira "servidor indisponível" sem lançar', async () => {
    const checkFn = jest.fn().mockRejectedValue(new Error('boom'));
    render(
      <ConnectionProvider checkFn={checkFn}>
        <StatusProbe />
      </ConnectionProvider>
    );
    await flush();
    expect(screen.getByTestId('probe').props.children).toBe('server_unavailable');
  });
});
