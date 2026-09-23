import * as Cause from 'effect/Cause';
import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';

const PREFIX = '[erd-editor-mcp]';

/**
 * Diagnostics go to stderr only: stdout is the MCP channel, and one stray line
 * breaks the client. Called where no fiber runs; inside an Effect, a log call
 * reaches the same console through stderrLogger.
 */
export function logUnsafe(...details: unknown[]): void {
  console.error(PREFIX, ...details);
}

const stderrLogger = Logger.make<unknown, void>(({ message, cause }) => {
  // Effect hands the logger the list of values its log call carried, always.
  const details = [...(message as unknown[])];
  if (cause.reasons.length > 0) details.push(Cause.pretty(cause));
  logUnsafe(...details);
});

/** Replaces the default logger, which writes to stdout and would corrupt the JSON-RPC stream. */
export const StderrLogger: Layer.Layer<never> = Logger.layer([stderrLogger]);
