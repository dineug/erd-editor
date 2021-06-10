import { Index, OrderType } from '../store/table.state';

export interface AddIndex {
  id: string;
  tableId: string;
}

export interface RemoveIndex {
  indexIds: string[];
}

export interface ChangeIndexValue {
  indexId: string;
  value: string;
}

export interface ChangeIndexUnique {
  indexId: string;
  value: boolean;
}

export interface AddIndexColumn {
  indexId: string;
  columnId: string;
}

export interface RemoveIndexColumn {
  indexId: string;
  columnId: string;
}

export interface MoveIndexColumn {
  indexId: string;
  columnId: string;
  targetColumnId: string;
}

export interface ChangeIndexColumnOrderType {
  indexId: string;
  columnId: string;
  value: OrderType;
}

export interface IndexCommandMap {
  'index.add': AddIndex;
  'index.remove': RemoveIndex;
  'index.changeName': ChangeIndexValue;
  'index.changeUnique': ChangeIndexUnique;
  'index.addColumn': AddIndexColumn;
  'index.removeColumn': RemoveIndexColumn;
  'index.moveColumn': MoveIndexColumn;
  'index.changeColumnOrderType': ChangeIndexColumnOrderType;
  'index.load': Index;
}
