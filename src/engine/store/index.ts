import { CommandTypeAll, BatchCommand } from '@@types/engine/command';
import { State } from '@@types/engine/store';
import { IStore } from '@/internal-types/store';
import { observable } from '@dineug/lit-observable';
import { createCanvasState } from './canvas.state';
import { createTableState } from './table.state';
import { createRelationshipState } from './relationship.state';
import { createMemoState } from './memo.state';
import { createEditorState } from './editor.state';
import { createHistory } from '@/core/history';
import { createSubscriptionHelper, flat } from '@/core/helper';
import { createStream, executeCommand } from '@/engine/command';
import { executeHistoryCommand } from '@/engine/history';
import { notEmptyCommands } from '@/core/operators/notEmptyCommands';
import { commandsFilter } from '@/core/operators/commandsFilter';
import { groupByStreamCommands } from '@/core/operators/groupByStreamCommands';
import { historyCommandTypes } from '@/engine/command/helper';
import { hasUndoRedo, focusTableEnd } from '@/engine/command/editor.cmd.helper';

const createState = (): State => ({
  canvasState: observable(createCanvasState()),
  tableState: observable(createTableState()),
  relationshipState: observable(createRelationshipState()),
  memoState: observable(createMemoState()),
  editorState: observable(createEditorState()),
});

export function createStore(): IStore {
  const subscriptionHelper = createSubscriptionHelper();
  const state = createState();
  const { dispatch$, history$, change$ } = createStream();
  const dispatch = (...commands: BatchCommand) =>
    queueMicrotask(() => dispatch$.next([...flat<CommandTypeAll>(commands)]));
  const history = createHistory(() =>
    dispatch(hasUndoRedo(history.hasUndo(), history.hasRedo()))
  );

  const undo = () => {
    if (!history.hasUndo()) return;
    dispatch(focusTableEnd());
    history.undo();
  };

  const redo = () => {
    if (!history.hasRedo()) return;
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
        notEmptyCommands,
        commandsFilter(historyCommandTypes),
        groupByStreamCommands
      )
      .subscribe(historyCommand),
    dispatch$.pipe(notEmptyCommands).subscribe(command)
  );

  return store;
}
