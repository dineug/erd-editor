import { Relationship } from '@@types/engine/store/relationship.state';
import { Column, Index, Table } from '@@types/engine/store/table.state';

export type Diff =
  | TableRemove
  | TableAdd
  | TableModify
  | ColumnRemove
  | ColumnAdd
  | ColumnModify
  | IndexRemove
  | IndexAdd
  | RelationshipRemove
  | RelationshipAdd;

interface Difference {
  type: DiffType;
  changes: Changes;
  data: DiffData;
}

export type Changes = 'add' | 'remove' | 'modify';

export type DiffType = 'table' | 'column' | 'index' | 'relationship';

export interface DiffData {
  table?: Table;

  oldTable?: Table;
  newTable?: Table;

  oldColumn?: Column;
  newColumn?: Column;

  oldIndex?: Index;
  newIndex?: Index;

  oldRelationship?: Relationship;
  newRelationship?: Relationship;

  startTable?: Table;
  endTable?: Table;
}

export interface TableRemove {
  type: 'table';
  changes: 'remove';

  oldTable: Table;
}

export interface TableAdd {
  type: 'table';
  changes: 'add';

  newTable: Table;
}

export interface TableModify {
  type: 'table';
  changes: 'modify';

  oldTable: Table;
  newTable: Table;
}

export interface ColumnRemove {
  type: 'column';
  changes: 'remove';

  table: Table;
  oldColumn: Column;
}

export interface ColumnAdd {
  type: 'column';
  changes: 'add';

  table: Table;
  newColumn: Column;
}

export interface ColumnModify {
  type: 'column';
  changes: 'modify';

  table: Table;
  oldColumn: Column;
  newColumn: Column;
}

export interface IndexRemove {
  type: 'index';
  changes: 'remove';

  oldIndex: Index;
  table: Table;
}

export interface IndexAdd {
  type: 'index';
  changes: 'add';

  newIndex: Index;
  table: Table;
}

export interface RelationshipRemove {
  type: 'relationship';
  changes: 'remove';

  oldRelationship: Relationship;
  table: Table;
}

export interface RelationshipAdd {
  type: 'relationship';
  changes: 'add';

  newRelationship: Relationship;
  startTable: Table;
  endTable: Table;
}
