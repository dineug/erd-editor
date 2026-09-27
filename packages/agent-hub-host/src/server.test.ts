import { HubErrorCode } from '@dineug/erd-editor-agent-hub';
import { Effect } from 'effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createHubHandler,
  createMemoryHubServer,
  flush,
  helloFrame,
  type MemoryHubServer,
  type MockHubHandler,
} from '@/__test-utils__/hubLayers';
import { type HubConnection, type ServeOptions } from '@/server';

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

// Each hello, routing and refusal frame is a scenario of __fixtures__/conformance.json;
// what stays here checks what the corpus normalizes away (the params a handler gets, a
// log's detail) or needs timing, a second connection, a failing write or a thrown defect.
describe('hello', () => {
  it('numbers the peers of one server in the order their hello passed', async () => {
    const first = await connectAuthenticated();
    const second = await connectAuthenticated(first.server);

    first.client.send({ id: 2, method: 'listDocuments', params: {} });
    second.client.send({ id: 2, method: 'listDocuments', params: {} });
    await flush();

    expect(handler.listDocuments.mock.calls.map(([, peer]) => peer.id)).toEqual(
      [1, 2]
    );
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

describe('requests', () => {
  it('hands the handler empty params when a request carries none', async () => {
    const { client } = await connectAuthenticated();

    client.send({ id: 2, method: 'listDocuments' });
    await flush();

    expect(handler.listDocuments).toHaveBeenCalledWith({}, expect.anything());
  });

  it('hands the handler the params the schema decoded, without fields it does not know', async () => {
    const { client } = await connectAuthenticated();

    client.send({
      id: 2,
      method: 'join',
      params: { path: '/ws/a.erd.json', as: 'someone' },
      trace: 'x',
    });
    await flush();

    expect(handler.join).toHaveBeenCalledWith(
      { path: '/real/ws/a.erd.json' },
      expect.anything()
    );
  });

  it.each([
    ['null params', null],
    ['array params', [1]],
    ['string params', 'all'],
  ])(
    'still serves listDocuments with %s, which the schema refuses, as empty params',
    async (_label, params) => {
      const { client } = await connectAuthenticated();

      client.send({ id: 2, method: 'listDocuments', params });
      await flush();

      expect(handler.listDocuments).toHaveBeenCalledWith({}, expect.anything());
    }
  );

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

  it('writes a notification through its schema, dropping fields it does not know', async () => {
    const { client } = await connectAuthenticated();
    client.send({ id: 2, method: 'listDocuments', params: {} });
    await flush();
    const peer = peerOf(handler.listDocuments) as any;
    client.received.length = 0;

    peer.notify({
      params: { actions: [{ type: 'x' }], path: '/a', from: 'b' },
      method: 'actions',
      sentAt: 1,
    });
    await flush();

    expect(client.received).toEqual([
      { method: 'actions', params: { path: '/a', actions: [{ type: 'x' }] } },
    ]);
  });
});

describe('drain', () => {
  const closed = (path: string) => ({
    method: 'documentClosed' as const,
    params: { path },
  });

  async function peerWithCalls() {
    const connection = await connectAuthenticated();
    connection.client.send({ id: 2, method: 'listDocuments', params: {} });
    await flush();
    connection.client.received.length = 0;
    return {
      ...connection,
      peer: peerOf(handler.listDocuments) as HubConnection,
    };
  }

  it('resolves once the frames queued before it reached the socket, not before', async () => {
    const { client, hold, peer } = await peerWithCalls();
    const release = hold();
    let drained = false;

    peer.notify(closed('/a'));
    peer.notify(closed('/b'));
    const draining = peer.drain().then(() => (drained = true));
    await flush();
    expect(drained).toBe(false);
    expect(client.received).toEqual([]);

    release();
    await draining;
    expect(client.received).toEqual([closed('/a'), closed('/b')]);
  });

  it('resolves at once when every frame is already written', async () => {
    const { peer } = await peerWithCalls();

    await expect(peer.drain()).resolves.toBeUndefined();
  });

  it('counts a frame the socket refused as written, logging it', async () => {
    const { peer, write } = await peerWithCalls();
    write.mockImplementationOnce(() => {
      throw new Error('EPIPE');
    });

    peer.notify(closed('/a'));
    await peer.drain();

    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      'could not write to a peer',
      expect.anything()
    );
  });

  it('resolves for a connection that stopped writing, whatever it still held', async () => {
    const { client, hold, peer } = await peerWithCalls();
    const release = hold();
    peer.notify(closed('/a'));
    const draining = peer.drain();

    client.close();
    release();
    await draining;

    peer.notify(closed('/b'));
    await expect(peer.drain()).resolves.toBeUndefined();
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
});
