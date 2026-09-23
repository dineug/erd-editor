import { createPeerStore } from '@dineug/erd-editor/peer.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  columnNamed,
  documentFromSql,
  emptyDocument,
  SHOP_SQL,
  tableNamed,
} from '@/__test-utils__/documents';
import { createFakeHub, type FakeHub } from '@/__test-utils__/fakeHub';
import {
  comparable,
  connectMcp,
  type McpHarness,
  settle,
} from '@/__test-utils__/mcp';
import { createMemoryHost, type MemoryHost } from '@/__test-utils__/memoryHost';
import { readDocument } from '@/tools/read';
import { runTool } from '@/tools/run';

const DOCUMENT = '/work/shop.erd.json';

let io: MemoryHost;
let hub: FakeHub;
let mcp: McpHarness;

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryHost();
  hub = createFakeHub(io, { pid: 4242, workspaceFolders: ['/work'] });
  mcp = await connectMcp({ host: io });
});

afterEach(async () => {
  await mcp.close();
  hub.destroy();
  vi.restoreAllMocks();
});

const snapshot = async (path = DOCUMENT) =>
  JSON.parse(await mcp.text('erd_read', { path, format: 'snapshot' }));

/** The agent's document and the editor's, meta aside, which must be equal. */
async function expectConverged(path = DOCUMENT) {
  await settle();
  const agent = await mcp.text('erd_read', { path, format: 'json' });
  expect(comparable(agent)).toEqual(comparable(hub.webview(path).value));
}

