import { query } from '@dineug/erd-editor-schema';

import { ColumnOption } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import { formatLineComment, getJvmType, JvmType } from './java';
import { FormatColumnOptions, FormatTableOptions, getNameCase } from './utils';

const INDENT = '  ';

// Scala 2.13 refuses these bidirectional controls even in a comment, so a
// comment writes each as the text of its Unicode escape.
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

// BigDecimal names scala.math.BigDecimal, which Scala needs no import for.
// Duration keeps its package: a bare one would resolve to, or clash with, the
// scala.concurrent.duration.Duration a Scala file often imports.
const scalaTypes: Readonly<Record<JvmType, string>> = {
  BigDecimal: 'BigDecimal',
  Boolean: 'Boolean',
  Byte: 'Byte',
  bytes: 'Array[Byte]',
  Double: 'Double',
  Duration: 'java.time.Duration',
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

/**
 * The reserved words of Scala 2.13 and Scala 3, which a name takes only in
 * backticks; using opens a context parameter clause as a first parameter.
 */
const SCALA_KEYWORDS: ReadonlySet<string> = new Set([
  'abstract',
  'case',
  'catch',
  'class',
  'def',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'final',
  'finally',
  'for',
  'forSome',
  'given',
  'if',
  'implicit',
  'import',
  'lazy',
  'macro',
  'match',
  'new',
  'null',
  'object',
  'override',
  'package',
  'private',
  'protected',
  'return',
  'sealed',
  'super',
  'then',
  'this',
  'throw',
  'trait',
  'true',
  'try',
  'type',
  'using',
  'val',
  'var',
  'while',
  'with',
  'yield',
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
  const tableName = toScalaName(getNameCase(table.name, tableNameCase));

  formatLineComment(buffer, '', table.comment, escapeBidiControls);
  buffer.push(`case class ${tableName}(`);

  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach((column, index, array) => {
      formatColumn(state, { buffer, column }, index < array.length - 1);
    });

  buffer.push(`)`);
}

function formatColumn(
  { settings: { columnNameCase, database } }: RootState,
  { buffer, column }: FormatColumnOptions,
  isComma: boolean
) {
  const columnName = toScalaFieldName(getNameCase(column.name, columnNameCase));
  const { type, arrayDepth } = getJvmType(column.dataType, database);
  let scalaType = scalaTypes[type];

  for (let depth = 0; depth < arrayDepth; depth++) {
    scalaType = `List[${scalaType}]`;
  }

  // A primary key takes no NULL, its flag set or not.
  const isNullable =
    !bHas(column.options, ColumnOption.primaryKey) &&
    !bHas(column.options, ColumnOption.notNull);

  formatLineComment(buffer, INDENT, column.comment, escapeBidiControls);
  buffer.push(
    `${INDENT}${columnName}: ${isNullable ? `Option[${scalaType}]` : scalaType}${isComma ? ',' : ''}`
  );
}

export function toScalaName(name: string): string {
  return SCALA_KEYWORDS.has(name) ? `\`${name}\`` : name;
}

/**
 * A field name, in backticks also when it ends in an underscore, which the
 * lexer would otherwise read together with the colon after it as one name.
 */
function toScalaFieldName(name: string): string {
  return name.endsWith('_') ? `\`${name}\`` : toScalaName(name);
}

function escapeBidiControls(line: string): string {
  return line.replace(
    BIDI_CONTROLS,
    char => `\\u${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
