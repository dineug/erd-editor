import { CommandKey, CommandType } from '@@types/engine/command';
import { IStore } from '@/internal-types/store';
import { observable } from '@dineug/lit-observable';
import { createCanvasState } from './canvas.state';
import { createTableState } from './table.state';
import { createRelationshipState } from './relationship.state';
import { createMemoState } from './memo.state';
import { createEditorState } from './editor.state';
import { createShareState } from './share.state';
import { createUndoManager } from '@/core/UndoManager';
import { createStream } from '@/engine/command';

export const createState = () => ({
  canvasState: observable(createCanvasState()),
  tableState: observable(createTableState()),
  relationshipState: observable(createRelationshipState()),
  memoState: observable(createMemoState()),
  editorState: observable(createEditorState()),
  shareState: observable(createShareState()),
});

export function createStore(): IStore {
  const state = createState();
  const stream = createStream();
  const { undo, redo } = createUndoManager(() => {});

  const dispatch = <K extends CommandKey>(
    ...commands: Array<
      CommandType<K> | Generator<CommandType<K>, CommandType<K>>
    >
  ) =>
    stream.dispatch$.next(
      commands.reduce<Array<CommandType<K>>>(
        (acc, cur: any) => [
          ...acc,
          ...(cur[Symbol.iterator] ? [...cur] : [cur]),
        ],
        []
      )
    );

  return {
    ...state,
    dispatch,
    undo,
    redo,
    destroy() {},
  };
}
