export interface OfflineUnlockToken {
  truck_id: number;
  session_id: number;
  exp: number;
  mac: string;
}

export interface LocalLockStatus {
  truck_id?: number;
  estado: 'TRAVADO' | 'DESTRAVADO' | 'ABERTO' | string;
  pulso?: boolean;
  gps_fix?: boolean;
  sd?: boolean;
  lora?: boolean;
  lat?: string;
  lon?: string;
}

export interface LocalLockUnlockResult {
  ok: boolean;
  msg?: string;
}

export const DEFAULT_LOCAL_LOCK_URL = 'http://192.168.4.1';
const LOCAL_LOCK_TIMEOUT_MS = 4000;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = LOCAL_LOCK_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Tempo esgotado ao comunicar com a trava local (conecte-se ao Wi-Fi TRAVA-EHR-01).');
    }
    throw new Error('Sem conexão com o Wi-Fi da trava (192.168.4.1).');
  } finally {
    clearTimeout(timer);
  }
}

export const localLockClient = {
  /**
   * Consulta o estado físico da trava via AP Wi-Fi local (GET /status).
   * Compatível tanto com o firmware R4 v2.1 quanto com o firmware de bancada v2.0.
   */
  async getStatus(baseUrl: string = DEFAULT_LOCAL_LOCK_URL): Promise<LocalLockStatus> {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const res = await fetchWithTimeout(`${cleanBase}/status`, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`Trava local respondeu HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data || typeof data.estado !== 'string') {
      throw new Error('Resposta inválida da trava local.');
    }
    return data as LocalLockStatus;
  },

  /**
   * Destrava o bocal na revisão R4 (TravaEHR_R4.ino) enviando o token HMAC-SHA256
   * com proteção anti-replay (POST /unlock com session, exp e mac).
   */
  async unlockWithToken(
    token: OfflineUnlockToken,
    baseUrl: string = DEFAULT_LOCAL_LOCK_URL
  ): Promise<LocalLockUnlockResult> {
    if (!token || !Number.isInteger(token.session_id) || token.session_id <= 0) {
      throw new Error('Token de desbloqueio inválido (session_id).');
    }
    if (!Number.isInteger(token.exp) || token.exp <= 0) {
      throw new Error('Token de desbloqueio inválido (exp).');
    }
    if (typeof token.mac !== 'string' || !/^[0-9a-fA-F]{64}$/.test(token.mac)) {
      throw new Error('Token de desbloqueio inválido (mac).');
    }

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const body = `session=${encodeURIComponent(String(token.session_id))}&exp=${encodeURIComponent(String(token.exp))}&mac=${encodeURIComponent(token.mac)}`;

    const res = await fetchWithTimeout(`${cleanBase}/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      // ignore parse errors
    }

    if (!res.ok || data?.ok === false) {
      throw new Error(data?.msg || `Trava recusou o desbloqueio (HTTP ${res.status}).`);
    }

    return { ok: true, msg: data?.msg };
  },

  /**
   * Compatibilidade com o firmware de bancada v2.0 (POST /destravar?pin=...).
   */
  async unlockLegacyPin(
    pin: string,
    baseUrl: string = DEFAULT_LOCAL_LOCK_URL
  ): Promise<LocalLockUnlockResult> {
    const trimmed = typeof pin === 'string' ? pin.trim() : '';
    if (!trimmed) {
      throw new Error('PIN é obrigatório.');
    }
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const res = await fetchWithTimeout(
      `${cleanBase}/destravar?pin=${encodeURIComponent(trimmed)}`,
      { method: 'POST' }
    );

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      // ignore
    }

    if (!res.ok || data?.ok === false) {
      throw new Error(data?.msg || 'PIN incorreto ou recusado pela trava.');
    }
    return { ok: true, msg: data?.msg || 'Destravado' };
  },
};
