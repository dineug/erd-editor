import { query } from '@dineug/erd-editor-schema';

import {
  isSerialType,
  toReferenceDataType,
} from '@/engine/modules/relationship/referenceType';
import { ChangeColumnValuePayload } from '@/engine/modules/table-column/actions';
import { RootState } from '@/engine/state';

type DataTypeSyncEnd = { tableId: string; columnIds: string[] };

/** The two ends of a relationship, all the data type sync reads of one. */
export type DataTypeSyncRelationship = {
  start: DataTypeSyncEnd;
  end: DataTypeSyncEnd;
};

/**
 * Drains the stack, listing each column its relationships reach once: a key
 * sends its foreign keys toReferenceDataType of its value, a foreign key sends
 * its key its value, unless the key is serial, which keeps it and stops there.
 *
 * @param relationships The relationships to follow, the document's by default;
 * a caller about to change one hands the list as it will stand.
 */
export function getDataTypeSyncColumns(
  stack: ChangeColumnValuePayload[],
  state: RootState,
  payloads: ChangeColumnValuePayload[] = [],
  relationships: DataTypeSyncRelationship[] = query(state.collections)
    .collection('relationshipEntities')
    .selectByIds(state.doc.relationshipIds)
): ChangeColumnValuePayload[] {
  const {
    collections,
    settings: { database },
  } = state;
  const columns = query(collections).collection('tableColumnEntities');

  for (let target = stack.pop(); target; target = stack.pop()) {
    const { id: targetId, value } = target;
    if (payloads.some(({ id }) => id === targetId)) continue;

    payloads.push(target);
    const foreignKeyValue = toReferenceDataType(value, database);

    for (const { start, end } of relationships) {
      const startIndex = start.columnIds.indexOf(targetId);

      if (startIndex !== -1) {
        const id = end.columnIds[startIndex];
        if (id === undefined) continue;

        stack.push({ id, tableId: end.tableId, value: foreignKeyValue });
        continue;
      }

      const endIndex = end.columnIds.indexOf(targetId);
      if (endIndex === -1) continue;

      const id = start.columnIds[endIndex];
      if (id === undefined) continue;

      const column = columns.selectById(id);
      if (column && isSerialType(column.dataType)) continue;

      stack.push({ id, tableId: start.tableId, value });
    }
  }

  return payloads;
}
