import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import { getJsonShape, isNullableColumn, JsonShape } from './jsonShape';
import { getNameCase } from './utils';

export type JsonScalar = string | number | boolean | null;

/**
 * An object as a Map, which keeps every key where it was set, __proto__ and
 * integer-like keys too, where a plain object loses or reorders them.
 */
export type JsonObject = Map<string, JsonValue>;

export type JsonValue = JsonScalar | JsonScalar[] | JsonObject;

export const DIALECT = 'https://json-schema.org/draft/2020-12/schema';

/**
 * A time of day with no offset, as z.iso.time() takes it, written with [0-9]
 * since \d matches any script's decimal digits in a Python or .NET validator.
 */
export const TIME_PATTERN =
  '^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\\.[0-9]+)?)?$';

/**
 * A date and time with no offset; the Z a driver's Date.prototype.toJSON adds
 * passes after seconds, as z.iso.datetime({ local: true }) lets it.
 */
export const NAIVE_DATE_TIME_PATTERN =
  '^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\\.[0-9]+)?Z?)?$';

const INDENT = '  ';
const LINE_LIMIT = 80;
const PRINTABLE_ASCII = /^[\x20-\x7f]*$/;

/**
 * The first and last code point of each run of East Asian Wide and Fullwidth
 * characters, in pairs, as Prettier 3.9.9 reads them (get-east-asian-width
 * 1.6.0, Unicode 17.0), so a line of Hangul breaks where Prettier breaks it.
 */
const WIDE_RUNS: readonly number[] = [
  0x1100, 0x115f, 0x231a, 0x231b, 0x2329, 0x232a, 0x23e9, 0x23ec, 0x23f0,
  0x23f0, 0x23f3, 0x23f3, 0x25fd, 0x25fe, 0x2614, 0x2615, 0x2630, 0x2637,
  0x2648, 0x2653, 0x267f, 0x267f, 0x268a, 0x268f, 0x2693, 0x2693, 0x26a1,
  0x26a1, 0x26aa, 0x26ab, 0x26bd, 0x26be, 0x26c4, 0x26c5, 0x26ce, 0x26ce,
  0x26d4, 0x26d4, 0x26ea, 0x26ea, 0x26f2, 0x26f3, 0x26f5, 0x26f5, 0x26fa,
  0x26fa, 0x26fd, 0x26fd, 0x2705, 0x2705, 0x270a, 0x270b, 0x2728, 0x2728,
  0x274c, 0x274c, 0x274e, 0x274e, 0x2753, 0x2755, 0x2757, 0x2757, 0x2795,
  0x2797, 0x27b0, 0x27b0, 0x27bf, 0x27bf, 0x2b1b, 0x2b1c, 0x2b50, 0x2b50,
  0x2b55, 0x2b55, 0x2e80, 0x2e99, 0x2e9b, 0x2ef3, 0x2f00, 0x2fd5, 0x2ff0,
  0x303e, 0x3041, 0x3096, 0x3099, 0x30ff, 0x3105, 0x312f, 0x3131, 0x318e,
  0x3190, 0x31e5, 0x31ef, 0x321e, 0x3220, 0x3247, 0x3250, 0xa48c, 0xa490,
  0xa4c6, 0xa960, 0xa97c, 0xac00, 0xd7a3, 0xf900, 0xfaff, 0xfe10, 0xfe19,
  0xfe30, 0xfe52, 0xfe54, 0xfe66, 0xfe68, 0xfe6b, 0xff01, 0xff60, 0xffe0,
  0xffe6, 0x16fe0, 0x16fe4, 0x16ff0, 0x16ff6, 0x17000, 0x18cd5, 0x18cff,
  0x18d1e, 0x18d80, 0x18df2, 0x1aff0, 0x1aff3, 0x1aff5, 0x1affb, 0x1affd,
  0x1affe, 0x1b000, 0x1b122, 0x1b132, 0x1b132, 0x1b150, 0x1b152, 0x1b155,
  0x1b155, 0x1b164, 0x1b167, 0x1b170, 0x1b2fb, 0x1d300, 0x1d356, 0x1d360,
  0x1d376, 0x1f004, 0x1f004, 0x1f0cf, 0x1f0cf, 0x1f18e, 0x1f18e, 0x1f191,
  0x1f19a, 0x1f200, 0x1f202, 0x1f210, 0x1f23b, 0x1f240, 0x1f248, 0x1f250,
  0x1f251, 0x1f260, 0x1f265, 0x1f300, 0x1f320, 0x1f32d, 0x1f335, 0x1f337,
  0x1f37c, 0x1f37e, 0x1f393, 0x1f3a0, 0x1f3ca, 0x1f3cf, 0x1f3d3, 0x1f3e0,
  0x1f3f0, 0x1f3f4, 0x1f3f4, 0x1f3f8, 0x1f43e, 0x1f440, 0x1f440, 0x1f442,
  0x1f4fc, 0x1f4ff, 0x1f53d, 0x1f54b, 0x1f54e, 0x1f550, 0x1f567, 0x1f57a,
  0x1f57a, 0x1f595, 0x1f596, 0x1f5a4, 0x1f5a4, 0x1f5fb, 0x1f64f, 0x1f680,
  0x1f6c5, 0x1f6cc, 0x1f6cc, 0x1f6d0, 0x1f6d2, 0x1f6d5, 0x1f6d8, 0x1f6dc,
  0x1f6df, 0x1f6eb, 0x1f6ec, 0x1f6f4, 0x1f6fc, 0x1f7e0, 0x1f7eb, 0x1f7f0,
  0x1f7f0, 0x1f90c, 0x1f93a, 0x1f93c, 0x1f945, 0x1f947, 0x1f9ff, 0x1fa70,
  0x1fa7c, 0x1fa80, 0x1fa8a, 0x1fa8e, 0x1fac6, 0x1fac8, 0x1fac8, 0x1facd,
  0x1fadc, 0x1fadf, 0x1faea, 0x1faef, 0x1faf8, 0x20000, 0x2fffd, 0x30000,
  0x3fffd,
];

