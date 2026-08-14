import { describe, expect, it } from 'vitest';

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
  MoveKey,
  SelectType,
} from '@/engine/modules/editor/state';
import { createStore } from '@/engine/store';

describe('editor/state', () => {
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
      expect(editor.drawRelationship).toBeNull();
      expect(editor.hoverColumnMap).toEqual({});
      expect(editor.hoverRelationshipMap).toEqual({});
      expect(editor.openMap).toEqual({});
      expect(editor.draggableColumn).toBeNull();
      expect(editor.draggingColumnMap).toEqual({});
      expect(editor.sharedMouseTrackerMap).toEqual({});
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

      expect(b.selectedMap).toEqual({});
      expect(b.viewport.width).toBe(DEFAULT_WIDTH);
      expect(b.hoverColumnMap).toEqual({});
      expect(b.openMap).toEqual({});
      expect(b.draggingColumnMap).toEqual({});
      expect(b.hoverRelationshipMap).toEqual({});
      expect(b.sharedMouseTrackerMap).toEqual({});
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
