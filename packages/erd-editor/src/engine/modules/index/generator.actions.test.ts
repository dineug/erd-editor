import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import { ActionType } from '@/engine/modules/index/actions';
import { addIndexAction } from '@/engine/modules/index/atom.actions';
import {
  actions$,
  addIndexAction$,
  changeIndexUniqueAction$,
} from '@/engine/modules/index/generator.actions';
import { createStore, Store } from '@/engine/store';

function setup() {
  const clock = new Clock();
  const store = createStore({ toWidth: text => text.length * 10, clock });
  const emitted: AnyAction[] = [];
  store.subscribe(list => emitted.push(...list));
  return { store, clock, emitted };
}

const selectIndex = (store: Store, id: string) =>
  query(store.state.collections).collection('indexEntities').selectById(id);

describe('addIndexAction$', () => {
  it('dispatches an addIndex action with a generated id', () => {
    const { store, emitted } = setup();

    store.dispatchSync(addIndexAction$('t1'));

    expect(emitted).toHaveLength(1);
    expect(emitted[0].type).toBe(ActionType.addIndex);
    expect(emitted[0].payload.tableId).toBe('t1');
    expect(typeof emitted[0].payload.id).toBe('string');
    expect(emitted[0].payload.id.length).toBeGreaterThan(0);

    expect(store.state.doc.indexIds).toEqual([emitted[0].payload.id]);
    expect(selectIndex(store, emitted[0].payload.id)?.tableId).toBe('t1');
  });

  it('generates a fresh id on every call', () => {
    const { store, emitted } = setup();

    store.dispatchSync(addIndexAction$('t1'));
    store.dispatchSync(addIndexAction$('t1'));

    expect(emitted[0].payload.id).not.toBe(emitted[1].payload.id);
    expect(store.state.doc.indexIds).toHaveLength(2);
  });
});

describe('changeIndexUniqueAction$', () => {
  it('does nothing when the index does not exist', () => {
    const { store, emitted } = setup();

    store.dispatchSync(changeIndexUniqueAction$('ghost'));

    expect(emitted).toEqual([]);
    expect(store.state.lww).toEqual({});
  });

  it('toggles unique from false to true using the index tableId', () => {
    const { store, clock, emitted } = setup();
    store.dispatchSync(addIndexAction({ id: 'i1', tableId: 't1' }));
    clock.merge(1);
    emitted.length = 0;

    store.dispatchSync(changeIndexUniqueAction$('i1'));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: ActionType.changeIndexUnique,
      payload: { id: 'i1', tableId: 't1', value: true },
    });
    expect(selectIndex(store, 'i1')?.unique).toBe(true);
  });

  it('toggles unique back to false', () => {
    const { store, clock, emitted } = setup();
    store.dispatchSync(addIndexAction({ id: 'i1', tableId: 't1' }));
    clock.merge(1);
    store.dispatchSync(changeIndexUniqueAction$('i1'));
    clock.merge(2);
    emitted.length = 0;

    store.dispatchSync(changeIndexUniqueAction$('i1'));

    expect(emitted[0].payload.value).toBe(false);
    expect(selectIndex(store, 'i1')?.unique).toBe(false);
  });
});

describe('actions$', () => {
  it('exposes every generator action creator', () => {
    expect(Object.keys(actions$).sort()).toEqual([
      'addIndexAction$',
      'changeIndexUniqueAction$',
    ]);
    expect(actions$.addIndexAction$).toBe(addIndexAction$);
    expect(actions$.changeIndexUniqueAction$).toBe(changeIndexUniqueAction$);
  });
});
