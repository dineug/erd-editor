import { HUB_PROTOCOL_VERSION, pipePath } from '@dineug/erd-editor-agent-hub';
import { Effect, Exit, Fiber, Scope } from 'effect';
import { TestClock } from 'effect/testing';
import { Socket } from 'effect/unstable/socket';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { settle } from '@/__test-utils__/mcp';
import { createMemoryHost } from '@/__test-utils__/memoryHost';
import {
  createSocketPair,
  type ServerSocket,
} from '@/__test-utils__/memorySocket';
import {
  type HubClientOptions,
  HubConnector,
  makeHubClient,
  REQUEST_TIMEOUT_MS,
} from '@/hub/client';
import { HubUnreachable } from '@/io/netSocket';
import { StderrLogger } from '@/logger';

let scope: Scope.Closeable;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  scope = Scope.makeUnsafe();
});

afterEach(async () => {
  await Effect.runPromise(Scope.close(scope, Exit.void));
  vi.restoreAllMocks();
});

/** Runs an effect in the spec's scope, which outlives it, logging as the server does. */
const run = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) =>
  Effect.runPromise(
    effect.pipe(Scope.provide(scope), Effect.provide(StderrLogger))
  );

/** A client over a socket pair whose hub end the spec drives by hand, in a scope of its own. */
async function pair(options: Partial<HubClientOptions> = {}) {
  const { client, server } = createSocketPair();
  const sent: any[] = [];
  server.onData(chunk => {
    for (const line of chunk.split('\n').filter(Boolean))
      sent.push(JSON.parse(line));
  });
  const own = Scope.forkUnsafe(scope);
  const hub = await run(
    makeHubClient(client, 7, { client: 'c', ...options }).pipe(
      Scope.provide(own)
    )
  );
  return { server, sent, client: hub, scope: own };
}

const frame = (message: object) => `${JSON.stringify(message)}\n`;

