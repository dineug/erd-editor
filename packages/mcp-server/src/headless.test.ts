import {
  chmod,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createPeerStore } from '@dineug/erd-editor/peer.js';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as NodePath from '@effect/platform-node/NodePath';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
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
} from '@/__test-utils__/documents';
import { connectMcp, type McpHarness } from '@/__test-utils__/mcp';
import { fsError } from '@/__test-utils__/memoryFs';
import { createMemoryHost, type MemoryHost } from '@/__test-utils__/memoryHost';
import * as ProcessInfo from '@/io/process';
import type { HeadlessSession } from '@/session/headless';
import {
  HEADLESS_SAVE_NOTE,
  openHeadlessSession,
  RELOADED_NOTE,
} from '@/session/headless';
import { readDocument } from '@/tools/read';
import { runTool } from '@/tools/run';

const DOCUMENT = '/work/solo.erd.json';

let io: MemoryHost;
let mcp: McpHarness;

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryHost();
  io.put(DOCUMENT, emptyDocument());
  mcp = await connectMcp({ host: io });
});

afterEach(async () => {
  await mcp.close();
  vi.restoreAllMocks();
});

/** A document another program wrote: one memo, ids of its own. */
function withMemo(): string {
  const peer = createPeerStore({ nickname: 'other', presence: false });
  try {
    runTool(peer, 'erd_add_memo', {});
    return peer.value;
  } finally {
    peer.destroy();
  }
}

/** A session on the memory host, as the manager opens one. */
const open = (options: { path?: string; create?: boolean } = {}) =>
  io.run(
    openHeadlessSession({
      path: options.path ?? DOCUMENT,
      nickname: 'agent',
      create: options.create,
    })
  );

/** What the file on disk reads as, through a fresh engine. */
function reload(text: string) {
  const peer = createPeerStore({ nickname: 'check', presence: false });
  peer.setInitialValue(text);
  const snapshot = readDocument(peer.state, 'snapshot');
  peer.destroy();
  return snapshot;
}

