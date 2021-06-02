import { Table, Column, Index } from '@@types/engine/store/table.state';
import { BracketType } from '@@types/engine/store/canvas.state';
import { Relationship } from '@@types/engine/store/relationship.state';
import { bracketTypeMap } from '@/engine/store/canvas.state';

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

export interface KeyColumn {
  start: Column[];
  end: Column[];
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
