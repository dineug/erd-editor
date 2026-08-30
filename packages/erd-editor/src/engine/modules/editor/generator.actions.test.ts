import { schemaV3Parser, toJson } from '@dineug/erd-editor-schema';
import { AnyAction, compositionActionsFlat } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { ColumnOption, RelationshipType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  dragstartColumnAction,
  drawStartRelationshipAction,
  focusColumnAction,
  focusTableAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import {
  actions$,
  changeColorAllAction$,
  columnKeyHoverEndAction$,
  columnKeyHoverStartAction$,
  dragoverColumnAction$,
  dragSelectAction$,
  dragstartColumnAction$,
  drawStartAddRelationshipAction$,
  drawStartRelationshipAction$,
  duplicateAction$,
  focusMoveTableAction$,
  initialLoadJsonAction$,
  loadJsonAction$,
  loadSchemaAMLAction$,
  loadSchemaDBMLAction$,
  loadSchemaGraphQLAction$,
  loadSchemaSQLAction$,
  moveAllAction$,
  pasteEntitiesAction$,
  removeSelectedAction$,
  unselectAllAction$,
} from '@/engine/modules/editor/generator.actions';
import { FocusType, MoveKey, SelectType } from '@/engine/modules/editor/state';
import {
  addMemoAction,
  changeMemoColorAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeDatabaseNameAction,
  changeZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableColorAction,
  changeTableCommentAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnAutoIncrementAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
} from '@/engine/modules/table-column/atom.actions';
import { createRxStore, RxStore } from '@/engine/rx-store';
import { createStore, Store } from '@/engine/store';
import { bHas } from '@/utils/bit';
import { createTable } from '@/utils/collection/table.entity';
import {
  ClipboardColumn,
  ClipboardMemo,
  ClipboardTable,
  createPayload,
  PayloadKind,
} from '@/utils/table-clipboard';
import { entitiesCopyToPayload } from '@/utils/table-clipboard/copy';

const toWidth = (text: string) => text.length * 10;

function createTestStore(): Store {
  return createStore({ toWidth, clock: new Clock() });
}

function flatten(store: Store, action: any): AnyAction[] {
  return compositionActionsFlat(store.state, store.context, [action]);
}

function typesOf(store: Store, action: any): string[] {
  return flatten(store, action).map(({ type }) => type);
}

function seedTable(store: Store, id: string, x = 0, y = 0) {
  store.dispatchSync(addTableAction({ id, ui: { x, y, zIndex: 2 } }));
}

function seedMemo(store: Store, id: string, x = 0, y = 0) {
  store.dispatchSync(addMemoAction({ id, ui: { x, y, zIndex: 2 } }));
}

function seedColumn(store: Store, tableId: string, id: string) {
  store.dispatchSync(addColumnAction({ id, tableId }));
}

function tableOf(store: Store, id: string) {
  return store.state.collections.tableEntities[id];
}

function columnOf(store: Store, id: string) {
  return store.state.collections.tableColumnEntities[id];
}

function memoOf(store: Store, id: string) {
  return store.state.collections.memoEntities[id];
}

function clipboardTable(
  sourceId: string,
  x: number,
  y: number,
  rest: Partial<Pick<ClipboardTable, 'name' | 'comment' | 'columnIds'>> = {},
  color = ''
): ClipboardTable {
  return {
    sourceId,
    name: 'table',
    comment: '',
    columnIds: [],
    ...rest,
    ui: { x, y, zIndex: 2, widthName: 60, widthComment: 60, color },
  };
}

function clipboardColumn(
  sourceId: string,
  tableId: string,
  rest: Partial<Omit<ClipboardColumn, 'sourceId' | 'tableId' | 'ui'>> = {}
): ClipboardColumn {
  return {
    sourceId,
    tableId,
    name: '',
    comment: '',
    dataType: '',
    default: '',
    options: 0,
    ...rest,
    ui: {
      keys: 0,
      widthName: 60,
      widthComment: 60,
      widthDataType: 60,
      widthDefault: 60,
    },
  };
}

function clipboardMemo(
  sourceId: string,
  x: number,
  y: number,
  value = '',
  color = ''
): ClipboardMemo {
  return {
    sourceId,
    value,
    ui: { x, y, width: 116, height: 100, zIndex: 2, color },
  };
}

const entitiesPayload = (
  parts: Partial<{
    tables: ClipboardTable[];
    columns: ClipboardColumn[];
    memos: ClipboardMemo[];
  }> = {}
) => createPayload({ kind: PayloadKind.tables, ...parts });

/** The ids doc gained, in document order. */
function addedIds(before: string[], after: string[]): string[] {
  const had = new Set(before);
  return after.filter(id => !had.has(id));
}

let store: Store;

beforeEach(() => {
  store = createTestStore();
});

describe('loadJsonAction$', () => {
  const json = toJson(
    schemaV3Parser({
      settings: { databaseName: 'loaded-db' },
      doc: { tableIds: ['t-new'] },
      collections: {
        tableEntities: {
          't-new': createTable({ id: 't-new', name: 'users' }) as any,
        },
      },
    })
  );

  it('clears the document before loading the new one', () => {
    seedTable(store, 't-old');
    expect(store.state.doc.tableIds).toEqual(['t-old']);

    store.dispatchSync(loadJsonAction$(json));

    expect(store.state.doc.tableIds).toEqual(['t-new']);
    expect(tableOf(store, 't-old')).toBeUndefined();
    expect(tableOf(store, 't-new').name).toBe('users');
    expect(store.state.settings.databaseName).toBe('loaded-db');
    expect(store.state.version).toBe('3.0.0');
  });

  it('emits clear then loadJson', () => {
    expect(typesOf(store, loadJsonAction$(json))).toEqual([
      'editor.clear',
      'editor.loadJson',
    ]);
  });
});

describe('initialLoadJsonAction$', () => {
  const json = toJson(
    schemaV3Parser({
      doc: { memoIds: ['m-new'] },
      collections: {
        memoEntities: {
          'm-new': {
            id: 'm-new',
            value: 'hello',
            ui: {
              x: 1,
              y: 2,
              zIndex: 2,
              width: 116,
              height: 100,
              color: '',
            },
            meta: { updateAt: 0, createAt: 0 },
          } as any,
        },
      },
    })
  );

  it('emits initialClear then initialLoadJson', () => {
    expect(typesOf(store, initialLoadJsonAction$(json))).toEqual([
      'editor.initialClear',
      'editor.initialLoadJson',
    ]);
  });

  it('replaces the document without going through the history actions', () => {
    seedMemo(store, 'm-old');

    store.dispatchSync(initialLoadJsonAction$(json));

    expect(store.state.doc.memoIds).toEqual(['m-new']);
    expect(memoOf(store, 'm-old')).toBeUndefined();
    expect(memoOf(store, 'm-new').value).toBe('hello');
  });
});

describe('moveAllAction$', () => {
  it('moves the selected tables and memos scaled by the zoom level', () => {
    seedTable(store, 't1', 100, 100);
    seedMemo(store, 'm1', 200, 200);
    store.dispatchSync(
      selectAction({ t1: SelectType.table, m1: SelectType.memo })
    );
    store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));

    store.dispatchSync(moveAllAction$(10, 20));

    expect(tableOf(store, 't1').ui.x).toBe(120);
    expect(tableOf(store, 't1').ui.y).toBe(140);
    expect(memoOf(store, 'm1').ui.x).toBe(220);
    expect(memoOf(store, 'm1').ui.y).toBe(240);
  });

  it('does not move unselected entities', () => {
    seedTable(store, 't1', 100, 100);
    seedTable(store, 't2', 300, 300);
    store.dispatchSync(selectAction({ t1: SelectType.table }));

    store.dispatchSync(moveAllAction$(10, 10));

    expect(tableOf(store, 't1').ui.x).toBe(110);
    expect(tableOf(store, 't2').ui.x).toBe(300);
  });

  it('emits nothing when nothing is selected', () => {
    expect(typesOf(store, moveAllAction$(10, 10))).toEqual([]);
  });

  it('emits only table.move when only tables are selected', () => {
    seedTable(store, 't1');
    store.dispatchSync(selectAction({ t1: SelectType.table }));

    expect(typesOf(store, moveAllAction$(1, 1))).toEqual(['table.move']);
  });

  it('emits only memo.move when only memos are selected', () => {
    seedMemo(store, 'm1');
    store.dispatchSync(selectAction({ m1: SelectType.memo }));

    expect(typesOf(store, moveAllAction$(1, 1))).toEqual(['memo.move']);
  });

  it('ignores selection entries that are neither table nor memo', () => {
    store.dispatchSync(selectAction({ x1: 'unknown' as any }));

    expect(typesOf(store, moveAllAction$(1, 1))).toEqual([]);
  });
});

