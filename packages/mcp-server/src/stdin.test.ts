import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stdio from 'effect/Stdio';
import * as Stream from 'effect/Stream';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { StderrLogger } from '@/logger';
import { isMessageLine, MessageStdin } from '@/stdin';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const encoder = new TextEncoder();

/** What MessageStdin passes on of the chunks stdin delivers, as text. */
const passOn = (chunks: Array<string | Uint8Array>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const stdio = yield* Stdio.Stdio;
      const texts = yield* Stream.runCollect(
        stdio.stdin.pipe(Stream.decodeText())
      );
      return texts.join('');
    }).pipe(
      Effect.provide(
        MessageStdin.pipe(
          Layer.provide(
            Stdio.layerTest({
              stdin: Stream.fromIterable(
                chunks.map(chunk =>
                  typeof chunk === 'string' ? encoder.encode(chunk) : chunk
                )
              ),
            })
          )
        )
      ),
      Effect.provide(StderrLogger)
    )
  );

describe('isMessageLine', () => {
  it.each([
    '{"jsonrpc":"2.0","id":1,"method":"ping"}',
    '{"jsonrpc":"2.0","id":1,"result":{}}',
    '{}',
    '[]',
    '[{"jsonrpc":"2.0","method":"notifications/initialized"}]',
    '{"jsonrpc":"2.0","id":1,"method":"ping"}\r',
    '{"jsonrpc":"2.0","id":1,"method":"ping","headers":null}',
    '{"jsonrpc":"2.0","id":1,"method":"ping","headers":{"a":"b"}}',
    '{"jsonrpc":"2.0","id":1,"method":"ping","headers":[["a","b"]]}',
  ])('takes %j', line => {
    expect(isMessageLine(line)).toBe(true);
  });

  it.each([
    '',
    '   ',
    '{not json',
    'null',
    '42',
    '"text"',
    'true',
    '[null]',
    '[1]',
    '[[]]',
    '{"method":5}',
    '{"method":null}',
    '{"jsonrpc":"2.0","method":"@effect/rpc/Eof"}',
    '[{"jsonrpc":"2.0","method":"@effect/rpc/Interrupt"}]',
    '[{"jsonrpc":"2.0","id":1,"method":"ping"},null]',
    '[{"jsonrpc":"2.0","id":1,"method":"ping"},{"method":5}]',
    '{"jsonrpc":"2.0","id":1,"method":"ping","headers":5}',
    '{"jsonrpc":"2.0","id":1,"method":"ping","headers":"ab"}',
    '{"jsonrpc":"2.0","id":1,"method":"ping","headers":[5]}',
    '[{"jsonrpc":"2.0","method":"notifications/x","headers":[[1,2]]}]',
  ])('refuses %j', line => {
    expect(isMessageLine(line)).toBe(false);
  });
});

describe('MessageStdin', () => {
  it('passes messages on a line each, however stdin splits them', async () => {
    const snowman = encoder.encode('{"n":"☃"}\n');

    expect(
      await passOn([
        '{"a":1}\n{"b":',
        '2}\n',
        snowman.slice(0, 7),
        snowman.slice(7),
        '{"c":3}\r\n',
      ])
    ).toBe('{"a":1}\n{"b":2}\n{"n":"☃"}\n{"c":3}\r\n');
  });

  it('never passes on a line stdin did not end', async () => {
    expect(await passOn(['{"a":1}\n{"b":2}'])).toBe('{"a":1}\n');
  });

  it('skips a line that is not a message, logging all but a blank one', async () => {
    const long = `{${'x'.repeat(100)}`;

    expect(await passOn([`\n  \n{not json\nnull\n${long}\n{"a":1}\n`])).toBe(
      '{"a":1}\n'
    );
    expect(vi.mocked(console.error).mock.calls).toEqual([
      [
        '[erd-editor-mcp]',
        'skipped a stdin line that is not a JSON-RPC message',
        '{not json',
      ],
      [
        '[erd-editor-mcp]',
        'skipped a stdin line that is not a JSON-RPC message',
        'null',
      ],
      [
        '[erd-editor-mcp]',
        'skipped a stdin line that is not a JSON-RPC message',
        long.slice(0, 80),
      ],
    ]);
  });
});
