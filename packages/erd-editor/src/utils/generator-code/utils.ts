import { camelCase, snakeCase } from 'es-toolkit';

import {
  Database,
  NameCase,
  ReferentialActionToSQL,
  RelationshipType,
} from '@/constants/schema';
import {
  DatabaseHintMap,
  DataTypeHint,
  PrimitiveType,
} from '@/constants/sql/dataType';
import { Column, Index, Relationship, Table } from '@/internal-types';
import { pascalCase } from '@/utils';
import { arrayHas } from '@/utils/arrayHas';
import {
  ALL_REFERENTIAL_ACTIONS,
  ReferentialActionSupport,
} from '@/utils/schema-sql/utils';

export interface FormatTableOptions {
  buffer: string[];
  table: Table;
}

export interface FormatColumnOptions {
  buffer: string[];
  column: Column;
}

export interface FormatRelationOptions {
  buffer: string[];
  table: Table;
}

export const hasOneRelationship = arrayHas<number>([
  RelationshipType.ZeroOne,
  RelationshipType.OneOnly,
]);

export const hasNRelationship = arrayHas<number>([
  RelationshipType.ZeroN,
  RelationshipType.OneN,
]);

const WORD = /[0-9A-Za-z_]/;
const ARGUMENTS = /\([^)]*\)/g;
const WHITESPACE = /\s+/g;
const NUMBER_ARGUMENTS = /^\s*number\s*\(\s*(\*|\d+)\s*,\s*(\d+)\s*\)\s*$/i;
const FLOAT_PRECISION = /^\s*float\s*\(\s*(\d+)\s*\)/i;

// FLOAT(1) to FLOAT(24) is a single precision float there and FLOAT(25) to
// FLOAT(53) a double; Oracle's FLOAT(p) is a NUMBER, and the rest take no p.
const FLOAT_PRECISION_DATABASES = new Set<number>([
  Database.MariaDB,
  Database.MSSQL,
  Database.MySQL,
  Database.PostgreSQL,
]);

/** The ECMAScript line terminators, CR LF one of them, where a line comment ends. */
export const LINE_TERMINATOR = /\r\n|[\n\r\u2028\u2029]/;

export function getPrimitiveType(
  dataType: string,
  database: number
): PrimitiveType {
  if (fractionalNumber(dataType, database)) {
    return 'decimal';
  }

  const hint = findDataTypeHint(dataType, database);
  const precision = Number(FLOAT_PRECISION.exec(dataType)?.[1]);

  if (
    precision >= 1 &&
    precision <= 53 &&
    hint?.name.toLowerCase() === 'float' &&
    FLOAT_PRECISION_DATABASES.has(database)
  ) {
    return precision <= 24 ? 'float' : 'double';
  }
  return hint?.primitiveType ?? 'string';
}

/** The vendor list entry a data type names, the longest that prefixes it. */
export function findDataTypeHint(
  dataType: string,
  database: number
): DataTypeHint | undefined {
  // Drop the argument list so a name whose words wrap one still matches:
  // interval day(2) to second(6) has to reach interval day to second.
  const value = dataType.toLowerCase().replace(ARGUMENTS, '');
  let matched: DataTypeHint | undefined;

  // The hint lists are alphabetical, so a shorter name can prefix a longer one.
  // Pick the longest match, and only where the name ends on a word boundary, or
  // Oracle's int claims interval day to second and int4 claims int4range.
  for (const dataTypeHint of getDataTypeHints(database)) {
    const name = dataTypeHint.name.toLowerCase();
    if (
      value.indexOf(name) === 0 &&
      !WORD.test(value.charAt(name.length)) &&
      (!matched || name.length > matched.name.length)
    ) {
      matched = dataTypeHint;
    }
  }

  return matched;
}

/**
 * The precision and scale of an Oracle or Snowflake NUMBER with a scale, which
 * the vendor lists file under long with every other NUMBER; a star is 38.
 */
export function fractionalNumber(
  dataType: string,
  database: number
): [precision: number, scale: number] | null {
  if (database !== Database.Oracle && database !== Database.Snowflake) {
    return null;
  }

  const matched = NUMBER_ARGUMENTS.exec(dataType);

  if (!matched) {
    return null;
  }

  const [, precision, scale] = matched;

  if (Number(scale) === 0) {
    return null;
  }
  return [precision === '*' ? 38 : Number(precision), Number(scale)];
}

/** The type name in lower case, with its argument lists and extra spaces gone. */
export function baseTypeName(dataType: string): string {
  return dataType
    .toLowerCase()
    .replace(ARGUMENTS, ' ')
    .replace(WHITESPACE, ' ')
    .trim();
}

/** A text split into its lines at every ECMAScript line terminator. */
export function splitLines(value: string): string[] {
  return value.split(LINE_TERMINATOR);
}

// Every directive TypeScript reads in a line comment opens with an at sign and
// ts-, and it reads ts-check and ts-nocheck in any letter case.
const TYPESCRIPT_DIRECTIVE = /^(\s*)@(?=ts-)/i;

/**
 * A line comment's text with a backslash before its at sign where it opens with
 * one and ts-, after any white space and in any case, so the line stays legible
 * and TypeScript reads no directive in it, which would hide or expect an error.
 */
export function escapeTypeScriptDirective(line: string): string {
  return line.replace(TYPESCRIPT_DIRECTIVE, '$1\\@');
}

export function getDataTypeHints(database: number): DataTypeHint[] {
  return DatabaseHintMap[database] ?? [];
}

export function getNameCase(name: string, nameCase: number): string {
  let changeName = name;
  switch (nameCase) {
    case NameCase.camelCase:
      changeName = camelCase(name);
      break;
    case NameCase.pascalCase:
      changeName = pascalCase(name);
      break;
    case NameCase.snakeCase:
      changeName = snakeCase(name);
      break;
  }
  return changeName;
}

export type ReferentialActionEntry = {
  key: 'onDelete' | 'onUpdate';
  action: number;
  sql: string;
};

/**
 * The actions a relationship sets, ON DELETE first, each with its SQL spelling;
 * with a support, only those the database's DDL would write too.
 */
export function referentialActionEntries(
  { onDelete, onUpdate }: Pick<Relationship, 'onDelete' | 'onUpdate'>,
  support: ReferentialActionSupport = ALL_REFERENTIAL_ACTIONS
): ReferentialActionEntry[] {
  const entries: ReferentialActionEntry[] = [];

  if (support.onDelete.includes(onDelete)) {
    entries.push({
      key: 'onDelete',
      action: onDelete,
      sql: ReferentialActionToSQL[onDelete],
    });
  }
  if (support.onUpdate.includes(onUpdate)) {
    entries.push({
      key: 'onUpdate',
      action: onUpdate,
      sql: ReferentialActionToSQL[onUpdate],
    });
  }

  return entries;
}
