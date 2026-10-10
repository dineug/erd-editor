import { query } from '@dineug/erd-editor-schema';

import {
  BracketTypeMap,
  ColumnOption,
  Database,
  OrderType,
  ReferentialAction,
  ReferentialActionToSQL,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import {
  Collections,
  Column,
  Index,
  IndexColumn,
  Relationship,
  Table,
} from '@/internal-types';
import { bHas } from '@/utils/bit';

import { SchemaSQLStatements } from './options';

/** What a script's DROP block and the Oracle name check read off the body just written. */
export interface WrittenObjects {
  /** The tables in the order their CREATE TABLE is written. */
  tables: Table[];
  /** Oracle: each sequence name as written, its owner included. */
  sequences: string[];
  /** Oracle: each identifier written, unquoted, in the order written. */
  identifiers: string[];
}

export function createWrittenObjects(): WrittenObjects {
  return { tables: [], sequences: [], identifiers: [] };
}

export interface CreateSchemaOptions {
  /** Already what the database writes (resolveSchemaSQLOptions); create when left out. */
  statements?: SchemaSQLStatements;
  written?: WrittenObjects;
}

export interface FormatTableOptions {
  buffer: string[];
  table: Table;
  /** create when left out. */
  statements?: SchemaSQLStatements;
  written?: WrittenObjects;
}

export interface FormatColumnOptions {
  buffer: string[];
  column: Column;
  isComma: boolean;
  spaceSize: MaxLength;
}

export interface FormatRelationOptions {
  buffer: string[];
  relationship: Relationship;
  fkNames: Name[];
  /** create when left out. */
  statements?: SchemaSQLStatements;
  written?: WrittenObjects;
}

export interface FormatIndexOptions {
  buffer: string[];
  index: Index;
  indexNames: Name[];
  /** create when left out. */
  statements?: SchemaSQLStatements;
  written?: WrittenObjects;
}

export interface FormatCommentOptions {
  buffer: string[];
  table: Table;
}

export interface Name {
  id: string;
  name: string;
}

export interface KeyColumn {
  start: Column[];
  end: Column[];
}

/** The columns of a foreign key, end[i] referencing start[i]. */
export interface ForeignKeyPairs extends KeyColumn {
  startTable: Table;
  endTable: Table;
}

/**
 * A relationship read pair by pair: a pair whose start or end column has left
 * its table is dropped whole, and pairs that reference the whole primary key
 * follow its declaration order; null when a table or every pair is gone.
 */
export function toForeignKeyPairs(
  { doc: { tableIds }, collections }: Pick<RootState, 'doc' | 'collections'>,
  { start, end }: Relationship
): ForeignKeyPairs | null {
  if (!tableIds.includes(start.tableId) || !tableIds.includes(end.tableId)) {
    return null;
  }

  const tableCollection = query(collections).collection('tableEntities');
  const columnCollection = query(collections).collection('tableColumnEntities');
  const startTable = tableCollection.selectById(start.tableId);
  const endTable = tableCollection.selectById(end.tableId);
  if (!startTable || !endTable) return null;

  const pairs: Array<[start: Column, end: Column]> = [];
  const length = Math.min(start.columnIds.length, end.columnIds.length);

  for (let i = 0; i < length; i++) {
    const startId = start.columnIds[i];
    const endId = end.columnIds[i];
    if (
      !startTable.columnIds.includes(startId) ||
      !endTable.columnIds.includes(endId)
    ) {
      continue;
    }

    const startColumn = columnCollection.selectById(startId);
    const endColumn = columnCollection.selectById(endId);
    if (startColumn && endColumn) {
      pairs.push([startColumn, endColumn]);
    }
  }
  if (pairs.length === 0) return null;

  const keyIds = new Set(
    primaryKeyColumns(columnCollection.selectByIds(startTable.columnIds)).map(
      column => column.id
    )
  );
  const startIds = new Set(pairs.map(([column]) => column.id));
  const isPrimaryKey =
    keyIds.size === startIds.size && [...startIds].every(id => keyIds.has(id));

  // The PRIMARY KEY clause lists the key in table column order, and MySQL and
  // MariaDB refuse a foreign key naming the referenced columns in another.
  if (isPrimaryKey) {
    const position = (column: Column) =>
      startTable.columnIds.indexOf(column.id);
    pairs.sort(([a], [b]) => position(a) - position(b));
  }

  return {
    startTable,
    endTable,
    start: pairs.map(([column]) => column),
    end: pairs.map(([, column]) => column),
  };
}

/**
 * The columns of an index its table still lists, in the index's order, each
 * with the index column naming it: a column taken out of the table stays in
 * the collection, but a saved file leaves it out of the index, as this does.
 */
export function selectIndexColumns(
  collections: Collections,
  table: Table,
  index: Index
): Array<{ indexColumn: IndexColumn; column: Column }> {
  const listed = new Set(table.columnIds);

  return query(collections)
    .collection('indexColumnEntities')
    .selectByIds(index.indexColumnIds)
    .flatMap(indexColumn => {
      const column = listed.has(indexColumn.columnId)
        ? query(collections)
            .collection('tableColumnEntities')
            .selectById(indexColumn.columnId)
        : undefined;
      return column ? [{ indexColumn, column }] : [];
    });
}

/**
 * What one export writes: every table, relationship and index of the document,
 * or the tables named, their indexes and the foreign keys they hold, whose
 * parents stay in the document, so a reference out still shows; never an index of a removed table.
 */
export function toSchemaEntities(
  { doc, collections }: Pick<RootState, 'doc' | 'collections'>,
  tableIds?: readonly string[]
): { tables: Table[]; relationships: Relationship[]; indexes: Index[] } {
  const named = tableIds ? new Set(tableIds) : null;
  const listed = new Set(doc.tableIds);
  const writes = (tableId: string) => !named || named.has(tableId);

  return {
    tables: query(collections)
      .collection('tableEntities')
      .selectByIds(doc.tableIds.filter(writes))
      .sort(orderByNameASC),
    relationships: query(collections)
      .collection('relationshipEntities')
      .selectByIds(doc.relationshipIds)
      .filter(({ end }) => writes(end.tableId)),
    indexes: query(collections)
      .collection('indexEntities')
      .selectByIds(doc.indexIds)
      .filter(({ tableId }) => listed.has(tableId) && writes(tableId)),
  };
}

export function formatNames<
  T extends {
    name: string;
  },
>(list: T[], backtick?: string, backtick2?: string): string {
  const buf: string[] = [];
  list.forEach((v, i) => {
    if (backtick) {
      if (backtick2) {
        buf.push(`${backtick}${v.name}${backtick2}`);
      } else {
        buf.push(`${backtick}${v.name}${backtick}`);
      }
    } else {
      buf.push(v.name);
    }
    if (list.length !== i + 1) {
      buf.push(', ');
    }
  });
  return buf.join('');
}

export interface MaxLength {
  name: number;
  dataType: number;
}

export function formatSize(columns: Column[]): MaxLength {
  let name = 0;
  let dataType = 0;
  columns.forEach(column => {
    if (name < column.name.length) {
      name = column.name.length;
    }
    if (dataType < column.dataType.length) {
      dataType = column.dataType.length;
    }
  });
  return {
    name,
    dataType,
  };
}

export function formatSpace(size: number): string {
  const buf: string[] = [];
  for (let i = 0; i < size; i++) {
    buf.push(' ');
  }
  return buf.join('');
}

export function primaryKey(columns: Column[]): boolean {
  return columns.some(({ options }) => bHas(options, ColumnOption.primaryKey));
}

export function primaryKeyColumns(columns: Column[]): Column[] {
  return columns.filter(({ options }) =>
    bHas(options, ColumnOption.primaryKey)
  );
}

export function unique(columns: Column[]): boolean {
  return columns.some(({ options }) => bHas(options, ColumnOption.unique));
}

export function uniqueColumns(columns: Column[]): Column[] {
  return columns.filter(({ options }) => bHas(options, ColumnOption.unique));
}

export function getBracket(bracketType: number) {
  return BracketTypeMap[bracketType] ?? '';
}

/**
 * The words a CREATE TABLE or CREATE INDEX writes after its object type, and
 * MariaDB after UNIQUE and FOREIGN KEY, under ifNotExists; nothing otherwise.
 */
export function ifNotExists(statements?: SchemaSQLStatements): string {
  return statements === SchemaSQLStatements.ifNotExists ? ' IF NOT EXISTS' : '';
}

// A part of an unquoted name: bracketed or double-quoted runs, whose dots and
// doubled closing characters stay inside them, or any character but a dot.
const NAME_PART = /(?:\[(?:[^\]]|\]\])*\]|"(?:[^"]|"")*"|[^.])*/y;

