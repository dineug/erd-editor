type Callback = (...args: any[]) => any;

/** Calls an optional callback and keeps its exception on the console rather than in the caller. */
export function safeCallback<F extends Callback>(
  callback?: F | void,
  ...args: Parameters<F>
) {
  try {
    return callback?.(...args);
  } catch (e) {
    console.error(e);
  }
}
