export const delay = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

export function closePromise(): [Promise<void>, () => void] {
  let callback = () => {};
  return [
    new Promise<void>(resolve => {
      callback = resolve;
    }),
    () => callback(),
  ];
}

/**
 * Rejects a promise that has not settled in time. A shared worker that throws
 * while evaluating leaves its port open and its first call pending for ever,
 * which is a wait only a clock ends.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