describe('removeSelectedAction$', () => {
  it('removes every selected table and memo', () => {
    seedTable(store, 't1');
    seedTable(store, 't2');
    seedMemo(store, 'm1');
    store.dispatchSync(
      selectAction({ t1: SelectType.table, m1: SelectType.memo })
    );

    store.dispatchSync(removeSelectedAction$());

    expect(store.state.doc.tableIds).toEqual(['t2']);
    expect(store.state.doc.memoIds).toEqual([]);
  });

  it('emits nothing when nothing is selected', () => {
    seedTable(store, 't1');

    expect(typesOf(store, removeSelectedAction$())).toEqual([]);
  });
});

describe('dragSelectAction$', () => {
  // An empty table renders 365x56 and an empty memo 134x134, so their
  // 15x15 center boxes sit near (167.5, 13) and (+67, +67) respectively.
  it('selects the table whose center box overlaps the drag rect', () => {
    seedTable(store, 't1', 0, 0);
    seedMemo(store, 'm1', 5000, 5000);

    store.dispatchSync(dragSelectAction$({ x: 0, y: 0, w: 300, h: 300 }));

    expect(store.state.editor.selectedMap).toEqual({ t1: SelectType.table });
  });

  it('selects the memo whose center box overlaps the drag rect', () => {
    seedTable(store, 't1', 0, 0);
    seedMemo(store, 'm1', 5000, 5000);

    store.dispatchSync(dragSelectAction$({ x: 4900, y: 4900, w: 400, h: 400 }));

    expect(store.state.editor.selectedMap).toEqual({ m1: SelectType.memo });
  });

  it('clears the previous selection and the table focus first', () => {
    seedTable(store, 't1', 0, 0);
    seedMemo(store, 'm1', 5000, 5000);
    store.dispatchSync(selectAction({ m1: SelectType.memo }));
    store.dispatchSync(focusTableAction({ tableId: 't1' }));

    store.dispatchSync(dragSelectAction$({ x: 0, y: 0, w: 300, h: 300 }));

    expect(store.state.editor.selectedMap).toEqual({ t1: SelectType.table });
    expect(store.state.editor.focusTable).toBeNull();
  });

  it('only unselects when the drag rect overlaps nothing', () => {
    seedTable(store, 't1', 0, 0);
    seedMemo(store, 'm1', 0, 0);
    store.dispatchSync(selectAction({ t1: SelectType.table }));

    const types = typesOf(
      store,
      dragSelectAction$({ x: 100000, y: 100000, w: 1, h: 1 })
    );

    expect(types).toEqual(['editor.unselectAll', 'editor.focusTableEnd']);

    store.dispatchSync(dragSelectAction$({ x: 100000, y: 100000, w: 1, h: 1 }));
    expect(store.state.editor.selectedMap).toEqual({});
  });
});

describe('unselectAllAction$', () => {
  it('clears the selection and the focused table', () => {
    seedTable(store, 't1');
    store.dispatchSync(selectAction({ t1: SelectType.table }));
    store.dispatchSync(focusTableAction({ tableId: 't1' }));

    store.dispatchSync(unselectAllAction$());

    expect(store.state.editor.selectedMap).toEqual({});
    expect(store.state.editor.focusTable).toBeNull();
  });
});

