import {
  HUB_PROTOCOL_VERSION,
  HubErrorCode,
  HubRequestError,
  protocolMismatchMessage,
} from '@dineug/erd-editor-agent-hub';
import * as Effect from 'effect/Effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { type ServeOptions } from '@/hub/server';

import {
  createHubHandler,
  createMemoryHubServer,
  flush,
  helloFrame,
  type MemoryHubServer,
  type MockHubHandler,
} from '../../test/mocks/hubLayers';

const TOKEN = '6f1c2e0a-8f7e-4d4c-9a51-3a8e2b1d0c9f';

let handler: MockHubHandler;
let authorize: ReturnType<typeof vi.fn<ServeOptions['authorize']>>;
let servers: MemoryHubServer[];

function createServer() {
  const server = createMemoryHubServer({
    token: TOKEN,
    ide: 'vscode',
    version: '2.9.0',
    handler,
    authorize,
  });
  servers.push(server);
  return server;
}

/** A connection that has not said hello yet. */
function connect(server = createServer()) {
  return { server, ...server.accept() };
}

/** A connection whose hello passed; its response is already consumed. */
async function connectAuthenticated(server = createServer()) {
  const connection = connect(server);
  connection.client.send(helloFrame(TOKEN));
  await flush();
  connection.client.received.length = 0;
  return connection;
}

/** The connection object the handler was called with. */
function peerOf(mock: { mock: { calls: unknown[][] } }) {
  return mock.mock.calls[0][1];
}

