import { describe, expect, it } from 'vite-plus/test';

import { toUuid25, uuid25 } from './uuid25';

/** The UUID behind an id, read back digit by digit. */
const toHex = (id: string) =>
  [...id]
    .reduce(
      (value, digit) => value * 36n + BigInt(Number.parseInt(digit, 36)),
      0n
    )
    .toString(16)
    .padStart(32, '0');

const bytesOf = (uuid: string) =>
  Uint8Array.from(uuid.replace(/-/g, '').match(/../g)!, pair =>
    Number.parseInt(pair, 16)
  );

describe('toUuid25', () => {
  it('encodes the examples the Uuid25 reference implementation gives', () => {
    expect(toUuid25(bytesOf('8da942a4-1fbe-4ca6-852c-95c473229c7d'))).toBe(
      '8dx554y5rzerz1syhqsvsdw8t'
    );
    expect(toUuid25(bytesOf('e7a1d63b-7117-4423-8988-afcf12161878'))).toBe(
      'dpoadk8izg9y4tte7vy1xt94o'
    );
  });

  it('pads the nil UUID to 25 digits and writes the max one in 25', () => {
    expect(toUuid25(new Uint8Array(16))).toBe('0000000000000000000000000');
    expect(toUuid25(new Uint8Array(16).fill(0xff))).toBe(
      'f5lxx1zz5pnorynqglhzmsp33'
    );
  });

  it('keeps the byte order as string order', () => {
    const uuids = [
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000024',
      '018bcfe5-6800-7000-8000-000000000000',
      '018bcfe5-6800-7000-8000-000000000001',
      'ffffffff-ffff-ffff-ffff-fffffffffffe',
    ];
    const encoded = uuids.map(uuid => toUuid25(bytesOf(uuid)));

    expect([...encoded].sort()).toEqual(encoded);
  });

  it('refuses anything but 16 bytes', () => {
    expect(() => toUuid25(new Uint8Array(15))).toThrow(RangeError);
    expect(() => toUuid25(new Uint8Array(17))).toThrow(
      'A UUID is 16 bytes, not 17'
    );
  });
});

describe('uuid25', () => {
  it('writes a UUIDv7 of this moment as 25 lowercase base 36 digits', () => {
    const before = Date.now();
    const id = uuid25();
    const after = Date.now();
    const hex = toHex(id);

    expect(id).toMatch(/^[0-9a-z]{25}$/);
    expect(Number.parseInt(hex.slice(0, 12), 16)).toBeGreaterThanOrEqual(
      before
    );
    expect(Number.parseInt(hex.slice(0, 12), 16)).toBeLessThanOrEqual(after);
    expect(hex[12]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(hex[16]);
  });

  it('hands out distinct ids that sort in the order they were made', () => {
    const ids = Array.from({ length: 1_000 }, () => uuid25());

    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });
});
