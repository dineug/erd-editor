import { Subject, Subscription, asapScheduler } from "rxjs";
import { CanvasState, createCanvasState } from "./Canvas";
import { TableState, createTableState } from "./Table";
import { Command } from "./Command";
import { getData } from "@src/helper/util";

export class Store {
  readonly canvasState: CanvasState;
  readonly tableState: TableState;
  readonly dispatch$: Subject<Command>;
  private subDispatch: Subscription;

  constructor() {
    this.canvasState = createCanvasState();
    this.tableState = createTableState();
    this.dispatch$ = new Subject();
    this.subDispatch = this.dispatch$.subscribe(this.onCommand);
  }

  private onCommand(command: Command) {
    switch (command.name) {
      case "tableMove":
        const table = getData(this.tableState.tables, command.data.tableId);
        if (table) {
          table.ui.left = command.data.left;
          table.ui.top = command.data.top;
          command.effect();
        }
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
