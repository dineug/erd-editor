import * as Sentry from '@sentry/react';
import { useMemo } from 'react';

/**
 * Logs a failure nothing up the stack can act on and hands it to Sentry, which
 * sends it only where main.tsx initialised it, in production.
 */
export function reportError(error: unknown) {
  console.error(error);
  Sentry.captureException(error);
}

/**
 * The action, settling with undefined where it would have rejected, and the
 * error reported. Components fire these without waiting, so a rejection would
 * go unhandled, shown to nobody.
 */
export function settleReported<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>
) {
  return async (...args: Args): Promise<Result | undefined> => {
    try {
      return await action(...args);
    } catch (error) {
      reportError(error);
      return undefined;
    }
  };
}

/** settleReported for a hook's action, as stable as the action it wraps. */
export function useSettleReported<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>
) {
  return useMemo(() => settleReported(action), [action]);
}