// A part in one pair of brackets or double quotes, the closing character
// doubled inside.
const DELIMITED_PART = /^(?:\[((?:[^\]]|\]\])*)\]|"((?:[^"]|"")*)")$/;

/**
 * The parts of an unquoted name, split at each dot outside brackets or double
 * quotes as SQL Server reads it, so [sales.v2].users is two parts.
 */
export function splitNameParts(name: string): string[] {
  const parts: string[] = [];
  let index = 0;

  do {
    NAME_PART.lastIndex = index;
    const [part] = NAME_PART.exec(name)!;
    parts.push(part);
    index += part.length + 1;
  } while (index <= name.length);

  return parts;
}

/** Whether a name part is written in one pair of brackets or double quotes. */
export function isDelimitedPart(part: string): boolean {
  return DELIMITED_PART.test(part);
}

/** The name a part in brackets or double quotes holds; any other part as is. */
export function unquoteNamePart(part: string): string {
  const match = DELIMITED_PART.exec(part);
  if (!match) return part;

  const [, bracketed, quoted] = match;
  return bracketed === undefined
    ? quoted.replaceAll('""', '"')
    : bracketed.replaceAll(']]', ']');
}

/**
 * A table name split at its last dot outside brackets or double quotes into
 * schema and table, both as written, where it is unquoted; quoted, the whole
 * name is one identifier and the schema is empty.
 */
