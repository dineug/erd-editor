import { arrayHas } from '@dineug/shared';
import { camelCase, snakeCase } from 'es-toolkit';

import { NameCase, RelationshipType } from '@/constants/schema';
import {
  DatabaseHintMap,
  DataTypeHint,
  PrimitiveType,
} from '@/constants/sql/dataType';
import { Column, Index, Relationship, Table } from '@/internal-types';
import { pascalCase } from '@/utils';

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

export function getPrimitiveType(
  dataType: string,
  database: number
): PrimitiveType {
  const value = dataType.toLocaleLowerCase();
  let matched: DataTypeHint | undefined;

  // The hint lists are alphabetical, so a shorter name (DATE, int, time) can
  // prefix a longer one (DATETIME, int8, timestamp). Pick the longest match.
  for (const dataTypeHint of getDataTypeHints(database)) {
    const name = dataTypeHint.name.toLocaleLowerCase();
    if (
      value.indexOf(name) === 0 &&
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
