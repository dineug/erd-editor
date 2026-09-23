import { HUB_PROTOCOL_VERSION, pipePath } from '@dineug/erd-editor-agent-hub';
import { Effect } from 'effect';
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
import { connectMcp, type McpHarness, settle } from '@/__test-utils__/mcp';
import { createMemoryHost, type MemoryHost } from '@/__test-utils__/memoryHost';
import { IDLE_TTL_MS } from '@/session/manager';

const A = '/work/a.erd.json';
const B = '/work/b.erd.json';

let io: MemoryHost;
let mcp: McpHarness;

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryHost();
  io.put(A, emptyDocument());
  io.put(B, emptyDocument());
  mcp = await connectMcp({ host: io, testClock: true });
});

afterEach(async () => {
  await mcp.close();
  vi.restoreAllMocks();
});

describe('the session manager', () => {
  it('runs parallel calls on one document one at a time', async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () => mcp.call('erd_add_table', { path: A }))
    );

    expect(results.every(({ isError }) => !isError)).toBe(true);
    expect(JSON.parse(io.read(A)).doc.tableIds).toHaveLength(4);
  });

  it('runs the calls on one document in the order they arrived, a read after the edits sent before it', async () => {
    const kinds = [...'WRWWRWWRWR'];
    const results = await Promise.all(
      kinds.map(kind =>
        kind === 'W'
          ? mcp.call('erd_add_table', { path: A })
          : mcp.call('erd_read', { path: A, format: 'json' })
      )
    );

    const seen = results.flatMap(({ json }, index) =>
      kinds[index] === 'R' ? [json.doc.tableIds.length] : []
    );
    expect(seen).toEqual([1, 3, 5, 6]);
  });

  it('queues a call behind an earlier one whose path took longer to resolve', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    let held!: () => void;
    const holding = new Promise<void>(resolve => (held = resolve));
    const realPath = io.calls.realPath;
    io.calls.realPath = path => {
      io.calls.realPath = realPath;
      held();
      return Effect.promise(() => gate).pipe(Effect.andThen(realPath(path)));
    };

    const write = mcp.call('erd_add_table', { path: A });
    await holding;
    const read = mcp.call('erd_read', { path: A, format: 'json' });
    await settle(20);
    release();

    expect((await write).isError).toBe(false);
    expect((await read).json.doc.tableIds).toHaveLength(1);
  });

  it('lets later calls through while a listing runs', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const readDirectory = io.calls.readDirectory;
    io.calls.readDirectory = path => {
      io.calls.readDirectory = readDirectory;
      return Effect.promise(() => gate).pipe(
        Effect.andThen(readDirectory(path))
      );
    };

    const listing = mcp.call('erd_list_documents', {});
    expect((await mcp.call('erd_add_table', { path: A })).isError).toBe(false);
    release();

    expect((await listing).json.documents).toHaveLength(2);
  });

  it('keeps running after a call on the same document failed', async () => {
    const [bad, good] = await Promise.all([
      mcp.call('erd_change_table_name', {
        path: A,
        tableId: 'none',
        value: 'x',
      }),
      mcp.call('erd_add_table', { path: A }),
    ]);

    expect(bad.json.error.code).toBe('notFound');
    expect(good.isError).toBe(false);
  });

  it('holds a second call on a document until the first is done, and lets another document through', async () => {
    await mcp.ok('erd_add_table', { path: A });
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    let held!: () => void;
    const holding = new Promise<void>(resolve => (held = resolve));
    const stat = io.calls.stat;
    let statsOfA = 0;
    io.calls.stat = path => {
      if (path !== A) return stat(path);
      if (++statsOfA > 1) return stat(path);
      held();
      return Effect.promise(() => gate).pipe(Effect.andThen(stat(path)));
    };

    const first = mcp.call('erd_add_memo', { path: A });
    await holding;
    const second = mcp.call('erd_add_memo', { path: A });
    expect((await mcp.call('erd_add_table', { path: B })).isError).toBe(false);
    expect(statsOfA).toBe(1);

    release();
    expect((await first).isError).toBe(false);
    expect((await second).isError).toBe(false);
    expect(JSON.parse(io.read(A)).doc.memoIds).toHaveLength(2);
  });

  it('never sweeps a document while a call on it runs', async () => {
    await mcp.ok('erd_add_table', { path: A });
    // Short of the limit, so the sweep the call itself starts with keeps A.
    await mcp.adjust(IDLE_TTL_MS - 1);

    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    let held!: () => void;
    const holding = new Promise<void>(resolve => (held = resolve));
    const stat = io.calls.stat;
    io.calls.stat = path => {
      if (path !== A) return stat(path);
      io.calls.stat = stat;
      held();
      return Effect.promise(() => gate).pipe(Effect.andThen(stat(path)));
    };

    const slow = mcp.call('erd_add_memo', { path: A });
    await holding;
    await mcp.adjust(2);
    expect(await mcp.manager.sweep()).toEqual([]);
    release();

    expect((await slow).isError).toBe(false);
    expect(mcp.manager.paths()).toEqual([A]);
  });

  it('closes every session on closeAll', async () => {
    await mcp.ok('erd_add_table', { path: A });
    await mcp.ok('erd_add_table', { path: B });

    await mcp.manager.closeAll();
    expect(mcp.manager.paths()).toEqual([]);
  });
});