describe('the four scenarios, live through a VS Code hub (AC-M1)', () => {
  it('designs a new schema in conversation: tables, columns and a relationship', async () => {
    const opened = await mcp.ok('erd_open_document', {
      path: 'shop',
      create: true,
    });
    expect(opened).toMatchObject({
      mode: 'live',
      path: DOCUMENT,
      created: true,
      opened: true,
    });

    const path = DOCUMENT;
    const [users] = (await mcp.ok('erd_add_table', { path })).createdIds;
    await mcp.ok('erd_change_table_name', {
      path,
      tableId: users,
      value: 'users',
    });
    const [id] = (await mcp.ok('erd_add_column', { path, tableId: users }))
      .createdIds;
    await mcp.ok('erd_change_column_name', {
      path,
      tableId: users,
      columnId: id,
      value: 'id',
    });
    await mcp.ok('erd_change_column_data_type', {
      path,
      tableId: users,
      columnId: id,
      value: 'BIGINT',
    });
    await mcp.ok('erd_set_column_primary_key', {
      path,
      tableId: users,
      columnId: id,
      value: true,
    });

    const [orders] = (await mcp.ok('erd_add_table', { path })).createdIds;
    await mcp.ok('erd_change_table_name', {
      path,
      tableId: orders,
      value: 'orders',
    });
    const related = await mcp.ok('erd_add_relationship', {
      path,
      startTableId: users,
      endTableId: orders,
      relationshipType: 'OneN',
    });
    expect(related).toMatchObject({
      mode: 'live',
      batches: 1,
      historyEntries: 1,
    });

    const document = await snapshot();
    const fk = tableNamed(document, 'orders').columns[0];
    expect(tableNamed(document, 'users').columns).toMatchObject([
      { name: 'id', dataType: 'BIGINT', primaryKey: true },
    ]);
    expect(fk).toMatchObject({ dataType: 'BIGINT' });
    expect(document.relationships).toMatchObject([
      {
        relationshipType: 'OneN',
        start: { tableId: users, columnIds: [id] },
        end: { tableId: orders, columnIds: [fk.id] },
      },
    ]);
    expect(related.createdIds).toEqual(
      expect.arrayContaining([fk.id, document.relationships[0].id])
    );
    await expectConverged();

    expect(io.read(path)).not.toContain('orders');
    expect(await mcp.ok('erd_save', { path })).toEqual({
      tool: 'erd_save',
      mode: 'live',
      saved: true,
    });
    expect(comparable(io.read(path))).toEqual(
      comparable(hub.webview(path).value)
    );
  });

  it('builds the diagram from DDL found in the codebase, then links existing foreign keys', async () => {
    io.put(DOCUMENT, emptyDocument());

    const imported = await mcp.ok('erd_import_sql', {
      path: DOCUMENT,
      value: SHOP_SQL.replace(
        /,\s*CONSTRAINT fk_orders_users[^)]*\)[^)]*\)/,
        ''
      ),
    });
    expect(imported).toMatchObject({ mode: 'live', batches: 1 });
    expect(hub.methods()).toEqual(
      expect.arrayContaining(['openDocument', 'join', 'applyActions'])
    );

    let document = await snapshot();
    expect(document.relationships).toEqual([]);
    const users = tableNamed(document, 'users');
    const orders = tableNamed(document, 'orders');

    await mcp.ok('erd_link_columns', {
      path: DOCUMENT,
      startTableId: users.id,
      startColumnIds: [columnNamed(users, 'id').id],
      endTableId: orders.id,
      endColumnIds: [columnNamed(orders, 'user_id').id],
      relationshipType: 'ZeroN',
    });

    document = await snapshot();
    expect(document.relationships).toMatchObject([
      {
        relationshipType: 'ZeroN',
        start: { tableId: users.id },
        end: {
          tableId: orders.id,
          columnIds: [columnNamed(orders, 'user_id').id],
        },
      },
    ]);
    await expectConverged();
  });

  it('refactors an existing diagram by id while the user edits it too', async () => {
    io.put(DOCUMENT, documentFromSql(SHOP_SQL));
    hub.open(DOCUMENT);

    const before = await snapshot();
    const users = tableNamed(before, 'users');
    const orders = tableNamed(before, 'orders');
    const path = DOCUMENT;

    await mcp.ok('erd_change_table_name', {
      path,
      tableId: orders.id,
      value: 'purchases',
    });
    await mcp.ok('erd_remove_columns', {
      path,
      tableId: orders.id,
      columnIds: [columnNamed(orders, 'total').id],
    });
    await mcp.ok('erd_change_relationship_type', {
      path,
      relationshipId: before.relationships[0].id,
      relationshipType: 'OneOnly',
    });

    runTool(hub.webview(path), 'erd_change_table_name', {
      tableId: users.id,
      value: 'members',
    });
    await settle();

    const moved = await mcp.ok('erd_move_table', {
      path,
      tableId: users.id,
      x: 900,
      y: 40,
    });
    expect(moved.historyEntries).toBe(1);
    const undone = await mcp.ok('erd_undo', { path });
    expect(undone).toMatchObject({ toolName: 'erd_move_table', entries: 1 });

    const after = await snapshot();
    expect(tableNamed(after, 'members')).toMatchObject({
      x: users.x,
      y: users.y,
    });
    expect(
      tableNamed(after, 'purchases').columns.map(({ name }) => name)
    ).toEqual(['id', 'user_id']);
    expect(after.relationships[0].relationshipType).toBe('OneOnly');
    await expectConverged();
  });

  it('generates code from the diagram without opening an editor', async () => {
    const text = documentFromSql(SHOP_SQL);
    io.put(DOCUMENT, text);

    const sql = await mcp.text('erd_read', {
      path: DOCUMENT,
      format: 'sql',
      vendor: 'PostgreSQL',
    });
    const reference = createPeerStore({
      nickname: 'reference',
      presence: false,
    });
    reference.setInitialValue(text);

    expect(sql).toBe(readDocument(reference.state, 'sql', 'PostgreSQL'));
    expect(sql).toMatch(/CREATE TABLE "?users"?/);
    expect(sql).toContain('FOREIGN KEY');

    const document = await snapshot();
    expect(
      document.tables.map(({ name }: { name: string }) => name).sort()
    ).toEqual(['orders', 'users']);
    expect(hub.documents.size).toBe(0);
    expect(hub.methods()).not.toContain('openDocument');
    reference.destroy();
  });
});
