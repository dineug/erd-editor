import { SchemaV3Constants } from '@dineug/erd-editor-schema';
import { throttle } from '@dineug/go';
import { arrayHas } from '@dineug/shared';

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
          column => column.options & SchemaV3Constants.ColumnOption.primaryKey
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
      leading: true,
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
          column => column.options & SchemaV3Constants.ColumnOption.notNull
        )
          ? SchemaV3Constants.StartRelationshipType.dash
          : SchemaV3Constants.StartRelationshipType.ring;

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
      leading: true,
      trailing: true,
    }
  );
};

export const hooks: Hook[] = [
  [[removeColumnAction, changeColumnPrimaryKeyAction], identification],
  [[removeColumnAction, changeColumnNotNullAction], startRelationship],
];
