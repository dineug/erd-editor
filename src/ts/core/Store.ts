import { Subject, Subscription, asapScheduler } from "rxjs";
import { CanvasState, createCanvasState } from "./store/Canvas";
import { TableState, createTableState } from "./store/Table";
import { MemoState, createMemoState } from "./store/Memo";
import { Command, commandExecute } from "./Command";
import { observable } from "./helper/Observable";

export class Store {
  readonly canvasState: CanvasState;
  readonly tableState: TableState;
  readonly memoState: MemoState;
  readonly dispatch$: Subject<Command>;
  private subDispatch: Subscription;
  private rawToProxy = new WeakMap();
  private proxyToRaw = new WeakMap();
  private proxyToObservable = new WeakMap<object, Subject<void>>();

  constructor() {
    this.canvasState = observable(
      createCanvasState(),
      this.rawToProxy,
      this.proxyToRaw,
      (raw, field) => this.effect(raw, field)
    );
    this.tableState = observable(
      createTableState(),
      this.rawToProxy,
      this.proxyToRaw,
      (raw, field) => this.effect(raw, field)
    );
    this.memoState = observable(
      createMemoState(),
      this.rawToProxy,
      this.proxyToRaw,
      (raw, field) => this.effect(raw, field)
    );
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

  observe(proxy: any, effect: () => void) {
    let observable$ = this.proxyToObservable.get(proxy);
    if (!observable$) {
      observable$ = new Subject();
      this.proxyToObservable.set(proxy, observable$);
    }
    return observable$.subscribe(effect);
  }

  private effect(raw: any, field: string | number | symbol) {
    const proxy = this.rawToProxy.get(raw);
    if (proxy) {
      const observable$ = this.proxyToObservable.get(proxy);
      if (observable$) {
        observable$.next();
      }
    }
  }
}
