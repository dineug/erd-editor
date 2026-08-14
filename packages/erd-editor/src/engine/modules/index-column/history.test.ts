import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vitest';

import { OrderType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { createHistory } from '@/engine/history';
import { pushHistory } from '@/engine/history.actions';
import { addIndexAction } from '@/engine/modules/index/atom.actions';
import { ActionType } from '@/engine/modules/index-column/actions';
import {
  addIndexColumnAction,
  changeIndexColumnOrderTypeAction,
  moveIndexColumnAction,
  removeIndexColumnAction,
} from '@/engine/modules/index-column/atom.actions';
import { indexColumnPushUndoHistoryMap } from '@/engine/modules/index-column/history';
import { createStore, Store } from '@/engine/store';

function setup() {
  const clock = new Clock();
  const store = createStore({ toWidth: text => text.length * 10, clock });
  store.subscribe(list => list.forEach(action => clock.merge(action.version)));
  store.dispatchSync(addIndexAction({ id: 'idx1', tableId: 't1' }));
  return { store, clock };
}

function withColumns(ids: string[]) {
  const { store, clock } = setup();
  for (const id of ids) {
    store.dispatchSync(
      addIndexColumnAction({
        id,
        indexId: 'idx1',
        tableId: 't1',
        columnId: `col-${id}`,
      })
    );
  }
  return { store, clock };
}

function undoOf(store: Store, action: AnyAction): AnyAction[] {
  const undoActions: AnyAction[] = [];
  const pushUndoHistory = Reflect.get(
    indexColumnPushUndoHistoryMap,
    action.type
  );
  pushUndoHistory(undoActions, action, store.state);
  return undoActions;
}

const indexColumnIds = (store: Store) => [
  ...store.state.collections.indexEntities.idx1.indexColumnIds,
];

describe('indexColumnPushUndoHistoryMap', () => {
  it('registers an undo handler per index-column action type', () => {
    expect(Object.keys(indexColumnPushUndoHistoryMap).sort()).toEqual(
      [
        ActionType.addIndexColumn,
        ActionType.removeIndexColumn,
        ActionType.moveIndexColumn,
        ActionType.changeIndexColumnOrderType,
      ].sort()
    );
  });
});

describe('addIndexColumn undo', () => {
  it('undoes an add with a matching remove', () => {
    const { store } = setup();

    const undoActions = undoOf(
      store,
      addIndexColumnAction({
        id: 'ic1',
        indexId: 'idx1',
        tableId: 't1',
        columnId: 'c1',
      })
    );

    expect(undoActions).toEqual([
      removeIndexColumnAction({ id: 'ic1', indexId: 'idx1', tableId: 't1' }),
    ]);
  });
});

describe('removeIndexColumn undo', () => {
  it('undoes a remove by re-adding with the stored columnId', () => {
    const { store } = withColumns(['ic1']);

    const undoActions = undoOf(
      store,
      removeIndexColumnAction({ id: 'ic1', indexId: 'idx1', tableId: 't1' })
    );

    expect(undoActions).toEqual([
      addIndexColumnAction({
        id: 'ic1',
        indexId: 'idx1',
        tableId: 't1',
        columnId: 'col-ic1',
      }),
    ]);
  });

  it('pushes nothing when the index column is unknown', () => {
    const { store } = setup();

    expect(
      undoOf(
        store,
        removeIndexColumnAction({
          id: 'ghost',
          indexId: 'idx1',
          tableId: 't1',
        })
      )
    ).toEqual([]);
  });
});

describe('moveIndexColumn undo', () => {
  it('pushes nothing when the index is unknown', () => {
    const { store } = withColumns(['ic1', 'ic2']);

    expect(
      undoOf(
        store,
        moveIndexColumnAction({
          id: 'ic1',
          indexId: 'ghost',
          tableId: 't1',
          targetId: 'ic2',
        })
      )
    ).toEqual([]);
  });

  it('pushes nothing when the moved id is not registered', () => {
    const { store } = withColumns(['ic1', 'ic2']);

    expect(
      undoOf(
        store,
        moveIndexColumnAction({
          id: 'ghost',
          indexId: 'idx1',
          tableId: 't1',
          targetId: 'ic2',
        })
      )
    ).toEqual([]);
  });

  it('pushes nothing when the target id is not registered', () => {
    const { store } = withColumns(['ic1', 'ic2']);

    expect(
      undoOf(
        store,
        moveIndexColumnAction({
          id: 'ic1',
          indexId: 'idx1',
          tableId: 't1',
          targetId: 'ghost',
        })
      )
    ).toEqual([]);
  });

  it('targets the next neighbour when the column moves down', () => {
    const { store } = withColumns(['ic1', 'ic2', 'ic3']);

    const undoActions = undoOf(
      store,
      moveIndexColumnAction({
        id: 'ic1',
        indexId: 'idx1',
        tableId: 't1',
        targetId: 'ic3',
      })
    );

    expect(undoActions).toEqual([
      moveIndexColumnAction({
        id: 'ic1',
        indexId: 'idx1',
        tableId: 't1',
        targetId: 'ic2',
      }),
    ]);
  });

  it('targets the previous neighbour when the column moves up', () => {
    const { store } = withColumns(['ic1', 'ic2', 'ic3']);

    const undoActions = undoOf(
      store,
      moveIndexColumnAction({
        id: 'ic3',
        indexId: 'idx1',
        tableId: 't1',
        targetId: 'ic1',
      })
    );

    expect(undoActions).toEqual([
      moveIndexColumnAction({
        id: 'ic3',
        indexId: 'idx1',
        tableId: 't1',
        targetId: 'ic2',
      }),
    ]);
  });
});

describe('changeIndexColumnOrderType undo', () => {
  it('captures the current order type from the state', () => {
    const { store } = withColumns(['ic1']);

    const undoActions = undoOf(
      store,
      changeIndexColumnOrderTypeAction({
        id: 'ic1',
        indexId: 'idx1',
        columnId: 'col-ic1',
        value: OrderType.DESC,
      })
    );

    expect(undoActions).toEqual([
      changeIndexColumnOrderTypeAction({
        id: 'ic1',
        indexId: 'idx1',
        columnId: 'col-ic1',
        value: OrderType.ASC,
      }),
    ]);
  });

  it('pushes nothing when the index column is unknown', () => {
    const { store } = setup();

    expect(
      undoOf(
        store,
        changeIndexColumnOrderTypeAction({
          id: 'ghost',
          indexId: 'idx1',
          columnId: 'c1',
          value: OrderType.DESC,
        })
      )
    ).toEqual([]);
  });
});

describe('index-column history round-trips', () => {
  function historySetup(ids: string[] = []) {
    const { store, clock } = withColumns(ids);
    const history = createHistory({
      notify: () => {},
      dispatch: actions => store.dispatchSync(actions),
      getNextVersion: () => clock.getNextVersion(),
    });
    return { store, clock, history, push: pushHistory(store, history) };
  }

  it('undo/redo an addIndexColumn against the real store', () => {
    const { store, history, push } = historySetup();
    const action = addIndexColumnAction({
      id: 'ic1',
      indexId: 'idx1',
      tableId: 't1',
      columnId: 'c1',
    });

    push([action]);
    store.dispatchSync(action);
    expect(indexColumnIds(store)).toEqual(['ic1']);

    history.undo();
    expect(indexColumnIds(store)).toEqual([]);

    history.redo();
    expect(indexColumnIds(store)).toEqual(['ic1']);
  });

  it('undo/redo a move against the real store', () => {
    const { store, history, push } = historySetup(['ic1', 'ic2', 'ic3']);
    const action = moveIndexColumnAction({
      id: 'ic1',
      indexId: 'idx1',
      tableId: 't1',
      targetId: 'ic3',
    });

    push([action]);
    store.dispatchSync(action);
    expect(indexColumnIds(store)).toEqual(['ic2', 'ic3', 'ic1']);

    history.undo();
    expect(indexColumnIds(store)).toEqual(['ic1', 'ic2', 'ic3']);

    history.redo();
    expect(indexColumnIds(store)).toEqual(['ic2', 'ic3', 'ic1']);
  });

  it('undo/redo an order type change against the real store', () => {
    const { store, history, push } = historySetup(['ic1']);
    const action = changeIndexColumnOrderTypeAction({
      id: 'ic1',
      indexId: 'idx1',
      columnId: 'col-ic1',
      value: OrderType.DESC,
    });

    push([action]);
    store.dispatchSync(action);
    expect(store.state.collections.indexColumnEntities.ic1.orderType).toBe(
      OrderType.DESC
    );

    history.undo();
    expect(store.state.collections.indexColumnEntities.ic1.orderType).toBe(
      OrderType.ASC
    );

    history.redo();
    expect(store.state.collections.indexColumnEntities.ic1.orderType).toBe(
      OrderType.DESC
    );
  });

  it('records nothing for a remove of an unknown index column', () => {
    const { history, push } = historySetup();

    push([
      removeIndexColumnAction({ id: 'ghost', indexId: 'idx1', tableId: 't1' }),
    ]);

    expect(history.size).toBe(0);
  });
});
