import { Table, Column, Index } from '@@types/engine/store/table.state';
import { Relationship } from '@@types/engine/store/relationship.state';
import { RelationshipState } from '@@types/engine/store/relationship.state';
import { TableState } from '@@types/engine/store/table.state';
import { Statement } from '@/core/parser/index';
import { translations } from './translations';

export type Dialect = 'postgresql' | 'oracle' | 'mssql';
export type DialectFrom = 'postgresql';

export interface FormatTableOptions {
  table: Table;
  buffer: string[];
  depth: number;
  dialect: Dialect;
}

export interface FormatColumnOptions {
  column: Column;
  buffer: string[];
  depth: number;
  dialect: Dialect;
}

export interface FormatConstraintsOptions {
  constraints: Constraints;
  buffer: string[];
  depth: number;
}

export interface Constraints {
  primaryKey: boolean;
  nullable: boolean;
  unique: boolean;
}

export interface FormatRelationOptions {
  tables: Table[];
  relationship: Relationship;
  buffer: string[];
  depth: number;
}

export interface FormatIndexOptions {
  table: Table;
  index: Index;
  buffer: string[];
  depth: number;
}

export interface Name {
  id: string;
  name: string;
}

export interface Author {
  id: string;
  name: string;
}

export interface FormatChangeSet {
  dialect: Dialect;
  author: Author;
  tableState: TableState;
  relationshipState: RelationshipState;
  stringBuffer: string[];
}

export interface KeyColumn {
  start: Column[];
  end: Column[];
}

export interface ParserCallback {
  (element: Element, statements: Statement[]): void;
}

export function formatNames<T extends { name: string }>(list: T[]): string {
  const buf: string[] = [];
  list.forEach((v, i) => {
    buf.push(v.name);
    if (list.length !== i + 1) {
      buf.push(', ');
    }
  });
  return buf.join('');
}

/**
 * Translation between dialects for liquibase
 * @param dialectFrom Source dialect
 * @param dialectTo Destination dialect
 * @param value Value to be translated
 * @returns Translated string
 */
export const translate = (
  dialectFrom: DialectFrom,
  dialectTo: Dialect,
  value: string
): string => {
  switch (dialectFrom) {
    case 'postgresql':
      const retVal = translateFromPostgreSQL(dialectTo, value);
      if (!retVal)
        alert(
          `Error translating "${value}" from ${dialectFrom} to ${dialectTo}`
        );
      return retVal;
    default:
      return '';
  }
};

export const translateFromPostgreSQL = (
  dialectTo: Dialect,
  value: string
): string => {
  const searchValue = translations.find(
    trans => trans.PostgresDatabase.toLowerCase() === value.toLowerCase()
  );

  switch (dialectTo) {
    case 'postgresql':
      return searchValue?.PostgresDatabase || '';
    case 'mssql':
      return searchValue?.MSSQLDatabase || '';
    case 'oracle':
      return searchValue?.OracleDatabase || '';
    default:
      return '';
  }
};
