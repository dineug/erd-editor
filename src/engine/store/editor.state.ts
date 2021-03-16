import {
  EditorState,
  MoveKey,
  TableType,
} from '@@types/engine/store/editor.state';
import { DEFAULT_WIDTH, DEFAULT_HEIGHT } from '@/core/layout';

export const createEditorState = (): EditorState => ({
  panels: [],
  hasUndo: false,
  hasRedo: false,
  focusTable: null,
  drawRelationship: null,
  draggableColumn: null,
  viewport: {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  },
});

export const moveKeys: MoveKey[] = [
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'Tab',
];

export const tableTypes: TableType[] = ['tableName', 'tableComment'];
