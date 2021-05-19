import { CanvasState } from './canvas.state';
import { TableState } from './table.state';
import { RelationshipState } from './relationship.state';
import { MemoState } from './memo.state';
import { EditorState } from './editor.state';
import { BatchCommand } from '../command';

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
  undo(): void;
  redo(): void;
}
