import { getBaseUrl } from './apiClient';

/**
 * Estado de conectividade exibido ao motorista (somente informativo).
 * - online: a API respondeu ao endpoint de saúde.
 * - offline: a requisição nem chegou a sair do aparelho (falha de rede).
 * - server_unavailable: o aparelho tem rede, mas a API não respondeu a tempo
 *   ou respondeu com erro.
 */
export type ConnectionState = 'online' | 'offline' | 'server_unavailable';

/** Timeout curto: a checagem é leve e não deve prender recursos. */
export const HEALTH_TIMEOUT_MS = 5000;

/**
 * Consulta o endpoint de saúde que já existe na API (GET /api/health).
 * Não usa token, não altera sessão e não interfere em nenhum outro fluxo.
 */
export async function checkServerHealth(
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = HEALTH_TIMEOUT_MS
): Promise<ConnectionState> {
  let baseUrl: string;
  try {
    baseUrl = getBaseUrl();
  } catch {
    // Sem URL de API válida configurada: tratamos como servidor indisponível.
    return 'server_unavailable';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok ? 'online' : 'server_unavailable';
  } catch (error: any) {
    // Timeout: há rede, mas o servidor não respondeu a tempo.
    if (error?.name === 'AbortError') return 'server_unavailable';
    // Falha de rede antes de qualquer resposta (ex.: "Network request failed").
    return 'offline';
  } finally {
    clearTimeout(timeoutId);
  }
}
