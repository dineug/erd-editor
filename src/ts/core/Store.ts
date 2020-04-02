import { Subject, Subscription, asapScheduler } from "rxjs";
import { CanvasState, createCanvasState } from "./store/Canvas";
import { TableState, createTableState } from "./store/Table";
import { MemoState, createMemoState } from "./store/Memo";
import { EditorState, createEditorState } from "./store/Editor";
import { Command, commandExecute } from "./Command";
import { createObservable } from "./helper/Observable";

export class Store {
  readonly canvasState: CanvasState;
  readonly tableState: TableState;
  readonly memoState: MemoState;
  readonly editorState: EditorState;
  private dispatch$ = new Subject<Array<Command>>();
  private subDispatchList: Subscription[] = [];
  private next$ = new Subject<Array<Command>>();
  private subNext: Subscription;
  private rawToProxy = new WeakMap();
  private proxyToRaw = new WeakMap();
  private proxyToObservable = new WeakMap<
    object,
    Subject<string | number | symbol>
  >();

  constructor() {
    this.canvasState = createObservable(
      createCanvasState(),
      this.rawToProxy,
      this.proxyToRaw,
      this.effect
    );
    this.tableState = createObservable(
      createTableState(),
      this.rawToProxy,
      this.proxyToRaw,
      this.effect
    );
    this.memoState = createObservable(
      createMemoState(),
      this.rawToProxy,
      this.proxyToRaw,
      this.effect
    );
    this.editorState = createObservable(
      createEditorState(),
      this.rawToProxy,
      this.proxyToRaw,
      this.effect
    );
    this.subDispatchList.push(
      this.dispatch$.subscribe(commands => commandExecute(this, commands))
    );
    this.subNext = this.next$.subscribe(commands =>
      commandExecute(this, commands)
    );
  }

  dispatch(...commands: Command[]) {
    asapScheduler.schedule(() => this.dispatch$.next(commands));
  }

  subscribe(effect: (commands: Command[]) => void): Subscription {
    const subDispatch = this.dispatch$.subscribe(effect);
    this.subDispatchList.push(subDispatch);
    return subDispatch;
  }

  next(commands: Command[]) {
    asapScheduler.schedule(() => this.next$.next(commands));
  }

  destroy() {
    this.subDispatchList.forEach(subDispatch => subDispatch.unsubscribe());
    this.subNext.unsubscribe();
  }

  observe(
    proxy: any,
    effect: (name: string | number | symbol) => void
  ): Subscription {
    let observable$ = this.proxyToObservable.get(proxy);
    if (!observable$) {
      observable$ = new Subject();
      this.proxyToObservable.set(proxy, observable$);
    }
    return observable$.subscribe(effect);
  }

  private effect = (raw: any, name: string | number | symbol) => {
    const proxy = this.rawToProxy.get(raw);
    if (proxy) {
      const observable$ = this.proxyToObservable.get(proxy);
      if (observable$) {
        asapScheduler.schedule(() => observable$.next(name));
      }
    }
  };
}