beforeEach(() => {
  servers = [];
  handler = createHubHandler();
  authorize = vi.fn((path: string) => Effect.succeed(`/real${path}`));
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(async () => {
  for (const server of servers) await server.close();
  vi.restoreAllMocks();
});

describe('hello', () => {
  it('answers a hello carrying the lock token with the protocol, ide and version', async () => {
    const { client } = connect();

    client.send(helloFrame(TOKEN, {}, 7));
    await flush();

    expect(client.received).toEqual([
      {
        id: 7,
        ok: true,
        method: 'hello',
        result: {
          protocolVersion: HUB_PROTOCOL_VERSION,
          ide: 'vscode',
          version: '2.9.0',
        },
      },
    ]);
    expect(client.closed).toBe(false);
  });

  it.each([
    ['a different token of the same length', TOKEN.replace('6', '7')],
    ['a shorter token', TOKEN.slice(1)],
    ['no token at all', undefined],
  ])('refuses %s with unauthorized and hangs up', async (_label, token) => {
    const { client } = connect();

    client.send(helloFrame(TOKEN, { token }));
    await flush();

    expect(client.received).toEqual([
      {
        id: 1,
        ok: false,
        method: 'hello',
        error: {
          code: HubErrorCode.unauthorized,
          message: expect.stringContaining('token'),
        },
      },
    ]);
    expect(client.closed).toBe(true);
  });

  it('refuses a hello whose params are not an object', async () => {
    const { client } = connect();

    client.send({ id: 1, method: 'hello', params: 'secret' });
    await flush();

    expect(client.received).toMatchObject([
      { ok: false, error: { code: HubErrorCode.unauthorized } },
    ]);
    expect(client.closed).toBe(true);
  });

  it('refuses another protocol with a message naming the side to update, then hangs up', async () => {
    const { client } = connect();

    client.send(
      helloFrame(TOKEN, { protocolVersion: HUB_PROTOCOL_VERSION + 1 })
    );
    await flush();

    expect(client.received).toEqual([
      {
        id: 1,
        ok: false,
        method: 'hello',
        error: {
          code: HubErrorCode.protocolMismatch,
          message: protocolMismatchMessage(
            HUB_PROTOCOL_VERSION,
            HUB_PROTOCOL_VERSION + 1
          ),
          hubProtocolVersion: HUB_PROTOCOL_VERSION,
          clientProtocolVersion: HUB_PROTOCOL_VERSION + 1,
        },
      },
    ]);
    expect(client.closed).toBe(true);
  });

  it('treats a hello without a numeric protocol version as protocol 0', async () => {
    const { client } = connect();

    client.send(helloFrame(TOKEN, { protocolVersion: '1' }));
    await flush();

    expect(client.received).toMatchObject([
      {
        ok: false,
        error: {
          code: HubErrorCode.protocolMismatch,
          clientProtocolVersion: 0,
        },
      },
    ]);
  });

  it.each([
    ['a request other than hello', { id: 1, method: 'join', params: {} }],
    ['a hello without an id', { method: 'hello', params: { token: TOKEN } }],
    ['a hello with a fractional id', { ...helloFrame(TOKEN), id: 1.5 }],
    ['a frame that is not an object', [helloFrame(TOKEN)]],
    ['null', null],
  ])(
    'hangs up without a word on %s as the first frame',
    async (_label, frame) => {
      const { client } = connect();

      client.send(frame);
      await flush();

      expect(client.received).toEqual([]);
      expect(client.closed).toBe(true);
      expect(handler.join).not.toHaveBeenCalled();
    }
  );

  it('ignores the frames a refused client pipelined behind its hello', async () => {
    const { client } = connect();

    client.sendRaw(
      `${JSON.stringify(helloFrame('wrong'))}\n${JSON.stringify({ id: 2, method: 'listDocuments', params: {} })}\n`
    );
    await flush();

    expect(client.received).toHaveLength(1);
    expect(handler.listDocuments).not.toHaveBeenCalled();
  });

  it('hands the connection the client name, or an empty one', async () => {
    const named = await connectAuthenticated();
    const unnamed = connect(named.server);
    unnamed.client.send(helloFrame(TOKEN, { client: 42 }));
    await flush();

    named.client.send({ id: 2, method: 'listDocuments', params: {} });
    unnamed.client.send({ id: 2, method: 'listDocuments', params: {} });
    await flush();

    const [first, second] = handler.listDocuments.mock.calls.map(
      ([, peer]) => peer
    );
    expect(first).toMatchObject({ id: 1, client: 'spec' });
    expect(second).toMatchObject({ id: 2, client: '' });
  });

  it('numbers only the peers whose hello passed', async () => {
    const server = createServer();
    const refused = connect(server);
    refused.client.send(helloFrame('wrong'));
    await flush();
    const accepted = await connectAuthenticated(server);

    accepted.client.send({ id: 2, method: 'listDocuments', params: {} });
    await flush();

    expect(peerOf(handler.listDocuments)).toMatchObject({ id: 1 });
  });
});

describe('framing', () => {
  it('reassembles a frame split across chunks and splits two frames in one', async () => {
    const { client } = connect();
    const hello = JSON.stringify(helloFrame(TOKEN));
    const list = JSON.stringify({ id: 2, method: 'listDocuments', params: {} });

    client.sendRaw(hello.slice(0, 10));
    client.sendRaw(`${hello.slice(10)}\n${list}\n`);
    await flush();

    expect(client.received).toMatchObject([
      { id: 1, ok: true },
      { id: 2, ok: true, result: { documents: [] } },
    ]);
  });

  it('hangs up on a line that is not JSON and reads nothing after it', async () => {
    const { client } = await connectAuthenticated();

    client.sendRaw('{"id":2,\n');
    client.send({ id: 3, method: 'listDocuments', params: {} });
    await flush();

    expect(client.closed).toBe(true);
    expect(handler.listDocuments).not.toHaveBeenCalled();
  });

  it('destroys the socket it hangs up on, where a refused hello only ends it', async () => {
    const malformed = connect();
    const refused = connect();

    malformed.client.sendRaw('{"id":2,\n');
    refused.client.send(helloFrame('wrong'));
    await flush();

    expect(malformed.destroy).toHaveBeenCalledTimes(1);
    expect(refused.destroy).not.toHaveBeenCalled();
    expect(refused.client.received).toMatchObject([{ ok: false }]);
  });
});

describe('requests', () => {
  it('routes a request to the handler and answers with its result', async () => {
    const { client } = await connectAuthenticated();

    client.send({ id: 2, method: 'listDocuments', params: {} });
    await flush();

    expect(handler.listDocuments).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ id: 1 })
    );
    expect(client.received).toEqual([
      { id: 2, ok: true, method: 'listDocuments', result: { documents: [] } },
    ]);
  });

  it('hands the handler empty params when a request carries none', async () => {
    const { client } = await connectAuthenticated();

    client.send({ id: 2, method: 'listDocuments' });
    await flush();

    expect(handler.listDocuments).toHaveBeenCalledWith({}, expect.anything());
  });

  it('replaces params.path with the authorized real path before the handler sees it', async () => {
    const { client } = await connectAuthenticated();

    client.send({
      id: 2,
      method: 'openDocument',
      params: { path: '/ws/a.erd.json', create: true, initialValue: '{}' },
    });
    await flush();

    expect(authorize).toHaveBeenCalledWith('/ws/a.erd.json');
    expect(handler.openDocument).toHaveBeenCalledWith(
      { path: '/real/ws/a.erd.json', create: true, initialValue: '{}' },
      expect.anything()
    );
    expect(client.received).toMatchObject([
      { id: 2, ok: true, result: { path: '/real/ws/a.erd.json' } },
    ]);
  });

  it.each(['openDocument', 'join', 'applyActions', 'leave', 'save'])(
    'answers %s with the authorization error and never calls the handler',
    async method => {
      authorize.mockImplementationOnce(() =>
        Effect.fail(
          new HubRequestError({
            code: HubErrorCode.outsideWorkspace,
            message: 'outside',
          })
        )
      );
      const { client } = await connectAuthenticated();

      client.send({
        id: 2,
        method,
        params: { path: '/etc/passwd', actions: [] },
      });
      await flush();

      expect(client.received).toEqual([
        {
          id: 2,
          ok: false,
          method,
          error: { code: HubErrorCode.outsideWorkspace, message: 'outside' },
        },
      ]);
      expect(handler[method as 'join']).not.toHaveBeenCalled();
    }
  );

  it('answers a request without a string path with badRequest, authorizing nothing', async () => {
    const { client } = await connectAuthenticated();

    client.send({ id: 2, method: 'join', params: { path: 7 } });
    await flush();

    expect(authorize).not.toHaveBeenCalled();
    expect(client.received).toMatchObject([
      {
        id: 2,
        ok: false,
        method: 'join',
        error: {
          code: HubErrorCode.badRequest,
          message: 'join needs a string params.path',
        },
      },
    ]);
  });

  it('never authorizes a path on a method that names no document', async () => {
    const { client } = await connectAuthenticated();

    client.send({ id: 2, method: 'listDocuments', params: { path: '/etc' } });
    await flush();

    expect(authorize).not.toHaveBeenCalled();
    expect(client.received).toMatchObject([{ id: 2, ok: true }]);
  });

  it.each([
    ['an unknown method', 'rejoin', 'The hub has no method "rejoin"'],
    ['a second hello', 'hello', 'The hub has no method "hello"'],
    ['a prototype key', 'toString', 'The hub has no method "toString"'],
  ])('answers %s with badRequest', async (_label, method, message) => {
    const { client } = await connectAuthenticated();

    client.send({ id: 2, method, params: {} });
    await flush();

    expect(client.received).toEqual([
      {
        id: 2,
        ok: false,
        method,
        error: { code: HubErrorCode.badRequest, message },
      },
    ]);
    expect(client.closed).toBe(false);
  });

  it('answers a request with no method string with badRequest', async () => {
    const { client } = await connectAuthenticated();

    client.send({ id: 2, params: {} });
    await flush();

    expect(client.received).toMatchObject([
      {
        id: 2,
        ok: false,
        method: '',
        error: { code: HubErrorCode.badRequest },
      },
    ]);
  });

  it('logs every error code it answers with, for diagnosing a client that cannot attach', async () => {
    const { client } = await connectAuthenticated();

    client.send({ id: 2, method: 'rejoin', params: {} });
    await flush();

    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      'answered rejoin with badRequest',
      {
        code: HubErrorCode.badRequest,
        message: 'The hub has no method "rejoin"',
      }
    );
  });

  it('carries the code of a HubRequestError the handler answers with', async () => {
    handler.join.mockImplementationOnce(() =>
      Effect.fail(
        new HubRequestError({
          code: HubErrorCode.notOpen,
          message: 'no webview is ready',
        })
      )
    );
    const { client } = await connectAuthenticated();

    client.send({ id: 2, method: 'join', params: { path: '/ws/a.erd.json' } });
    await flush();

    expect(client.received).toEqual([
      {
        id: 2,
        ok: false,
        method: 'join',
        error: { code: HubErrorCode.notOpen, message: 'no webview is ready' },
      },
    ]);
  });

  it('answers a handler bug, failed or thrown, with internal and logs it', async () => {
    handler.save.mockImplementationOnce(() =>
      Effect.die(new TypeError('document is undefined'))
    );
    handler.leave.mockImplementationOnce(() => {
      throw new RangeError('thrown before any effect');
    });
    const { client } = await connectAuthenticated();

    client.send({ id: 2, method: 'save', params: { path: '/ws/a.erd.json' } });
    client.send({ id: 3, method: 'leave', params: { path: '/ws/a.erd.json' } });
    await flush();

    expect([...client.received].sort((a: any, b: any) => a.id - b.id)).toEqual([
      {
        id: 2,
        ok: false,
        method: 'save',
        error: {
          code: HubErrorCode.internal,
          message: 'TypeError: document is undefined',
        },
      },
      {
        id: 3,
        ok: false,
        method: 'leave',
        error: {
          code: HubErrorCode.internal,
          message: 'RangeError: thrown before any effect',
        },
      },
    ]);
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      'request failed',
      expect.any(TypeError)
    );
  });

  it('answers with internal when the result cannot be framed', async () => {
    handler.listDocuments.mockImplementationOnce(() =>
      Effect.succeed({ documents: [{ path: 1n }] } as any)
    );
    const { client } = await connectAuthenticated();

    client.send({ id: 2, method: 'listDocuments', params: {} });
    await flush();

    expect(client.received).toMatchObject([
      {
        id: 2,
        ok: false,
        method: 'listDocuments',
        error: {
          code: HubErrorCode.internal,
          message: expect.stringContaining('BigInt'),
        },
      },
    ]);
  });

  it('keeps later frames moving while a slow request is pending, and calls handlers in order', async () => {
    let release!: () => void;
    handler.openDocument.mockImplementationOnce(({ path }) =>
      Effect.promise(
        () =>
          new Promise(resolve => {
            release = () => resolve({ path, opened: true, webviews: 1 });
          })
      )
    );
    const { client } = await connectAuthenticated();

    client.send({ id: 2, method: 'openDocument', params: { path: '/a' } });
    client.send({ id: 3, method: 'listDocuments', params: {} });
    await flush();

    expect(client.received).toMatchObject([{ id: 3, ok: true }]);
    expect(handler.openDocument.mock.invocationCallOrder[0]).toBeLessThan(
      handler.listDocuments.mock.invocationCallOrder[0]
    );

    release();
    await flush();
    expect(client.received).toMatchObject([
      { id: 3, ok: true },
      { id: 2, ok: true, result: { path: '/real/a' } },
    ]);
  });

  it('logs the connection it loses when a response cannot be written', async () => {
    const { client, write } = await connectAuthenticated();
    write.mockImplementationOnce(() => {
      throw new Error('EPIPE');
    });

    client.send({ id: 2, method: 'listDocuments', params: {} });
    await flush();

    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      'could not write to a peer',
      expect.objectContaining({
        _tag: 'SocketWriteError',
        cause: expect.objectContaining({ message: 'EPIPE' }),
      })
    );
  });

  it('keeps reading from a peer whose response could not be written', async () => {
    const { client, write } = await connectAuthenticated();
    write.mockImplementationOnce(() => {
      throw new Error('EPIPE');
    });

    client.send({ id: 2, method: 'rejoin', params: {} });
    await flush();
    client.send({ id: 3, method: 'listDocuments', params: {} });
    await flush();

    expect(client.received).toMatchObject([{ id: 3, ok: true }]);
    expect(handler.disconnect).not.toHaveBeenCalled();
  });
});

