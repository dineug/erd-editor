/** The clock and the random source a generator reads, which a spec replaces. */
export interface Uuidv7Options {
  /** Whole milliseconds since the Unix epoch, as Date.now() gives them. */
  now?: () => number;
  /** Fills the array with random 32-bit words and returns it. */
  random?: (words: Uint32Array<ArrayBuffer>) => Uint32Array;
}

/**
 * A new millisecond's counter: 41 random bits under a clear top bit, leaving
 * 2^41 increments before the 42 bits fill, more ids than a session mints.
 */
const seedCounter = (high: number, low: number) =>
  (high & 0x1ff) * 2 ** 32 + low;

/**
 * An RFC 9562 UUIDv7 generator: 48 bits of Unix milliseconds, a 42-bit counter
 * in the 12 bits after the version and the top 30 after the variant, then 32
 * random bits. Each UUID sorts after the one before, through a stalled clock too.
 */
export function createUuidv7({
  now = () => Date.now(),
  random = words => crypto.getRandomValues(words),
}: Uuidv7Options = {}): () => Uint8Array {
  let timestamp = -1;
  let counter = 0;

  return () => {
    const [high, low, tail] = random(new Uint32Array(3));
    const current = now();

    if (current > timestamp) {
      timestamp = current;
      counter = seedCounter(high, low);
    } else {
      counter++;
    }

    const bytes = new Uint8Array(16);
    const view = new DataView(bytes.buffer);

    view.setUint16(0, Math.floor(timestamp / 2 ** 32));
    view.setUint32(2, timestamp % 2 ** 32);
    view.setUint16(6, 0x7000 + Math.floor(counter / 2 ** 30));
    view.setUint32(8, 0x80000000 + (counter % 2 ** 30));
    view.setUint32(12, tail);

    return bytes;
  };
}

/**
 * The generator every caller of one copy of this module shares, so the UUIDs
 * it hands out stay in order.
 */
export const uuidv7 = createUuidv7();
