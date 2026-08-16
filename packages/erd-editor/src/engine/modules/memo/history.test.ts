import { AnyAction } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import { ActionType } from '@/engine/modules/memo/actions';
import {
  addMemoAction,
  changeMemoColorAction,
  changeMemoValueAction,
  moveMemoAction,
  moveToMemoAction,
  removeMemoAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import {
  memoPushStreamHistoryMap,
  memoPushUndoHistoryMap,
} from '@/engine/modules/memo/history';
import { createStore, Store } from '@/engine/store';

function createTestStore(): Store {
  return createStore({ toWidth: text => text.length * 10, clock: new Clock() });
}

let store: Store;
let undoActions: AnyAction[];
let redoActions: AnyAction[];

beforeEach(() => {
  store = createTestStore();
  undoActions = [];
  redoActions = [];
});

describe('memoPushUndoHistoryMap', () => {
  it('registers undo builders only for add, remove, changeValue and moveTo', () => {
    expect(Object.keys(memoPushUndoHistoryMap).sort()).toEqual(
      [
        ActionType.addMemo,
        ActionType.removeMemo,
        ActionType.changeMemoValue,
        ActionType.moveToMemo,
      ].sort()
    );
  });

  describe('addMemo', () => {
    it('undoes an add with a remove of the same id', () => {
      memoPushUndoHistoryMap[ActionType.addMemo](
        undoActions,
        addMemoAction({ id: 'm1', ui: { x: 1, y: 2, zIndex: 3 } }),
        store.state
      );

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].type).toBe(ActionType.removeMemo);
      expect(undoActions[0].payload).toEqual({ id: 'm1' });
    });

    it('does not need the memo to exist in the collection', () => {
      memoPushUndoHistoryMap[ActionType.addMemo](
        undoActions,
        addMemoAction({ id: 'ghost', ui: { x: 0, y: 0, zIndex: 2 } }),
        store.state
      );

      expect(undoActions).toHaveLength(1);
    });
  });

  describe('removeMemo', () => {
    it('undoes a remove by re-adding with the captured x, y and zIndex only', () => {
      store.dispatchSync(
        addMemoAction({ id: 'm1', ui: { x: 11, y: 22, zIndex: 33 } })
      );
      store.dispatchSync(
        resizeMemoAction({ id: 'm1', x: 11, y: 22, width: 400, height: 500 })
      );

      memoPushUndoHistoryMap[ActionType.removeMemo](
        undoActions,
        removeMemoAction({ id: 'm1' }),
        store.state
      );

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].type).toBe(ActionType.addMemo);
      expect(undoActions[0].payload).toEqual({
        id: 'm1',
        ui: { x: 11, y: 22, zIndex: 33 },
      });
    });

    it('pushes nothing when the memo is unknown', () => {
      memoPushUndoHistoryMap[ActionType.removeMemo](
        undoActions,
        removeMemoAction({ id: 'ghost' }),
        store.state
      );

      expect(undoActions).toEqual([]);
    });
  });

  describe('changeMemoValue', () => {
    it('captures the value as it is before the change', () => {
      store.dispatchSync(
        addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } }),
        changeMemoValueAction({ id: 'm1', value: 'before' })
      );

      memoPushUndoHistoryMap[ActionType.changeMemoValue](
        undoActions,
        changeMemoValueAction({ id: 'm1', value: 'after' }),
        store.state
      );

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].type).toBe(ActionType.changeMemoValue);
      expect(undoActions[0].payload).toEqual({ id: 'm1', value: 'before' });
    });

    it('pushes nothing when the memo is unknown', () => {
      memoPushUndoHistoryMap[ActionType.changeMemoValue](
        undoActions,
        changeMemoValueAction({ id: 'ghost', value: 'x' }),
        store.state
      );

      expect(undoActions).toEqual([]);
    });
  });

  describe('moveToMemo', () => {
    it('captures the position as it is before the move', () => {
      store.dispatchSync(
        addMemoAction({ id: 'm1', ui: { x: 42, y: 43, zIndex: 2 } })
      );

      memoPushUndoHistoryMap[ActionType.moveToMemo](
        undoActions,
        moveToMemoAction({ id: 'm1', x: 0, y: 0 }),
        store.state
      );

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].type).toBe(ActionType.moveToMemo);
      expect(undoActions[0].payload).toEqual({ id: 'm1', x: 42, y: 43 });
    });

    it('pushes nothing when the memo is unknown', () => {
      memoPushUndoHistoryMap[ActionType.moveToMemo](
        undoActions,
        moveToMemoAction({ id: 'ghost', x: 1, y: 1 }),
        store.state
      );

      expect(undoActions).toEqual([]);
    });
  });
});

