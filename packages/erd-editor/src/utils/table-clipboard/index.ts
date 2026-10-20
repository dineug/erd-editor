import { ColumnType } from '@/constants/schema';
import {
  ColumnTypeShown,
  isLogicalNameView,
} from '@/engine/modules/editor/utils/nameView';
import type { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';
import { arrayHas } from '@/utils/arrayHas';

export * from './payload';
export * from './placement';

export type Cell = [CellType | '', string];
export type Row = Cell[];

export const CellType = {
  columnName: 'columnName',
  columnDataType: 'columnDataType',
  columnNotNull: 'columnNotNull',
  columnUnique: 'columnUnique',
  columnAutoIncrement: 'columnAutoIncrement',
  columnDefault: 'columnDefault',
  columnComment: 'columnComment',
  columnLogicalName: 'columnLogicalName',
  columnDomain: 'columnDomain',
} as const;
export type CellType = ValuesType<typeof CellType>;
export const hasCellType = arrayHas<string>(Object.values(CellType));

/**
 * The column types of a row's cells in their order, as the name view lays
 * them out: the logical view's name cell holds the logical name. A column
 * type this release does not know has no cell.
 */
export function getShowColumnOrder(
  show: number,
  columnOrder: number[],
  nameViewMode: RootState['settings']['nameViewMode']
): number[] {
  const settings = { show, nameViewMode };
  const logical = isLogicalNameView(settings);

  return columnOrder
    .filter(columnType => ColumnTypeShown[columnType]?.(settings) === true)
    .map(columnType =>
      logical && columnType === ColumnType.columnName
        ? ColumnType.columnLogicalName
        : columnType
    );
}