describe('focusMoveTableAction$', () => {
  it('emits nothing when no table is focused', () => {
    expect(typesOf(store, focusMoveTableAction$(MoveKey.Tab, false))).toEqual(
      []
    );
  });

  it('adds a column when tabbing off the last table field of a column-less table', () => {
    seedTable(store, 't1');
    store.dispatchSync(
      focusTableAction({ tableId: 't1', focusType: FocusType.tableComment })
    );

    expect(typesOf(store, focusMoveTableAction$(MoveKey.Tab, false))).toEqual([
      'column.add',
      'editor.focusColumn',
    ]);

    store.dispatchSync(focusMoveTableAction$(MoveKey.Tab, false));

    expect(tableOf(store, 't1').columnIds).toHaveLength(1);
    expect(store.state.editor.focusTable?.focusType).toBe(FocusType.columnName);
  });

  it('adds a column when tabbing off the last field of the last column row', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(
      focusColumnAction({
        tableId: 't1',
        columnId: 'c1',
        focusType: FocusType.columnComment,
        $mod: false,
        shiftKey: false,
      })
    );

    store.dispatchSync(focusMoveTableAction$(MoveKey.Tab, false));

    expect(tableOf(store, 't1').columnIds).toHaveLength(2);
  });

  it('moves the focus when the table field is not the last one', () => {
    seedTable(store, 't1');
    store.dispatchSync(
      focusTableAction({ tableId: 't1', focusType: FocusType.tableName })
    );

    expect(typesOf(store, focusMoveTableAction$(MoveKey.Tab, false))).toEqual([
      'editor.focusMoveTable',
    ]);

    store.dispatchSync(focusMoveTableAction$(MoveKey.Tab, false));

    expect(store.state.editor.focusTable?.focusType).toBe(
      FocusType.tableComment
    );
  });

  it('moves the focus backwards for shift+tab instead of adding a column', () => {
    seedTable(store, 't1');
    store.dispatchSync(
      focusTableAction({ tableId: 't1', focusType: FocusType.tableComment })
    );

    store.dispatchSync(focusMoveTableAction$(MoveKey.Tab, true));

    expect(tableOf(store, 't1').columnIds).toEqual([]);
    expect(store.state.editor.focusTable?.focusType).toBe(FocusType.tableName);
  });

  it('moves the focus for arrow keys', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(
      focusTableAction({ tableId: 't1', focusType: FocusType.tableName })
    );

    store.dispatchSync(focusMoveTableAction$(MoveKey.ArrowDown, false));

    expect(store.state.editor.focusTable?.columnId).toBe('c1');
  });
});

describe('drawStartRelationshipAction$', () => {
  it('starts drawing when nothing is being drawn', () => {
    store.dispatchSync(drawStartRelationshipAction$(RelationshipType.ZeroN));

    expect(store.state.editor.drawRelationship).toEqual({
      relationshipType: RelationshipType.ZeroN,
      start: null,
      end: { x: 0, y: 0 },
    });
  });

  it('toggles drawing off when the same relationship type is requested', () => {
    store.dispatchSync(drawStartRelationshipAction$(RelationshipType.ZeroN));

    expect(
      typesOf(store, drawStartRelationshipAction$(RelationshipType.ZeroN))
    ).toEqual(['editor.drawEndRelationship']);

    store.dispatchSync(drawStartRelationshipAction$(RelationshipType.ZeroN));

    expect(store.state.editor.drawRelationship).toBeNull();
  });

  it('switches to the new relationship type', () => {
    store.dispatchSync(drawStartRelationshipAction$(RelationshipType.ZeroN));
    store.dispatchSync(drawStartRelationshipAction$(RelationshipType.OneN));

    expect(store.state.editor.drawRelationship?.relationshipType).toBe(
      RelationshipType.OneN
    );
  });
});

describe('drawStartAddRelationshipAction$', () => {
  it('emits nothing for an unknown table', () => {
    expect(typesOf(store, drawStartAddRelationshipAction$('ghost'))).toEqual(
      []
    );
  });

  it('still creates the primary key column when no draw is in progress', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');

    store.dispatchSync(drawStartAddRelationshipAction$('t1'));

    // drawStartAddRelationship is a no-op without an active draw, but the
    // generated primary key column is kept anyway.
    expect(store.state.editor.drawRelationship).toBeNull();
    expect(tableOf(store, 't1').columnIds).toHaveLength(2);
  });

  it('creates a primary key column when the table has none', () => {
    seedTable(store, 't1', 30, 40);
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(
      drawStartRelationshipAction({
        relationshipType: RelationshipType.ZeroN,
      })
    );

    store.dispatchSync(drawStartAddRelationshipAction$('t1'));

    const columnIds = tableOf(store, 't1').columnIds;
    expect(columnIds).toHaveLength(2);

    const addedId = columnIds[1];
    expect(
      bHas(columnOf(store, addedId).options, ColumnOption.primaryKey)
    ).toBe(true);
    expect(store.state.editor.focusTable?.columnId).toBe(addedId);
    expect(store.state.editor.drawRelationship?.start).toEqual({
      tableId: 't1',
      x: 30,
      y: 40,
    });
  });

  it('reuses the existing primary key column', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true })
    );
    store.dispatchSync(
      drawStartRelationshipAction({
        relationshipType: RelationshipType.ZeroN,
      })
    );

    expect(typesOf(store, drawStartAddRelationshipAction$('t1'))).toEqual([
      'editor.drawStartAddRelationship',
    ]);

    store.dispatchSync(drawStartAddRelationshipAction$('t1'));

    expect(tableOf(store, 't1').columnIds).toEqual(['c1']);
  });
});

describe('changeColorAllAction$', () => {
  it('recolors every selected table and memo', () => {
    seedTable(store, 't1');
    seedTable(store, 't2');
    seedMemo(store, 'm1');
    store.dispatchSync(
      selectAction({ t1: SelectType.table, m1: SelectType.memo })
    );

    store.dispatchSync(changeColorAllAction$('#ff0000'));

    expect(tableOf(store, 't1').ui.color).toBe('#ff0000');
    expect(memoOf(store, 'm1').ui.color).toBe('#ff0000');
    expect(tableOf(store, 't2').ui.color).toBe('');
  });

  it('emits nothing when nothing is selected', () => {
    seedTable(store, 't1');

    expect(typesOf(store, changeColorAllAction$('#ff0000'))).toEqual([]);
  });
});