/**
 * The text-default emoji that take a skin tone, which Prettier's emoji pattern
 * matches on their own and counts two columns, though they are not wide.
 */
const WIDE_EMOJI: ReadonlySet<number> = new Set([
  0x261d, 0x26f9, 0x270c, 0x270d, 0x1f3cb, 0x1f3cc, 0x1f574, 0x1f575, 0x1f590,
]);

/** Every table's row schema under $defs, keyed by the cased table name. */
export function createCode(state: RootState): string {
  const {
    doc: { tableIds },
    settings: { tableNameCase },
    collections,
  } = state;
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC);

  if (tables.length === 0) {
    return '';
  }

  const keys = toDefinitionKeys(
    tables.map(table => getNameCase(table.name, tableNameCase))
  );
  const definitions: JsonObject = new Map(
    tables.map((table, index) => [
      keys[index],
      tableSchema(state, table, keys[index]),
    ])
  );

  return `\n${formatJson(
    new Map<string, JsonValue>([
      ['$schema', DIALECT],
      ['$defs', definitions],
    ])
  )}\n`;
}

/** One table's row schema standing alone, its name never numbered. */
export function createTableCode(state: RootState, table: Table): string {
  const {
    settings: { tableNameCase },
  } = state;
  const schema = tableSchema(
    state,
    table,
    getNameCase(table.name, tableNameCase)
  );

  return `\n${formatJson(new Map([['$schema', DIALECT], ...schema]))}\n`;
}

/**
 * Each table's key: a name met again is numbered from 2, past every name a
 * table takes as is, so a table named user2 keeps User2 beside two users.
 */
export function toDefinitionKeys(names: string[]): string[] {
  const taken = new Set(names);
  const used = new Set<string>();
  const isFree = (key: string) => !taken.has(key) && !used.has(key);

  return names.map(name => {
    let key = name;

    if (used.has(name)) {
      let index = 2;

      while (!isFree(`${name}${index}`)) {
        index++;
      }
      key = `${name}${index}`;
    }
    used.add(key);
    return key;
  });
}

/** The schema of one value of a column, NOT NULL, with no description. */
export function toValueSchema(shape: JsonShape): JsonObject {
  let schema = elementSchema(shape);

  for (let depth = 0; depth < shape.arrayDepth; depth++) {
    schema = new Map<string, JsonValue>([
      ['type', 'array'],
      ['items', schema],
    ]);
  }
  return schema;
}

/**
 * A schema that takes null too: null joins its type, and its enum, which
 * refuses a value it does not list; a schema with no type takes null already.
 */
export function withNull(schema: JsonObject): JsonObject {
  const type = schema.get('type');

  if (typeof type !== 'string' || type === 'null') {
    return schema;
  }

  const result = new Map(schema).set('type', [type, 'null']);
  const members = schema.get('enum');

  if (Array.isArray(members)) {
    result.set('enum', [...members, null]);
  }
  return result;
}

/**
 * JSON as Prettier writes it: two spaces a level, an object one key a line,
 * and an array on one line while that line fits in 80 columns, its comma
 * counted only where another key follows, else one item a line.
 */
