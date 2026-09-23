import { Effect, Result, Schema, Stream } from 'effect';

import {
  HubNotification,
  HubToPeerMessage,
  PeerToHubMessage,
} from '@/protocol';

/**
 * The largest frame either side accepts, in UTF-8 bytes without the newline.
 * A join result carries a whole document as one JSON string, hence the room;
 * the bound caps what an unauthenticated peer can make a reader buffer.
 */
export const MAX_FRAME_BYTES = 64 * 1024 * 1024;

/**
 * Why a frame decoder gave up on a stream: a frame over MAX_FRAME_BYTES, a line
 * that is not JSON, or, in decodeFrames only, a value the schema refuses.
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

/** One JSON value on one line. JSON.stringify escapes newlines, so the frame has exactly one. */
export function encodeFrame(message: unknown): string {
  const json = JSON.stringify(message);
  if (json === undefined) {
    throw new TypeError('A frame must hold a JSON value');
  }
  const problem = sizeProblem(byteLength(json));
  if (problem) throw new RangeError(problem);
  return `${json}\n`;
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
 * A JSON value the message schema refused, as parsed, so a reader can still
 * answer it by what it can read of it or skip it; issue is the schema's reason.
 */
export type RefusedFrame = { readonly value: unknown; readonly issue: string };

/**
 * Turns a text stream into one Result per frame: one JSON value per newline-ended
 * line, blank lines skipped, an unterminated tail dropped at the end, each value
 * decoded by schema or refused. A line that is not JSON or too large fails it.
 */
export function decodeFrameResults<S extends Schema.Constraint>(schema: S) {
  const decode = Schema.decodeUnknownEffect(schema);
  const decodeLine = (line: string) =>
    Effect.flatMap(parseLine(line), value =>
      decode(value).pipe(
        Effect.result,
        Effect.map(
          Result.mapError((error): RefusedFrame => ({
            value,
            issue: error.message,
          }))
        )
      )
    );

  return <E, R>(
    text: Stream.Stream<string, E, R>
  ): Stream.Stream<
    Result.Result<S['Type'], RefusedFrame>,
    E | FrameError,
    R | S['DecodingServices']
  > =>
    text.pipe(
      Stream.mapAccumEffect(
        (): Unterminated => ({ text: '', bytes: 0 }),
        splitChunk
      ),
      Stream.filter(line => line.trim() !== ''),
      Stream.mapEffect(decodeLine)
    );
}

/**
 * Turns a text stream into its messages as decodeFrameResults reads them, but
 * the first frame the schema refuses fails the stream too, with a FrameError.
 */
export function decodeFrames<S extends Schema.Constraint>(schema: S) {
  const results = decodeFrameResults(schema);
  const orFail = (
    result: Result.Result<S['Type'], RefusedFrame>
  ): Effect.Effect<S['Type'], FrameError> =>
    Result.isSuccess(result)
      ? Effect.succeed(result.success)
      : Effect.fail(
          new FrameError({
            reason: 'invalid',
            message: `A frame does not match the message schema: ${result.failure.issue}`,
          })
        );

  return <E, R>(
    text: Stream.Stream<string, E, R>
  ): Stream.Stream<S['Type'], E | FrameError, R | S['DecodingServices']> =>
    results(text).pipe(Stream.mapEffect(orFail));
}

/** What a hub reads from a peer: each frame a request, or refused. */
export const decodePeerToHubFrames = decodeFrameResults(PeerToHubMessage);

/** What a peer reads from its hub: each frame a response or a notification, or refused. */
export const decodeHubToPeerFrames = decodeFrameResults(HubToPeerMessage);

const encodeRequest = Schema.encodeSync(PeerToHubMessage);

/**
 * A request's frame: encoded by PeerToHubMessage, so its fields come in schema
 * order and unknown ones are dropped, then framed; throws what either throws.
 */
export function encodePeerToHubFrame(request: PeerToHubMessage): string {
  return encodeFrame(encodeRequest(request));
}

const encodeNotification = Schema.encodeSync(HubNotification);

/**
 * A notification's frame: encoded by HubNotification, so its fields come in
 * schema order and unknown ones are dropped, then framed; throws what either throws.
 */
export function encodeHubNotificationFrame(
  notification: HubNotification
): string {
  return encodeFrame(encodeNotification(notification));
}
