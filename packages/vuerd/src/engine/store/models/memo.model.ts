import { Memo, MemoUI } from '@@types/engine/store/memo.state';
import { AddMemo } from '@@types/engine/command/memo.cmd';
import {
  isString,
  isObject,
  isBoolean,
  isNumber,
  cloneDeep,
} from '@/core/helper';
import {
  SIZE_START_X,
  SIZE_START_Y,
  SIZE_MEMO_WIDTH,
  SIZE_MEMO_HEIGHT,
} from '@/core/layout';

interface MemoData {
  addMemo?: AddMemo;
  loadMemo?: Memo;
}

const isLoadMemo = (loadMemo: Memo) =>
  isString(loadMemo.id) &&
  isString(loadMemo.value) &&
  isObject(loadMemo.ui) &&
  isBoolean(loadMemo.ui.active) &&
  isNumber(loadMemo.ui.top) &&
  isNumber(loadMemo.ui.left) &&
  isNumber(loadMemo.ui.width) &&
  isNumber(loadMemo.ui.height) &&
  isNumber(loadMemo.ui.zIndex);

export class MemoModel implements Memo {
  id: string;
  value = '';
  ui: MemoUI = {
    active: false,
    left: SIZE_START_X,
    top: SIZE_START_Y,
    zIndex: 2,
    width: SIZE_MEMO_WIDTH,
    height: SIZE_MEMO_HEIGHT,
  };

  constructor({ addMemo, loadMemo }: MemoData) {
    if (addMemo) {
      const { id, ui } = addMemo;

      this.id = id;
      this.ui = Object.assign(this.ui, ui);
    } else if (loadMemo && isLoadMemo(loadMemo)) {
      const { id, value, ui } = cloneDeep(loadMemo);

      this.id = id;
      this.value = value;
      this.ui = Object.assign(this.ui, ui);
    } else {
      throw new Error('not found memo');
    }
  }
}
