import { query } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  focusColumnAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import { addIndexAction } from '@/engine/modules/index/atom.actions';
import { addIndexColumnAction } from '@/engine/modules/index-column/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeRelationshipDataTypeSyncAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import {
  actions$,
  addColumnAction$,
  changeColumnDataTypeAction$,
  changeColumnPrimaryKeyAction$,
  changeColumnValueAction$,
  isChangeColumnTypes,
  isToggleColumnTypes,
  removeColumnAction$,
  toggleColumnValueAction$,
} from '@/engine/modules/table-column/generator.actions';
import { createStore, Store } from '@/engine/store';
import { bHas } from '@/utils/bit';

function setup() {
  return createStore({ toWidth: text => text.length * 10, clock: new Clock() });
}

function addTable(store: Store, id: string, columnIds: string[] = []) {
  store.dispatchSync(addTableAction({ id, ui: { x: 0, y: 0, zIndex: 1 } }));
  for (const columnId of columnIds) {
    store.dispatchSync(addColumnAction({ id: columnId, tableId: id }));
  }
}

function addRelationship(
  store: Store,
  id: string,
  start: { tableId: string; columnIds: string[] },
  end: { tableId: string; columnIds: string[] }
) {
  store.dispatchSync(
    addRelationshipAction({ id, relationshipType: 4, start, end })
  );
}

function addIndex(
  store: Store,
  id: string,
  tableId: string,
  columns: Array<{ id: string; columnId: string }>
) {
  store.dispatchSync(addIndexAction({ id, tableId }));
  for (const { id: indexColumnId, columnId } of columns) {
    store.dispatchSync(
      addIndexColumnAction({
        id: indexColumnId,
        indexId: id,
        tableId,
        columnId,
      })
    );
  }
}

const table = (store: Store, id: string) =>
  query(store.state.collections).collection('tableEntities').selectById(id)!;

const column = (store: Store, id: string) =>
  query(store.state.collections)
    .collection('tableColumnEntities')
    .selectById(id)!;

describe('isToggleColumnTypes / isChangeColumnTypes', () => {
  it('accepts only the three boolean option focus types', () => {
    expect(isToggleColumnTypes(FocusType.columnNotNull)).toBe(true);
    expect(isToggleColumnTypes(FocusType.columnUnique)).toBe(true);
    expect(isToggleColumnTypes(FocusType.columnAutoIncrement)).toBe(true);
    expect(isToggleColumnTypes(FocusType.columnName)).toBe(false);
    expect(isToggleColumnTypes(FocusType.tableName)).toBe(false);
  });

  it('accepts only the four textual focus types', () => {
    expect(isChangeColumnTypes(FocusType.columnName)).toBe(true);
    expect(isChangeColumnTypes(FocusType.columnDataType)).toBe(true);
    expect(isChangeColumnTypes(FocusType.columnDefault)).toBe(true);
    expect(isChangeColumnTypes(FocusType.columnComment)).toBe(true);
    expect(isChangeColumnTypes(FocusType.columnNotNull)).toBe(false);
    expect(isChangeColumnTypes(FocusType.tableComment)).toBe(false);
  });
});

describe('addColumnAction$', () => {
  it('adds a column to the given table and focuses its name', () => {
    const store = setup();
    addTable(store, 't1');

    store.dispatchSync(addColumnAction$('t1'));

    const columnIds = table(store, 't1').columnIds;
    expect(columnIds).toHaveLength(1);
    expect(store.state.editor.focusTable).toMatchObject({
      tableId: 't1',
      columnId: columnIds[0],
      focusType: FocusType.columnName,
      selectColumnIds: [columnIds[0]],
    });
  });

  it('adds one column per selected table and focuses the last one', () => {
    const store = setup();
    addTable(store, 't1');
    addTable(store, 't2');
    store.dispatchSync(
      selectAction({
        t1: SelectType.table,
        t2: SelectType.table,
        m1: SelectType.memo,
      })
    );

    store.dispatchSync(addColumnAction$());

    expect(table(store, 't1').columnIds).toHaveLength(1);
    expect(table(store, 't2').columnIds).toHaveLength(1);
    expect(store.state.editor.focusTable).toMatchObject({
      tableId: 't2',
      columnId: table(store, 't2').columnIds[0],
      focusType: FocusType.columnName,
    });
  });

  it('does nothing when nothing is selected', () => {
    const store = setup();
    addTable(store, 't1');

    store.dispatchSync(addColumnAction$());

    expect(table(store, 't1').columnIds).toEqual([]);
    expect(store.state.editor.focusTable).toBeNull();
  });

  it('ignores selected memos', () => {
    const store = setup();
    addTable(store, 't1');
    store.dispatchSync(selectAction({ m1: SelectType.memo }));

    store.dispatchSync(addColumnAction$());

    expect(table(store, 't1').columnIds).toEqual([]);
    expect(store.state.editor.focusTable).toBeNull();
  });
});

