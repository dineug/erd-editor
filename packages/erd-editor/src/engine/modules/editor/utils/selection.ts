import { SelectType } from '@/engine/modules/editor/state';

export type SelectTypeIds = {
  tableIds: string[];
  memoIds: string[];
};

/**
 * The selected tables' and memos' ids apart, in selection order: one split
 * for the move and the color picker, so both reach the same.
 */
export function getSelectTypeIds(
  selectedMap: Record<string, SelectType>
): SelectTypeIds {
  return Object.entries(selectedMap).reduce<SelectTypeIds>(
    (acc, [id, type]) => {
      if (type === SelectType.table) {
        acc.tableIds.push(id);
      } else if (type === SelectType.memo) {
        acc.memoIds.push(id);
      }

      return acc;
    },
    { tableIds: [], memoIds: [] }
  );
}
