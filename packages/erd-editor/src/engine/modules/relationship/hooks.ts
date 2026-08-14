import { query } from '@dineug/erd-editor-schema';
import { arrayHas } from '@dineug/shared';
import { throttleTime } from 'rxjs';

import { ColumnOption, StartRelationshipType } from '@/constants/schema';
import type { Hook, HookEffect } from '@/engine/hooks';
import {
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import { moveMemoAction } from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeMaxWidthCommentAction,
  changeShowAction,
} from '@/engine/modules/settings/atom.actions';
import {
  changeTableCommentAction,
  changeTableNameAction,
  moveTableAction,
  moveToTableAction,
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

const relationshipSortHook: HookEffect = (action$, getState) =>
  action$
    .pipe(throttleTime(5, undefined, { leading: false, trailing: true }))
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
      moveMemoAction,
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
