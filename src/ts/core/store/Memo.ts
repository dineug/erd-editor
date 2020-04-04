export interface MemoState {
  memos: Memo[];
}

export interface Memo {
  id: string;
  value: string;
  ui: MemoUI;
}

export interface MemoUI {
  active: boolean;
  top: number;
  left: number;
  width: number;
  height: number;
  zIndex: number;
}

export function createMemoState(): MemoState {
  return {
    memos: [],
  };
}
