import { query } from '@dineug/erd-editor-schema';

import {
  isSerialType,
  toReferenceDataType,
} from '@/engine/modules/relationship/referenceType';
import { ChangeColumnValuePayload } from '@/engine/modules/table-column/actions';
import { RootState } from '@/engine/state';

/**
 * Drains the stack, listing each column its relationships reach once: a key
 * sends its foreign keys toReferenceDataType of its value, and a foreign key
 * sends its key its value, but no serial value and nothing to a serial key.
 */
export function getDataTypeSyncColumns(
  stack: ChangeColumnValuePayload[],
  state: RootState,
  payloads: ChangeColumnValuePayload[] = []
): ChangeColumnValuePayload[] {
  const {
    doc: { relationshipIds },
    collections,
    settings: { database },
  } = state;
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds);
  const columns = query(collections).collection('tableColumnEntities');

  for (let target = stack.pop(); target; target = stack.pop()) {
    const { id: targetId, value } = target;
    if (payloads.some(({ id }) => id === targetId)) continue;

    payloads.push(target);
    const foreignKeyValue = toReferenceDataType(value, database);
    const serialValue = isSerialType(value);

    for (const { start, end } of relationships) {
      const startIndex = start.columnIds.indexOf(targetId);

      if (startIndex !== -1) {
        const id = end.columnIds[startIndex];
        if (id === undefined) continue;

        stack.push({ id, tableId: end.tableId, value: foreignKeyValue });
        continue;
      }

      const endIndex = end.columnIds.indexOf(targetId);
      if (endIndex === -1 || serialValue) continue;

      const id = start.columnIds[endIndex];
      if (id === undefined) continue;

      const column = columns.selectById(id);
      if (column && isSerialType(column.dataType)) continue;

      stack.push({ id, tableId: start.tableId, value });
    }
  }

  return payloads;
}
