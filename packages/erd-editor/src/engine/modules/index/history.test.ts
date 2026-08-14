import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vitest';

import { Clock } from '@/engine/clock';
import { createHistory } from '@/engine/history';
import { pushHistory } from '@/engine/history.actions';
import { ActionType } from '@/engine/modules/index/actions';
import {
  addIndexAction,
  changeIndexNameAction,
  changeIndexUniqueAction,
  removeIndexAction,
} from '@/engine/modules/index/atom.actions';
import { indexPushUndoHistoryMap } from '@/engine/modules/index/history';
import { createStore, Store } from '@/engine/store';

function setup() {
  const clock = new Clock();
  const store = createStore({ toWidth: text => text.length * 10, clock });
  store.subscribe(list => list.forEach(action => clock.merge(action.version)));
  return { store, clock };
}

function undoOf(store: Store, action: AnyAction): AnyAction[] {
  const undoActions: AnyAction[] = [];
  const pushUndoHistory = Reflect.get(indexPushUndoHistoryMap, action.type);
  pushUndoHistory(undoActions, action, store.state);
  return undoActions;
}

function historySetup() {
  const { store, clock } = setup();
  const history = createHistory({
    notify: () => {},
    dispatch: actions => store.dispatchSync(actions),
  });
  return { store, clock, history, push: pushHistory(store, history) };
}

describe('indexPushUndoHistoryMap', () => {
  it('registers an undo handler per index action type', () => {
    expect(Object.keys(indexPushUndoHistoryMap).sort()).toEqual(
      [
        ActionType.addIndex,
        ActionType.removeIndex,
        ActionType.changeIndexName,
        ActionType.changeIndexUnique,
      ].sort()
    );
  });
});

describe('addIndex undo', () => {
  it('undoes an add with a remove of the same id', () => {
    const { store } = setup();

    const undoActions = undoOf(
      store,
      addIndexAction({ id: 'i1', tableId: 't1' })
    );

    expect(undoActions).toEqual([removeIndexAction({ id: 'i1' })]);
  });

  it('does not need the index to exist', () => {
    const { store } = setup();

    expect(
      undoOf(store, addIndexAction({ id: 'ghost', tableId: 't1' }))
    ).toHaveLength(1);
  });
});

describe('removeIndex undo', () => {
  it('undoes a remove by re-adding with the stored tableId', () => {
    const { store } = setup();
    store.dispatchSync(addIndexAction({ id: 'i1', tableId: 't1' }));

    const undoActions = undoOf(store, removeIndexAction({ id: 'i1' }));

    expect(undoActions).toEqual([addIndexAction({ id: 'i1', tableId: 't1' })]);
  });

  it('pushes nothing when the index is unknown', () => {
    const { store } = setup();

    expect(undoOf(store, removeIndexAction({ id: 'ghost' }))).toEqual([]);
  });
});

describe('changeIndexName undo', () => {
  it('captures the previous name from the state', () => {
    const { store } = setup();
    store.dispatchSync(addIndexAction({ id: 'i1', tableId: 't1' }));
    store.dispatchSync(
      changeIndexNameAction({ id: 'i1', tableId: 't1', value: 'before' })
    );

    const undoActions = undoOf(
      store,
      changeIndexNameAction({ id: 'i1', tableId: 't1', value: 'after' })
    );

    expect(undoActions).toEqual([
      changeIndexNameAction({ id: 'i1', tableId: 't1', value: 'before' }),
    ]);
  });

  it('pushes nothing when the index is unknown', () => {
    const { store } = setup();

    expect(
      undoOf(
        store,
        changeIndexNameAction({ id: 'ghost', tableId: 't1', value: 'x' })
      )
    ).toEqual([]);
  });
});

describe('changeIndexUnique undo', () => {
  it('inverts the value carried by the action, not the stored one', () => {
    const { store } = setup();
    store.dispatchSync(addIndexAction({ id: 'i1', tableId: 't1' }));

    const undoActions = undoOf(
      store,
      changeIndexUniqueAction({ id: 'i1', tableId: 't1', value: true })
    );

    expect(undoActions).toEqual([
      changeIndexUniqueAction({ id: 'i1', tableId: 't1', value: false }),
    ]);
  });

  it('pushes nothing when the index is unknown', () => {
    const { store } = setup();

    expect(
      undoOf(
        store,
        changeIndexUniqueAction({ id: 'ghost', tableId: 't1', value: true })
      )
    ).toEqual([]);
  });
});

describe('index history round-trips', () => {
  it('undo/redo an addIndex against the real store', () => {
    const { store, history, push } = historySetup();
    const action = addIndexAction({ id: 'i1', tableId: 't1' });

    push([action]);
    store.dispatchSync(action);
    expect(store.state.doc.indexIds).toEqual(['i1']);

    history.undo();
    expect(store.state.doc.indexIds).toEqual([]);

    history.redo();
    expect(store.state.doc.indexIds).toEqual(['i1']);
  });

  it('undo/redo a rename against the real store', () => {
    const { store, history, push } = historySetup();
    store.dispatchSync(addIndexAction({ id: 'i1', tableId: 't1' }));
    store.dispatchSync(
      changeIndexNameAction({ id: 'i1', tableId: 't1', value: 'before' })
    );

    const action = changeIndexNameAction({
      id: 'i1',
      tableId: 't1',
      value: 'after',
    });
    push([action]);
    store.dispatchSync(action);
    expect(store.state.collections.indexEntities.i1.name).toBe('after');

    history.undo();
    expect(store.state.collections.indexEntities.i1.name).toBe('before');

    history.redo();
    expect(store.state.collections.indexEntities.i1.name).toBe('after');
  });

  it('undo/redo a unique toggle against the real store', () => {
    const { store, history, push } = historySetup();
    store.dispatchSync(addIndexAction({ id: 'i1', tableId: 't1' }));

    const action = changeIndexUniqueAction({
      id: 'i1',
      tableId: 't1',
      value: true,
    });
    push([action]);
    store.dispatchSync(action);
    expect(store.state.collections.indexEntities.i1.unique).toBe(true);

    history.undo();
    expect(store.state.collections.indexEntities.i1.unique).toBe(false);

    history.redo();
    expect(store.state.collections.indexEntities.i1.unique).toBe(true);
  });

  it('records nothing for a remove of an unknown index', () => {
    const { history, push } = historySetup();

    push([removeIndexAction({ id: 'ghost' })]);

    expect(history.size).toBe(0);
  });
});
