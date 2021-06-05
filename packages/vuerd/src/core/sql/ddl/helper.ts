import { bracketTypeMap } from '@/engine/store/canvas.state';
import { BracketType } from '@@types/engine/store/canvas.state';
import { Relationship } from '@@types/engine/store/relationship.state';
import { Column, Index, Table } from '@@types/engine/store/table.state';

export interface FormatTableOptions {
  table: Table;
  buffer: string[];
  bracket: string;
}

export interface FormatColumnOptions {
  column: Column;
  isComma: boolean;
  spaceSize: MaxLength;
  buffer: string[];
  bracket: string;
}

export interface FormatRelationOptions {
  tables: Table[];
  relationship: Relationship;
  buffer: string[];
  fkNames: Name[];
  bracket: string;
}

export interface FormatIndexOptions {
  table: Table;
  index: Index;
  buffer: string[];
  indexNames: Name[];
  bracket: string;
}

export interface FormatCommentOptions {
  table: Table;
  buffer: string[];
  bracket: string;
}

export interface Name {
  id: string;
  name: string;
}

export interface KeyColumn {
  start: Column[];
  end: Column[];
}

export function formatNames<
  T extends {
    name: string;
  }
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
  return columns.some(column => column.option.primaryKey);
}

export function primaryKeyColumns(columns: Column[]): Column[] {
  return columns.filter(column => column.option.primaryKey);
}

export function unique(columns: Column[]): boolean {
  return columns.some(column => column.option.unique);
}

export function uniqueColumns(columns: Column[]): Column[] {
  return columns.filter(column => column.option.unique);
}

export function getBracket(bracketType: BracketType) {
  return bracketTypeMap[bracketType] ?? '';
}
