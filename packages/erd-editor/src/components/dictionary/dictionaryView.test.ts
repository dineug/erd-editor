import type { GridSelection } from '@dineug/grid';
import { watch } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import {
  changeSearch,
  clampSelection,
  dictionaryViewOf,
  FIRST_CELL_SELECTION,
  rememberScroll,
  rememberSelection,
  rememberWidth,
  restoreScroll,
  storedSelection,
} from '@/components/dictionary/dictionaryView';
import { sheetColumns } from '@/components/dictionary/sheets';
import { DictionaryKind } from '@/engine/modules/dictionary/actions';

const apps: AppContext[] = [];

function createApp(): AppContext {
  const app = createTestAppContext();
  apps.push(app);
  return app;
}

afterEach(() => {
  apps.splice(0).forEach(app => app.store.destroy());
});

const selection = (
  active: [number, number],
  ...ranges: Array<[number, number, number, number]>
): GridSelection => ({
  active: { row: active[0], col: active[1] },
  ranges: ranges.map(([startRow, startCol, endRow, endCol]) => ({
    startRow,
    startCol,
    endRow,
    endCol,
  })),
});

describe('dictionaryViewOf', () => {
  it('opens on the domains, every sheet with no search, selection, scroll or width of its own', () => {
    const view = dictionaryViewOf(createApp());

    expect(view.sheet).toBe('domain');
    expect(Object.keys(view.sheets)).toEqual([
      'domain',
      'word',
      'term',
      'check',
    ]);
    for (const sheet of Object.values(view.sheets)) {
      expect({ ...sheet }).toEqual({
        search: '',
        selection: null,
        scroll: null,
        widths: {},
      });
    }
  });

  it('keeps one view per editor, never shared with another', () => {
    const app = createApp();
    const other = createApp();

    expect(dictionaryViewOf(app)).toBe(dictionaryViewOf({ store: app.store }));
    expect(dictionaryViewOf(other)).not.toBe(dictionaryViewOf(app));

    dictionaryViewOf(app).sheet = 'term';
    changeSearch(dictionaryViewOf(app), 'term', '고객');
    expect(dictionaryViewOf(other).sheet).toBe('domain');
    expect(dictionaryViewOf(other).sheets.term.search).toBe('');
  });

  it('tells a watcher of a sheet what changed in it, and dispatches nothing', async () => {
    const app = createApp();
    const view = dictionaryViewOf(app);
    const changed: Array<string | number | symbol> = [];
    const dispatched = vi.fn();
    const stopWatching = watch(view.sheets.word).subscribe(name =>
      changed.push(name)
    );
    const unsubscribe = app.store.subscribe(dispatched);

    changeSearch(view, 'word', 'cust');
    rememberWidth(view, 'word', 'name', 200);
    await flush();

    expect(changed).toEqual(['search', 'widths']);
    expect(dispatched).not.toHaveBeenCalled();
    stopWatching();
    unsubscribe();
  });
});

describe('changeSearch', () => {
  it("drops the selection and the scroll the old search's rows were counted in", () => {
    const view = dictionaryViewOf(createApp());
    rememberSelection(view, 'term', selection([3, 1], [3, 1, 3, 1]));
    rememberScroll(view, 'term', { rowStart: 40, colStart: 0 });

    changeSearch(view, 'term', '');
    expect(view.sheets.term.selection).not.toBeNull();

    changeSearch(view, 'term', '주문');
    expect(view.sheets.term).toMatchObject({
      search: '주문',
      selection: null,
      scroll: null,
    });
    expect(view.sheets.word.search).toBe('');
  });
});

