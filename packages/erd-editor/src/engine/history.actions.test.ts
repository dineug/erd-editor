import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Clock } from '@/engine/clock';
import { createHistory, History } from '@/engine/history';
import {
  pushHistory,
  pushStreamHistoryMap,
  pushUndoHistoryMap,
} from '@/engine/history.actions';
import {
  addTableAction,
  changeTableNameAction,
  moveTableAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import { createStore, Store } from '@/engine/store';

type Setup = {
  store: Store;
  clock: Clock;
  history: History;
  dispatched: AnyAction[][];
  push: (actions: AnyAction[]) => void;
};

function setup({ mergeClock = true }: { mergeClock?: boolean } = {}): Setup {
  const clock = new Clock();
  const store = createStore({ toWidth: text => text.length * 10, clock });

  if (mergeClock) {
    store.subscribe(actions => {
      actions.forEach(action => clock.merge(action.version));
    });
  }

  const dispatched: AnyAction[][] = [];
  const history = createHistory({
    notify: () => {},
    dispatch: actions => {
      dispatched.push(actions);
      store.dispatchSync(actions);
    },
  });

  return {
    store,
    clock,
    history,
    dispatched,
    push: pushHistory(store, history),
  };
}

const tableIds = (store: Store) => [...store.state.doc.tableIds];

const selectTable = (store: Store, id: string) =>
  query(store.state.collections).collection('tableEntities').selectById(id);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pushUndoHistoryMap / pushStreamHistoryMap', () => {
  it('merges every module undo map', () => {
    expect(Object.keys(pushUndoHistoryMap)).toEqual(
      expect.arrayContaining([
        'table.add',
        'table.remove',
        'column.add',
        'relationship.add',
        'memo.add',
        'settings.resize',
        'editor.loadJson',
        'index.add',
        'indexColumn.add',
      ])
    );
  });

  it('merges only the stream-capable module maps', () => {
    expect(Object.keys(pushStreamHistoryMap).sort()).toEqual(
      [
        'memo.changeColor',
        'memo.move',
        'memo.resize',
        'settings.streamScrollTo',
        'settings.streamZoomLevel',
        'table.changeColor',
        'table.move',
      ].sort()
    );
  });
});

describe('pushHistory', () => {
  it('ignores actions that no module registered an undo handler for', () => {
    const { history, push } = setup();

    push([{ type: 'unknown.action', payload: {} }]);

    expect(history.size).toBe(0);
  });

  it('records nothing when the undo handler produced no actions', () => {
    const { history, push } = setup();

    // the table does not exist, so `removeTable` bails out before pushing undo
    push([removeTableAction({ id: 'ghost' })]);

    expect(history.size).toBe(0);
  });

  it('undo/redo round-trips an addTable action against the real store', () => {
    const { store, history, push } = setup();
    const payload = { id: 't1', ui: { x: 10, y: 20, zIndex: 2 } };

    push([addTableAction(payload)]);
    store.dispatchSync(addTableAction(payload));

    expect(tableIds(store)).toEqual(['t1']);
    expect(history.size).toBe(1);
    expect(history.hasUndo()).toBe(true);

    history.undo();
    expect(tableIds(store)).toEqual([]);

    history.redo();
    expect(tableIds(store)).toEqual(['t1']);
  });

  it('captures the pre-dispatch value for changeTableName', () => {
    const { store, history, push } = setup();

    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    store.dispatchSync(changeTableNameAction({ id: 't1', value: 'users' }));

    push([changeTableNameAction({ id: 't1', value: 'members' })]);
    store.dispatchSync(changeTableNameAction({ id: 't1', value: 'members' }));

    expect(selectTable(store, 't1')?.name).toBe('members');

    history.undo();
    expect(selectTable(store, 't1')?.name).toBe('users');

    history.redo();
    expect(selectTable(store, 't1')?.name).toBe('members');
  });

  it('collapses a stream of moveTable actions into one history entry', () => {
    const { store, history, push } = setup();

    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 100, y: 100, zIndex: 1 } })
    );

    const moves = [
      moveTableAction({ ids: ['t1'], movementX: 15, movementY: 0 }),
      moveTableAction({ ids: ['t1'], movementX: 15, movementY: 0 }),
    ];
    push(moves);
    moves.forEach(action => store.dispatchSync(action));

    expect(selectTable(store, 't1')?.ui.x).toBe(130);
    expect(history.size).toBe(1);

    history.undo();
    expect(selectTable(store, 't1')?.ui.x).toBe(100);

    history.redo();
    expect(selectTable(store, 't1')?.ui.x).toBe(130);
  });

  it('drops a moveTable stream that stayed under the minimum distance', () => {
    const { history, push } = setup();

    push([
      moveTableAction({ ids: ['t1'], movementX: 5, movementY: 0 }),
      moveTableAction({ ids: ['t1'], movementX: 5, movementY: 0 }),
    ]);

    expect(history.size).toBe(0);
  });

  it('stamps a fresh clock version and deep-clones the recorded actions', () => {
    const { history, dispatched, push } = setup({ mergeClock: false });
    const action = addTableAction({ id: 't1', ui: { x: 1, y: 2, zIndex: 3 } });

    push([action]);
    action.payload.id = 'mutated';

    history.undo();
    history.redo();

    expect(dispatched).toHaveLength(2);
    expect(dispatched[0][0]).toMatchObject({
      type: removeTableAction.type,
      payload: { id: 't1' },
      version: 1,
    });
    expect(dispatched[1][0]).toMatchObject({
      type: addTableAction.type,
      payload: { id: 't1', ui: { x: 1, y: 2, zIndex: 3 } },
      version: 1,
    });
    expect(dispatched[1][0]).not.toBe(action);
  });

  it('swallows handler errors through safeCallback', () => {
    const { history, push } = setup();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      push([{ type: addTableAction.type, payload: null }])
    ).not.toThrow();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(history.size).toBe(0);
  });
});