describe('headless: no lock, the file itself (AC-M2)', () => {
  it('writes each edit through a temp file renamed over the document', async () => {
    const added = await mcp.ok('erd_add_table', { path: DOCUMENT });

    expect(added).toMatchObject({
      mode: 'headless',
      batches: 1,
      historyEntries: 1,
    });
    expect(io.writes).toEqual(['/work/.solo.erd.json.id1.tmp', DOCUMENT]);
    expect(io.files.has('/work/.solo.erd.json.id1.tmp')).toBe(false);
    expect(JSON.parse(io.read(DOCUMENT)).doc.tableIds).toEqual(
      added.createdIds
    );
  });

  it('reloads the written file to the same snapshot', async () => {
    const [tableId] = (await mcp.ok('erd_add_table', { path: DOCUMENT }))
      .createdIds;
    await mcp.ok('erd_change_table_name', {
      path: DOCUMENT,
      tableId,
      value: 'accounts',
    });

    const snapshot = await mcp.text('erd_read', {
      path: DOCUMENT,
      format: 'snapshot',
    });
    expect(reload(io.read(DOCUMENT))).toBe(snapshot);
  });

  it('writes nothing for a call that changes nothing', async () => {
    const [tableId] = (await mcp.ok('erd_add_table', { path: DOCUMENT }))
      .createdIds;
    const [columnId] = (
      await mcp.ok('erd_add_column', { path: DOCUMENT, tableId })
    ).createdIds;
    const writes = io.writes.length;

    const unchanged = await mcp.ok('erd_set_column_not_null', {
      path: DOCUMENT,
      tableId,
      columnId,
      value: false,
    });
    expect(unchanged).toMatchObject({ batches: 0, undoable: false });
    expect(io.writes).toHaveLength(writes);
  });

  it('undoes and redoes on disk', async () => {
    const [tableId] = (await mcp.ok('erd_add_table', { path: DOCUMENT }))
      .createdIds;
    await mcp.ok('erd_undo', { path: DOCUMENT });
    expect(JSON.parse(io.read(DOCUMENT)).doc.tableIds).toEqual([]);

    await mcp.ok('erd_redo', { path: DOCUMENT });
    expect(JSON.parse(io.read(DOCUMENT)).doc.tableIds).toEqual([tableId]);
  });

  it('answers erd_save with a note, since every edit is already on disk', async () => {
    expect(await mcp.ok('erd_save', { path: DOCUMENT })).toEqual({
      tool: 'erd_save',
      mode: 'headless',
      saved: true,
      notes: [HEADLESS_SAVE_NOTE],
    });
  });

  it('refuses a vendor on a format that is not sql, with the code the caller acts on', async () => {
    const refused = await mcp.call('erd_read', {
      path: DOCUMENT,
      format: 'json',
      vendor: 'PostgreSQL',
    });

    expect(refused.isError).toBe(true);
    expect(refused.json.error).toEqual({
      code: 'invalidArgs',
      message: 'vendor applies to the sql format only, not json',
    });
  });

  it('refuses a read on a session that was closed', async () => {
    const session = await open();
    await io.run(session.close);

    await expect(io.run(session.read('snapshot'))).rejects.toMatchObject({
      name: 'PeerStoreError',
      code: 'destroyed',
    });
  });

  it('refuses a document that does not exist', async () => {
    const missing = await mcp.call('erd_add_table', {
      path: '/work/none.erd.json',
    });
    expect(missing.isError).toBe(true);
    expect(missing.json.error.code).toBe('notFound');
  });

  it('loads a file that starts with a byte order mark, as the editor does', async () => {
    io.put(DOCUMENT, `\ufeff${emptyDocument()}`);

    const added = await mcp.ok('erd_add_table', { path: DOCUMENT });
    expect(JSON.parse(io.read(DOCUMENT)).doc.tableIds).toEqual(
      added.createdIds
    );
  });

  it('loads a blank file as a new document', async () => {
    io.put(DOCUMENT, '  \n');

    const added = await mcp.ok('erd_add_table', { path: DOCUMENT });
    expect(JSON.parse(io.read(DOCUMENT)).doc.tableIds).toEqual(
      added.createdIds
    );
  });

  it('loads an empty object and a v2 document, which the editor reads too', async () => {
    for (const text of ['{}', '{"canvas":{},"table":{"tables":[]}}']) {
      io.put(DOCUMENT, text);
      expect((await mcp.call('erd_add_memo', { path: DOCUMENT })).isError).toBe(
        false
      );
    }
  });

  it('refuses a document with merge conflict markers, and never writes it', async () => {
    const ours = documentFromSql(SHOP_SQL);
    const conflicted = `<<<<<<< HEAD\n${ours}\n=======\n${emptyDocument()}\n>>>>>>> theirs\n`;
    io.put(DOCUMENT, conflicted);

    for (const [name, args] of [
      ['erd_read', { format: 'snapshot' }],
      ['erd_add_memo', {}],
      ['erd_open_document', {}],
    ] as const) {
      const refused = await mcp.call(name, { path: DOCUMENT, ...args });
      expect(refused.isError).toBe(true);
      expect(refused.json.error.code).toBe('invalidDocument');
      expect(refused.json.error.message).toContain('left untouched');
    }
    expect(io.read(DOCUMENT)).toBe(conflicted);
    expect(io.writes).toEqual([]);
  });

  it('refuses JSON that is not an ERD document', async () => {
    for (const text of ['[1,2,3]', 'null', '42', '{"name":"app"}']) {
      io.put(DOCUMENT, text);
      const refused = await mcp.call('erd_add_table', { path: DOCUMENT });
      expect(refused.json.error).toEqual({
        code: 'invalidDocument',
        message: `${DOCUMENT} holds JSON that is not an ERD document, so it would load as an empty diagram; it was left untouched. Resolve any merge conflict or restore the file, then call again.`,
      });
      expect(io.read(DOCUMENT)).toBe(text);
    }
  });

  it('refuses a file that turned unreadable under an open session, and writes nothing', async () => {
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    const broken = io.read(DOCUMENT).slice(0, 200);
    io.put(DOCUMENT, broken);

    const refused = await mcp.call('erd_add_memo', { path: DOCUMENT });
    expect(refused.json.error.code).toBe('invalidDocument');
    expect(io.read(DOCUMENT)).toBe(broken);

    io.put(DOCUMENT, emptyDocument());
    expect((await mcp.ok('erd_add_memo', { path: DOCUMENT })).notes).toEqual([
      RELOADED_NOTE,
    ]);
  });

  it('loads a file changed between calls again, and says what it cost', async () => {
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    io.put(DOCUMENT, emptyDocument());

    const memo = await mcp.ok('erd_add_memo', { path: DOCUMENT });
    expect(memo.notes).toEqual([RELOADED_NOTE]);
    const document = JSON.parse(io.read(DOCUMENT));
    expect(document.doc.tableIds).toEqual([]);
    expect(document.doc.memoIds).toEqual(memo.createdIds);
  });
});

