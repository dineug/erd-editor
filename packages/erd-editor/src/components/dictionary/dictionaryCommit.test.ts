import type { CommitEvent, GridSelection } from '@dineug/grid';
import { type AnyAction, html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  type Mounted,
} from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import {
  commitDictionaryCells,
  createSheetRows,
  removeSelectedRows,
  selectedRowIds,
  type SheetRows,
} from '@/components/dictionary/dictionaryCommit';
import {
  bumpedSheets,
  sheetCellMark,
  sheetRowIds,
} from '@/components/dictionary/sheets';
import { DictionaryKind } from '@/engine/modules/dictionary/actions';
import {
  addDictionaryAction,
  removeDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import { openToastAction } from '@/utils/emitter';

type ToastPayload = ReturnType<typeof openToastAction>['payload'];

/** A sheet as the tab holds it: its rows, the grid's edit and the toasts the editor opened. */
type Sheet = {
  app: AppContext;
  kind: DictionaryKind;
  rows: SheetRows;
  editing: boolean;
  search: string;
  /** Whether the tab renders a bumped version at once, as it does between two events. */
  renders: boolean;
  toasts: ToastPayload[];
};

const cleanups: Array<() => void> = [];
let mounted: Mounted | null = null;

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
  mounted?.unmount();
  mounted = null;
});

const word = (id: string, name: string, values: Record<string, string> = {}) =>
  addDictionaryAction({
    kind: DictionaryKind.word,
    id,
    values: { name, ...values },
  });

const WORDS = [word('a', 'A'), word('b', 'B'), word('c', 'C'), word('d', 'D')];

/**
 * Opens a sheet over a store seeded with the actions, wired as the tab wires
 * it: a batch that raises the sheet takes its rows again under the next
 * version, which the grid receives as the tab renders.
 */
function open(
  kind: DictionaryKind,
  seed: AnyAction[] = WORDS,
  search = ''
): Sheet {
  const app = createTestAppContext();
  if (seed.length) app.store.dispatchSync(seed);

  const sheet: Sheet = {
    app,
    kind,
    rows: createSheetRows(sheetRowIds(app.store.state, kind, search)),
    editing: false,
    search,
    renders: true,
    toasts: [],
  };
  const unsubscribe = app.store.subscribe(actions => {
    if (!bumpedSheets(actions).includes(kind)) return;

    const { rows } = sheet;
    rows.bump(sheetRowIds(app.store.state, kind, sheet.search), sheet.editing);
    if (sheet.renders) rows.receive(rows.version);
  });
  const off = app.emitter.on({
    openToast: action => sheet.toasts.push(action.payload),
  });

  cleanups.push(() => {
    unsubscribe();
    off();
    app.emitter.clear();
    app.store.destroy();
  });
  return sheet;
}

const edit = (row: number, columnId: string, value: string): CommitEvent => ({
  source: 'edit',
  changes: [{ row, col: 0, columnId, value }],
});

const paste = (
  ...cells: Array<[row: number, columnId: string, value: string]>
): CommitEvent => ({
  source: 'paste',
  changes: cells.map(([row, columnId, value]) => ({
    row,
    col: 0,
    columnId,
    value,
  })),
});

const commit = (sheet: Sheet, event: CommitEvent) =>
  commitDictionaryCells(sheet.app, sheet.kind, sheet.rows, event);

const wordNames = ({ app }: Sheet) =>
  app.store.state.doc.wordIds.map(
    id => app.store.state.collections.wordEntities[id].name
  );

const toastKeys = ({ toasts }: Sheet) => toasts.map(({ key }) => key);

/** The text of the toast a payload carries, mounted as the container would. */
async function toastText(payload: ToastPayload) {
  mounted = await mountAndFlush(html`${payload.message}`);
  return mounted.container.textContent?.trim();
}

const removeWord = (sheet: Sheet, id: string) =>
  sheet.app.store.dispatchSync(
    removeDictionaryAction({ kind: DictionaryKind.word, id })
  );

