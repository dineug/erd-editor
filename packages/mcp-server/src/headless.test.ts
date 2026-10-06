import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import {
  chmod,
  mkdtemp,
  open as openFile,
  readdir,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';

import { bHas, createPeerStore } from '@dineug/erd-editor/peer.js';
import { HUB_PROTOCOL_VERSION, pipePath } from '@dineug/erd-editor-agent-hub';
import { SchemaV3Constants } from '@dineug/erd-editor-schema';
import * as NodePath from '@effect/platform-node/NodePath';
import { Effect, Layer } from 'effect';
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
import { connectMcp, type McpHarness, settle } from '@/__test-utils__/mcp';
import { fsError } from '@/__test-utils__/memoryFs';
import { createMemoryHost, type MemoryHost } from '@/__test-utils__/memoryHost';
import { PRIVATE_MODE } from '@/__test-utils__/platform';
import * as NodeFs from '@/io/fileSystem';
import * as ProcessInfo from '@/io/process';
import type { HeadlessSession } from '@/session/headless';
import {
  HEADLESS_SAVE_NOTE,
  openHeadlessSession,
  RELOADED_NOTE,
} from '@/session/headless';
import { documentReader, readDocument } from '@/tools/read';
import { runTool } from '@/tools/run';

const DOCUMENT = '/work/solo.erd.json';

const { ColumnOption, ColumnUIKey } = SchemaV3Constants;

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

/** Runs Windows' icacls, failing the spec when it fails. */
function icacls(...args: string[]): void {
  execFileSync(join(process.env.SystemRoot!, 'System32', 'icacls.exe'), args, {
    windowsHide: true,
  });
}

let saves = 0;

/** The DACL of a file on Windows, as the SDDL icacls saves for it. */
function daclOf(path: string): string {
  const save = join(tmpdir(), `erd-mcp-dacl-${process.pid}-${++saves}`);
  icacls(path, '/save', save, '/q');
  try {
    return readFileSync(save).toString('utf16le').split('\r\n')[1];
  } finally {
    rmSync(save, { force: true });
  }
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

    await expect(
      io.run(session.read(documentReader('snapshot')))
    ).rejects.toMatchObject({
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

describe('headless: what the engine adds after an edit reaches the file', () => {
  const onDisk = () => JSON.parse(io.read(DOCUMENT));
  const columnOnDisk = (columnId: string) =>
    onDisk().collections.tableColumnEntities[columnId];
  const isForeignKey = (columnId: string) =>
    bHas(columnOnDisk(columnId).ui.keys, ColumnUIKey.foreignKey);
  /** Each relationship's two ends, where the relationship sort placed them. */
  const placements = (document: any) =>
    Object.values<any>(document.collections.relationshipEntities).map(
      ({ id, start, end }) => ({ id, start, end })
    );

  /** A table with one column, both made by the tools. */
  async function tableWithColumn() {
    const [tableId] = (await mcp.ok('erd_add_table', { path: DOCUMENT }))
      .createdIds;
    const [columnId] = (
      await mcp.ok('erd_add_column', { path: DOCUMENT, tableId })
    ).createdIds;
    return { tableId, columnId };
  }

  it('writes the not-null a primary key brings, and the undo of the key', async () => {
    const { tableId, columnId } = await tableWithColumn();

    await mcp.ok('erd_set_column_primary_key', {
      path: DOCUMENT,
      tableId,
      columnId,
      value: true,
    });
    expect(columnOnDisk(columnId).options).toBe(
      ColumnOption.primaryKey | ColumnOption.notNull
    );

    // The engine set the not-null outside the history, so an undo takes back
    // the key alone, in an editor too.
    await mcp.ok('erd_undo', { path: DOCUMENT });
    expect(columnOnDisk(columnId).options).toBe(ColumnOption.notNull);
  });

  it('writes the foreign-key mark and the placement a link brings, and the undo takes the mark off', async () => {
    const start = await tableWithColumn();
    const end = await tableWithColumn();

    await mcp.ok('erd_link_columns', {
      path: DOCUMENT,
      startTableId: start.tableId,
      startColumnIds: [start.columnId],
      endTableId: end.tableId,
      endColumnIds: [end.columnId],
      relationshipType: 'ZeroN',
    });
    expect(isForeignKey(end.columnId)).toBe(true);
    const session = JSON.parse(
      await mcp.text('erd_read', { path: DOCUMENT, format: 'json' })
    );
    // The placement alone: a link wakes identification and
    // startRelationshipType behind a 10 ms throttle, so the session recomputes
    // them after its write; the file keeps the defaults until the next write.
    expect(placements(onDisk())).toEqual(placements(session));

    await mcp.ok('erd_undo', { path: DOCUMENT });
    expect(isForeignKey(end.columnId)).toBe(false);
  });

  it('writes the key columns a relationship adds, not-null and marked, and the undo takes them out', async () => {
    const [startTableId] = (await mcp.ok('erd_add_table', { path: DOCUMENT }))
      .createdIds;
    const [endTableId] = (await mcp.ok('erd_add_table', { path: DOCUMENT }))
      .createdIds;
    const before = onDisk();

    await mcp.ok('erd_add_relationship', {
      path: DOCUMENT,
      startTableId,
      endTableId,
      relationshipType: 'ZeroN',
    });
    const { tableEntities } = onDisk().collections;
    const [primaryKey] = tableEntities[startTableId].columnIds;
    const [foreignKey] = tableEntities[endTableId].columnIds;
    expect(columnOnDisk(primaryKey).options).toBe(
      ColumnOption.primaryKey | ColumnOption.notNull
    );
    expect(isForeignKey(foreignKey)).toBe(true);

    await mcp.ok('erd_undo', { path: DOCUMENT });
    const undone = onDisk();
    expect(undone.doc).toEqual(before.doc);
    for (const tableId of [startTableId, endTableId]) {
      expect(undone.collections.tableEntities[tableId].columnIds).toEqual([]);
    }
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

  it('gives the new file the permission bits of the old one', async () => {
    for (const mode of [0o600, 0o640, 0o644]) {
      io.files.delete(DOCUMENT);
      io.put(DOCUMENT, emptyDocument(), mode);
      const session = await open();

      await io.run(session.runTool('erd_add_table', {}));
      expect(io.files.get(DOCUMENT)!.mode).toBe(mode);
      await io.run(session.close);
    }
  });

  it('loads the file again when the write itself fails, and reports the system error', async () => {
    const session = await open();
    const rename = io.calls.rename;
    let renames = 0;
    io.calls.rename = from => {
      renames++;
      return Effect.fail(fsError('PermissionDenied', 'rename', from));
    };

    await expect(
      io.run(session.runTool('erd_add_table', {}))
    ).rejects.toMatchObject({
      _tag: 'PlatformError',
      reason: { _tag: 'PermissionDenied' },
    });
    io.calls.rename = rename;
    // A rename failing on POSIX is no file held open, so it is tried once.
    expect(renames).toBe(1);
    expect(io.files.has('/work/.solo.erd.json.id1.tmp')).toBe(false);
    expect(
      JSON.parse((await io.run(session.read(documentReader('snapshot')))).text)
        .tables
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
      JSON.parse((await io.run(session.read(documentReader('snapshot')))).text)
        .memos
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

describe('headless: a read-only document', () => {
  /** The document on its own, with the mode given. */
  const putWithMode = (mode: number) => {
    io.files.delete(DOCUMENT);
    io.put(DOCUMENT, emptyDocument(), mode);
  };

  it('refuses a read-only document with readonly and leaves it as it was, then edits it once writable', async () => {
    putWithMode(0o444);
    const before = { ...io.files.get(DOCUMENT)! };

    const refused = await mcp.call('erd_add_table', { path: DOCUMENT });
    expect(refused.json.error).toEqual({
      code: 'readonly',
      message: `${DOCUMENT} is read-only, so the edit was not written; make it writable, such as by checking it out in Perforce or TFVC, then call again`,
    });
    expect(io.files.get(DOCUMENT)).toEqual(before);
    expect(io.writes).toEqual(['/work/.solo.erd.json.id1.tmp']);
    expect(io.files.has('/work/.solo.erd.json.id1.tmp')).toBe(false);

    io.files.get(DOCUMENT)!.mode = 0o644;
    const added = await mcp.ok('erd_add_table', { path: DOCUMENT });
    expect(added).not.toHaveProperty('notes');
    expect(JSON.parse(io.read(DOCUMENT)).doc.tableIds).toEqual(
      added.createdIds
    );
  });

  it('refuses a document that turned read-only between calls by its mode alone, as a checkout reverted does', async () => {
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    const written = io.read(DOCUMENT);
    // Size and mtime stay, so only the stat of the swap sees it.
    io.files.get(DOCUMENT)!.mode = 0o444;

    const refused = await mcp.call('erd_add_memo', { path: DOCUMENT });
    expect(refused.json.error.code).toBe('readonly');
    expect(io.read(DOCUMENT)).toBe(written);
    const snapshot = JSON.parse(
      await mcp.text('erd_read', { path: DOCUMENT, format: 'snapshot' })
    );
    expect(snapshot.memos).toEqual([]);
    expect(snapshot.tables).toHaveLength(1);
  });
});

describe('headless on Windows: a document another program holds open', () => {
  let win: MemoryHost;
  let winMcp: McpHarness;
  const TEMP = '/work/.solo.erd.json.id1.tmp';

  /** EPERM, which Windows answers a rename over a file any handle has open. */
  const held = (from: string, tag: 'Unknown' | 'PermissionDenied' | 'Busy') =>
    fsError(
      tag,
      'rename',
      from,
      { Unknown: 'EPERM', PermissionDenied: 'EACCES', Busy: 'EBUSY' }[tag]
    );

  /** Fails the next renames with these tags, then renames again, noting each attempt. */
  function holdRenames(tags: Array<'Unknown' | 'PermissionDenied' | 'Busy'>) {
    const rename = win.calls.rename;
    const events: string[] = [];
    win.beforeStat = path => {
      if (path === DOCUMENT) events.push('stat');
    };
    win.calls.rename = (from, to) => {
      events.push('rename');
      const tag = tags.shift();
      return tag ? Effect.fail(held(from, tag)) : rename(from, to);
    };
    return events;
  }

  const lockOver = (pid: number, hub: boolean) => {
    win.alive.add(pid);
    win.writeLock(pid, {
      pipe: hub ? pipePath(win.home, pid, 'win32') : '',
      workspaceFolders: ['/work'],
      documents: [],
      ide: 'vscode',
      version: '2.9.0',
      protocolVersion: HUB_PROTOCOL_VERSION,
      token: 't',
      hub,
    });
  };

  const connect = async (testClock = false) => {
    win = createMemoryHost({ platform: 'win32' });
    win.put(DOCUMENT, emptyDocument());
    winMcp = await connectMcp({ host: win, testClock });
  };

  afterEach(async () => {
    await winMcp.close();
  });

  it('retries the swap while the rename is refused, comparing again before each attempt', async () => {
    await connect();
    const events = holdRenames(['Unknown', 'PermissionDenied', 'Busy']);

    const added = await winMcp.ok('erd_add_table', { path: DOCUMENT });
    expect(added).not.toHaveProperty('notes');
    expect(JSON.parse(win.read(DOCUMENT)).doc.tableIds).toEqual(
      added.createdIds
    );
    // The load's stat and the refresh's, then one per attempt.
    expect(events).toEqual([
      'stat',
      'stat',
      ...Array.from({ length: 4 }, () => ['stat', 'rename']).flat(),
    ]);
    expect(win.files.has(TEMP)).toBe(false);
  });

  it('answers a write landing between two attempts as a conflict, never writing over it', async () => {
    await connect();
    await winMcp.ok('erd_add_memo', { path: DOCUMENT });
    const theirs = withMemo();
    const events = holdRenames(['Unknown']);
    win.beforeStat = path => {
      if (path !== DOCUMENT) return;
      events.push('stat');
      // The refresh, the first attempt, then the second attempt's compare.
      if (events.filter(event => event === 'stat').length === 3) {
        win.put(DOCUMENT, theirs);
      }
    };

    const conflict = await winMcp.call('erd_add_table', { path: DOCUMENT });
    expect(conflict.json.error.code).toBe('conflict');
    expect(win.read(DOCUMENT)).toBe(theirs);
    // The last stat is the reload's.
    expect(events).toEqual(['stat', 'stat', 'rename', 'stat', 'stat']);
    expect([...win.files.keys()].filter(path => path.endsWith('.tmp'))).toEqual(
      []
    );
    const read = await winMcp.call('erd_read', {
      path: DOCUMENT,
      format: 'snapshot',
    });
    expect(read.texts).toHaveLength(1);
    expect(JSON.parse(read.text).memos).toHaveLength(1);
  });

  it.each([
    [true, 'hubAppeared', false],
    [false, 'blocked', true],
  ] as const)(
    'looks for a window again before a retried attempt: a lock with hub %s refuses with %s',
    async (hub, code, kept) => {
      await connect();
      await winMcp.ok('erd_add_memo', { path: DOCUMENT });
      const onDisk = win.read(DOCUMENT);
      const rename = win.calls.rename;
      win.calls.rename = from => {
        win.calls.rename = rename;
        // The editor opened the file, which held it, and its lock lists it now.
        lockOver(4242, hub);
        return Effect.fail(held(from, 'Unknown'));
      };

      const refused = await winMcp.call('erd_add_table', { path: DOCUMENT });
      expect(refused.json.error.code).toBe(code);
      expect(refused.json.error.message).toContain(`(pid 4242)`);
      expect(win.read(DOCUMENT)).toBe(onDisk);
      expect(
        [...win.files.keys()].filter(path => path.endsWith('.tmp'))
      ).toEqual([]);
      // A window that took the document closes the disk session, as at the start of a call.
      expect(winMcp.manager.paths()).toEqual(kept ? [DOCUMENT] : []);
    }
  );

  it('gives up once the retry window is over, loading the file again and quoting the system error', async () => {
    await connect(true);
    await winMcp.ok('erd_add_memo', { path: DOCUMENT });
    let renames = 0;
    win.calls.rename = from => {
      renames++;
      return Effect.fail(held(from, 'Unknown'));
    };

    let done = false;
    const pending = winMcp
      .call('erd_add_table', { path: DOCUMENT })
      .finally(() => (done = true));
    for (let step = 0; !done && step < 100; step++) {
      await winMcp.adjust(100);
      await settle(1);
    }

    expect((await pending).json.error).toEqual({
      code: 'internal',
      message: 'EPERM: /work/.solo.erd.json.id2.tmp',
    });
    // 10, 20, 40 and 80 ms apart, then 100 ms while under 2 s have passed:
    // the 24th attempt comes 2,050 ms after the first on the clock.
    expect(renames).toBe(24);
    expect(win.files.has('/work/.solo.erd.json.id2.tmp')).toBe(false);
    const snapshot = JSON.parse(
      await winMcp.text('erd_read', { path: DOCUMENT, format: 'snapshot' })
    );
    expect(snapshot.tables).toEqual([]);
    expect(snapshot.memos).toHaveLength(1);
  });

  it('writes in place a document whose own ACL a rename would lose, keeping the temp file until then', async () => {
    await connect();
    win.files.delete(DOCUMENT);
    win.put(DOCUMENT, emptyDocument(), 0o600);
    const asked: string[][] = [];
    win.access.keepsAccess = (temp, path) => {
      asked.push([temp, path]);
      return Effect.succeed(false);
    };
    const writeInPlace = win.access.writeInPlace;
    const present: boolean[] = [];
    win.access.writeInPlace = (path, text) => {
      present.push(win.files.has(TEMP));
      return writeInPlace(path, text);
    };
    const rename = vi.spyOn(win.calls, 'rename');

    const added = await winMcp.ok('erd_add_table', { path: DOCUMENT });
    expect(asked).toEqual([[TEMP, DOCUMENT]]);
    expect(present).toEqual([true]);
    expect(rename).not.toHaveBeenCalled();
    expect(win.writes).toEqual([TEMP, DOCUMENT]);
    expect(win.files.has(TEMP)).toBe(false);
    expect(win.files.get(DOCUMENT)!.mode).toBe(0o600);
    expect(JSON.parse(win.read(DOCUMENT)).doc.tableIds).toEqual(
      added.createdIds
    );

    // The in-place write's stat is the baseline, so its own write is no change.
    const undone = await winMcp.ok('erd_undo', { path: DOCUMENT });
    expect(undone).not.toHaveProperty('notes');
    expect(JSON.parse(win.read(DOCUMENT)).doc.tableIds).toEqual([]);
  });

  it('retries an in-place write another program holds, as it does a rename', async () => {
    await connect();
    win.access.keepsAccess = () => Effect.succeed(false);
    const writeInPlace = win.access.writeInPlace;
    let attempts = 0;
    win.access.writeInPlace = (path, text) =>
      ++attempts === 1
        ? Effect.fail(fsError('Busy', 'open', path, 'EBUSY'))
        : writeInPlace(path, text);

    const added = await winMcp.ok('erd_add_table', { path: DOCUMENT });
    expect(attempts).toBe(2);
    expect(JSON.parse(win.read(DOCUMENT)).doc.tableIds).toEqual(
      added.createdIds
    );
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

  const node = Layer.mergeAll(NodeFs.layer, NodePath.layer, ProcessInfo.layer);
  const onNode = <A, E>(
    effect: Effect.Effect<A, E, Layer.Success<typeof node>>
  ) => Effect.runPromise(Effect.provide(effect, node));
  const openReal = (path: string): Promise<HeadlessSession> =>
    onNode(openHeadlessSession({ path, nickname: 'agent' }));
  const inode = async (path: string) =>
    (await stat(path, { bigint: true })).ino;
  const windows = process.platform === 'win32';

  it('replaces the file atomically and leaves no temp file behind', async () => {
    const path = join(dir, 'real.erd.json');
    await writeFile(path, `\ufeff${emptyDocument()}`);
    const before = { ino: await inode(path), dacl: windows && daclOf(path) };
    const session = await openReal(path);

    const { run } = await onNode(session.runTool('erd_add_table', {}));
    const text = await readFile(path, 'utf8');

    expect(JSON.parse(text).doc.tableIds).toEqual(run.createdIds);
    expect(await readdir(dir)).toEqual(['real.erd.json']);
    // A new file took its place, on Windows because its ACL is the folder's.
    expect(await inode(path)).not.toBe(before.ino);
    expect(windows && daclOf(path)).toBe(before.dacl);
    expect(reload(text)).toBe(
      (await onNode(session.read(documentReader('snapshot')))).text
    );
    await onNode(session.close);
  });

  it('keeps a private file private, and needs no reload after its own write', async () => {
    const path = join(dir, 'private.erd.json');
    await writeFile(path, emptyDocument());
    await chmod(path, 0o600);
    // Windows keeps only the read-only flag of a mode, so a private file there
    // is one with an ACL of its own, which a rename would trade for the folder's.
    if (windows) {
      icacls(path, '/inheritance:r', '/grant:r', `${userInfo().username}:(F)`);
    }
    const before = { ino: await inode(path), dacl: windows && daclOf(path) };
    // What the folder gives a new file there depends on the machine, a hosted
    // runner's temp folder handing out its creator's default DACL, not its own.
    const fresh = join(dir, 'fresh.erd.json');
    await writeFile(fresh, '');
    const folderDacl = windows && daclOf(fresh);
    await rm(fresh);
    const session = await openReal(path);

    await onNode(session.runTool('erd_add_table', {}));
    expect((await stat(path)).mode & 0o777).toBe(PRIVATE_MODE);
    if (windows) {
      expect(before.dacl).toMatch(/^D:P/);
      expect(before.dacl).not.toBe(folderDacl);
      expect(daclOf(path)).toBe(before.dacl);
      expect(await inode(path)).toBe(before.ino);
      expect(await readdir(dir)).toEqual(['private.erd.json']);
    }

    // The baseline is the stat of its write, so this holds only if the rename,
    // or the write in place, kept it.
    const undone = await onNode(session.undo);
    expect(undone).toMatchObject({
      result: { label: 'erd_add_table' },
      notes: [],
    });
    expect(JSON.parse(await readFile(path, 'utf8')).doc.tableIds).toEqual([]);
    await onNode(session.close);
  });

  it('refuses a read-only file, leaving it as it was', async () => {
    const path = join(dir, 'locked.erd.json');
    const text = emptyDocument();
    await writeFile(path, text);
    // On Windows this sets the read-only attribute, which node reads as 0o444.
    await chmod(path, 0o444);
    const session = await openReal(path);

    try {
      await expect(
        onNode(session.runTool('erd_add_table', {}))
      ).rejects.toMatchObject({ name: 'SessionError', code: 'readonly' });
      expect(await readFile(path, 'utf8')).toBe(text);
      expect((await stat(path)).mode & 0o777).toBe(0o444);
      expect(await readdir(dir)).toEqual(['locked.erd.json']);
    } finally {
      await onNode(session.close);
      await chmod(path, 0o644);
    }
  });

  // Only Windows refuses a rename over a file another handle holds open; the
  // memory specs above hold the retry on every platform.
  it.runIf(windows)(
    'replaces a document another handle holds open once it is let go',
    async () => {
      const path = join(dir, 'held.erd.json');
      await writeFile(path, emptyDocument());
      const session = await openReal(path);
      const handle = await openFile(path, 'r');
      const released = new Promise<void>(resolve =>
        setTimeout(() => void handle.close().then(resolve), 50)
      );

      const { run } = await onNode(session.runTool('erd_add_table', {}));
      await released;
      expect(JSON.parse(await readFile(path, 'utf8')).doc.tableIds).toEqual(
        run.createdIds
      );
      expect(await readdir(dir)).toEqual(['held.erd.json']);
      await onNode(session.close);
    }
  );

  it.runIf(windows)(
    'gives up on a document held open past the retry window, leaving it as it was',
    async () => {
      const path = join(dir, 'held.erd.json');
      const text = emptyDocument();
      await writeFile(path, text);
      const session = await openReal(path);
      const handle = await openFile(path, 'r');

      try {
        const started = performance.now();
        await expect(
          onNode(session.runTool('erd_add_table', {}))
        ).rejects.toMatchObject({
          reason: { _tag: 'Unknown', cause: { code: 'EPERM' } },
        });
        expect(performance.now() - started).toBeGreaterThan(1_900);
      } finally {
        await handle.close();
      }
      expect(await readFile(path, 'utf8')).toBe(text);
      expect(await readdir(dir)).toEqual(['held.erd.json']);
      await onNode(session.close);
    },
    15_000
  );

  it('tells a write of the same size stamped within the millisecond of its own', async () => {
    const path = join(dir, 'twin.erd.json');
    await writeFile(path, emptyDocument());
    const session = await openReal(path);
    const {
      run: {
        createdIds: [tableId],
      },
    } = await onNode(session.runTool('erd_add_table', {}));

    // The same bytes but for the table id, stamped a quarter millisecond or more
    // away from the session's own write, inside the same millisecond.
    const otherId = `${tableId[0] === 'x' ? 'y' : 'x'}${tableId.slice(1)}`;
    const ours = await stat(path, { bigint: true });
    await writeFile(
      path,
      (await readFile(path, 'utf8')).replaceAll(tableId, otherId)
    );
    const millisecond = ours.mtimeNs / 1_000_000n;
    const fraction = ours.mtimeNs % 1_000_000n < 500_000n ? 750_000n : 250_000n;
    const seconds = Number(millisecond * 1_000_000n + fraction) / 1e9;
    await utimes(path, seconds, seconds);
    const theirs = await stat(path, { bigint: true });
    expect(theirs.size).toBe(ours.size);
    expect(theirs.mtimeNs / 1_000_000n).toBe(millisecond);
    expect(theirs.mtimeNs).not.toBe(ours.mtimeNs);

    const { text, notes } = await onNode(session.read(documentReader('json')));
    expect(JSON.parse(text).doc.tableIds).toEqual([otherId]);
    expect(notes).toEqual([RELOADED_NOTE]);
    await onNode(session.close);
  });
});
