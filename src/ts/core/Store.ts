import { Subject, Subscription, asapScheduler } from "rxjs";
import { CanvasState, createCanvasState } from "./store/Canvas";
import { TableState, createTableState } from "./store/Table";
import { MemoState, createMemoState } from "./store/Memo";
import {
  RelationshipState,
  createRelationshipState,
} from "./store/Relationship";
import { EditorState, createEditorState } from "./store/Editor";
import { Command, CommandType, commandExecute } from "./Command";
import { createObservable } from "./Observable";

export class Store {
  readonly canvasState: CanvasState;
  readonly tableState: TableState;
  readonly memoState: MemoState;
  readonly relationshipState: RelationshipState;
  readonly editorState: EditorState;
  private dispatch$ = new Subject<Array<Command<CommandType>>>();
  private next$ = new Subject<Array<Command<CommandType>>>();
  private subscriptionList: Subscription[] = [];
  private rawToProxy = new WeakMap();
  private proxyToRaw = new WeakMap();
  private proxyToObservable = new WeakMap<
    object,
    Subject<string | number | symbol>
  >();
  private excludeKeys: string[] = [
    "_store",
    "_subscriptionList",
    "_currentFocusColumn",
    "focusColumns",
  ];

  constructor() {
    this.canvasState = createObservable(
      createCanvasState(),
      this.rawToProxy,
      this.proxyToRaw,
      this.effect,
      this.excludeKeys
    );
    this.tableState = createObservable(
      createTableState(),
      this.rawToProxy,
      this.proxyToRaw,
      this.effect,
      this.excludeKeys
    );
    this.memoState = createObservable(
      createMemoState(),
      this.rawToProxy,
      this.proxyToRaw,
      this.effect,
      this.excludeKeys
    );
    this.relationshipState = createObservable(
      createRelationshipState(),
      this.rawToProxy,
      this.proxyToRaw,
      this.effect,
      this.excludeKeys
    );
    this.editorState = createObservable(
      createEditorState(),
      this.rawToProxy,
      this.proxyToRaw,
      this.effect,
      this.excludeKeys
    );
    this.subscriptionList.push(
      this.dispatch$.subscribe((commands) => commandExecute(this, commands)),
      this.next$.subscribe((commands) => commandExecute(this, commands))
    );
  }

  dispatch(...commands: Array<Command<CommandType>>) {
    asapScheduler.schedule(() => this.dispatch$.next(commands));
  }

  subscribe(
    effect: (commands: Array<Command<CommandType>>) => void
  ): Subscription {
    const subDispatch = this.dispatch$.subscribe(effect);
    this.subscriptionList.push(subDispatch);
    return subDispatch;
  }

  next(commands: Array<Command<CommandType>>) {
    asapScheduler.schedule(() => this.next$.next(commands));
  }

  destroy() {
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
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