describe('createSheetRows', () => {
  it('holds the rows of each version, and lets go of a version once the grid receives a newer one', () => {
    const rows = createSheetRows(['a', 'b']);

    expect(rows.version).toBe(0);
    expect(rows.ids).toEqual(['a', 'b']);

    expect(rows.bump(['a'])).toBe(1);
    expect(rows.ids).toEqual(['a']);
    expect(rows.receivedIds).toEqual(['a', 'b']);

    expect(rows.bump(['a', 'c'])).toBe(2);
    rows.receive(1);
    expect(rows.receivedIds).toEqual(['a', 'b']);

    rows.receive(2);
    expect(rows.receivedIds).toEqual(['a', 'c']);
    rows.receive(0);
    expect(rows.receivedIds).toEqual(['a', 'c']);
  });

  it('reads the active id off the rows the grid shows, as onReady selects and as each selection is reported', () => {
    const rows = createSheetRows(['a', 'b', 'c']);
    expect(rows.activeId).toBeNull();

    rows.activate(0);
    expect(rows.activeId).toBe('a');
    rows.activate(2);
    expect(rows.activeId).toBe('c');
    rows.activate(3);
    expect(rows.activeId).toBeNull();
  });

  it('records the active id after a bump when none is recorded, as rows come to an empty sheet', () => {
    const rows = createSheetRows();
    rows.activate(0);
    expect(rows.activeId).toBeNull();

    rows.bump(['x', 'y'], true);
    expect(rows.activeId).toBe('x');
  });

  it('takes the row the active cell shows after a bump with no edit open, and keeps the row an open edit opened on', () => {
    const rows = createSheetRows(['a', 'b', 'c', 'd']);
    rows.activate(2);

    rows.bump(['b', 'c', 'd']);
    expect(rows.activeId).toBe('d');

    rows.receive(rows.version);
    rows.activate(1);
    rows.bump(['c', 'd'], true);
    expect(rows.activeId).toBe('c');

    rows.receive(rows.version);
    rows.settle(true);
    expect(rows.activeId).toBe('c');
    rows.settle(false);
    expect(rows.activeId).toBe('d');
  });

  it('reads an edit by the active id and the active cell by its row again after it', () => {
    const rows = createSheetRows(['a', 'b', 'c']);
    rows.activate(1);
    rows.bump(['a', 'x', 'b', 'c'], true);
    rows.receive(rows.version);

    expect(rows.resolve(edit(1, 'name', 'B2'))).toEqual([
      { id: 'b', cells: { name: 'B2' } },
    ]);
    expect(rows.activeId).toBe('x');
  });

  it('reads an edit on no row as nothing', () => {
    const rows = createSheetRows();

    expect(rows.resolve(edit(0, 'name', 'A'))).toEqual([]);
  });

  it('reads a paste or a clear by the rows the grid received, row by row in order, new rows past the end', () => {
    const rows = createSheetRows(['a', 'b']);
    rows.bump(['b']);

    expect(
      rows.resolve(
        paste(
          [3, 'name', 'E'],
          [1, 'description', 'second'],
          [1, 'name', 'B2'],
          [2, 'name', 'D']
        )
      )
    ).toEqual([
      { id: 'b', cells: { description: 'second', name: 'B2' } },
      { id: null, cells: { name: 'D' } },
      { id: null, cells: { name: 'E' } },
    ]);
    expect(
      rows.resolve({
        source: 'clear',
        changes: [{ row: 0, col: 1, columnId: 'abbreviation', value: '' }],
      })
    ).toEqual([{ id: 'a', cells: { abbreviation: '' } }]);
  });
});

