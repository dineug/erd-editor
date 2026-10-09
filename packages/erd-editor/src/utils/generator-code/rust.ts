import { query } from '@dineug/erd-editor-schema';

import { ColumnOption } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import { getRustColumnType } from './rustTypes';
import { FormatColumnOptions, FormatTableOptions, getNameCase } from './utils';

export const INDENT = '    ';

/** Every keyword of edition 2015 to 2024 a raw identifier takes. */
export const RUST_KEYWORDS: ReadonlySet<string> = new Set([
  'abstract',
  'as',
  'async',
  'await',
  'become',
  'box',
  'break',
  'const',
  'continue',
  'do',
  'dyn',
  'else',
  'enum',
  'extern',
  'false',
  'final',
  'fn',
  'for',
  'gen',
  'if',
  'impl',
  'in',
  'let',
  'loop',
  'macro',
  'match',
  'mod',
  'move',
  'mut',
  'override',
  'priv',
  'pub',
  'ref',
  'return',
  'static',
  'struct',
  'trait',
  'true',
  'try',
  'type',
  'typeof',
  'unsafe',
  'unsized',
  'use',
  'virtual',
  'where',
  'while',
  'yield',
]);

// The names rustc refuses as raw identifiers.
const NON_RAW_NAMES = new Set(['_', 'crate', 'self', 'Self', 'super']);

/**
 * The names a field type in the output opens with: a struct of one of these
 * names breaks every field of that type in its module, or shadows it silently.
 */
const TYPE_NAMES = new Set([
  'Option',
  'String',
  'Vec',
  'bool',
  'chrono',
  'f32',
  'f64',
  'i16',
  'i32',
  'i64',
  'i8',
  'rust_decimal',
  'serde_json',
  'u16',
  'u32',
  'u64',
  'u8',
  'uuid',
]);

const LINE_BREAK = /\r\n|\r|\n/;
// rustc refuses these in any comment unless a crate allows its lint for them.
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

export function createCode(state: RootState): string {
  const {
    doc: { tableIds },
    collections,
  } = state;
  const buffer: string[] = [''];

  query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC)
    .forEach(table => {
      formatTable(state, { buffer, table });
      buffer.push('');
    });

  return buffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table }: FormatTableOptions
) {
  const {
    settings: { tableNameCase },
    collections,
  } = state;
  const structName = toStructName(getNameCase(table.name, tableNameCase));
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  formatComment(buffer, '', table.comment);
  buffer.push('#[derive(Debug, Clone, PartialEq)]');

  if (columns.length === 0) {
    buffer.push(`pub struct ${structName} {}`);
    return;
  }

  buffer.push(`pub struct ${structName} {`);
  columns.forEach(column => {
    formatColumn(state, { buffer, column });
  });
  buffer.push('}');
}

function formatColumn(
  { settings: { columnNameCase, database } }: RootState,
  { buffer, column }: FormatColumnOptions
) {
  const name = toRustIdentifier(getNameCase(column.name, columnNameCase));
  const { rust } = getRustColumnType(column.dataType, database);
  // A primary key takes no NULL, its flag set or not, as typeorm.ts reads it.
  const isNullable =
    !bHas(column.options, ColumnOption.primaryKey) &&
    !bHas(column.options, ColumnOption.notNull);

  formatComment(buffer, INDENT, column.comment);
  buffer.push(
    `${INDENT}pub ${name}: ${isNullable ? `Option<${rust}>` : rust},`
  );
}

/** A keyword as a raw identifier, or with an underscore after it where rustc takes none. */
export function toRustIdentifier(name: string): string {
  if (NON_RAW_NAMES.has(name)) {
    return `${name}_`;
  }
  return RUST_KEYWORDS.has(name) ? `r#${name}` : name;
}

export function toStructName(name: string): string {
  return TYPE_NAMES.has(name) ? `${name}_` : toRustIdentifier(name);
}

/** A comment as line comments, its bidirectional controls written as escapes. */
export function formatComment(
  buffer: string[],
  indent: string,
  comment: string
) {
  const lines = comment
    .replace(BIDI_CONTROLS, escapeCodePoint)
    .split(LINE_BREAK)
    .map(line => line.trimEnd());

  while (lines[0] === '') {
    lines.shift();
  }
  while (lines[lines.length - 1] === '') {
    lines.pop();
  }

  lines.forEach(line =>
    buffer.push(line === '' ? `${indent}//` : `${indent}// ${line}`)
  );
}

function escapeCodePoint(character: string): string {
  return `\\u{${character.charCodeAt(0).toString(16).toUpperCase()}}`;
}
