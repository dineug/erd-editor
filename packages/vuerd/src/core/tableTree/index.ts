import { Table } from '@@types/engine/store/table.state';

export interface ITreeNode {
  id: string;
  table: Table | null;
  open: boolean;
  selected: boolean;
  disabled: boolean;
  parent: ITreeNode | null;
  children: ITreeNode[];

  changes: Changes;
}

export type Changes = 'add' | 'modify' | 'remove' | 'none';
