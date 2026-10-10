import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import { Memo, Table, TableGroup } from '@/internal-types';
import { toOpaqueHex } from '@/utils/tableColor';

import { getSelectTypeIds } from './selection';

type ColorTargets = {
  tables: Table[];
  memos: Memo[];
  tableGroups: TableGroup[];
};

/** The selected tables, memos and table groups, the whole of what the color picker paints. */
export function getColorTargets({
  editor: { selectedMap },
  collections,
}: RootState): ColorTargets {
  const { tableIds, memoIds, tableGroupIds } = getSelectTypeIds(selectedMap);

  return {
    tables: query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds),
    memos: query(collections).collection('memoEntities').selectByIds(memoIds),
    tableGroups: query(collections)
      .collection('tableGroupEntities')
      .selectByIds(tableGroupIds),
  };
}

/** The color targets that carry a color, which is all Remove color reaches. */
export function getColoredSelection(state: RootState): ColorTargets {
  const { tables, memos, tableGroups } = getColorTargets(state);

  return {
    tables: tables.filter(table => table.ui.color !== ''),
    memos: memos.filter(memo => memo.ui.color !== ''),
    tableGroups: tableGroups.filter(group => group.color !== ''),
  };
}

/** Whether any selected table, memo or group carries a color, which the menus' Remove color shows on. */
export function hasColoredSelection(state: RootState): boolean {
  const { tables, memos, tableGroups } = getColoredSelection(state);
  return tables.length !== 0 || memos.length !== 0 || tableGroups.length !== 0;
}

/**
 * The colors the document's tables, memos and table groups carry as opaque
 * #rrggbb, the most used first and a tie in document order; one it cannot
 * read is left out.
 */
export function getDocumentColors({ doc, collections }: RootState): string[] {
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds);
  const memos = query(collections)
    .collection('memoEntities')
    .selectByIds(doc.memoIds);
  const groups = query(collections)
    .collection('tableGroupEntities')
    .selectByIds(doc.tableGroupIds);
  const counts = new Map<string, number>();

  for (const value of [
    ...[...tables, ...memos].map(({ ui }) => ui.color),
    ...groups.map(({ color }) => color),
  ]) {
    const color = toOpaqueHex(value);
    if (color) counts.set(color, (counts.get(color) ?? 0) + 1);
  }

  return [...counts].sort(([, a], [, b]) => b - a).map(([color]) => color);
}
