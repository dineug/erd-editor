import { AnyAction } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import { ActionType } from '@/engine/modules/table/actions';
import {
  addTableAction,
  changeTableColorAction,
  changeTableCommentAction,
  changeTableNameAction,
  moveTableAction,
  moveToTableAction,
  removeTableAction,
  sortTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  tablePushStreamHistoryMap,
  tablePushUndoHistoryMap,
} from '@/engine/modules/table/history';
import { createStore, Store } from '@/engine/store';

const TABLE_A = 'table-a';
const TABLE_B = 'table-b';

let store: Store;
let undoActions: AnyAction[];
let redoActions: AnyAction[];

function addTable(id: string) {
  store.dispatchSync(addTableAction({ id, ui: { x: 100, y: 200, zIndex: 5 } }));
}

function table(id: string) {
  return store.state.collections.tableEntities[id];
}

beforeEach(() => {
  store = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  });
  undoActions = [];
  redoActions = [];
});

describe('table/history maps', () => {
  it('registers undo builders for the non-stream actions', () => {
    expect(Object.keys(tablePushUndoHistoryMap).slice().sort()).toEqual(
      [
        ActionType.addTable,
        ActionType.removeTable,
        ActionType.changeTableName,
        ActionType.changeTableComment,
        ActionType.moveToTable,
        ActionType.sortTable,
      ]
        .slice()
        .sort()
    );
  });

  it('registers stream builders for move and color', () => {
    expect(Object.keys(tablePushStreamHistoryMap).slice().sort()).toEqual(
      [ActionType.moveTable, ActionType.changeTableColor].slice().sort()
    );
  });
});

describe('table/history addTable', () => {
  it('undoes with a removeTable of the same id', () => {
    addTable(TABLE_A);

    tablePushUndoHistoryMap[ActionType.addTable](
      undoActions,
      addTableAction({ id: TABLE_A, ui: { x: 1, y: 2, zIndex: 3 } }),
      store.state
    );

    expect(undoActions).toHaveLength(1);
    expect(undoActions[0].type).toBe(ActionType.removeTable);
    expect(undoActions[0].payload).toEqual({ id: TABLE_A });
  });

  it('really removes the table when the undo action is dispatched', () => {
    addTable(TABLE_A);
    tablePushUndoHistoryMap[ActionType.addTable](
      undoActions,
      addTableAction({ id: TABLE_A, ui: { x: 1, y: 2, zIndex: 3 } }),
      store.state
    );

    store.dispatchSync(
      ...undoActions.map(action => ({ ...action, version: 9 }))
    );

    expect(store.state.doc.tableIds).toEqual([]);
  });

  it('appends instead of replacing the accumulated undo actions', () => {
    const existing = { type: 'noop', payload: undefined } as AnyAction;
    undoActions.push(existing);

    tablePushUndoHistoryMap[ActionType.addTable](
      undoActions,
      addTableAction({ id: TABLE_A, ui: { x: 1, y: 2, zIndex: 3 } }),
      store.state
    );

    expect(undoActions).toHaveLength(2);
    expect(undoActions[0]).toBe(existing);
  });
});

describe('table/history removeTable', () => {
  it('undoes with an addTable carrying the snapshotted ui position', () => {
    addTable(TABLE_A);

    tablePushUndoHistoryMap[ActionType.removeTable](
      undoActions,
      removeTableAction({ id: TABLE_A }),
      store.state
    );

    expect(undoActions).toHaveLength(1);
    expect(undoActions[0].type).toBe(ActionType.addTable);
    expect(undoActions[0].payload).toEqual({
      id: TABLE_A,
      ui: { x: 100, y: 200, zIndex: 5 },
    });
    expect(Object.keys(undoActions[0].payload.ui)).toEqual([
      'x',
      'y',
      'zIndex',
    ]);
  });

  it('pushes nothing when the table no longer exists', () => {
    tablePushUndoHistoryMap[ActionType.removeTable](
      undoActions,
      removeTableAction({ id: 'ghost' }),
      store.state
    );

    expect(undoActions).toEqual([]);
  });

  it('restores the table when undo is dispatched', () => {
    addTable(TABLE_A);
    tablePushUndoHistoryMap[ActionType.removeTable](
      undoActions,
      removeTableAction({ id: TABLE_A }),
      store.state
    );

    store.dispatchSync({ ...removeTableAction({ id: TABLE_A }), version: 3 });
    expect(store.state.doc.tableIds).toEqual([]);

    store.dispatchSync(
      ...undoActions.map(action => ({ ...action, version: 4 }))
    );

    expect(store.state.doc.tableIds).toEqual([TABLE_A]);
    expect(table(TABLE_A).ui).toMatchObject({ x: 100, y: 200, zIndex: 5 });
  });
});

