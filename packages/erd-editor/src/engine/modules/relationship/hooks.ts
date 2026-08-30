import { query } from '@dineug/erd-editor-schema';
import { arrayHas } from '@dineug/shared';
import { tap, throttleTime } from 'rxjs';

import { ColumnOption, StartRelationshipType } from '@/constants/schema';
import type { Hook, HookEffect } from '@/engine/hooks';
import {
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import { moveMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  addRelationshipAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import {
  changeMaxWidthCommentAction,
  changeShowAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableCommentAction,
  changeTableNameAction,
  moveTableAction,
  moveToTableAction,
  removeTableAction,
  sortTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import { bHas } from '@/utils/bit';
import { invalidateTableWidths } from '@/utils/calcTable';
import { relationshipSort } from '@/utils/draw-relationship/sort';

const identificationHook: HookEffect = (action$, getState) =>
  action$
    .pipe(throttleTime(10, undefined, { leading: false, trailing: true }))
    .subscribe(() => {
      const { doc, collections } = getState();
      const collection = query(collections).collection('relationshipEntities');
      const relationships = collection.selectByIds(doc.relationshipIds);

      for (const relationship of relationships) {
        const { end, identification } = relationship;
        const table = query(collections)
          .collection('tableEntities')
          .selectById(end.tableId);
        if (!table) continue;

        const has = arrayHas(table.columnIds);
        const columns = query(collections)
          .collection('tableColumnEntities')
          .selectByIds(end.columnIds)
          .filter(column => has(column.id));
        if (!columns.length) continue;

        const value = columns.every(column =>
          bHas(column.options, ColumnOption.primaryKey)
        );

        if (value === identification) {
          continue;
        }

        relationship.identification = value;
      }
    });

const startRelationshipHook: HookEffect = (action$, getState) =>
  action$
    .pipe(throttleTime(10, undefined, { leading: false, trailing: true }))
    .subscribe(() => {
      const { doc, collections } = getState();
      const collection = query(collections).collection('relationshipEntities');
      const relationships = collection.selectByIds(doc.relationshipIds);

      for (const relationship of relationships) {
        const { end, startRelationshipType } = relationship;
        const table = query(collections)
          .collection('tableEntities')
          .selectById(end.tableId);
        if (!table) continue;

        const has = arrayHas(table.columnIds);
        const columns = query(collections)
          .collection('tableColumnEntities')
          .selectByIds(end.columnIds)
          .filter(column => has(column.id));
        if (!columns.length) continue;

        const value = columns.every(column =>
          bHas(column.options, ColumnOption.notNull)
        )
          ? StartRelationshipType.dash
          : StartRelationshipType.ring;

        if (value === startRelationshipType) {
          continue;
        }

        relationship.startRelationshipType = value;
      }
    });

/**
 * Actions that move something without changing what it contains. Every other
 * action this hook wakes on can change a table's width, and the routing layer
 * caches those widths across sorts.
 */
const isMoveOnly = arrayHas<string>([
  moveTableAction.type,
  moveToTableAction.type,
  moveMemoAction.type,
]);

const relationshipSortHook: HookEffect = (action$, getState) =>
  action$
    .pipe(
      // Invalidation reads every action, the sort reads one per window. Putting
      // this after the throttle would drop the width-changing action whenever
      // it shared a window with a move.
      tap(action => {
        if (!isMoveOnly(action.type)) invalidateTableWidths();
      }),
      throttleTime(5, undefined, { leading: false, trailing: true })
    )
    .subscribe(() => {
      relationshipSort(getState());
    });

export const hooks: Hook[] = [
  [
    [
      removeColumnAction,
      changeColumnPrimaryKeyAction,
      loadJsonAction,
      initialLoadJsonAction,
    ],
    identificationHook,
  ],
  [
    [
      removeColumnAction,
      changeColumnNotNullAction,
      loadJsonAction,
      initialLoadJsonAction,
    ],
    startRelationshipHook,
  ],
  [
    [
      changeShowAction,
      changeMaxWidthCommentAction,
      addRelationshipAction,
      removeRelationshipAction,
      moveMemoAction,
      // Routing reads every table in the document, not only the two a
      // relationship connects, so the set of tables is part of its input: a
      // table appearing between two connected ones has to trigger a sort.
      addTableAction,
      removeTableAction,
      moveTableAction,
      moveToTableAction,
      changeTableNameAction,
      changeTableCommentAction,
      addColumnAction,
      removeColumnAction,
      changeColumnNameAction,
      changeColumnCommentAction,
      changeColumnDataTypeAction,
      changeColumnDefaultAction,
      sortTableAction,
    ],
    relationshipSortHook,
  ],
];