describe('applyActions', () => {
  it('reaches the handler with the authorized path and the connection, and answers its result', async () => {
    handler.applyActions.mockImplementationOnce(() =>
      Effect.succeed({ webviews: 2 })
    );
    const { client } = await connectAuthenticated();
    const actions = [{ type: 'table.add', payload: {}, version: 3 }];

    client.send({
      id: 2,
      method: 'applyActions',
      params: { path: '/ws/a.erd.json', actions },
    });
    await flush();

    expect(handler.applyActions).toHaveBeenCalledWith(
      { path: '/real/ws/a.erd.json', actions },
      expect.objectContaining({ id: 1 })
    );
    expect(client.received).toEqual([
      { id: 2, ok: true, method: 'applyActions', result: { webviews: 2 } },
    ]);
  });

  it('answers a refusal of the handler with its code, which a notification never could', async () => {
    handler.applyActions.mockImplementationOnce(() =>
      Effect.fail(
        new HubRequestError({
          code: HubErrorCode.notOpen,
          message: 'no webview is ready',
        })
      )
    );
    const { client } = await connectAuthenticated();

    client.send({
      id: 2,
      method: 'applyActions',
      params: { path: '/a', actions: [] },
    });
    await flush();

    expect(client.received).toEqual([
      {
        id: 2,
        ok: false,
        method: 'applyActions',
        error: { code: HubErrorCode.notOpen, message: 'no webview is ready' },
      },
    ]);
  });

  it.each([
    [
      'without a path',
      { actions: [] },
      'applyActions needs a string params.path',
    ],
    [
      'without an actions array',
      { path: '/ws/a.erd.json', actions: {} },
      'applyActions needs an array params.actions',
    ],
  ])('answers a batch %s with badRequest', async (_label, params, message) => {
    const { client } = await connectAuthenticated();

    client.send({ id: 2, method: 'applyActions', params });
    await flush();

    expect(authorize).not.toHaveBeenCalled();
    expect(handler.applyActions).not.toHaveBeenCalled();
    expect(client.received).toEqual([
      {
        id: 2,
        ok: false,
        method: 'applyActions',
        error: { code: HubErrorCode.badRequest, message },
      },
    ]);
  });

  it('holds the frames behind a batch until the batch is answered', async () => {
    let finishFirst!: () => void;
    handler.applyActions.mockImplementationOnce(() =>
      Effect.promise(
        () =>
          new Promise(resolve => (finishFirst = () => resolve({ webviews: 1 })))
      )
    );
    handler.applyActions.mockImplementationOnce(() =>
      Effect.die(new Error('webview gone'))
    );
    const { client } = await connectAuthenticated();

    client.send({
      id: 2,
      method: 'applyActions',
      params: { path: '/a', actions: [1] },
    });
    client.send({
      id: 3,
      method: 'applyActions',
      params: { path: '/a', actions: [2] },
    });
    client.send({ id: 4, method: 'listDocuments', params: {} });
    await flush();
    expect(handler.applyActions).toHaveBeenCalledTimes(1);
    expect(handler.listDocuments).not.toHaveBeenCalled();

    finishFirst();
    await flush();
    expect(
      handler.applyActions.mock.calls.map(([params]) => params.actions)
    ).toEqual([[1], [2]]);
    expect(client.received).toMatchObject([
      { id: 2, ok: true, result: { webviews: 1 } },
      {
        id: 3,
        ok: false,
        error: { code: HubErrorCode.internal, message: 'Error: webview gone' },
      },
      { id: 4, ok: true },
    ]);
  });

  it('keeps several batches for one document in their order while authorization is slow', async () => {
    let resolveFirst!: (path: string) => void;
    authorize.mockImplementationOnce(() =>
      Effect.promise(
        () => new Promise<string>(resolve => (resolveFirst = resolve))
      )
    );
    const { client } = await connectAuthenticated();

    client.send({
      id: 2,
      method: 'applyActions',
      params: { path: '/a', actions: [1] },
    });
    client.send({
      id: 3,
      method: 'applyActions',
      params: { path: '/a', actions: [2] },
    });
    await flush();
    resolveFirst('/real/a');
    await flush();

    expect(
      handler.applyActions.mock.calls.map(([params]) => params.actions)
    ).toEqual([[1], [2]]);
  });

  it('logs a handler that throws, answers internal and keeps the connection', async () => {
    handler.applyActions.mockImplementationOnce(() => {
      throw new Error('registry bug');
    });
    const { client } = await connectAuthenticated();

    client.send({
      id: 2,
      method: 'applyActions',
      params: { path: '/a', actions: [] },
    });
    client.send({ id: 3, method: 'listDocuments', params: {} });
    await flush();

    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      'request failed',
      expect.objectContaining({ message: 'registry bug' })
    );
    expect(client.received).toMatchObject([
      { id: 2, ok: false, error: { code: HubErrorCode.internal } },
      { id: 3, ok: true },
    ]);
    expect(client.closed).toBe(false);
  });
});

