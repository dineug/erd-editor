import { Subject, Subscription, asapScheduler } from "rxjs";
import { CanvasState, createCanvasState } from "./store/Canvas";
import { TableState, createTableState } from "./store/Table";
import { MemoState, createMemoState } from "./store/Memo";
import { Command } from "./Command";
import { getData } from "@src/core/Helper";

export class Store {
  readonly canvasState: CanvasState;
  readonly tableState: TableState;
  readonly memoState: MemoState;
  readonly dispatch$: Subject<Command>;
  private subDispatch: Subscription;

  constructor() {
    this.canvasState = createCanvasState();
    this.tableState = createTableState();
    this.memoState = createMemoState();
    this.dispatch$ = new Subject();
    this.subDispatch = this.dispatch$.subscribe(command =>
      this.onCommand(command)
    );
  }

  private onCommand(command: Command) {
    switch (command.name) {
      case "table.move":
        command.data.tableIds.forEach(tableId => {
          const table = getData(this.tableState.tables, tableId);
          if (table) {
            table.ui.left += command.data.movementX;
            table.ui.top += command.data.movementY;
          }
        });
        command.data.memoIds.forEach(memoId => {
          const memo = getData(this.memoState.memos, memoId);
          if (memo) {
            memo.ui.left += command.data.movementX;
            memo.ui.top += command.data.movementY;
          }
        });
        command.effect();
        break;
    }
  }

  dispatch(command: Command) {
    asapScheduler.schedule(() => {
      this.dispatch$.next(command);
    });
  }

  destroy() {
    this.subDispatch.unsubscribe();
  }
}
