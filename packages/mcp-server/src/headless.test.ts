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

import { createAgentPeer } from '@dineug/erd-editor/agent.js';
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
import {
  createMemoryIo,
  fsError,
  type MemoryIo,
} from '@/__test-utils__/memoryIo';
import { nodeIo } from '@/io';
import {
  HEADLESS_SAVE_NOTE,
  openHeadlessSession,
  RELOADED_NOTE,
} from '@/session/headless';

const DOCUMENT = '/work/solo.erd.json';

let io: MemoryIo;
let mcp: McpHarness;

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryIo();
  io.put(DOCUMENT, emptyDocument());
  mcp = await connectMcp({ io });
});

afterEach(async () => {
  await mcp.close();
  vi.restoreAllMocks();
});

/** A document another program wrote: one memo, ids of its own. */
async function withMemo(): Promise<string> {
  const peer = createAgentPeer({ nickname: 'other', presence: false });
  try {
    await peer.runTool('erd_add_memo', {});
    return peer.value;
  } finally {
    peer.destroy();
  }
}

/** What the file on disk reads as, through a fresh engine. */
function reload(text: string) {
  const peer = createAgentPeer({ nickname: 'check', presence: false });
  peer.setInitialValue(text);
  const snapshot = peer.read('snapshot');
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

  it('refuses a document that does not exist', async () => {
    const missing = await mcp.call('erd_add_table', {
      path: '/work/none.erd.json',
    });
    expect(missing.isError).toBe(true);
    expect(missing.json.error.code).toBe('notFound');
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
    const ours = await documentFromSql(SHOP_SQL);
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
    const snapshot = JSON.parse(
      await mcp.text('erd_read', { path: DOCUMENT, format: 'snapshot' })
    );
    expect(snapshot.tables).toEqual([]);
    expect(snapshot.memos).toEqual([]);
  });

  it('takes the baseline before reading, so a write landing in between is kept', async () => {
    const theirs = await withMemo();
    const readFile = io.readFile;
    io.readFile = async path => {
      const text = await readFile(path);
      io.readFile = readFile;
      io.put(path, theirs);
      return text;
    };
    const session = await openHeadlessSession({
      io,
      path: DOCUMENT,
      nickname: 'agent',
    });

    const { run } = await session.runTool('erd_add_table', {});
    const document = JSON.parse(io.read(DOCUMENT));
    expect(document.doc.memoIds).toEqual(JSON.parse(theirs).doc.memoIds);
    expect(document.doc.tableIds).toEqual(run.createdIds);
    await session.close();
  });

  it('keeps the stat of the file it wrote, so a write landing after the rename is loaded', async () => {
    const theirs = await withMemo();
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    const rename = io.rename;
    io.rename = async (from, to) => {
      await rename(from, to);
      io.rename = rename;
      io.put(to, theirs);
    };

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
      const session = await openHeadlessSession({
        io,
        path: DOCUMENT,
        nickname: 'agent',
      });

      await session.runTool('erd_add_table', {});
      expect((await io.stat(DOCUMENT)).mode).toBe(after);
      await session.close();
    }
  });

  it('loads the file again when the write itself fails', async () => {
    const session = await openHeadlessSession({
      io,
      path: DOCUMENT,
      nickname: 'agent',
    });
    const rename = io.rename;
    io.rename = async () => {
      throw fsError('EACCES', DOCUMENT);
    };

    await expect(session.runTool('erd_add_table', {})).rejects.toMatchObject({
      code: 'EACCES',
    });
    io.rename = rename;
    expect(io.files.has('/work/.solo.erd.json.id1.tmp')).toBe(false);
    expect(JSON.parse((await session.read('snapshot')).text).tables).toEqual(
      []
    );
    await session.close();
  });

  it('leaves no temp file and keeps the disk state when the temp write fails', async () => {
    const session = await openHeadlessSession({
      io,
      path: DOCUMENT,
      nickname: 'agent',
    });
    io.writeFile = async path => {
      throw fsError('ENOSPC', path);
    };

    await expect(session.runTool('erd_add_memo', {})).rejects.toMatchObject({
      code: 'ENOSPC',
    });
    expect(JSON.parse((await session.read('snapshot')).text).memos).toEqual([]);
    await session.close();
  });

  it('reports a document deleted between calls', async () => {
    const session = await openHeadlessSession({
      io,
      path: DOCUMENT,
      nickname: 'agent',
    });
    await io.unlink(DOCUMENT);

    await expect(session.runTool('erd_add_memo', {})).rejects.toMatchObject({
      code: 'notFound',
    });
    await session.close();
  });

  it('writes nothing for an undo or redo with nothing to revert', async () => {
    const session = await openHeadlessSession({
      io,
      path: DOCUMENT,
      nickname: 'agent',
    });

    expect((await session.undo()).result.toolName).toBeNull();
    expect((await session.redo()).result.toolName).toBeNull();
    expect(io.writes).toEqual([]);
    await session.close();
  });

  it('refuses to create a document in a folder that does not exist', async () => {
    await expect(
      openHeadlessSession({
        io,
        path: '/nowhere/new.erd.json',
        nickname: 'agent',
        create: true,
      })
    ).rejects.toMatchObject({ code: 'notFound' });
  });

  it('passes other failures of an exclusive create through', async () => {
    io.createFile = async path => {
      throw fsError('EACCES', path);
    };
    await expect(
      openHeadlessSession({
        io,
        path: '/work/new.erd.json',
        nickname: 'agent',
        create: true,
      })
    ).rejects.toMatchObject({ code: 'EACCES' });
  });

  it('passes a read failure other than a missing file through', async () => {
    io.readFile = async path => {
      throw fsError('EACCES', path);
    };
    await expect(
      openHeadlessSession({ io, path: DOCUMENT, nickname: 'agent' })
    ).rejects.toMatchObject({ code: 'EACCES' });
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

  it('replaces the file atomically and leaves no temp file behind', async () => {
    const path = join(dir, 'real.erd.json');
    await writeFile(path, `﻿${emptyDocument()}`);
    const session = await openHeadlessSession({
      io: nodeIo,
      path,
      nickname: 'agent',
    });

    const { run } = await session.runTool('erd_add_table', {});
    const text = await readFile(path, 'utf8');

    expect(JSON.parse(text).doc.tableIds).toEqual(run.createdIds);
    expect(await readdir(dir)).toEqual(['real.erd.json']);
    expect(reload(text)).toBe((await session.read('snapshot')).text);
    await session.close();
  });

  it('keeps a private file private, and needs no reload after its own write', async () => {
    const path = join(dir, 'private.erd.json');
    await writeFile(path, emptyDocument());
    await chmod(path, 0o600);
    const session = await openHeadlessSession({
      io: nodeIo,
      path,
      nickname: 'agent',
    });

    await session.runTool('erd_add_table', {});
    expect((await stat(path)).mode & 0o777).toBe(0o600);

    // The baseline is the temp file's stat, so this holds only if the rename kept it.
    const undone = await session.undo();
    expect(undone).toMatchObject({
      result: { toolName: 'erd_add_table' },
      notes: [],
    });
    expect(JSON.parse(await readFile(path, 'utf8')).doc.tableIds).toEqual([]);
    await session.close();
  });
});
