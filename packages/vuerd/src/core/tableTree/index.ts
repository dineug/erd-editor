import { Table } from '@@types/engine/store/table.state';

export interface ITreeNode {
  id: string;
  table: Table;
  open: boolean;
  disabled: boolean;
  parent: ITreeNode | null;
  children: ITreeNode[];
}

export class Entry {
  count: number = 0;
  id: string;

  constructor(id: string) {
    this.count = 0;
    this.id = id;
  }

  add() {
    this.count++;
  }
}