describe('headless compare-and-swap (AC-P14)', () => {
  it('refuses to write when the file changed during the call, and loads it again', async () => {
    await mcp.ok('erd_add_memo', { path: DOCUMENT });
    const theirs = emptyDocument().replace('"version"', '"version" ');
    let stats = 0;
    io.beforeStat = path => {
      // The first stat is the refresh check; the second, the swap check.
      if (path === DOCUMENT && ++stats === 2) io.put(DOCUMENT, theirs);
    };

    const conflict = await mcp.call('erd_add_table', { path: DOCUMENT });
    io.beforeStat = null;

    expect(conflict.isError).toBe(true);
    expect(conflict.json.error.code).toBe('conflict');
    expect(io.read(DOCUMENT)).toBe(theirs);
    expect([...io.files.keys()].filter(path => path.endsWith('.tmp'))).toEqual(
      []
    );
    // Loaded again at the conflict, so the next read finds nothing new and carries no note.
    const read = await mcp.call('erd_read', {
      path: DOCUMENT,
      format: 'snapshot',
    });
    expect(read.texts).toHaveLength(1);
    const snapshot = JSON.parse(read.text);
    expect(snapshot.tables).toEqual([]);
    expect(snapshot.memos).toEqual([]);
  });

  it('tells a change of the same size by its mtime, between calls and during one', async () => {
    const {
      createdIds: [tableId],
    } = await mcp.ok('erd_add_table', { path: DOCUMENT });
    // The same bytes but for the table id, so the size alone never tells them apart.
    const otherId = `${tableId[0] === 'x' ? 'y' : 'x'}${tableId.slice(1)}`;
    const ours = io.read(DOCUMENT);
    const theirs = ours.replaceAll(tableId, otherId);
    expect(theirs).toHaveLength(ours.length);
    io.put(DOCUMENT, theirs);

    const memo = await mcp.ok('erd_add_memo', { path: DOCUMENT });
    expect(memo.notes).toEqual([RELOADED_NOTE]);
    expect(JSON.parse(io.read(DOCUMENT)).doc.tableIds).toEqual([otherId]);

    const again = io.read(DOCUMENT).replaceAll(otherId, tableId);
    let stats = 0;
    io.beforeStat = path => {
      if (path === DOCUMENT && ++stats === 2) io.put(DOCUMENT, again);
    };
    const conflict = await mcp.call('erd_add_table', { path: DOCUMENT });
    io.beforeStat = null;

    expect(conflict.json.error.code).toBe('conflict');
    expect(io.read(DOCUMENT)).toBe(again);
  });

  it('takes the baseline before reading, so a write landing in between is kept', async () => {
    const theirs = withMemo();
    const read = io.calls.readFileString;
    io.calls.readFileString = path =>
      read(path).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            io.calls.readFileString = read;
            io.put(path, theirs);
          })
        )
      );
    const session = await open();

    const { run } = await io.run(session.runTool('erd_add_table', {}));
    const document = JSON.parse(io.read(DOCUMENT));
    expect(document.doc.memoIds).toEqual(JSON.parse(theirs).doc.memoIds);
    expect(document.doc.tableIds).toEqual(run.createdIds);
    await io.run(session.close);
  });

  it('keeps the stat of the file it wrote, so a write landing after the rename is loaded', async () => {
    const theirs = withMemo();
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    const rename = io.calls.rename;
    io.calls.rename = (from, to) =>
      rename(from, to).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            io.calls.rename = rename;
            io.put(to, theirs);
          })
        )
      );

    await mcp.ok('erd_add_table', { path: DOCUMENT });
    const memo = await mcp.ok('erd_add_memo', { path: DOCUMENT });

    expect(memo.notes).toEqual([RELOADED_NOTE]);
    const document = JSON.parse(io.read(DOCUMENT));
    expect(document.doc.tableIds).toEqual([]);
    expect(document.doc.memoIds).toEqual([
      ...JSON.parse(theirs).doc.memoIds,
      ...memo.createdIds,
    ]);
  });

  it('gives the new file the permission bits of the old one, owner write kept', async () => {
    for (const [before, after] of [
      [0o600, 0o600],
      [0o640, 0o640],
      [0o444, 0o644],
    ]) {
      io.files.delete(DOCUMENT);
      io.put(DOCUMENT, emptyDocument(), before);
      const session = await open();

      await io.run(session.runTool('erd_add_table', {}));
      expect(io.files.get(DOCUMENT)!.mode).toBe(after);
      await io.run(session.close);
    }
  });

  it('loads the file again when the write itself fails, and reports the system error', async () => {
    const session = await open();
    const rename = io.calls.rename;
    io.calls.rename = from =>
      Effect.fail(fsError('PermissionDenied', 'rename', from));

    await expect(
      io.run(session.runTool('erd_add_table', {}))
    ).rejects.toMatchObject({
      _tag: 'PlatformError',
      reason: { _tag: 'PermissionDenied' },
    });
    io.calls.rename = rename;
    expect(io.files.has('/work/.solo.erd.json.id1.tmp')).toBe(false);
    expect(
      JSON.parse((await io.run(session.read('snapshot'))).text).tables
    ).toEqual([]);
    await io.run(session.close);
  });

  it('leaves no temp file and keeps the disk state when the temp write fails', async () => {
    const session = await open();
    io.calls.writeFileString = path =>
      Effect.fail(fsError('Unknown', 'writeFile', path, 'ENOSPC'));

    await expect(
      io.run(session.runTool('erd_add_memo', {}))
    ).rejects.toMatchObject({ reason: { _tag: 'Unknown' } });
    expect(
      JSON.parse((await io.run(session.read('snapshot'))).text).memos
    ).toEqual([]);
    await io.run(session.close);
  });

  it('answers a failed write as internal, in the words of the system call', async () => {
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    io.calls.writeFileString = path =>
      Effect.fail(fsError('Unknown', 'writeFile', path, 'ENOSPC'));

    const refused = await mcp.call('erd_add_memo', { path: DOCUMENT });
    expect(refused.json.error).toEqual({
      code: 'internal',
      message: 'ENOSPC: /work/.solo.erd.json.id2.tmp',
    });
  });

  it('reports a document deleted between calls', async () => {
    const session = await open();
    io.files.delete(DOCUMENT);

    await expect(
      io.run(session.runTool('erd_add_memo', {}))
    ).rejects.toMatchObject({ code: 'notFound' });
    await io.run(session.close);
  });

  it('writes nothing for an undo or redo with nothing to revert', async () => {
    const session = await open();

    expect((await io.run(session.undo)).result.label).toBeNull();
    expect((await io.run(session.redo)).result.label).toBeNull();
    expect(io.writes).toEqual([]);
    await io.run(session.close);
  });

  it('refuses to create a document in a folder that does not exist', async () => {
    await expect(
      open({ path: '/nowhere/new.erd.json', create: true })
    ).rejects.toMatchObject({ code: 'notFound' });
  });

  it('passes other failures of an exclusive create through', async () => {
    io.calls.writeFileString = path =>
      Effect.fail(fsError('PermissionDenied', 'writeFile', path));
    await expect(
      open({ path: '/work/new.erd.json', create: true })
    ).rejects.toMatchObject({ reason: { _tag: 'PermissionDenied' } });
  });

  it('passes a read failure other than a missing file through', async () => {
    io.calls.readFileString = path =>
      Effect.fail(fsError('PermissionDenied', 'readFile', path));
    await expect(open()).rejects.toMatchObject({
      reason: { _tag: 'PermissionDenied' },
    });
  });
});

