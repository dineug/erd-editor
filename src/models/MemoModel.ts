import {SIZE_MEMO_WIDTH, SIZE_MEMO_HEIGHT} from '@/ts/layout';
import {uuid} from '@/ts/util';
import tableStore from '@/store/table';
import memoStore, {Memo, MemoUI} from '@/store/memo';
import {zIndexNext, pointNext} from '@/store/table/tableHandler';

export default class MemoModel implements Memo {
  public readonly id: string;
  public value: string = '';
  public ui: MemoUI;

  constructor() {
    this.id = uuid();
    const point = pointNext(tableStore.state.tables, memoStore.state.memos);
    this.ui = {
      active: true,
      top: point.top,
      left: point.left,
      width: SIZE_MEMO_WIDTH,
      height: SIZE_MEMO_HEIGHT,
      zIndex: zIndexNext(tableStore.state.tables, memoStore.state.memos),
    };
  }

}
