import { query } from '@dineug/erd-editor-schema';

import { PrimitiveTypeMap } from '@/constants/sql/dataType';
import { RootState } from '@/engine/state';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import {
  FormatColumnOptions,
  FormatTableOptions,
  getNameCase,
  getPrimitiveType,
} from './utils';

const convertTypeMap: PrimitiveTypeMap = {
  int: 'int',
  long: 'long',
  float: 'float',
  double: 'double',
  decimal: 'decimal',
  boolean: 'bool',
  string: 'string',
  lob: 'string',
  date: 'DateTime',
  dateTime: 'DateTime',
  time: 'TimeSpan',
};

export function createCode(state: RootState): string {
  const {
    doc: { tableIds },
    collections,
  } = state;
  const stringBuffer: string[] = [''];
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC);

  tables.forEach(table => {
    formatTable(state, {
      buffer: stringBuffer,
      table,
    });
    stringBuffer.push('');
  });

  return stringBuffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table }: FormatTableOptions
) {
  const {
    settings: { tableNameCase },
    collections,
  } = state;
  const tableName = getNameCase(table.name, tableNameCase);

  if (table.comment.trim() !== '') {
    buffer.push(`// ${table.comment}`);
  }
  buffer.push(`public class ${tableName} {`);

  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach(column => {
      formatColumn(state, { buffer, column });
    });

  buffer.push(`}`);
}

function formatColumn(
  { settings: { columnNameCase, database } }: RootState,
  { buffer, column }: FormatColumnOptions
) {
  const columnName = getNameCase(column.name, columnNameCase);
  const primitiveType = getPrimitiveType(column.dataType, database);

  if (column.comment.trim() !== '') {
    buffer.push(`  // ${column.comment}`);
  }
  buffer.push(
    `  public ${convertTypeMap[primitiveType]} ${
      columnName.charAt(0).toLocaleUpperCase() + columnName.slice(1)
    } { get; set; }`
  );
}
