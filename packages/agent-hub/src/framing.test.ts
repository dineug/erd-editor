import { Effect, Exit, Schema, Stream } from 'effect';
import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import { runTest } from '@/__test-utils__/effect';
import {
  decodeFrames,
  encodeFrame,
  FrameError,
  MAX_FRAME_BYTES,
} from '@/framing';
import { HubToPeerMessage } from '@/protocol';

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

/** Every value the stream emitted before it ended, and how it ended. */
async function drain<A, E>(stream: Stream.Stream<A, E>) {
  const values: A[] = [];
  const exit = await runTest(
    Effect.exit(
      Stream.runForEach(stream, value => Effect.sync(() => values.push(value)))
    )
  );
  return { values, exit };
}

function frames(chunks: string[]) {
  return drain(Stream.fromIterable(chunks).pipe(decodeFrames(Schema.Unknown)));
}

async function failure(chunks: string[]) {
  const { values, exit } = await frames(chunks);
  if (Exit.isSuccess(exit))
    throw new Error('the stream ended without a failure');
  const error = Exit.findErrorOption(exit);
  return { values, error: error._tag === 'Some' ? error.value : undefined };
}

describe('decodeFrames', () => {
  it('decodes two frames delivered in one chunk', async () => {
    const { values, exit } = await frames([
      encodeFrame({ id: 1 }) + encodeFrame({ id: 2 }),
    ]);

    expect(values).toEqual([{ id: 1 }, { id: 2 }]);
    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it('joins a frame split across chunks and finishes one mid-chunk', async () => {
    const first = encodeFrame({ method: 'actions', params: { path: '/a' } });
    const second = encodeFrame({ n: 2 });

    const { values } = await frames([
      first.slice(0, 5),
      first.slice(5, 20),
      first.slice(20) + second.slice(0, 4),
      second.slice(4),
    ]);
    expect(values).toEqual([
      { method: 'actions', params: { path: '/a' } },
      { n: 2 },
    ]);
  });

  it('delivers a frame whose newline arrives alone', async () => {
    expect((await frames(['{"a":1}', '\n'])).values).toEqual([{ a: 1 }]);
  });

  it('skips blank and whitespace-only lines and tolerates a carriage return', async () => {
    const { values } = await frames([
      '\n\n  \n{"a":1}\r\n\t\n',
      '\n{"b":2}\n',
      '\n',
    ]);

    expect(values).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('drops an unterminated tail when the stream ends, as a half-sent frame', async () => {
    const { values, exit } = await frames(['{"a":1}\n{"b":']);

    expect(values).toEqual([{ a: 1 }]);
    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it('decodes any JSON value when the schema is Unknown', async () => {
    expect((await frames(['1\n"s"\nnull\n[2]\n'])).values).toEqual([
      1,
      's',
      null,
      [2],
    ]);
  });

  it('decodes each frame with the schema and types the stream by it', async () => {
    const stream = Stream.fromIterable([
      '{"method":"documentClosed","params":{"path":"/a"}}\n',
      '{"id":3,"ok":true,"method":"save","result":{"saved":true}}\n',
    ]).pipe(decodeFrames(HubToPeerMessage));

    expectTypeOf(stream).toEqualTypeOf<
      Stream.Stream<HubToPeerMessage, FrameError>
    >();
    expect((await drain(stream)).values).toEqual([
      { method: 'documentClosed', params: { path: '/a' } },
      { id: 3, ok: true, method: 'save', result: { saved: true } },
    ]);
  });

  it('fails on a line that is not JSON and reads nothing after it', async () => {
    const { values, error } = await failure(['{"a":1}\n', '{"a":\n{"b":2}\n']);

    expect(values).toEqual([{ a: 1 }]);
    expect(error).toBeInstanceOf(FrameError);
    expect(error).toMatchObject({ _tag: 'FrameError', reason: 'notJson' });
    expect(error?.message).toMatch(/^A frame is not JSON: SyntaxError/);
  });

  it('fails on a JSON value the schema refuses, naming the mismatch', async () => {
    const { values, exit } = await drain(
      Stream.fromIterable([
        '{"method":"documentClosed","params":{"path":"/a"}}\n',
        '{"method":"documentClosed","params":{}}\n',
      ]).pipe(decodeFrames(HubToPeerMessage))
    );
    const error = Exit.findErrorOption(exit);

    expect(values).toHaveLength(1);
    expect(error._tag === 'Some' && error.value).toMatchObject({
      reason: 'invalid',
    });
    expect(error._tag === 'Some' && error.value.message).toMatch(
      /^A frame does not match the message schema: Missing key\s+at \["params"\]\["path"\]$/
    );
  });

  it('passes a failure of the text stream through untouched', async () => {
    const upstream = new Error('socket reset');
    const { values, exit } = await drain(
      Stream.concat(
        Stream.fromIterable(['{"a":1}\n']),
        Stream.fail(upstream)
      ).pipe(decodeFrames(Schema.Unknown))
    );
    const error = Exit.findErrorOption(exit);

    expect(values).toEqual([{ a: 1 }]);
    expect(error._tag === 'Some' && error.value).toBe(upstream);
  });

  it('accepts a frame of exactly MAX_FRAME_BYTES', async () => {
    const exact = 'a'.repeat(MAX_FRAME_BYTES - 2);
    const { values } = await frames([encodeFrame(exact)]);

    expect(values).toHaveLength(1);
    expect(values[0] === exact).toBe(true);
  }, 30_000);

  it('fails once an unterminated frame passes MAX_FRAME_BYTES, before its newline', async () => {
    const half = 'a'.repeat(MAX_FRAME_BYTES / 2);
    const { error } = await failure([half, half, 'a']);

    expect(error).toMatchObject({
      reason: 'tooLarge',
      message: `A frame of ${MAX_FRAME_BYTES + 1} bytes exceeds the ${MAX_FRAME_BYTES} byte limit`,
    });
  }, 30_000);

  it('measures an unterminated frame in UTF-8 bytes, not string length', async () => {
    const threeByteChars = '가'.repeat(Math.floor(MAX_FRAME_BYTES / 3) + 1);
    const { values, error } = await failure([threeByteChars]);

    expect(threeByteChars.length).toBeLessThan(MAX_FRAME_BYTES);
    expect(values).toHaveLength(0);
    expect(error).toMatchObject({
      reason: 'tooLarge',
      message: `A frame of ${threeByteChars.length * 3} bytes exceeds the ${MAX_FRAME_BYTES} byte limit`,
    });
  }, 30_000);

  it('fails on a complete line longer than MAX_FRAME_BYTES', async () => {
    const { error } = await failure(['a'.repeat(MAX_FRAME_BYTES), 'a\n']);

    expect(error).toMatchObject({ reason: 'tooLarge' });
  }, 30_000);

  it('measures UTF-8 bytes of characters split between byte chunks', async () => {
    const chars = '가'.repeat(Math.floor((MAX_FRAME_BYTES - 4) / 3));
    const exact = `${'a'.repeat(MAX_FRAME_BYTES - 2 - chars.length * 3)}${chars}`;
    const decodeBytes = (value: string) => {
      const bytes = new TextEncoder().encode(`${JSON.stringify(value)}\n`);
      const split = bytes.indexOf(0xea) + 1;
      return drain(
        Stream.fromIterable([bytes.slice(0, split), bytes.slice(split)]).pipe(
          Stream.decodeText(),
          decodeFrames(Schema.String)
        )
      );
    };

    expect(JSON.stringify(exact).length).toBeLessThan(MAX_FRAME_BYTES / 2);
    const fits = await decodeBytes(exact);
    expect(fits.values).toHaveLength(1);
    expect(fits.values[0] === exact).toBe(true);

    const over = await decodeBytes(`a${exact}`);
    expect(over.values).toHaveLength(0);
    expect(Exit.findErrorOption(over.exit)).toMatchObject({
      value: { reason: 'tooLarge' },
    });
  }, 30_000);
});
