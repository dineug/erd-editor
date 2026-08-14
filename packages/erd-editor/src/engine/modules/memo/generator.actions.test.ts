import { AnyAction, compositionActionsFlat } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '@/engine/clock';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { ActionType } from '@/engine/modules/memo/actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  actions$,
  addMemoAction$,
  removeMemoAction$,
  selectMemoAction$,
} from '@/engine/modules/memo/generator.actions';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { createStore, Store } from '@/engine/store';

function createTestStore(): Store {
  return createStore({ toWidth: text => text.length * 10, clock: new Clock() });
}

function flatten(store: Store, action: any): AnyAction[] {
  return compositionActionsFlat(store.state, store.context, [action]);
}

function typesOf(store: Store, action: any): string[] {
  return flatten(store, action).map(({ type }) => type);
}

function memoOf(store: Store, id: string) {
  return store.state.collections.memoEntities[id];
}

let store: Store;

beforeEach(() => {
  store = createTestStore();
});

describe('actions$', () => {
  it('exports every generator action', () => {
    expect(Object.keys(actions$).sort()).toEqual([
      'addMemoAction$',
      'removeMemoAction$',
      'selectMemoAction$',
    ]);
  });
});

describe('addMemoAction$', () => {
  it('emits unselectAll, select and add in that order', () => {
    expect(typesOf(store, addMemoAction$())).toEqual([
      'editor.unselectAll',
      'editor.focusTableEnd',
      'editor.select',
      ActionType.addMemo,
    ]);
  });

  it('creates a memo at the default start point and selects it', () => {
    store.dispatchSync(addMemoAction$());

    expect(store.state.doc.memoIds).toHaveLength(1);
    const id = store.state.doc.memoIds[0];
    expect(memoOf(store, id).ui.x).toBe(200);
    expect(memoOf(store, id).ui.y).toBe(100);
    expect(store.state.editor.selectedMap).toEqual({ [id]: SelectType.memo });
  });

  it('stacks the new memo above every existing table and memo', () => {
    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 12 } })
    );
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 30 } })
    );

    store.dispatchSync(addMemoAction$());

    const id = store.state.doc.memoIds.filter(it => it !== 'm1')[0];
    expect(memoOf(store, id).ui.zIndex).toBe(31);
  });

  it('shifts the point away from an entity already sitting at the start point', () => {
    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 200, y: 100, zIndex: 2 } })
    );

    store.dispatchSync(addMemoAction$());

    const id = store.state.doc.memoIds[0];
    expect(memoOf(store, id).ui.x).toBe(250);
    expect(memoOf(store, id).ui.y).toBe(150);
  });

  it('honours the canvas scroll offset', () => {
    store.dispatchSync(scrollToAction({ scrollLeft: -30, scrollTop: -10 }));

    store.dispatchSync(addMemoAction$());

    const id = store.state.doc.memoIds[0];
    expect(memoOf(store, id).ui.x).toBe(230);
    expect(memoOf(store, id).ui.y).toBe(110);
  });

  it('drops any previous selection', () => {
    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    store.dispatchSync(selectAction({ t1: SelectType.table }));

    store.dispatchSync(addMemoAction$());

    expect(Object.keys(store.state.editor.selectedMap)).toHaveLength(1);
    expect(store.state.editor.selectedMap.t1).toBeUndefined();
  });
});

describe('removeMemoAction$', () => {
  it('removes exactly the given id and ignores the selection', () => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } }),
      addMemoAction({ id: 'm2', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    store.dispatchSync(selectAction({ m2: SelectType.memo }));

    store.dispatchSync(removeMemoAction$('m1'));

    expect(store.state.doc.memoIds).toEqual(['m2']);
  });

  it('emits a single remove when an id is given', () => {
    expect(typesOf(store, removeMemoAction$('m1'))).toEqual([
      ActionType.removeMemo,
    ]);
  });

  it('removes every selected memo when no id is given', () => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } }),
      addMemoAction({ id: 'm2', ui: { x: 0, y: 0, zIndex: 2 } }),
      addMemoAction({ id: 'm3', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    store.dispatchSync(
      selectAction({ m1: SelectType.memo, m3: SelectType.memo })
    );

    store.dispatchSync(removeMemoAction$());

    expect(store.state.doc.memoIds).toEqual(['m2']);
  });

  it('skips selected entries that are not memos', () => {
    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    store.dispatchSync(
      selectAction({ t1: SelectType.table, m1: SelectType.memo })
    );

    const flat = flatten(store, removeMemoAction$());

    expect(flat).toHaveLength(1);
    expect(flat[0].payload).toEqual({ id: 'm1' });
    expect(store.state.doc.tableIds).toEqual(['t1']);
  });

  it('emits nothing when nothing is selected', () => {
    expect(flatten(store, removeMemoAction$())).toEqual([]);
  });
});

describe('selectMemoAction$', () => {
  beforeEach(() => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } }),
      addMemoAction({ id: 'm2', ui: { x: 0, y: 0, zIndex: 5 } })
    );
  });

  it('replaces the selection and raises the zIndex when $mod is false', () => {
    store.dispatchSync(selectAction({ m2: SelectType.memo }));

    store.dispatchSync(selectMemoAction$('m1', false));

    expect(store.state.editor.selectedMap).toEqual({ m1: SelectType.memo });
    expect(memoOf(store, 'm1').ui.zIndex).toBe(6);
  });

  it('emits unselectAll before selecting when $mod is false', () => {
    expect(typesOf(store, selectMemoAction$('m1', false))).toEqual([
      'editor.unselectAll',
      'editor.focusTableEnd',
      'editor.select',
      ActionType.changeZIndex,
    ]);
  });

  it('keeps the existing selection when $mod is true', () => {
    store.dispatchSync(selectAction({ m2: SelectType.memo }));

    store.dispatchSync(selectMemoAction$('m1', true));

    expect(store.state.editor.selectedMap).toEqual({
      m1: SelectType.memo,
      m2: SelectType.memo,
    });
    expect(typesOf(store, selectMemoAction$('m1', true))).toEqual([
      'editor.select',
      ActionType.changeZIndex,
    ]);
  });

  it('takes tables into account when computing the next zIndex', () => {
    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 20 } })
    );

    store.dispatchSync(selectMemoAction$('m1', false));

    expect(memoOf(store, 'm1').ui.zIndex).toBe(21);
  });

  it('creates and selects an unknown memo id', () => {
    store.dispatchSync(selectMemoAction$('ghost', false));

    expect(store.state.editor.selectedMap).toEqual({ ghost: SelectType.memo });
    expect(memoOf(store, 'ghost')).toBeDefined();
    expect(store.state.doc.memoIds).toEqual(['m1', 'm2']);
  });
});
