import { createPeerStore, type PeerStore } from '@dineug/erd-editor/peer.js';
import { type HubNotification } from '@dineug/erd-editor-agent-hub';
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
  documentFromSql,
  emptyDocument,
  SHOP_SQL,
  tableNamed,
} from '@/__test-utils__/documents';
import { createFakeHub, type FakeHub } from '@/__test-utils__/fakeHub';
import { comparable, settle } from '@/__test-utils__/mcp';
import { createMemoryHost, type MemoryHost } from '@/__test-utils__/memoryHost';
import {
  type LiveSession,
  makeLiveSession,
  REJOIN_NOTE,
  RESEED_NOTE,
} from '@/session/live';
import { BatchInterrupted, runBatch } from '@/tools/batch';
import {
  documentReader,
  entityReader,
  listReader,
  readDocument,
} from '@/tools/read';
import { runTool } from '@/tools/run';

vi.mock('@/tools/batch', async importOriginal => {
  const actual = await importOriginal<typeof import('@/tools/batch')>();
  return { ...actual, runBatch: vi.fn(actual.runBatch) };
});

const DOCUMENT = '/work/live.erd.json';

let io: MemoryHost;
let hub: FakeHub;
let session: LiveSession;

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryHost();
  io.put(DOCUMENT, emptyDocument());
  hub = createFakeHub(io, { pid: 4545, workspaceFolders: ['/work'] });
  session = await io.run(
    makeLiveSession({
      path: DOCUMENT,
      candidate: { pid: hub.pid, record: hub.lock(), mtimeMs: 1 },
      nickname: 'agent',
      client: 'agent',
    })
  );
});

afterEach(async () => {
  await io.run(session.close);
  hub.destroy();
  vi.restoreAllMocks();
});

const call = (name: string, args: Record<string, unknown> = {}) =>
  io.run(session.runTool(name, args));
const snapshotOf = (store: PeerStore) =>
  JSON.parse(readDocument(store.state, 'snapshot'));
const read = (format: 'snapshot' | 'json') =>
  io.run(session.read(documentReader(format)));

