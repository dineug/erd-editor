import { Relationship } from '@@types/engine/store/relationship.state';
import { Column, Index, Table } from '@@types/engine/store/table.state';

export interface Diff {
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
