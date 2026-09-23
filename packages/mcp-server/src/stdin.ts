import { Effect, Layer, Stdio, Stream } from 'effect';

/** The method namespace effect's RPC layer keeps for itself; its Eof stops every answer. */
const RPC_CONTROL = '@effect/rpc/';

/** Effect's own headers field as its decoder reads it: pairs or a record, and it throws on the rest. */
function hasReadableHeaders(value: object): boolean {
  const { headers } = value as { headers?: unknown };
  if (headers === undefined || headers === null) return true;
  if (!Array.isArray(headers)) return typeof headers === 'object';
  return headers.every(
    entry => Array.isArray(entry) && typeof entry[0] === 'string'
  );
}

/** An object with headers effect reads, whose method, if any, is a string outside effect's namespace. */
function isMessage(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  if (!hasReadableHeaders(value)) return false;
  if (!Object.hasOwn(value, 'method')) return true;
  const { method } = value as { method: unknown };
  return typeof method === 'string' && !method.startsWith(RPC_CONTROL);
}

/**
 * Whether a stdin line is a JSON-RPC message, or a batch of them, that effect's
 * decoder takes without throwing. A throw there loses the rest of the chunk,
 * and a line it cannot parse stays in its buffer, blocking every later one.
 */
export function isMessageLine(line: string): boolean {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return false;
  }
  return Array.isArray(value) ? value.every(isMessage) : isMessage(value);
}

/** The lines a chunk of text ends, the first led by what the last chunk left unended. */
function splitLines(pending: string, text: string): [string, string[]] {
  const lines = text.split('\n');
  lines[0] = pending + lines[0];
  const rest = lines.pop() as string;
  return [rest, lines];
}

const keep = (line: string) =>
  isMessageLine(line)
    ? Effect.succeed(true)
    : Effect.as(
        line.trim() === ''
          ? Effect.void
          : Effect.logWarning(
              'skipped a stdin line that is not a JSON-RPC message',
              line.slice(0, 80)
            ),
        false
      );

/**
 * Stdio whose stdin passes on only the lines isMessageLine accepts, each with
 * its newline, and skips the rest; a skipped line other than a blank one is
 * logged. A line stdin never ends is never passed on.
 */
export const MessageStdin: Layer.Layer<Stdio.Stdio, never, Stdio.Stdio> =
  Layer.effect(
    Stdio.Stdio,
    Effect.gen(function* () {
      const stdio = yield* Stdio.Stdio;
      return Stdio.make({
        ...stdio,
        stdin: stdio.stdin.pipe(
          Stream.decodeText(),
          Stream.mapAccum(() => '', splitLines),
          Stream.filterEffect(keep),
          Stream.map(line => `${line}\n`),
          Stream.encodeText
        ),
      });
    })
  );
