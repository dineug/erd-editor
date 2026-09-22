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
import { connectMcp, type McpHarness } from '@/__test-utils__/mcp';
import { createMemoryIo, type MemoryIo } from '@/__test-utils__/memoryIo';
import { createEmptyDocument } from '@/session/disk';

let io: MemoryIo;
let mcp: McpHarness;

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryIo();
  mcp = await connectMcp({ io });
});

afterEach(async () => {
  await mcp.close();
  vi.restoreAllMocks();
});

describe('erd_open_document with create (AC-M7)', () => {
  it('refuses to create in a folder that does not exist', async () => {
    const refused = await mcp.call('erd_open_document', {
      path: 'models/schema',
      create: true,
    });

    expect(refused.json.error).toEqual({
      code: 'notFound',
      message: 'The folder of /work/models/schema.erd.json does not exist',
    });
  });

  it('creates in an existing folder, $schema stamp included', async () => {
    const opened = await mcp.ok('erd_open_document', {
      path: 'schema',
      create: true,
    });
    const bytes = io.read('/work/schema.erd.json');

    expect(opened).toMatchObject({
      created: true,
      path: '/work/schema.erd.json',
    });
    expect(bytes).toBe(createEmptyDocument());
    expect(JSON.parse(bytes).$schema).toMatch(/json-schema\/schema\.json$/);
  });

  it('opens an existing document as it is, creating nothing', async () => {
    io.put(
      '/work/kept.erd',
      emptyDocument().replace('"version"', '"version" ')
    );
    const before = io.read('/work/kept.erd');

    const opened = await mcp.ok('erd_open_document', {
      path: '/work/kept.erd',
      create: true,
    });

    expect(opened).toMatchObject({ created: false, mode: 'headless' });
    expect(io.read('/work/kept.erd')).toBe(before);
  });

  it('creates the file again when it was deleted under an open session', async () => {
    await mcp.ok('erd_open_document', { path: 'again', create: true });
    await mcp.ok('erd_add_table', { path: 'again.erd.json' });
    await io.unlink('/work/again.erd.json');

    const reopened = await mcp.ok('erd_open_document', {
      path: 'again',
      create: true,
    });
    expect(reopened).toMatchObject({ mode: 'headless', created: true });
    expect(io.read('/work/again.erd.json')).toBe(createEmptyDocument());

    const added = await mcp.ok('erd_add_table', { path: 'again.erd.json' });
    expect(JSON.parse(io.read('/work/again.erd.json')).doc.tableIds).toEqual(
      added.createdIds
    );
  });

  it('keeps the session and its undo history on a create over a file that is there', async () => {
    await mcp.ok('erd_open_document', { path: 'kept', create: true });
    const [tableId] = (await mcp.ok('erd_add_table', { path: 'kept.erd.json' }))
      .createdIds;

    expect(
      await mcp.ok('erd_open_document', { path: 'kept', create: true })
    ).toMatchObject({ created: false });
    expect(await mcp.ok('erd_undo', { path: 'kept.erd.json' })).toMatchObject({
      toolName: 'erd_add_table',
    });
    expect(
      JSON.parse(io.read('/work/kept.erd.json')).doc.tableIds
    ).not.toContain(tableId);
  });

  it('refuses a path that is not an ERD document, with or without create', async () => {
    for (const args of [
      { path: 'schema.sql', create: true },
      { path: 'notes' },
      { path: '   ' },
    ]) {
      const refused = await mcp.call('erd_open_document', args);
      expect(refused.json.error.code).toBe('invalidPath');
    }
    expect(io.writes).toEqual([]);
  });

  it('asks the hub to create it, handing the empty document bytes', async () => {
    const hub = createFakeHub(io, { pid: 2323, workspaceFolders: ['/work'] });

    const opened = await mcp.ok('erd_open_document', {
      path: 'live',
      create: true,
    });

    expect(opened).toEqual({
      mode: 'live',
      path: '/work/live.erd.json',
      created: true,
      opened: true,
    });
    expect(io.read('/work/live.erd.json')).toBe(createEmptyDocument());
    expect(hub.webview('/work/live.erd.json').value).toContain('"$schema"');
    hub.destroy();
  });

  it('opens an existing document in the editor without create', async () => {
    io.put('/work/there.erd.json', emptyDocument());
    const hub = createFakeHub(io, { pid: 2424, workspaceFolders: ['/work'] });

    expect(
      await mcp.ok('erd_open_document', { path: 'there.erd.json' })
    ).toMatchObject({ mode: 'live', created: false, opened: true });
    expect(
      await mcp.ok('erd_open_document', { path: 'there.erd.json' })
    ).toMatchObject({ opened: false });
    hub.destroy();
  });
});
