type Callback = (...args: any[]) => any;

type CaughtErrorListener = (error: unknown) => void;

const caughtErrorListeners = new Set<CaughtErrorListener>();

export function safeCallback<F extends Callback>(
  callback?: F | void,
  ...args: Parameters<F>
) {
  try {
    return callback?.(...args);
  } catch (e) {
    console.error(e);
    for (const listener of [...caughtErrorListeners]) {
      try {
        listener(e);
      } catch (thrown) {
        console.error(thrown);
      }
    }
  }
}

/**
 * Hands listener each error that a hook, an effect, a nextTick callback or a
 * reducer threw and r-html logged rather than threw, until the function it
 * returns is called. A listener that throws is logged and the others still hear.
 *
 * @example
 * const off = onCaughtError(error => errors.push(error));
 */
export function onCaughtError(listener: CaughtErrorListener): () => void {
  const entry: CaughtErrorListener = error => listener(error);
  caughtErrorListeners.add(entry);
  return () => {
    caughtErrorListeners.delete(entry);
  };
}

const queueMicrotaskFallback = (callback: () => void) => {
  Promise.resolve().then(callback);
};

export const asap = queueMicrotask ?? queueMicrotaskFallback;