describe('a call once it holds its document', () => {
  /** Sends a tools/call without waiting for it, so the spec can cancel it. */
  const start = (id: number, name: string, args: Record<string, unknown>) =>
    mcp.stdio.send({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name, arguments: args },
    });

  const until = async (ready: () => boolean) => {
    for (let tries = 0; tries < 200 && !ready(); tries++) await settle(2);
    expect(ready()).toBe(true);
  };

  const temps = () =>
    [...io.files.keys()].filter(path => path.endsWith('.tmp'));

  it('writes the file to its end though the client cancelled it', async () => {
    await mcp.ok('erd_open_document', { path: A });
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const rename = io.calls.rename;
    let renaming = false;
    io.calls.rename = (from, to) => {
      io.calls.rename = rename;
      renaming = true;
      return Effect.promise(() => gate).pipe(Effect.andThen(rename(from, to)));
    };

    const answers: unknown[] = [];
    mcp.stdio.onLine(message => {
      if (message.id === 900) answers.push(message);
    });
    start(900, 'erd_add_table', { path: A });
    await until(() => renaming);
    mcp.notify('notifications/cancelled', { requestId: 900, reason: 'user' });
    await settle(20);
    release();
    await settle(20);

    expect(JSON.parse(io.read(A)).doc.tableIds).toHaveLength(1);
    expect(temps()).toEqual([]);
    expect(answers).toEqual([]);
    const memo = await mcp.ok('erd_add_memo', { path: A });
    expect(memo.notes).toBeUndefined();
    expect(JSON.parse(io.read(A)).doc.memoIds).toEqual(memo.createdIds);
  });

  it('hears the editor refuse an edit though the client cancelled the call, so the next read reseeds', async () => {
    const hub = createFakeHub(io, { pid: 4545, workspaceFolders: ['/work'] });
    await mcp.ok('erd_add_table', { path: A });
    let release!: () => void;
    hub.beforeApply = actions => {
      if (!actions.some((action: any) => action.type === 'memo.add')) return;
      hub.beforeApply = null;
      hub.hold = new Promise<void>(resolve => (release = resolve));
      throw { code: 'internal', message: 'the relay failed' };
    };

    start(901, 'erd_add_memo', { path: A });
    await until(() => hub.hold !== null);
    mcp.notify('notifications/cancelled', { requestId: 901, reason: 'user' });
    await settle(20);
    hub.hold = null;
    release();
    await settle(20);

    const joins = hub.methods().filter(method => method === 'join').length;
    const snapshot = JSON.parse(
      await mcp.text('erd_read', { path: A, format: 'snapshot' })
    );
    expect(snapshot.memos).toEqual([]);
    expect(hub.webview(A).state.doc.memoIds).toEqual([]);
    expect(hub.methods().filter(method => method === 'join')).toHaveLength(
      joins + 1
    );
    hub.destroy();
  });

  it.each([
    ['stdin ends', 'one batch', 0],
    ['stdin ends', 'a second batch queued behind it', 150],
    ['a signal comes', 'a second batch queued behind it', 150],
  ])(
    'ends a call in flight when %s, its first batch unanswered and %s, by closing its session first',
    async (stop, _batches, wait) => {
      const hub = createFakeHub(io, {
        pid: 4545,
        workspaceFolders: ['/work'],
      });
      await mcp.ok('erd_add_table', { path: A });
      // Past the 100 ms a peer holds a focus back, the call queues a focus batch behind its edit.
      await settle(wait);
      hub.beforeApply = () => {
        hub.hold = new Promise<void>(() => undefined);
      };

      start(902, 'erd_add_memo', { path: A });
      await until(() => hub.hold !== null);
      await settle();
      // The hub never answers, and the server's clock is TestClock, so no timeout ends the call.
      if (stop === 'stdin ends') await mcp.close();
      else {
        mcp.stdio.interrupt();
        await mcp.stdio.exit;
      }

      expect(hub.connections.size).toBe(0);
      hub.destroy();
    }
  );

  it('refuses as internal, in the words of the throw, a hub answer the session cannot read', async () => {
    const pid = 4646;
    const pipe = pipePath(io.home, pid, io.platform);
    io.alive.add(pid);
    io.writeLock(pid, {
      pipe,
      workspaceFolders: ['/work'],
      documents: [],
      ide: 'vscode',
      version: '2.9.0',
      protocolVersion: HUB_PROTOCOL_VERSION,
      token: 'token',
      hub: true,
    });
    // Answers hello and openDocument, and every other request with a null result.
    io.servers.set(pipe, socket =>
      socket.onData(chunk => {
        for (const line of chunk.split('\n').filter(Boolean)) {
          const { id, method } = JSON.parse(line);
          const result =
            method === 'hello'
              ? {
                  protocolVersion: HUB_PROTOCOL_VERSION,
                  ide: 'vscode',
                  version: '2.9.0',
                }
              : method === 'openDocument'
                ? { path: A, opened: false, webviews: 1 }
                : null;
          socket.write(`${JSON.stringify({ id, ok: true, method, result })}\n`);
        }
      })
    );

    const write = await mcp.call('erd_add_table', { path: A });
    const read = await mcp.call('erd_read', { path: A, format: 'snapshot' });
    const list = await mcp.call('erd_list_documents', {});

    for (const refused of [write, read]) {
      expect(refused.isError).toBe(true);
      expect(refused.json).toEqual({
        error: {
          code: 'internal',
          message: "Cannot read properties of null (reading 'initialValue')",
        },
      });
    }
    expect(list.isError).toBe(true);
    expect(list.json).toEqual({
      error: {
        code: 'internal',
        message: expect.stringMatching(
          /^Cannot destructure property 'documents' of .+ as it is null\.$/
        ),
      },
    });
  });
});
