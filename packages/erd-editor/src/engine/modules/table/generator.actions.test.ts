import { AnyAction, compositionActionsFlat } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vitest';

import { START_ADD, START_X, START_Y } from '@/constants/layout';
import { ColumnOption, RelationshipType, Show } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
  focusColumnAction,
  focusTableAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import { addIndexAction } from '@/engine/modules/index/atom.actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  actions$,
  addTableAction$,
  pasteTableAction$,
  removeTableAction$,
  selectTableAction$,
} from '@/engine/modules/table/generator.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { createStore, Store } from '@/engine/store';
import { Column } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { createColumn } from '@/utils/collection/tableColumn.entity';

const toWidth = (text: string) => text.length * 10;

function createTestStore(): Store {
  return createStore({ toWidth, clock: new Clock() });
}

function flatten(store: Store, action: any, state: any = store.state) {
  return compositionActionsFlat(state, store.context, [action]) as AnyAction[];
}

function typesOf(store: Store, action: any, state: any = store.state) {
  return flatten(store, action, state).map(({ type }) => type);
}

function seedTable(store: Store, id: string, x = 0, y = 0, zIndex = 2) {
  store.dispatchSync(addTableAction({ id, ui: { x, y, zIndex } }));
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

function columnsOf(store: Store, tableId: string) {
  return tableOf(store, tableId).columnIds.map(id => columnOf(store, id));
}

function makeColumn(value: Partial<Column>): Column {
  return createColumn(value as any);
}

let store: Store;

beforeEach(() => {
  store = createTestStore();
});

describe('addTableAction$', () => {
  it('emits unselectAll, select, add and focus in order', () => {
    expect(typesOf(store, addTableAction$())).toEqual([
      'editor.unselectAll',
      'editor.select',
      'table.add',
      'editor.focusTable',
    ]);
  });

  it('adds a table at the start point, selects and focuses it', () => {
    store.dispatchSync(addTableAction$());

    const tableIds = store.state.doc.tableIds;
    expect(tableIds).toHaveLength(1);

    const id = tableIds[0];
    const table = tableOf(store, id);
    expect(table.ui.x).toBe(START_X);
    expect(table.ui.y).toBe(START_Y);
    expect(table.ui.zIndex).toBe(2);
    expect(store.state.editor.selectedMap).toEqual({ [id]: SelectType.table });
    expect(store.state.editor.focusTable?.tableId).toBe(id);
  });

  it('shifts the point and bumps the zIndex past the existing entities', () => {
    seedTable(store, 't1', START_X, START_Y, 5);
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 9 } })
    );

    store.dispatchSync(addTableAction$());

    const id = store.state.doc.tableIds.filter(it => it !== 't1')[0];
    const table = tableOf(store, id);
    expect(table.ui.x).toBe(START_X + START_ADD);
    expect(table.ui.y).toBe(START_Y + START_ADD);
    expect(table.ui.zIndex).toBe(10);
  });

  it('clears the previous selection', () => {
    seedTable(store, 't1');
    store.dispatchSync(selectAction({ t1: SelectType.table }));

    store.dispatchSync(addTableAction$());

    expect(store.state.editor.selectedMap.t1).toBeUndefined();
  });
});

