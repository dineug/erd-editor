import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';

/**
 * The largest frame either side accepts, in UTF-8 bytes without the newline.
 * A join result carries a whole document as one JSON string, hence the room;
 * the bound caps what an unauthenticated peer can make a reader buffer.
 */
export const MAX_FRAME_BYTES = 64 * 1024 * 1024;

export type FrameDecoder = {
  /** Every complete frame the chunk finishes, parsed, in order. */
  push: (chunk: string) => unknown[];
  /** UTF-8 bytes of the incomplete frame held for the next chunk. */
  readonly pending: number;
};

/**
 * Why decodeFrames gave up on a stream: a frame over MAX_FRAME_BYTES, a line
 * that is not JSON, or a JSON value the message schema refuses.
 */
export class FrameError extends Schema.TaggedError<FrameError>()('FrameError', {
  reason: Schema.Literals(['tooLarge', 'notJson', 'invalid']),
  message: Schema.String,
}) {}

const encoder = new TextEncoder();

function byteLength(text: string): number {
  return encoder.encode(text).length;
}

function sizeProblem(bytes: number): string | null {
  return bytes > MAX_FRAME_BYTES
    ? `A frame of ${bytes} bytes exceeds the ${MAX_FRAME_BYTES} byte limit`
    : null;
}

function assertFrameSize(bytes: number): void {
  const problem = sizeProblem(bytes);
  if (problem) throw new RangeError(problem);
}

/** One JSON value on one line. JSON.stringify escapes newlines, so the frame has exactly one. */
export function encodeFrame(message: unknown): string {
  const json = JSON.stringify(message);
  if (json === undefined) {
    throw new TypeError('A frame must hold a JSON value');
  }
  assertFrameSize(byteLength(json));
  return `${json}\n`;
}

/**
 * Splits a text stream into JSON lines, skipping blank ones. It throws on a
 * line that is not JSON or on a frame over MAX_FRAME_BYTES; the stream is then
 * out of step, so the caller drops the decoder and closes the connection.
 */
export function createFrameDecoder(): FrameDecoder {
  let buffer = '';
  let bufferBytes = 0;

  return {
    push(chunk) {
      const messages: unknown[] = [];
      let start = 0;
      let end = chunk.indexOf('\n');

      while (end !== -1) {
        const tail = chunk.slice(start, end);
        const line = buffer + tail;
        const lineBytes = bufferBytes + byteLength(tail);
        buffer = '';
        bufferBytes = 0;
        start = end + 1;
        end = chunk.indexOf('\n', start);

        assertFrameSize(lineBytes);
        if (line.trim() !== '') messages.push(JSON.parse(line));
      }

      const rest = chunk.slice(start);
      buffer += rest;
      bufferBytes += byteLength(rest);
      assertFrameSize(bufferBytes);

      return messages;
    },
    get pending() {
      return bufferBytes;
    },
  };
}

/** The unterminated tail of the text read so far and its UTF-8 bytes. */
type Unterminated = { readonly text: string; readonly bytes: number };

const tooLarge = (problem: string) =>
  new FrameError({ reason: 'tooLarge', message: problem });

/** The lines a chunk completes; the size check runs before a line is buffered. */
function splitChunk(
  tail: Unterminated,
  chunk: string
): Effect.Effect<readonly [Unterminated, string[]], FrameError> {
  const lines: string[] = [];
  let { text, bytes } = tail;
  let start = 0;
  let end = chunk.indexOf('\n');

  while (end !== -1) {
    const segment = chunk.slice(start, end);
    const problem = sizeProblem(bytes + byteLength(segment));
    if (problem) return Effect.fail(tooLarge(problem));

    lines.push(text + segment);
    text = '';
    bytes = 0;
    start = end + 1;
    end = chunk.indexOf('\n', start);
  }

  const rest = chunk.slice(start);
  const restBytes = bytes + byteLength(rest);
  const problem = sizeProblem(restBytes);
  if (problem) return Effect.fail(tooLarge(problem));
  return Effect.succeed([{ text: text + rest, bytes: restBytes }, lines]);
}

const parseLine = (line: string) =>
  Effect.try({
    try: (): unknown => JSON.parse(line),
    catch: error =>
      new FrameError({
        reason: 'notJson',
        message: `A frame is not JSON: ${String(error)}`,
      }),
  });

/**
 * Turns a text stream into its messages: one JSON value per newline-ended line,
 * blank lines skipped, an unterminated tail dropped at the end, each value
 * decoded by schema. The first bad frame fails the stream with a FrameError.
 */
export function decodeFrames<S extends Schema.Constraint>(schema: S) {
  const decode = Schema.decodeUnknownEffect(schema);
  const decodeLine = (line: string) =>
    Effect.flatMap(parseLine(line), value =>
      Effect.mapError(
        decode(value),
        error =>
          new FrameError({
            reason: 'invalid',
            message: `A frame does not match the message schema: ${error.message}`,
          })
      )
    );

  return <E, R>(
    text: Stream.Stream<string, E, R>
  ): Stream.Stream<S['Type'], E | FrameError, R | S['DecodingServices']> =>
    text.pipe(
      Stream.mapAccumEffect(
        (): Unterminated => ({ text: '', bytes: 0 }),
        splitChunk
      ),
      Stream.filter(line => line.trim() !== ''),
      Stream.mapEffect(decodeLine)
    );
}
