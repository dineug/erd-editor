import { takeEvery } from '@dineug/go';

import { ColumnOption } from '@/constants/schema';
import type { CO, Hook } from '@/engine/hooks';
import { changeColumnPrimaryKeyAction } from '@/engine/modules/tableColumn/atom.actions';
import { bHas } from '@/utils/bit';
import { query } from '@/utils/collection/query';

const changeColumnNotNullHook: CO = function* (channel, { doc, collections }) {
  yield takeEvery(channel, function* ({ payload: { id } }) {
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
  });
};

export const hooks: Hook[] = [
  [[changeColumnPrimaryKeyAction], changeColumnNotNullHook],
];
