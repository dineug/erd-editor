import { Effect, Exit, Result, Schema, Stream } from 'effect';
import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import { runTest } from '@/__test-utils__/effect';
import {
  decodeFrameResults,
  decodeFrames,
  decodeHubToPeerFrames,
  decodePeerToHubFrames,
  encodeFrame,
  encodeHubNotificationFrame,
  encodePeerToHubFrame,
  FrameError,
  MAX_FRAME_BYTES,
  type RefusedFrame,
} from '@/framing';
import {
  HubNotification,
  HubToPeerMessage,
  PeerToHubMessage,
} from '@/protocol';

// The byte, chunk and blank-line vectors are in __fixtures__/conformance.json;
// what stays here needs a 64 MiB frame, a schema or a value JSON cannot hold, or is
// JavaScript's own, as the SyntaxError a notJson message names.
describe('encodeFrame', () => {
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

  it('names the SyntaxError of a line that is not JSON', async () => {
    const { error } = await failure(['{"a":\n']);

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

/** A frame's JSON text and its newline. */
const line = (value: unknown) => `${JSON.stringify(value)}\n`;

describe('decodeFrameResults', () => {
  it('hands a value the schema refuses on as a Failure and keeps reading', async () => {
    const { values, exit } = await drain(
      Stream.fromIterable([
        line({ method: 'documentClosed', params: { path: '/a' } }) +
          line({ method: 'documentClosed', params: {} }),
        line({ id: 3, ok: true, method: 'save', result: { saved: true } }),
      ]).pipe(decodeFrameResults(HubToPeerMessage))
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(values).toEqual([
      Result.succeed({ method: 'documentClosed', params: { path: '/a' } }),
      Result.fail({
        value: { method: 'documentClosed', params: {} },
        issue: expect.stringMatching(
          /^Missing key\s+at \["params"\]\["path"\]$/
        ),
      }),
      Result.succeed({
        id: 3,
        ok: true,
        method: 'save',
        result: { saved: true },
      }),
    ]);
  });

  it('types each Result by the schema, a refusal as a RefusedFrame', () => {
    const stream = Stream.fromIterable(['1\n']).pipe(
      decodeFrameResults(Schema.String)
    );

    expectTypeOf(stream).toEqualTypeOf<
      Stream.Stream<Result.Result<string, RefusedFrame>, FrameError>
    >();
  });

  it('still fails the stream on a frame over MAX_FRAME_BYTES', async () => {
    const { values, exit } = await drain(
      Stream.fromIterable(['a'.repeat(MAX_FRAME_BYTES), 'a\n']).pipe(
        decodeFrameResults(Schema.Unknown)
      )
    );

    expect(values).toEqual([]);
    expect(Exit.findErrorOption(exit)).toMatchObject({
      value: { reason: 'tooLarge' },
    });
  }, 30_000);
});

describe('decodePeerToHubFrames', () => {
  it('decodes the requests a peer sends', async () => {
    const { values } = await drain(
      Stream.fromIterable([
        line({
          id: 1,
          method: 'hello',
          params: { token: 't', protocolVersion: 1, client: 'c' },
        }),
        line({ id: 2, method: 'join', params: { path: '/a', extra: true } }),
      ]).pipe(decodePeerToHubFrames)
    );

    expect(values).toEqual([
      Result.succeed({
        id: 1,
        method: 'hello',
        params: { token: 't', protocolVersion: 1, client: 'c' },
      }),
      Result.succeed({ id: 2, method: 'join', params: { path: '/a' } }),
    ]);
  });

  it.each([
    ['an unknown method', { id: 4, method: 'rejoin', params: {} }],
    ['a missing path', { id: 5, method: 'join', params: {} }],
    [
      'a notification',
      { method: 'actions', params: { path: '/a', actions: [] } },
    ],
    ['a value that is no object', [1, 2]],
  ])(
    'refuses %s, keeping the value for the hub to answer',
    async (_, value) => {
      const { values } = await drain(
        Stream.fromIterable([line(value)]).pipe(decodePeerToHubFrames)
      );

      expect(values).toEqual([
        Result.fail({ value, issue: expect.any(String) }),
      ]);
    }
  );
});

describe('decodeHubToPeerFrames', () => {
  it('decodes the responses and notifications a hub sends', async () => {
    const response = {
      id: 3,
      ok: false,
      method: 'save',
      error: { code: 'notOpen', message: 'closed' },
    };
    const notification = {
      method: 'actions',
      params: { path: '/a', actions: [{ type: 'x' }] },
    };
    const { values } = await drain(
      Stream.fromIterable([line(response) + line(notification)]).pipe(
        decodeHubToPeerFrames
      )
    );

    expect(values).toEqual([
      Result.succeed(response),
      Result.succeed(notification),
    ]);
  });

  it.each([
    ['a request', { id: 1, method: 'save', params: { path: '/a' } }],
    [
      'an unknown error code',
      {
        id: 1,
        ok: false,
        method: 'save',
        error: { code: 'gone', message: 'x' },
      },
    ],
    ['an unknown notification', { method: 'focus', params: { path: '/a' } }],
  ])('refuses %s, keeping the value', async (_, value) => {
    const { values } = await drain(
      Stream.fromIterable([line(value)]).pipe(decodeHubToPeerFrames)
    );

    expect(values).toEqual([Result.fail({ value, issue: expect.any(String) })]);
  });
});

describe('encodePeerToHubFrame', () => {
  it('throws what the schema refuses, and what JSON cannot frame', () => {
    expect(() =>
      encodePeerToHubFrame({
        id: 5,
        method: 'join',
        params: {},
      } as unknown as PeerToHubMessage)
    ).toThrow(/Missing key/);
    expect(() =>
      encodePeerToHubFrame({
        id: 6,
        method: 'applyActions',
        params: { path: '/a', actions: [1n] },
      })
    ).toThrow(TypeError);
  });

  it('leaves out an optional given as undefined, as encodeFrame does', () => {
    const request = {
      id: 8,
      method: 'openDocument',
      params: { path: '/a', create: undefined, initialValue: undefined },
    } as const satisfies PeerToHubMessage;

    expect(encodePeerToHubFrame(request)).toBe(encodeFrame(request));
    expect(encodePeerToHubFrame(request)).toBe(
      '{"id":8,"method":"openDocument","params":{"path":"/a"}}\n'
    );
  });
});

describe('encodeHubNotificationFrame', () => {
  it('throws what the schema refuses', () => {
    expect(() =>
      encodeHubNotificationFrame({
        method: 'actions',
        params: { path: '/a' },
      } as unknown as HubNotification)
    ).toThrow(/Missing key/);
  });
});