export function splitTableName(
  name: string,
  bracketType: number
): [schema: string, table: string] {
  if (getBracket(bracketType) !== '') return ['', name];

  const parts = splitNameParts(name);
  const table = parts[parts.length - 1];
  return parts.length === 1
    ? ['', name]
    : [name.slice(0, name.length - table.length - 1), table];
}

/**
 * The part of a table name that automatic constraint and index names take, one
 * pair of brackets or quotes off where unquoted, so sales.users and
 * [sales].[users] give PK_users, which every database reads as one identifier.
 */
export function tableNamePart(name: string, bracketType: number): string {
  const [, table] = splitTableName(name, bracketType);
  return getBracket(bracketType) === '' ? unquoteNamePart(table) : table;
}

const TABLE_NAME_PART_DATABASES: ReadonlySet<number> = new Set([
  Database.MariaDB,
  Database.MSSQL,
  Database.MySQL,
  Database.Oracle,
  Database.PostgreSQL,
  Database.SQLite,
]);

/**
 * Whether a database's DDL builds automatic names from tableNamePart: the six
 * generators that read an unquoted dot as a schema do, while Databricks and
 * Snowflake write the whole table name into them.
 */
export function splitsTableName(database: number): boolean {
  return TABLE_NAME_PART_DATABASES.has(database);
}

export function orderByNameASC<T extends { name: string }>(a: T, b: T) {
  const nameA = a.name.toLowerCase();
  const nameB = b.name.toLowerCase();
  if (nameA < nameB) {
    return -1;
  } else if (nameA > nameB) {
    return 1;
  }
  return 0;
}

export function autoName<T extends { id: string; name: string }>(
  list: T[],
  id: string,
  name: string,
  num = 1
): string {
  return numberName(list, id, name, num, value => value);
}

/**
 * autoName for an automatic foreign key or index name, also numbering a name
 * equal to an earlier one but for case, quoted or not, since the databases fold
 * an unquoted name and MySQL and MariaDB a quoted index name too.
 */
export function autoNameIgnoreCase(names: Name[], name: string): string {
  return numberName(names, '', name, 1, value => value.toLowerCase());
}

function numberName<T extends { id: string; name: string }>(
  list: T[],
  id: string,
  name: string,
  num: number,
  fold: (value: string) => string
): string {
  const folded = fold(name);
  const taken =
    name !== '' &&
    list.some(value => value.id !== id && fold(value.name) === folded);
  if (!taken) {
    return name;
  }
  return numberName(list, id, name.replace(/[0-9]/g, '') + num, num + 1, fold);
}

export function toOrderName(orderType: number) {
  switch (orderType) {
    case OrderType.ASC:
      return 'ASC';
    case OrderType.DESC:
      return 'DESC';
    default:
      return '';
  }
}

/** The actions a vendor accepts after ON DELETE and after ON UPDATE. */
export type ReferentialActionSupport = {
  onDelete: ReadonlyArray<number>;
  onUpdate: ReadonlyArray<number>;
};

const REFERENTIAL_ACTIONS: ReadonlyArray<number> = [
  ReferentialAction.noAction,
  ReferentialAction.cascade,
  ReferentialAction.setNull,
  ReferentialAction.setDefault,
  ReferentialAction.restrict,
];

export const ALL_REFERENTIAL_ACTIONS: ReferentialActionSupport = {
  onDelete: REFERENTIAL_ACTIONS,
  onUpdate: REFERENTIAL_ACTIONS,
};

/** Every action but the ones a vendor refuses, on both events. */
export function withoutReferentialAction(
  ...refused: number[]
): ReferentialActionSupport {
  const actions = REFERENTIAL_ACTIONS.filter(value => !refused.includes(value));
  return { onDelete: actions, onUpdate: actions };
}

