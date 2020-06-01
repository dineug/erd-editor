import { Subject, Subscription, asapScheduler, merge, Observable } from "rxjs";
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
import { ShareState, createShareState } from "./store/Share";
import {
  Command,
  CommandType,
  User,
  executeCommand,
  changeCommandTypes,
  undoCommandTypes,
  streamCommandTypes,
  shareCommandTypes,
} from "./Command";
import { createObservable, observeLegacy } from "./Observable";
import { UndoManager } from "./UndoManager";
import { executeUndoCommand } from "./UndoCommand";
import { executeShareCommand } from "./ShareCommand";
import { hasUndoRedo, focusTableEnd } from "./command/editor";
import { uuid } from "./Helper";

export class Store {
  readonly canvasState: CanvasState;
  readonly tableState: TableState;
  readonly memoState: MemoState;
  readonly relationshipState: RelationshipState;
  readonly editorState: EditorState;
  readonly shareState: ShareState;
  readonly dispatch$ = new Subject<Array<Command<CommandType>>>();
  readonly undo$ = new Subject<Array<Command<CommandType>>>();
  readonly change$: Observable<Array<Command<CommandType>>>;
  readonly share$: Observable<Array<Command<CommandType>>>;
  readonly user: User = {
    id: uuid(),
    name: "user",
  };
  private subscriptionList: Subscription[] = [];
  private excludeKeys: string[] = [
    "_store",
    "_subscription",
    "_subscriptionList",
    "_currentFocusColumn",
    "_currentFilterState",
    "focusColumns",
    "focusFilterStateList",
  ];
  private undoManager: UndoManager;

  constructor() {
    this.canvasState = createObservable(createCanvasState(), this.excludeKeys);
    this.tableState = createObservable(createTableState(), this.excludeKeys);
    this.memoState = createObservable(createMemoState(), this.excludeKeys);
    this.relationshipState = createObservable(
      createRelationshipState(),
      this.excludeKeys
    );
    this.editorState = createObservable(createEditorState(), this.excludeKeys);
    this.shareState = createObservable(createShareState(), this.excludeKeys);

    this.undoManager = new UndoManager(this.hasUndoRedo);

    this.subscriptionList.push(
      this.undo$.subscribe((commands) => executeCommand(this, commands)),
      this.dispatch$
        .pipe(
          filter(
            (commands) =>
              this.editorState.undoManager &&
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
        .subscribe((commands) =>
          executeUndoCommand(this, this.undoManager, commands)
        ),
      this.dispatch$.subscribe((commands) => executeCommand(this, commands))
    );

    this.change$ = merge(
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
    ).pipe(debounceTime(200));

    this.share$ = this.dispatch$.pipe(
      filter(
        (commands) =>
          commands.some((command) => command.user === undefined) &&
          commands.some((command) =>
            shareCommandTypes.some(
              (commandType) => commandType === command.type
            )
          )
      ),
      map((commands) => executeShareCommand(commands, this.user))
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
    observer: (name: string | number | symbol) => void
  ): Subscription {
    return observeLegacy(proxy, observer);
  }

  undo() {
    if (this.undoManager.hasUndo && this.editorState.undoManager) {
      this.dispatch(focusTableEnd());
      this.undoManager.undo();
    }
  }

  redo() {
    if (this.undoManager.hasRedo && this.editorState.undoManager) {
      this.dispatch(focusTableEnd());
      this.undoManager.redo();
    }
  }

  private hasUndoRedo = () => {
    this.dispatch(
      hasUndoRedo(this.undoManager.hasUndo, this.undoManager.hasRedo)
    );
  };
}