describe('loadSchemaSQLAction$', () => {
  const sql = `CREATE TABLE users (
  id INT NOT NULL,
  name VARCHAR(50),
  PRIMARY KEY (id)
);`;

  it('imports the DDL, keeps the current settings and sorts the tables', () => {
    store.dispatchSync(changeDatabaseNameAction({ value: 'keep-me' }));

    store.dispatchSync(loadSchemaSQLAction$(sql));

    const tables = Object.values(store.state.collections.tableEntities);
    expect(tables.map(({ name }) => name)).toEqual(['users']);
    expect(store.state.doc.tableIds).toHaveLength(1);
    expect(store.state.settings.databaseName).toBe('keep-me');
    expect(tables[0].ui.x).toBe(50);
    expect(tables[0].ui.y).toBe(50);
  });

  it('emits clear, loadJson and sortTable', () => {
    expect(typesOf(store, loadSchemaSQLAction$(sql))).toEqual([
      'editor.clear',
      'editor.loadJson',
      'table.sort',
    ]);
  });
});

describe('loadSchemaGraphQLAction$', () => {
  const sdl = `type User {
  id: ID!
  name: String
}`;

  it('imports the SDL, keeps the current settings and sorts the tables', () => {
    store.dispatchSync(changeDatabaseNameAction({ value: 'keep-me' }));

    store.dispatchSync(loadSchemaGraphQLAction$(sdl));

    const tables = Object.values(store.state.collections.tableEntities);
    expect(tables.map(({ name }) => name)).toEqual(['User']);
    expect(store.state.doc.tableIds).toHaveLength(1);
    expect(store.state.settings.databaseName).toBe('keep-me');
  });

  it('emits clear, loadJson and sortTable', () => {
    expect(typesOf(store, loadSchemaGraphQLAction$(sdl))).toEqual([
      'editor.clear',
      'editor.loadJson',
      'table.sort',
    ]);
  });

  // Unified with loadSchemaSQLAction$: input the parser cannot read loads an
  // empty document rather than being refused, and undo puts the diagram back.
  it('loads an empty document for SDL that declares no object type', () => {
    seedTable(store, 't1');

    store.dispatchSync(
      loadSchemaGraphQLAction$('type Query { hello: String }')
    );

    expect(store.state.doc.tableIds).toEqual([]);
  });

  it('loads an empty document for SDL it cannot parse', () => {
    seedTable(store, 't1');

    store.dispatchSync(
      loadSchemaGraphQLAction$('model User {\n  id Int @id\n}')
    );

    expect(store.state.doc.tableIds).toEqual([]);
  });
});

describe('loadSchemaDBMLAction$', () => {
  const dbml = `Table users {
  id int [pk]
  name varchar
}`;

  it('imports the DBML, keeps the current settings and sorts the tables', () => {
    store.dispatchSync(changeDatabaseNameAction({ value: 'keep-me' }));

    store.dispatchSync(loadSchemaDBMLAction$(dbml));

    const tables = Object.values(store.state.collections.tableEntities);
    expect(tables.map(({ name }) => name)).toEqual(['users']);
    expect(store.state.doc.tableIds).toHaveLength(1);
    expect(store.state.settings.databaseName).toBe('keep-me');
  });

  it('emits clear, loadJson and sortTable', () => {
    expect(typesOf(store, loadSchemaDBMLAction$(dbml))).toEqual([
      'editor.clear',
      'editor.loadJson',
      'table.sort',
    ]);
  });

  // Unified with loadSchemaSQLAction$: input the parser cannot read loads an
  // empty document rather than being refused, and undo puts the diagram back.
  it('loads an empty document for text that declares no table', () => {
    seedTable(store, 't1');

    store.dispatchSync(
      loadSchemaDBMLAction$("Project p { database_type: 'X' }")
    );

    expect(store.state.doc.tableIds).toEqual([]);
  });

  it('loads an empty document for text it cannot read as DBML', () => {
    seedTable(store, 't1');

    store.dispatchSync(loadSchemaDBMLAction$('CREATE TABLE users (id INT);'));

    expect(store.state.doc.tableIds).toEqual([]);
  });
});

describe('loadSchemaAMLAction$', () => {
  const aml = `users
  id int pk
  name varchar`;

  it('imports the AML, keeps the current settings and sorts the tables', () => {
    store.dispatchSync(changeDatabaseNameAction({ value: 'keep-me' }));

    store.dispatchSync(loadSchemaAMLAction$(aml));

    const tables = Object.values(store.state.collections.tableEntities);
    expect(tables.map(({ name }) => name)).toEqual(['users']);
    expect(store.state.doc.tableIds).toHaveLength(1);
    expect(store.state.settings.databaseName).toBe('keep-me');
  });

  it('emits clear, loadJson and sortTable', () => {
    expect(typesOf(store, loadSchemaAMLAction$(aml))).toEqual([
      'editor.clear',
      'editor.loadJson',
      'table.sort',
    ]);
  });

  // Unified with loadSchemaSQLAction$: input the parser cannot read loads an
  // empty document rather than being refused, and undo puts the diagram back.
  it('loads an empty document for text that declares no entity', () => {
    seedTable(store, 't1');

    store.dispatchSync(loadSchemaAMLAction$('type uid int'));

    expect(store.state.doc.tableIds).toEqual([]);
  });
});

