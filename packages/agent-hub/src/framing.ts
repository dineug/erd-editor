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

const encoder = new TextEncoder();

function byteLength(text: string): number {
  return encoder.encode(text).length;
}

function assertFrameSize(bytes: number): void {
  if (bytes > MAX_FRAME_BYTES) {
    throw new RangeError(
      `A frame of ${bytes} bytes exceeds the ${MAX_FRAME_BYTES} byte limit`
    );
  }
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
