import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';

const PREFIX = '[erd-editor hub]';

/**
 * The hub reports to console.warn only: a failing hub must never stop an
 * editor from opening. Called where no fiber runs; inside an Effect,
 * Effect.logWarning reaches the same console through hubLogger.
 */
export function warnUnsafe(...details: unknown[]): void {
  console.warn(PREFIX, ...details);
}

const hubLogger = Logger.make<unknown, void>(({ message }) => {
  // Effect hands the logger the list of values its log call carried, always.
  warnUnsafe(...(message as unknown[]));
});

/** Replaces the default logger, which writes to stdout under its own format. */
export const layer: Layer.Layer<never> = Logger.layer([hubLogger]);
