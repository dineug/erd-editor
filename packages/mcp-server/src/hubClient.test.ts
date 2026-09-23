import { HUB_PROTOCOL_VERSION, pipePath } from '@dineug/erd-editor-agent-hub';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { settle } from '@/__test-utils__/mcp';
import {
  createMemoryIo,
  createSocketPair,
  type ServerSocket,
} from '@/__test-utils__/memoryIo';
import { connectHub, createHubClient, REQUEST_TIMEOUT_MS } from '@/hubClient';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A client over a socket pair whose hub end the spec drives by hand. */
function pair(
  options: Parameters<typeof createHubClient>[2] = { client: 'c' }
) {
  const [client, hub] = createSocketPair();
  const sent: any[] = [];
  hub.onData(chunk => {
    for (const line of chunk.split('\n').filter(Boolean))
      sent.push(JSON.parse(line));
  });
  return { hub, sent, client: createHubClient(client, 7, options) };
}

describe('the hub client', () => {
  it('waits thirty seconds for an answer by default', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(30_000);
  });

  it('matches responses to requests by id and hands notifications on', async () => {
    const onNotification = vi.fn();
    const { hub, sent, client } = pair({ client: 'c', onNotification });

    const leave = client.request('leave', { path: '/a.erd.json' });
    const save = client.request('save', { path: '/a.erd.json' });
    await settle();
    hub.write(
      `${JSON.stringify({ id: sent[1].id, ok: true, method: 'save', result: { saved: true } })}\n`
    );
    hub.write(
      `${JSON.stringify({ id: sent[0].id, ok: true, method: 'leave', result: {} })}\n`
    );
    hub.write(
      `${JSON.stringify({ method: 'documentClosed', params: { path: '/a.erd.json' } })}\n`
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
    ['after', ['joined', 'notification']],
    ['before', ['notification', 'joined']],
  ])(
    'runs the code awaiting a response and a notification %s it in one chunk in stream order',
    async (position, expected) => {
      const order: string[] = [];
      const { hub, sent, client } = pair({
        client: 'c',
        onNotification: () => order.push('notification'),
      });
      const joined = client
        .request('join', { path: '/a.erd.json' })
        .then(() => order.push('joined'));
      await settle();

      const response = JSON.stringify({
        id: sent[0].id,
        ok: true,
        method: 'join',
        result: { initialValue: '{}', snapshotVersion: 3, readonly: false },
      });
      const notification = JSON.stringify({
        method: 'actions',
        params: { path: '/a.erd.json', actions: [] },
      });
      hub.write(
        position === 'after'
          ? `${response}\n${notification}\n`
          : `${notification}\n${response}\n`
      );
      await joined;
      await settle();

      expect(order).toEqual(expected);
    }
  );

  it('ignores frames it cannot place: unknown ids, non objects, notifications without params', async () => {
    const onNotification = vi.fn();
    const { hub, client } = pair({ client: 'c', onNotification });

    hub.write('{"id":99,"ok":true,"result":{}}\n[1,2]\n{"method":"actions"}\n');
    await settle();

    expect(onNotification).not.toHaveBeenCalled();
    expect(client.closed).toBe(false);
  });

  it('turns an error response into a SessionError, filling in what the hub left out', async () => {
    const { hub, sent, client } = pair();

    const refused = client.request('join', { path: '/a.erd.json' });
    await settle();
    hub.write(
      `${JSON.stringify({ id: sent[0].id, ok: false, method: 'join', error: 'nope' })}\n`
    );

    await expect(refused).rejects.toMatchObject({
      name: 'SessionError',
      code: 'internal',
      message: 'The hub refused join',
    });
  });

  it.each([42, { x: 1 }, null])(
    'refuses as internal an error response whose code is %j, and stays open',
    async code => {
      const { hub, sent, client } = pair();

      const refused = client.request('listDocuments', {});
      await settle();
      hub.write(
        `${JSON.stringify({ id: sent[0].id, ok: false, error: { code, message: 'bad code' } })}\n`
      );

      await expect(refused).rejects.toMatchObject({
        name: 'SessionError',
        code: 'internal',
        message: 'bad code',
      });
      expect(client.closed).toBe(false);
    }
  );

  it('times out a request nobody answers', async () => {
    const { client } = pair({ client: 'c', requestTimeoutMs: 5 });

    await expect(client.request('listDocuments', {})).rejects.toMatchObject({
      code: 'timeout',
    });
  });

  it('closes on a frame out of step, failing what is pending', async () => {
    const onClose = vi.fn();
    const { hub, client } = pair({ client: 'c', onClose });

    const pending = client.request('listDocuments', {});
    hub.write('not json\n');

    await expect(pending).rejects.toMatchObject({ code: 'disconnected' });
    expect(client.closed).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    await expect(client.request('listDocuments', {})).rejects.toMatchObject({
      code: 'disconnected',
    });
  });

  it('closes once, whether it or the hub hangs up first', async () => {
    const onClose = vi.fn();
    const { hub, client } = pair({ client: 'c', onClose });

    client.close();
    client.close();
    hub.end();
    await settle();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('connectHub', () => {
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

  it('says hello with the lock token, the protocol and the client name', async () => {
    const io = createMemoryIo();
    let hello: any;
    io.servers.set(candidate().record.pipe, (socket: ServerSocket) => {
      socket.onData(chunk => {
        hello = JSON.parse(chunk);
        socket.write(
          `${JSON.stringify({ id: hello.id, ok: true, method: 'hello', result: { protocolVersion: HUB_PROTOCOL_VERSION, ide: 'vscode', version: '2.9.0' } })}\n`
        );
      });
    });

    const client = await connectHub(io, candidate(), { client: 'claude-code' });

    expect(hello).toMatchObject({
      method: 'hello',
      params: {
        token: 'secret',
        protocolVersion: HUB_PROTOCOL_VERSION,
        client: 'claude-code',
      },
    });
    expect(client.pid).toBe(11);
    client.close();
  });

  it('refuses a hello answered in another protocol and closes the connection', async () => {
    const io = createMemoryIo();
    io.servers.set(candidate().record.pipe, (socket: ServerSocket) => {
      socket.onData(chunk => {
        const { id } = JSON.parse(chunk);
        socket.write(
          `${JSON.stringify({ id, ok: true, method: 'hello', result: { protocolVersion: HUB_PROTOCOL_VERSION + 1, ide: 'vscode', version: '9' } })}\n`
        );
      });
    });

    await expect(
      connectHub(io, candidate(), { client: 'c' })
    ).rejects.toMatchObject({ code: 'protocolMismatch' });
  });

  it('refuses a lock from another protocol without connecting', async () => {
    const io = createMemoryIo();
    const connect = vi.spyOn(io, 'connect');

    await expect(
      connectHub(io, candidate(HUB_PROTOCOL_VERSION + 1), { client: 'c' })
    ).rejects.toMatchObject({ code: 'protocolMismatch' });
    expect(connect).not.toHaveBeenCalled();
  });

  it('reports a string rejection from connect too', async () => {
    const io = createMemoryIo();
    io.connect = () => Promise.reject('refused');

    await expect(
      connectHub(io, candidate(), { client: 'c' })
    ).rejects.toMatchObject({
      code: 'hubUnreachable',
      message: expect.stringContaining('(refused)'),
    });
  });
});
