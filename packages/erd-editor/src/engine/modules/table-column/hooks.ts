import { query } from '@dineug/erd-editor-schema';
import { type AnyAction } from '@dineug/r-html';
import { asapScheduler, type Observable, observeOn } from 'rxjs';

import { ColumnOption, ColumnUIKey } from '@/constants/schema';
import type { Hook, HookEffect } from '@/engine/hooks';
import {
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import {
  addRelationshipAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import { changeColumnPrimaryKeyAction } from '@/engine/modules/table-column/atom.actions';
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

const addColumnForeignKeyHook: HookEffect = (action$, getState) =>
  deferred(action$).subscribe(
    ({ payload: { id, end } }: ReturnType<typeof addRelationshipAction>) => {
      const {
        doc: { relationshipIds },
        collections,
      } = getState();
      if (!relationshipIds.includes(id)) return;

      const columns = query(collections)
        .collection('tableColumnEntities')
        .selectByIds(end.columnIds);

      for (const column of columns) {
        column.ui.keys = column.ui.keys | ColumnUIKey.foreignKey;
      }
    }
  );

const removeColumnForeignKeyHook: HookEffect = (action$, getState) =>
  deferred(action$).subscribe(
    ({ payload: { id } }: ReturnType<typeof removeRelationshipAction>) => {
      const {
        doc: { relationshipIds },
        collections,
      } = getState();
      if (relationshipIds.includes(id)) return;

      const relationship = query(collections)
        .collection('relationshipEntities')
        .selectById(id);
      if (!relationship) return;

      const columns = query(collections)
        .collection('tableColumnEntities')
        .selectByIds(relationship.end.columnIds);

      for (const column of columns) {
        column.ui.keys = column.ui.keys & ~ColumnUIKey.foreignKey;
      }
    }
  );

const validationForeignKeyHook: HookEffect = (action$, getState) =>
  deferred(action$).subscribe(() => {
    const { doc, collections } = getState();
    const relationships = query(collections)
      .collection('relationshipEntities')
      .selectByIds(doc.relationshipIds);
    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(doc.tableIds);
    const foreignKeyColumnIdsSet = new Set<string>();
    const columnCollection = query(collections).collection(
      'tableColumnEntities'
    );

    for (const { end } of relationships) {
      const columns = columnCollection.selectByIds(end.columnIds);

      for (const column of columns) {
        column.ui.keys = column.ui.keys | ColumnUIKey.foreignKey;
        foreignKeyColumnIdsSet.add(column.id);
      }
    }

    for (const table of tables) {
      const columns = columnCollection.selectByIds(table.columnIds);

      for (const column of columns) {
        if (
          bHas(column.ui.keys, ColumnUIKey.foreignKey) &&
          !foreignKeyColumnIdsSet.has(column.id)
        ) {
          column.ui.keys = column.ui.keys & ~ColumnUIKey.foreignKey;
        }
      }
    }
  });

export const hooks: Hook[] = [
  [[changeColumnPrimaryKeyAction], changeColumnNotNullHook],
  [[addRelationshipAction], addColumnForeignKeyHook],
  [[removeRelationshipAction], removeColumnForeignKeyHook],
  [[loadJsonAction, initialLoadJsonAction], validationForeignKeyHook],
];