describe('table/history changeTableName', () => {
  it('undoes with the previous name', () => {
    addTable(TABLE_A);
    store.dispatchSync(changeTableNameAction({ id: TABLE_A, value: 'before' }));

    tablePushUndoHistoryMap[ActionType.changeTableName](
      undoActions,
      changeTableNameAction({ id: TABLE_A, value: 'after' }),
      store.state
    );

    expect(undoActions).toHaveLength(1);
    expect(undoActions[0].type).toBe(ActionType.changeTableName);
    expect(undoActions[0].payload).toEqual({ id: TABLE_A, value: 'before' });
  });

  it('pushes nothing for an unknown table', () => {
    tablePushUndoHistoryMap[ActionType.changeTableName](
      undoActions,
      changeTableNameAction({ id: 'ghost', value: 'x' }),
      store.state
    );

    expect(undoActions).toEqual([]);
  });

  it('restores the previous name and width when undo is dispatched', () => {
    addTable(TABLE_A);
    store.dispatchSync(
      changeTableNameAction({ id: TABLE_A, value: 'before_name' })
    );

    tablePushUndoHistoryMap[ActionType.changeTableName](
      undoActions,
      changeTableNameAction({ id: TABLE_A, value: 'after' }),
      store.state
    );

    store.dispatchSync({
      ...changeTableNameAction({ id: TABLE_A, value: 'after' }),
      version: 1,
    });
    expect(table(TABLE_A).name).toBe('after');

    store.dispatchSync(
      ...undoActions.map(action => ({ ...action, version: 2 }))
    );

    expect(table(TABLE_A).name).toBe('before_name');
    expect(table(TABLE_A).ui.widthName).toBe(110);
  });
});

describe('table/history changeTableComment', () => {
  it('undoes with the previous comment', () => {
    addTable(TABLE_A);
    store.dispatchSync(
      changeTableCommentAction({ id: TABLE_A, value: 'before comment' })
    );

    tablePushUndoHistoryMap[ActionType.changeTableComment](
      undoActions,
      changeTableCommentAction({ id: TABLE_A, value: 'after' }),
      store.state
    );

    expect(undoActions).toHaveLength(1);
    expect(undoActions[0].payload).toEqual({
      id: TABLE_A,
      value: 'before comment',
    });
  });

  it('pushes nothing for an unknown table', () => {
    tablePushUndoHistoryMap[ActionType.changeTableComment](
      undoActions,
      changeTableCommentAction({ id: 'ghost', value: 'x' }),
      store.state
    );

    expect(undoActions).toEqual([]);
  });
});

