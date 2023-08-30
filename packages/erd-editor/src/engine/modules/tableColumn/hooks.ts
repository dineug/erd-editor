import { SchemaV3Constants } from '@dineug/erd-editor-schema';
import { throttle } from '@dineug/go';

import type { CO, Hook } from '@/engine/hooks';
import { query } from '@/utils/collection/query';

import {
  changeColumnPrimaryKeyAction,
  removeColumnAction,
} from './atom.actions';

const identification: CO = function* (channel, { doc, collections }) {
  yield throttle(
    channel,
    () => {
      // TODO: get valid relationships util
      const collection = query(collections).collection('relationshipEntities');
      const relationships = collection.selectByIds(doc.relationshipIds);

      for (const relationship of relationships) {
        const { start, end } = relationship;
        if (
          !doc.tableIds.includes(start.tableId) ||
          !doc.tableIds.includes(end.tableId)
        ) {
          continue;
        }

        const table = query(collections)
          .collection('tableEntities')
          .selectById(end.tableId);
        if (!table) continue;

        const columns = query(collections)
          .collection('tableColumnEntities')
          .selectByIds(end.columnIds)
          .filter(column => table.columnIds.includes(column.id));
        if (!columns.length) continue;

        const identification = columns.every(
          column => column.options & SchemaV3Constants.ColumnUIKey.primaryKey
        );

        collection.updateOne(relationship.id, relationship => {
          relationship.identification = identification;
        });
      }
    },
    200,
    {
      leading: true,
      trailing: true,
    }
  );
};

export const hooks: Hook[] = [
  [[removeColumnAction, changeColumnPrimaryKeyAction], identification],
];
