import { query } from '@dineug/erd-editor-schema';
import { throttle } from '@dineug/go';
import { arrayHas } from '@dineug/shared';

import { ColumnOption, StartRelationshipType } from '@/constants/schema';
import type { CO, Hook } from '@/engine/hooks';
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

const identificationHook: CO = function* (channel, getState) {
  yield throttle(
    channel,
    function* () {
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
    },
    10,
    { leading: false, trailing: true }
  );
};

const startRelationshipHook: CO = function* (channel, getState) {
  yield throttle(
    channel,
    function* () {
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
    },
    10,
    { leading: false, trailing: true }
  );
};

const relationshipSortHook: CO = function* (channel, getState) {
  yield throttle(
    channel,
    function* () {
      relationshipSort(getState());
    },
    5,
    { leading: false, trailing: true }
  );
};

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
