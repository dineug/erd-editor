import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { OrderType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { addIndexAction } from '@/engine/modules/index/atom.actions';
import { ActionType } from '@/engine/modules/index-column/actions';
import {
  addIndexColumnAction,
  changeIndexColumnOrderTypeAction,
  removeIndexColumnAction,
} from '@/engine/modules/index-column/atom.actions';
import {
  actions$,
  addIndexColumnAction$,
  changeIndexColumnOrderTypeAction$,
  moveIndexColumnAction$,
  removeIndexColumnAction$,
} from '@/engine/modules/index-column/generator.actions';
import { createStore, Store } from '@/engine/store';

function setup() {
  const clock = new Clock();
  const store = createStore({ toWidth: text => text.length * 10, clock });
  const emitted: AnyAction[] = [];
  store.subscribe(list => emitted.push(...list));
  return { store, clock, emitted };
}

const at = (action: AnyAction, version: number): AnyAction => ({
  ...action,
  version,
});

const selectIndex = (store: Store, id: string) =>
  query(store.state.collections).collection('indexEntities').selectById(id);

const selectIndexColumn = (store: Store, id: string) =>
  query(store.state.collections)
    .collection('indexColumnEntities')
    .selectById(id);

function withIndex() {
  const context = setup();
  context.store.dispatchSync(
    at(addIndexAction({ id: 'idx1', tableId: 't1' }), 1)
  );
  context.emitted.length = 0;
  return context;
}

describe('addIndexColumnAction$', () => {
  it('does nothing when the index does not exist', () => {
    const { store, emitted } = setup();

    store.dispatchSync(addIndexColumnAction$('ghost', 'c1'));

    expect(emitted).toEqual([]);
    expect(store.state.lww).toEqual({});
  });

  it('creates a new index column with a generated id', () => {
    const { store, clock, emitted } = withIndex();
    clock.merge(2);

    store.dispatchSync(addIndexColumnAction$('idx1', 'c1'));

    expect(emitted).toHaveLength(1);
    expect(emitted[0].type).toBe(ActionType.addIndexColumn);
    expect(emitted[0].payload).toMatchObject({
      indexId: 'idx1',
      tableId: 't1',
      columnId: 'c1',
    });
    expect(typeof emitted[0].payload.id).toBe('string');
    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual([
      emitted[0].payload.id,
    ]);
  });

  it('generates a distinct id per column', () => {
    const { store, clock, emitted } = withIndex();
    clock.merge(2);

    store.dispatchSync(addIndexColumnAction$('idx1', 'c1'));
    store.dispatchSync(addIndexColumnAction$('idx1', 'c2'));

    expect(emitted[0].payload.id).not.toBe(emitted[1].payload.id);
    expect(selectIndex(store, 'idx1')?.indexColumnIds).toHaveLength(2);
  });

  it('reuses the id kept in the sequence when the column was removed before', () => {
    const { store, clock, emitted } = withIndex();
    store.dispatchSync(
      at(
        addIndexColumnAction({
          id: 'ic1',
          indexId: 'idx1',
          tableId: 't1',
          columnId: 'c1',
        }),
        2
      )
    );
    store.dispatchSync(
      at(
        removeIndexColumnAction({ id: 'ic1', indexId: 'idx1', tableId: 't1' }),
        3
      )
    );
    emitted.length = 0;
    clock.merge(4);

    store.dispatchSync(addIndexColumnAction$('idx1', 'c1'));

    expect(emitted).toHaveLength(1);
    expect(emitted[0].payload).toEqual({
      id: 'ic1',
      indexId: 'idx1',
      tableId: 't1',
      columnId: 'c1',
    });
    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual(['ic1']);
  });
});

describe('removeIndexColumnAction$', () => {
  it('does nothing when the index does not exist', () => {
    const { store, emitted } = setup();

    store.dispatchSync(removeIndexColumnAction$('ghost', 'c1'));

    expect(emitted).toEqual([]);
  });

  it('does nothing when no registered index column matches the column', () => {
    const { store, clock, emitted } = withIndex();
    clock.merge(2);
    store.dispatchSync(addIndexColumnAction$('idx1', 'c1'));
    emitted.length = 0;

    store.dispatchSync(removeIndexColumnAction$('idx1', 'other'));

    expect(emitted).toEqual([]);
    expect(selectIndex(store, 'idx1')?.indexColumnIds).toHaveLength(1);
  });

  it('removes every registered index column bound to the column', () => {
    const { store, clock, emitted } = withIndex();
    for (const id of ['ic1', 'ic2', 'ic3']) {
      store.dispatchSync(
        at(
          addIndexColumnAction({
            id,
            indexId: 'idx1',
            tableId: 't1',
            columnId: id === 'ic2' ? 'other' : 'c1',
          }),
          2
        )
      );
    }
    emitted.length = 0;
    clock.merge(3);

    store.dispatchSync(removeIndexColumnAction$('idx1', 'c1'));

    expect(emitted.map(action => action.payload.id)).toEqual(['ic1', 'ic3']);
    expect(emitted[0].type).toBe(ActionType.removeIndexColumn);
    expect(emitted[0].payload.tableId).toBe('t1');
    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual(['ic2']);
  });
});

describe('changeIndexColumnOrderTypeAction$', () => {
  it('does nothing when the index column does not exist', () => {
    const { store, emitted } = setup();

    store.dispatchSync(changeIndexColumnOrderTypeAction$('ghost'));

    expect(emitted).toEqual([]);
  });

  it('toggles ASC to DESC', () => {
    const { store, clock, emitted } = withIndex();
    store.dispatchSync(
      at(
        addIndexColumnAction({
          id: 'ic1',
          indexId: 'idx1',
          tableId: 't1',
          columnId: 'c1',
        }),
        1
      )
    );
    emitted.length = 0;
    clock.merge(2);

    store.dispatchSync(changeIndexColumnOrderTypeAction$('ic1'));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: ActionType.changeIndexColumnOrderType,
      payload: {
        id: 'ic1',
        indexId: 'idx1',
        columnId: 'c1',
        value: OrderType.DESC,
      },
    });
    expect(selectIndexColumn(store, 'ic1')?.orderType).toBe(OrderType.DESC);
  });

  it('toggles DESC back to ASC', () => {
    const { store, clock, emitted } = setup();
    store.dispatchSync(
      at(
        changeIndexColumnOrderTypeAction({
          id: 'ic1',
          indexId: 'idx1',
          columnId: 'c1',
          value: OrderType.DESC,
        }),
        1
      )
    );
    emitted.length = 0;
    clock.merge(2);

    store.dispatchSync(changeIndexColumnOrderTypeAction$('ic1'));

    expect(emitted[0].payload.value).toBe(OrderType.ASC);
    expect(selectIndexColumn(store, 'ic1')?.orderType).toBe(OrderType.ASC);
  });
});

