import { Subject, Subscription, asapScheduler, merge } from "rxjs";
import {
  filter,
  debounceTime,
  groupBy,
  mergeMap,
  buffer,
  map,
} from "rxjs/operators";
import { Logger } from "./Logger";
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
  undoCommandTypes,
  streamCommandTypes,
} from "./Command";
import { createObservable } from "./Observable";
import { UndoManager } from "./UndoManager";
import { executeUndoCommand } from "./UndoCommand";
import { hasUndoRedo, focusEndTable } from "./command/editor";

export class Store {
  readonly canvasState: CanvasState;
  readonly tableState: TableState;
  readonly memoState: MemoState;
  readonly relationshipState: RelationshipState;
  readonly editorState: EditorState;
  readonly dispatch$ = new Subject<Array<Command<CommandType>>>();
  readonly undo$ = new Subject<Array<Command<CommandType>>>();
  readonly change$ = new Subject();
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
  private undoManager: UndoManager;

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
    this.undoManager = new UndoManager(this.hasUndoRedo);
    this.subscriptionList.push(
      this.undo$.subscribe((commands) => executeCommand(this, commands)),
      this.dispatch$
        .pipe(
          filter((commands) =>
            commands.some((command) =>
              undoCommandTypes.some(
                (commandType) => commandType === command.type
              )
            )
          ),
          groupBy((commands) =>
            commands.some((command) =>
              streamCommandTypes.some(
                (commandType) => commandType === command.type
              )
            )
          ),
          mergeMap((group$) => {
            return group$.key
              ? group$.pipe(
                  buffer(group$.pipe(debounceTime(200))),
                  map((buff) =>
                    buff.reduce((acc, current) => {
                      acc.push(...current);
                      return acc;
                    })
                  )
                )
              : group$;
          })
        )
        .subscribe((commands) => {
          executeUndoCommand(this, this.undoManager, commands);
        }),
      this.dispatch$.subscribe((commands) => executeCommand(this, commands)),
      merge(
        this.undo$,
        this.dispatch$.pipe(
          filter((commands) =>
            commands.some((command) =>
              changeCommandTypes.some(
                (commandType) => commandType === command.type
              )
            )
          )
        )
      )
        .pipe(debounceTime(200))
        .subscribe(() => this.change$.next())
    );
  }

  dispatch(...commands: Array<Command<CommandType>>) {
    asapScheduler.schedule(() => this.dispatch$.next(commands));
  }

  destroy() {
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    this.undoManager.clear();
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

  undo() {
    if (this.undoManager.hasUndo) {
      this.dispatch(focusEndTable());
      this.undoManager.undo();
    }
  }

  redo() {
    if (this.undoManager.hasRedo) {
      this.dispatch(focusEndTable());
      this.undoManager.redo();
    }
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

  private hasUndoRedo = () => {
    this.dispatch(
      hasUndoRedo(this.undoManager.hasUndo, this.undoManager.hasRedo)
    );
  };
}
