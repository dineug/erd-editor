import { query } from '@dineug/erd-editor-schema';
import { type AnyAction } from '@dineug/r-html';
import {
  asapScheduler,
  type Observable,
  observeOn,
  throttle,
  timer,
} from 'rxjs';

import { ColumnOption, ColumnUIKey } from '@/constants/schema';
import type { Hook, HookEffect } from '@/engine/hooks';
import {
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import {
  addRelationshipAction,
  changeRelationshipColumnsAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnPrimaryKeyAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import type { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';

/**
 * These hooks write straight into the observable state, so they must not run
 * inside the dispatch that triggered them — the store is still notifying its
 * observers at that point.
 */
const deferred = (action$: Observable<AnyAction>) =>
  action$.pipe(observeOn(asapScheduler));

const changeColumnNotNullHook: HookEffect = (action$, getState) =>
  deferred(action$).subscribe(
    ({ payload: { id } }: ReturnType<typeof changeColumnPrimaryKeyAction>) => {
      const { collections } = getState();
      const collection = query(collections).collection('tableColumnEntities');
      const column = collection.selectById(id);
      if (!column) return;

      const isPrimaryKey = bHas(column.options, ColumnOption.primaryKey);
      if (!isPrimaryKey) return;

      const isNotNull = bHas(column.options, ColumnOption.notNull);
      if (isNotNull) return;

      column.options = column.options | ColumnOption.notNull;
    }
  );

/**
 * Marks as a foreign key every column of a table in the document that a
 * relationship in the document ends on in that table, and clears every other
 * one, a removed column's too, so a file's bits never hang on arrival order.
 */
export function validateForeignKeys({ doc, collections }: RootState) {
  const endColumnIds = new Map<string, Set<string>>();
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(doc.relationshipIds);

  for (const { end } of relationships) {
    const ids = endColumnIds.get(end.tableId) ?? new Set<string>();
    end.columnIds.forEach(id => ids.add(id));
    endColumnIds.set(end.tableId, ids);
  }

  const tableIdOf = new Map<string, string>();
  for (const table of query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds)) {
    table.columnIds.forEach(id => tableIdOf.set(id, table.id));
  }

  for (const column of query(collections)
    .collection('tableColumnEntities')
    .selectAll()) {
    const tableId = tableIdOf.get(column.id);
    const value =
      tableId !== undefined &&
      (endColumnIds.get(tableId)?.has(column.id) ?? false);
    if (value === bHas(column.ui.keys, ColumnUIKey.foreignKey)) continue;

    column.ui.keys = value
      ? column.ui.keys | ColumnUIKey.foreignKey
      : column.ui.keys & ~ColumnUIKey.foreignKey;
  }
}

/**
 * Reads the flags whole once per batch, in the microtask after it: a flag set
 * or cleared one relationship at a time lost a column another one still ended
 * on, and a headless peer writes its file one scheduler turn after a batch.
 */
const validationForeignKeyHook: HookEffect = (action$, getState) =>
  action$
    .pipe(
      throttle(() => timer(0, asapScheduler), {
        leading: false,
        trailing: true,
      })
    )
    .subscribe(() => validateForeignKeys(getState()));

/** What can add or drop a relationship's end or the column or table under one. */
const foreignKeyActions = [
  addRelationshipAction,
  removeRelationshipAction,
  changeRelationshipColumnsAction,
  addColumnAction,
  removeColumnAction,
  addTableAction,
  removeTableAction,
  loadJsonAction,
  initialLoadJsonAction,
];

export const hooks: Hook[] = [
  [[changeColumnPrimaryKeyAction], changeColumnNotNullHook],
  [foreignKeyActions, validationForeignKeyHook],
];
