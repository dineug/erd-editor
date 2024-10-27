import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';

type TargetSource = {
  columnId: string;
  relationshipIds: string[];
};

export function findRelationshipColumn(
  stack: TargetSource[],
  state: RootState,
  result: TargetSource[] = []
): TargetSource[] {
  const {
    doc: { relationshipIds },
    collections,
  } = state;
  const target = stack.pop();

  if (target) {
    if (!result.some(({ columnId }) => columnId === target.columnId)) {
      result.push(target);

      query(collections)
        .collection('relationshipEntities')
        .selectByIds(relationshipIds)
        .forEach(({ id: relationshipId, start, end }) => {
          const index = start.columnIds.indexOf(target.columnId);

          if (index !== -1) {
            const columnId = end.columnIds[index];

            stack.push({
              columnId,
              relationshipIds: [relationshipId],
            });
          } else {
            const index = end.columnIds.indexOf(target.columnId);

            if (index !== -1) {
              const columnId = start.columnIds[index];

              stack.push({
                columnId,
                relationshipIds: [relationshipId],
              });
            }
          }
        });
    }

    findRelationshipColumn(stack, state, result);
  }

  return result;
}
