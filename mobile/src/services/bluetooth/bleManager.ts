// MOCK BLE SERVICE — Abstração para integração futura com hardware real da trava
export const bleManager = {
  async checkBluetoothState(): Promise<boolean> {
    return true; // Bluetooth ativo
  },

  async connectToLock(deviceId: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return true;
  },

  async unlockLock(): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return true; // Comando enviado com sucesso
  },

  async lockLock(): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return true; // Trava trancada
  },

  async getLockStatus(): Promise<'LOCKED' | 'UNLOCKED'> {
    return 'LOCKED';
  },
};