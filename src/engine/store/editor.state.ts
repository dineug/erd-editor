import {
  EditorState,
  MoveKey,
  TableType,
} from '@@types/engine/store/editor.state';

export const createEditorState = (): EditorState => ({
  panels: [],
  hasUndo: false,
  hasRedo: false,
  focusTable: null,
  drawRelationship: null,
  draggableColumn: null,
});

export const moveKeys: MoveKey[] = [
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'Tab',
];

export const tableTypes: TableType[] = ['tableName', 'tableComment'];