describe('dragstartColumnAction$', () => {
  it('emits nothing when no table is focused', () => {
    expect(typesOf(store, dragstartColumnAction$(false))).toEqual([]);
  });

  it('emits nothing when the focus is on the table itself', () => {
    seedTable(store, 't1');
    store.dispatchSync(focusTableAction({ tableId: 't1' }));

    expect(typesOf(store, dragstartColumnAction$(false))).toEqual([]);
  });

  it('drags the focused column only', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    seedColumn(store, 't1', 'c2');
    store.dispatchSync(
      focusColumnAction({
        tableId: 't1',
        columnId: 'c1',
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    store.dispatchSync(
      focusColumnAction({
        tableId: 't1',
        columnId: 'c2',
        focusType: FocusType.columnName,
        $mod: true,
        shiftKey: false,
      })
    );

    store.dispatchSync(dragstartColumnAction$(false));

    expect(store.state.editor.draggableColumn).toEqual({
      tableId: 't1',
      columnIds: ['c2'],
    });
    expect(store.state.editor.draggingColumnMap).toEqual({ c2: true });
  });

  it('drags every selected column when $mod is set', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    seedColumn(store, 't1', 'c2');
    store.dispatchSync(
      focusColumnAction({
        tableId: 't1',
        columnId: 'c1',
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    store.dispatchSync(
      focusColumnAction({
        tableId: 't1',
        columnId: 'c2',
        focusType: FocusType.columnName,
        $mod: true,
        shiftKey: false,
      })
    );

    store.dispatchSync(dragstartColumnAction$(true));

    expect(store.state.editor.draggableColumn).toEqual({
      tableId: 't1',
      columnIds: ['c1', 'c2'],
    });
  });
});

describe('dragoverColumnAction$', () => {
  function seedFourColumnTable() {
    seedTable(store, 't1');
    ['c1', 'c2', 'c3', 'c4'].forEach(id => seedColumn(store, 't1', id));
  }

  it('emits nothing when no column is being dragged', () => {
    seedFourColumnTable();

    expect(typesOf(store, dragoverColumnAction$('c1', 't1'))).toEqual([]);
  });

  it('emits nothing when the drag has no column ids', () => {
    seedFourColumnTable();
    store.dispatchSync(dragstartColumnAction({ tableId: 't1', columnIds: [] }));

    expect(typesOf(store, dragoverColumnAction$('c1', 't1'))).toEqual([]);
  });

  it('emits nothing when the source table is unknown', () => {
    seedFourColumnTable();
    store.dispatchSync(
      dragstartColumnAction({ tableId: 'ghost', columnIds: ['c1'] })
    );

    expect(typesOf(store, dragoverColumnAction$('c1', 'ghost'))).toEqual([]);
  });

  it('emits nothing when the dragged column is not in the table', () => {
    seedFourColumnTable();
    store.dispatchSync(
      dragstartColumnAction({ tableId: 't1', columnIds: ['ghost'] })
    );

    expect(typesOf(store, dragoverColumnAction$('c1', 't1'))).toEqual([]);
  });

  it('emits nothing when the target column is not in the table', () => {
    seedFourColumnTable();
    store.dispatchSync(
      dragstartColumnAction({ tableId: 't1', columnIds: ['c1'] })
    );

    expect(typesOf(store, dragoverColumnAction$('ghost', 't1'))).toEqual([]);
  });

  it('reverses the move actions when dragging downwards', () => {
    seedFourColumnTable();
    store.dispatchSync(
      dragstartColumnAction({ tableId: 't1', columnIds: ['c1', 'c2'] })
    );

    store.dispatchSync(dragoverColumnAction$('c4', 't1'));

    expect(tableOf(store, 't1').columnIds).toEqual(['c3', 'c4', 'c1', 'c2']);
  });

  it('keeps the move order when dragging upwards', () => {
    seedFourColumnTable();
    store.dispatchSync(
      dragstartColumnAction({ tableId: 't1', columnIds: ['c3'] })
    );

    store.dispatchSync(dragoverColumnAction$('c1', 't1'));

    expect(tableOf(store, 't1').columnIds).toEqual(['c3', 'c1', 'c2', 'c4']);
  });

  it('emits nothing when the target table is unknown', () => {
    seedFourColumnTable();
    store.dispatchSync(
      dragstartColumnAction({ tableId: 't1', columnIds: ['c1'] })
    );

    expect(typesOf(store, dragoverColumnAction$('c1', 'ghost'))).toEqual([]);
  });

  it('emits nothing when the dragged columns no longer exist', () => {
    seedFourColumnTable();
    seedTable(store, 't2');
    seedColumn(store, 't2', 'x1');
    store.dispatchSync(
      dragstartColumnAction({ tableId: 't1', columnIds: ['ghost'] })
    );

    expect(typesOf(store, dragoverColumnAction$('x1', 't2'))).toEqual([]);
  });

  it('moves the column into the target table at the target position', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(
      changeColumnNameAction({ tableId: 't1', id: 'c1', value: 'age' })
    );
    store.dispatchSync(
      changeColumnDataTypeAction({ tableId: 't1', id: 'c1', value: 'int' })
    );
    store.dispatchSync(
      changeColumnNotNullAction({ tableId: 't1', id: 'c1', value: true })
    );
    store.dispatchSync(
      changeColumnUniqueAction({ tableId: 't1', id: 'c1', value: true })
    );

    seedTable(store, 't2');
    seedColumn(store, 't2', 'x1');
    seedColumn(store, 't2', 'x2');

    store.dispatchSync(
      dragstartColumnAction({ tableId: 't1', columnIds: ['c1'] })
    );
    store.dispatchSync(dragoverColumnAction$('x2', 't2'));

    expect(tableOf(store, 't1').columnIds).toEqual([]);

    const columnIds = tableOf(store, 't2').columnIds;
    expect(columnIds).toHaveLength(3);
    expect(columnIds[0]).toBe('x1');
    expect(columnIds[2]).toBe('x2');

    const movedId = columnIds[1];
    const moved = columnOf(store, movedId);
    expect(moved.name).toBe('age');
    expect(moved.dataType).toBe('int');
    expect(bHas(moved.options, ColumnOption.notNull)).toBe(true);
    expect(bHas(moved.options, ColumnOption.unique)).toBe(true);

    expect(store.state.editor.draggableColumn).toEqual({
      tableId: 't2',
      columnIds: [movedId],
    });
    expect(store.state.editor.focusTable?.tableId).toBe('t2');
  });
});

describe('columnKeyHoverStartAction$ / columnKeyHoverEndAction$', () => {
  function seedRelationship() {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    seedTable(store, 't2');
    seedColumn(store, 't2', 'c2');
    store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't2', columnIds: ['c2'] },
      })
    );
  }

  it('hovers only the column itself when it has no relationship', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');

    store.dispatchSync(columnKeyHoverStartAction$('c1'));

    expect(store.state.editor.hoverColumnMap).toEqual({ c1: true });
    expect(store.state.editor.hoverRelationshipMap).toEqual({});
  });

  it('hovers the whole relationship chain from the start side', () => {
    seedRelationship();

    store.dispatchSync(columnKeyHoverStartAction$('c1'));

    expect(store.state.editor.hoverColumnMap).toEqual({
      c1: true,
      c2: true,
    });
    expect(store.state.editor.hoverRelationshipMap).toEqual({ r1: true });
  });

  it('hovers the whole relationship chain from the end side', () => {
    seedRelationship();

    store.dispatchSync(columnKeyHoverStartAction$('c2'));

    expect(store.state.editor.hoverColumnMap).toEqual({
      c1: true,
      c2: true,
    });
    expect(store.state.editor.hoverRelationshipMap).toEqual({ r1: true });
  });

  it('ignores relationships that do not reference the column', () => {
    seedRelationship();
    store.dispatchSync(
      addRelationshipAction({
        id: 'r2',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 't1', columnIds: ['zz'] },
        end: { tableId: 't2', columnIds: ['yy'] },
      })
    );

    store.dispatchSync(columnKeyHoverStartAction$('c1'));

    expect(store.state.editor.hoverRelationshipMap).toEqual({ r1: true });
  });

  it('clears the hover maps again', () => {
    seedRelationship();
    store.dispatchSync(columnKeyHoverStartAction$('c1'));

    store.dispatchSync(columnKeyHoverEndAction$());

    expect(store.state.editor.hoverColumnMap).toEqual({});
    expect(store.state.editor.hoverRelationshipMap).toEqual({});
  });
});

