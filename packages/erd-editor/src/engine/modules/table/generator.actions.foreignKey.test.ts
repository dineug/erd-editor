import { AnyAction, compositionActionsFlat } from '@dineug/r-html';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { RelationshipType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  drawEndRelationshipAction,
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
  focusTableAction,
  selectAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeZIndexAction,
} from '@/engine/modules/table/atom.actions';
import { selectTableAction$ } from '@/engine/modules/table/generator.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { createStore, Store } from '@/engine/store';

const ids = vi.hoisted(() => ({ next: 0 }));

vi.mock('nanoid', () => ({ nanoid: () => `id-${++ids.next}` }));

type SeedColumn = {
  id: string;
  name: string;
  dataType: string;
  default: string;
  comment: string;
  primaryKey: boolean;
};

let store: Store;

beforeEach(() => {
  store = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  });
});

function seedTable(id: string, columns: SeedColumn[] = []) {
  store.dispatchSync(addTableAction({ id, ui: { x: 0, y: 0, zIndex: 2 } }));

  for (const column of columns) {
    const payload = { id: column.id, tableId: id };
    store.dispatchSync(
      addColumnAction(payload),
      changeColumnPrimaryKeyAction({ ...payload, value: column.primaryKey }),
      changeColumnNameAction({ ...payload, value: column.name }),
      changeColumnDataTypeAction({ ...payload, value: column.dataType }),
      changeColumnDefaultAction({ ...payload, value: column.default }),
      changeColumnCommentAction({ ...payload, value: column.comment })
    );
  }
}

function startDrawingFrom(tableId: string) {
  store.dispatchSync(
    drawStartRelationshipAction({ relationshipType: RelationshipType.OneN })
  );
  store.dispatchSync(drawStartAddRelationshipAction({ tableId }));
}

function flattenFromFreshIds(action: any): AnyAction[] {
  ids.next = 0;
  return compositionActionsFlat(store.state, store.context, [action]);
}

function foreignKeyActions(
  id: string,
  tableId: string,
  column: Omit<SeedColumn, 'id' | 'primaryKey'>
): AnyAction[] {
  const payload = { id, tableId };
  return [
    addColumnAction(payload),
    changeColumnNotNullAction({ ...payload, value: true }),
    changeColumnNameAction({ ...payload, value: column.name }),
    changeColumnDataTypeAction({ ...payload, value: column.dataType }),
    changeColumnDefaultAction({ ...payload, value: column.default }),
    changeColumnCommentAction({ ...payload, value: column.comment }),
  ];
}

const idColumn: SeedColumn = {
  id: 'c1',
  name: 'id',
  dataType: 'int',
  default: '0',
  comment: 'pk',
  primaryKey: true,
};
const codeColumn: SeedColumn = {
  id: 'c2',
  name: 'code',
  dataType: 'varchar(8)',
  default: '',
  comment: 'second key',
  primaryKey: true,
};
const nameColumn: SeedColumn = {
  id: 'c3',
  name: 'name',
  dataType: 'text',
  default: 'n/a',
  comment: 'not a key',
  primaryKey: false,
};

describe('selectTableAction$ foreign key copy', () => {
  it('emits the exact foreign key sequence for every primary key in order', () => {
    seedTable('t1', [idColumn, nameColumn, codeColumn]);
    seedTable('t2');
    startDrawingFrom('t1');

    expect(flattenFromFreshIds(selectTableAction$('t2', false))).toEqual([
      unselectAllAction(),
      selectAction({ t2: SelectType.table }),
      changeZIndexAction({ id: 't2', zIndex: 3 }),
      focusTableAction({ tableId: 't2' }),
      ...foreignKeyActions('id-1', 't2', idColumn),
      ...foreignKeyActions('id-2', 't2', codeColumn),
      addRelationshipAction({
        id: 'id-3',
        relationshipType: RelationshipType.OneN,
        start: { tableId: 't1', columnIds: ['c1', 'c2'] },
        end: { tableId: 't2', columnIds: ['id-1', 'id-2'] },
      }),
      drawEndRelationshipAction(),
    ]);
  });

  it('copies onto the start table itself when it is also the end table', () => {
    seedTable('t1', [idColumn]);
    startDrawingFrom('t1');

    expect(flattenFromFreshIds(selectTableAction$('t1', true))).toEqual([
      selectAction({ t1: SelectType.table }),
      changeZIndexAction({ id: 't1', zIndex: 3 }),
      focusTableAction({ tableId: 't1' }),
      ...foreignKeyActions('id-1', 't1', idColumn),
      addRelationshipAction({
        id: 'id-2',
        relationshipType: RelationshipType.OneN,
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't1', columnIds: ['id-1'] },
      }),
      drawEndRelationshipAction(),
    ]);

    store.dispatchSync(selectTableAction$('t1', true));

    const table = store.state.collections.tableEntities.t1;
    expect(table.columnIds).toHaveLength(2);
    expect(store.state.doc.relationshipIds).toHaveLength(1);
  });
});
