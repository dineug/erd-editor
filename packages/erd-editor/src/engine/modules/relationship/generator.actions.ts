import { query } from '@dineug/erd-editor-schema';
import { nanoid } from 'nanoid';

import { ColumnOption } from '@/constants/schema';
import { GeneratorAction } from '@/engine/generator.actions';
import {
  addColumnAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { bHas } from '@/utils/bit';
import { createColumn } from '@/utils/collection/tableColumn.entity';

import { addRelationshipAction } from './atom.actions';
import { toForeignKeyActions } from './fkColumns';

/**
 * Draws a relationship between two live tables in one batch, giving the start
 * table a primary key first when it has none and copying the keys onto the end
 * table, which may be the start table itself. An unknown table yields nothing.
 */
export const addRelationshipAction$ = (
  startTableId: string,
  endTableId: string,
  relationshipType: number
): GeneratorAction =>
  function* ({ doc: { tableIds }, collections }) {
    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds);
    const startTable = tables.find(({ id }) => id === startTableId);
    const endTable = tables.find(({ id }) => id === endTableId);
    if (!startTable || !endTable) return;

    const primaryKeys = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(startTable.columnIds)
      .filter(({ options }) => bHas(options, ColumnOption.primaryKey));
    const newPrimaryKey = primaryKeys.length
      ? null
      : createColumn({ tableId: startTable.id });
    const startColumns = newPrimaryKey ? [newPrimaryKey] : primaryKeys;
    const endColumnIds = startColumns.map(() => nanoid());

    yield [
      ...(newPrimaryKey
        ? [
            addColumnAction({
              id: newPrimaryKey.id,
              tableId: startTable.id,
            }),
            changeColumnPrimaryKeyAction({
              id: newPrimaryKey.id,
              tableId: startTable.id,
              value: true,
            }),
          ]
        : []),
      ...toForeignKeyActions(startColumns, endTable.id, endColumnIds),
      addRelationshipAction({
        id: nanoid(),
        relationshipType,
        start: {
          tableId: startTable.id,
          columnIds: startColumns.map(({ id }) => id),
        },
        end: {
          tableId: endTable.id,
          columnIds: endColumnIds,
        },
      }),
    ];
  };

export const actions$ = {
  addRelationshipAction$,
};