describe('a live session beyond the transition table', () => {
  it('starts reconnecting, unjoined, with no connection', () => {
    expect(session).toMatchObject({
      mode: 'live',
      state: 'reconnecting',
      connected: false,
      pid: hub.pid,
    });
  });

  it('joins again and runs the call once more when the hub forgot this agent', async () => {
    await call('erd_add_table');
    hub.documents.get(DOCUMENT)!.peers.clear();

    const { run, notes } = await call('erd_add_memo');

    expect(notes).toEqual([REJOIN_NOTE, RESEED_NOTE]);
    expect(hub.webview(DOCUMENT).state.doc.memoIds).toEqual(run.createdIds);
  });

  it('takes the clock of edits the user made before it joined, so its edit to the same field wins', async () => {
    io.put(DOCUMENT, documentFromSql(SHOP_SQL));
    const { webview } = hub.open(DOCUMENT);
    const users = tableNamed(
      JSON.parse(readDocument(webview.state, 'snapshot')),
      'users'
    );
    for (let i = 0; i < 30; i++) {
      runTool(webview, 'erd_change_table_name', {
        tableId: users.id,
        value: `user_${i}`,
      });
    }
    await settle();
    expect(hub.documents.get(DOCUMENT)!.observedVersion).toBeGreaterThan(30);

    await call('erd_change_table_name', {
      tableId: users.id,
      value: 'members',
    });
    await settle();

    const shown = JSON.parse(readDocument(webview.state, 'snapshot'));
    expect(tableNamed(shown, 'members').id).toBe(users.id);
    expect(comparable((await read('json')).text)).toEqual(
      comparable(webview.value)
    );
  });

  it('lists and gets from the editor the document it joined', async () => {
    io.put(DOCUMENT, documentFromSql(SHOP_SQL));
    const { webview } = hub.open(DOCUMENT);
    const users = tableNamed(
      JSON.parse(readDocument(webview.state, 'snapshot')),
      'users'
    );

    const list = JSON.parse((await io.run(session.read(listReader))).text);
    expect(list.tables.map(({ name }: { name: string }) => name)).toEqual(
      JSON.parse(readDocument(webview.state, 'snapshot')).tables.map(
        ({ name }: { name: string }) => name
      )
    );
    const got = JSON.parse(
      (await io.run(session.read(entityReader({ tableIds: [users.id] })))).text
    );
    expect(got.tables[0]).toMatchObject({
      id: users.id,
      name: 'users',
      columns: users.columns,
    });
  });

  describe('the order of a join answer and what came with it', () => {
    /** A table the user added after the snapshot, as actions the hub relays. */
    function addedAfterSnapshot() {
      const user = createPeerStore({ nickname: 'user', presence: false });
      try {
        user.setInitialValue(io.read(DOCUMENT));
        const { actions, createdIds } = runTool(user, 'erd_add_table', {});
        return { actions, tableId: createdIds[0] };
      } finally {
        user.destroy();
      }
    }

    /** Relays the actions in the chunk that answers the next join. */
    function relayWithJoin(actions: unknown[]) {
      hub.sameChunk = (method, path) => {
        if (method !== 'join' || !path) return [];
        hub.sameChunk = null;
        return [{ method: 'actions', params: { path, actions } }];
      };
    }

    it('lets a write see the actions relayed with its join', async () => {
      const { actions, tableId } = addedAfterSnapshot();
      relayWithJoin(actions);

      const { run } = await call('erd_change_table_name', {
        tableId,
        value: 'orders',
      });

      expect(run.historyEntries).toBe(1);
      expect(
        tableNamed(JSON.parse((await read('snapshot')).text), 'orders').id
      ).toBe(tableId);
    });

    it('lets a read see the actions relayed with its join', async () => {
      const { actions, tableId } = addedAfterSnapshot();
      relayWithJoin(actions);

      const snapshot = JSON.parse((await read('snapshot')).text);

      expect(snapshot.tables.map(({ id }: { id: string }) => id)).toEqual([
        tableId,
      ]);
    });

    it('sends the focus a reseed moved before the edit of the call that reseeded', async () => {
      await call('erd_add_table');
      // Past the 100 ms a peer holds a focus back after the last one it sent.
      await settle(150);
      hub.disconnectAll();
      await settle();
      const batches: Array<Array<Record<string, any>>> = [];
      hub.beforeApply = actions => void batches.push(actions as any[]);

      await call('erd_add_memo');

      const focus = batches.findIndex(batch =>
        batch.some(
          action =>
            action.type === 'editor.sharedFocusTracker' &&
            action.payload.focus === null
        )
      );
      const memo = batches.findIndex(batch =>
        batch.some(action => action.type === 'memo.add')
      );
      expect(focus).toBeGreaterThanOrEqual(0);
      expect(focus).toBeLessThan(memo);
      expect(batches[memo][0].version).toBeGreaterThan(
        batches[focus][0].version
      );
    });
  });

  describe('the order of any other answer and what came with it', () => {
    /** Adds notifications to the chunk that answers the next request with, when chosen. */
    function relayWith(
      pick: (method: string) => boolean,
      notification: (path: string) => HubNotification
    ) {
      hub.sameChunk = (method, path) => {
        if (!pick(method) || !path) return [];
        hub.sameChunk = null;
        return [notification(path)];
      };
    }

    it('lets a write see the actions relayed with its openDocument answer, so its edit wins', async () => {
      const { run } = await call('erd_add_table');
      const [tableId] = run.createdIds;
      await settle();
      // A user's rename, stamped well above the clock this agent has seen, as a webview relays it.
      // Its getLWW stays out: the webview would answer it, telling this agent the clock first.
      const user = createPeerStore({ nickname: 'user', presence: false });
      user.setInitialValue(hub.webview(DOCUMENT).value);
      user.mergeClock(hub.documents.get(DOCUMENT)!.observedVersion + 20);
      const actions: Array<{ type: string }> = [];
      user.subscribe(batch =>
        actions.push(...batch.filter(({ type }) => type === 'table.changeName'))
      );
      runTool(user, 'erd_change_table_name', { tableId, value: 'by_user' });
      await settle();
      user.destroy();
      expect(actions).toHaveLength(1);
      hub.webview(DOCUMENT).receive(actions as any[]);
      expect(tableNamed(snapshotOf(hub.webview(DOCUMENT)), 'by_user').id).toBe(
        tableId
      );
      relayWith(
        method => method === 'openDocument',
        path => ({ method: 'actions', params: { path, actions } })
      );

      await call('erd_change_table_name', { tableId, value: 'by_agent' });
      await settle();

      expect(tableNamed(snapshotOf(hub.webview(DOCUMENT)), 'by_agent').id).toBe(
        tableId
      );
    });

    it('applies a documentClosed read with its openDocument answer before its edit: nothing goes out on the join the editor dropped, and the next call joins again', async () => {
      await call('erd_add_table');
      await settle();
      relayWith(
        method => method === 'openDocument',
        path => ({ method: 'documentClosed', params: { path } })
      );
      const before = hub.methods().length;

      await call('erd_add_memo');
      await settle();

      expect(hub.methods().slice(before)).toEqual(['openDocument']);
      expect(session.state).toBe('reconnecting');
      expect(hub.webview(DOCUMENT).state.doc.memoIds).toEqual([]);
      await read('snapshot');
      expect(hub.methods().slice(before)).toEqual(['openDocument', 'join']);
    });

    it('hears a documentClosed read with the answer to its last batch before it counts its edit', async () => {
      let focusBatch = false;
      hub.beforeApply = actions => {
        focusBatch = actions.some(
          (action: any) => action.type === 'editor.sharedFocusTracker'
        );
      };
      relayWith(
        method => method === 'applyActions' && focusBatch,
        path => ({ method: 'documentClosed', params: { path } })
      );

      await call('erd_add_table');
      expect(hub.sameChunk).toBeNull();

      // The edit came after the close in stream order, so no CLOSED_NOTE follows it.
      expect((await call('erd_add_memo')).notes).toEqual([RESEED_NOTE]);
    });
  });

  it('ends a call whose batches wait behind an unanswered one when the session closes', async () => {
    await call('erd_add_table');
    // Past the 100 ms a peer holds a focus back, so the next call queues a focus batch behind its edit.
    await settle(150);
    hub.beforeApply = () => {
      hub.hold = new Promise<void>(() => undefined);
    };

    const pending = call('erd_add_memo');
    for (let tries = 0; tries < 100 && hub.hold === null; tries++) {
      await settle(2);
    }
    await settle();
    expect(hub.methods().filter(method => method === 'applyActions')).toEqual([
      'applyActions',
      'applyActions',
      'applyActions',
      'applyActions',
    ]);

    await io.run(session.close);

    await expect(pending).rejects.toMatchObject({ code: 'disconnected' });
  });

  it('lets go of each connection the hub hung up on', async () => {
    let open = 0;
    const dial = io.connect;
    io.connect = pipe =>
      dial(pipe).pipe(
        Effect.tap(() =>
          Effect.andThen(
            Effect.sync(() => void open++),
            Effect.addFinalizer(() => Effect.sync(() => void open--))
          )
        )
      );

    const counts: number[] = [];
    for (let round = 0; round < 3; round++) {
      await call('erd_add_table');
      counts.push(open);
      hub.disconnectAll();
      await settle();
      counts.push(open);
    }

    expect(counts).toEqual([1, 0, 1, 0, 1, 0]);
  });

  it('shows the cell it works on to the editor, and only that one', async () => {
    const focused = hub.applied(
      action =>
        action.type === 'editor.sharedFocusTracker' &&
        action.payload.focus?.focusType === 'tableName'
    );
    const { run } = await call('erd_add_table');
    const [tableId] = run.createdIds;

    await call('erd_change_table_name', { tableId, value: 'users' });
    await focused;

    expect(
      Object.values(hub.webview(DOCUMENT).state.editor.sharedFocusTrackerMap)
    ).toMatchObject([{ tableId, focusType: 'tableName' }]);
  });

  it('refuses edits to a document the editor holds read-only', async () => {
    hub.readonlyPaths.add(DOCUMENT);

    await expect(call('erd_add_table')).rejects.toMatchObject({
      name: 'PeerStoreError',
      code: 'readonly',
    });
    expect(session.state).toBe('ready');
    // The join handshake went out outside any call; its refusal is only logged.
    await settle();
    expect(console.error).toHaveBeenCalledWith(
      '[erd-editor-mcp]',
      `a batch for ${DOCUMENT} did not reach the editor`,
      expect.objectContaining({ code: 'readonly' })
    );
  });

  it('fails a call whose batch did not reach the editor, and joins again next time', async () => {
    await call('erd_add_table');
    hub.documents.get(DOCUMENT)!.readonly = true;

    await expect(call('erd_add_memo')).rejects.toMatchObject({
      name: 'SessionError',
      code: 'readonly',
    });
    hub.documents.get(DOCUMENT)!.readonly = false;

    hub.disconnectAll();
    await settle();
    const { notes } = await call('erd_add_memo');
    expect(notes).toEqual([RESEED_NOTE]);
  });

  it('drops an edit the editor refused: the next read reseeds from the editor', async () => {
    await call('erd_add_table');
    hub.beforeApply = () => {
      hub.beforeApply = null;
      throw { code: 'internal', message: 'the relay failed' };
    };

    await expect(call('erd_add_memo')).rejects.toMatchObject({
      code: 'internal',
    });
    expect(session.state).toBe('reconnecting');

    const joins = hub.methods().filter(method => method === 'join').length;
    const snapshot = JSON.parse((await read('snapshot')).text);
    expect(snapshot.memos).toEqual([]);
    expect(snapshot.tables).toHaveLength(1);
    expect(hub.methods().filter(method => method === 'join')).toHaveLength(
      joins + 1
    );
  });

  it('drops an edit refused as read-only in the editor, and holds the flag the join reports', async () => {
    await call('erd_add_table');
    hub.documents.get(DOCUMENT)!.readonly = true;

    await expect(call('erd_add_memo')).rejects.toMatchObject({
      name: 'SessionError',
      code: 'readonly',
    });
    expect(session.state).toBe('reconnecting');

    expect(JSON.parse((await read('snapshot')).text).memos).toEqual([]);
    await expect(call('erd_add_memo')).rejects.toMatchObject({
      name: 'PeerStoreError',
      code: 'readonly',
    });
    expect(hub.webview(DOCUMENT).state.doc.memoIds).toEqual([]);
  });

  it('drops an undo the editor refused: the next read still shows the edit', async () => {
    const { run } = await call('erd_add_table');
    hub.beforeApply = () => {
      hub.beforeApply = null;
      throw { code: 'internal', message: 'the relay failed' };
    };

    await expect(io.run(session.undo)).rejects.toMatchObject({
      code: 'internal',
    });
    expect(session.state).toBe('reconnecting');
    expect(
      JSON.parse((await read('snapshot')).text).tables.map(
        ({ id }: { id: string }) => id
      )
    ).toEqual(run.createdIds);
  });

  it('adds no reseed note when no edit of its own came before', async () => {
    expect((await read('snapshot')).notes).toEqual([]);
    hub.disconnectAll();
    await settle();

    expect((await read('snapshot')).notes).toEqual([]);
    expect(hub.methods()).toEqual(['join', 'join']);
  });

  it('refuses a document the hub answered from disk that the engine cannot read', async () => {
    const conflicted = `<<<<<<< HEAD\n${emptyDocument()}\n=======\n${emptyDocument()}\n>>>>>>> theirs\n`;
    io.put(DOCUMENT, conflicted);

    await expect(read('snapshot')).rejects.toMatchObject({
      code: 'invalidDocument',
      message: expect.stringContaining(`${DOCUMENT} is not valid JSON`),
    });
    expect(session.state).toBe('reconnecting');
    expect(io.read(DOCUMENT)).toBe(conflicted);
  });

  it('undoes and redoes its own edit through the editor', async () => {
    const { run } = await call('erd_add_table');

    expect((await io.run(session.undo)).result.label).toBe('erd_add_table');
    expect(hub.webview(DOCUMENT).state.doc.tableIds).toEqual([]);
    expect((await io.run(session.redo)).result.label).toBe('erd_add_table');
    expect(hub.webview(DOCUMENT).state.doc.tableIds).toEqual(run.createdIds);
  });

  it('runs a batch into the editor as one edit, which one undo reverts there', async () => {
    const batches: Array<Array<{ type: string }>> = [];
    hub.beforeApply = actions => void batches.push(actions as any[]);
    const { run } = await io.run(
      session.runBatch([
        { tool: 'erd_add_table', as: 't' },
        {
          tool: 'erd_change_table_name',
          args: { tableId: '$t', value: 'reviews' },
        },
        { tool: 'erd_add_column', args: { tableId: '$t' } },
      ])
    );
    const webview = hub.webview(DOCUMENT);
    const [tableId, columnId] = run.createdIds;
    // Three dispatches, one request: the editor takes the batch whole. The
    // focus each operation moved follows on its own, and changes nothing.
    const changing = batches.filter(batch =>
      batch.some(({ type }) => !type.startsWith('editor.'))
    );
    expect(changing).toHaveLength(1);
    expect(changing[0].map(({ type }) => type)).toEqual(
      expect.arrayContaining(['table.add', 'table.changeName', 'column.add'])
    );

    expect(webview.state.doc.tableIds).toEqual([tableId]);
    expect(webview.state.collections.tableEntities[tableId]).toMatchObject({
      name: 'reviews',
      columnIds: [columnId],
    });
    expect((await io.run(session.undo)).result).toMatchObject({
      label: 'erd_batch',
      entries: 3,
    });
    expect(webview.state.doc.tableIds).toEqual([]);
  });

  it('sends nothing of a batch the editor refuses, and joins again next time', async () => {
    await call('erd_add_table');
    const shown = comparable(hub.webview(DOCUMENT).value);
    hub.documents.get(DOCUMENT)!.readonly = true;

    await expect(
      io.run(
        session.runBatch([
          { tool: 'erd_add_memo' },
          { tool: 'erd_add_table', as: 't' },
          {
            tool: 'erd_change_table_name',
            args: { tableId: '$t', value: 'x' },
          },
        ])
      )
    ).rejects.toMatchObject({ name: 'SessionError', code: 'readonly' });
    hub.documents.get(DOCUMENT)!.readonly = false;
    await settle();

    expect(comparable(hub.webview(DOCUMENT).value)).toEqual(shown);
    const { notes } = await call('erd_add_memo');
    expect(notes).toEqual([RESEED_NOTE]);
  });

  it('keeps nothing of a batch cut short on the peer, and reseeds from the editor', async () => {
    await call('erd_add_table');
    const shown = comparable(hub.webview(DOCUMENT).value);
    vi.mocked(runBatch).mockImplementationOnce(peer => {
      runTool(peer, 'erd_add_memo', {});
      throw new BatchInterrupted(new Error('boom'));
    });

    await expect(
      io.run(session.runBatch([{ tool: 'erd_add_memo' }]))
    ).rejects.toBeInstanceOf(BatchInterrupted);
    await settle();

    expect(comparable(hub.webview(DOCUMENT).value)).toEqual(shown);
    const { text, notes } = await read('json');
    expect(comparable(text)).toEqual(shown);
    expect(notes).toEqual([RESEED_NOTE]);
  });

  it('refuses a batch before any of it reaches the editor', async () => {
    await call('erd_add_table');
    const shown = comparable(hub.webview(DOCUMENT).value);

    await expect(
      io.run(
        session.runBatch([
          { tool: 'erd_add_memo' },
          { tool: 'erd_remove_table', args: { tableId: 'gone' } },
        ])
      )
    ).rejects.toMatchObject({ name: 'ToolError', code: 'notFound' });
    await settle();
    expect(comparable(hub.webview(DOCUMENT).value)).toEqual(shown);
  });

  it('reports a disconnect in the middle of an undo', async () => {
    await call('erd_add_table');
    hub.beforeApply = () => hub.disconnectAll();

    await expect(io.run(session.undo)).rejects.toMatchObject({
      code: 'disconnected',
    });
    expect(session.state).toBe('reconnecting');
  });

  it('refuses a save the editor did not make, naming both reasons the hub has', async () => {
    await call('erd_add_table');
    hub.saveResult = false;

    await expect(io.run(session.save)).rejects.toMatchObject({
      code: 'notSaved',
      message: expect.stringMatching(
        /could not confirm that every edit reached it, or VS Code kept the tab unsaved/
      ),
    });
  });

  it('saves through the hub and reports no notes', async () => {
    await call('erd_add_table');

    expect(await io.run(session.save)).toEqual({ saved: true, notes: [] });
    expect(JSON.parse(io.read(DOCUMENT)).doc.tableIds).toHaveLength(1);
  });

  it('ignores notifications about other documents', async () => {
    io.put('/work/other.erd.json', emptyDocument());
    const other = hub.open('/work/other.erd.json');
    await call('erd_add_table');
    for (const peer of hub.documents.get(DOCUMENT)!.peers)
      other.peers.add(peer);

    runTool(other.webview, 'erd_add_memo', {});
    await settle();

    expect(JSON.parse((await read('snapshot')).text).memos).toEqual([]);
  });

  it('leaves without a request when it never joined', async () => {
    await io.run(session.leave);
    expect(session.state).toBe('detached');
    expect(hub.methods()).toEqual([]);
  });

  it('refuses every call once closed', async () => {
    await io.run(session.close);
    await io.run(session.close);

    for (const refused of [
      () => call('erd_add_table'),
      () => read('snapshot'),
      () => io.run(session.save),
      () => io.run(session.undo),
      () => io.run(session.open()),
    ]) {
      await expect(refused()).rejects.toMatchObject({ code: 'notOpen' });
    }
  });
});
