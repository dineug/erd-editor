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
  buffer.push(`@Data`);
  buffer.push(`case class ${tableName}(`);

  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach((column, index, array) => {
      let isComma = true;
      if (index === array.length - 1) {
        isComma = false;
      }
      formatColumn(state, { buffer, column }, isComma);
    });

  buffer.push(`)`);
}

function formatColumn(
  { settings: { columnNameCase, database } }: RootState,
  { buffer, column }: FormatColumnOptions,
  isComma: boolean
) {
  const columnName = getNameCase(column.name, columnNameCase);
  const primitiveType = getPrimitiveType(column.dataType, database);

  if (column.comment.trim() !== '') {
    buffer.push(` // ${column.comment}`);
  }

  buffer.push(
    ` ${columnName}: ${convertTypeMap[primitiveType]}${isComma ? ',' : ''}`
  );
}