describe('pasteEntitiesAction$', () => {
  it('emits nothing at all for a payload with no tables and no memos', () => {
    // AC-41. Without the guard the generator still emits unselectAll +
    // select({}) and wipes a selection the user never asked to lose.
    seedTable(store, 't1');
    store.dispatchSync(selectAction({ t1: SelectType.table }));
    const before = { ...store.state.editor.selectedMap };

    const payload = entitiesPayload({
      columns: [clipboardColumn('sc1', 'st1')],
    });

    expect(typesOf(store, pasteEntitiesAction$(payload, 1))).toEqual([]);

    store.dispatchSync(pasteEntitiesAction$(payload, 1));

    expect(store.state.editor.selectedMap).toEqual(before);
    expect(store.state.doc.tableIds).toEqual(['t1']);
  });

  it('creates new tables instead of merging into the selected one', () => {
    // AC-6.
    seedTable(store, 't1', 100, 100);
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(selectAction({ t1: SelectType.table }));

    store.dispatchSync(
      pasteEntitiesAction$(
        entitiesPayload({
          tables: [clipboardTable('st1', 0, 0, { columnIds: ['sc1'] })],
          columns: [clipboardColumn('sc1', 'st1', { name: 'pasted' })],
        }),
        1
      )
    );

    expect(tableOf(store, 't1').columnIds).toEqual(['c1']);
    expect(store.state.doc.tableIds).toHaveLength(2);

    const [copyId] = addedIds(['t1'], store.state.doc.tableIds);
    expect(tableOf(store, copyId).columnIds).toHaveLength(1);
  });

  it('does not append a table its own columns when pasted straight after a copy', () => {
    // AC-7 — the issue #408 trap: the source is still selected at paste time.
    seedTable(store, 't1', 100, 100);
    seedColumn(store, 't1', 'c1');
    seedColumn(store, 't1', 'c2');
    store.dispatchSync(
      changeColumnNameAction({ tableId: 't1', id: 'c1', value: 'id' })
    );
    store.dispatchSync(selectAction({ t1: SelectType.table }));

    const payload = entitiesCopyToPayload(store.state);
    expect(payload).not.toBeNull();

    store.dispatchSync(pasteEntitiesAction$(payload!, 1));

    expect(tableOf(store, 't1').columnIds).toEqual(['c1', 'c2']);

    const [copyId] = addedIds(['t1'], store.state.doc.tableIds);
    const copy = tableOf(store, copyId);
    expect(copy.columnIds).toHaveLength(2);
    expect(columnOf(store, copy.columnIds[0]).name).toBe('id');
    expect(copy.ui.x).toBe(150);
    expect(copy.ui.y).toBe(150);
  });

  it('creates memos alone, without inventing a table', () => {
    // AC-33, paste half: a memo-only copy is still kind: 'tables'.
    seedTable(store, 't1');

    store.dispatchSync(
      pasteEntitiesAction$(
        entitiesPayload({
          memos: [
            clipboardMemo('sm1', 10, 10, 'first'),
            clipboardMemo('sm2', 10, 200, 'second'),
          ],
        }),
        1
      )
    );

    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(store.state.doc.memoIds).toHaveLength(2);
    expect(
      store.state.doc.memoIds.map(id => memoOf(store, id).value).sort()
    ).toEqual(['first', 'second']);
  });

  it('multiplies the round into the offset', () => {
    // AC-9: the round lives here, not in resolvePlacement.
    seedTable(store, 't1', 100, 100);

    store.dispatchSync(
      pasteEntitiesAction$(
        entitiesPayload({ tables: [clipboardTable('t1', 100, 100)] }),
        3
      )
    );

    const [copyId] = addedIds(['t1'], store.state.doc.tableIds);
    expect(tableOf(store, copyId).ui.x).toBe(250);
    expect(tableOf(store, copyId).ui.y).toBe(250);
  });

  it('hands the selection and the focus over to the new entities', () => {
    seedTable(store, 't1', 100, 100);
    store.dispatchSync(selectAction({ t1: SelectType.table }));
    store.dispatchSync(focusTableAction({ tableId: 't1' }));

    store.dispatchSync(
      pasteEntitiesAction$(
        entitiesPayload({
          tables: [clipboardTable('st1', 0, 0)],
          memos: [clipboardMemo('sm1', 0, 300)],
        }),
        1
      )
    );

    const [tableCopyId] = addedIds(['t1'], store.state.doc.tableIds);
    const [memoCopyId] = store.state.doc.memoIds;

    expect(store.state.editor.selectedMap).toEqual({
      [tableCopyId]: SelectType.table,
      [memoCopyId]: SelectType.memo,
    });
    expect(store.state.editor.focusTable).toBeNull();
  });

  it('restores every copied attribute of a table, its columns and a memo', () => {
    // AC-17.
    seedTable(store, 't1', 100, 100);
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(changeTableNameAction({ id: 't1', value: 'users' }));
    store.dispatchSync(
      changeTableCommentAction({ id: 't1', value: 'the users' })
    );
    store.dispatchSync(
      changeTableColorAction({ id: 't1', color: '#ff0000', prevColor: '' })
    );
    store.dispatchSync(
      changeColumnNameAction({ tableId: 't1', id: 'c1', value: 'id' })
    );
    store.dispatchSync(
      changeColumnDataTypeAction({ tableId: 't1', id: 'c1', value: 'int' })
    );
    store.dispatchSync(
      changeColumnDefaultAction({ tableId: 't1', id: 'c1', value: '0' })
    );
    store.dispatchSync(
      changeColumnCommentAction({ tableId: 't1', id: 'c1', value: 'pk' })
    );
    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true })
    );
    store.dispatchSync(
      changeColumnNotNullAction({ tableId: 't1', id: 'c1', value: true })
    );
    store.dispatchSync(
      changeColumnUniqueAction({ tableId: 't1', id: 'c1', value: true })
    );
    store.dispatchSync(
      changeColumnAutoIncrementAction({ tableId: 't1', id: 'c1', value: true })
    );

    seedMemo(store, 'm1', 400, 400);
    store.dispatchSync(changeMemoValueAction({ id: 'm1', value: 'a note' }));
    store.dispatchSync(
      changeMemoColorAction({ id: 'm1', color: '#00ff00', prevColor: '' })
    );

    store.dispatchSync(
      selectAction({ t1: SelectType.table, m1: SelectType.memo })
    );

    store.dispatchSync(
      pasteEntitiesAction$(entitiesCopyToPayload(store.state)!, 1)
    );

    const [tableCopyId] = addedIds(['t1'], store.state.doc.tableIds);
    const [memoCopyId] = addedIds(['m1'], store.state.doc.memoIds);
    const tableCopy = tableOf(store, tableCopyId);
    const memoCopy = memoOf(store, memoCopyId);

    expect(tableCopy.name).toBe('users');
    expect(tableCopy.comment).toBe('the users');
    expect(tableCopy.ui.color).toBe('#ff0000');
    // Stacked above everything that was already there, in the source's own
    // overlap order: both sources sit at zIndex 2, so the tie breaks on id.
    expect(memoCopy.ui.zIndex).toBe(3);
    expect(tableCopy.ui.zIndex).toBe(4);

    const columnCopy = columnOf(store, tableCopy.columnIds[0]);
    expect(columnCopy.name).toBe('id');
    expect(columnCopy.dataType).toBe('int');
    expect(columnCopy.default).toBe('0');
    expect(columnCopy.comment).toBe('pk');
    expect(bHas(columnCopy.options, ColumnOption.primaryKey)).toBe(true);
    expect(bHas(columnCopy.options, ColumnOption.notNull)).toBe(true);
    expect(bHas(columnCopy.options, ColumnOption.unique)).toBe(true);
    expect(bHas(columnCopy.options, ColumnOption.autoIncrement)).toBe(true);

    expect(memoCopy.value).toBe('a note');
    expect(memoCopy.ui.color).toBe('#00ff00');
    expect(memoCopy.ui.width).toBe(memoOf(store, 'm1').ui.width);
    expect(memoCopy.ui.height).toBe(memoOf(store, 'm1').ui.height);

    // The widths are derived, not copied: changeTableName recomputes them.
    // Comparing against a table freshly named the same way is the only check
    // that is not a tautology.
    seedTable(store, 't-ref', 900, 900);
    store.dispatchSync(changeTableNameAction({ id: 't-ref', value: 'users' }));
    expect(tableCopy.ui.widthName).toBe(tableOf(store, 't-ref').ui.widthName);
  });
});

