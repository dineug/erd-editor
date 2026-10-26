import { AnyAction, compositionActionsFlat } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { START_ADD, START_X, START_Y } from '@/constants/layout';
import {
  ColumnOption,
  Database,
  NameViewMode,
  RelationshipType,
  Show,
} from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  addDictionaryAction,
  removeDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import { updateDictionaryEntryAction$ } from '@/engine/modules/dictionary/generator.actions';
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
import {
  changeDatabaseAction,
  changeRelationshipDataTypeSyncAction,
  changeShowAction,
  toNameViewModeAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableGroupAction,
  changeTableNameDerivedAction,
  removeTableAction,
  sortTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  actions$,
  addTableAction$,
  changeTableNameAction$,
  pasteTableAction$,
  removeTableAction$,
  selectTableAction$,
  sortTablesToMoveAction$,
} from '@/engine/modules/table/generator.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnDomainAction,
  changeColumnNameAction,
  changeColumnNameDerivedAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { addTableGroupAction } from '@/engine/modules/table-group/atom.actions';
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
  it('emits unselectAll, add, select and focus in order', () => {
    expect(typesOf(store, addTableAction$())).toEqual([
      'editor.unselectAll',
      'table.add',
      'editor.select',
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

  it('leaves out a selected table already gone from the document', () => {
    seedTable(store, 't1');
    seedTable(store, 't2');
    store.dispatchSync(
      selectAction({ t1: SelectType.table, t2: SelectType.table })
    );
    // The bare atom a peer, an agent or the undo of an add sends, which
    // leaves the table selected and its entity in the collection.
    store.dispatchSync(removeTableAction({ id: 't2' }));

    const flat = flatten(store, removeTableAction$());

    expect(flat.map(({ type }) => type)).toEqual(['table.remove']);
    expect(flat[0].payload).toEqual({ id: 't1' });
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

  it('draws the foreign key of a serial key with the integer it stores, sync off too', () => {
    store.dispatchSync(changeDatabaseAction({ value: Database.PostgreSQL }));
    store.dispatchSync(changeRelationshipDataTypeSyncAction({ value: false }));
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true }),
      changeColumnDataTypeAction({ tableId: 't1', id: 'c1', value: 'SERIAL' })
    );
    seedTable(store, 't2');
    startDrawingFrom('t1');

    store.dispatchSync(selectTableAction$('t2', false));

    expect(columnsOf(store, 't2').map(({ dataType }) => dataType)).toEqual([
      'INTEGER',
    ]);
    expect(columnOf(store, 'c1').dataType).toBe('SERIAL');
  });

  it('ends the draw after focusing when the end table does not exist', () => {
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
      'editor.drawEndRelationship',
    ]);

    store.dispatchSync(selectTableAction$('ghost', false));

    expect(store.state.editor.drawRelationship).toBeNull();
    expect(store.state.doc.relationshipIds).toEqual([]);
  });

  it('ends the draw after focusing when the start table does not exist', () => {
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
      'editor.drawEndRelationship',
    ]);
  });

  it('ends the draw after focusing when the start table has no primary key', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    seedTable(store, 't2');
    startDrawingFrom('t1');

    expect(typesOf(store, selectTableAction$('t2', false))).toEqual([
      'editor.unselectAll',
      'editor.select',
      'table.changeZIndex',
      'editor.focusTable',
      'editor.drawEndRelationship',
    ]);

    store.dispatchSync(selectTableAction$('t2', false));

    expect(tableOf(store, 't2').columnIds).toEqual([]);
    expect(store.state.doc.relationshipIds).toEqual([]);
    expect(store.state.editor.drawRelationship).toBeNull();
  });

  it('ends the draw when the start key goes after the draw started', () => {
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true })
    );
    seedTable(store, 't2');
    startDrawingFrom('t1');
    // A peer, an undo or Alt+K takes the key away while the draw is armed.
    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: false })
    );
    expect(store.state.editor.drawRelationship?.start?.tableId).toBe('t1');

    store.dispatchSync(selectTableAction$('t2', false));

    expect(store.state.editor.drawRelationship).toBeNull();
    expect(tableOf(store, 't2').columnIds).toEqual([]);
    expect(store.state.doc.relationshipIds).toEqual([]);
    expect(store.state.editor.selectedMap).toEqual({ t2: SelectType.table });
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

  it('appends the logical names, linking only a domain this document lists', () => {
    store.dispatchSync(
      addDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { name: 'Membership number' },
      }),
      addDictionaryAction({ kind: 'domain', id: 'd2' }),
      removeDictionaryAction({ kind: 'domain', id: 'd2' })
    );
    seedTable(store, 't1');
    store.dispatchSync(selectAction({ t1: SelectType.table }));
    const linked = (domainId: string) =>
      makeColumn({
        name: domainId,
        logicalName: `Linked to ${domainId}`,
        domainId,
        options: ColumnOption.nameDerived,
      });

    store.dispatchSync(
      pasteTableAction$([linked('d1'), linked('d2'), linked('elsewhere')])
    );

    const [live, removed, foreign] = columnsOf(store, 't1');
    expect(live).toMatchObject({ logicalName: 'Linked to d1', domainId: 'd1' });
    expect(live.ui.widthDomain).toBe('Membership number'.length * 10);
    expect(removed).toMatchObject({
      logicalName: 'Linked to d2',
      domainId: '',
    });
    expect(foreign.domainId).toBe('');
    // A paste writes the name as typed, so nothing derived it.
    expect(bHas(live.options, ColumnOption.nameDerived)).toBe(false);
  });

  it('appends a link only to a domain whose type the copy holds, keeping the type it copied', () => {
    store.dispatchSync(
      addDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { name: 'Amount', dataType: 'bigint' },
      })
    );
    seedTable(store, 't1');
    seedColumn(store, 't1', 'c1');
    store.dispatchSync(
      changeColumnDataTypeAction({ tableId: 't1', id: 'c1', value: 'bigint' }),
      changeColumnDomainAction({ tableId: 't1', id: 'c1', value: 'd1' })
    );
    const before = { ...columnOf(store, 'c1') };
    store.dispatchSync(
      updateDictionaryEntryAction$('domain', 'd1', { dataType: 'int' })
    );
    store.dispatchSync(selectAction({ t1: SelectType.table }));
    const after = { ...columnOf(store, 'c1') };

    store.dispatchSync(pasteTableAction$([before, after]));

    const [, moved, kept] = columnsOf(store, 't1');
    expect(moved).toMatchObject({ dataType: 'bigint', domainId: '' });
    expect(kept).toMatchObject({ dataType: 'int', domainId: 'd1' });
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
    // unique / autoIncrement are hidden by the default show settings
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

  it('turns the derived flag off of a column whose name the paste writes over, in the same dispatch', () => {
    seedFocusedPaste();
    store.dispatchSync(
      changeColumnNameDerivedAction({ tableId: 't1', id: 'c2', value: true })
    );

    const flags = flatten(store, pasteTableAction$([columnA, columnB]))
      .filter(({ type }) => type === changeColumnNameDerivedAction.type)
      .map(({ payload }) => payload);
    expect(flags).toEqual([{ tableId: 't1', id: 'c2', value: false }]);

    store.dispatchSync(pasteTableAction$([columnA, columnB]));

    expect(columnOf(store, 'c2').name).toBe('a');
    expect(bHas(columnOf(store, 'c2').options, ColumnOption.nameDerived)).toBe(
      false
    );
  });

  it('unlinks a column the pasted type takes off its domain, keeping one pasted to it', () => {
    seedFocusedPaste();
    store.dispatchSync(
      addDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { name: 'Amount', dataType: 'bigint' },
      }),
      ...['c2', 'c3'].flatMap(id => [
        changeColumnDataTypeAction({ tableId: 't1', id, value: 'bigint' }),
        changeColumnDomainAction({ tableId: 't1', id, value: 'd1' }),
      ])
    );
    const pasted = [columnA, makeColumn({ name: 'b', dataType: 'bigint' })];

    // The columns the paste adds to the other selected table link nothing.
    expect(
      flatten(store, pasteTableAction$(pasted))
        .filter(
          ({ type, payload }) =>
            type === changeColumnDomainAction.type && payload.tableId === 't1'
        )
        .map(({ payload }) => payload)
    ).toEqual([{ tableId: 't1', id: 'c2', value: '' }]);

    store.dispatchSync(pasteTableAction$(pasted));

    expect(columnOf(store, 'c2')).toMatchObject({
      dataType: 'int',
      domainId: '',
    });
    expect(columnOf(store, 'c3')).toMatchObject({
      dataType: 'bigint',
      domainId: 'd1',
    });
  });

  /** A domain and the term that names it, then the name view the paste lands in. */
  function seedNameView(
    nameViewMode: (typeof NameViewMode)[keyof typeof NameViewMode]
  ) {
    store.dispatchSync(
      addDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { name: 'Identifier', dataType: 'uuid' },
      }),
      addDictionaryAction({
        kind: 'term',
        id: 'term1',
        values: {
          name: 'Member ID',
          physicalName: 'member_id',
          domainId: 'd1',
        },
      })
    );
    store.dispatchSync(toNameViewModeAction(store.state, nameViewMode, false));
  }

  const isDerived = (id: string) =>
    bHas(columnOf(store, id).options, ColumnOption.nameDerived);

  it('writes the logical names of the logical view and derives each name a row leaves empty', () => {
    seedFocusedPaste();
    seedNameView(NameViewMode.logical);
    store.dispatchSync(
      changeColumnNameAction({ tableId: 't1', id: 'c3', value: 'kept' })
    );

    store.dispatchSync(
      pasteTableAction$([
        makeColumn({ logicalName: 'Member ID' }),
        makeColumn({ logicalName: 'Nickname', dataType: 'varchar' }),
        makeColumn({ logicalName: 'Member ID' }),
      ])
    );

    const derived = {
      name: 'member_id',
      logicalName: 'Member ID',
      domainId: 'd1',
      dataType: 'uuid',
    };
    const [, c2, c3, added] = columnsOf(store, 't1');
    expect(c2).toMatchObject(derived);
    expect(isDerived('c2')).toBe(true);
    // A name typed by hand stays, as typing the logical name leaves it.
    expect(c3).toMatchObject({
      name: 'kept',
      logicalName: 'Nickname',
      dataType: 'varchar',
      domainId: '',
    });
    expect(isDerived('c3')).toBe(false);
    expect(added).toMatchObject(derived);
    expect(isDerived(added.id)).toBe(true);
  });

  it('derives no name a row of the view of both pastes, but the one it leaves empty', () => {
    seedFocusedPaste();
    seedNameView(NameViewMode.both);
    store.dispatchSync(
      changeColumnNameDerivedAction({ tableId: 't1', id: 'c2', value: true })
    );

    store.dispatchSync(
      pasteTableAction$([
        makeColumn({ logicalName: 'Member ID', name: 'mid' }),
        makeColumn({ logicalName: 'Member ID', name: '' }),
      ])
    );

    expect(columnOf(store, 'c2')).toMatchObject({
      name: 'mid',
      logicalName: 'Member ID',
      domainId: '',
    });
    expect(isDerived('c2')).toBe(false);
    expect(columnOf(store, 'c3')).toMatchObject({
      name: 'member_id',
      domainId: 'd1',
    });
    expect(isDerived('c3')).toBe(true);
  });

  it("writes over the logical view's type cell the domain it names, or the type that unlinks one", () => {
    seedFocusedPaste();
    seedNameView(NameViewMode.logical);
    store.dispatchSync(
      changeColumnDataTypeAction({ tableId: 't1', id: 'c2', value: 'uuid' }),
      changeColumnDomainAction({ tableId: 't1', id: 'c2', value: 'd1' }),
      changeColumnDataTypeAction({ tableId: 't1', id: 'c3', value: 'int' })
    );

    store.dispatchSync(
      pasteTableAction$([
        makeColumn({ dataType: 'varchar' }),
        makeColumn({ dataType: 'uuid', domainId: 'd1' }),
      ])
    );

    // The type cell drew the domain, so a type pasted over it takes its place.
    expect(columnOf(store, 'c2')).toMatchObject({
      dataType: 'varchar',
      domainId: '',
    });
    expect(columnOf(store, 'c3')).toMatchObject({
      dataType: 'uuid',
      domainId: 'd1',
    });
  });

  it('links the domain a domain cell names, its type following, and unlinks for an unknown one', () => {
    seedFocusedPaste();
    seedNameView(NameViewMode.physical);
    store.dispatchSync(
      changeShowAction({ show: Show.columnDomain, value: true }),
      changeColumnDataTypeAction({ tableId: 't1', id: 'c3', value: 'uuid' }),
      changeColumnDomainAction({ tableId: 't1', id: 'c3', value: 'd1' })
    );

    store.dispatchSync(
      pasteTableAction$([
        makeColumn({ name: 'a', dataType: 'uuid', domainId: 'd1' }),
        makeColumn({ name: 'b', dataType: 'uuid' }),
      ])
    );

    expect(columnOf(store, 'c2')).toMatchObject({
      dataType: 'uuid',
      domainId: 'd1',
    });
    expect(columnOf(store, 'c3')).toMatchObject({
      dataType: 'uuid',
      domainId: '',
    });

    store.dispatchSync(
      changeShowAction({ show: Show.columnDataType, value: false }),
      changeColumnDomainAction({ tableId: 't1', id: 'c2', value: '' }),
      changeColumnDataTypeAction({ tableId: 't1', id: 'c2', value: 'int' })
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
    const linked = makeColumn({ dataType: 'uuid', domainId: 'd1' });
    store.dispatchSync(pasteTableAction$([linked]));

    // With no type cell the domain brings its own type.
    expect(columnOf(store, 'c2')).toMatchObject({
      dataType: 'uuid',
      domainId: 'd1',
    });
  });

  it("derives the name of a column it adds with a logical name and no name, linking the term's domain the type allows", () => {
    seedNameView(NameViewMode.logical);
    seedTable(store, 't1');
    store.dispatchSync(selectAction({ t1: SelectType.table }));

    store.dispatchSync(
      pasteTableAction$([
        makeColumn({ logicalName: 'Member ID' }),
        makeColumn({ logicalName: 'Member ID', dataType: 'int' }),
        makeColumn({ logicalName: 'Member ID', name: 'typed' }),
      ])
    );

    const [linked, typed, named] = columnsOf(store, 't1');
    expect(linked).toMatchObject({
      name: 'member_id',
      domainId: 'd1',
      dataType: 'uuid',
    });
    expect(isDerived(linked.id)).toBe(true);
    // A type off the domain's keeps the column off the domain.
    expect(typed).toMatchObject({
      name: 'member_id',
      domainId: '',
      dataType: 'int',
    });
    expect(named).toMatchObject({ name: 'typed', domainId: '' });
    expect(isDerived(named.id)).toBe(false);
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

describe('sortTablesToMoveAction$', () => {
  function seedSortable() {
    seedTable(store, 'wide', 900, 900);
    seedColumn(store, 'wide', 'w1');
    seedColumn(store, 'wide', 'w2');
    seedTable(store, 'narrow', 700, 700);
    seedTable(store, 'gone', 10, 10);
    store.dispatchSync(removeTableAction$('gone'));
  }

  it('places every live table with an absolute move, never a replayed sort', () => {
    seedSortable();

    expect(typesOf(store, sortTablesToMoveAction$())).toEqual([
      'table.moveTo',
      'table.moveTo',
    ]);
    // In document order; the removed table is no longer in it.
    expect(
      flatten(store, sortTablesToMoveAction$()).map(({ payload: { id } }) => id)
    ).toEqual(['wide', 'narrow']);
  });

  it('lands the tables where the sort reducer puts them', () => {
    seedSortable();
    const sorted = createTestStore();
    seedTable(sorted, 'wide', 900, 900);
    seedColumn(sorted, 'wide', 'w1');
    seedColumn(sorted, 'wide', 'w2');
    seedTable(sorted, 'narrow', 700, 700);
    sorted.dispatchSync(sortTableAction());

    store.dispatchSync(sortTablesToMoveAction$());

    for (const id of ['wide', 'narrow']) {
      expect([tableOf(store, id).ui.x, tableOf(store, id).ui.y]).toEqual([
        tableOf(sorted, id).ui.x,
        tableOf(sorted, id).ui.y,
      ]);
    }
    expect(tableOf(store, 'narrow').ui).toMatchObject({ x: 50, y: 50 });
  });

  it('measures on copies, so the live tables stay put until the moves land', () => {
    seedSortable();

    flatten(store, sortTablesToMoveAction$());

    expect(tableOf(store, 'wide').ui).toMatchObject({ x: 900, y: 900 });
    expect(tableOf(store, 'narrow').ui).toMatchObject({ x: 700, y: 700 });
  });

  it('emits nothing for a document with no table', () => {
    expect(typesOf(store, sortTablesToMoveAction$())).toEqual([]);
  });

  function seedGroups(target: Store) {
    seedTable(target, 'wide', 900, 900);
    seedColumn(target, 'wide', 'w1');
    seedTable(target, 'narrow', 700, 700);
    seedTable(target, 'loose', 300, 300);
    target.dispatchSync(
      addTableGroupAction({
        id: 'g1',
        ui: { x: 900, y: 900, width: 10, height: 10, zIndex: 1 },
      }),
      addTableGroupAction({
        id: 'empty',
        ui: { x: -50, y: -50, width: 20, height: 20, zIndex: 1 },
      }),
      changeTableGroupAction({ id: 'wide', value: 'g1' }),
      changeTableGroupAction({ id: 'narrow', value: 'g1' })
    );
  }

  it('places each group with members at the rect the sort reducer gives it, an empty one left out', () => {
    seedGroups(store);
    const sorted = createTestStore();
    seedGroups(sorted);
    sorted.dispatchSync(sortTableAction());

    const actions = flatten(store, sortTablesToMoveAction$());
    store.dispatchSync(sortTablesToMoveAction$());

    expect(actions.map(({ type }) => type)).toEqual([
      'table.moveTo',
      'table.moveTo',
      'table.moveTo',
      'tableGroup.resize',
    ]);
    expect(store.state.collections.tableGroupEntities.g1.ui).toEqual(
      sorted.state.collections.tableGroupEntities.g1.ui
    );
    expect(store.state.collections.tableGroupEntities.empty.ui).toMatchObject({
      x: -50,
      y: -50,
      width: 20,
      height: 20,
    });
    for (const id of ['wide', 'narrow', 'loose']) {
      expect(tableOf(store, id).ui).toMatchObject({
        x: tableOf(sorted, id).ui.x,
        y: tableOf(sorted, id).ui.y,
      });
    }
  });

  it('measures on copies of the groups too, so a live group stays put until its resize lands', () => {
    seedGroups(store);

    flatten(store, sortTablesToMoveAction$());

    expect(store.state.collections.tableGroupEntities.g1.ui).toMatchObject({
      x: 900,
      y: 900,
      width: 10,
      height: 10,
    });
  });
});

describe('changeTableNameAction$', () => {
  it('renames the table and turns its derived flag off in the same dispatch', () => {
    const store = createTestStore();
    seedTable(store, 't1');
    store.dispatchSync(changeTableNameDerivedAction({ id: 't1', value: true }));

    expect(flatten(store, changeTableNameAction$('t1', 'members'))).toEqual([
      expect.objectContaining({
        type: 'table.changeName',
        payload: { id: 't1', value: 'members' },
      }),
      expect.objectContaining({
        type: 'table.changeNameDerived',
        payload: { id: 't1', value: false },
      }),
    ]);

    store.dispatchSync(changeTableNameAction$('t1', 'members'));
    expect(store.state.collections.tableEntities.t1).toMatchObject({
      name: 'members',
      nameDerived: false,
    });
  });

  it('renames alone while the flag is off, as for a table it does not hold', () => {
    const store = createTestStore();
    seedTable(store, 't1');

    expect(typesOf(store, changeTableNameAction$('t1', 'members'))).toEqual([
      'table.changeName',
    ]);
    expect(typesOf(store, changeTableNameAction$('ghost', 'members'))).toEqual([
      'table.changeName',
    ]);
  });
});

describe('actions$', () => {
  it('exposes every generator action of the table module', () => {
    expect(Object.keys(actions$).sort()).toEqual([
      'addTableAction$',
      'changeTableNameAction$',
      'pasteTableAction$',
      'removeTableAction$',
      'selectTableAction$',
      'sortTablesToMoveAction$',
    ]);
  });
});