describe('headless on a real file system', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'erd-mcp-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const node = Layer.mergeAll(
    NodeFileSystem.layer,
    NodePath.layer,
    ProcessInfo.layer
  );
  const onNode = <A, E>(
    effect: Effect.Effect<A, E, Layer.Success<typeof node>>
  ) => Effect.runPromise(Effect.provide(effect, node));
  const openReal = (path: string): Promise<HeadlessSession> =>
    onNode(openHeadlessSession({ path, nickname: 'agent' }));

  it('replaces the file atomically and leaves no temp file behind', async () => {
    const path = join(dir, 'real.erd.json');
    await writeFile(path, `\ufeff${emptyDocument()}`);
    const session = await openReal(path);

    const { run } = await onNode(session.runTool('erd_add_table', {}));
    const text = await readFile(path, 'utf8');

    expect(JSON.parse(text).doc.tableIds).toEqual(run.createdIds);
    expect(await readdir(dir)).toEqual(['real.erd.json']);
    expect(reload(text)).toBe((await onNode(session.read('snapshot'))).text);
    await onNode(session.close);
  });

  it('keeps a private file private, and needs no reload after its own write', async () => {
    const path = join(dir, 'private.erd.json');
    await writeFile(path, emptyDocument());
    await chmod(path, 0o600);
    const session = await openReal(path);

    await onNode(session.runTool('erd_add_table', {}));
    expect((await stat(path)).mode & 0o777).toBe(0o600);

    // The baseline is the temp file's stat, so this holds only if the rename kept it.
    const undone = await onNode(session.undo);
    expect(undone).toMatchObject({
      result: { label: 'erd_add_table' },
      notes: [],
    });
    expect(JSON.parse(await readFile(path, 'utf8')).doc.tableIds).toEqual([]);
    await onNode(session.close);
  });
});
