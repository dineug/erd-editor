import { PrimitiveTypeMap } from '@/core/sql/dataType';
import { orderByNameASC } from '@/engine/store/helper/table.helper';
import { Store } from '@@types/engine/store';
import { Database, NameCase } from '@@types/engine/store/canvas.state';
import { Column, Table } from '@@types/engine/store/table.state';

import { getNameCase, getPrimitiveType } from './helper';

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

export function createCode(store: Store): string {
  const stringBuffer: string[] = [''];
  const { database, tableCase, columnCase } = store.canvasState;
  const tables = orderByNameASC(store.tableState.tables);

  tables.forEach(table => {
    formatTable(table, stringBuffer, database, tableCase, columnCase);
    stringBuffer.push('');
  });

  return stringBuffer.join('\n');
}

export function formatTable(
  table: Table,
  buffer: string[],
  database: Database,
  tableCase: NameCase,
  columnCase: NameCase
) {
  const tableName = getNameCase(table.name, tableCase);
  if (table.comment.trim() !== '') {
    buffer.push(`// ${table.comment}`);
  }
  buffer.push(`public class ${tableName} {`);
  table.columns.forEach(column => {
    formatColumn(column, buffer, database, columnCase);
  });
  buffer.push(`}`);
}

function formatColumn(
  column: Column,
  buffer: string[],
  database: Database,
  columnCase: NameCase
) {
  const columnName = getNameCase(column.name, columnCase);
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