describe('table/history moveToTable', () => {
  it('undoes with the current coordinates', () => {
    addTable(TABLE_A);

    tablePushUndoHistoryMap[ActionType.moveToTable](
      undoActions,
      moveToTableAction({ id: TABLE_A, x: 999, y: 888 }),
      store.state
    );

    expect(undoActions).toHaveLength(1);
    expect(undoActions[0].type).toBe(ActionType.moveToTable);
    expect(undoActions[0].payload).toEqual({ id: TABLE_A, x: 100, y: 200 });
  });

  it('pushes nothing for an unknown table', () => {
    tablePushUndoHistoryMap[ActionType.moveToTable](
      undoActions,
      moveToTableAction({ id: 'ghost', x: 1, y: 2 }),
      store.state
    );

    expect(undoActions).toEqual([]);
  });

  it('moves the table back when undo is dispatched', () => {
    addTable(TABLE_A);
    tablePushUndoHistoryMap[ActionType.moveToTable](
      undoActions,
      moveToTableAction({ id: TABLE_A, x: 999, y: 888 }),
      store.state
    );

    store.dispatchSync(moveToTableAction({ id: TABLE_A, x: 999, y: 888 }));
    expect(table(TABLE_A).ui).toMatchObject({ x: 999, y: 888 });

    store.dispatchSync(...undoActions);

    expect(table(TABLE_A).ui).toMatchObject({ x: 100, y: 200 });
  });
});

describe('table/history sortTable', () => {
  it('is registered but pushes no undo action', () => {
    tablePushUndoHistoryMap[ActionType.sortTable](
      undoActions,
      sortTableAction(),
      store.state
    );

    expect(undoActions).toEqual([]);
  });
});

describe('table/history moveTable stream', () => {
  it('does nothing when the batch has no move action', () => {
    tablePushStreamHistoryMap[ActionType.moveTable](undoActions, redoActions, [
      addTableAction({ id: TABLE_A, ui: { x: 0, y: 0, zIndex: 1 } }),
    ]);

    expect(undoActions).toEqual([]);
    expect(redoActions).toEqual([]);
  });

  it('collapses a stream of moves into an inverse and a replay action', () => {
    tablePushStreamHistoryMap[ActionType.moveTable](undoActions, redoActions, [
      moveTableAction({ ids: [TABLE_A], movementX: 10, movementY: 5 }),
      moveTableAction({ ids: [TABLE_A], movementX: 10, movementY: 5 }),
    ]);

    expect(undoActions).toHaveLength(1);
    expect(redoActions).toHaveLength(1);
    expect(undoActions[0].payload).toEqual({
      ids: [TABLE_A],
      movementX: -20,
      movementY: -10,
    });
    expect(redoActions[0].payload).toEqual({
      ids: [TABLE_A],
      movementX: 20,
      movementY: 10,
    });
  });

  it('drops movements below the 20px threshold', () => {
    tablePushStreamHistoryMap[ActionType.moveTable](undoActions, redoActions, [
      moveTableAction({ ids: [TABLE_A], movementX: 9, movementY: 10 }),
    ]);

    expect(undoActions).toEqual([]);
    expect(redoActions).toEqual([]);
  });

  it('sums the signed movements before applying the threshold', () => {
    tablePushStreamHistoryMap[ActionType.moveTable](undoActions, redoActions, [
      moveTableAction({ ids: [TABLE_A], movementX: -30, movementY: 25 }),
      moveTableAction({ ids: [TABLE_A], movementX: 30, movementY: -25 }),
    ]);

    // the movements cancel out, so the collapsed distance is 0
    expect(undoActions).toEqual([]);
    expect(redoActions).toEqual([]);
  });

  it('groups by the moved id set and keeps only the groups above the threshold', () => {
    tablePushStreamHistoryMap[ActionType.moveTable](undoActions, redoActions, [
      moveTableAction({ ids: [TABLE_A], movementX: 30, movementY: 0 }),
      moveTableAction({
        ids: [TABLE_A, TABLE_B],
        movementX: 1,
        movementY: 1,
      }),
      moveTableAction({ ids: [TABLE_A], movementX: 0, movementY: 30 }),
    ]);

    expect(undoActions).toHaveLength(1);
    expect(undoActions[0].payload).toEqual({
      ids: [TABLE_A],
      movementX: -30,
      movementY: -30,
    });
    expect(redoActions[0].payload).toEqual({
      ids: [TABLE_A],
      movementX: 30,
      movementY: 30,
    });
  });

  it('emits one entry per id group that passes the threshold', () => {
    tablePushStreamHistoryMap[ActionType.moveTable](undoActions, redoActions, [
      moveTableAction({ ids: [TABLE_A], movementX: 30, movementY: 0 }),
      moveTableAction({ ids: [TABLE_B], movementX: 0, movementY: -40 }),
    ]);

    expect(undoActions).toHaveLength(2);
    expect(redoActions).toHaveLength(2);
    expect(undoActions.map(action => action.payload.ids)).toEqual([
      [TABLE_A],
      [TABLE_B],
    ]);
  });

  it('round-trips against the store: undo puts the table back', () => {
    addTable(TABLE_A);
    const stream = [
      moveTableAction({ ids: [TABLE_A], movementX: 15, movementY: 15 }),
      moveTableAction({ ids: [TABLE_A], movementX: 15, movementY: 15 }),
    ];
    store.dispatchSync(...stream);
    expect(table(TABLE_A).ui).toMatchObject({ x: 130, y: 230 });

    tablePushStreamHistoryMap[ActionType.moveTable](
      undoActions,
      redoActions,
      stream
    );

    store.dispatchSync(...undoActions);
    expect(table(TABLE_A).ui).toMatchObject({ x: 100, y: 200 });

    store.dispatchSync(...redoActions);
    expect(table(TABLE_A).ui).toMatchObject({ x: 130, y: 230 });
  });
});

