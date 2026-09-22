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
import { createMemoryIo, type MemoryIo } from '@/__test-utils__/memoryIo';
import {
  createLiveSession,
  type LiveSession,
  REJOIN_NOTE,
  RESEED_NOTE,
} from '@/session/live';
import { readDocument } from '@/tools/read';
import { runTool } from '@/tools/run';

const DOCUMENT = '/work/live.erd.json';

let io: MemoryIo;
let hub: FakeHub;
let session: LiveSession;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryIo();
  io.put(DOCUMENT, emptyDocument());
  hub = createFakeHub(io, { pid: 4545, workspaceFolders: ['/work'] });
  session = createLiveSession({
    io,
    path: DOCUMENT,
    candidate: { pid: hub.pid, record: hub.lock(), mtimeMs: 1 },
    nickname: 'agent',
    client: 'agent',
  });
});

afterEach(async () => {
  await session.close();
  hub.destroy();
  vi.restoreAllMocks();
});

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
    await session.runTool('erd_add_table', {});
    hub.documents.get(DOCUMENT)!.peers.clear();

    const { run, notes } = await session.runTool('erd_add_memo', {});

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

    await session.runTool('erd_change_table_name', {
      tableId: users.id,
      value: 'members',
    });
    await settle();

    const shown = JSON.parse(readDocument(webview.state, 'snapshot'));
    expect(tableNamed(shown, 'members').id).toBe(users.id);
    expect(comparable((await session.read('json')).text)).toEqual(
      comparable(webview.value)
    );
  });

  it('refuses edits to a document the editor holds read-only', async () => {
    hub.readonlyPaths.add(DOCUMENT);

    await expect(session.runTool('erd_add_table', {})).rejects.toMatchObject({
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
    await session.runTool('erd_add_table', {});
    hub.documents.get(DOCUMENT)!.readonly = true;

    await expect(session.runTool('erd_add_memo', {})).rejects.toMatchObject({
      name: 'SessionError',
      code: 'readonly',
    });
    hub.documents.get(DOCUMENT)!.readonly = false;

    hub.disconnectAll();
    await settle();
    const { notes } = await session.runTool('erd_add_memo', {});
    expect(notes).toEqual([RESEED_NOTE]);
  });

  it('drops an edit the editor refused: the next read reseeds from the editor', async () => {
    await session.runTool('erd_add_table', {});
    hub.beforeApply = () => {
      hub.beforeApply = null;
      throw { code: 'internal', message: 'the relay failed' };
    };

    await expect(session.runTool('erd_add_memo', {})).rejects.toMatchObject({
      code: 'internal',
    });
    expect(session.state).toBe('reconnecting');

    const joins = hub.methods().filter(method => method === 'join').length;
    const snapshot = JSON.parse((await session.read('snapshot')).text);
    expect(snapshot.memos).toEqual([]);
    expect(snapshot.tables).toHaveLength(1);
    expect(hub.methods().filter(method => method === 'join')).toHaveLength(
      joins + 1
    );
  });

  it('drops an edit refused as read-only in the editor, and holds the flag the join reports', async () => {
    await session.runTool('erd_add_table', {});
    hub.documents.get(DOCUMENT)!.readonly = true;

    await expect(session.runTool('erd_add_memo', {})).rejects.toMatchObject({
      name: 'SessionError',
      code: 'readonly',
    });
    expect(session.state).toBe('reconnecting');

    expect(JSON.parse((await session.read('snapshot')).text).memos).toEqual([]);
    await expect(session.runTool('erd_add_memo', {})).rejects.toMatchObject({
      name: 'PeerStoreError',
      code: 'readonly',
    });
    expect(hub.webview(DOCUMENT).state.doc.memoIds).toEqual([]);
  });

  it('drops an undo the editor refused: the next read still shows the edit', async () => {
    const { run } = await session.runTool('erd_add_table', {});
    hub.beforeApply = () => {
      hub.beforeApply = null;
      throw { code: 'internal', message: 'the relay failed' };
    };

    await expect(session.undo()).rejects.toMatchObject({ code: 'internal' });
    expect(session.state).toBe('reconnecting');
    expect(
      JSON.parse((await session.read('snapshot')).text).tables.map(
        ({ id }: { id: string }) => id
      )
    ).toEqual(run.createdIds);
  });

  it('adds no reseed note when no edit of its own came before', async () => {
    expect((await session.read('snapshot')).notes).toEqual([]);
    hub.disconnectAll();
    await settle();

    expect((await session.read('snapshot')).notes).toEqual([]);
    expect(hub.methods()).toEqual(['join', 'join']);
  });

  it('refuses a document the hub answered from disk that the engine cannot read', async () => {
    const conflicted = `<<<<<<< HEAD\n${emptyDocument()}\n=======\n${emptyDocument()}\n>>>>>>> theirs\n`;
    io.put(DOCUMENT, conflicted);

    await expect(session.read('snapshot')).rejects.toMatchObject({
      code: 'invalidDocument',
      message: expect.stringContaining(`${DOCUMENT} is not valid JSON`),
    });
    expect(session.state).toBe('reconnecting');
    expect(io.read(DOCUMENT)).toBe(conflicted);
  });

  it('reports a disconnect in the middle of an undo', async () => {
    await session.runTool('erd_add_table', {});
    hub.beforeApply = () => hub.disconnectAll();

    await expect(session.undo()).rejects.toMatchObject({
      code: 'disconnected',
    });
    expect(session.state).toBe('reconnecting');
  });

  it('refuses a save the editor did not make, naming both reasons the hub has', async () => {
    await session.runTool('erd_add_table', {});
    hub.saveResult = false;

    await expect(session.save()).rejects.toMatchObject({
      code: 'notSaved',
      message: expect.stringMatching(
        /could not confirm that every edit reached it, or VS Code kept the tab unsaved/
      ),
    });
  });

  it('saves through the hub and reports no notes', async () => {
    await session.runTool('erd_add_table', {});

    expect(await session.save()).toEqual({ saved: true, notes: [] });
    expect(JSON.parse(io.read(DOCUMENT)).doc.tableIds).toHaveLength(1);
  });

  it('ignores notifications about other documents', async () => {
    io.put('/work/other.erd.json', emptyDocument());
    const other = hub.open('/work/other.erd.json');
    await session.runTool('erd_add_table', {});
    for (const peer of hub.documents.get(DOCUMENT)!.peers)
      other.peers.add(peer);

    runTool(other.webview, 'erd_add_memo', {});
    await settle();

    expect(JSON.parse((await session.read('snapshot')).text).memos).toEqual([]);
  });

  it('leaves without a request when it never joined', async () => {
    await session.leave();
    expect(session.state).toBe('detached');
    expect(hub.methods()).toEqual([]);
  });

  it('refuses every call once closed', async () => {
    await session.close();
    await session.close();

    for (const call of [
      () => session.runTool('erd_add_table', {}),
      () => session.read('snapshot'),
      () => session.save(),
      () => session.undo(),
      () => session.open(),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: 'notOpen' });
    }
  });
});