const REFERENTIAL_ACTION_SUPPORT: Record<number, ReferentialActionSupport> = {
  // A foreign key option may only be NO ACTION, on either event.
  [Database.Databricks]: {
    onDelete: [ReferentialAction.noAction],
    onUpdate: [ReferentialAction.noAction],
  },
  // MariaDB does not support SET DEFAULT on either event.
  [Database.MariaDB]: withoutReferentialAction(ReferentialAction.setDefault),
  // SQL Server has no RESTRICT; NO ACTION, its default, refuses the change
  // the same way.
  [Database.MSSQL]: withoutReferentialAction(ReferentialAction.restrict),
  // InnoDB, and so MySQL, rejects a table whose foreign key says SET DEFAULT,
  // though the parser accepts it; NO ACTION reads as RESTRICT.
  [Database.MySQL]: withoutReferentialAction(ReferentialAction.setDefault),
  // Oracle has no ON UPDATE and writes only CASCADE or SET NULL after ON
  // DELETE; its default already refuses the change NO ACTION would.
  [Database.Oracle]: {
    onDelete: [ReferentialAction.cascade, ReferentialAction.setNull],
    onUpdate: [],
  },
  [Database.PostgreSQL]: ALL_REFERENTIAL_ACTIONS,
  // SQLite takes every action, enforced once PRAGMA foreign_keys is on.
  [Database.SQLite]: ALL_REFERENTIAL_ACTIONS,
  // Snowflake accepts every action for compatibility and enforces none, but
  // creates no foreign key on a standard table whose action is not NO ACTION.
  [Database.Snowflake]: {
    onDelete: [ReferentialAction.noAction],
    onUpdate: [ReferentialAction.noAction],
  },
};

/**
 * The actions the DDL of a database writes, which the code generators and the
 * relationship menu follow too; an unknown database takes every one.
 */
export function referentialActionSupport(
  database: number
): ReferentialActionSupport {
  return REFERENTIAL_ACTION_SUPPORT[database] ?? ALL_REFERENTIAL_ACTIONS;
}

/**
 * ON DELETE, then ON UPDATE, each where the relationship sets one the vendor
 * accepts; an action it would refuse is left out, so the default applies.
 */
export function formatReferentialActions(
  { onDelete, onUpdate }: Pick<Relationship, 'onDelete' | 'onUpdate'>,
  support: ReferentialActionSupport
): string[] {
  const clauses: string[] = [];

  if (support.onDelete.includes(onDelete)) {
    clauses.push(`ON DELETE ${ReferentialActionToSQL[onDelete]}`);
  }
  if (support.onUpdate.includes(onUpdate)) {
    clauses.push(`ON UPDATE ${ReferentialActionToSQL[onUpdate]}`);
  }

  return clauses;
}

// A string literal every vendor reads back as the text: a quote inside it is
// doubled, or a comment such as it's ends early and breaks the DDL.
export function toStringLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

// A default's text in the pieces its parentheses and words are read from: a
// quoted run whole, so a paren or a word inside a literal counts for nothing.
const DEFAULT_PIECE =
  /'(?:[^']|'')*'?|"(?:[^"]|"")*"?|`(?:[^`]|``)*`?|\[[^\]]*\]?|[a-z_][\w$]*|\d[\w.]*|[^]/giu;

// Whether one pair of parentheses holds the whole of the text.
function isWrapped(text: string): boolean {
  const pieces = text.match(DEFAULT_PIECE) ?? [];
  let depth = 0;

  return (
    pieces[0] === '(' &&
    pieces.every((piece, index) => {
      if (piece === '(') depth++;
      else if (piece === ')') depth--;
      return depth > 0 || index === pieces.length - 1;
    })
  );
}

// The words outside every pair of parentheses, in upper case.
function topLevelWords(text: string): string[] {
  const words: string[] = [];
  let depth = 0;

  for (const piece of text.match(DEFAULT_PIECE) ?? []) {
    if (piece === '(') depth++;
    else if (piece === ')') depth--;
    else if (depth === 0 && /^[a-z_]/i.test(piece)) {
      words.push(piece.toUpperCase());
    }
  }

  return words;
}