describe('duplicateAction$', () => {
  it('emits nothing when the given ids match no entity', () => {
    seedTable(store, 't1');
    store.dispatchSync(selectAction({ t1: SelectType.table }));

    expect(
      typesOf(
        store,
        duplicateAction$({
          tableIds: ['ghost'],
          offset: { x: 50, y: 50 },
          escapeCollision: true,
        })
      )
    ).toEqual([]);
    expect(store.state.editor.selectedMap).toEqual({ t1: SelectType.table });
  });

  it('emits nothing when both id lists are empty', () => {
    seedTable(store, 't1');

    expect(
      typesOf(
        store,
        duplicateAction$({
          tableIds: [],
          memoIds: [],
          offset: { x: 50, y: 50 },
          escapeCollision: true,
        })
      )
    ).toEqual([]);
  });

  it('duplicates the whole selection, keeping the relative layout', () => {
    // AC-21.
    seedTable(store, 't1', 100, 100);
    seedTable(store, 't2', 300, 250);
    seedMemo(store, 'm1', 500, 400);
    store.dispatchSync(changeTableNameAction({ id: 't1', value: 'one' }));
    store.dispatchSync(changeTableNameAction({ id: 't2', value: 'two' }));
    store.dispatchSync(
      selectAction({
        t1: SelectType.table,
        t2: SelectType.table,
        m1: SelectType.memo,
      })
    );

    store.dispatchSync(
      duplicateAction$({
        tableIds: ['t1', 't2'],
        memoIds: ['m1'],
        offset: { x: 50, y: 50 },
        escapeCollision: true,
      })
    );

    const copyIds = addedIds(['t1', 't2'], store.state.doc.tableIds);
    const [memoCopyId] = addedIds(['m1'], store.state.doc.memoIds);
    expect(copyIds).toHaveLength(2);

    const byName = new Map(
      copyIds.map(id => [tableOf(store, id).name, tableOf(store, id)])
    );
    const one = byName.get('one')!;
    const two = byName.get('two')!;
    const memoCopy = memoOf(store, memoCopyId);

    expect(one.ui.x).toBe(150);
    expect(one.ui.y).toBe(150);
    expect(two.ui.x - one.ui.x).toBe(200);
    expect(two.ui.y - one.ui.y).toBe(150);
    expect(memoCopy.ui.x - one.ui.x).toBe(400);
    expect(memoCopy.ui.y - one.ui.y).toBe(300);
  });

  it('duplicates only the given table, ignoring the wider selection', () => {
    // The context menu path: a right click collapses the selection, so it hands
    // over props.tableId alone.
    seedTable(store, 't1', 100, 100);
    seedTable(store, 't2', 300, 300);
    seedMemo(store, 'm1', 500, 500);
    store.dispatchSync(
      selectAction({
        t1: SelectType.table,
        t2: SelectType.table,
        m1: SelectType.memo,
      })
    );

    store.dispatchSync(
      duplicateAction$({
        tableIds: ['t1'],
        offset: { x: 50, y: 50 },
        escapeCollision: true,
      })
    );

    expect(store.state.doc.tableIds).toHaveLength(3);
    expect(store.state.doc.memoIds).toEqual(['m1']);

    const [copyId] = addedIds(['t1', 't2'], store.state.doc.tableIds);
    expect(store.state.editor.selectedMap).toEqual({
      [copyId]: SelectType.table,
    });
  });

  it('passes escapeCollision straight through instead of inferring it', () => {
    // AC-37: an explicit drag onto an occupied point stays where it was dropped.
    seedTable(store, 't1', 100, 100);
    seedTable(store, 't2', 150, 150);

    store.dispatchSync(
      duplicateAction$({
        tableIds: ['t1'],
        offset: { x: 50, y: 50 },
        escapeCollision: false,
      })
    );

    const [droppedId] = addedIds(['t1', 't2'], store.state.doc.tableIds);
    expect(tableOf(store, droppedId).ui.x).toBe(150);
    expect(tableOf(store, droppedId).ui.y).toBe(150);

    store.dispatchSync(
      duplicateAction$({
        tableIds: ['t1'],
        offset: { x: 50, y: 50 },
        escapeCollision: true,
      })
    );

    const [escapedId] = addedIds(
      ['t1', 't2', droppedId],
      store.state.doc.tableIds
    );
    expect(tableOf(store, escapedId).ui.x).toBe(200);
    expect(tableOf(store, escapedId).ui.y).toBe(200);
  });

  it('keeps the committed coordinates at four decimals', () => {
    // AC-39. Rounding the offset alone is not enough — 0.1 + 0.2 lands on
    // 0.30000000000000004, and that is what would reach ui.x.
    seedTable(store, 't1', 0.1, 0.2);

    store.dispatchSync(
      duplicateAction$({
        tableIds: ['t1'],
        offset: { x: 0.2, y: 0.12345678 },
        escapeCollision: false,
      })
    );

    const [copyId] = addedIds(['t1'], store.state.doc.tableIds);
    const { x, y } = tableOf(store, copyId).ui;

    expect(x).toBe(0.3);
    expect(y).toBe(0.3235);
    expect(Number(x.toFixed(4))).toBe(x);
    expect(Number(y.toFixed(4))).toBe(y);
  });
});

