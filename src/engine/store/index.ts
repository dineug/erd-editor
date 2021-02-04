import { IStore } from '@/internal-types/store';
import { observable } from '@dineug/lit-observable';
import { createCanvasState } from './canvas.state';
import { createTableState } from './table.state';
import { createRelationshipState } from './relationship.state';
import { createMemoState } from './memo.state';
import { createEditorState } from './editor.state';
import { createShareState } from './share.state';
import { createUndoManager } from '@/core/UndoManager';

export function createStore(): IStore {
  const { undo, redo } = createUndoManager(() => {});

  return {
    canvasState: observable(createCanvasState()),
    tableState: observable(createTableState()),
    relationshipState: observable(createRelationshipState()),
    memoState: observable(createMemoState()),
    editorState: observable(createEditorState()),
    shareState: observable(createShareState()),
    dispatch() {},
    undo,
    redo,
    destroy() {},
  };
}
