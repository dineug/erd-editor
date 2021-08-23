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

export interface Difference {
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

interface TableRemove extends Difference {
  type: 'table';
  changes: 'remove';
  data: {
    oldTable: Table;
  };
}

interface TableAdd extends Difference {
  type: 'table';
  changes: 'add';
  data: {
    newTable: Table;
  };
}

interface TableModify extends Difference {
  type: 'table';
  changes: 'modify';
  data: {
    oldTable: Table;
    newTable: Table;
  };
}

interface ColumnRemove extends Difference {
  type: 'column';
  changes: 'remove';
  data: {
    table: Table;
    oldColumn: Column;
  };
}

interface ColumnAdd extends Difference {
  type: 'column';
  changes: 'add';
  data: {
    table: Table;
    newColumn: Column;
  };
}

interface ColumnModify extends Difference {
  type: 'column';
  changes: 'modify';
  data: {
    table: Table;
    oldColumn: Column;
    newColumn: Column;
  };
}

interface IndexRemove extends Difference {
  type: 'index';
  changes: 'remove';
  data: {
    oldIndex: Index;
    table: Table;
  };
}

interface IndexAdd extends Difference {
  type: 'index';
  changes: 'add';
  data: {
    newIndex: Index;
    table: Table;
  };
}

interface RelationshipRemove extends Difference {
  type: 'relationship';
  changes: 'remove';
  data: {
    oldRelationship: Relationship;
    table: Table;
  };
}

interface RelationshipAdd extends Difference {
  type: 'relationship';
  changes: 'add';
  data: {
    newRelationship: Relationship;
    startTable: Table;
    endTable: Table;
  };
}