describe('the hub client', () => {
  it('waits thirty seconds for an answer by default', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(30_000);
  });

  it('matches responses to requests by id and hands notifications on', async () => {
    const onNotification = vi.fn();
    const { server, sent, client } = await pair({ onNotification });

    const leave = run(client.request('leave', { path: '/a.erd.json' }));
    const save = run(client.request('save', { path: '/a.erd.json' }));
    await settle();
    server.write(
      frame({
        id: sent[1].id,
        ok: true,
        method: 'save',
        result: { saved: true },
      })
    );
    server.write(
      frame({ id: sent[0].id, ok: true, method: 'leave', result: {} })
    );
    server.write(
      frame({ method: 'documentClosed', params: { path: '/a.erd.json' } })
    );

    expect(await save).toEqual({ saved: true });
    expect(await leave).toEqual({});
    await settle();
    expect(onNotification).toHaveBeenCalledWith({
      method: 'documentClosed',
      params: { path: '/a.erd.json' },
    });
  });

  it.each([
    ['after', 'at once', ['joined', 'notification']],
    ['after', 'after a wait', ['joined', 'notification']],
    ['before', 'at once', ['notification', 'joined']],
  ])(
    'runs what a request does with its answer and a notification %s it in one chunk in stream order, its work done %s',
    async (position, timing, expected) => {
      const order: string[] = [];
      const { server, sent, client } = await pair({
        onNotification: () => order.push('notification'),
      });
      // A then that waits still runs before the next frame: it runs on the reading fiber.
      const wait =
        timing === 'at once' ? Effect.void : Effect.promise(() => settle(1));
      const joined = run(
        client.requestThen('join', { path: '/a.erd.json' }, () =>
          wait.pipe(Effect.andThen(Effect.sync(() => order.push('joined'))))
        )
      );
      await settle();

      const response = frame({
        id: sent[0].id,
        ok: true,
        method: 'join',
        result: { initialValue: '{}', snapshotVersion: 3, readonly: false },
      });
      const notification = frame({
        method: 'actions',
        params: { path: '/a.erd.json', actions: [] },
      });
      server.write(
        position === 'after'
          ? `${response}${notification}`
          : `${notification}${response}`
      );
      await joined;
      await settle();

      expect(order).toEqual(expected);
    }
  );

  it('resumes a requestThen caller once the frames read with its answer and the microtasks its then queued have run', async () => {
    const order: string[] = [];
    const { server, sent, client } = await pair({
      onNotification: () => order.push('notification'),
    });
    const joined = run(
      client
        .requestThen('join', { path: '/a.erd.json' }, () =>
          Effect.sync(() => {
            order.push('then');
            queueMicrotask(() => order.push('microtask'));
          })
        )
        .pipe(Effect.tap(() => Effect.sync(() => order.push('caller'))))
    );
    await settle();

    server.write(
      frame({
        id: sent[0].id,
        ok: true,
        method: 'join',
        result: { initialValue: '{}', snapshotVersion: 3, readonly: false },
      }) +
        frame({
          method: 'actions',
          params: { path: '/a.erd.json', actions: [] },
        })
    );
    await joined;

    expect(order).toEqual(['then', 'notification', 'microtask', 'caller']);
  });

  it('resumes a plain request caller before a later frame of the same chunk', async () => {
    const order: string[] = [];
    const { server, sent, client } = await pair({
      onNotification: () => order.push('notification'),
    });
    const saved = run(
      client
        .request('save', { path: '/a.erd.json' })
        .pipe(Effect.tap(() => Effect.sync(() => order.push('caller'))))
    );
    await settle();

    server.write(
      frame({
        id: sent[0].id,
        ok: true,
        method: 'save',
        result: { saved: true },
      }) + frame({ method: 'documentClosed', params: { path: '/a.erd.json' } })
    );
    await saved;
    await settle();

    expect(order).toEqual(['caller', 'notification']);
  });

  it('holds a caller on drained until the rest of the chunk its answer came in is taken', async () => {
    const order: string[] = [];
    const { server, sent, client } = await pair({
      onNotification: () => order.push('notification'),
    });
    const opened = run(
      client.request('openDocument', { path: '/a.erd.json' }).pipe(
        Effect.tap(() => Effect.sync(() => order.push('caller'))),
        Effect.andThen(client.drained),
        Effect.tap(() => Effect.sync(() => order.push('drained')))
      )
    );
    await settle();

    server.write(
      frame({
        id: sent[0].id,
        ok: true,
        method: 'openDocument',
        result: { path: '/a.erd.json', opened: false, webviews: 1 },
      }) +
        frame({
          method: 'actions',
          params: { path: '/a.erd.json', actions: [] },
        })
    );
    await opened;

    expect(order).toEqual(['caller', 'notification', 'drained']);
  });

  it('lets a caller past drained before a frame read after its answer, during the turn that released it', async () => {
    const order: string[] = [];
    const { server, sent, client } = await pair({
      onNotification: () => order.push('notification'),
    });
    const later = frame({
      method: 'actions',
      params: { path: '/a.erd.json', actions: [] },
    });
    const joined = run(
      client
        .requestThen('join', { path: '/a.erd.json' }, () =>
          Effect.sync(() => queueMicrotask(() => server.write(later)))
        )
        .pipe(
          Effect.andThen(client.drained),
          Effect.tap(() => Effect.sync(() => order.push('caller')))
        )
    );
    await settle();

    server.write(
      frame({
        id: sent[0].id,
        ok: true,
        method: 'join',
        result: { initialValue: '{}', snapshotVersion: 3, readonly: false },
      })
    );
    await joined;
    await settle();

    expect(order).toEqual(['caller', 'notification']);
  });

  it('resumes a requestThen caller its answer held when the connection closes in the turn that would release it', async () => {
    const { server, sent, client } = await pair();
    const joined = run(
      client.requestThen('join', { path: '/a.erd.json' }, () =>
        Effect.sync(() => {
          queueMicrotask(() => void Effect.runFork(client.close));
          return 'seeded';
        })
      )
    );
    await settle();

    server.write(
      frame({
        id: sent[0].id,
        ok: true,
        method: 'join',
        result: { initialValue: '{}', snapshotVersion: 3, readonly: false },
      })
    );

    expect(await Promise.race([joined, settle(50).then(() => 'held')])).toBe(
      'seeded'
    );
    expect(client.closed).toBe(true);
  });

  it('lets what waits on drained go when the connection closes', async () => {
    const { server, sent, client } = await pair();
    // A then that waits on drained holds the fiber that would release it, until the close does.
    const joined = run(
      client.requestThen('join', { path: '/a.erd.json' }, () =>
        client.drained.pipe(Effect.as('drained'))
      )
    );
    await settle();
    server.write(
      frame({
        id: sent[0].id,
        ok: true,
        method: 'join',
        result: { initialValue: '{}', snapshotVersion: 3, readonly: false },
      })
    );
    await settle();

    await run(client.close);

    expect(await Promise.race([joined, settle(50).then(() => 'held')])).toBe(
      'drained'
    );
    expect(await run(client.drained)).toBeUndefined();
  });

  it('ignores frames it cannot place: unknown ids, non objects, notifications without params', async () => {
    const onNotification = vi.fn();
    const { server, client } = await pair({ onNotification });

    server.write(
      '{"id":99,"ok":true,"result":{}}\n[1,2]\n{"method":"actions"}\n'
    );
    await settle();

    expect(onNotification).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      '[erd-editor-mcp]',
      'skipped a frame from the hub of pid 7 that is neither a response nor a notification',
      expect.any(String)
    );
    expect(client.closed).toBe(false);
  });

  it('hands on a notification the schema refuses as it reads, an unknown one among them', async () => {
    const onNotification = vi.fn();
    const { server, client } = await pair({ onNotification });
    const refused = [
      { method: 'focus', params: { path: '/a.erd.json' } },
      { method: 'actions', params: { path: '/a.erd.json' } },
      { method: 'documentClosed', params: { path: 7 } },
      { id: 'x', method: 'documentClosed', params: { path: '/a.erd.json' } },
    ];

    server.write(refused.map(frame).join(''));
    await settle();

    expect(onNotification.mock.calls).toEqual(refused.map(value => [value]));
    expect(client.closed).toBe(false);
  });

  it('takes a frame with a numeric id for an answer, even one shaped like a notification', async () => {
    const onNotification = vi.fn();
    const { server, sent, client } = await pair({ onNotification });

    const joined = run(client.request('join', { path: '/a.erd.json' }));
    await settle();
    server.write(
      frame({
        id: 99,
        method: 'documentClosed',
        params: { path: '/a.erd.json' },
      }) +
        frame({
          id: sent[0].id,
          method: 'documentClosed',
          params: { path: '/a.erd.json' },
        })
    );

    await expect(joined).rejects.toMatchObject({
      name: 'SessionError',
      code: 'internal',
      message: 'The hub refused join',
    });
    expect(onNotification).not.toHaveBeenCalled();
    expect(client.closed).toBe(false);
  });

  it('hands on a notification as decoded, dropping fields the schema does not know', async () => {
    const onNotification = vi.fn();
    const { server } = await pair({ onNotification });

    server.write(
      frame({
        method: 'actions',
        params: { path: '/a.erd.json', actions: [{ type: 'x' }], from: 'b' },
        sentAt: 1,
      })
    );
    await settle();

    expect(onNotification).toHaveBeenCalledWith({
      method: 'actions',
      params: { path: '/a.erd.json', actions: [{ type: 'x' }] },
    });
  });

  it('logs a notification the session could not take, and stays open', async () => {
    const { server, client } = await pair({
      onNotification: () => {
        throw new Error('no peer');
      },
    });

    server.write(frame({ method: 'documentClosed', params: { path: '/a' } }));
    await settle();

    expect(console.error).toHaveBeenCalledWith(
      '[erd-editor-mcp]',
      'dropped a notification from the hub of pid 7',
      expect.objectContaining({ message: 'no peer' })
    );
    expect(client.closed).toBe(false);
  });

  it('turns an error response into a SessionError, filling in what the hub left out', async () => {
    const { server, sent, client } = await pair();

    const refused = run(client.request('join', { path: '/a.erd.json' }));
    await settle();
    server.write(
      frame({ id: sent[0].id, ok: false, method: 'join', error: 'nope' })
    );

    await expect(refused).rejects.toMatchObject({
      name: 'SessionError',
      code: 'internal',
      message: 'The hub refused join',
    });
  });

  it('refuses with the code and message of an error response the schema takes', async () => {
    const { server, sent, client } = await pair();

    const refused = run(client.request('save', { path: '/a.erd.json' }));
    await settle();
    server.write(
      frame({
        id: sent[0].id,
        ok: false,
        method: 'save',
        error: { code: 'notOpen', message: 'no webview is ready' },
      })
    );

    await expect(refused).rejects.toMatchObject({
      name: 'SessionError',
      code: 'notOpen',
      message: 'no webview is ready',
    });
  });

  it('refuses with the code an error response names even when the schema does not know it', async () => {
    const { server, sent, client } = await pair();

    const refused = run(client.request('save', { path: '/a.erd.json' }));
    await settle();
    server.write(
      frame({
        id: sent[0].id,
        ok: false,
        method: 'save',
        error: { code: 'tooBusy', message: 'try later' },
      })
    );

    await expect(refused).rejects.toMatchObject({
      name: 'SessionError',
      code: 'tooBusy',
      message: 'try later',
    });
  });

  it('settles a request with the result of an answer the schema refuses, as sent', async () => {
    const { server, sent, client } = await pair();

    const saved = run(client.request('save', { path: '/a.erd.json' }));
    await settle();
    server.write(frame({ id: sent[0].id, ok: true, result: { saved: 'yes' } }));

    expect(await saved).toEqual({ saved: 'yes' });
    expect(client.closed).toBe(false);
  });

  it.each([42, { x: 1 }, null])(
    'refuses as internal an error response whose code is %j, and stays open',
    async code => {
      const { server, sent, client } = await pair();

      const refused = run(client.request('listDocuments', {}));
      await settle();
      server.write(
        frame({
          id: sent[0].id,
          ok: false,
          error: { code, message: 'bad code' },
        })
      );

      await expect(refused).rejects.toMatchObject({
        name: 'SessionError',
        code: 'internal',
        message: 'bad code',
      });
      expect(client.closed).toBe(false);
    }
  );

  it('times out a request nobody answers, on the clock', async () => {
    const { client } = await pair();

    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          client.request('listDocuments', {})
        );
        yield* TestClock.adjust(REQUEST_TIMEOUT_MS - 1);
        const early = fiber.pollUnsafe();
        yield* TestClock.adjust(1);
        return { early, error: yield* Effect.flip(Fiber.join(fiber)) };
      }).pipe(Effect.provide(TestClock.layer()))
    );

    expect(outcome.early).toBeUndefined();
    expect(outcome.error).toMatchObject({
      code: 'timeout',
      message: `The VS Code window (pid 7) did not answer listDocuments within ${REQUEST_TIMEOUT_MS} ms`,
    });
  });

  it('forgets a request once it timed out, so a late answer runs nothing', async () => {
    const then = vi.fn(() => Effect.void);
    const { server, sent, client } = await pair();

    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          client.requestThen('join', { path: '/a.erd.json' }, then)
        );
        yield* TestClock.adjust(REQUEST_TIMEOUT_MS);
        return yield* Effect.flip(Fiber.join(fiber));
      }).pipe(Effect.provide(TestClock.layer()))
    );
    server.write(
      frame({
        id: sent[0].id,
        ok: true,
        method: 'join',
        result: { initialValue: '{}', snapshotVersion: 3, readonly: false },
      })
    );
    await settle();

    expect(error).toMatchObject({ code: 'timeout' });
    expect(then).not.toHaveBeenCalled();
    expect(client.closed).toBe(false);
  });

  it('closes on a frame out of step, failing what is pending', async () => {
    const onClose = vi.fn();
    const { server, client } = await pair({ onClose });
    const hungUp = vi.fn();
    server.onClose(hungUp);

    const pending = run(client.request('listDocuments', {}));
    server.write('not json\n');

    await expect(pending).rejects.toMatchObject({ code: 'disconnected' });
    expect(client.closed).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(hungUp).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      '[erd-editor-mcp]',
      'closed the hub connection of pid 7 on a bad frame',
      expect.objectContaining({ reason: 'notJson' })
    );
    await expect(
      run(client.request('listDocuments', {}))
    ).rejects.toMatchObject({
      code: 'disconnected',
      message: 'The connection to the VS Code window (pid 7) is closed',
    });
  });

  it('writes each request through the schema, its fields in schema order', async () => {
    const { client, server } = createSocketPair();
    const chunks: string[] = [];
    server.onData(chunk => chunks.push(chunk));
    const hub = await run(makeHubClient(client, 7, { client: 'c' }));

    const opened = run(
      hub.request('openDocument', {
        initialValue: '{}',
        create: true,
        path: '/a.erd.json',
      })
    );
    await settle();

    expect(chunks.join('')).toBe(
      '{"id":1,"method":"openDocument","params":{"path":"/a.erd.json","create":true,"initialValue":"{}"}}\n'
    );
    await run(hub.close);
    await expect(opened).rejects.toMatchObject({ code: 'disconnected' });
  });

  it('fails a request it cannot frame, and one it cannot write, and stays usable', async () => {
    const { client } = await pair();

    await expect(
      run(client.request('applyActions', { path: '/a', actions: [1n] }))
    ).rejects.toBeInstanceOf(TypeError);

    const broken = await run(
      makeHubClient(
        Socket.make({
          reader: createSocketPair().client.reader,
          writer: Effect.succeed({
            write: () =>
              Effect.fail(
                new Socket.SocketError({
                  reason: new Socket.SocketWriteError({
                    cause: new Error('EPIPE'),
                  }),
                })
              ),
            writeAll: () => Effect.void,
          }),
        }),
        7,
        { client: 'c' }
      )
    );
    await expect(
      run(broken.request('save', { path: '/a.erd.json' }))
    ).rejects.toMatchObject({
      code: 'disconnected',
      message:
        'The connection to the VS Code window (pid 7) closed before it answered save',
    });
    expect(client.closed).toBe(false);
  });

  it('closes once, whether it or the hub hangs up first', async () => {
    const onClose = vi.fn();
    const { server, client } = await pair({ onClose });

    await run(client.close);
    await run(client.close);
    server.end();
    await settle();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fails what is pending as disconnected when the hub hangs up, and closes its scope', async () => {
    const onClose = vi.fn();
    const { server, client, scope: own } = await pair({ onClose });
    const released = vi.fn();
    await run(Scope.addFinalizer(own, Effect.sync(released)));

    const pending = run(client.request('save', { path: '/a.erd.json' }));
    await settle();
    server.destroy();

    await expect(pending).rejects.toMatchObject({
      code: 'disconnected',
      message:
        'The connection to the VS Code window (pid 7) closed before it answered save',
    });
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(released).toHaveBeenCalledTimes(1);
  });
});