describe('duplicateAction$ history depth', () => {
  const stores: RxStore[] = [];

  function createRxTestStore(): RxStore {
    const rxStore = createRxStore({ toWidth, clock: new Clock() });
    stores.push(rxStore);
    return rxStore;
  }

  afterEach(() => {
    vi.useRealTimers();
    while (stores.length) {
      stores.pop()?.destroy();
    }
  });

  it('records exactly one history command for coloured entities', () => {
    // The colours matter: the changeColor actions are stream actions, so a
    // batch carrying them regroups into a second colour command later and one
    // undo restores only the colour. Hence the assertion past the buffer.
    vi.useFakeTimers();
    const rxStore = createRxTestStore();

    rxStore.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 100, y: 100, zIndex: 2 } })
    );
    rxStore.dispatchSync(
      changeTableColorAction({ id: 't1', color: '#ff0000', prevColor: '' })
    );
    rxStore.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 400, y: 400, zIndex: 2 } })
    );
    rxStore.dispatchSync(
      changeMemoColorAction({ id: 'm1', color: '#00ff00', prevColor: '' })
    );
    vi.advanceTimersByTime(300);

    const size = rxStore.history.size;

    rxStore.dispatchSync(
      duplicateAction$({
        tableIds: ['t1'],
        memoIds: ['m1'],
        offset: { x: 50, y: 50 },
        escapeCollision: true,
      })
    );

    expect(rxStore.state.doc.tableIds).toHaveLength(2);
    expect(rxStore.state.doc.memoIds).toHaveLength(2);
    expect(rxStore.history.size).toBe(size + 1);

    vi.advanceTimersByTime(300);
    expect(rxStore.history.size).toBe(size + 1);

    rxStore.undo();

    expect(rxStore.state.doc.tableIds).toEqual(['t1']);
    expect(rxStore.state.doc.memoIds).toEqual(['m1']);
    expect(rxStore.state.collections.tableEntities['t1'].ui.color).toBe(
      '#ff0000'
    );
  });
});

describe('actions$', () => {
  it('exposes every generator action of the editor module', () => {
    expect(Object.keys(actions$).sort()).toEqual(
      [
        'changeColorAllAction$',
        'columnKeyHoverEndAction$',
        'columnKeyHoverStartAction$',
        'dragSelectAction$',
        'dragoverColumnAction$',
        'dragstartColumnAction$',
        'drawStartAddRelationshipAction$',
        'drawStartRelationshipAction$',
        'duplicateAction$',
        'focusMoveTableAction$',
        'initialLoadJsonAction$',
        'loadJsonAction$',
        'loadSchemaAMLAction$',
        'loadSchemaDBMLAction$',
        'loadSchemaGraphQLAction$',
        'loadSchemaSQLAction$',
        'moveAllAction$',
        'pasteEntitiesAction$',
        'removeSelectedAction$',
        'unselectAllAction$',
      ].sort()
    );
  });
});