describe('commitDictionaryCells', () => {
  it('commits an edit to the row it opened on when a peer removes a row above it meanwhile', async () => {
    const sheet = open(DictionaryKind.word);
    sheet.rows.activate(2);
    sheet.editing = true;

    removeWord(sheet, 'a');
    sheet.editing = false;

    expect(commit(sheet, edit(2, 'name', 'C2'))).toBe(true);
    await flush();

    expect(wordNames(sheet)).toEqual(['B', 'C2', 'D']);
    expect(sheet.rows.activeId).toBe('d');
  });

  it("commits typing on the active cell before any gesture to the first row's id", async () => {
    const sheet = open(DictionaryKind.word);
    sheet.rows.activate(0);

    expect(commit(sheet, edit(0, 'abbreviation', 'AB'))).toBe(true);
    await flush();

    expect(sheet.app.store.state.collections.wordEntities.a.abbreviation).toBe(
      'AB'
    );
  });

  it('sends nothing for an edit whose row a peer removed, and says the row was removed', async () => {
    const sheet = open(DictionaryKind.word);
    sheet.rows.activate(1);
    sheet.editing = true;

    removeWord(sheet, 'b');
    sheet.editing = false;

    expect(commit(sheet, edit(1, 'name', 'B2'))).toBe(false);
    await flush();

    expect(wordNames(sheet)).toEqual(['A', 'C', 'D']);
    expect(sheet.app.store.state.collections.wordEntities.b.name).toBe('B');
    expect(toastKeys(sheet)).toEqual(['dictionary.toast.rowRemoved']);
    expect(await toastText(sheet.toasts[0])).toBe(
      'Nothing saved: the row was removed'
    );
  });

  it('commits a later edit to the row the active cell shows, once one that rows moved under was cancelled', async () => {
    const sheet = open(DictionaryKind.word);
    sheet.rows.activate(2);
    sheet.editing = true;

    removeWord(sheet, 'a');
    sheet.editing = false;
    sheet.rows.settle(false);

    expect(commit(sheet, edit(2, 'name', 'D2'))).toBe(true);
    await flush();

    expect(wordNames(sheet)).toEqual(['B', 'C', 'D2']);
  });

  it('adds the rows a paste reaches past the end, in their order, in one dispatch and one undo', async () => {
    const sheet = open(DictionaryKind.word, [word('a', 'A'), word('b', 'B')]);
    const { store } = sheet.app;
    const batches: AnyAction[][] = [];
    const unsubscribe = store.subscribe(actions => {
      if (bumpedSheets(actions).length) batches.push(actions);
    });
    const history = store.history.size;

    expect(
      commit(
        sheet,
        paste(
          [1, 'name', 'B2'],
          [2, 'name', 'C'],
          [2, 'abbreviation', 'CC'],
          [3, 'name', 'D']
        )
      )
    ).toBe(true);
    await flush();
    unsubscribe();

    expect(wordNames(sheet)).toEqual(['A', 'B2', 'C', 'D']);
    expect(sheet.rows.ids).toEqual(store.state.doc.wordIds);
    const added = store.state.doc.wordIds[2];
    expect(store.state.collections.wordEntities[added].abbreviation).toBe('CC');
    expect(batches).toHaveLength(1);
    expect(store.history.size).toBe(history + 1);

    store.undo();
    expect(wordNames(sheet)).toEqual(['A', 'B']);
  });

  it('reads a paste by the rows the grid last received, never by rows it has not drawn yet', async () => {
    const sheet = open(DictionaryKind.word);
    sheet.renders = false;

    removeWord(sheet, 'a');
    expect(sheet.rows.ids).toEqual(['b', 'c', 'd']);

    expect(commit(sheet, paste([1, 'description', 'second']))).toBe(true);
    await flush();

    const { wordEntities } = sheet.app.store.state.collections;
    expect(wordEntities.b.description).toBe('second');
    expect(wordEntities.c.description).toBe('');
  });

  it('sends nothing for a paste over a row a peer removed before the grid drew it', async () => {
    const sheet = open(DictionaryKind.word);
    sheet.renders = false;

    removeWord(sheet, 'b');

    expect(
      commit(sheet, paste([0, 'description', 'x'], [1, 'description', 'y']))
    ).toBe(false);
    await flush();

    expect(sheet.app.store.state.collections.wordEntities.a.description).toBe(
      ''
    );
    expect(toastKeys(sheet)).toEqual(['dictionary.toast.rowRemoved']);
  });

  it('drops the whole commit when any row is refused, with the rows refused and the first three names', async () => {
    const sheet = open(DictionaryKind.word, [
      ...WORDS,
      word('e', 'E'),
      word('f', 'F'),
    ]);
    const before = wordNames(sheet);

    expect(
      commit(
        sheet,
        paste(
          [4, 'abbreviation', 'fine'],
          [6, 'name', 'A'],
          [7, 'name', 'B '],
          [8, 'name', 'C'],
          [9, 'name', 'D']
        )
      )
    ).toBe(false);
    await flush();

    expect(wordNames(sheet)).toEqual(before);
    expect(sheet.app.store.state.collections.wordEntities.e.abbreviation).toBe(
      ''
    );
    expect(toastKeys(sheet)).toEqual([
      'dictionary.toast.duplicateNames:4:A\nB\nC',
    ]);
    expect(await toastText(sheet.toasts[0])).toBe(
      'Nothing saved: 4 rows share a name with another row (A, B, C)'
    );
  });

  it('frees the name a row of the commit renames, so two rows swap their names', async () => {
    const sheet = open(DictionaryKind.word, [word('a', 'A'), word('b', 'B')]);

    expect(commit(sheet, paste([0, 'name', 'B'], [1, 'name', 'A']))).toBe(true);
    await flush();

    expect(wordNames(sheet)).toEqual(['B', 'A']);
  });

  it('names a duplicate once however many rows of the commit write it, a name no listed row holds included', async () => {
    const sheet = open(DictionaryKind.word, [word('a', 'A')]);

    expect(commit(sheet, paste([1, 'name', 'X'], [2, 'name', 'X']))).toBe(
      false
    );
    expect(toastKeys(sheet)).toEqual(['dictionary.toast.duplicateNames:2:X']);
    expect(await toastText(sheet.toasts[0])).toBe(
      'Nothing saved: 2 rows share a name with another row (X)'
    );
  });

  describe("a term's domain", () => {
    const DOMAINS = [
      addDictionaryAction({
        kind: DictionaryKind.domain,
        id: 'money',
        values: { name: 'Money', dataType: 'DECIMAL(15,2)' },
      }),
      addDictionaryAction({
        kind: DictionaryKind.domain,
        id: 'name',
        values: { name: 'Name', dataType: 'VARCHAR(100)' },
      }),
      addDictionaryAction({
        kind: DictionaryKind.term,
        id: 'amount',
        values: { name: '금액', domainId: 'money' },
      }),
      addDictionaryAction({
        kind: DictionaryKind.term,
        id: 'balance',
        values: { name: '잔액' },
      }),
    ];

    const termOf = (sheet: Sheet, id: string) =>
      sheet.app.store.state.collections.termEntities[id];

    it('is written by the id of the listed domain the cell names, and unlinked by no name', async () => {
      const sheet = open(DictionaryKind.term, DOMAINS);

      expect(
        commit(sheet, paste([0, 'domainId', ' Name'], [1, 'domainId', 'Money']))
      ).toBe(true);
      await flush();
      expect(termOf(sheet, 'amount').domainId).toBe('name');
      expect(termOf(sheet, 'balance').domainId).toBe('money');

      expect(
        commit(sheet, {
          source: 'clear',
          changes: [{ row: 0, col: 2, columnId: 'domainId', value: '' }],
        })
      ).toBe(true);
      await flush();
      expect(termOf(sheet, 'amount').domainId).toBe('');
    });

    it('keeps the link a cell showed when its text comes back as it was, a removed domain included', async () => {
      const sheet = open(DictionaryKind.term, DOMAINS);
      sheet.app.store.dispatchSync(
        removeDictionaryAction({ kind: DictionaryKind.domain, id: 'money' })
      );

      expect(
        commit(
          sheet,
          paste(
            [0, 'domainId', ''],
            [0, 'description', 'kept'],
            [1, 'domainId', '']
          )
        )
      ).toBe(true);
      await flush();

      expect(termOf(sheet, 'amount')).toMatchObject({
        domainId: 'money',
        description: 'kept',
      });
      expect(termOf(sheet, 'balance').domainId).toBe('');
    });

    it("unlinks a removed domain when its cell is cleared, which takes the cell's mark away", async () => {
      const sheet = open(DictionaryKind.term, DOMAINS);
      const mark = () =>
        sheetCellMark(
          sheet.app.store.state,
          DictionaryKind.term,
          'amount',
          'domainId'
        );
      sheet.app.store.dispatchSync(
        removeDictionaryAction({ kind: DictionaryKind.domain, id: 'money' })
      );
      expect(mark()).toBe('error');

      expect(
        commit(sheet, {
          source: 'clear',
          changes: [{ row: 0, col: 2, columnId: 'domainId', value: '' }],
        })
      ).toBe(true);
      await flush();

      expect(termOf(sheet, 'amount').domainId).toBe('');
      expect(mark()).toBeNull();
    });

    it('refuses the whole commit for a name no listed domain has, naming it', async () => {
      const sheet = open(DictionaryKind.term, DOMAINS);

      expect(
        commit(
          sheet,
          paste(
            [0, 'domainId', 'Nope'],
            [1, 'domainId', 'Name'],
            [2, 'name', '잔액'],
            [2, 'domainId', 'Gone ']
          )
        )
      ).toBe(false);
      await flush();

      expect(termOf(sheet, 'amount').domainId).toBe('money');
      expect(termOf(sheet, 'balance').domainId).toBe('');
      expect(toastKeys(sheet)).toEqual([
        'dictionary.toast.duplicateNames:1:잔액',
        'dictionary.toast.unknownDomainNames:2:Nope\nGone',
      ]);
      expect(await toastText(sheet.toasts[1])).toBe(
        'Nothing saved: 2 rows name an unknown domain (Nope, Gone)'
      );
    });

    it('counts the rows that name an unknown domain, however few names they share', async () => {
      const sheet = open(DictionaryKind.term, DOMAINS);

      expect(
        commit(sheet, paste([0, 'domainId', 'X'], [1, 'domainId', 'X']))
      ).toBe(false);
      expect(toastKeys(sheet)).toEqual([
        'dictionary.toast.unknownDomainNames:2:X',
      ]);
      expect(await toastText(sheet.toasts[0])).toBe(
        'Nothing saved: 2 rows name an unknown domain (X)'
      );
    });

    it('lists the names a refusal names each in its own direction under a right-to-left language', async () => {
      const sheet = open(DictionaryKind.term, DOMAINS);

      expect(
        commitDictionaryCells(
          sheet.app,
          DictionaryKind.term,
          sheet.rows,
          paste([0, 'domainId', 'Nope'], [1, 'domainId', 'None']),
          { locale: 'ar-SA', dir: 'rtl' }
        )
      ).toBe(false);
      expect(toastKeys(sheet)).toEqual([
        'dictionary.toast.unknownDomainNames:2:Nope\nNone',
      ]);
      const text = await toastText(sheet.toasts[0]);
      expect(text).toContain('\u2068Nope\u2069');
      expect(text).toContain('\u2068None\u2069');
    });
  });

  it('passes over a column the sheet has no field of', async () => {
    const sheet = open(DictionaryKind.word);

    expect(
      commit(sheet, paste([0, 'domainId', 'x'], [0, 'description', 'y']))
    ).toBe(true);
    await flush();

    expect(sheet.app.store.state.collections.wordEntities.a).toMatchObject({
      name: 'A',
      description: 'y',
    });
  });

  it('sends nothing for an edit on no row', () => {
    const sheet = open(DictionaryKind.word, []);

    expect(commit(sheet, edit(0, 'name', 'A'))).toBe(false);
    expect(sheet.toasts).toEqual([]);
  });
});