describe('removeTableAction$', () => {
  function seedGraph() {
    seedTable(store, 't1');
    seedTable(store, 't2');
    seedTable(store, 't3');
    seedColumn(store, 't1', 'c1');
    seedColumn(store, 't2', 'c2');
    seedColumn(store, 't3', 'c3');
    store.dispatchSync(addIndexAction({ id: 'i1', tableId: 't1' }));
    store.dispatchSync(addIndexAction({ id: 'i3', tableId: 't3' }));
    store.dispatchSync(
      addRelationshipAction({
        id: 'r-start',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't2', columnIds: ['c2'] },
      })
    );
    store.dispatchSync(
      addRelationshipAction({
        id: 'r-end',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 't2', columnIds: ['c2'] },
        end: { tableId: 't1', columnIds: ['c1'] },
      })
    );
    store.dispatchSync(
      addRelationshipAction({
        id: 'r-other',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 't2', columnIds: ['c2'] },
        end: { tableId: 't3', columnIds: ['c3'] },
      })
    );
  }

  it('removes the given table with its indexes and both relationship sides', () => {
    seedGraph();

    expect(typesOf(store, removeTableAction$('t1'))).toEqual([
      'index.remove',
      'relationship.remove',
      'relationship.remove',
      'table.remove',
    ]);

    store.dispatchSync(removeTableAction$('t1'));

    expect(store.state.doc.tableIds).toEqual(['t2', 't3']);
    expect(store.state.doc.indexIds).toEqual(['i3']);
    expect(store.state.doc.relationshipIds).toEqual(['r-other']);
  });

  it('removes only the table itself when nothing references it', () => {
    seedTable(store, 't1');

    expect(typesOf(store, removeTableAction$('t1'))).toEqual(['table.remove']);

    store.dispatchSync(removeTableAction$('t1'));

    expect(store.state.doc.tableIds).toEqual([]);
  });

  it('removes every selected table when no id is given', () => {
    seedGraph();
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    store.dispatchSync(
      selectAction({
        t1: SelectType.table,
        t3: SelectType.table,
        m1: SelectType.memo,
      })
    );

    store.dispatchSync(removeTableAction$());

    expect(store.state.doc.tableIds).toEqual(['t2']);
    expect(store.state.doc.indexIds).toEqual([]);
    expect(store.state.doc.relationshipIds).toEqual([]);
    expect(store.state.doc.memoIds).toEqual(['m1']);
  });

  it('emits nothing when no id is given and nothing is selected', () => {
    seedGraph();

    expect(typesOf(store, removeTableAction$())).toEqual([]);
    expect(store.state.doc.tableIds).toEqual(['t1', 't2', 't3']);
  });

  it('ignores memo selections when resolving the tables to remove', () => {
    seedTable(store, 't1');
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    store.dispatchSync(selectAction({ m1: SelectType.memo }));

    expect(typesOf(store, removeTableAction$())).toEqual([]);
  });
});

describe('selectTableAction$', () => {
  it('unselects everything else, selects, raises and focuses the table', () => {
    seedTable(store, 't1', 0, 0, 4);
    seedTable(store, 't2', 0, 0, 7);
    store.dispatchSync(selectAction({ t2: SelectType.table }));

    expect(typesOf(store, selectTableAction$('t1', false))).toEqual([
      'editor.unselectAll',
      'editor.select',
      'table.changeZIndex',
      'editor.focusTable',
    ]);

    store.dispatchSync(selectTableAction$('t1', false));

    expect(store.state.editor.selectedMap).toEqual({ t1: SelectType.table });
    expect(tableOf(store, 't1').ui.zIndex).toBe(8);
    expect(store.state.editor.focusTable?.tableId).toBe('t1');
  });

  it('keeps the previous selection when $mod is set', () => {
    seedTable(store, 't1');
    seedTable(store, 't2');
    store.dispatchSync(selectAction({ t2: SelectType.table }));

    store.dispatchSync(selectTableAction$('t1', true));

    expect(store.state.editor.selectedMap).toEqual({
      t1: SelectType.table,
      t2: SelectType.table,
    });
  });

  it('starts drawing from the table when no relationship start is set', () => {
    seedTable(store, 't1', 12, 34);
    store.dispatchSync(
      drawStartRelationshipAction({ relationshipType: RelationshipType.ZeroN })
    );

    store.dispatchSync(selectTableAction$('t1', false));

    expect(store.state.editor.drawRelationship?.start).toEqual({
      tableId: 't1',
      x: 12,
      y: 34,
    });
    expect(tableOf(store, 't1').columnIds).toHaveLength(1);
    expect(
      bHas(
        columnOf(store, tableOf(store, 't1').columnIds[0]).options,
        ColumnOption.primaryKey
      )
    ).toBe(true);
  });

  function startDrawingFrom(tableId: string) {
    store.dispatchSync(
      drawStartRelationshipAction({ relationshipType: RelationshipType.OneN })
    );
    store.dispatchSync(drawStartAddRelationshipAction({ tableId }));
  }

  it('creates the foreign key columns and the relationship on the end table', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true })
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
    seedTable(store, 't2');
    startDrawingFrom('t1');

    store.dispatchSync(selectTableAction$('t2', false));

    const endColumns = columnsOf(store, 't2');
    expect(endColumns).toHaveLength(1);
    expect(endColumns[0].name).toBe('id');
    expect(endColumns[0].dataType).toBe('int');
    expect(endColumns[0].default).toBe('0');
    expect(endColumns[0].comment).toBe('pk');
    expect(bHas(endColumns[0].options, ColumnOption.notNull)).toBe(true);

    expect(store.state.doc.relationshipIds).toHaveLength(1);
    const relationship =
      store.state.collections.relationshipEntities[
        store.state.doc.relationshipIds[0]
      ];
    expect(relationship.relationshipType).toBe(RelationshipType.OneN);
    expect(relationship.start.tableId).toBe('t1');
    expect(relationship.start.columnIds).toEqual(['c1']);
    expect(relationship.end.tableId).toBe('t2');
    expect(relationship.end.columnIds).toEqual([endColumns[0].id]);
    expect(store.state.editor.drawRelationship).toBeNull();
  });

  it('stops after focusing when the end table does not exist', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true })
    );
    startDrawingFrom('t1');

    expect(typesOf(store, selectTableAction$('ghost', false))).toEqual([
      'editor.unselectAll',
      'editor.select',
      'table.changeZIndex',
      'editor.focusTable',
    ]);
  });

  it('stops after focusing when the start table does not exist', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true })
    );
    seedTable(store, 't2');
    startDrawingFrom('t1');

    const state = {
      ...store.state,
      editor: {
        ...store.state.editor,
        drawRelationship: {
          ...store.state.editor.drawRelationship,
          start: { tableId: 'ghost', x: 0, y: 0 },
        },
      },
    };

    expect(typesOf(store, selectTableAction$('t2', false), state)).toEqual([
      'editor.unselectAll',
      'editor.select',
      'table.changeZIndex',
      'editor.focusTable',
    ]);
  });

  it('stops after focusing when the start table has no primary key', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    seedTable(store, 't2');
    startDrawingFrom('t1');

    expect(typesOf(store, selectTableAction$('t2', false))).toEqual([
      'editor.unselectAll',
      'editor.select',
      'table.changeZIndex',
      'editor.focusTable',
    ]);

    store.dispatchSync(selectTableAction$('t2', false));

    expect(tableOf(store, 't2').columnIds).toEqual([]);
    expect(store.state.doc.relationshipIds).toEqual([]);
  });
});

