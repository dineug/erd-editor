import { RelationshipType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnNameAction,
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
} from '@/engine/modules/table-column/atom.actions';
import { createStore, Store } from '@/engine/store';

/** A store a spec can seed, the bare one or an element's. */
export type MapSeedStore = Pick<Store, 'dispatchSync' | 'state'>;

export type MapSeedColumn = {
  id: string;
  name?: string;
  dataType?: string;
  primaryKey?: boolean;
  unique?: boolean;
};

/** A bare store whose widths are a fixed estimate. */
export const createMapStore = () =>
  createStore({ toWidth: text => text.length * 10, clock: new Clock() });

/** Adds a table of that name and its columns, in order, each with what it names. */
export function seedMapTable(
  store: MapSeedStore,
  id: string,
  name: string,
  columns: MapSeedColumn[] = []
) {
  store.dispatchSync(
    addTableAction({ id, ui: { x: 0, y: 0, zIndex: 2 } }),
    changeTableNameAction({ id, value: name })
  );

  for (const column of columns) {
    addMapColumn(store, id, column);
  }
}

/** Adds one column to the end of the table. */
export function addMapColumn(
  store: MapSeedStore,
  tableId: string,
  { id, name = id, dataType = '', primaryKey, unique }: MapSeedColumn
) {
  const payload = { id, tableId };
  store.dispatchSync(
    addColumnAction(payload),
    changeColumnNameAction({ ...payload, value: name }),
    changeColumnDataTypeAction({ ...payload, value: dataType }),
    ...(primaryKey
      ? [changeColumnPrimaryKeyAction({ ...payload, value: true })]
      : []),
    ...(unique ? [changeColumnUniqueAction({ ...payload, value: true })] : [])
  );
}

/** Adds a relationship whose end columns reference its start columns by place. */
export function seedMapRelationship(
  store: MapSeedStore,
  id: string,
  [startTableId, startColumnIds]: [string, string[]],
  [endTableId, endColumnIds]: [string, string[]],
  relationshipType: number = RelationshipType.OneN
) {
  store.dispatchSync(
    addRelationshipAction({
      id,
      relationshipType,
      start: { tableId: startTableId, columnIds: startColumnIds },
      end: { tableId: endTableId, columnIds: endColumnIds },
    })
  );
}
