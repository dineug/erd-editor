import { query } from '@dineug/erd-editor-schema';

import { ChangeColumnValuePayload } from '@/engine/modules/table-column/actions';
import { RootState } from '@/engine/state';

export function getDataTypeSyncColumns(
  stack: ChangeColumnValuePayload[],
  state: RootState,
  payload: ChangeColumnValuePayload,
  payloads: ChangeColumnValuePayload[] = []
): ChangeColumnValuePayload[] {
  const {
    doc: { relationshipIds },
    collections,
  } = state;
  const target = stack.pop();

  if (target) {
    if (!payloads.some(({ id }) => id === target.id)) {
      payloads.push(target);

      query(collections)
        .collection('relationshipEntities')
        .selectByIds(relationshipIds)
        .forEach(({ start, end }) => {
          const index = start.columnIds.indexOf(target.id);

          if (index !== -1) {
            const columnId = end.columnIds[index];

            stack.push({
              id: columnId,
              tableId: end.tableId,
              value: payload.value,
            });
          } else {
            const index = end.columnIds.indexOf(target.id);

            if (index !== -1) {
              const columnId = start.columnIds[index];

              stack.push({
                id: columnId,
                tableId: start.tableId,
                value: payload.value,
              });
            }
          }
        });
    }

    getDataTypeSyncColumns(stack, state, payload, payloads);
  }

  return payloads;
}
