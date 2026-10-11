import { getBleLock, unavailableBleLock, mockBleLock } from '../src/services/bluetooth/bleLock';

describe('bleLock', () => {
  const originalEnv = process.env.EXPO_PUBLIC_BLE_MOCK;
  const originalDev = (globalThis as any).__DEV__;

  afterEach(() => {
    process.env.EXPO_PUBLIC_BLE_MOCK = originalEnv;
    (globalThis as any).__DEV__ = originalDev;
  });

  it('returns unavailable in production even if EXPO_PUBLIC_BLE_MOCK is true', () => {
    (globalThis as any).__DEV__ = false;
    process.env.EXPO_PUBLIC_BLE_MOCK = 'true';

    const lock = getBleLock();
    expect(lock.isAvailable()).toBe(false);
    expect(lock).toBe(unavailableBleLock);
    return expect(lock.connect()).rejects.toThrow();
  });

  it('returns unavailable in DEV when EXPO_PUBLIC_BLE_MOCK is not true', () => {
    (globalThis as any).__DEV__ = true;
    process.env.EXPO_PUBLIC_BLE_MOCK = 'false';

    const lock = getBleLock();
    expect(lock.isAvailable()).toBe(false);
    expect(lock).toBe(unavailableBleLock);
  });

  it('returns mockBleLock only in DEV with EXPO_PUBLIC_BLE_MOCK true', async () => {
    (globalThis as any).__DEV__ = true;
    process.env.EXPO_PUBLIC_BLE_MOCK = 'true';

    const lock = getBleLock();
    expect(lock.isAvailable()).toBe(true);
    expect(lock).toBe(mockBleLock);

    await expect(lock.connect()).resolves.toBeUndefined();
    await expect(lock.disconnect()).resolves.toBeUndefined();
  });
});