describe('memoPushStreamHistoryMap', () => {
  it('registers stream builders only for move, changeColor and resize', () => {
    expect(Object.keys(memoPushStreamHistoryMap).sort()).toEqual(
      [
        ActionType.moveMemo,
        ActionType.changeMemoColor,
        ActionType.resizeMemo,
      ].sort()
    );
  });

  describe('moveMemo', () => {
    const move = memoPushStreamHistoryMap[ActionType.moveMemo];

    it('ignores a stream without any move action', () => {
      move(undoActions, redoActions, [
        resizeMemoAction({ id: 'm1', x: 0, y: 0, width: 1, height: 1 }),
      ]);

      expect(undoActions).toEqual([]);
      expect(redoActions).toEqual([]);
    });

    it('accumulates the movement of one group and pushes an inverse undo', () => {
      move(undoActions, redoActions, [
        moveMemoAction({ ids: ['m1'], movementX: 10, movementY: 5 }),
        moveMemoAction({ ids: ['m1'], movementX: 10, movementY: 5 }),
      ]);

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].payload).toEqual({
        ids: ['m1'],
        movementX: -20,
        movementY: -10,
      });
      expect(redoActions).toHaveLength(1);
      expect(redoActions[0].payload).toEqual({
        ids: ['m1'],
        movementX: 20,
        movementY: 10,
      });
    });

    it('drops a group whose total manhattan movement is below 20', () => {
      move(undoActions, redoActions, [
        moveMemoAction({ ids: ['m1'], movementX: 9, movementY: 10 }),
      ]);

      expect(undoActions).toEqual([]);
      expect(redoActions).toEqual([]);
    });

    it('keeps a group whose total manhattan movement is exactly 20', () => {
      move(undoActions, redoActions, [
        moveMemoAction({ ids: ['m1'], movementX: -10, movementY: 10 }),
      ]);

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].payload).toEqual({
        ids: ['m1'],
        movementX: 10,
        movementY: -10,
      });
    });

    it('groups by the joined id list so different selections stay separate', () => {
      move(undoActions, redoActions, [
        moveMemoAction({ ids: ['m1'], movementX: 30, movementY: 0 }),
        moveMemoAction({ ids: ['m1', 'm2'], movementX: 0, movementY: 40 }),
        moveMemoAction({ ids: ['m1'], movementX: 5, movementY: 0 }),
      ]);

      expect(undoActions.map(it => it.payload)).toEqual([
        { ids: ['m1'], movementX: -35, movementY: -0 },
        { ids: ['m1', 'm2'], movementX: -0, movementY: -40 },
      ]);
    });
  });

  describe('changeMemoColor', () => {
    const changeColor = memoPushStreamHistoryMap[ActionType.changeMemoColor];

    it('ignores a stream without any color action', () => {
      changeColor(undoActions, redoActions, [
        moveMemoAction({ ids: ['m1'], movementX: 100, movementY: 100 }),
      ]);

      expect(undoActions).toEqual([]);
      expect(redoActions).toEqual([]);
    });

    it('collapses a color stream into the first prevColor and the last color', () => {
      changeColor(undoActions, redoActions, [
        changeMemoColorAction({ id: 'm1', color: '#111', prevColor: '#000' }),
        changeMemoColorAction({ id: 'm1', color: '#222', prevColor: '#111' }),
        changeMemoColorAction({ id: 'm1', color: '#333', prevColor: '#222' }),
      ]);

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].payload).toEqual({
        id: 'm1',
        color: '#000',
        prevColor: '#333',
      });
      expect(redoActions).toHaveLength(1);
      expect(redoActions[0].payload).toEqual({
        id: 'm1',
        color: '#333',
        prevColor: '#000',
      });
    });

    it('emits one pair per memo id', () => {
      changeColor(undoActions, redoActions, [
        changeMemoColorAction({ id: 'm1', color: '#111', prevColor: '#000' }),
        changeMemoColorAction({ id: 'm2', color: '#aaa', prevColor: '#999' }),
      ]);

      expect(undoActions.map(it => it.payload.id)).toEqual(['m1', 'm2']);
      expect(redoActions).toHaveLength(2);
    });

    it('keeps a single color change as its own undo pair', () => {
      changeColor(undoActions, redoActions, [
        changeMemoColorAction({ id: 'm1', color: '#fff', prevColor: '#000' }),
      ]);

      expect(undoActions[0].payload).toEqual({
        id: 'm1',
        color: '#000',
        prevColor: '#fff',
      });
    });
  });

  describe('resizeMemo', () => {
    const resize = memoPushStreamHistoryMap[ActionType.resizeMemo];

    it('ignores a stream without any resize action', () => {
      resize(undoActions, redoActions, [
        moveMemoAction({ ids: ['m1'], movementX: 100, movementY: 100 }),
      ]);

      expect(undoActions).toEqual([]);
      expect(redoActions).toEqual([]);
    });

    it('drops a group with a single resize action', () => {
      resize(undoActions, redoActions, [
        resizeMemoAction({ id: 'm1', x: 0, y: 0, width: 100, height: 100 }),
      ]);

      expect(undoActions).toEqual([]);
      expect(redoActions).toEqual([]);
    });

    it('undoes with the first frame of the stream and redoes with the last', () => {
      const firstFrame = resizeMemoAction({
        id: 'm1',
        x: 0,
        y: 0,
        width: 110,
        height: 110,
      });
      const lastFrame = resizeMemoAction({
        id: 'm1',
        x: 0,
        y: 0,
        width: 300,
        height: 300,
      });

      resize(undoActions, redoActions, [
        firstFrame,
        resizeMemoAction({ id: 'm1', x: 0, y: 0, width: 200, height: 200 }),
        lastFrame,
      ]);

      expect(undoActions).toEqual([firstFrame]);
      expect(redoActions).toEqual([lastFrame]);
    });

    it('emits one pair per memo id and skips ids with a single frame', () => {
      resize(undoActions, redoActions, [
        resizeMemoAction({ id: 'm1', x: 0, y: 0, width: 100, height: 100 }),
        resizeMemoAction({ id: 'm1', x: 0, y: 0, width: 200, height: 200 }),
        resizeMemoAction({ id: 'm2', x: 0, y: 0, width: 150, height: 150 }),
      ]);

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].payload.id).toBe('m1');
      expect(redoActions[0].payload.width).toBe(200);
    });
  });
});
