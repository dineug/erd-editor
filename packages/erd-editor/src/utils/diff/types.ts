import type { DiffMap } from '@/components/erd/diff-viewer/diff';
import type { ValuesType } from '@/internal-types';

export const DiffKind = {
  table: 'table',
  column: 'column',
  index: 'index',
  foreignKey: 'foreignKey',
  memo: 'memo',
  tableGroup: 'tableGroup',
} as const;
export type DiffKind = ValuesType<typeof DiffKind>;

export const DiffStatus = {
  added: 'added',
  modified: 'modified',
  deleted: 'deleted',
  renamed: 'renamed',
} as const;
export type DiffStatus = ValuesType<typeof DiffStatus>;

/** What of an entity changed, each the name of a tooltip line. */
export const DiffField = {
  name: 'name',
  comment: 'comment',
  dataType: 'dataType',
  default: 'default',
  autoIncrement: 'autoIncrement',
  primaryKey: 'primaryKey',
  unique: 'unique',
  notNull: 'notNull',
  order: 'order',
  tableGroup: 'tableGroup',
  position: 'position',
  size: 'size',
  color: 'color',
  members: 'members',
  columns: 'columns',
  relationshipType: 'relationshipType',
  onDelete: 'onDelete',
  onUpdate: 'onUpdate',
  value: 'value',
} as const;
export type DiffField = ValuesType<typeof DiffField>;

/** A value as the saved or the current document holds it, before any wording. */
export type DiffValue = string | number | boolean;

export type DiffChange = {
  field: DiffField;
  before: DiffValue;
  after: DiffValue;
};

/**
 * One entity the two documents differ on, or that holds one that does. Its
 * status is null for a table listed only for what changed inside it.
 */
export type DiffEntry = {
  kind: DiffKind;
  status: DiffStatus | null;
  prevId: string | null;
  nextId: string | null;
  /** What the current document calls it, or the saved one where it is gone. */
  name: string;
  /** What the saved document calls it, the same as name unless renamed or added. */
  prevName: string;
  changes: DiffChange[];
  /** A table's columns, indexes and foreign keys, in that order. */
  children: DiffEntry[];
};

export type DiffEntries = {
  tables: DiffEntry[];
  tableGroups: DiffEntry[];
  memos: DiffEntry[];
};

/** The entries for the tree and what each pane marks, which say the same thing. */
export type DocumentDiff = {
  entries: DiffEntries;
  prev: DiffMap;
  next: DiffMap;
};
