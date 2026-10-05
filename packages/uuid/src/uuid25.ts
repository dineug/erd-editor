import { uuidv7 } from './uuidv7';

/**
 * The Uuid25 form of a 16-byte UUID: its 128 bits as 25 lowercase base 36
 * digits, zero padded, so two of them compare as strings the way their bytes do.
 */
export function toUuid25(bytes: Uint8Array): string {
  if (bytes.length !== 16) {
    throw new RangeError(`A UUID is 16 bytes, not ${bytes.length}`);
  }

  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }

  return value.toString(36).padStart(25, '0');
}

/** A new id: a UUIDv7 written as Uuid25, so ids sort in the order they were made. */
export const uuid25 = (): string => toUuid25(uuidv7());
