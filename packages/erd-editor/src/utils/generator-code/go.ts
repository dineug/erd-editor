import { query } from '@dineug/erd-editor-schema';
import { upperFirst } from 'es-toolkit';

import { ColumnOption, Database, NameCase } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import {
  ColumnScalar,
  ColumnType,
  getColumnType,
  isMySQLFamily,
} from './columnTypes';
import { FormatTableOptions, getNameCase, splitLines } from './utils';

const SCALAR_TYPES: Readonly<Record<ColumnScalar, string>> = {
  bool: 'bool',
  i8: 'int8',
  i16: 'int16',
  i32: 'int32',
  i64: 'int64',
  u8: 'uint8',
  u16: 'uint16',
  u32: 'uint32',
  u64: 'uint64',
  f32: 'float32',
  f64: 'float64',
  decimal: 'decimal.Decimal',
  string: 'string',
  bytes: '[]byte',
  uuid: 'string',
  json: 'json.RawMessage',
  date: 'time.Time',
  time: 'time.Time',
  timeTz: 'string',
  dateTime: 'time.Time',
  dateTimeUtc: 'time.Time',
  dateTimeOffset: 'time.Time',
  interval: 'string',
};

// Their usual database/sql drivers hand a time of day over as text, which
// time.Time cannot scan: go-sql-driver/mysql, pgx's stdlib, mattn/go-sqlite3.
const TEXT_TIME_DATABASES = new Set<number>([
  Database.MariaDB,
  Database.MySQL,
  Database.PostgreSQL,
  Database.SQLite,
]);

// The others hand a JSON column over as a string json.RawMessage cannot scan.
const RAW_JSON_DATABASES = new Set<number>([
  Database.MariaDB,
  Database.MySQL,
  Database.Oracle,
  Database.PostgreSQL,
]);

const UPPER_CASE_START = /^\p{Lu}/u;
const MARK = /\p{M}/u;
const MARKS = /\p{M}/gu;

// Go's Unicode spaces, which gofmt trims and +build reads: the regex space
// class and U+0085; the class also takes U+FEFF, which a comment drops first.
const GO_SPACE = /[\s\x85]/;

// gofmt moves a line comment that reads as a +build constraint above the
// package clause, where it can drop the file from the build; a block comment
// is never read as one.
const PLUS_BUILD = /^[\s\x85]*\+build(?:[\s\x85]|$)/;

