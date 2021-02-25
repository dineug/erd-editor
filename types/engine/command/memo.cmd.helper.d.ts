import { Store } from '../store';
import { CommandType } from './index';
import { Memo } from '../store/memo.state';
import { Point } from '../store/relationship.helper';

export * from './memo.cmd.helper.gen';

export declare function addMemo(
  store: Store,
  active?: boolean
): CommandType<'memo.add'>;

export declare function moveMemo(
  store: Store,
  ctrlKey: boolean,
  movementX: number,
  movementY: number,
  memoId: string
): CommandType<'memo.move'>;

export declare function removeMemo(
  store: Store,
  memoId?: string
): CommandType<'memo.remove'>;

export declare function selectMemo(
  store: Store,
  ctrlKey: boolean,
  memoId: string
): CommandType<'memo.select'>;

export declare function selectEndMemo(): CommandType<'memo.selectEnd'>;

export declare function selectAllMemo(): CommandType<'memo.selectAll'>;

export declare function changeMemoValue(
  memoId: string,
  value: string
): CommandType<'memo.changeValue'>;

export declare function resizeMemo(
  memoId: string,
  top: number,
  left: number,
  width: number,
  height: number
): CommandType<'memo.resize'>;

export declare function dragSelectMemo(
  min: Point,
  max: Point
): CommandType<'memo.dragSelect'>;

export declare function loadMemo(memo: Memo): CommandType<'memo.load'>;
