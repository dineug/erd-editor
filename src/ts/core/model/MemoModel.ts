import { Memo, MemoUI } from "../store/Memo";
import { AddMemo } from "../command/memo";

interface MemoData {
  addMemo?: AddMemo;
}

export class MemoModel implements Memo {
  id: string;
  value = "";
  ui: MemoUI;

  constructor(data: MemoData) {
    const { addMemo } = data;
    if (addMemo) {
      const { id, ui } = addMemo;
      this.id = id;
      this.ui = Object.assign({}, ui);
    } else {
      throw new Error("not found memo");
    }
  }
}
