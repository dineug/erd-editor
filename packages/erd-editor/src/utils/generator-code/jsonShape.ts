import { ColumnOption, Database } from '@/constants/schema';
import { Column } from '@/internal-types';
import { bHas } from '@/utils/bit';

import {
  ColumnScalar,
  ColumnType,
  getColumnType,
  isMySQLFamily,
} from './columnTypes';

/**
 * What one value of a column looks like in JSON, as an API sends a row: dates
 * and times as ISO text, a decimal as a string, binary as base64.
 */
export type JsonShapeKind =
  | 'boolean'
  | 'integer'
  | 'number'
  | 'string'
  | 'uuid'
  | 'guid'
  | 'date'
  | 'time'
  | 'naiveDateTime'
  | 'offsetDateTime'
  | 'base64'
  | 'json'
  | 'enum'
  | 'ipv4'
  | 'ipv6'
  | 'null';

export type JsonShape = {
  kind: JsonShapeKind;
  /** An integer's least value; null where the column sets none. */
  minimum: number | null;
  /**
   * An integer's greatest value; null for a 64-bit one, whose range no JSON
   * number holds exactly, so each language writes its own safe bound or none.
   */
  maximum: number | null;
  /** A character type's declared length, which a shorter value meets too. */
  maxLength: number | null;
  /** An ENUM's members as a row holds them, each once, in the type's order. */
  members: string[];
  /** A PostgreSQL array's dimensions, each one a JSON array around the last. */
  arrayDepth: number;
};

const KINDS: Readonly<Record<ColumnScalar, JsonShapeKind>> = {
  bool: 'boolean',
  i8: 'integer',
  i16: 'integer',
  i32: 'integer',
  i64: 'integer',
  u8: 'integer',
  u16: 'integer',
  u32: 'integer',
  u64: 'integer',
  f32: 'number',
  f64: 'number',
  decimal: 'string',
  string: 'string',
  bytes: 'base64',
  uuid: 'uuid',
  json: 'json',
  date: 'date',
  time: 'time',
  timeTz: 'string',
  dateTime: 'naiveDateTime',
  dateTimeUtc: 'offsetDateTime',
  dateTimeOffset: 'offsetDateTime',
  interval: 'string',
};

const UNSIGNED_SCALARS: ReadonlySet<ColumnScalar> = new Set([
  'u8',
  'u16',
  'u32',
]);

/**
 * Every name an ES module refuses for an interface or a type alias: the
 * reserved words, the strict mode ones and the predefined type names.
 */