describe('pasteTableAction$', () => {
  const columnA = makeColumn({
    name: 'a',
    dataType: 'int',
    default: '1',
    comment: 'ca',
    options:
      ColumnOption.notNull | ColumnOption.unique | ColumnOption.autoIncrement,
  });
  const columnB = makeColumn({
    name: 'b',
    dataType: 'varchar',
    default: '2',
    comment: 'cb',
    options: 0,
  });
  const columnC = makeColumn({
    name: 'c',
    dataType: 'text',
    default: '3',
    comment: 'cc',
    options: ColumnOption.unique,
  });

  it('appends the columns to every selected table when nothing is focused', () => {
    seedTable(store, 't1');
    seedTable(store, 't2');
    store.dispatchSync(
      selectAction({ t1: SelectType.table, t2: SelectType.table })
    );

    store.dispatchSync(pasteTableAction$([columnA, columnB]));

    for (const tableId of ['t1', 't2']) {
      const columns = columnsOf(store, tableId);
      expect(columns.map(({ name }) => name)).toEqual(['a', 'b']);
      expect(columns[0].dataType).toBe('int');
      expect(columns[0].default).toBe('1');
      expect(columns[0].comment).toBe('ca');
      expect(bHas(columns[0].options, ColumnOption.notNull)).toBe(true);
      expect(bHas(columns[0].options, ColumnOption.unique)).toBe(true);
      expect(bHas(columns[0].options, ColumnOption.autoIncrement)).toBe(true);
      expect(bHas(columns[1].options, ColumnOption.notNull)).toBe(false);
    }
  });

  it('emits nothing when nothing is selected and nothing is focused', () => {
    seedTable(store, 't1');

    expect(typesOf(store, pasteTableAction$([columnA]))).toEqual([]);
  });

  it('appends to the focused table too when the focus is on the table itself', () => {
    seedTable(store, 't1');
    store.dispatchSync(selectAction({ t1: SelectType.table }));
    store.dispatchSync(
      focusTableAction({ tableId: 't1', focusType: FocusType.tableName })
    );

    store.dispatchSync(pasteTableAction$([columnA]));

    expect(columnsOf(store, 't1').map(({ name }) => name)).toEqual(['a']);
    expect(store.state.editor.focusTable?.focusType).toBe(FocusType.tableName);
  });

  function seedFocusedPaste() {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    seedColumn(store, 't1', 'c2');
    seedColumn(store, 't1', 'c3');
    seedTable(store, 't2');
    store.dispatchSync(
      selectAction({ t1: SelectType.table, t2: SelectType.table })
    );
    store.dispatchSync(
      focusColumnAction({
        tableId: 't1',
        columnId: 'c2',
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
  }

  it('overwrites the focused range and appends the overflow', () => {
    seedFocusedPaste();

    store.dispatchSync(pasteTableAction$([columnA, columnB, columnC]));

    // the focused table is skipped by the "append to selection" pass
    expect(columnsOf(store, 't2').map(({ name }) => name)).toEqual([
      'a',
      'b',
      'c',
    ]);

    const columns = columnsOf(store, 't1');
    expect(columns.map(({ id }) => id).slice(0, 3)).toEqual(['c1', 'c2', 'c3']);
    expect(columns).toHaveLength(4);
    expect(columns.map(({ name }) => name)).toEqual(['', 'a', 'b', 'c']);
    expect(columns[1].dataType).toBe('int');
    expect(columns[1].default).toBe('1');
    expect(columns[1].comment).toBe('ca');
    expect(bHas(columns[1].options, ColumnOption.notNull)).toBe(true);
    // unique / autoIncrement are hidden by the default `show` settings
    expect(bHas(columns[1].options, ColumnOption.unique)).toBe(false);
    expect(bHas(columns[1].options, ColumnOption.autoIncrement)).toBe(false);
    expect(columns[3].dataType).toBe('text');

    expect(store.state.editor.focusTable?.tableId).toBe('t1');
    expect(store.state.editor.focusTable?.selectColumnIds).toEqual([
      'c2',
      'c3',
      columns[3].id,
    ]);
  });

  it('applies the unique and autoIncrement columns once they are shown', () => {
    seedFocusedPaste();
    store.dispatchSync(
      changeShowAction({
        show: Show.columnUnique | Show.columnAutoIncrement,
        value: true,
      })
    );

    store.dispatchSync(pasteTableAction$([columnA, columnB, columnC]));

    const columns = columnsOf(store, 't1');
    expect(bHas(columns[1].options, ColumnOption.unique)).toBe(true);
    expect(bHas(columns[1].options, ColumnOption.autoIncrement)).toBe(true);
    expect(bHas(columns[2].options, ColumnOption.unique)).toBe(false);
    expect(bHas(columns[3].options, ColumnOption.unique)).toBe(true);
  });

  it('stops overwriting when the pasted columns run out', () => {
    seedFocusedPaste();

    store.dispatchSync(pasteTableAction$([columnA]));

    const columns = columnsOf(store, 't1');
    expect(columns).toHaveLength(3);
    expect(columns.map(({ name }) => name)).toEqual(['', 'a', '']);
    expect(store.state.editor.focusTable?.selectColumnIds).toEqual(['c2']);
  });

  it('does nothing to the focused table when no column is selected in it', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(
      focusTableAction({ tableId: 't1', focusType: FocusType.columnName })
    );

    expect(typesOf(store, pasteTableAction$([columnA]))).toEqual([]);

    store.dispatchSync(pasteTableAction$([columnA]));

    expect(columnsOf(store, 't1').map(({ name }) => name)).toEqual(['']);
    expect(store.state.editor.focusTable).not.toBeNull();
  });

  it('does nothing when the focused table no longer exists', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(
      focusColumnAction({
        tableId: 't1',
        columnId: 'c1',
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );

    const state = {
      ...store.state,
      editor: {
        ...store.state.editor,
        focusTable: {
          ...store.state.editor.focusTable,
          tableId: 'ghost',
        },
      },
    };

    expect(typesOf(store, pasteTableAction$([columnA]), state)).toEqual([]);
  });
});

describe('actions$', () => {
  it('exposes every generator action of the table module', () => {
    expect(Object.keys(actions$).sort()).toEqual([
      'addTableAction$',
      'pasteTableAction$',
      'removeTableAction$',
      'selectTableAction$',
    ]);
  });
});
