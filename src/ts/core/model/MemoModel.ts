import { Memo, MemoUI } from "../store/Memo";
import { AddMemo } from "../command/memo";

export class MemoModel implements Memo {
  id: string;
  value = "";
  ui: MemoUI;

  constructor(data: { addMemo?: AddMemo }) {
    const { addMemo } = data;
    if (addMemo) {
      const { id, ui } = addMemo;
      this.id = id;
      this.ui = ui;
    } else {
      throw new Error("not found memo");
    }
  }
}