const RESERVED_TYPE_NAMES: ReadonlySet<string> = new Set([
  'any',
  'await',
  'bigint',
  'boolean',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'never',
  'new',
  'null',
  'number',
  'object',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'string',
  'super',
  'switch',
  'symbol',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'undefined',
  'unknown',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

const IDENTIFIER_NAME = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u;

/**
 * The runs of code points TypeScript, which reads identifiers by Unicode 15.1,
 * refuses around each identifier character Unicode 16.0 and 17.0 added, so a
 * key a newer browser reads as an identifier is still quoted.
 */
const NEWER_IDENTIFIER_RUNS: ReadonlyArray<
  readonly [first: number, last: number]
> = [
  [0x088f, 0x0897],
  [0x0c5b, 0x0c5c],
  [0x0cd7, 0x0cdc],
  [0x1acf, 0x1aff],
  [0x1c89, 0x1c8f],
  [0xa7cb, 0xa7cf],
  [0xa7d2, 0xa7d2],
  [0xa7d4, 0xa7d4],
  [0xa7da, 0xa7f1],
  [0x105bd, 0x105ff],
  [0x1093a, 0x1097f],
  [0x10d3a, 0x10e7f],
  [0x10eb2, 0x10efc],
  [0x11375, 0x113ff],
  [0x116ca, 0x116ff],
  [0x11af9, 0x11bff],
  [0x11daa, 0x11edf],
  [0x11f5a, 0x11faf],
  [0x13456, 0x143ff],
  [0x14647, 0x167ff],
  [0x16b90, 0x16e3f],
  [0x16e80, 0x16eff],
  [0x16ff2, 0x16fff],
  [0x187f8, 0x187ff],
  [0x18cd6, 0x18cff],
  [0x18d09, 0x1afef],
  [0x1bc9f, 0x1ceff],
  [0x1e4fa, 0x1e7df],
  [0x2b73a, 0x2b73f],
  [0x2cea2, 0x2ceaf],
  [0x323b0, 0xe00ff],
];

const NEWER_IDENTIFIER_CHARACTER = new RegExp(
  `[${NEWER_IDENTIFIER_RUNS.map(
    ([first, last]) => `\\u{${first.toString(16)}}-\\u{${last.toString(16)}}`
  ).join('')}]`,
  'u'
);

/**
 * A column's value in the JSON shape, the one reading the Zod, JSON Schema
 * and TypeScript generators share, so their types agree column by column.
 */
export function getJsonShape(dataType: string, database: number): JsonShape {
  const columnType = getColumnType(dataType, database);
  const kind = shapeKind(columnType, database);
  const [minimum, maximum] =
    kind === 'integer' ? integerRange(columnType) : [null, null];

  return {
    kind,
    minimum,
    maximum,
    maxLength: kind === 'string' ? columnType.length : null,
    members: listMembers(columnType, database),
    arrayDepth: columnType.arrayDepth,
  };
}

/** A primary key takes no NULL, its NN flag set or not, as in every generator. */
export function isNullableColumn(column: Column): boolean {
  return (
    !bHas(column.options, ColumnOption.primaryKey) &&
    !bHas(column.options, ColumnOption.notNull)
  );
}

/**
 * A name TypeScript refuses for an interface or a type alias gets an
 * underscore after it; any other name is written as the name cases give it.
 */
export function toTypeScriptTypeName(name: string): string {
  return RESERVED_TYPE_NAMES.has(name) ? `${name}_` : name;
}

/** A key bare where TypeScript reads an identifier, else a string literal. */
export function toTypeScriptPropertyKey(name: string): string {
  return IDENTIFIER_NAME.test(name) && !NEWER_IDENTIFIER_CHARACTER.test(name)
    ? name
    : JSON.stringify(name);
}

/**
 * An ENUM's members each once, as a row holds them: MySQL and MariaDB drop
 * the spaces that end a member, though not its tabs, when they create a table.
 */
function listMembers({ enumMembers }: ColumnType, database: number): string[] {
  const members = enumMembers ?? [];

  return [
    ...new Set(
      isMySQLFamily(database)
        ? members.map(member => member.replace(/ +$/, ''))
        : members
    ),
  ];
}

function shapeKind(columnType: ColumnType, database: number): JsonShapeKind {
  if (columnType.enumMembers) {
    return 'enum';
  }
  if (columnType.isNullOnly) {
    return 'null';
  }
  // node-postgres hands these integers over as text, and PostgreSQL's own
  // JSON writes them as strings too.
  if (columnType.isTextInteger) {
    return 'string';
  }
  if (columnType.isGuid) {
    return 'guid';
  }
  if (columnType.network === 'ipv4' || columnType.network === 'ipv6') {
    return columnType.network;
  }
  // SQLite stores a decimal with NUMERIC affinity, as a number.
  if (columnType.scalar === 'decimal' && database === Database.SQLite) {
    return 'number';
  }
  return KINDS[columnType.scalar];
}

function integerRange({
  scalar,
  bits,
}: ColumnType): [minimum: number | null, maximum: number | null] {
  if (scalar === 'i64') {
    return [null, null];
  }
  if (scalar === 'u64') {
    return [0, null];
  }

  const half = 2 ** ((bits as number) - 1);
  return UNSIGNED_SCALARS.has(scalar) ? [0, 2 * half - 1] : [-half, half - 1];
}
