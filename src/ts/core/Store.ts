import { Subject, Subscription, asapScheduler } from "rxjs";
import { CanvasState, createCanvasState } from "./store/Canvas";
import { TableState, createTableState } from "./store/Table";
import { MemoState, createMemoState } from "./store/Memo";
import { Command, commandExecute } from "./Command";

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
      commandExecute(this, command)
    );
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
