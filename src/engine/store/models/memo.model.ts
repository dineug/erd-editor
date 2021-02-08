import { Memo, MemoUI } from '@@types/engine/store/memo.state';
import { AddMemo } from '@@types/engine/command/memo.command';
import { isString, isObject, isBoolean, isNumber } from '@/core/helper';

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
  ui: MemoUI;

  constructor({ addMemo, loadMemo }: MemoData) {
    if (addMemo) {
      const { id, ui } = addMemo;

      this.id = id;
      this.ui = Object.assign({}, ui);
    } else if (loadMemo && isLoadMemo(loadMemo)) {
      const { id, value, ui } = loadMemo;

      this.id = id;
      this.value = value;
      this.ui = Object.assign({}, ui);
    } else {
      throw new Error('not found memo');
    }
  }
}
