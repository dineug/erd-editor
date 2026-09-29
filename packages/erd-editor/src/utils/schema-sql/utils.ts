import {
  BracketTypeMap,
  ColumnOption,
  Database,
  OrderType,
  ReferentialAction,
  ReferentialActionToSQL,
} from '@/constants/schema';
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

/** The actions a vendor accepts after ON DELETE and after ON UPDATE. */
export type ReferentialActionSupport = {
  onDelete: ReadonlyArray<number>;
  onUpdate: ReadonlyArray<number>;
};

export const REFERENTIAL_ACTIONS: ReadonlyArray<number> = [
  ReferentialAction.noAction,
  ReferentialAction.cascade,
  ReferentialAction.setNull,
  ReferentialAction.setDefault,
  ReferentialAction.restrict,
];

export const ALL_REFERENTIAL_ACTIONS: ReferentialActionSupport = {
  onDelete: REFERENTIAL_ACTIONS,
  onUpdate: REFERENTIAL_ACTIONS,
};

/** Every action but the ones a vendor refuses, on both events. */
export function withoutReferentialAction(
  ...refused: number[]
): ReferentialActionSupport {
  const actions = REFERENTIAL_ACTIONS.filter(value => !refused.includes(value));
  return { onDelete: actions, onUpdate: actions };
}

const REFERENTIAL_ACTION_SUPPORT: Record<number, ReferentialActionSupport> = {
  // A foreign key option may only be NO ACTION, on either event.
  [Database.Databricks]: {
    onDelete: [ReferentialAction.noAction],
    onUpdate: [ReferentialAction.noAction],
  },
  // MariaDB does not support SET DEFAULT on either event.
  [Database.MariaDB]: withoutReferentialAction(ReferentialAction.setDefault),
  // SQL Server has no RESTRICT; NO ACTION, its default, refuses the change
  // the same way.
  [Database.MSSQL]: withoutReferentialAction(ReferentialAction.restrict),
  // InnoDB, and so MySQL, rejects a table whose foreign key says SET DEFAULT,
  // though the parser accepts it; NO ACTION reads as RESTRICT.
  [Database.MySQL]: withoutReferentialAction(ReferentialAction.setDefault),
  // Oracle has no ON UPDATE and writes only CASCADE or SET NULL after ON
  // DELETE; its default already refuses the change NO ACTION would.
  [Database.Oracle]: {
    onDelete: [ReferentialAction.cascade, ReferentialAction.setNull],
    onUpdate: [],
  },
  [Database.PostgreSQL]: ALL_REFERENTIAL_ACTIONS,
  // SQLite takes every action, enforced once PRAGMA foreign_keys is on.
  [Database.SQLite]: ALL_REFERENTIAL_ACTIONS,
  // Snowflake accepts every action for compatibility and enforces none.
  [Database.Snowflake]: ALL_REFERENTIAL_ACTIONS,
};

/**
 * The actions the DDL of a database writes, which the code generators and the
 * relationship menu follow too; an unknown database takes every one.
 */
export function referentialActionSupport(
  database: number
): ReferentialActionSupport {
  return REFERENTIAL_ACTION_SUPPORT[database] ?? ALL_REFERENTIAL_ACTIONS;
}

/**
 * ON DELETE, then ON UPDATE, each where the relationship sets one the vendor
 * accepts; an action it would refuse is left out, so the default applies.
 */
export function formatReferentialActions(
  { onDelete, onUpdate }: Pick<Relationship, 'onDelete' | 'onUpdate'>,
  support: ReferentialActionSupport
): string[] {
  const clauses: string[] = [];

  if (support.onDelete.includes(onDelete)) {
    clauses.push(`ON DELETE ${ReferentialActionToSQL[onDelete]}`);
  }
  if (support.onUpdate.includes(onUpdate)) {
    clauses.push(`ON UPDATE ${ReferentialActionToSQL[onUpdate]}`);
  }

  return clauses;
}
