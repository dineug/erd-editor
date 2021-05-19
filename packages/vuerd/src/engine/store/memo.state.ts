import { MemoState } from '@@types/engine/store/memo.state';

export const createMemoState = (): MemoState => ({
  memos: [],
});
