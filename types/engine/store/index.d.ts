import { CanvasState } from './canvas.state';
import { TableState } from './table.state';
import { RelationshipState } from './relationship.state';
import { MemoState } from './memo.state';
import { EditorState } from './editor.state';
import { ShareState } from './share.state';
import { CommandKey, CommandType, CommandTypeAny } from '../command';

export interface Store {
  readonly canvasState: CanvasState;
  readonly tableState: TableState;
  readonly memoState: MemoState;
  readonly relationshipState: RelationshipState;
  readonly editorState: EditorState;
  readonly shareState: ShareState;
  dispatch<K extends CommandKey>(
    ...commands: Array<
      CommandType<K> | Generator<CommandType<K>, CommandType<K>>
    >
  ): void;
  dispatch(...commands: Array<CommandTypeAny>): void;
  undo(): void;
  redo(): void;
}
