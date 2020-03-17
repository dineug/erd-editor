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
  private dispatch$ = new Subject<Command>();
  private subDispatch: Subscription;
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

  observe(proxy: any, effect: (name: string | number | symbol) => void) {
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
        asapScheduler.schedule(() => {
          observable$.next(name);
        });
      }
    }
  };
}
