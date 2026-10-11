export interface BleLock {
  isAvailable(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export const unavailableBleLock: BleLock = {
  isAvailable(): boolean {
    return false;
  },
  async connect(): Promise<void> {
    throw new Error('Bluetooth indisponível nesta versão. Peça liberação ao gestor.');
  },
  async disconnect(): Promise<void> {
    // No-op
  },
};

export const mockBleLock: BleLock = {
  isAvailable(): boolean {
    return true;
  },
  async connect(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  },
  async disconnect(): Promise<void> {
    // No-op
  },
};

export function getBleLock(): BleLock {
  if (__DEV__ && process.env.EXPO_PUBLIC_BLE_MOCK === 'true') {
    return mockBleLock;
  }
  return unavailableBleLock;
}