const selection = (
  ...ranges: Array<[startRow: number, endRow: number]>
): GridSelection => ({
  active: { row: ranges[0]?.[0] ?? 0, col: 0 },
  ranges: ranges.map(([startRow, endRow]) => ({
    startRow,
    startCol: 0,
    endRow,
    endCol: 2,
  })),
});

describe('removeSelectedRows', () => {
  it('reads each row the ranges cover once, in sheet order, past the end left out', () => {
    const rows = createSheetRows(['a', 'b', 'c', 'd']);

    expect(selectedRowIds(rows, selection([2, 3], [0, 0], [3, 9]))).toEqual([
      'a',
      'c',
      'd',
    ]);
    expect(selectedRowIds(rows, selection([-2, 0], [4, 6]))).toEqual(['a']);
  });

  it('removes the rows in one dispatch, which one undo lists again with their values', async () => {
    const sheet = open(DictionaryKind.word, [
      ...WORDS,
      word('e', 'E', { abbreviation: 'EE' }),
    ]);
    const { store } = sheet.app;
    const batches: AnyAction[][] = [];
    const unsubscribe = store.subscribe(actions => {
      if (bumpedSheets(actions).length) batches.push(actions);
    });
    const history = store.history.size;

    expect(
      removeSelectedRows(
        store,
        DictionaryKind.word,
        sheet.rows,
        selection([1, 1], [3, 4])
      )
    ).toBe(true);
    await flush();
    unsubscribe();

    expect(wordNames(sheet)).toEqual(['A', 'C']);
    expect(sheet.rows.ids).toEqual(['a', 'c']);
    expect(batches).toHaveLength(1);
    expect(batches[0].map(({ payload }) => payload.id)).toEqual([
      'e',
      'd',
      'b',
    ]);
    expect(store.history.size).toBe(history + 1);

    store.undo();
    expect([...wordNames(sheet)].sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(store.state.collections.wordEntities.e.abbreviation).toBe('EE');
  });

  it('removes nothing for a selection over no row', () => {
    const sheet = open(DictionaryKind.word, []);

    expect(
      removeSelectedRows(
        sheet.app.store,
        DictionaryKind.word,
        sheet.rows,
        selection([0, 0])
      )
    ).toBe(false);
  });
});
