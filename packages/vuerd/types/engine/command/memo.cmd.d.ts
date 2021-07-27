import { Memo, MemoUI } from '../store/memo.state';
import { Point } from '../store/relationship.state';

export interface AddMemo {
  id: string;
  ui: MemoUI;
}

export interface MoveMemo {
  movementX: number;
  movementY: number;
  tableIds: string[];
  memoIds: string[];
}

export interface RemoveMemo {
  memoIds: string[];
}

export interface SelectMemo {
  ctrlKey: boolean;
  memoId: string;
  zIndex: number;
}

export interface ChangeMemoValue {
  memoId: string;
  value: string;
}

export interface ResizeMemo {
  memoId: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface DragSelectMemo {
  min: Point;
  max: Point;
}

export interface ChangeColorMemo {
  tableIds: string[];
  memoIds: string[];
  color: string;
}

export interface MemoCommandMap {
  'memo.add': AddMemo;
  'memo.move': MoveMemo;
  'memo.remove': RemoveMemo;
  'memo.select': SelectMemo;
  'memo.selectEnd': null;
  'memo.selectAll': null;
  'memo.changeValue': ChangeMemoValue;
  'memo.resize': ResizeMemo;
  'memo.dragSelect': DragSelectMemo;
  'memo.load': Memo;
  'memo.changeColor': ChangeColorMemo;
}
