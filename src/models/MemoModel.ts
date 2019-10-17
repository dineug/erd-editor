import { SIZE_MEMO_WIDTH, SIZE_MEMO_HEIGHT } from '@/ts/layout'
import { uuid } from '@/ts/util'
import { Memo, MemoUI } from '@/store/memo'
import StoreManagement from '@/store/StoreManagement'
import { zIndexNext, pointNext } from '@/store/table/tableHelper'

export default class MemoModel implements Memo {
  public id: string
  public value: string = ''
  public ui: MemoUI
  private store: StoreManagement

  constructor (store: StoreManagement) {
    this.store = store
    this.id = uuid()
    const point = pointNext(store, store.tableStore.state.tables, store.memoStore.state.memos)
    this.ui = {
      active: true,
      top: point.top,
      left: point.left,
      width: SIZE_MEMO_WIDTH,
      height: SIZE_MEMO_HEIGHT,
      zIndex: zIndexNext(store.tableStore.state.tables, store.memoStore.state.memos)
    }
  }
}
