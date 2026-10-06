import { ColumnType } from '@/constants/schema';
import type { PlainMessageKey } from '@/i18n/translate';

/**
 * The name the column order list gives each column type, as the key of its
 * message: kept beside the list, out of the schema constants the peer entry
 * reaches, so no editor text travels with the peer.
 */
export const ColumnTypeToMessageKey: Readonly<Record<number, PlainMessageKey>> =
  {
    [ColumnType.columnName]: 'common.column.name',
    [ColumnType.columnDataType]: 'common.column.dataType',
    [ColumnType.columnDefault]: 'common.column.default',
    [ColumnType.columnComment]: 'common.column.comment',
    [ColumnType.columnAutoIncrement]: 'common.column.autoIncrement',
    [ColumnType.columnUnique]: 'common.column.unique',
    [ColumnType.columnNotNull]: 'common.column.notNull',
  };