describe('removeColumnAction$', () => {
  it('removes the columns from the owning table', () => {
    const store = setup();
    addTable(store, 't1', ['c1', 'c2', 'c3']);

    store.dispatchSync(removeColumnAction$('t1', ['c1', 'c3']));

    expect(table(store, 't1').columnIds).toEqual(['c2']);
  });

  it('leaves focus alone when no column is focused', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(removeColumnAction$('t1', ['c1']));

    expect(store.state.editor.focusTable).toBeNull();
  });

  it('moves focus to the closest surviving column above', () => {
    const store = setup();
    addTable(store, 't1', ['c1', 'c2', 'c3']);
    store.dispatchSync(
      focusColumnAction({
        tableId: 't1',
        columnId: 'c3',
        focusType: FocusType.columnDataType,
        $mod: false,
        shiftKey: false,
      })
    );

    store.dispatchSync(removeColumnAction$('t1', ['c3']));

    expect(store.state.editor.focusTable).toMatchObject({
      tableId: 't1',
      columnId: 'c2',
      focusType: FocusType.columnDataType,
    });
  });

  it('falls back to the table name when the first column is focused', () => {
    const store = setup();
    addTable(store, 't1', ['c1', 'c2']);
    store.dispatchSync(
      focusColumnAction({
        tableId: 't1',
        columnId: 'c1',
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );

    store.dispatchSync(removeColumnAction$('t1', ['c1']));

    expect(store.state.editor.focusTable).toMatchObject({
      tableId: 't1',
      columnId: null,
      focusType: FocusType.tableName,
      selectColumnIds: [],
    });
  });

  it('falls back to the table name when every candidate is being removed', () => {
    const store = setup();
    addTable(store, 't1', ['c1', 'c2', 'c3']);
    store.dispatchSync(
      focusColumnAction({
        tableId: 't1',
        columnId: 'c3',
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );

    store.dispatchSync(removeColumnAction$('t1', ['c1', 'c2', 'c3']));

    expect(store.state.editor.focusTable).toMatchObject({
      tableId: 't1',
      columnId: null,
      focusType: FocusType.tableName,
    });
    expect(table(store, 't1').columnIds).toEqual([]);
  });

  it('removes relationships that start on a removed column', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );

    store.dispatchSync(removeColumnAction$('t1', ['c1']));

    expect(store.state.doc.relationshipIds).toEqual([]);
  });

  it('removes relationships that end on a removed column', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );

    store.dispatchSync(removeColumnAction$('t2', ['c2']));

    expect(store.state.doc.relationshipIds).toEqual([]);
  });

  it('keeps relationships that touch neither the table nor the columns', () => {
    const store = setup();
    addTable(store, 't1', ['c1', 'c2']);
    addTable(store, 't2', ['c3']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c2'] },
      { tableId: 't2', columnIds: ['c3'] }
    );

    store.dispatchSync(removeColumnAction$('t1', ['c1']));

    expect(store.state.doc.relationshipIds).toEqual(['r1']);
  });

  it('removes indexes of the table that reference a removed column', () => {
    const store = setup();
    addTable(store, 't1', ['c1', 'c2']);
    addIndex(store, 'i1', 't1', [{ id: 'ic1', columnId: 'c1' }]);
    addIndex(store, 'i2', 't1', [{ id: 'ic2', columnId: 'c2' }]);

    store.dispatchSync(removeColumnAction$('t1', ['c1']));

    expect(store.state.doc.indexIds).toEqual(['i2']);
  });

  it('keeps an index that belongs to another table even on a column-id match', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', []);
    addIndex(store, 'i1', 't2', [{ id: 'ic1', columnId: 'c1' }]);

    store.dispatchSync(removeColumnAction$('t1', ['c1']));

    expect(store.state.doc.indexIds).toEqual(['i1']);
  });
});

describe('toggleColumnValueAction$', () => {
  it('does nothing for a focus type that is not a boolean option', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(
      toggleColumnValueAction$(FocusType.columnName, 't1', 'c1')
    );

    expect(column(store, 'c1').options).toBe(0);
  });

  it('does nothing when the column does not exist', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(
      toggleColumnValueAction$(FocusType.columnNotNull, 't1', 'nope')
    );

    expect(
      query(store.state.collections)
        .collection('tableColumnEntities')
        .selectById('nope')
    ).toBeUndefined();
  });

  it('toggles notNull on and back off', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(
      toggleColumnValueAction$(FocusType.columnNotNull, 't1', 'c1')
    );
    expect(bHas(column(store, 'c1').options, ColumnOption.notNull)).toBe(true);

    store.dispatchSync(
      toggleColumnValueAction$(FocusType.columnNotNull, 't1', 'c1')
    );
    expect(bHas(column(store, 'c1').options, ColumnOption.notNull)).toBe(false);
  });

  it('toggles unique', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(
      toggleColumnValueAction$(FocusType.columnUnique, 't1', 'c1')
    );

    expect(bHas(column(store, 'c1').options, ColumnOption.unique)).toBe(true);
  });

  it('toggles autoIncrement', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(
      toggleColumnValueAction$(FocusType.columnAutoIncrement, 't1', 'c1')
    );

    expect(bHas(column(store, 'c1').options, ColumnOption.autoIncrement)).toBe(
      true
    );
  });
});

