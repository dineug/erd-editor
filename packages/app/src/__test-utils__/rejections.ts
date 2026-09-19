/**
 * Runs a scenario and returns every rejection nobody handled in it. Node only
 * reports one once the microtasks drain, so the count waits a macrotask more.
 */
export async function collectUnhandledRejections(
  run: () => Promise<unknown>
): Promise<unknown[]> {
  const reasons: unknown[] = [];
  const listener = (reason: unknown) => {
    reasons.push(reason);
  };

  process.on('unhandledRejection', listener);
  try {
    await run();
    await new Promise(resolve => setTimeout(resolve, 0));
  } finally {
    process.off('unhandledRejection', listener);
  }

  return reasons;
}
