import { Diff } from '@/core/diff';
import { Table } from '@@types/engine/store/table.state';

export interface ITreeNode {
  id: string;
  table: Table | null;
  open: boolean;
  disabled: boolean;
  parent: ITreeNode | null;
  children: ITreeNode[];

  changes: Changes;
  nestedChanges: Changes;
  diffs: Diff[];
}

export type Changes = 'add' | 'modify' | 'remove' | 'none';
