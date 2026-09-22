import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { emptyDocument } from '@/__test-utils__/documents';
import { createFakeHub, type FakeHub } from '@/__test-utils__/fakeHub';
import { connectMcp, type McpHarness, settle } from '@/__test-utils__/mcp';
import { createMemoryIo, type MemoryIo } from '@/__test-utils__/memoryIo';
import { CLOSED_NOTE, RESEED_NOTE } from '@/session/live';

const DOCUMENT = '/work/auto.erd.json';

let io: MemoryIo;
let hub: FakeHub;
let mcp: McpHarness;

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryIo();
  io.put(DOCUMENT, emptyDocument());
  hub = createFakeHub(io, { pid: 5151, workspaceFolders: ['/work'] });
  mcp = await connectMcp({ io });
});

afterEach(async () => {
  await mcp.close();
  hub.destroy();
  vi.restoreAllMocks();
});

describe('a write to a document no editor shows opens one first (AC-H6)', () => {
  it('goes openDocument, join, then the tool, and the editor holds the edit', async () => {
    const added = await mcp.ok('erd_add_table', { path: DOCUMENT });

    // Past the join come the handshake, the edit and the focus, all batches.
    const [open, join, ...batches] = hub.methods();
    expect([open, join]).toEqual(['openDocument', 'join']);
    expect(new Set(batches)).toEqual(new Set(['applyActions']));
    expect(hub.webview(DOCUMENT).state.doc.tableIds).toEqual(added.createdIds);
    expect(io.read(DOCUMENT)).toBe(emptyDocument());
  });

  it('runs nothing and reports the refusal when the editor does not open in time', async () => {
    hub.openFailure = {
      code: 'notOpen',
      message: `No ERD editor on ${DOCUMENT} reported ready within 5000 ms`,
    };
    const before = io.read(DOCUMENT);

    const result = await mcp.call('erd_add_table', { path: DOCUMENT });

    expect(result.isError).toBe(true);
    expect(result.json.error).toEqual({
      code: 'notOpen',
      message: `No ERD editor on ${DOCUMENT} reported ready within 5000 ms`,
    });
    expect(hub.methods()).toEqual(['openDocument']);
    expect(hub.documents.size).toBe(0);
    expect(io.read(DOCUMENT)).toBe(before);
  });

  it('reads without opening an editor', async () => {
    await mcp.text('erd_read', { path: DOCUMENT, format: 'snapshot' });
    await mcp.text('erd_read', { path: DOCUMENT, format: 'sql' });

    expect(hub.methods()).toEqual(['join', 'join']);
    expect(hub.documents.size).toBe(0);
  });

  it('reads through the open editor once joined, with no further requests', async () => {
    hub.open(DOCUMENT);
    await mcp.ok('erd_add_memo', { path: DOCUMENT });
    const requests = hub.methods().length;

    const snapshot = JSON.parse(
      await mcp.text('erd_read', { path: DOCUMENT, format: 'snapshot' })
    );

    expect(snapshot.memos).toHaveLength(1);
    expect(hub.methods()).toHaveLength(requests);
  });

  it('asks openDocument on every write, which answers at once for an open editor', async () => {
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    await mcp.ok('erd_add_table', { path: DOCUMENT });

    const count = (method: string) =>
      hub.methods().filter(name => name === method).length;
    expect(count('openDocument')).toBe(2);
    expect(count('join')).toBe(1);
    expect(hub.methods().at(-1)).toBe('applyActions');
  });

  it('reseeds after the user closed the editor, and says the earlier edits cannot be undone (AC-E8)', async () => {
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    hub.close(DOCUMENT);
    await settle();

    const memo = await mcp.ok('erd_add_memo', { path: DOCUMENT });
    expect(memo.notes).toEqual([CLOSED_NOTE, RESEED_NOTE]);
    expect(hub.webview(DOCUMENT).state.doc.tableIds).toEqual([]);

    expect(await mcp.ok('erd_undo', { path: DOCUMENT })).toMatchObject({
      toolName: 'erd_add_memo',
    });
    const nothing = await mcp.ok('erd_undo', { path: DOCUMENT });
    expect(nothing.toolName).toBeNull();
    expect(nothing.notes[0]).toMatch(/Nothing to undo/);
  });
});
