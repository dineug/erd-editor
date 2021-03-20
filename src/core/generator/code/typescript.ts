import { Store } from '@@types/engine/store';
import { Table, Column } from '@@types/engine/store/table.state';
import { Database, NameCase } from '@@types/engine/store/canvas.state';
import { getPrimitiveType, getNameCase } from './helper';
import { orderByNameASC } from '@/engine/store/helper/table.helper';
import { PrimitiveTypeMap } from '@/core/sql/dataType';

const convertTypeMap: PrimitiveTypeMap = {
  int: 'number',
  long: 'number',
  float: 'number',
  double: 'number',
  decimal: 'number',
  boolean: 'boolean',
  string: 'string',
  lob: 'string',
  date: 'string',
  dateTime: 'string',
  time: 'string',
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
  buffer.push(`export interface ${tableName} {`);
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
    `  ${columnName}: ${convertTypeMap[primitiveType]}${
      column.option.notNull ? '' : ' | null'
    };`
  );
}
