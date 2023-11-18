import { takeEvery } from '@dineug/go';

import { ColumnOption, ColumnUIKey } from '@/constants/schema';
import type { CO, Hook } from '@/engine/hooks';
import {
  addRelationshipAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import { changeColumnPrimaryKeyAction } from '@/engine/modules/tableColumn/atom.actions';
import { bHas } from '@/utils/bit';
import { query } from '@/utils/collection/query';

const changeColumnNotNullHook: CO = function* (channel, { collections }) {
  yield takeEvery(
    channel,
    function* ({
      payload: { id },
    }: ReturnType<typeof changeColumnPrimaryKeyAction>) {
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

const addColumnForeignKeyHook: CO = function* (
  channel,
  { doc: { relationshipIds }, collections }
) {
  yield takeEvery(
    channel,
    function* ({
      payload: { id, end },
    }: ReturnType<typeof addRelationshipAction>) {
      if (!relationshipIds.includes(id)) return;

      const columns = query(collections)
        .collection('tableColumnEntities')
        .selectByIds(end.columnIds);

      for (const { ui } of columns) {
        ui.keys = ui.keys | ColumnUIKey.foreignKey;
      }
    }
  );
};

const removeColumnForeignKeyHook: CO = function* (
  channel,
  { doc: { relationshipIds }, collections }
) {
  yield takeEvery(
    channel,
    function* ({
      payload: { id },
    }: ReturnType<typeof removeRelationshipAction>) {
      if (relationshipIds.includes(id)) return;

      const relationship = query(collections)
        .collection('relationshipEntities')
        .selectById(id);
      if (!relationship) return;

      const { end } = relationship;
      const columns = query(collections)
        .collection('tableColumnEntities')
        .selectByIds(end.columnIds);

      for (const { ui } of columns) {
        ui.keys = ui.keys & ~ColumnUIKey.foreignKey;
      }
    }
  );
};

export const hooks: Hook[] = [
  [[changeColumnPrimaryKeyAction], changeColumnNotNullHook],
  [[addRelationshipAction], addColumnForeignKeyHook],
  [[removeRelationshipAction], removeColumnForeignKeyHook],
];