describe('changeColumnDataTypeAction$', () => {
  it('changes only the target column when the sync setting is off', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );
    store.dispatchSync(changeRelationshipDataTypeSyncAction({ value: false }));

    store.dispatchSync(
      changeColumnDataTypeAction$({ tableId: 't1', id: 'c1', value: 'int' })
    );

    expect(column(store, 'c1').dataType).toBe('int');
    expect(column(store, 'c2').dataType).toBe('');
  });

  it('propagates the data type across relationships when the sync setting is on', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addTable(store, 't3', ['c3']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );
    addRelationship(
      store,
      'r2',
      { tableId: 't2', columnIds: ['c2'] },
      { tableId: 't3', columnIds: ['c3'] }
    );
    store.dispatchSync(changeRelationshipDataTypeSyncAction({ value: true }));

    store.dispatchSync(
      changeColumnDataTypeAction$({ tableId: 't1', id: 'c1', value: 'bigint' })
    );

    expect(column(store, 'c1').dataType).toBe('bigint');
    expect(column(store, 'c2').dataType).toBe('bigint');
    expect(column(store, 'c3').dataType).toBe('bigint');
  });

  it('recomputes the rendered data-type width', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    store.dispatchSync(changeRelationshipDataTypeSyncAction({ value: false }));

    store.dispatchSync(
      changeColumnDataTypeAction$({
        tableId: 't1',
        id: 'c1',
        value: 'varchar(255)',
      })
    );

    expect(column(store, 'c1').ui.widthDataType).toBe(120);
  });
});

describe('changeColumnValueAction$', () => {
  it('does nothing for a focus type that carries no text', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(
      changeColumnValueAction$(FocusType.tableName, 't1', 'c1', 'users')
    );

    expect(column(store, 'c1').name).toBe('');
  });

  it('does nothing when the column does not exist', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(
      changeColumnValueAction$(FocusType.columnName, 't1', 'nope', 'x')
    );

    expect(
      query(store.state.collections)
        .collection('tableColumnEntities')
        .selectById('nope')
    ).toBeUndefined();
  });

  it('changes the name and its width', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(
      changeColumnValueAction$(FocusType.columnName, 't1', 'c1', 'user_id')
    );

    expect(column(store, 'c1').name).toBe('user_id');
    expect(column(store, 'c1').ui.widthName).toBe(70);
  });

  it('routes the data type through the sync-aware generator', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );
    store.dispatchSync(changeRelationshipDataTypeSyncAction({ value: true }));

    store.dispatchSync(
      changeColumnValueAction$(FocusType.columnDataType, 't1', 'c1', 'int')
    );

    expect(column(store, 'c1').dataType).toBe('int');
    expect(column(store, 'c2').dataType).toBe('int');
  });

  it('changes the default value', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(
      changeColumnValueAction$(FocusType.columnDefault, 't1', 'c1', 'now()')
    );

    expect(column(store, 'c1').default).toBe('now()');
  });

  it('changes the comment', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(
      changeColumnValueAction$(FocusType.columnComment, 't1', 'c1', 'pk')
    );

    expect(column(store, 'c1').comment).toBe('pk');
  });
});

describe('changeColumnPrimaryKeyAction$', () => {
  it('does nothing when the column does not exist', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(changeColumnPrimaryKeyAction$('t1', 'nope'));

    expect(
      query(store.state.collections)
        .collection('tableColumnEntities')
        .selectById('nope')
    ).toBeUndefined();
  });

  it('turns the primary key on and back off', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(changeColumnPrimaryKeyAction$('t1', 'c1'));
    expect(bHas(column(store, 'c1').options, ColumnOption.primaryKey)).toBe(
      true
    );

    store.dispatchSync(changeColumnPrimaryKeyAction$('t1', 'c1'));
    expect(bHas(column(store, 'c1').options, ColumnOption.primaryKey)).toBe(
      false
    );
  });
});

describe('actions$', () => {
  it('exposes every generator action of the module', () => {
    expect(actions$).toEqual({
      addColumnAction$,
      removeColumnAction$,
      toggleColumnValueAction$,
      changeColumnDataTypeAction$,
      changeColumnValueAction$,
      changeColumnPrimaryKeyAction$,
    });
    expect(
      Object.values(actions$).every(value => typeof value === 'function')
    ).toBe(true);
  });
});
