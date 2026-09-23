import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as Cause from 'effect/Cause';
import * as Exit from 'effect/Exit';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { emptyDocument } from '@/__test-utils__/documents';
import { createFakeHub } from '@/__test-utils__/fakeHub';
import {
  connectMcp,
  initialize,
  rpcClient,
  serverLayer,
} from '@/__test-utils__/mcp';
import { createMemoryHost } from '@/__test-utils__/memoryHost';
import { serveStdio } from '@/__test-utils__/stdio';
import { SERVER_VERSION } from '@/server';
import { DEFAULT_CLIENT_NAME } from '@/session/manager';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** How long the engine keeps another editor's focused cell without a new beat. */
const FOCUS_EXPIRY_MS = 90_000;

const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
};

describe('the server', () => {
  it('carries the version package.json publishes', () => {
    const manifest = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')
    );
    expect(SERVER_VERSION).toBe(manifest.version);
  });

  it('builds on the node platform unless told otherwise', async () => {
    const mcp = await connectMcp();
    expect(mcp.manager.paths()).toEqual([]);
    await mcp.close();
    await mcp.close();
  });

  it.each([
    ['codex', 'codex'],
    ['', DEFAULT_CLIENT_NAME],
  ])('introduces client %j to the hub as %j', async (clientName, expected) => {
    const io = createMemoryHost();
    io.put('/work/a.erd.json', emptyDocument());
    const hub = createFakeHub(io, { pid: 5656, workspaceFolders: ['/work'] });
    const mcp = await connectMcp({ host: io, clientName });

    await mcp.ok('erd_add_table', { path: '/work/a.erd.json' });
    expect([...hub.connections].map(({ client }) => client)).toEqual([
      expected,
    ]);
    await mcp.close();
    hub.destroy();
  });

  it('serves MCP over stdio and closes every session when stdin ends', async () => {
    const io = createMemoryHost();
    io.put('/work/a.erd.json', emptyDocument());
    const mcp = await connectMcp({ host: io });

    const added = await mcp.ok('erd_add_table', { path: '/work/a.erd.json' });
    expect(added.mode).toBe('headless');
    expect(mcp.manager.paths()).toEqual(['/work/a.erd.json']);

    mcp.stdio.end();
    const exit = await mcp.stdio.exit;

    // The end of stdin interrupts the server and nothing else.
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
      true
    );
    expect(mcp.manager.paths()).toEqual([]);
    await mcp.close();
  });

  it('leaves no tracker expiry behind when stdin ends after another editor sent its focus', async () => {
    const io = createMemoryHost();
    const path = '/work/a.erd.json';
    io.put(path, emptyDocument());
    const hub = createFakeHub(io, { pid: 5757, workspaceFolders: ['/work'] });
    const mcp = await connectMcp({ host: io });

    expect((await mcp.ok('erd_add_table', { path })).mode).toBe('live');

    // The agent's own focus reaches the editor on a 100 ms throttle; let it land first.
    await new Promise(resolve => setTimeout(resolve, 150));
    const set = vi.spyOn(globalThis, 'setTimeout');
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const editorSide = () =>
      Object.values(hub.webview(path).state.editor.sharedFocusTrackerMap).map(
        ({ timeoutId }) => timeoutId
      );
    const expiries = () =>
      set.mock.calls.flatMap(([, ms], index) => {
        const timer = set.mock.results[index].value;
        return ms === FOCUS_EXPIRY_MS && !editorSide().includes(timer)
          ? [timer]
          : [];
      });
    for (const peer of hub.documents.get(path)!.peers) {
      peer.notify({
        method: 'actions',
        params: {
          path,
          actions: [
            {
              type: 'editor.sharedFocusTracker',
              payload: {
                focus: { tableId: 'x', columnId: null, focusType: 'tableName' },
              },
              version: 1,
              tags: 1,
              meta: { editorId: 'vscode-user', nickname: 'user' },
            },
          ],
        },
      });
    }
    await until(() => expiries().length > 0);
    expect(expiries()).toHaveLength(1);
    expect(clear).not.toHaveBeenCalledWith(expiries()[0]);

    await mcp.close();

    expect(mcp.manager.paths()).toEqual([]);
    expect(clear).toHaveBeenCalledWith(expiries()[0]);
    hub.destroy();
  });

  it('skips stdin lines that are not JSON-RPC messages and answers the rest, in the same chunk and after', async () => {
    const mcp = await connectMcp({ host: createMemoryHost() });
    const answered = new Promise<any>(resolve => {
      mcp.stdio.onLine(message => {
        if (message.id === 'same-chunk') resolve(message);
      });
    });

    mcp.stdio.send(
      [
        '',
        '{not json',
        'null',
        '{"jsonrpc":"2.0","method":5}',
        '{"jsonrpc":"2.0","method":"@effect/rpc/Eof"}',
        '{"jsonrpc":"2.0","method":"notifications/x","headers":5}',
        '{"jsonrpc":"2.0","id":"same-chunk","method":"ping"}',
      ].join('\n')
    );

    expect((await answered).result).toEqual({});
    expect((await mcp.request('ping')).result).toEqual({});
    expect((await mcp.listTools()).tools).toHaveLength(59);
    expect(console.error).toHaveBeenCalledWith(
      '[erd-editor-mcp]',
      'skipped a stdin line that is not a JSON-RPC message',
      '{not json'
    );
    await mcp.close();
  });
});

describe('the protocols it speaks (D3)', () => {
  it.each(['2025-06-18', '2025-03-26', '2024-11-05'])(
    'answers %s in kind',
    async version => {
      const mcp = await connectMcp({
        host: createMemoryHost(),
        protocolVersion: version,
      });

      expect(mcp.initialize.result.protocolVersion).toBe(version);
      expect((await mcp.listTools()).tools).toHaveLength(59);
      await mcp.close();
    }
  );

  it('answers a client on a later protocol with 2025-06-18, the newest it lists', async () => {
    const stdio = serveStdio(serverLayer({ host: createMemoryHost() }));
    const response = await initialize(rpcClient(stdio), 'later', '2025-11-25');

    expect(response.result.protocolVersion).toBe('2025-06-18');
    stdio.end();
    await stdio.exit;
  });

  it('answers every request before initialize with -32603, ping included, where 0.1.0 served them', async () => {
    const stdio = serveStdio(serverLayer({ host: createMemoryHost() }));
    const client = rpcClient(stdio);

    const early = [
      await client.request('ping'),
      await client.request('tools/list'),
    ];
    const response = await initialize(client);

    expect(early.map(({ error }) => error)).toEqual([
      expect.objectContaining({ code: -32603, message: 'Internal error' }),
      expect.objectContaining({ code: -32603, message: 'Internal error' }),
    ]);
    expect(console.error).not.toHaveBeenCalled();
    expect(response.result.capabilities).toEqual({
      logging: {},
      tools: { listChanged: true },
      completions: {},
    });
    expect((await client.request('ping')).result).toEqual({});
    stdio.end();
    await stdio.exit;
  });

  it('drops structured content and result schemas for a client before 2025-06-18', async () => {
    const io = createMemoryHost();
    io.put('/work/a.erd.json', emptyDocument());
    const mcp = await connectMcp({ host: io, protocolVersion: '2025-03-26' });

    const { tools } = await mcp.listTools();
    const added = await mcp.call('erd_add_table', { path: '/work/a.erd.json' });

    expect(tools.filter(tool => 'outputSchema' in tool)).toEqual([]);
    expect(added.structured).toBeUndefined();
    expect(added.json.tool).toBe('erd_add_table');
    await mcp.close();
  });
});
