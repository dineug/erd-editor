import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { createEngineContext } from '@/engine/context';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import {
  getColoredSelection,
  getColorTargets,
  getDocumentColors,
  hasColoredSelection,
} from '@/engine/modules/editor/utils/color';
import {
  addMemoAction,
  changeMemoColorAction,
  removeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import {
  addTableAction,
  changeTableColorAction,
  removeTableAction,
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

describe('getDocumentColors', () => {
  /** Paints each entity named, the base t1 and m1 included. */
  const paint = (colors: Record<string, string>) =>
    store.dispatchSync(
      Object.entries(colors).map(([id, color]) =>
        id.startsWith('t')
          ? changeTableColorAction({ id, color, prevColor: '' })
          : changeMemoColorAction({ id, color, prevColor: '' })
      )
    );

  it('lists the tables before the memos, each in document order', () => {
    paint({ m2: '#0000ff', t2: '#ffff00' });

    expect(getDocumentColors(store.state)).toEqual([
      '#ff0000',
      '#ffff00',
      '#00ff00',
      '#0000ff',
    ]);
  });

  it('puts the most used first and keeps a tie in the order it first shows', () => {
    paint({ t2: '#0000ff', m2: '#0000ff' });

    expect(getDocumentColors(store.state)).toEqual([
      '#0000ff',
      '#ff0000',
      '#00ff00',
    ]);
  });

  it('reads three spellings of one color as one entry, which then leads', () => {
    paint({ t2: '#FF8800', m1: 'rgb(255, 136, 0)', m2: '#ff880080' });

    expect(getDocumentColors(store.state)).toEqual(['#ff8800', '#ff0000']);
  });

  it('leaves out an empty color and one it cannot read', () => {
    paint({ t1: 'red' });

    expect(store.state.collections.tableEntities.t2.ui.color).toBe('');
    expect(getDocumentColors(store.state)).toEqual(['#00ff00']);
  });

  it('leaves out a table or memo the document no longer lists', () => {
    store.dispatchSync(
      removeTableAction({ id: 't1' }),
      removeMemoAction({ id: 'm1' })
    );

    expect(store.state.collections.tableEntities.t1.ui.color).toBe('#ff0000');
    expect(store.state.collections.memoEntities.m1.ui.color).toBe('#00ff00');
    expect(getDocumentColors(store.state)).toEqual([]);
  });

  it('is empty for a document with no color', () => {
    paint({ t1: '', m1: '' });

    expect(getDocumentColors(store.state)).toEqual([]);
  });
});