describe('table/history changeTableColor stream', () => {
  it('does nothing when the batch has no color action', () => {
    tablePushStreamHistoryMap[ActionType.changeTableColor](
      undoActions,
      redoActions,
      [moveTableAction({ ids: [TABLE_A], movementX: 1, movementY: 1 })]
    );

    expect(undoActions).toEqual([]);
    expect(redoActions).toEqual([]);
  });

  it('collapses a color stream using the first prevColor and the last color', () => {
    tablePushStreamHistoryMap[ActionType.changeTableColor](
      undoActions,
      redoActions,
      [
        changeTableColorAction({
          id: TABLE_A,
          color: '#111',
          prevColor: '#000',
        }),
        changeTableColorAction({
          id: TABLE_A,
          color: '#222',
          prevColor: '#111',
        }),
        changeTableColorAction({
          id: TABLE_A,
          color: '#333',
          prevColor: '#222',
        }),
      ]
    );

    expect(undoActions).toHaveLength(1);
    expect(undoActions[0].payload).toEqual({
      id: TABLE_A,
      color: '#000',
      prevColor: '#333',
    });
    expect(redoActions[0].payload).toEqual({
      id: TABLE_A,
      color: '#333',
      prevColor: '#000',
    });
  });

  it('emits one entry per table id', () => {
    tablePushStreamHistoryMap[ActionType.changeTableColor](
      undoActions,
      redoActions,
      [
        changeTableColorAction({ id: TABLE_A, color: '#a1', prevColor: '' }),
        changeTableColorAction({ id: TABLE_B, color: '#b1', prevColor: '' }),
      ]
    );

    expect(undoActions.map(action => action.payload.id)).toEqual([
      TABLE_A,
      TABLE_B,
    ]);
    expect(redoActions.map(action => action.payload.color)).toEqual([
      '#a1',
      '#b1',
    ]);
  });

  it('round-trips against the store', () => {
    addTable(TABLE_A);
    const stream = [
      changeTableColorAction({ id: TABLE_A, color: '#111', prevColor: '' }),
      changeTableColorAction({ id: TABLE_A, color: '#222', prevColor: '#111' }),
    ];
    store.dispatchSync(...stream.map(action => ({ ...action, version: 1 })));
    expect(table(TABLE_A).ui.color).toBe('#222');

    tablePushStreamHistoryMap[ActionType.changeTableColor](
      undoActions,
      redoActions,
      stream
    );

    store.dispatchSync(
      ...undoActions.map(action => ({ ...action, version: 2 }))
    );
    expect(table(TABLE_A).ui.color).toBe('');

    store.dispatchSync(
      ...redoActions.map(action => ({ ...action, version: 3 }))
    );
    expect(table(TABLE_A).ui.color).toBe('#222');
  });
});
