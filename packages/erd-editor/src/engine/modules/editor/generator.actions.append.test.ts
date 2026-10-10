import { toJson } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  APPEND_GAP,
  TABLE_GROUP_PADDING,
  TABLE_GROUP_TITLE_HEIGHT,
  TABLE_SORT_START,
} from '@/constants/layout';
import { ColumnOption, OrderType, RelationshipType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  appendSchemaAction$,
  appendSchemaJsonAction$,
  loadSchemaSQLAction$,
  toSchemaAppend,
} from '@/engine/modules/editor/generator.actions';
import {
  addIndexAction,
  changeIndexNameAction,
  changeIndexUniqueAction,
} from '@/engine/modules/index/atom.actions';
import {
  addIndexColumnAction,
  changeIndexColumnOrderTypeAction,
} from '@/engine/modules/index-column/atom.actions';
import {
  addMemoAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeDatabaseNameAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableGroupAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import {
  addTableGroupAction,
  changeTableGroupNameAction,
} from '@/engine/modules/table-group/atom.actions';
import { createRxStore, RxStore } from '@/engine/rx-store';
import { RootState } from '@/engine/state';
import { getContentRect, unionRect } from '@/konva/scene/contentBounds';
import { getMemoRect, getTableRect } from '@/konva/scene/metrics';
import { bHas } from '@/utils/bit';
import { padRect } from '@/utils/tableGroup';

const toWidth = (text: string) => text.length * 10;

const stores: RxStore[] = [];

function createTestStore(): RxStore {
  const store = createRxStore(
    { toWidth, clock: new Clock() },
    { observable: false }
  );
  stores.push(store);
  return store;
}

afterEach(() => {
  stores.splice(0).forEach(store => store.destroy());
});

function column(tableId: string, id: string, name: string): AnyAction[] {
  return [
    addColumnAction({ id, tableId }),
    changeColumnNameAction({ id, tableId, value: name }),
  ];
}

/** A diagram holding one table, old, at 100, 100, its database named mine. */
function createDiagram(): RxStore {
  const store = createTestStore();
  store.dispatchSync(
    addTableAction({ id: 'old', ui: { x: 100, y: 100, zIndex: 7 } }),
    changeTableNameAction({ id: 'old', value: 'old' }),
    ...column('old', 'old_id', 'id'),
    changeDatabaseNameAction({ value: 'mine' })
  );
  store.resetHistory();
  return store;
}

/**
 * A document with two related tables 500 apart, a unique index in descending
 * order and a memo below the first table, its database named theirs.
 */
function createDocument(): string {
  const store = createTestStore();
  store.dispatchSync(
    addTableAction({ id: 'users', ui: { x: 300, y: 200, zIndex: 2 } }),
    changeTableNameAction({ id: 'users', value: 'users' }),
    ...column('users', 'users_id', 'id'),
    changeColumnPrimaryKeyAction({
      id: 'users_id',
      tableId: 'users',
      value: true,
    }),
    changeColumnNotNullAction({
      id: 'users_id',
      tableId: 'users',
      value: true,
    }),
    addTableAction({ id: 'posts', ui: { x: 800, y: 200, zIndex: 3 } }),
    changeTableNameAction({ id: 'posts', value: 'posts' }),
    ...column('posts', 'posts_id', 'id'),
    ...column('posts', 'posts_user', 'user_id'),
    addRelationshipAction({
      id: 'users_posts',
      relationshipType: RelationshipType.ZeroN,
      start: { tableId: 'users', columnIds: ['users_id'] },
      end: { tableId: 'posts', columnIds: ['posts_user'] },
    }),
    addIndexAction({ id: 'posts_index', tableId: 'posts' }),
    changeIndexNameAction({
      id: 'posts_index',
      tableId: 'posts',
      value: 'posts_user_idx',
    }),
    changeIndexUniqueAction({
      id: 'posts_index',
      tableId: 'posts',
      value: true,
    }),
    addIndexColumnAction({
      id: 'posts_index_user',
      indexId: 'posts_index',
      tableId: 'posts',
      columnId: 'posts_user',
    }),
    changeIndexColumnOrderTypeAction({
      id: 'posts_index_user',
      indexId: 'posts_index',
      columnId: 'posts_user',
      value: OrderType.DESC,
    }),
    addMemoAction({
      id: 'note',
      ui: { x: 300, y: 700, zIndex: 1, width: 200, height: 100, color: '' },
    }),
    changeMemoValueAction({ id: 'note', value: 'ship it' }),
    changeDatabaseNameAction({ value: 'theirs' })
  );
  return toJson(store.state);
}

function tableByName({ doc, collections }: RootState, name: string) {
  const table = doc.tableIds
    .map(id => collections.tableEntities[id])
    .find(table => table.name === name);
  if (!table) throw new Error(`table not found: ${name}`);
  return table;
}

function cornerOf(state: RootState, name: string) {
  const { x, y } = tableByName(state, name).ui;
  return { x, y };
}

/** Where the block an append brings starts, under the diagram as it stands. */
function appendCorner(state: RootState) {
  const content = getContentRect(state)!;
  return { x: content.x, y: content.y + content.height + APPEND_GAP };
}

const UNRELATED_SQL = `
CREATE TABLE users (id INT NOT NULL, name VARCHAR(255), email VARCHAR(255));
CREATE TABLE posts (id INT NOT NULL);
CREATE TABLE tags (id INT NOT NULL, label TEXT);
`;

describe('appendSchemaJsonAction$', () => {
  it('adds every table, column, relationship, index and memo of a document under new ids, the settings left as they are', () => {
    const store = createDiagram();

    store.dispatchSync(appendSchemaJsonAction$(createDocument()));

    const { doc, collections, settings } = store.state;
    const users = tableByName(store.state, 'users');
    const posts = tableByName(store.state, 'posts');
    const [relationshipId] = doc.relationshipIds;
    const relationship = collections.relationshipEntities[relationshipId];
    const index = collections.indexEntities[doc.indexIds[0]];
    const indexColumn =
      collections.indexColumnEntities[index.indexColumnIds[0]];
    const memo = collections.memoEntities[doc.memoIds[0]];

    expect(doc.tableIds).toHaveLength(3);
    expect(doc.tableIds[0]).toBe('old');
    expect([users.id, posts.id]).not.toContain('users');
    expect([users.id, posts.id]).not.toContain('posts');
    expect(
      users.columnIds.map(id => collections.tableColumnEntities[id].name)
    ).toEqual(['id']);
    expect(
      posts.columnIds.map(id => collections.tableColumnEntities[id].name)
    ).toEqual(['id', 'user_id']);
    expect(relationship).toMatchObject({
      relationshipType: RelationshipType.ZeroN,
      start: { tableId: users.id, columnIds: users.columnIds },
      end: { tableId: posts.id, columnIds: [posts.columnIds[1]] },
    });
    expect(index).toMatchObject({
      tableId: posts.id,
      name: 'posts_user_idx',
      unique: true,
    });
    expect(indexColumn).toMatchObject({
      columnId: posts.columnIds[1],
      orderType: OrderType.DESC,
    });
    expect(memo.value).toBe('ship it');
    expect(doc.memoIds).not.toContain('note');
    expect(settings.databaseName).toBe('mine');
    expect(
      bHas(
        collections.tableColumnEntities[users.columnIds[0]].options,
        ColumnOption.primaryKey | ColumnOption.notNull
      )
    ).toBe(true);
  });

  it('stands the block a gap under the diagram in line with its left edge, the file keeping its tables apart', () => {
    const store = createDiagram();
    const corner = appendCorner(store.state);

    store.dispatchSync(appendSchemaJsonAction$(createDocument()));

    const { collections, doc } = store.state;
    const memo = collections.memoEntities[doc.memoIds[0]];
    expect(cornerOf(store.state, 'old')).toEqual({ x: 100, y: 100 });
    expect(cornerOf(store.state, 'users')).toEqual(corner);
    expect(cornerOf(store.state, 'posts')).toEqual({
      x: corner.x + 500,
      y: corner.y,
    });
    expect({ x: memo.ui.x, y: memo.ui.y }).toEqual({
      x: corner.x,
      y: corner.y + 500,
    });
  });

  it('starts the block where an import grid starts in a diagram holding nothing', () => {
    const store = createTestStore();

    store.dispatchSync(appendSchemaJsonAction$(createDocument()));

    expect(cornerOf(store.state, 'users')).toEqual({
      x: TABLE_SORT_START,
      y: TABLE_SORT_START,
    });
    expect(cornerOf(store.state, 'posts')).toEqual({
      x: TABLE_SORT_START + 500,
      y: TABLE_SORT_START,
    });
  });

  it('stacks what it adds over the diagram, in the order the file stacks it', () => {
    const store = createDiagram();

    store.dispatchSync(appendSchemaJsonAction$(createDocument()));

    const { collections, doc } = store.state;
    const memo = collections.memoEntities[doc.memoIds[0]];
    const users = tableByName(store.state, 'users');
    const posts = tableByName(store.state, 'posts');
    expect(memo.ui.zIndex).toBe(8);
    expect(users.ui.zIndex).toBe(9);
    expect(posts.ui.zIndex).toBe(10);
  });

  it('takes the whole append away on one undo', () => {
    const store = createDiagram();
    const before = toJson(store.state);

    store.dispatchSync(appendSchemaJsonAction$(createDocument()));
    expect(store.history.size).toBe(1);
    store.undo();

    expect(store.state.doc.tableIds).toEqual(['old']);
    expect(store.state.doc.relationshipIds).toEqual([]);
    expect(store.state.doc.indexIds).toEqual([]);
    expect(store.state.doc.memoIds).toEqual([]);
    expect(JSON.parse(toJson(store.state)).doc).toEqual(JSON.parse(before).doc);
  });

  it('selects nothing, which the editor does on its own', () => {
    const store = createDiagram();
    const seen: string[] = [];
    store.subscribe(actions => seen.push(...actions.map(({ type }) => type)));

    store.dispatchSync(appendSchemaJsonAction$(createDocument()));

    expect(seen.filter(type => type.startsWith('editor.'))).toEqual([]);
  });

  it.each([
    ['text the parser cannot read', '{"version": "3.0.0",'],
    ['a document holding nothing', '{}'],
  ])('adds nothing for %s', (_, json) => {
    const store = createDiagram();

    store.dispatchSync(appendSchemaJsonAction$(json));

    expect(store.state.doc.tableIds).toEqual(['old']);
    expect(store.history.size).toBe(0);
  });

  it('drops a relationship to a table the document does not bring', () => {
    const store = createDiagram();
    const document = JSON.parse(createDocument());
    document.doc.tableIds = ['posts'];
    delete document.collections.tableEntities.users;

    store.dispatchSync(appendSchemaJsonAction$(JSON.stringify(document)));

    expect(store.state.doc.tableIds).toHaveLength(2);
    expect(store.state.doc.relationshipIds).toEqual([]);
    expect(store.state.doc.indexIds).toHaveLength(1);
  });
});

describe('appendSchemaAction$', () => {
  it('lays a schema out in the grid an import replaces with, under the diagram', () => {
    const store = createDiagram();
    const replaced = createTestStore();
    const corner = appendCorner(store.state);

    store.dispatchSync(appendSchemaAction$('sql', UNRELATED_SQL));
    replaced.dispatchSync(loadSchemaSQLAction$(UNRELATED_SQL));

    for (const name of ['users', 'posts', 'tags']) {
      const grid = cornerOf(replaced.state, name);
      expect(cornerOf(store.state, name)).toEqual({
        x: corner.x + grid.x - TABLE_SORT_START,
        y: corner.y + grid.y - TABLE_SORT_START,
      });
    }
    expect(store.state.settings.databaseName).toBe('mine');
  });

  it.each([
    ['graphql', 'type Account { id: ID! }', 'Account'],
    ['dbml', 'Table accounts {\n  id int\n}', 'accounts'],
    ['aml', 'accounts\n  id int pk', 'accounts'],
  ] as const)('reads %s through its own parser', (type, value, name) => {
    const store = createDiagram();

    store.dispatchSync(appendSchemaAction$(type, value));

    expect(tableByName(store.state, name).columnIds).toHaveLength(1);
    expect(store.state.doc.tableIds).toHaveLength(2);
  });

  it('sends no field a new table or column already starts with', () => {
    const store = createDiagram();
    const seen: AnyAction[] = [];
    store.subscribe(actions => seen.push(...actions));

    store.dispatchSync(
      appendSchemaAction$('sql', 'CREATE TABLE a (id INT NOT NULL, note TEXT);')
    );

    expect(
      seen
        .map(({ type }) => type)
        .filter(type => type !== 'editor.changeHasHistory')
    ).toEqual([
      'table.add',
      'table.changeName',
      'column.add',
      'column.changeName',
      'column.changeDataType',
      'column.changeNotNull',
      'column.add',
      'column.changeName',
      'column.changeDataType',
    ]);
  });

  it('adds nothing for a text that declares no table', () => {
    const store = createDiagram();

    store.dispatchSync(appendSchemaAction$('sql', 'SELECT 1;'));

    expect(store.state.doc.tableIds).toEqual(['old']);
    expect(store.history.size).toBe(0);
  });
});

describe('toSchemaAppend', () => {
  it('takes the points a placement answered, from the corner of their block', () => {
    const store = createDiagram();
    // A placement answers the tables of an import, which brings no memo.
    const schema = JSON.parse(createDocument());
    schema.doc.memoIds = [];
    const document = JSON.stringify(schema);
    const corner = appendCorner(store.state);

    const append = toSchemaAppend(
      store.state,
      document,
      [
        { id: 'users', x: 1000, y: 40 },
        { id: 'posts', x: 400, y: 1040 },
      ],
      store.context
    )!;
    store.dispatchSync(append.actions);

    expect(cornerOf(store.state, 'users')).toEqual({
      x: corner.x + 600,
      y: corner.y,
    });
    expect(cornerOf(store.state, 'posts')).toEqual({
      x: corner.x,
      y: corner.y + 1000,
    });
  });

  it('measures the box what it adds lands in as the scene draws it', () => {
    const store = createDiagram();

    const append = toSchemaAppend(
      store.state,
      createDocument(),
      'file',
      store.context
    )!;
    store.dispatchSync(append.actions);

    const { collections } = store.state;
    const boxes = [
      ...append.tableIds.map(id =>
        getTableRect(store.state, collections.tableEntities[id])
      ),
      ...append.memoIds.map(id => getMemoRect(collections.memoEntities[id])),
    ];
    expect(append.tableIds).toHaveLength(2);
    expect(append.memoIds).toHaveLength(1);
    expect(append.rect).toEqual(boxes.reduce(unionRect));
  });

  it('answers null where nothing is to be added', () => {
    const store = createDiagram();

    expect(toSchemaAppend(store.state, '[', 'file', store.context)).toBeNull();
    expect(toSchemaAppend(store.state, '{}', 'grid', store.context)).toBeNull();
  });
});

/**
 * Two tables 500 apart in a named, coloured group whose rect reaches 24 past
 * the first table's corner, and an empty group far off, stacked under it.
 */
function createGroupedDocument(): string {
  const store = createTestStore();
  store.dispatchSync(
    addTableAction({ id: 'users', ui: { x: 300, y: 200, zIndex: 2 } }),
    changeTableNameAction({ id: 'users', value: 'users' }),
    addTableAction({ id: 'posts', ui: { x: 800, y: 200, zIndex: 3 } }),
    changeTableNameAction({ id: 'posts', value: 'posts' }),
    addTableAction({ id: 'tags', ui: { x: 300, y: 600, zIndex: 4 } }),
    changeTableNameAction({ id: 'tags', value: 'tags' }),
    addTableGroupAction({
      id: 'blog',
      color: '#0090ff',
      ui: { x: 276, y: 176, width: 900, height: 200, zIndex: 5 },
    }),
    changeTableGroupNameAction({ id: 'blog', value: 'blog' }),
    addTableGroupAction({
      id: 'empty',
      ui: { x: 2000, y: 2000, width: 100, height: 100, zIndex: 1 },
    }),
    changeTableGroupAction({ id: 'users', value: 'blog' }),
    changeTableGroupAction({ id: 'posts', value: 'blog' })
  );
  return toJson(store.state);
}

function groupByName({ doc, collections }: RootState, name: string) {
  const group = doc.tableGroupIds
    .map(id => collections.tableGroupEntities[id])
    .find(group => group.name === name);
  if (!group) throw new Error(`group not found: ${name}`);
  return group;
}

describe('appending table groups', () => {
  it('carries each group under a new id, its members put in it by their new ids', () => {
    const store = createDiagram();

    store.dispatchSync(appendSchemaJsonAction$(createGroupedDocument()));

    const { doc } = store.state;
    const blog = groupByName(store.state, 'blog');
    expect(doc.tableGroupIds).toHaveLength(2);
    expect(doc.tableGroupIds).not.toContain('blog');
    expect(blog.color).toBe('#0090ff');
    expect(tableByName(store.state, 'users').groupId).toBe(blog.id);
    expect(tableByName(store.state, 'posts').groupId).toBe(blog.id);
    expect(tableByName(store.state, 'tags').groupId).toBe('');
    expect(tableByName(store.state, 'old').groupId).toBe('');
  });

  it('moves a file group with its block, the block starting at the group corner', () => {
    const store = createDiagram();
    const corner = appendCorner(store.state);

    store.dispatchSync(appendSchemaJsonAction$(createGroupedDocument()));

    expect(groupByName(store.state, 'blog').ui).toMatchObject({
      x: corner.x,
      y: corner.y,
      width: 900,
      height: 200,
    });
    expect(cornerOf(store.state, 'users')).toEqual({
      x: corner.x + 24,
      y: corner.y + 24,
    });
  });

  it('stacks the groups over the groups already there, in the order the file stacks them', () => {
    const store = createDiagram();
    store.dispatchSync(
      addTableGroupAction({
        id: 'mine',
        ui: { x: 0, y: 0, width: 10, height: 10, zIndex: 4 },
      })
    );

    store.dispatchSync(appendSchemaJsonAction$(createGroupedDocument()));

    const { collections, doc } = store.state;
    const [, emptyId, blogId] = doc.tableGroupIds;
    expect(collections.tableGroupEntities[emptyId].ui.zIndex).toBe(5);
    expect(collections.tableGroupEntities[blogId].ui.zIndex).toBe(6);
  });

  it('takes the groups and the memberships away with the rest on one undo', () => {
    const store = createDiagram();

    store.dispatchSync(appendSchemaJsonAction$(createGroupedDocument()));
    expect(store.history.size).toBe(1);
    store.undo();

    expect(store.state.doc.tableIds).toEqual(['old']);
    expect(store.state.doc.tableGroupIds).toEqual([]);
  });

  it('wraps a group around where a placement put its members, starting the block at its corner, and moves an empty one with the block', () => {
    const store = createDiagram();
    const corner = appendCorner(store.state);

    const append = toSchemaAppend(
      store.state,
      createGroupedDocument(),
      [
        { id: 'users', x: 0, y: 0 },
        { id: 'posts', x: 0, y: 400 },
        { id: 'tags', x: 600, y: 0 },
      ],
      store.context
    )!;
    store.dispatchSync(append.actions);

    const { collections } = store.state;
    const users = tableByName(store.state, 'users');
    const posts = tableByName(store.state, 'posts');
    const blog = groupByName(store.state, 'blog');
    const [emptyId] = append.tableGroupIds;
    expect(append.tableGroupIds).toHaveLength(2);
    expect(blog.ui).toMatchObject(
      padRect(
        unionRect(
          getTableRect(store.state, users),
          getTableRect(store.state, posts)
        )
      )
    );
    // The wrapped group reaches past its first member by the padding, and by
    // the title bar on top, so the block starts there and the rest move with it.
    expect(blog.ui).toMatchObject({ x: corner.x, y: corner.y });
    expect(collections.tableGroupEntities[emptyId].ui).toMatchObject({
      x: corner.x + 2000 + TABLE_GROUP_PADDING,
      y: corner.y + 2000 + TABLE_GROUP_PADDING + TABLE_GROUP_TITLE_HEIGHT,
      width: 100,
      height: 100,
    });
    expect(append.rect).toEqual(
      unionRect(append.rect, collections.tableGroupEntities[emptyId].ui)
    );
  });

  it('keeps a group together in the grid, the block starting at its corner', () => {
    const store = createDiagram();
    const corner = appendCorner(store.state);

    store.dispatchSync(
      appendSchemaJsonAction$(createGroupedDocument(), 'grid')
    );

    const blog = groupByName(store.state, 'blog');
    const users = tableByName(store.state, 'users');
    const tags = tableByName(store.state, 'tags');
    expect(blog.ui).toMatchObject({ x: corner.x, y: corner.y });
    expect(cornerOf(store.state, 'users')).toEqual({
      x: corner.x + TABLE_GROUP_PADDING,
      y: corner.y + TABLE_GROUP_PADDING + TABLE_GROUP_TITLE_HEIGHT,
    });
    expect(blog.ui).toMatchObject(
      padRect(
        unionRect(
          getTableRect(store.state, users),
          getTableRect(store.state, tableByName(store.state, 'posts'))
        )
      )
    );
    expect(tags.ui.x).toBeGreaterThan(blog.ui.x + blog.ui.width);
    expect(tags.ui.y).toBe(corner.y);
  });

  it('brings no group from a document without one', () => {
    const store = createDiagram();

    const append = toSchemaAppend(
      store.state,
      createDocument(),
      'file',
      store.context
    )!;

    expect(append.tableGroupIds).toEqual([]);
    expect(
      append.actions.filter(({ type }) => type.startsWith('tableGroup.'))
    ).toEqual([]);
  });
});
