import React, { createContext, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { checkServerHealth, ConnectionState } from '../services/api/healthCheck';

/** Intervalo entre checagens automáticas do endpoint de saúde. */
export const CONNECTION_CHECK_INTERVAL_MS = 30000;

interface ConnectionContextData {
  status: ConnectionState;
  /** Dispara uma checagem imediata (informativa, não bloqueia nada). */
  refresh: () => Promise<void>;
}

// Padrão "online": sem Provider a faixa simplesmente não aparece.
export const ConnectionContext = createContext<ConnectionContextData>({
  status: 'online',
  refresh: async () => {},
});

interface ConnectionProviderProps {
  children: ReactNode;
  intervalMs?: number;
  checkFn?: () => Promise<ConnectionState>;
}

/**
 * Indicador de conexão SOMENTE informativo.
 * Não bloqueia, não altera e não enfileira nenhum fluxo (login, sessão,
 * verify-face, abastecimento): apenas expõe o último estado observado.
 */
export const ConnectionProvider: React.FC<ConnectionProviderProps> = ({
  children,
  intervalMs = CONNECTION_CHECK_INTERVAL_MS,
  checkFn = checkServerHealth,
}) => {
  const [status, setStatus] = useState<ConnectionState>('online');
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const next = await checkFn();
      if (mountedRef.current) setStatus(next);
    } catch {
      if (mountedRef.current) setStatus('server_unavailable');
    } finally {
      inFlightRef.current = false;
    }
  }, [checkFn]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    const intervalId = setInterval(refresh, intervalMs);

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') refresh();
    });

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
      subscription?.remove?.();
    };
  }, [refresh, intervalMs]);

  return (
    <ConnectionContext.Provider value={{ status, refresh }}>
      {children}
    </ConnectionContext.Provider>
  );
};
