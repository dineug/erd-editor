import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import { Memo, Table } from '@/internal-types';
import { toOpaqueHex } from '@/utils/tableColor';

import { getSelectTypeIds } from './selection';

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

/**
 * The colors the document's tables and memos carry as opaque #rrggbb, the most
 * used first and a tie in document order; one it cannot read is left out.
 */
export function getDocumentColors({ doc, collections }: RootState): string[] {
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds);
  const memos = query(collections)
    .collection('memoEntities')
    .selectByIds(doc.memoIds);
  const counts = new Map<string, number>();

  for (const { ui } of [...tables, ...memos]) {
    const color = toOpaqueHex(ui.color);
    if (color) counts.set(color, (counts.get(color) ?? 0) + 1);
  }

  return [...counts].sort(([, a], [, b]) => b - a).map(([color]) => color);
}
