import { arrayHas } from '@dineug/shared';

import { ColumnType, Show } from '@/constants/schema';
import { ValuesType } from '@/internal-types';
import { bHas } from '@/utils/bit';

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
} as const;
export type CellType = ValuesType<typeof CellType>;
export const hasCellType = arrayHas<string>(Object.values(CellType));

export function getShowColumnOrder(show: number, columnOrder: number[]) {
  return columnOrder.filter(columnType => {
    switch (columnType) {
      case ColumnType.columnName:
        return true;
      case ColumnType.columnDataType:
        return bHas(show, Show.columnDataType);
      case ColumnType.columnDefault:
        return bHas(show, Show.columnDefault);
      case ColumnType.columnComment:
        return bHas(show, Show.columnComment);
      case ColumnType.columnAutoIncrement:
        return bHas(show, Show.columnAutoIncrement);
      case ColumnType.columnUnique:
        return bHas(show, Show.columnUnique);
      case ColumnType.columnNotNull:
        return bHas(show, Show.columnNotNull);
      default:
        return false;
    }
  });
}
