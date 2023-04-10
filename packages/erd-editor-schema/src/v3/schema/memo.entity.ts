export interface Memo {
  id: string;
  value: string;
  ui: MemoUI;
}

export interface MemoUI {
  top: number;
  left: number;
  width: number;
  height: number;
  zIndex: number;
  color: string;
}
