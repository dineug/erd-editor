import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { createEngineContext } from '@/engine/context';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import {
  getColoredSelection,
  getColorTargets,
  hasColoredSelection,
} from '@/engine/modules/editor/utils/color';
import {
  addMemoAction,
  changeMemoColorAction,
} from '@/engine/modules/memo/atom.actions';
import {
  addTableAction,
  changeTableColorAction,
} from '@/engine/modules/table/atom.actions';
import { createStore, Store } from '@/engine/store';

let store: Store;

beforeEach(() => {
  store = createStore(
    createEngineContext({ toWidth: text => text.length * 10 }),
    false
  );
  store.dispatchSync(
    addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 2 } }),
    addTableAction({ id: 't2', ui: { x: 400, y: 0, zIndex: 2 } }),
    addMemoAction({ id: 'm1', ui: { x: 0, y: 400, zIndex: 2 } }),
    addMemoAction({ id: 'm2', ui: { x: 400, y: 400, zIndex: 2 } }),
    changeTableColorAction({ id: 't1', color: '#ff0000', prevColor: '' }),
    changeMemoColorAction({ id: 'm1', color: '#00ff00', prevColor: '' })
  );
});

const idsOf = (state: Store['state']) => {
  const { tables, memos } = getColoredSelection(state);
  return [...tables, ...memos].map(entity => entity.id);
};

describe('getColorTargets', () => {
  it('holds every selected table and memo, colored or not', () => {
    store.dispatchSync(
      selectAction({
        t2: SelectType.table,
        m1: SelectType.memo,
        t1: SelectType.table,
      })
    );
    const { tables, memos } = getColorTargets(store.state);

    expect(tables.map(table => table.id)).toEqual(['t2', 't1']);
    expect(memos.map(memo => memo.id)).toEqual(['m1']);
  });
});

describe('getColoredSelection', () => {
  it('holds the selected tables and memos that carry a color', () => {
    store.dispatchSync(
      selectAction({
        t1: SelectType.table,
        t2: SelectType.table,
        m1: SelectType.memo,
        m2: SelectType.memo,
      })
    );

    expect(idsOf(store.state)).toEqual(['t1', 'm1']);
  });

  it('leaves out a colored entity outside the selection', () => {
    store.dispatchSync(selectAction({ t2: SelectType.table }));

    expect(idsOf(store.state)).toEqual([]);
  });
});

describe('hasColoredSelection', () => {
  it('is true while a selected table or memo carries a color', () => {
    store.dispatchSync(selectAction({ m1: SelectType.memo }));

    expect(hasColoredSelection(store.state)).toBe(true);
  });

  it('is false for a selection of uncolored entities or for none', () => {
    expect(hasColoredSelection(store.state)).toBe(false);

    store.dispatchSync(
      selectAction({ t2: SelectType.table, m2: SelectType.memo })
    );

    expect(hasColoredSelection(store.state)).toBe(false);
  });
});
