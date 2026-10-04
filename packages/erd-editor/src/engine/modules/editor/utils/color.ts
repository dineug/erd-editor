import { query } from '@dineug/erd-editor-schema';

import { getSelectTypeIds } from '@/engine/modules/editor/utils/selection';
import { RootState } from '@/engine/state';
import { Memo, Table } from '@/internal-types';

type ColorTargets = {
  tables: Table[];
  memos: Memo[];
};

/** The selected tables and memos, the whole of what the color picker paints. */
export function getColorTargets({
  editor: { selectedMap },
  collections,
}: RootState): ColorTargets {
  const { tableIds, memoIds } = getSelectTypeIds(selectedMap);

  return {
    tables: query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds),
    memos: query(collections).collection('memoEntities').selectByIds(memoIds),
  };
}

/** The color targets that carry a color, which is all Remove color reaches. */
export function getColoredSelection(state: RootState): ColorTargets {
  const { tables, memos } = getColorTargets(state);

  return {
    tables: tables.filter(table => table.ui.color !== ''),
    memos: memos.filter(memo => memo.ui.color !== ''),
  };
}

/** Whether any selected table or memo carries a color, which the menus' Remove color shows on. */
export function hasColoredSelection(state: RootState): boolean {
  const { tables, memos } = getColoredSelection(state);
  return tables.length !== 0 || memos.length !== 0;
}
