import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import { ColumnScalar, ColumnType, getColumnType } from './columnTypes';
import {
  FormatColumnOptions,
  FormatTableOptions,
  getNameCase,
  splitLines,
} from './utils';

/**
 * A column element's type on the JVM, named as Java writes it but for bytes,
 * which Java, Kotlin and Scala each spell their own way.
 */
export type JvmType =
  | 'BigDecimal'
  | 'Boolean'
  | 'Byte'
  | 'bytes'
  | 'Double'
  | 'Duration'
  | 'Float'
  | 'Integer'
  | 'LocalDate'
  | 'LocalDateTime'
  | 'LocalTime'
  | 'Long'
  | 'OffsetDateTime'
  | 'OffsetTime'
  | 'Short'
  | 'String'
  | 'UUID';

export type JvmColumnType = {
  type: JvmType;
  /** PostgreSQL array dimensions, each one array or list level around the type. */
  arrayDepth: number;
};

const INDENT = '  ';

const BACKSLASH_RUN_BEFORE_U = /\\+(?=u)/g;

// An unsigned integer takes the next wider signed type, but BIGINT UNSIGNED
// and SERIAL stay a Long, which holds every key below 2^63, as the owner chose.
const jvmTypes: Readonly<Record<ColumnScalar, JvmType>> = {
  bool: 'Boolean',
  i8: 'Byte',
  i16: 'Short',
  i32: 'Integer',
  i64: 'Long',
  u8: 'Short',
  u16: 'Integer',
  u32: 'Long',
  u64: 'Long',
  f32: 'Float',
  f64: 'Double',
  decimal: 'BigDecimal',
  string: 'String',
  bytes: 'bytes',
  uuid: 'UUID',
  json: 'String',
  date: 'LocalDate',
  time: 'LocalTime',
  timeTz: 'OffsetTime',
  dateTime: 'LocalDateTime',
  dateTimeUtc: 'LocalDateTime',
  dateTimeOffset: 'OffsetDateTime',
  interval: 'Duration',
};

const javaTypes: Readonly<Record<JvmType, string>> = {
  BigDecimal: 'BigDecimal',
  Boolean: 'Boolean',
  Byte: 'Byte',
  bytes: 'byte[]',
  Double: 'Double',
  Duration: 'Duration',
  Float: 'Float',
  Integer: 'Integer',
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

/** The keywords and literals javac refuses as a field name. */
const JAVA_RESERVED_WORDS: ReadonlySet<string> = new Set([
  '_',
  'abstract',
  'assert',
  'boolean',
  'break',
  'byte',
  'case',
  'catch',
  'char',
  'class',
  'const',
  'continue',
  'default',
  'do',
  'double',
  'else',
  'enum',
  'extends',
  'false',
  'final',
  'finally',
  'float',
  'for',
  'goto',
  'if',
  'implements',
  'import',
  'instanceof',
  'int',
  'interface',
  'long',
  'native',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'short',
  'static',
  'strictfp',
  'super',
  'switch',
  'synchronized',
  'this',
  'throw',
  'throws',
  'transient',
  'true',
  'try',
  'void',
  'volatile',
  'while',
]);

// javac takes these as a field name but not as a class name.
const JAVA_RESTRICTED_TYPE_NAMES = new Set([
  'permits',
  'record',
  'sealed',
  'var',
  'yield',
]);

// Names javac takes as a field but which break the class Lombok completes:
// Class, whose getter would be the final getClass, and java, which hides the
// package of the java.util.Arrays calls Lombok writes for an array field.
const LOMBOK_FIELD_CLASHES = new Set(['Class', 'java']);

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
  const tableName = toJavaClassName(getNameCase(table.name, tableNameCase));

  formatLineComment(buffer, '', table.comment, escapeUnicodeEscapes);
  buffer.push(`@Data`);
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
  const columnName = toJavaFieldName(getNameCase(column.name, columnNameCase));
  const { type, arrayDepth } = getJvmType(column.dataType, database);

  formatLineComment(buffer, INDENT, column.comment, escapeUnicodeEscapes);
  buffer.push(
    `${INDENT}private ${javaTypes[type]}${'[]'.repeat(arrayDepth)} ${columnName};`
  );
}

/** The JVM type of a column on a database, from the shared column classifier. */
export function getJvmType(dataType: string, database: number): JvmColumnType {
  const columnType = getColumnType(dataType, database);

  return {
    type: elementType(columnType),
    arrayDepth: columnType.arrayDepth,
  };
}

function elementType({ scalar, bits, interval }: ColumnType): JvmType {
  // MEDIUMINT UNSIGNED stops at 16777215, which an Integer holds.
  if (scalar === 'u32' && bits === 24) {
    return 'Integer';
  }
  // A Duration holds no months, so a year-month interval stays text.
  if (scalar === 'interval' && interval === 'yearMonth') {
    return 'String';
  }
  return jvmTypes[scalar];
}

/** A reserved word with an underscore after it, since Java cannot escape one. */
function escapeReservedWord(name: string): string {
  return JAVA_RESERVED_WORDS.has(name) ? `${name}_` : name;
}

/**
 * A field name, with an underscore after a reserved word and after a name
 * that breaks the class Lombok completes.
 */
export function toJavaFieldName(name: string): string {
  return LOMBOK_FIELD_CLASHES.has(name) ? `${name}_` : escapeReservedWord(name);
}

export function toJavaClassName(name: string): string {
  return JAVA_RESTRICTED_TYPE_NAMES.has(name)
    ? `${name}_`
    : escapeReservedWord(name);
}

/**
 * javac reads a backslash and u as a Unicode escape even in a comment, where
 * a bad one fails the compile; an even run of backslashes starts none.
 */
export function escapeUnicodeEscapes(value: string): string {
  return value.replace(BACKSLASH_RUN_BEFORE_U, run =>
    run.length % 2 === 0 ? run : `${run}\\`
  );
}

/**
 * A comment as line comments, one for each of its lines, its blank first and
 * last lines dropped; nothing for a comment that is only whitespace.
 */
export function formatLineComment(
  buffer: string[],
  indent: string,
  comment: string,
  escape: (line: string) => string = line => line
) {
  const lines = splitLines(comment);

  while (lines.length && lines[0].trim() === '') {
    lines.shift();
  }
  while (lines.length && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  lines.forEach(line =>
    buffer.push(
      line.trim() === '' ? `${indent}//` : `${indent}// ${escape(line)}`
    )
  );
}
