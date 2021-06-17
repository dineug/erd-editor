import { BatchCommand } from '../command';
import { CanvasState } from './canvas.state';
import { EditorState } from './editor.state';
import { MemoState } from './memo.state';
import { RelationshipState } from './relationship.state';
import { TableState } from './table.state';

export interface State {
  readonly canvasState: CanvasState;
  readonly tableState: TableState;
  readonly memoState: MemoState;
  readonly relationshipState: RelationshipState;
  readonly editorState: EditorState;
}

export interface Store extends State {
  dispatch(...commands: BatchCommand): void;
  dispatch(...commands: unknown[]): void;
  dispatchSync(...commands: BatchCommand): void;
  dispatchSync(...commands: unknown[]): void;
  undo(): void;
  redo(): void;
}

export interface ExportedStore {
  canvas: CanvasState;
  table: TableState;
  memo: MemoState;
  relationship: RelationshipState;
}
