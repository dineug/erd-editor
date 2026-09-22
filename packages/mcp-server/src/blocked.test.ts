import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { documentFromSql, SHOP_SQL } from '@/__test-utils__/documents';
import { createFakeHub } from '@/__test-utils__/fakeHub';
import { connectMcp, type McpHarness } from '@/__test-utils__/mcp';
import { createMemoryIo, type MemoryIo } from '@/__test-utils__/memoryIo';
import { DISK_READ_NOTE } from '@/session/manager';

const DOCUMENT = '/work/guarded.erd.json';

let io: MemoryIo;
let mcp: McpHarness;
let original: string;

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryIo();
  original = await documentFromSql(SHOP_SQL);
  io.put(DOCUMENT, original);
  createFakeHub(io, { pid: 7171, workspaceFolders: ['/work'], hub: false });
  mcp = await connectMcp({ io });
});

afterEach(async () => {
  await mcp.close();
  vi.restoreAllMocks();
});

describe('a hub false lock over the path (AC-M3, X3)', () => {
  it.each([
    ['erd_add_table', {}],
    ['erd_import_json', { value: '{}' }],
  ])(
    'refuses %s with guidance and leaves the file alone',
    async (name, args) => {
      const refused = await mcp.call(name, { path: DOCUMENT, ...args });

      expect(refused.isError).toBe(true);
      expect(refused.json.error.code).toBe('blocked');
      expect(refused.json.error.message).toContain(
        'turned off or failed to start'
      );
      expect(refused.json.error.message).toContain(
        'dineug.erd-editor.agentHub.enabled'
      );
      expect(io.read(DOCUMENT)).toBe(original);
    }
  );

  it.each(['erd_save', 'erd_undo', 'erd_redo'])(
    'refuses %s too',
    async name => {
      const refused = await mcp.call(name, { path: DOCUMENT });
      expect(refused.json.error.code).toBe('blocked');
    }
  );

  it('refuses to open or create a document there', async () => {
    const refused = await mcp.call('erd_open_document', {
      path: '/work/fresh',
      create: true,
    });
    expect(refused.json.error.code).toBe('blocked');
    expect(io.files.has('/work/fresh.erd.json')).toBe(false);
  });

  it('still reads, from disk, and says unsaved editor edits are missing', async () => {
    const read = await mcp.call('erd_read', {
      path: DOCUMENT,
      format: 'snapshot',
    });

    expect(read.isError).toBe(false);
    expect(
      read.json.tables.map(({ name }: { name: string }) => name).sort()
    ).toEqual(['orders', 'users']);
    expect(JSON.parse(read.texts[1])).toEqual({ notes: [DISK_READ_NOTE] });
  });

  it('refuses to read a file the engine would load as an empty diagram', async () => {
    const truncated = original.slice(0, Math.floor(original.length * 0.7));
    io.put(DOCUMENT, truncated);

    const refused = await mcp.call('erd_read', {
      path: DOCUMENT,
      format: 'snapshot',
    });

    expect(refused.isError).toBe(true);
    expect(refused.json.error.code).toBe('invalidDocument');
    expect(io.read(DOCUMENT)).toBe(truncated);
  });

  it('lists the files on disk with the same warning', async () => {
    const listed = await mcp.ok('erd_list_documents');

    expect(listed.mode).toBe('blocked');
    expect(listed.documents).toEqual([
      {
        path: DOCUMENT,
        open: false,
        active: false,
        dirty: false,
        readonly: false,
      },
    ]);
    expect(listed.notes[0]).toContain('turned off or failed to start');
  });
});
