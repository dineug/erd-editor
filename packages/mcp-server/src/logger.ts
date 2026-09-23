import { Cause, Layer, Logger } from 'effect';

const PREFIX = '[erd-editor-mcp]';

/**
 * Diagnostics go to stderr only: stdout is the MCP channel, and one stray line
 * breaks the client. Effect hands the logger the values its log call carried.
 */
const stderrLogger = Logger.make<unknown, void>(({ message, cause }) => {
  const details = [...(message as unknown[])];
  if (cause.reasons.length > 0) details.push(Cause.pretty(cause));
  console.error(PREFIX, ...details);
});

/** Replaces the default logger, which writes to stdout and would corrupt the JSON-RPC stream. */
export const StderrLogger: Layer.Layer<never> = Logger.layer([stderrLogger]);