describe('frames without an id', () => {
  it('ignores an actions notification from a peer: actions come in as applyActions', async () => {
    const { client } = await connectAuthenticated();

    client.send({
      method: 'actions',
      params: { path: '/ws/a.erd.json', actions: [] },
    });
    await flush();

    expect(authorize).not.toHaveBeenCalled();
    expect(handler.applyActions).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      'ignored a "actions" frame without an id: a peer sends requests only'
    );
    expect(client.received).toEqual([]);
    expect(client.closed).toBe(false);
  });

  it('ignores a frame after hello that is no object at all', async () => {
    const { client } = await connectAuthenticated();

    client.send([1, 2]);
    await flush();

    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      'ignored a "" frame without an id: a peer sends requests only'
    );
    expect(client.closed).toBe(false);
  });
});

describe('notify', () => {
  it('frames a notification to the peer, and drops it once the peer is gone', async () => {
    const { client } = await connectAuthenticated();
    client.send({ id: 2, method: 'listDocuments', params: {} });
    await flush();
    const peer = peerOf(handler.listDocuments) as any;
    client.received.length = 0;

    peer.notify({ method: 'documentClosed', params: { path: '/a' } });
    await flush();
    client.close();
    peer.notify({ method: 'documentClosed', params: { path: '/b' } });
    await flush();

    expect(client.received).toEqual([
      { method: 'documentClosed', params: { path: '/a' } },
    ]);
  });
});