export function formatJson(object: JsonObject, indent = ''): string {
  if (object.size === 0) {
    return '{}';
  }

  const inner = indent + INDENT;
  const entries = [...object];
  const lines = entries.map(([key, value], index) => {
    const head = `${inner}${JSON.stringify(key)}: `;

    if (value instanceof Map) {
      return head + formatJson(value, inner);
    }
    if (Array.isArray(value)) {
      const isFollowed = index < entries.length - 1;
      return (
        head + formatArray(value, inner, textWidth(head) + (isFollowed ? 1 : 0))
      );
    }
    return head + JSON.stringify(value);
  });

  return `{\n${lines.join(',\n')}\n${indent}}`;
}

/**
 * Columns a string takes on a line, a code point at a time as Prettier counts:
 * two for a wide or fullwidth one or an emoji that takes a skin tone, none for
 * a control, a combining mark U+0300-U+036F or a variation selector, else one.
 */
export function textWidth(text: string): number {
  if (PRINTABLE_ASCII.test(text)) {
    return text.length;
  }

  let width = 0;

  for (const character of text) {
    const codePoint = character.codePointAt(0) as number;

    if (!isZeroWidth(codePoint)) {
      width += isWide(codePoint) || WIDE_EMOJI.has(codePoint) ? 2 : 1;
    }
  }
  return width;
}

function tableSchema(
  { settings: { columnNameCase, database }, collections }: RootState,
  table: Table,
  title: string
): JsonObject {
  const properties: JsonObject = new Map();

  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach(column => {
      const key = getNameCase(column.name, columnNameCase);

      // A row holds one value a key, and required refuses a key listed twice.
      if (!properties.has(key)) {
        properties.set(key, propertySchema(column, database));
      }
    });

  const schema: JsonObject = new Map([['title', title]]);

  if (hasText(table.comment)) {
    schema.set('description', table.comment);
  }
  return schema
    .set('type', 'object')
    .set('properties', properties)
    .set('required', [...properties.keys()])
    .set('additionalProperties', false);
}

function propertySchema(column: Column, database: number): JsonObject {
  const schema = toValueSchema(getJsonShape(column.dataType, database));
  const value = isNullableColumn(column) ? withNull(schema) : schema;

  return hasText(column.comment)
    ? new Map([['description', column.comment], ...value])
    : value;
}

function elementSchema(shape: JsonShape): JsonObject {
  switch (shape.kind) {
    case 'boolean':
    case 'number':
    case 'null':
      return typed(shape.kind);
    case 'integer': {
      const schema = typed('integer');

      if (shape.minimum !== null) {
        schema.set('minimum', shape.minimum);
      }
      if (shape.maximum !== null) {
        schema.set('maximum', shape.maximum);
      }
      return schema;
    }
    case 'string':
      // Past 2^53 - 1 a length may have been rounded, or read as Infinity,
      // which JSON.stringify writes as null; no string is that long anyway.
      return Number.isSafeInteger(shape.maxLength)
        ? typed('string').set('maxLength', shape.maxLength)
        : typed('string');
    case 'uuid':
    case 'guid':
      return typed('string').set('format', 'uuid');
    case 'date':
      return typed('string').set('format', 'date');
    case 'time':
      return typed('string').set('pattern', TIME_PATTERN);
    case 'naiveDateTime':
      return typed('string').set('pattern', NAIVE_DATE_TIME_PATTERN);
    case 'offsetDateTime':
      return typed('string').set('format', 'date-time');
    case 'base64':
      return typed('string').set('contentEncoding', 'base64');
    case 'json':
      return new Map();
    case 'enum':
      return typed('string').set('enum', shape.members);
    case 'ipv4':
    case 'ipv6':
      return typed('string').set('format', shape.kind);
  }
}

function typed(type: string): JsonObject {
  return new Map([['type', type]]);
}

function hasText(comment: string): boolean {
  return comment.trim() !== '';
}

function formatArray(
  items: JsonScalar[],
  indent: string,
  restWidth: number
): string {
  const texts = items.map(item => JSON.stringify(item));
  const width = texts.reduce(
    (sum, text) => sum + textWidth(text) + 2,
    restWidth
  );

  if (width <= LINE_LIMIT) {
    return `[${texts.join(', ')}]`;
  }

  const inner = indent + INDENT;
  return `[\n${texts.map(text => inner + text).join(',\n')}\n${indent}]`;
}

function isZeroWidth(codePoint: number): boolean {
  return (
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    (codePoint >= 0x300 && codePoint <= 0x36f) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
  );
}

function isWide(codePoint: number): boolean {
  let low = 0;
  let high = WIDE_RUNS.length / 2 - 1;

  while (low <= high) {
    const middle = (low + high) >> 1;

    if (codePoint < WIDE_RUNS[middle * 2]) {
      high = middle - 1;
    } else if (codePoint > WIDE_RUNS[middle * 2 + 1]) {
      low = middle + 1;
    } else {
      return true;
    }
  }
  return false;
}
