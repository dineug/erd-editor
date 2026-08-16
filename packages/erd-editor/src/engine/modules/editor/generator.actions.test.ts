import { schemaV3Parser, toJson } from '@dineug/erd-editor-schema';
import { AnyAction, compositionActionsFlat } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

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
  focusMoveTableAction$,
  initialLoadJsonAction$,
  loadJsonAction$,
  loadSchemaSQLAction$,
  moveAllAction$,
  removeSelectedAction$,
  unselectAllAction$,
} from '@/engine/modules/editor/generator.actions';
import { FocusType, MoveKey, SelectType } from '@/engine/modules/editor/state';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeDatabaseNameAction,
  changeZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
} from '@/engine/modules/table-column/atom.actions';
import { createStore, Store } from '@/engine/store';
import { bHas } from '@/utils/bit';
import { createTable } from '@/utils/collection/table.entity';

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

    // `drawStartAddRelationship` is a no-op without an active draw, but the
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
        'focusMoveTableAction$',
        'initialLoadJsonAction$',
        'loadJsonAction$',
        'loadSchemaSQLAction$',
        'moveAllAction$',
        'removeSelectedAction$',
        'unselectAllAction$',
      ].sort()
    );
  });
});
