import { Subject, Subscription, asapScheduler } from "rxjs";
import { filter, debounceTime } from "rxjs/operators";
import { CanvasState, createCanvasState } from "./store/Canvas";
import { TableState, createTableState } from "./store/Table";
import { MemoState, createMemoState } from "./store/Memo";
import {
  RelationshipState,
  createRelationshipState,
} from "./store/Relationship";
import { EditorState, createEditorState } from "./store/Editor";
import {
  Command,
  CommandType,
  executeCommand,
  changeCommandTypes,
} from "./Command";
import { createObservable } from "./Observable";
import { createJsonFormat } from "./File";

export class Store {
  readonly canvasState: CanvasState;
  readonly tableState: TableState;
  readonly memoState: MemoState;
  readonly relationshipState: RelationshipState;
  readonly editorState: EditorState;
  readonly dispatch$ = new Subject<Array<Command<CommandType>>>();
  readonly change$ = new Subject<string>();
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
    "_currentFilterState",
    "focusFilterStateList",
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
      this.dispatch$.subscribe((commands) => executeCommand(this, commands)),
      this.dispatch$
        .pipe(
          filter((commands) =>
            commands.some((command) =>
              changeCommandTypes.some(
                (commandType) => commandType === command.type
              )
            )
          ),
          debounceTime(200)
        )
        .subscribe(() => {
          this.change$.next(
            JSON.stringify(createJsonFormat(this), (key, value) => {
              if (key === "_show") {
                return undefined;
              }
              return value;
            })
          );
        })
    );
  }

  dispatch(...commands: Array<Command<CommandType>>) {
    asapScheduler.schedule(() => this.dispatch$.next(commands));
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
