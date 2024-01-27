import { query } from '@dineug/erd-editor-schema';
import { takeEvery } from '@dineug/go';

import { ColumnOption, ColumnUIKey } from '@/constants/schema';
import type { CO, Hook } from '@/engine/hooks';
import {
  addRelationshipAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import { changeColumnPrimaryKeyAction } from '@/engine/modules/table-column/atom.actions';
import { bHas } from '@/utils/bit';

const changeColumnNotNullHook: CO = function* (channel, state) {
  yield takeEvery(
    channel,
    function* ({
      payload: { id },
    }: ReturnType<typeof changeColumnPrimaryKeyAction>) {
      const { collections } = state;
      const collection = query(collections).collection('tableColumnEntities');
      const column = collection.selectById(id);
      if (!column) return;

      const isPrimaryKey = bHas(column.options, ColumnOption.primaryKey);
      if (!isPrimaryKey) return;

      const isNotNull = bHas(column.options, ColumnOption.notNull);
      if (isNotNull) return;

      collection.updateOne(id, column => {
        column.options = column.options | ColumnOption.notNull;
      });
    }
  );
};

const addColumnForeignKeyHook: CO = function* (channel, state) {
  yield takeEvery(
    channel,
    function* ({
      payload: { id, end },
    }: ReturnType<typeof addRelationshipAction>) {
      const {
        doc: { relationshipIds },
        collections,
      } = state;
      if (!relationshipIds.includes(id)) return;

      query(collections)
        .collection('tableColumnEntities')
        .updateMany(end.columnIds, column => {
          column.ui.keys = column.ui.keys | ColumnUIKey.foreignKey;
        });
    }
  );
};

const removeColumnForeignKeyHook: CO = function* (channel, state) {
  yield takeEvery(
    channel,
    function* ({
      payload: { id },
    }: ReturnType<typeof removeRelationshipAction>) {
      const {
        doc: { relationshipIds },
        collections,
      } = state;
      if (relationshipIds.includes(id)) return;

      const relationship = query(collections)
        .collection('relationshipEntities')
        .selectById(id);
      if (!relationship) return;

      query(collections)
        .collection('tableColumnEntities')
        .updateMany(relationship.end.columnIds, column => {
          column.ui.keys = column.ui.keys & ~ColumnUIKey.foreignKey;
        });
    }
  );
};

export const hooks: Hook[] = [
  [[changeColumnPrimaryKeyAction], changeColumnNotNullHook],
  [[addRelationshipAction], addColumnForeignKeyHook],
  [[removeRelationshipAction], removeColumnForeignKeyHook],
];
