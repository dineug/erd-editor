import { query } from '@dineug/erd-editor-schema';
import { type AnyAction } from '@dineug/r-html';
import {
  asapScheduler,
  type Observable,
  observeOn,
  throttle,
  timer,
} from 'rxjs';

import { ColumnOption } from '@/constants/schema';
import type { Hook, HookEffect } from '@/engine/hooks';
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
import { bHas } from '@/utils/bit';

import { validateForeignKeys } from './keys';

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

/**
 * What can add or drop a relationship's end or the column or table under one.
 * A load writes the bits itself before its reducer returns (settleDocument).
 */
const foreignKeyActions = [
  addRelationshipAction,
  removeRelationshipAction,
  changeRelationshipColumnsAction,
  addColumnAction,
  removeColumnAction,
  addTableAction,
  removeTableAction,
];

export const hooks: Hook[] = [
  [[changeColumnPrimaryKeyAction], changeColumnNotNullHook],
  [foreignKeyActions, validationForeignKeyHook],
];
