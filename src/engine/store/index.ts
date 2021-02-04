import { IStore } from '@/internal-types/store';
import { createCanvasState } from './canvas.state';
import { createTableState } from './table.state';
import { createRelationshipState } from './relationship.state';
import { createMemoState } from './memo.state';
import { createEditorState } from './editor.state';
import { createShareState } from './share.state';

export function createStore(): IStore {
  return {
    canvasState: createCanvasState(),
    tableState: createTableState(),
    relationshipState: createRelationshipState(),
    memoState: createMemoState(),
    editorState: createEditorState(),
    shareState: createShareState(),
    dispatch() {},
    undo() {},
    redo() {},
    destroy() {},
  };
}
