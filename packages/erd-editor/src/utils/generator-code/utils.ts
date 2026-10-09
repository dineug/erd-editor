import { camelCase, snakeCase } from 'es-toolkit';

import {
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

export function getPrimitiveType(
  dataType: string,
  database: number
): PrimitiveType {
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

  return matched?.primitiveType ?? 'string';
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
