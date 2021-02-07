import { Memo, MemoUI } from '@@types/engine/store/memo.state';
import { AddMemo } from '@@types/engine/command/memo.command';

interface MemoData {
  addMemo?: AddMemo;
  loadMemo?: Memo;
}

export class MemoModel implements Memo {
  id: string;
  value = '';
  ui: MemoUI;

  constructor(data: MemoData) {
    const { addMemo, loadMemo } = data;

    if (addMemo) {
      const { id, ui } = addMemo;
      this.id = id;
      this.ui = Object.assign({}, ui);
    } else if (
      loadMemo &&
      typeof loadMemo.id === 'string' &&
      typeof loadMemo.value === 'string' &&
      typeof loadMemo.ui === 'object' &&
      loadMemo.ui !== null &&
      typeof loadMemo.ui.active === 'boolean' &&
      typeof loadMemo.ui.top === 'number' &&
      typeof loadMemo.ui.left === 'number' &&
      typeof loadMemo.ui.width === 'number' &&
      typeof loadMemo.ui.height === 'number' &&
      typeof loadMemo.ui.zIndex === 'number'
    ) {
      const { id, value, ui } = loadMemo;
      this.id = id;
      this.value = value;
      this.ui = Object.assign({}, ui);
    } else {
      throw new Error('not found memo');
    }
  }
}
