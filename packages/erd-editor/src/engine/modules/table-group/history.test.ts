import { AnyAction } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import { ActionType } from '@/engine/modules/table-group/actions';
import {
  addTableGroupAction,
  changeTableGroupColorAction,
  changeTableGroupNameAction,
  moveTableGroupAction,
  moveToTableGroupAction,
  removeTableGroupAction,
  resizeTableGroupAction,
} from '@/engine/modules/table-group/atom.actions';
import {
  tableGroupPushStreamHistoryMap,
  tableGroupPushUndoHistoryMap,
} from '@/engine/modules/table-group/history';
import { createStore, Store } from '@/engine/store';

const UI = { x: 10, y: 20, width: 300, height: 200, zIndex: 2 };

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

describe('tableGroupPushUndoHistoryMap', () => {
  it('registers undo builders for add, remove, changeName and moveTo', () => {
    expect(Object.keys(tableGroupPushUndoHistoryMap).sort()).toEqual(
      [
        ActionType.addTableGroup,
        ActionType.removeTableGroup,
        ActionType.changeTableGroupName,
        ActionType.moveToTableGroup,
      ].sort()
    );
  });

  it('undoes an add with a remove of the same id', () => {
    tableGroupPushUndoHistoryMap[ActionType.addTableGroup](
      undoActions,
      addTableGroupAction({ id: 'g1', ui: UI }),
      store.state
    );

    expect(undoActions).toEqual([removeTableGroupAction({ id: 'g1' })]);
  });

  it('undoes a remove with an add carrying the rect and color it held', () => {
    store.dispatchSync(
      addTableGroupAction({ id: 'g1', color: '#0090ff', ui: UI })
    );

    tableGroupPushUndoHistoryMap[ActionType.removeTableGroup](
      undoActions,
      removeTableGroupAction({ id: 'g1' }),
      store.state
    );

    expect(undoActions).toEqual([
      addTableGroupAction({ id: 'g1', color: '#0090ff', ui: UI }),
    ]);
  });

  it('undoes a rename with the name it replaces', () => {
    store.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: UI }),
      changeTableGroupNameAction({ id: 'g1', value: 'billing' })
    );

    tableGroupPushUndoHistoryMap[ActionType.changeTableGroupName](
      undoActions,
      changeTableGroupNameAction({ id: 'g1', value: 'sales' }),
      store.state
    );

    expect(undoActions).toEqual([
      changeTableGroupNameAction({ id: 'g1', value: 'billing' }),
    ]);
  });

  it('undoes a moveTo with the point it leaves', () => {
    store.dispatchSync(addTableGroupAction({ id: 'g1', ui: UI }));

    tableGroupPushUndoHistoryMap[ActionType.moveToTableGroup](
      undoActions,
      moveToTableGroupAction({ id: 'g1', x: 500, y: 600 }),
      store.state
    );

    expect(undoActions).toEqual([
      moveToTableGroupAction({ id: 'g1', x: 10, y: 20 }),
    ]);
  });

  it.each([
    [ActionType.removeTableGroup, removeTableGroupAction({ id: 'ghost' })],
    [
      ActionType.changeTableGroupName,
      changeTableGroupNameAction({ id: 'ghost', value: 'x' }),
    ],
    [
      ActionType.moveToTableGroup,
      moveToTableGroupAction({ id: 'ghost', x: 0, y: 0 }),
    ],
  ])('records nothing for %s on a group it has not seen', (type, action) => {
    tableGroupPushUndoHistoryMap[
      type as keyof typeof tableGroupPushUndoHistoryMap
    ](undoActions, action, store.state);

    expect(undoActions).toEqual([]);
  });
});

describe('tableGroupPushStreamHistoryMap', () => {
  it('registers stream builders for move, changeColor and resize', () => {
    expect(Object.keys(tableGroupPushStreamHistoryMap).sort()).toEqual(
      [
        ActionType.moveTableGroup,
        ActionType.changeTableGroupColor,
        ActionType.resizeTableGroup,
      ].sort()
    );
  });

  describe('moveTableGroup', () => {
    const move = tableGroupPushStreamHistoryMap[ActionType.moveTableGroup];

    it('sums a drag per id list into one undo and one redo step', () => {
      move(undoActions, redoActions, [
        moveTableGroupAction({ ids: ['g1'], movementX: 10, movementY: 5 }),
        moveTableGroupAction({ ids: ['g1'], movementX: 15, movementY: 5 }),
        moveTableGroupAction({ ids: ['g2'], movementX: 0, movementY: 30 }),
      ]);

      expect(undoActions).toEqual([
        moveTableGroupAction({ ids: ['g1'], movementX: -25, movementY: -10 }),
        moveTableGroupAction({ ids: ['g2'], movementX: -0, movementY: -30 }),
      ]);
      expect(redoActions).toEqual([
        moveTableGroupAction({ ids: ['g1'], movementX: 25, movementY: 10 }),
        moveTableGroupAction({ ids: ['g2'], movementX: 0, movementY: 30 }),
      ]);
    });

    it('records nothing for a drag shorter than the minimum or no move at all', () => {
      move(undoActions, redoActions, [
        moveTableGroupAction({ ids: ['g1'], movementX: 5, movementY: 5 }),
      ]);
      move(undoActions, redoActions, [
        changeTableGroupNameAction({ id: 'g1', value: 'x' }),
      ]);

      expect(undoActions).toEqual([]);
      expect(redoActions).toEqual([]);
    });
  });

  describe('changeTableGroupColor', () => {
    const color =
      tableGroupPushStreamHistoryMap[ActionType.changeTableGroupColor];

    it('folds a picker stream per group into its first and last color', () => {
      color(undoActions, redoActions, [
        changeTableGroupColorAction({ id: 'g1', color: '#111', prevColor: '' }),
        changeTableGroupColorAction({
          id: 'g1',
          color: '#222',
          prevColor: '#111',
        }),
      ]);

      expect(undoActions).toEqual([
        changeTableGroupColorAction({ id: 'g1', color: '', prevColor: '#222' }),
      ]);
      expect(redoActions).toEqual([
        changeTableGroupColorAction({ id: 'g1', color: '#222', prevColor: '' }),
      ]);
    });

    it('records nothing without a color action', () => {
      color(undoActions, redoActions, [
        moveTableGroupAction({ ids: ['g1'], movementX: 50, movementY: 0 }),
      ]);

      expect(undoActions).toEqual([]);
    });
  });

  describe('resizeTableGroup', () => {
    const resize = tableGroupPushStreamHistoryMap[ActionType.resizeTableGroup];

    it('takes a sash drag back to its first step and forward to its last', () => {
      const first = resizeTableGroupAction({
        id: 'g1',
        x: 0,
        y: 0,
        width: 310,
        height: 200,
      });
      const last = resizeTableGroupAction({
        id: 'g1',
        x: 0,
        y: 0,
        width: 400,
        height: 260,
      });

      resize(undoActions, redoActions, [first, last]);

      expect(undoActions).toEqual([first]);
      expect(redoActions).toEqual([last]);
    });

    it('records nothing for a single step or no resize at all', () => {
      resize(undoActions, redoActions, [
        resizeTableGroupAction({ id: 'g1', x: 0, y: 0, width: 1, height: 1 }),
      ]);
      resize(undoActions, redoActions, []);

      expect(undoActions).toEqual([]);
      expect(redoActions).toEqual([]);
    });
  });
});