// A call of a function by its name, possibly qualified: uuid(), s.nextval().
function isCall(text: string): boolean {
  const name = /^[a-z_][\w$]*(?:\.[a-z_][\w$]*)*\s*(?=\()/i.exec(text);
  return !!name && isWrapped(text.slice(name[0].length));
}

const NUMBER = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?`;

// The names MySQL gives the current time, called or not.
const MYSQL_NOW = '(?:current_timestamp|now|localtime|localtimestamp)';

// What MySQL may take after DEFAULT without parentheses: a literal or the
// current time, which may carry an ON UPDATE written into the default by hand.
const MYSQL_BARE = new RegExp(
  '^(?:' +
    [
      NUMBER,
      String.raw`0x[\da-f]+`,
      String.raw`0b[01]+`,
      String.raw`(?:_\w+\s*|n)?'(?:[^'\\]|''|\\.)*'`,
      String.raw`(?:_\w+\s*|n)?"(?:[^"\\]|""|\\.)*"`,
      String.raw`x'[\da-f]*'`,
      String.raw`b'[01]*'`,
      String.raw`(?:date|time|timestamp)\s*'[^']*'`,
      'null|true|false',
      String.raw`${MYSQL_NOW}(?:\s*\(\s*\d*\s*\))?`,
    ].join('|') +
    String.raw`)(\s+on\s+update\s.*)?$`,
  'is'
);

// The types whose default MySQL reads only in parentheses, a literal's too.
// Every type it takes that opens with the word LONG (LONG, LONG VARCHAR, LONG
// VARBINARY, LONG BINARY, ...) is a MEDIUMTEXT or MEDIUMBLOB to it.
const MYSQL_EXPRESSION_TYPE =
  /^(?:(?:tiny|medium|long)?(?:blob|text)|long|json|geometry|geom(?:etry)?collection|(?:multi)?(?:point|linestring|polygon))\b/i;

const MYSQL_CURRENT_TIME = new RegExp(String.raw`^${MYSQL_NOW}\b`, 'i');

// MySQL takes a literal bare but on the types above, NULL whatever the type,
// and the current time only on a TIMESTAMP or DATETIME column, or with an ON
// UPDATE written by hand.
function takesBareMySQL(text: string, dataType: string): boolean {
  const bare = MYSQL_BARE.exec(text);

  if (!bare) return false;
  if (bare[1] || /^null$/i.test(text)) return true;
  if (MYSQL_EXPRESSION_TYPE.test(dataType)) return false;

  return (
    !MYSQL_CURRENT_TIME.test(text) ||
    /^(?:timestamp|datetime)\b/i.test(dataType)
  );
}

// What SQLite takes after DEFAULT without parentheses: a signed number, a
// string or blob literal, or one name, CURRENT_TIMESTAMP and NULL among them.
const SQLITE_BARE = new RegExp(
  '^(?:' +
    [
      NUMBER,
      String.raw`[+-]?0x[\da-f]+`,
      `'(?:[^']|'')*'`,
      String.raw`x'[\da-f]*'`,
      String.raw`[a-z_][\w$]*`,
      `"(?:[^"]|"")*"`,
      '`(?:[^`]|``)*`',
      String.raw`\[[^\]]*\]`,
    ].join('|') +
    ')$',
  'i'
);

// The words PostgreSQL reads only in a full expression, never in the shorter
// one its DEFAULT takes: now() AT TIME ZONE 'utc' needs its parentheses.
const POSTGRESQL_EXPRESSION_WORDS: ReadonlyArray<string> = [
  'ALL',
  'AND',
  'ANY',
  'AT',
  'BETWEEN',
  'COLLATE',
  'ILIKE',
  'IN',
  'IS',
  'ISNULL',
  'LIKE',
  'NOT',
  'NOTNULL',
  'OR',
  'OVERLAPS',
  'SIMILAR',
  'SOME',
];

type TakesBare = (text: string, dataType: string) => boolean;

const TAKES_BARE: Record<number, TakesBare> = {
  // MariaDB also takes a function call and a name bare, but no operator.
  [Database.MariaDB]: text =>
    MYSQL_BARE.test(text) || isCall(text) || /^[a-z_][\w$]*$/i.test(text),
  [Database.MySQL]: takesBareMySQL,
  [Database.PostgreSQL]: text =>
    !topLevelWords(text).some(word =>
      POSTGRESQL_EXPRESSION_WORDS.includes(word)
    ),
  [Database.SQLite]: text => SQLITE_BARE.test(text),
};

/**
 * A column default as the DDL of a database writes it after DEFAULT: in
 * parentheses where its grammar reads that expression only inside them.
 */
export function formatDefault(
  value: string,
  database: number,
  dataType = ''
): string {
  const text = value.trim();
  const takesBare = TAKES_BARE[database];

  return !takesBare || isWrapped(text) || takesBare(text, dataType.trim())
    ? value
    : `(${text})`;
}
