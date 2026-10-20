import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, pseudoMessages } from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import {
  bumpedSheets,
  DictionarySheet,
  DictionarySheetLabelKey,
  DictionarySheetList,
  isEntrySheet,
  sheetCellText,
  sheetColumns,
  sheetField,
  sheetRowIds,
  toSearchText,
} from '@/components/dictionary/sheets';
import { DictionaryKind } from '@/engine/modules/dictionary/actions';
import {
  addDictionaryAction,
  removeDictionaryAction,
  updateDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import {
  clearAction,
  initialClearAction,
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  moveTableAction,
} from '@/engine/modules/table/atom.actions';
import { changeColumnNameAction } from '@/engine/modules/table-column/atom.actions';
import { createI18n } from '@/i18n/translate';

const apps: AppContext[] = [];

afterEach(() => {
  apps.splice(0).forEach(app => app.store.destroy());
});

function setup(...seed: AnyAction[]): AppContext {
  const app = createTestAppContext();
  apps.push(app);
  if (seed.length) app.store.dispatchSync(seed);
  return app;
}

const word = (id: string, values: Record<string, string>) =>
  addDictionaryAction({ kind: DictionaryKind.word, id, values });

const term = (id: string, values: Record<string, string>) =>
  addDictionaryAction({ kind: DictionaryKind.term, id, values });

const domain = (id: string, values: Record<string, string>) =>
  addDictionaryAction({ kind: DictionaryKind.domain, id, values });

describe('DictionarySheet', () => {
  it('lists the words, terms and domains, then the checks, each labelled', () => {
    expect(DictionarySheetList).toEqual(['word', 'term', 'domain', 'check']);
    expect(
      DictionarySheetList.map(sheet => DictionarySheetLabelKey[sheet])
    ).toEqual([
      'dictionary.sheet.words',
      'dictionary.sheet.terms',
      'dictionary.sheet.domains',
      'dictionary.sheet.checks',
    ]);
    expect(DictionarySheetList.filter(isEntrySheet)).toEqual([
      'word',
      'term',
      'domain',
    ]);
  });
});

describe('sheetColumns', () => {
  it('gives each dictionary one column per field, in the order its rows hold them', () => {
    const columns = (kind: DictionaryKind) =>
      sheetColumns(kind, { readonly: false }).map(({ id, label }) => [
        id,
        label,
      ]);

    expect(columns(DictionaryKind.word)).toEqual([
      ['name', 'Word'],
      ['abbreviation', 'Abbreviation'],
      ['englishName', 'English Name'],
      ['description', 'Description'],
      ['synonyms', 'Synonyms'],
      ['forbiddenWords', 'Forbidden Words'],
    ]);
    expect(columns(DictionaryKind.term)).toEqual([
      ['name', 'Term'],
      ['physicalName', 'Physical Name'],
      ['domainId', 'Domain'],
      ['description', 'Description'],
      ['synonyms', 'Synonyms'],
    ]);
    expect(columns(DictionaryKind.domain)).toEqual([
      ['name', 'Domain'],
      ['category', 'Category'],
      ['dataType', 'Data Type'],
      ['description', 'Description'],
    ]);
  });

  it('labels each column in the language it is handed', () => {
    const i18n = createI18n('ko-KR', pseudoMessages('ko'));

    expect(
      sheetColumns(DictionaryKind.domain, { readonly: false }, i18n).map(
        ({ label }) => label
      )
    ).toEqual(['ko:Domain', 'ko:Category', 'ko:Data Type', 'ko:Description']);
  });

  it('opens each column at its own width and takes the width a resize left', () => {
    const widths = (resized?: Record<string, number>) =>
      sheetColumns(DictionaryKind.term, {
        readonly: false,
        widths: resized,
      }).map(({ width }) => width);

    expect(widths()).toEqual([180, 180, 140, 280, 160]);
    expect(widths({ domainId: 96, other: 10 })).toEqual([
      180, 180, 96, 280, 160,
    ]);
  });

  it('makes every column read-only while the document is', () => {
    const readonlyOf = (readonly: boolean) =>
      DictionarySheetList.filter(isEntrySheet).flatMap(kind =>
        sheetColumns(kind, { readonly }).map(column => column.readonly)
      );

    expect(readonlyOf(true).every(Boolean)).toBe(true);
    expect(readonlyOf(false).some(Boolean)).toBe(false);
  });
});

describe('sheetField', () => {
  it('reads a column id as its field, and refuses an id the sheet has no column of', () => {
    expect(sheetField(DictionaryKind.term, 'domainId')).toBe('domainId');
    expect(sheetField(DictionaryKind.word, 'domainId')).toBeUndefined();
    expect(sheetField(DictionaryKind.domain, 'id')).toBeUndefined();
  });
});

describe('sheetCellText', () => {
  it('shows each field as the row holds it, and nothing for an id with no row or a column the sheet lacks', () => {
    const { store } = setup(
      word('w', { name: '고객', abbreviation: 'CUST', synonyms: '손님' })
    );

    expect(sheetCellText(store.state, DictionaryKind.word, 'w', 'name')).toBe(
      '고객'
    );
    expect(
      sheetCellText(store.state, DictionaryKind.word, 'w', 'abbreviation')
    ).toBe('CUST');
    expect(
      sheetCellText(store.state, DictionaryKind.word, 'w', 'englishName')
    ).toBe('');
    expect(sheetCellText(store.state, DictionaryKind.word, 'w', 'id')).toBe('');
    expect(sheetCellText(store.state, DictionaryKind.word, 'x', 'name')).toBe(
      ''
    );
    expect(sheetCellText(store.state, DictionaryKind.word, 'w', 'ui')).toBe('');
  });

  it("shows a term's domain by the name of the listed domain it links, else nothing", () => {
    const { store } = setup(
      domain('d', { name: 'Money', dataType: 'DECIMAL(15,2)' }),
      term('t', { name: '금액', domainId: 'd' }),
      term('u', { name: '잔액', domainId: 'gone' })
    );
    const domainOf = (id: string) =>
      sheetCellText(store.state, DictionaryKind.term, id, 'domainId');

    expect(domainOf('t')).toBe('Money');
    expect(domainOf('u')).toBe('');

    store.dispatchSync(
      updateDictionaryAction({
        kind: DictionaryKind.domain,
        id: 'd',
        values: { name: 'Amount' },
      })
    );
    expect(domainOf('t')).toBe('Amount');

    store.dispatchSync(
      removeDictionaryAction({ kind: DictionaryKind.domain, id: 'd' })
    );
    expect(domainOf('t')).toBe('');
    expect(store.state.collections.termEntities.t.domainId).toBe('d');
  });
});

describe('sheetRowIds', () => {
  const seed = () =>
    setup(
      word('a', { name: 'Customer', abbreviation: 'CUST' }),
      word('b', { name: '주문', englishName: 'Order', synonyms: 'Purchase' }),
      word('c', { name: '금액', description: 'An amount of MONEY' }),
      word('d', { name: '삭제', forbiddenWords: 'order' }),
      term('t1', { name: '고객명', physicalName: 'CUST_NM', domainId: 'm' }),
      term('t2', {
        name: '주문일자',
        description: 'the day an order is placed',
      }),
      domain('m', {
        name: '금액',
        category: 'order',
        dataType: 'NUMERIC(15,2)',
      }),
      domain('n', { name: '명', dataType: 'VARCHAR(100)' })
    );

  it("lists a sheet's rows in the order the document lists them, removed ones left out", () => {
    const { store } = seed();

    expect(sheetRowIds(store.state, DictionaryKind.word)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);

    store.dispatchSync(
      removeDictionaryAction({ kind: DictionaryKind.word, id: 'b' })
    );
    expect(sheetRowIds(store.state, DictionaryKind.word)).toEqual([
      'a',
      'c',
      'd',
    ]);
  });

  it('keeps the rows a word, a term or a domain holds the search in, in any case', () => {
    const { state } = seed().store;
    const search = (kind: DictionaryKind, text: string) =>
      sheetRowIds(state, kind, text);

    expect(search(DictionaryKind.word, 'cust')).toEqual(['a']);
    expect(search(DictionaryKind.word, 'ORDER')).toEqual(['b']);
    expect(search(DictionaryKind.word, 'money')).toEqual(['c']);
    expect(search(DictionaryKind.term, 'cust_nm')).toEqual(['t1']);
    expect(search(DictionaryKind.term, 'ORDER')).toEqual(['t2']);
    expect(search(DictionaryKind.domain, 'numeric')).toEqual(['m']);
    expect(search(DictionaryKind.domain, '명')).toEqual(['n']);
  });

  it("reads no word's synonyms or forbidden words, no term's domain and no domain's category", () => {
    const { state } = seed().store;

    expect(sheetRowIds(state, DictionaryKind.word, 'purchase')).toEqual([]);
    expect(sheetRowIds(state, DictionaryKind.term, '금액')).toEqual([]);
    expect(sheetRowIds(state, DictionaryKind.domain, 'order')).toEqual([]);
  });

  it('matches a search typed decomposed, and reads one of spaces alone as none', () => {
    const { state } = seed().store;

    expect(
      sheetRowIds(state, DictionaryKind.word, '주문'.normalize('NFD'))
    ).toEqual(['b']);
    expect(sheetRowIds(state, DictionaryKind.word, '  주문 ')).toEqual(['b']);
    expect(sheetRowIds(state, DictionaryKind.word, '   ')).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(toSearchText('ÅB'.normalize('NFD'))).toBe('åb');
  });

  it('hands back the same frozen rows until the sheet is written, and new ones after', () => {
    const { store } = seed();
    const before = sheetRowIds(store.state, DictionaryKind.term);

    store.dispatchSync(
      addTableAction({ id: 'table', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    expect(sheetRowIds(store.state, DictionaryKind.term)).toBe(before);
    expect(Object.isFrozen(before)).toBe(true);

    store.dispatchSync(
      updateDictionaryAction({
        kind: DictionaryKind.term,
        id: 't1',
        values: { description: 'a name' },
      })
    );
    const after = sheetRowIds(store.state, DictionaryKind.term);
    expect(after).not.toBe(before);
    expect(after).toEqual(before);
    expect(sheetRowIds(store.state, DictionaryKind.term, 'a name')).toEqual([
      't1',
    ]);
  });
});

describe('bumpedSheets', () => {
  const ALL = ['word', 'term', 'domain', 'check'];

  it("raises every sheet for a dictionary's write, whichever dictionary it writes", () => {
    expect(bumpedSheets([word('w', { name: 'a' })])).toEqual(ALL);
    expect(
      bumpedSheets([
        updateDictionaryAction({
          kind: DictionaryKind.domain,
          id: 'd',
          values: { name: 'b' },
        }),
      ])
    ).toEqual(ALL);
    expect(
      bumpedSheets([
        removeDictionaryAction({ kind: DictionaryKind.term, id: 't' }),
      ])
    ).toEqual(ALL);
  });

  it('raises every sheet for a load or a clear, the first ones too', () => {
    for (const action of [
      loadJsonAction({ value: '' }),
      initialLoadJsonAction({ value: '' }),
      clearAction(),
      initialClearAction(),
    ]) {
      expect(bumpedSheets([action])).toEqual(ALL);
    }
  });

  it("raises the checks alone for a table's or a column's write", () => {
    expect(
      bumpedSheets([
        addTableAction({ id: 't', ui: { x: 0, y: 0, zIndex: 1 } }),
        changeColumnNameAction({ tableId: 't', id: 'c', value: 'name' }),
      ])
    ).toEqual(['check']);
    expect(
      bumpedSheets([
        moveTableAction({ movementX: 1, movementY: 1, ids: ['t'] }),
        word('w', { name: 'a' }),
      ])
    ).toEqual(ALL);
  });

  it('raises nothing for a batch that writes neither', () => {
    expect(bumpedSheets([])).toEqual([]);
    expect(bumpedSheets([changeZoomLevelAction({ value: 1 })])).toEqual([]);
  });
});
