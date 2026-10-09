import { SelectType } from '@/engine/modules/editor/state';

export type SelectTypeIds = {
  tableIds: string[];
  memoIds: string[];
  tableGroupIds: string[];
};

/**
 * The selected tables', memos' and table groups' ids apart, in selection
 * order: one split for the move and the color picker, so both reach the same.
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
      } else if (type === SelectType.tableGroup) {
        acc.tableGroupIds.push(id);
      }

      return acc;
    },
    { tableIds: [], memoIds: [], tableGroupIds: [] }
  );
}
