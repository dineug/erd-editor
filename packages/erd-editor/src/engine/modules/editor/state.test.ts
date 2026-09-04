import { describe, expect, it } from 'vite-plus/test';

import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '@/constants/layout';
import { Clock } from '@/engine/clock';
import {
  changeViewportAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import {
  createEditor,
  FocusType,
  hasMoveKeys,
  isEditingMemo,
  isEditingText,
  MoveKey,
  SelectType,
} from '@/engine/modules/editor/state';
import { createStore } from '@/engine/store';

const focusTable = (edit: boolean) => ({
  tableId: 't1',
  columnId: null,
  focusType: FocusType.tableName,
  selectColumnIds: [],
  prevSelectColumnId: null,
  edit,
});

describe('editor/state', () => {
  describe('isEditingMemo', () => {
    it('is false while no memo body editor is open', () => {
      expect(isEditingMemo(createEditor())).toBe(false);
    });

    it('is true while one is, focused table or not', () => {
      const editor = createEditor();
      editor.editMemoId = 'm1';

      expect(isEditingMemo(editor)).toBe(true);

      editor.focusTable = focusTable(false);
      expect(isEditingMemo(editor)).toBe(true);
    });

    // The state the memo shortcuts used to leak through: a cell in edit mode is
    // a text editor too, but it is not the memo's, and the grid keys stay the
    // grid's while it owns them.
    it('is false while only a table cell is being edited', () => {
      const editor = createEditor();
      editor.focusTable = focusTable(true);

      expect(isEditingMemo(editor)).toBe(false);
    });
  });

  describe('isEditingText', () => {
    it('is false while nothing over the scene holds a caret', () => {
      expect(isEditingText(createEditor())).toBe(false);
    });

    it('is true while a memo body editor is open', () => {
      const editor = createEditor();
      editor.editMemoId = 'm1';

      expect(isEditingText(editor)).toBe(true);
    });

    it('is true while a table cell is in edit mode, false while merely focused', () => {
      const editor = createEditor();
      editor.focusTable = focusTable(false);

      expect(isEditingText(editor)).toBe(false);

      editor.focusTable.edit = true;
      expect(isEditingText(editor)).toBe(true);
    });

    // A memo opened over a focused table leaves both set at once, which is the
    // state every table shortcut used to read as "nothing is being edited".
    it('is true while a memo is open over a focused, unedited table', () => {
      const editor = createEditor();
      editor.focusTable = focusTable(false);
      editor.editMemoId = 'm1';

      expect(isEditingText(editor)).toBe(true);
    });
  });

  describe('createEditor', () => {
    it('creates an editor with the documented defaults', () => {
      const editor = createEditor();

      expect(typeof editor.id).toBe('string');
      expect(editor.id.length).toBeGreaterThan(0);
      expect(editor.selectedMap).toEqual({});
      expect(editor.hasUndo).toBe(false);
      expect(editor.hasRedo).toBe(false);
      expect(editor.viewport).toEqual({
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
      });
      expect(editor.focusTable).toBeNull();
      expect(editor.editMemoId).toBeNull();
      expect(editor.memoScrollTopMap).toEqual({});
      expect(editor.drawRelationship).toBeNull();
      expect(editor.hoverColumnMap).toEqual({});
      expect(editor.hoverRelationshipMap).toEqual({});
      expect(editor.openMap).toEqual({});
      expect(editor.draggableColumn).toBeNull();
      expect(editor.draggingColumnMap).toEqual({});
      expect(editor.sharedMouseTrackerMap).toEqual({});
      expect(editor.sharedFocusTrackerMap).toEqual({});
      expect(editor.sharedSelectionTrackerMap).toEqual({});
      expect(editor.sharedDragSelectTrackerMap).toEqual({});
      expect(editor.dragSelect).toBeNull();
    });

    it('gives each editor its own id and its own mutable containers', () => {
      const a = createEditor();
      const b = createEditor();

      expect(a.id).not.toBe(b.id);

      a.selectedMap['t1'] = SelectType.table;
      a.viewport.width = 1;
      a.hoverColumnMap['c1'] = true;
      a.openMap['o1'] = true;
      a.draggingColumnMap['c1'] = true;
      a.hoverRelationshipMap['r1'] = true;
      a.sharedMouseTrackerMap['e1'] = {
        id: 'e1',
        x: 0,
        y: 0,
        nickname: 'user',
        timeoutId: null,
      };
      a.sharedFocusTrackerMap['e1'] = {
        id: 'e1',
        tableId: 't1',
        columnId: 'c1',
        focusType: FocusType.columnName,
        timeoutId: null,
      };
      a.sharedSelectionTrackerMap['e1'] = {
        id: 'e1',
        selectedIds: ['m1', 't1'],
        timeoutId: null,
      };
      a.sharedDragSelectTrackerMap['e1'] = {
        id: 'e1',
        x: 10,
        y: 20,
        w: 200,
        h: 100,
        timeoutId: null,
      };
      a.dragSelect = { x: 5, y: 6, w: 70, h: 80 };

      expect(b.selectedMap).toEqual({});
      expect(b.viewport.width).toBe(DEFAULT_WIDTH);
      expect(b.hoverColumnMap).toEqual({});
      expect(b.openMap).toEqual({});
      expect(b.draggingColumnMap).toEqual({});
      expect(b.hoverRelationshipMap).toEqual({});
      expect(b.sharedMouseTrackerMap).toEqual({});
      expect(b.sharedFocusTrackerMap).toEqual({});
      expect(b.sharedSelectionTrackerMap).toEqual({});
      expect(b.sharedDragSelectTrackerMap).toEqual({});
      expect(b.dragSelect).toBeNull();
    });

    it('is the shape the real store starts from and mutates', () => {
      const store = createStore({
        toWidth: text => text.length * 10,
        clock: new Clock(),
      });

      expect(store.state.editor.viewport).toEqual({
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
      });
      expect(store.state.editor.selectedMap).toEqual({});

      store.dispatchSync(changeViewportAction({ width: 800, height: 600 }));
      store.dispatchSync(selectAction({ t1: SelectType.table }));

      expect(store.state.editor.viewport).toEqual({ width: 800, height: 600 });
      expect(store.state.editor.selectedMap).toEqual({ t1: SelectType.table });

      store.destroy();
    });
  });

  describe('constants', () => {
    it('SelectType values mirror their keys', () => {
      expect(SelectType).toEqual({ table: 'table', memo: 'memo' });
    });

    it('FocusType values mirror their keys', () => {
      for (const [key, value] of Object.entries(FocusType)) {
        expect(value).toBe(key);
      }
      expect(Object.keys(FocusType)).toHaveLength(9);
      expect(FocusType.tableName).toBe('tableName');
      expect(FocusType.columnAutoIncrement).toBe('columnAutoIncrement');
    });

    it('MoveKey values mirror their keys', () => {
      expect(MoveKey).toEqual({
        ArrowUp: 'ArrowUp',
        ArrowRight: 'ArrowRight',
        ArrowDown: 'ArrowDown',
        ArrowLeft: 'ArrowLeft',
        Tab: 'Tab',
      });
    });
  });

  describe('hasMoveKeys', () => {
    it('accepts every MoveKey value', () => {
      for (const key of Object.values(MoveKey)) {
        expect(hasMoveKeys(key)).toBe(true);
      }
    });

    it('rejects anything that is not a MoveKey', () => {
      expect(hasMoveKeys('Enter')).toBe(false);
      expect(hasMoveKeys('arrowup')).toBe(false);
      expect(hasMoveKeys('')).toBe(false);
    });
  });
});
