import { describe, expect, it } from 'vite-plus/test';

import { createFrameDecoder, encodeFrame, MAX_FRAME_BYTES } from '@/framing';

describe('encodeFrame', () => {
  it('keeps a value with newlines inside on a single line', () => {
    const frame = encodeFrame({ text: 'a\nb\r\nc' });

    expect(frame.indexOf('\n')).toBe(frame.length - 1);
    expect(JSON.parse(frame)).toEqual({ text: 'a\nb\r\nc' });
  });

  it.each([undefined, () => 1, Symbol('x')])(
    'refuses %s, which has no JSON form',
    value => {
      expect(() => encodeFrame(value)).toThrow(TypeError);
    }
  );

  it('refuses a message larger than MAX_FRAME_BYTES', () => {
    const oversize = 'a'.repeat(MAX_FRAME_BYTES);
    expect(() => encodeFrame(oversize)).toThrow(RangeError);
  });

  it('accepts a message of exactly MAX_FRAME_BYTES', () => {
    const exact = 'a'.repeat(MAX_FRAME_BYTES - 2);
    expect(encodeFrame(exact)).toHaveLength(MAX_FRAME_BYTES + 1);
  });
});

describe('createFrameDecoder', () => {
  it('decodes two frames delivered in one chunk', () => {
    const decoder = createFrameDecoder();
    const chunk = encodeFrame({ id: 1 }) + encodeFrame({ id: 2 });

    expect(decoder.push(chunk)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(decoder.pending).toBe(0);
  });

  it('joins a frame split across chunks', () => {
    const decoder = createFrameDecoder();
    const frame = encodeFrame({ method: 'actions', params: { path: '/a' } });

    expect(decoder.push(frame.slice(0, 5))).toEqual([]);
    expect(decoder.pending).toBe(5);
    expect(decoder.push(frame.slice(5, 20))).toEqual([]);
    expect(decoder.push(frame.slice(20))).toEqual([
      { method: 'actions', params: { path: '/a' } },
    ]);
    expect(decoder.pending).toBe(0);
  });

  it('finishes one frame and starts the next inside a single chunk', () => {
    const decoder = createFrameDecoder();
    const first = encodeFrame({ n: 1 });
    const second = encodeFrame({ n: 2 });

    expect(decoder.push(first.slice(0, 3))).toEqual([]);
    expect(decoder.push(first.slice(3) + second.slice(0, 4))).toEqual([
      { n: 1 },
    ]);
    expect(decoder.pending).toBe(4);
    expect(decoder.push(second.slice(4))).toEqual([{ n: 2 }]);
  });

  it('delivers a frame whose newline arrives alone', () => {
    const decoder = createFrameDecoder();

    expect(decoder.push('{"a":1}')).toEqual([]);
    expect(decoder.push('\n')).toEqual([{ a: 1 }]);
  });

  it('ignores blank and whitespace-only lines', () => {
    const decoder = createFrameDecoder();

    expect(decoder.push('\n\n  \n{"a":1}\n\t\n\n{"b":2}\n')).toEqual([
      { a: 1 },
      { b: 2 },
    ]);
    expect(decoder.push('\n')).toEqual([]);
  });

  it('tolerates a carriage return before the newline', () => {
    expect(createFrameDecoder().push('{"a":1}\r\n')).toEqual([{ a: 1 }]);
  });

  it('decodes any JSON value, not only objects', () => {
    expect(createFrameDecoder().push('1\n"s"\nnull\n[2]\n')).toEqual([
      1,
      's',
      null,
      [2],
    ]);
  });

  it('counts pending bytes as UTF-8', () => {
    const decoder = createFrameDecoder();

    decoder.push('{"name":"가');
    expect(decoder.pending).toBe(12);
  });

  it('throws on a line that is not JSON', () => {
    expect(() => createFrameDecoder().push('{"a":\n')).toThrow(SyntaxError);
  });

  it('throws once an unterminated frame passes MAX_FRAME_BYTES', () => {
    const decoder = createFrameDecoder();
    const half = 'a'.repeat(MAX_FRAME_BYTES / 2);

    expect(decoder.push(half)).toEqual([]);
    expect(decoder.push(half)).toEqual([]);
    expect(() => decoder.push('a')).toThrow(RangeError);
  });

  it('throws on a complete line longer than MAX_FRAME_BYTES', () => {
    const decoder = createFrameDecoder();

    decoder.push('a'.repeat(MAX_FRAME_BYTES));
    expect(() => decoder.push('a\n')).toThrow(RangeError);
  });

  it('measures the limit in UTF-8 bytes, not string length', () => {
    const decoder = createFrameDecoder();
    const threeByteChars = '가'.repeat(Math.floor(MAX_FRAME_BYTES / 3) + 1);

    expect(threeByteChars.length).toBeLessThan(MAX_FRAME_BYTES);
    expect(() => decoder.push(threeByteChars)).toThrow(RangeError);
  });

  it('decodes what encodeFrame produced, byte limit included', () => {
    const decoder = createFrameDecoder();
    const exact = encodeFrame('a'.repeat(MAX_FRAME_BYTES - 2));

    expect(decoder.push(exact)).toEqual(['a'.repeat(MAX_FRAME_BYTES - 2)]);
  });
});
