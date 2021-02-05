import { CommandTypeAll, CommandTypeAny } from '@@types/engine/command';
import { State } from '@@types/engine/store';
import { IStore } from '@/internal-types/store';
import { observable } from '@dineug/lit-observable';
import { createCanvasState } from './canvas.state';
import { createTableState } from './table.state';
import { createRelationshipState } from './relationship.state';
import { createMemoState } from './memo.state';
import { createEditorState } from './editor.state';
import { createShareState } from './share.state';
import { createUndoManager } from '@/core/UndoManager';
import { createStream, executeCommand } from '@/engine/command';

const createState = (): State => ({
  canvasState: observable(createCanvasState()),
  tableState: observable(createTableState()),
  relationshipState: observable(createRelationshipState()),
  memoState: observable(createMemoState()),
  editorState: observable(createEditorState()),
  shareState: observable(createShareState()),
});

const mergeIterator = (
  acc: Array<CommandTypeAll>,
  cur: any
): CommandTypeAll[] => [...acc, ...(cur[Symbol.iterator] ? [...cur] : [cur])];

export function createStore(): IStore {
  const state = createState();
  const stream = createStream();
  const { undo, redo } = createUndoManager(() => {});

  const dispatch = (...commands: CommandTypeAny[]) =>
    stream.dispatch$.next(
      commands.reduce<Array<CommandTypeAll>>(mergeIterator, [])
    );

  stream.undo$.subscribe(commands => executeCommand(state, commands));
  // TODO: executeUndoCommand
  stream.dispatch$.subscribe(commands => executeCommand(state, commands));

  return {
    ...state,
    dispatch,
    undo,
    redo,
    destroy() {},
  };
}
