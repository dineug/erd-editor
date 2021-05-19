import { CommandTypeAll, BatchCommand } from '@@types/engine/command';
import { State } from '@@types/engine/store';
import { Helper } from '@@types/core/helper';
import { IStore } from '@/internal-types/store';
import { observable } from '@vuerd/lit-observable';
import { createCanvasState } from './canvas.state';
import { createTableState } from './table.state';
import { createRelationshipState } from './relationship.state';
import { createMemoState } from './memo.state';
import { createEditorState } from './editor.state';
import { createHistory } from '@/core/history';
import { createSubscriptionHelper, flat } from '@/core/helper';
import { createStream, executeCommand } from '@/engine/command';
import { executeHistoryCommand } from '@/engine/history';
import { useHooks } from '@/engine/hooks';
import { notEmptyCommands } from '@/core/operators/notEmptyCommands';
import { commandsFilter } from '@/core/operators/commandsFilter';
import { groupByStreamCommands } from '@/core/operators/groupByStreamCommands';
import { readonlyCommands } from '@/core/operators/readonlyCommands';
import { historyCommandTypes } from '@/engine/command/helper';
import { hasUndoRedo, focusTableEnd } from '@/engine/command/editor.cmd.helper';

const createState = (): State =>
  observable({
    canvasState: createCanvasState(),
    tableState: createTableState(),
    relationshipState: createRelationshipState(),
    memoState: createMemoState(),
    editorState: createEditorState(),
  });

export function createStore(helper: Helper): IStore {
  const subscriptionHelper = createSubscriptionHelper();
  const state = createState();
  const { dispatch$, history$, change$, hook$ } = createStream();
  const dispatch = (...commands: BatchCommand) =>
    queueMicrotask(() => dispatch$.next([...flat<CommandTypeAll>(commands)]));
  const history = createHistory(() =>
    dispatch(hasUndoRedo(history.hasUndo(), history.hasRedo()))
  );

  const undo = () => {
    if (!history.hasUndo() || state.editorState.readonly) return;
    dispatch(focusTableEnd());
    history.undo();
  };

  const redo = () => {
    if (!history.hasRedo() || state.editorState.readonly) return;
    dispatch(focusTableEnd());
    history.redo();
  };

  const destroy = () => {
    subscriptionHelper.destroy();
    history.clear();
  };

  const store: IStore = {
    ...state,
    dispatch,
    undo,
    redo,
    history$,
    change$,
    destroy,
  };

  const command = executeCommand(state);
  const historyCommand = executeHistoryCommand(store, history);

  subscriptionHelper.push(
    history$.pipe(notEmptyCommands).subscribe(command),
    dispatch$
      .pipe(
        readonlyCommands(state),
        commandsFilter(historyCommandTypes),
        groupByStreamCommands
      )
      .subscribe(historyCommand),
    dispatch$.pipe(readonlyCommands(state)).subscribe(command),
    ...useHooks(hook$, state, helper)
  );

  return store;
}
