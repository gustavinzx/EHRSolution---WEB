import { withTimeout, TimeoutError } from '../src/utils/withTimeout';

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves normal when promise settles before timeout', async () => {
    const promise = Promise.resolve('success_val');
    const result = await withTimeout(promise, 5000);
    expect(result).toBe('success_val');
  });

  it('rejects with TimeoutError and custom message when timeout expires', async () => {
    const pendingPromise = new Promise((resolve) => {
      // never resolves
    });

    const timeoutPromise = withTimeout(pendingPromise, 3000, 'Custom timeout msg');
    jest.advanceTimersByTime(3000);

    await expect(timeoutPromise).rejects.toThrow(TimeoutError);
    await expect(timeoutPromise).rejects.toThrow('Custom timeout msg');
  });

  it('cleans up timer when promise resolves early', async () => {
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
    const promise = Promise.resolve('ok');

    await withTimeout(promise, 10000);

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('cleans up timer when promise rejects early', async () => {
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
    const promise = Promise.reject(new Error('fail'));

    await expect(withTimeout(promise, 10000)).rejects.toThrow('fail');

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
