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
import { connectMcp, type McpHarness, settle } from '@/__test-utils__/mcp';
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
  expect(JSON.parse(agent)).toEqual(JSON.parse(hub.webview(path).value));
}

describe('the five scenarios, live through a VS Code hub (AC-M1)', () => {
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
    expect(fk).toMatchObject({ name: 'users_id', dataType: 'BIGINT' });
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
    expect(JSON.parse(io.read(path))).toEqual(
      JSON.parse(hub.webview(path).value)
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

    // A second file of DDL joins the diagram rather than replacing it.
    const added = await mcp.ok('erd_import_sql', {
      path: DOCUMENT,
      value:
        'CREATE TABLE audit_log (id BIGINT NOT NULL PRIMARY KEY, note TEXT);',
      mode: 'append',
    });
    expect(added).toMatchObject({
      mode: 'live',
      batches: 1,
      historyEntries: 1,
    });

    document = await snapshot();
    expect(
      document.tables.map(({ name }: { name: string }) => name).sort()
    ).toEqual(['audit_log', 'orders', 'users']);
    expect(tableNamed(document, 'users')).toMatchObject({
      id: users.id,
      x: users.x,
      y: users.y,
    });
    expect(document.relationships).toHaveLength(1);
    expect(added.createdIds).toContain(tableNamed(document, 'audit_log').id);
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

  it('names a schema from the dictionaries: words, a domain and a term, then logical names', async () => {
    io.put(DOCUMENT, emptyDocument());
    const path = DOCUMENT;

    // The term names its domain by a name an earlier operation adds.
    const dictionaries = await mcp.ok('erd_batch', {
      path,
      operations: [
        { tool: 'erd_add_word', args: { name: 'Member', abbreviation: 'MBR' } },
        { tool: 'erd_add_word', args: { name: 'Number', abbreviation: 'NO' } },
        { tool: 'erd_add_word', args: { name: 'Name', abbreviation: 'NM' } },
        {
          tool: 'erd_add_domain',
          as: 'identifier',
          args: { name: 'Identifier', dataType: 'INT' },
        },
        {
          tool: 'erd_add_term',
          args: { name: 'Member Number', domainName: 'Identifier' },
        },
      ],
    });
    expect(dictionaries).toMatchObject({ mode: 'live', batches: 5 });
    const domain = dictionaries.operations[3].createdIds[0];

    const [members] = (await mcp.ok('erd_add_table', { path })).createdIds;
    await mcp.ok('erd_set_table_logical_name', {
      path,
      tableId: members,
      value: 'Member',
    });
    const columns: string[] = [];
    for (const value of ['Member Number', 'Member Name']) {
      const [id] = (await mcp.ok('erd_add_column', { path, tableId: members }))
        .createdIds;
      await mcp.ok('erd_set_column_logical_name', {
        path,
        tableId: members,
        columnId: id,
        value,
      });
      columns.push(id);
    }
    // A new type of the domain reaches the column the term linked.
    await mcp.ok('erd_update_domain', {
      path,
      domainId: domain,
      dataType: 'BIGINT',
    });

    const document = await snapshot();
    expect(tableNamed(document, 'MBR')).toMatchObject({
      logicalName: 'Member',
      nameDerived: true,
      columns: [
        {
          id: columns[0],
          name: 'MBR_NO',
          logicalName: 'Member Number',
          dataType: 'BIGINT',
          domainId: domain,
          nameDerived: true,
        },
        {
          id: columns[1],
          name: 'MBR_NM',
          logicalName: 'Member Name',
          domainId: '',
          nameDerived: true,
        },
      ],
    });
    expect(document.terms).toMatchObject([
      { name: 'Member Number', physicalName: 'MBR_NO', domainId: domain },
    ]);
    expect(await mcp.ok('erd_list', { path })).toMatchObject({
      wordCount: 3,
      termCount: 1,
      domainCount: 1,
    });
    await expectConverged();

    expect(await mcp.ok('erd_save', { path })).toMatchObject({ saved: true });
    const saved = JSON.parse(io.read(path));
    expect(saved).toEqual(JSON.parse(hub.webview(path).value));
    expect(saved.collections.wordEntities.rows).toHaveLength(3);
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