describe('the hub connector', () => {
  const candidate = (protocolVersion = HUB_PROTOCOL_VERSION) => ({
    pid: 11,
    mtimeMs: 1,
    record: {
      pipe: pipePath('/home/agent', 11, 'linux'),
      workspaceFolders: ['/work'],
      documents: [],
      ide: 'vscode',
      version: '2.9.0',
      protocolVersion,
      token: 'secret',
      hub: true,
    },
  });

  const connect = (
    io: ReturnType<typeof createMemoryHost>,
    lock: ReturnType<typeof candidate>,
    client = 'c'
  ) =>
    run(
      Effect.gen(function* () {
        const connector = yield* HubConnector;
        return yield* connector.connect(lock, { client });
      }).pipe(Effect.provide(io.layer))
    );

  /** Answers hello in the given protocol, recording the frame it got. */
  const answerHello = (protocolVersion: number, seen: any[] = []) => {
    return (socket: ServerSocket) => {
      socket.onData(chunk => {
        const hello = JSON.parse(chunk);
        seen.push(hello);
        socket.write(
          frame({
            id: hello.id,
            ok: true,
            method: 'hello',
            result: { protocolVersion, ide: 'vscode', version: '2.9.0' },
          })
        );
      });
    };
  };

  it('says hello with the lock token, the protocol and the client name', async () => {
    const io = createMemoryHost();
    const seen: any[] = [];
    io.servers.set(
      candidate().record.pipe,
      answerHello(HUB_PROTOCOL_VERSION, seen)
    );

    const client = await connect(io, candidate(), 'claude-code');

    expect(seen).toMatchObject([
      {
        method: 'hello',
        params: {
          token: 'secret',
          protocolVersion: HUB_PROTOCOL_VERSION,
          client: 'claude-code',
        },
      },
    ]);
    expect(client.pid).toBe(11);
    await run(client.close);
  });

  it('refuses a hello answered in another protocol and closes the connection', async () => {
    const io = createMemoryHost();
    const hungUp = vi.fn();
    io.servers.set(candidate().record.pipe, socket => {
      socket.onClose(hungUp);
      answerHello(HUB_PROTOCOL_VERSION + 1)(socket);
    });

    await expect(connect(io, candidate())).rejects.toMatchObject({
      code: 'protocolMismatch',
    });
    expect(hungUp).toHaveBeenCalledTimes(1);
  });

  it('refuses a lock from another protocol without connecting', async () => {
    const io = createMemoryHost();
    const dial = vi.fn(io.connect);
    io.connect = dial;

    await expect(
      connect(io, candidate(HUB_PROTOCOL_VERSION + 1))
    ).rejects.toMatchObject({ code: 'protocolMismatch' });
    expect(dial).not.toHaveBeenCalled();
  });

  it('reports a hub nothing accepts a connection on, with the reason', async () => {
    const io = createMemoryHost();
    io.connect = pipe =>
      Effect.fail(new HubUnreachable({ pipe, message: 'refused' }));

    await expect(connect(io, candidate())).rejects.toMatchObject({
      code: 'hubUnreachable',
      message: expect.stringContaining('(refused)'),
    });
  });
});
