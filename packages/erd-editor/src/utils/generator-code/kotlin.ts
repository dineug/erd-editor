import { query } from '@dineug/erd-editor-schema';

import { ColumnOption } from '@/constants/schema';
import { PrimitiveType, PrimitiveTypeMap } from '@/constants/sql/dataType';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import {
  FormatColumnOptions,
  FormatTableOptions,
  getNameCase,
  getPrimitiveType,
} from './utils';

const convertTypeMap: PrimitiveTypeMap = {
  int: 'Int',
  long: 'Long',
  float: 'Float',
  double: 'Double',
  decimal: 'BigDecimal',
  boolean: 'Boolean',
  string: 'String',
  lob: 'String',
  date: 'LocalDate',
  dateTime: 'LocalDateTime',
  time: 'LocalTime',
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
  buffer.push(`class ${tableName} {`);

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
  if (
    bHas(column.options, ColumnOption.notNull) &&
    primitiveType !== 'date' &&
    primitiveType !== 'dateTime' &&
    primitiveType !== 'time'
  ) {
    buffer.push(
      `  var ${columnName}: ${convertTypeMap[primitiveType]} = ${getDefault(
        primitiveType
      )}`
    );
  } else {
    buffer.push(
      `  var ${columnName}: ${convertTypeMap[primitiveType]}? = null`
    );
  }
}

function getDefault(primitiveType: PrimitiveType) {
  switch (primitiveType) {
    case 'int':
    case 'long':
      return 0;
    case 'float':
      return '0.0f';
    case 'double':
      return '0.0';
    case 'boolean':
      return false;
    case 'string':
    case 'lob':
      return '""';
    case 'decimal':
      return 'BigDecimal.ZERO';
    case 'date':
    case 'dateTime':
    case 'time':
      return null;
  }
}
