import { throttle } from '@dineug/go';
import { arrayHas } from '@dineug/shared';

import { ColumnOption, StartRelationshipType } from '@/constants/schema';
import type { CO, Hook } from '@/engine/hooks';
import {
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  removeColumnAction,
} from '@/engine/modules/tableColumn/atom.actions';
import { query } from '@/utils/collection/query';

const identification: CO = function* (channel, { doc, collections }) {
  yield throttle(
    channel,
    () => {
      const collection = query(collections).collection('relationshipEntities');
      const relationships = collection.selectByIds(doc.relationshipIds);

      for (const { id, end, identification } of relationships) {
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

        const value = columns.every(
          column => column.options & ColumnOption.primaryKey
        );

        if (value === identification) {
          continue;
        }

        collection.updateOne(id, relationship => {
          relationship.identification = value;
        });
      }
    },
    500,
    {
      leading: false,
      trailing: true,
    }
  );
};

const startRelationship: CO = function* (channel, { doc, collections }) {
  yield throttle(
    channel,
    () => {
      const collection = query(collections).collection('relationshipEntities');
      const relationships = collection.selectByIds(doc.relationshipIds);

      for (const { id, end, startRelationshipType } of relationships) {
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

        const value = columns.every(
          column => column.options & ColumnOption.notNull
        )
          ? StartRelationshipType.dash
          : StartRelationshipType.ring;

        if (value === startRelationshipType) {
          continue;
        }

        collection.updateOne(id, relationship => {
          relationship.startRelationshipType = value;
        });
      }
    },
    500,
    {
      leading: false,
      trailing: true,
    }
  );
};

export const hooks: Hook[] = [
  [[removeColumnAction, changeColumnPrimaryKeyAction], identification],
  [[removeColumnAction, changeColumnNotNullAction], startRelationship],
];
