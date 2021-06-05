import { Point } from '../store/relationship.state';
import { PureTable } from '../store/table.state';

export interface AddTableUI {
  active: boolean;
  top: number;
  left: number;
  zIndex: number;
}

export interface AddTable {
  id: string;
  ui: AddTableUI;
}

export interface MoveTable {
  movementX: number;
  movementY: number;
  tableIds: string[];
  memoIds: string[];
}

export interface RemoveTable {
  tableIds: string[];
}

export interface SelectTable {
  ctrlKey: boolean;
  tableId: string;
  zIndex: number;
}

export interface ChangeTableValue {
  tableId: string;
  value: string;
  width: number;
}

export interface DragSelectTable {
  min: Point;
  max: Point;
}

export interface TableCommandMap {
  'table.add': AddTable;
  'table.move': MoveTable;
  'table.remove': RemoveTable;
  'table.select': SelectTable;
  'table.selectEnd': null;
  'table.selectAll': null;
  'table.changeName': ChangeTableValue;
  'table.changeComment': ChangeTableValue;
  'table.dragSelect': DragSelectTable;
  'table.sort': null;
  'table.load': PureTable;
}
