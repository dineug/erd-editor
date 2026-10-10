import { query } from '@dineug/erd-editor-schema';

import { ColumnOption } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import { formatLineComment, getJvmType, JvmType } from './java';
import { FormatColumnOptions, FormatTableOptions, getNameCase } from './utils';

// Four spaces and a comma after every parameter, as Kotlin's coding
// conventions lay out a class header that spans several lines.
const INDENT = '    ';

// Kotlin reserves _, __, ___ and every other name of underscores alone.
const UNDERSCORES = /^_+$/;

const kotlinTypes: Readonly<Record<JvmType, string>> = {
  BigDecimal: 'BigDecimal',
  Boolean: 'Boolean',
  Byte: 'Byte',
  bytes: 'ByteArray',
  Double: 'Double',
  Duration: 'Duration',
  Float: 'Float',
  Integer: 'Int',
  LocalDate: 'LocalDate',
  LocalDateTime: 'LocalDateTime',
  LocalTime: 'LocalTime',
  Long: 'Long',
  OffsetDateTime: 'OffsetDateTime',
  OffsetTime: 'OffsetTime',
  Short: 'Short',
  String: 'String',
  UUID: 'UUID',
};

/** Kotlin's hard keywords, which a name takes only in backticks. */
const KOTLIN_KEYWORDS: ReadonlySet<string> = new Set([
  'as',
  'break',
  'class',
  'continue',
  'do',
  'else',
  'false',
  'for',
  'fun',
  'if',
  'in',
  'interface',
  'is',
  'null',
  'object',
  'package',
  'return',
  'super',
  'this',
  'throw',
  'true',
  'try',
  'typealias',
  'typeof',
  'val',
  'var',
  'when',
  'while',
]);

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
  const tableName = toKotlinName(getNameCase(table.name, tableNameCase));
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  formatLineComment(buffer, '', table.comment);

  // A data class needs a property, so a table without columns is a class.
  if (columns.length === 0) {
    buffer.push(`class ${tableName}`);
    return;
  }

  buffer.push(`data class ${tableName}(`);
  columns.forEach(column => {
    formatColumn(state, { buffer, column });
  });
  buffer.push(`)`);
}

function formatColumn(
  { settings: { columnNameCase, database } }: RootState,
  { buffer, column }: FormatColumnOptions
) {
  const columnName = toKotlinName(getNameCase(column.name, columnNameCase));
  const { type, arrayDepth } = getJvmType(column.dataType, database);
  let kotlinType = kotlinTypes[type];

  for (let depth = 0; depth < arrayDepth; depth++) {
    kotlinType = `List<${kotlinType}>`;
  }

  // A primary key takes no NULL, its flag set or not.
  const isNotNull =
    bHas(column.options, ColumnOption.primaryKey) ||
    bHas(column.options, ColumnOption.notNull);

  formatLineComment(buffer, INDENT, column.comment);
  buffer.push(
    isNotNull
      ? `${INDENT}val ${columnName}: ${kotlinType},`
      : `${INDENT}val ${columnName}: ${kotlinType}? = null,`
  );
}

export function toKotlinName(name: string): string {
  return KOTLIN_KEYWORDS.has(name) || UNDERSCORES.test(name)
    ? `\`${name}\``
    : name;
}
