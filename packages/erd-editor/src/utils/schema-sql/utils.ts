import { BracketTypeMap, ColumnOption, OrderType } from '@/constants/schema';
import { Column, Index, Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';

export interface FormatTableOptions {
  buffer: string[];
  table: Table;
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
}

export interface FormatIndexOptions {
  buffer: string[];
  index: Index;
  indexNames: Name[];
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
  let result = true;
  for (const value of list) {
    if (name === value.name && value.id !== id && name !== '') {
      result = false;
      break;
    }
  }
  if (result) {
    return name;
  }
  return autoName(list, id, name.replace(/[0-9]/g, '') + num, num + 1);
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
