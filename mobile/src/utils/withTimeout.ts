export class TimeoutError extends Error {
  constructor(message: string = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new TimeoutError(errorMessage));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
  });
}
