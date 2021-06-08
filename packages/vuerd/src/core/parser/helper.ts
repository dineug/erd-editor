import { Table, Column, Index } from '@@types/engine/store/table.state';
import { BracketType } from '@@types/engine/store/canvas.state';
import { Relationship } from '@@types/engine/store/relationship.state';
import { bracketTypeMap } from '@/engine/store/canvas.state';
import { RelationshipState } from '@@types/engine/store/relationship.state';
import { TableState } from '@@types/engine/store/table.state';
import { Statement } from '@/core/parser/index';

export interface FormatTableOptions {
  table: Table;
  buffer: string[];
  depth: number;
}

export interface FormatColumnOptions {
  column: Column;
  buffer: string[];
  depth: number;
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
  type: DatabaseType;
  author: Author;
  tableState: TableState;
  relationshipState: RelationshipState;
  stringBuffer: string[];
}

export type DatabaseType = 'postgresql' | 'oracle' | 'mssql';

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
