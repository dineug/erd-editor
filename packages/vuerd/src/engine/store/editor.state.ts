import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '@/core/layout';
import {
  EditorState,
  MoveKey,
  TableType,
} from '@@types/engine/store/editor.state';

import { createFilterState } from './editor/filter.state';

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
  copyColumns: [],
  findActive: false,
  readonly: false,
  filterState: createFilterState(),
});

export const moveKeys: MoveKey[] = [
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'Tab',
];

export const tableTypes: TableType[] = ['tableName', 'tableComment'];