describe('closing', () => {
  it('tells the handler once when an authenticated peer hangs up', async () => {
    const { client } = await connectAuthenticated();
    client.send({ id: 2, method: 'listDocuments', params: {} });
    await flush();

    client.close();
    await flush();

    expect(handler.disconnect).toHaveBeenCalledTimes(1);
    expect(handler.disconnect).toHaveBeenCalledWith(
      peerOf(handler.listDocuments)
    );
  });

  it('does not tell the handler about a peer that never said hello', async () => {
    const { client } = connect();

    client.close();
    await flush();

    expect(handler.disconnect).not.toHaveBeenCalled();
  });

  it('never calls the handler for a request whose peer left during authorization', async () => {
    let resolvePath!: (path: string) => void;
    authorize.mockImplementationOnce(() =>
      Effect.promise(
        () => new Promise<string>(resolve => (resolvePath = resolve))
      )
    );
    const { client } = await connectAuthenticated();

    client.send({ id: 2, method: 'join', params: { path: '/a' } });
    client.send({
      id: 3,
      method: 'applyActions',
      params: { path: '/a', actions: [] },
    });
    await flush();
    client.close();
    await flush();
    resolvePath('/real/a');
    await flush();

    expect(handler.join).not.toHaveBeenCalled();
    expect(handler.applyActions).not.toHaveBeenCalled();
  });

  it('writes no response for a request that finishes after its peer left', async () => {
    let release!: () => void;
    handler.save.mockImplementationOnce(() =>
      Effect.promise(
        () => new Promise(resolve => (release = () => resolve({ saved: true })))
      )
    );
    const { client, write } = await connectAuthenticated();

    client.send({ id: 2, method: 'save', params: { path: '/a' } });
    await flush();
    client.close();
    await flush();
    write.mockClear();
    release();
    await flush();

    expect(write).not.toHaveBeenCalled();
    expect(handler.save).toHaveBeenCalledTimes(1);
  });

  it('hangs up every connection on close, and reads nothing afterwards', async () => {
    const server = createServer();
    const first = await connectAuthenticated(server);
    const second = connect(server);
    await flush();

    await server.close();
    first.client.send({ id: 2, method: 'listDocuments', params: {} });
    await flush();

    expect(first.client.closed).toBe(true);
    expect(second.client.closed).toBe(true);
    expect(handler.listDocuments).not.toHaveBeenCalled();
  });

  it('reads nothing a peer sends after its hello was refused', async () => {
    const { client } = connect();

    client.send(helloFrame('wrong'));
    await flush();
    client.send(helloFrame(TOKEN, {}, 2));
    await flush();

    expect(client.received).toHaveLength(1);
  });
});