describe('moveIndexColumnAction$', () => {
  it('does nothing when the id equals the target', () => {
    const { store, emitted } = withIndex();

    store.dispatchSync(moveIndexColumnAction$('ic1', 'ic1'));

    expect(emitted).toEqual([]);
  });

  it('does nothing when the index column does not exist', () => {
    const { store, emitted } = withIndex();

    store.dispatchSync(moveIndexColumnAction$('ghost', 'ic2'));

    expect(emitted).toEqual([]);
  });

  it('does nothing when the owning index does not exist', () => {
    const { store, emitted } = setup();
    store.dispatchSync(
      at(
        changeIndexColumnOrderTypeAction({
          id: 'ic1',
          indexId: 'ghostIndex',
          columnId: 'c1',
          value: OrderType.ASC,
        }),
        1
      )
    );
    emitted.length = 0;

    store.dispatchSync(moveIndexColumnAction$('ic1', 'ic2'));

    expect(emitted).toEqual([]);
  });

  it('dispatches a move carrying the owning index tableId', () => {
    const { store, emitted } = withIndex();
    for (const id of ['ic1', 'ic2']) {
      store.dispatchSync(
        at(
          addIndexColumnAction({
            id,
            indexId: 'idx1',
            tableId: 't1',
            columnId: id,
          }),
          1
        )
      );
    }
    emitted.length = 0;

    store.dispatchSync(moveIndexColumnAction$('ic1', 'ic2'));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: ActionType.moveIndexColumn,
      payload: { id: 'ic1', indexId: 'idx1', tableId: 't1', targetId: 'ic2' },
    });
    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual(['ic2', 'ic1']);
  });
});

describe('actions$', () => {
  it('exposes every generator action creator', () => {
    expect(Object.keys(actions$).sort()).toEqual([
      'addIndexColumnAction$',
      'changeIndexColumnOrderTypeAction$',
      'moveIndexColumnAction$',
      'removeIndexColumnAction$',
    ]);
    expect(actions$.addIndexColumnAction$).toBe(addIndexColumnAction$);
    expect(actions$.removeIndexColumnAction$).toBe(removeIndexColumnAction$);
    expect(actions$.changeIndexColumnOrderTypeAction$).toBe(
      changeIndexColumnOrderTypeAction$
    );
    expect(actions$.moveIndexColumnAction$).toBe(moveIndexColumnAction$);
  });
});