describe('selection', () => {
  it('keeps a frozen copy of the selection, never the object it was handed', () => {
    const view = dictionaryViewOf(createApp());
    const handed = selection([2, 1], [0, 0, 1, 1], [2, 1, 4, 1]);

    rememberSelection(view, 'word', handed);
    handed.ranges[0].endRow = 9;
    const kept = view.sheets.word.selection!;

    expect(kept).toEqual(selection([2, 1], [0, 0, 1, 1], [2, 1, 4, 1]));
    expect(Object.isFrozen(kept)).toBe(true);
    expect(Object.isFrozen(kept.active)).toBe(true);
    expect(Object.isFrozen(kept.ranges[1])).toBe(true);
  });

  it('hands a grid a fresh copy held inside its rows, the first cell when none was kept', () => {
    const view = dictionaryViewOf(createApp());

    expect(storedSelection(view, 'domain', 10, 4)).toEqual(
      selection([0, 0], [0, 0, 0, 0])
    );
    expect(storedSelection(view, 'domain', 10, 4)).not.toBe(
      FIRST_CELL_SELECTION
    );

    rememberSelection(view, 'domain', selection([8, 3], [5, 2, 9, 3]));
    const handed = storedSelection(view, 'domain', 6, 3);

    expect(handed).toEqual(selection([5, 2], [5, 2, 5, 2]));
    expect(Object.isFrozen(handed)).toBe(false);
    expect(Object.isFrozen(handed.ranges[0])).toBe(false);
  });

  it('cuts every index to the last row and column and keeps a range start before end', () => {
    expect(
      clampSelection(selection([-1, 7], [4, 9, -2, 1], [1, 1, 2, 2]), 3, 5)
    ).toEqual(selection([0, 4], [0, 1, 2, 4], [1, 1, 2, 2]));
    expect(clampSelection(selection([5, 5], [5, 5, 6, 6]), 0, 0)).toEqual(
      selection([0, 0], [0, 0, 0, 0])
    );
  });
});

describe('scroll', () => {
  it('keeps the first cell a viewport report showed, writing nothing for the same one', async () => {
    const view = dictionaryViewOf(createApp());
    const changed: Array<string | number | symbol> = [];
    const stop = watch(view.sheets.term).subscribe(name => changed.push(name));

    rememberScroll(view, 'term', { rowStart: 120, colStart: 2 });
    const kept = view.sheets.term.scroll;
    rememberScroll(view, 'term', { rowStart: 120, colStart: 2 });
    await flush();

    expect(kept).toEqual({ row: 120, col: 2 });
    expect(view.sheets.term.scroll).toBe(kept);
    expect(changed).toEqual(['scroll']);
    stop();
  });

  it('scrolls to the last cell first, then back up to the kept one held inside the grid', () => {
    const view = dictionaryViewOf(createApp());
    const handle = { scrollTo: vi.fn() };

    restoreScroll(handle, view, 'word', 100, 6);
    expect(handle.scrollTo).not.toHaveBeenCalled();

    rememberScroll(view, 'word', { rowStart: 40, colStart: 2 });
    restoreScroll(handle, view, 'word', 100, 6);
    expect(handle.scrollTo.mock.calls).toEqual([
      [99, 5],
      [40, 2],
    ]);

    handle.scrollTo.mockClear();
    restoreScroll(handle, view, 'word', 30, 2);
    expect(handle.scrollTo.mock.calls).toEqual([
      [29, 1],
      [29, 1],
    ]);

    handle.scrollTo.mockClear();
    restoreScroll(handle, view, 'word', 0, 6);
    expect(handle.scrollTo).not.toHaveBeenCalled();
  });
});

describe('rememberWidth', () => {
  it('replaces the widths whole, which the sheet then opens its columns at', () => {
    const view = dictionaryViewOf(createApp());
    const before = view.sheets.domain.widths;

    rememberWidth(view, 'domain', 'dataType', 96);
    const after = view.sheets.domain.widths;
    rememberWidth(view, 'domain', 'dataType', 96);

    expect(after).not.toBe(before);
    expect(view.sheets.domain.widths).toBe(after);
    expect(Object.isFrozen(after)).toBe(true);
    expect(
      sheetColumns(DictionaryKind.domain, {
        readonly: false,
        widths: view.sheets.domain.widths,
      }).map(({ width }) => width)
    ).toEqual([160, 120, 96, 280]);
  });
});
