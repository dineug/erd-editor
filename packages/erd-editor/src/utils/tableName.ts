import { BracketTypeMap, ColumnOption, Database } from '@/constants/schema';
import { Column } from '@/internal-types';
import { bHas } from '@/utils/bit';

/** What an automatic name is numbered against: an entity's id and its name. */
type Named = { id: string; name: string };

export function getBracket(bracketType: number) {
  return BracketTypeMap[bracketType] ?? '';
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

export function autoName<T extends Named>(
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
export function autoNameIgnoreCase(names: Named[], name: string): string {
  return numberName(names, '', name, 1, value => value.toLowerCase());
}

function numberName<T extends Named>(
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

export function primaryKeyColumns(columns: Column[]): Column[] {
  return columns.filter(({ options }) =>
    bHas(options, ColumnOption.primaryKey)
  );
}
