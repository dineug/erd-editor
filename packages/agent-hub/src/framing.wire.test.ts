import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { describe, expect, it } from 'vite-plus/test';

import { runTest } from '@/__test-utils__/effect';
import { decodeFrames, encodeFrame } from '@/framing';

// The fake peer of the Extension Host e2e writes frames by hand with node
// builtins only, so these byte sequences are the contract it is held to.
const utf8 = (text: string) => Array.from(new TextEncoder().encode(text));

/** Every message decodeFrames reads from the text chunks, in order. */
const decode = (chunks: string[]) =>
  runTest(
    Stream.runCollect(
      Stream.fromIterable(chunks).pipe(decodeFrames(Schema.Unknown))
    )
  );

describe('wire format', () => {
  it('encodes {a:1} as exactly the UTF-8 bytes of {"a":1} and a newline', () => {
    expect(utf8(encodeFrame({ a: 1 }))).toEqual([
      0x7b, 0x22, 0x61, 0x22, 0x3a, 0x31, 0x7d, 0x0a,
    ]);
  });

  it('writes compact JSON with no padding around separators', () => {
    expect(encodeFrame({ id: 1, method: 'hello', params: { a: [1, 2] } })).toBe(
      '{"id":1,"method":"hello","params":{"a":[1,2]}}\n'
    );
  });

  it('writes non-ASCII text as raw UTF-8, not as escapes', () => {
    expect(utf8(encodeFrame('가'))).toEqual([
      0x22, 0xea, 0xb0, 0x80, 0x22, 0x0a,
    ]);
  });

  it('decodes a hand-written frame byte for byte', async () => {
    const bytes = new Uint8Array([
      0x7b, 0x22, 0x61, 0x22, 0x3a, 0x31, 0x7d, 0x0a,
    ]);
    const text = new TextDecoder().decode(bytes);

    expect(await decode([text])).toEqual([{ a: 1 }]);
  });

  it('decodes a multi-byte character split between two byte chunks', async () => {
    const bytes = new TextEncoder().encode(encodeFrame({ name: '가' }));
    const split = bytes.indexOf(0xea) + 1;
    const stream = new TextDecoder();

    const first = stream.decode(bytes.slice(0, split), { stream: true });
    const second = stream.decode(bytes.slice(split), { stream: true });

    expect(await decode([first])).toEqual([]);
    expect(await decode([first, second])).toEqual([{ name: '가' }]);
  });
});