const TAG_ESCAPE = /["\\\uFEFF]|(?!\t)\p{Cc}/gu;
const TAG_ESCAPES: Readonly<Record<string, string>> = {
  '"': '\\"',
  '\\': '\\\\',
  '\n': '\\n',
  '\r': '\\r',
};

type Field = {
  name: string;
  type: string;
  tag: string;
  comment: string;
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
  const structName = exportedName(table.name, tableNameCase);

  formatComment(buffer, '', commentText(table.comment));
  buffer.push(`type ${structName} struct {`);

  const fields = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .map(column => createField(state, column));

  alignmentRunsOf(fields).forEach(run => {
    const nameWidth = Math.max(...run.map(field => runeCount(field.name)));
    const typeWidth = Math.max(...run.map(field => field.type.length));

    run.forEach(field => {
      const padding = ' '.repeat(nameWidth - runeCount(field.name));

      formatComment(buffer, '\t', field.comment);
      buffer.push(
        `\t${field.name}${padding} ${field.type.padEnd(typeWidth)} ${field.tag}`
      );
    });
  });

  buffer.push(`}`);
}

// gofmt's tabwriter ends a column block at the first line that is not a field,
// and a comment on its own line is one.
function alignmentRunsOf(fields: Field[]): Field[][] {
  const runs: Field[][] = [];

  fields.forEach(field => {
    if (field.comment !== '' || runs.length === 0) {
      runs.push([]);
    }
    runs[runs.length - 1].push(field);
  });

  return runs;
}

function createField(
  { settings: { columnNameCase, database } }: RootState,
  column: Column
): Field {
  const columnType = getColumnType(column.dataType, database);
  const type = elementType(columnType, database);
  const isNullable =
    !bHas(column.options, ColumnOption.notNull) &&
    !bHas(column.options, ColumnOption.primaryKey);

  return {
    name: exportedName(column.name, columnNameCase),
    type: fieldType(type, columnType.arrayDepth, isNullable),
    tag: structTag(column.name),
    comment: commentText(column.comment),
  };
}

/** The Go type the database's usual driver scans one value of the element into. */
function elementType(
  { scalar, base, isGuid, isMoney }: ColumnType,
  database: number
): string {
  // MySQL hands every BIT over as bytes, b'1' too, which no integer scans.
  if (isMySQLFamily(database) && base === 'bit') {
    return '[]byte';
  }
  // go-ora hands a BFILE over as a locator that neither string nor bytes take.
  if (base === 'bfile') {
    return 'string';
  }
  if (scalar === 'time' && TEXT_TIME_DATABASES.has(database)) {
    return 'string';
  }
  // PostgreSQL prints money in the session's currency, such as $1,234.56.
  if (isMoney && database === Database.PostgreSQL) {
    return 'string';
  }
  if (scalar === 'json' && !RAW_JSON_DATABASES.has(database)) {
    return 'string';
  }
  // A uniqueidentifier is stored mixed-endian, which only this type reads back.
  if (isGuid && database === Database.MSSQL) {
    return 'mssql.UniqueIdentifier';
  }
  return SCALAR_TYPES[scalar];
}

// A slice scans NULL as nil, so a byte string or an array needs no pointer.
function fieldType(type: string, arrayDepth: number, isNullable: boolean) {
  if (arrayDepth > 0) {
    return `${'[]'.repeat(arrayDepth)}${type}`;
  }
  return isNullable && !type.startsWith('[]') ? `*${type}` : type;
}

// Go refuses a NUL anywhere in a file and a byte order mark anywhere but at
// its start, so a comment drops both before it is trimmed.
function commentText(comment: string): string {
  return trimEndSpace(
    trimStartSpace(comment.replaceAll('\u0000', '').replaceAll('\uFEFF', ''))
  );
}

// A loop, not a regex anchored at the end, which backtracks over a long run
// of spaces inside a comment: 50 000 of them take seconds.
function trimEndSpace(text: string): string {
  let end = text.length;
  while (end > 0 && GO_SPACE.test(text[end - 1])) {
    end -= 1;
  }
  return text.slice(0, end);
}

function trimStartSpace(text: string): string {
  let start = 0;
  while (start < text.length && GO_SPACE.test(text[start])) {
    start += 1;
  }
  return text.slice(start);
}

/**
 * Comment lines, their trailing blanks gone and a run of empty lines one bare
 * slash pair, as gofmt folds a run in a doc comment.
 */
function formatComment(buffer: string[], indent: string, comment: string) {
  if (comment === '') {
    return;
  }

  const lines = splitLines(comment).map(trimEndSpace);

  lines.forEach((text, index) => {
    if (text === '' && lines[index - 1] === '') {
      return;
    }
    buffer.push(`${indent}${commentLine(text)}`);
  });
}

// gofmt's tabwriter reads a form feed in a block comment as the end of the
// line, which pulls the next field onto the comment's line.
function commentLine(text: string): string {
  if (text === '') {
    return '//';
  }
  return PLUS_BUILD.test(text) && !text.includes('*/')
    ? `/* ${text.replaceAll('\f', ' ')} */`
    : `// ${text}`;
}

// reflect.StructTag unquotes the value, and the raw-string form cannot carry a
// backtick -- a column named with one falls back to the interpreted form.
// encoding/json leaves out a field tagged just -, and reads -, as the name -.
function structTag(columnName: string): string {
  const name = columnName === '-' ? '-,' : escaped(columnName);
  const tag = `json:"${name}"`;

  return tag.includes('`') ? `"${escaped(tag)}"` : `\`${tag}\``;
}

/**
 * The value as an interpreted Go string holds it, every control character but
 * a tab and U+FEFF escaped too: Go drops a raw carriage return, refuses a raw
 * line feed, NUL or U+FEFF, and gofmt ends an alignment block at a form feed.
 */
function escaped(value: string): string {
  return value.replace(
    TAG_ESCAPE,
    char =>
      TAG_ESCAPES[char] ??
      `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

/**
 * Go exports a name whose first rune is upper case; any other gets an X first.
 * Composed first, as casing splits a word at a lone mark and drops it; a mark
 * casing makes is recomposed or dropped, but NameCase none keeps a name's own.
 */
function exportedName(name: string, nameCase: number): string {
  const composed = name.normalize('NFC');
  const cased = upperFirst(getNameCase(composed, nameCase)).normalize('NFC');
  const keepsMarks = nameCase === NameCase.none && MARK.test(composed);
  const letters = keepsMarks ? cased : cased.replace(MARKS, '');

  return UPPER_CASE_START.test(letters) ? letters : `X${letters}`;
}

// gofmt aligns the columns by runes, where a UTF-16 length counts some twice.
function runeCount(value: string): number {
  return [...value].length;
}
