export function fnv1a32(text: string): number {
  let h = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    // imul, not *: the prime overflows the float mantissa within a few rounds.
    h = Math.imul(h, 0x01000193);
  }

  return h >>> 0;
}

const IDENTIFIER_LENGTH = 7;

export function toIdentifier(text: string): string {
  // base36 of a u32 is up to 7 digits, and consumers prefix-match without a separator, so an
  // unpadded id could be a proper prefix of a longer one and collect its rules.
  return `_${fnv1a32(text).toString(36).padStart(IDENTIFIER_LENGTH, '0')}`;
}
