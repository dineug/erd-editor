import { ColumnType, Show } from '@/constants/schema';
import { ValuesType } from '@/internal-types';
import { bHas } from '@/utils/bit';

export const ColType = {
  columnName: 'columnName',
  columnDataType: 'columnDataType',
  columnNotNull: 'columnNotNull',
  columnUnique: 'columnUnique',
  columnAutoIncrement: 'columnAutoIncrement',
  columnDefault: 'columnDefault',
  columnComment: 'columnComment',
} as const;
export type ColType = ValuesType<typeof ColType>;

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
