import { arrayHas } from '@dineug/shared';
import { camelCase, snakeCase } from 'lodash-es';

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
  const dataTypeHints = getDataTypeHints(database);
  for (const dataTypeHint of dataTypeHints) {
    if (
      dataType
        .toLocaleLowerCase()
        .indexOf(dataTypeHint.name.toLocaleLowerCase()) === 0
    ) {
      return dataTypeHint.primitiveType;
    }
  }
  return 'string';
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
