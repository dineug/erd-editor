import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import {
  DictionaryAddPayload,
  DictionaryKind,
} from '@/engine/modules/dictionary/actions';
import {
  addDictionaryAction,
  removeDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import {
  checkColumn,
  checkDictionaryRow,
  checkTable,
  DictionaryCheck,
  DictionaryCheckCodeList,
  DictionaryCheckLevelOf,
  listDictionaryChecks,
  markOf,
} from '@/engine/modules/dictionary/checks';
import {
  addTableAction,
  changeTableLogicalNameAction,
  changeTableNameAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnDomainAction,
  changeColumnLogicalNameAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { createStore, Store } from '@/engine/store';

const newStore = () =>
  createStore({ toWidth: text => text.length, clock: new Clock() }, false);

const row = (
  kind: DictionaryKind,
  id: string,
  values: Record<string, string>
): AnyAction =>
  addDictionaryAction({ kind, id, values } as DictionaryAddPayload);

function table(id: string, name: string, logicalName: string): AnyAction[] {
  return [
    addTableAction({ id, ui: { x: 0, y: 0, zIndex: 1 } }),
    changeTableNameAction({ id, value: name }),
    changeTableLogicalNameAction({ id, value: logicalName }),
  ];
}

/** A column as the atoms write it, so its type and its link need not agree as a generator keeps them. */
function column(
  tableId: string,
  id: string,
  { name = '', logicalName = '', domainId = '', dataType = '' }
): AnyAction[] {
  return [
    addColumnAction({ id, tableId }),
    changeColumnNameAction({ id, tableId, value: name }),
    changeColumnLogicalNameAction({ id, tableId, value: logicalName }),
    changeColumnDomainAction({ id, tableId, value: domainId }),
    changeColumnDataTypeAction({ id, tableId, value: dataType }),
  ];
}

/** The tables and columns of the seed, which name what every check reads. */
const SCHEMA: AnyAction[] = [
  ...table('member', 'member', '회원'),
  ...column('member', 'c1', {
    name: 'MBR_NO',
    logicalName: '회원번호',
    domainId: 'd1',
    dataType: 'NUMERIC(10)',
  }),
  ...column('member', 'c2', { name: ' member_no ', logicalName: '회원번호' }),
  ...column('member', 'c3', { name: 'm', logicalName: '멤버넘버' }),
  ...column('member', 'c4', { name: 'x', logicalName: '회원XY_회원XY' }),
  ...column('member', 'c5', { name: 'y', domainId: 'd3' }),
  ...column('member', 'c6', { name: 'z', domainId: 'never' }),
  ...table('customer', 'customer', '고객'),
];

/** The sheets of the seed: a duplicate in each, and rows each check finds. */
const DICTIONARIES: AnyAction[] = [
  row('word', 'w1', { name: '회원', abbreviation: 'MBR', synonyms: '멤버' }),
  row('word', 'w2', {
    name: '번호',
    abbreviation: 'NO',
    forbiddenWords: '넘버',
  }),
  row('word', 'w3', { name: '이름', abbreviation: 'NM' }),
  row('word', 'w4', { name: ' 이름', abbreviation: 'NAME' }),
  row('word', 'w5', { name: '' }),
  row('term', 't1', {
    name: '회원번호',
    physicalName: 'MBR_NO',
    domainId: 'd1',
  }),
  row('term', 't2', { name: '회원번호' }),
  row('term', 't3', {
    name: '회원주소',
    physicalName: 'MBR_ADDR',
    domainId: 'gone',
  }),
  row('term', 't4', { name: '멤버이름' }),
  row('domain', 'd1', { name: '번호N10', dataType: 'NUMERIC(10)' }),
  row('domain', 'd2', { name: '번호N10' }),
  row('domain', 'd3', { name: '삭제된도메인', dataType: 'TEXT' }),
  removeDictionaryAction({ kind: 'domain', id: 'd3' }),
];

function seed(...actions: AnyAction[][]): Store {
  const store = newStore();
  store.dispatchSync(...actions.flat());
  return store;
}

/** Each check as its code, the cell it marks, the text it found and what it offers. */
const read = (checks: DictionaryCheck[]) =>
  checks.map(({ code, field, text, suggestions }) => [
    code,
    field,
    text,
    suggestions,
  ]);

const columnOf = (store: Store, id: string) =>
  store.state.collections.tableColumnEntities[id];
const tableOf = (store: Store, id: string) =>
  store.state.collections.tableEntities[id];
const termOf = (store: Store, id: string) =>
  store.state.collections.termEntities[id];

describe('dictionary checks', () => {
  it('finds nothing while every sheet is empty, whatever the names and links say', () => {
    const store = seed(SCHEMA);

    for (const id of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) {
      expect(checkColumn(store.state, columnOf(store, id))).toEqual([]);
    }
    expect(checkTable(store.state, tableOf(store, 'customer'))).toEqual([]);
    expect(listDictionaryChecks(store.state)).toEqual([]);
  });

  it('marks each listed row whose sheet holds its name twice, never a row without a name', () => {
    const store = seed(DICTIONARIES);
    const words = store.state.collections.wordEntities;
    const domains = store.state.collections.domainEntities;

    expect(read(checkDictionaryRow(store.state, 'word', words.w3))).toEqual([
      ['duplicateName', 'name', '이름', []],
    ]);
    expect(read(checkDictionaryRow(store.state, 'word', words.w4))).toEqual([
      ['duplicateName', 'name', '이름', []],
    ]);
    expect(checkDictionaryRow(store.state, 'word', words.w1)).toEqual([]);
    expect(checkDictionaryRow(store.state, 'word', words.w5)).toEqual([]);
    expect(read(checkDictionaryRow(store.state, 'domain', domains.d2))).toEqual(
      [['duplicateName', 'name', '번호N10', []]]
    );
    expect(checkDictionaryRow(store.state, 'domain', domains.d3)).toEqual([]);
  });

  it('marks a term by the duplicate, the words of its name and its domain link', () => {
    const store = seed(DICTIONARIES);

    expect(
      read(checkDictionaryRow(store.state, 'term', termOf(store, 't2')))
    ).toEqual([['duplicateName', 'name', '회원번호', []]]);
    expect(
      read(checkDictionaryRow(store.state, 'term', termOf(store, 't3')))
    ).toEqual([
      ['unregisteredWord', 'name', '주소', []],
      ['unknownDomain', 'domainId', 'gone', []],
    ]);
    expect(
      read(checkDictionaryRow(store.state, 'term', termOf(store, 't4')))
    ).toEqual([['synonymWord', 'name', '멤버', ['회원']]]);
  });

  it('marks the words a logical name uses that are no standard word, each once', () => {
    const store = seed(SCHEMA, DICTIONARIES);

    expect(read(checkColumn(store.state, columnOf(store, 'c3')))).toEqual([
      ['synonymWord', 'logicalName', '멤버', ['회원']],
      ['forbiddenWord', 'logicalName', '넘버', ['번호']],
    ]);
    expect(read(checkColumn(store.state, columnOf(store, 'c4')))).toEqual([
      ['unregisteredWord', 'logicalName', 'XY', []],
    ]);
    expect(read(checkTable(store.state, tableOf(store, 'customer')))).toEqual([
      ['unregisteredWord', 'logicalName', '고객', []],
    ]);
    expect(checkTable(store.state, tableOf(store, 'member'))).toEqual([]);
  });

  it('marks a physical name the matched term would not give, compared trimmed', () => {
    const store = seed(SCHEMA, DICTIONARIES);
    expect(checkColumn(store.state, columnOf(store, 'c1'))).toEqual([]);

    expect(read(checkColumn(store.state, columnOf(store, 'c2')))).toEqual([
      ['physicalNameMismatch', 'name', ' member_no ', ['MBR_NO']],
    ]);

    store.dispatchSync(
      changeColumnNameAction({ id: 'c2', tableId: 'member', value: ' MBR_NO ' })
    );
    expect(checkColumn(store.state, columnOf(store, 'c2'))).toEqual([]);
  });

  it('compares the composed name for a term that holds none, and nothing where none composes', () => {
    const store = seed(SCHEMA, DICTIONARIES, [
      row('word', 'w6', { name: '주소', abbreviation: 'ADDR' }),
      row('term', 't5', { name: '회원이름' }),
      row('term', 't6', { name: '회원별명' }),
      ...column('member', 'c7', {
        name: 'member_name',
        logicalName: '회원이름',
      }),
      ...column('member', 'c8', { name: 'nick', logicalName: '회원별명' }),
    ]);

    expect(
      read(checkColumn(store.state, columnOf(store, 'c7'), 'name'))
    ).toEqual([['physicalNameMismatch', 'name', 'member_name', ['MBR_NM']]]);
    expect(checkColumn(store.state, columnOf(store, 'c8'), 'name')).toEqual([]);
  });

  it('marks a link to a domain no row lists, by the removed name it kept or the id', () => {
    const store = seed(SCHEMA, DICTIONARIES);

    expect(read(checkColumn(store.state, columnOf(store, 'c5')))).toEqual([
      ['unknownDomain', 'domainId', '삭제된도메인', []],
    ]);
    expect(read(checkColumn(store.state, columnOf(store, 'c6')))).toEqual([
      ['unknownDomain', 'domainId', 'never', []],
    ]);
  });

  it("marks a column off the type of the listed domain it links, by its type and the domain's", () => {
    const store = seed(SCHEMA, DICTIONARIES, [
      ...column('member', 'c7', { domainId: 'd1', dataType: 'INT' }),
      ...column('member', 'c8', { domainId: 'd2', dataType: 'INT' }),
      ...column('member', 'c9', { dataType: 'INT' }),
    ]);

    expect(read(checkColumn(store.state, columnOf(store, 'c7')))).toEqual([
      ['domainTypeMismatch', 'domainId', 'INT', ['NUMERIC(10)']],
    ]);
    // A domain with no type gives its columns none, so it offers nothing to write.
    expect(read(checkColumn(store.state, columnOf(store, 'c8')))).toEqual([
      ['domainTypeMismatch', 'domainId', 'INT', []],
    ]);
    expect(checkColumn(store.state, columnOf(store, 'c1'))).toEqual([]);
    expect(checkColumn(store.state, columnOf(store, 'c9'))).toEqual([]);
    // c5 links the removed d3 off its type: the unknown domain alone.
    expect(read(checkColumn(store.state, columnOf(store, 'c5')))).toEqual([
      ['unknownDomain', 'domainId', '삭제된도메인', []],
    ]);
    expect(markOf(checkColumn(store.state, columnOf(store, 'c7')))).toBe(
      'warning'
    );
  });

  it('keeps each check silent while its own sheet is empty', () => {
    const terms = seed(SCHEMA, [
      row('term', 't1', { name: '회원번호', physicalName: 'MBR_NO' }),
    ]);
    expect(read(checkColumn(terms.state, columnOf(terms, 'c2')))).toEqual([
      ['physicalNameMismatch', 'name', ' member_no ', ['MBR_NO']],
    ]);
    expect(checkColumn(terms.state, columnOf(terms, 'c4'))).toEqual([]);
    expect(checkColumn(terms.state, columnOf(terms, 'c6'))).toEqual([]);

    const words = seed(SCHEMA, [row('word', 'w1', { name: '회원' })]);
    expect(checkColumn(words.state, columnOf(words, 'c2'), 'name')).toEqual([]);
    expect(read(checkColumn(words.state, columnOf(words, 'c4')))).toEqual([
      ['unregisteredWord', 'logicalName', 'XY', []],
    ]);

    const domains = seed(SCHEMA, [row('domain', 'd9', { name: '코드' })]);
    expect(checkColumn(domains.state, columnOf(domains, 'c4'))).toEqual([]);
    expect(read(checkColumn(domains.state, columnOf(domains, 'c6')))).toEqual([
      ['unknownDomain', 'domainId', 'never', []],
    ]);
  });

  it('runs only the checks of the cell a field names', () => {
    const store = seed(SCHEMA, DICTIONARIES, [
      ...column('member', 'c9', {
        name: 'n',
        logicalName: '회원주소',
        domainId: 'never',
      }),
    ]);
    const c9 = columnOf(store, 'c9');

    expect(read(checkColumn(store.state, c9, 'logicalName'))).toEqual([
      ['unregisteredWord', 'logicalName', '주소', []],
    ]);
    expect(read(checkColumn(store.state, c9, 'domainId'))).toEqual([
      ['unknownDomain', 'domainId', 'never', []],
    ]);
    expect(read(checkColumn(store.state, c9, 'name'))).toEqual([
      ['physicalNameMismatch', 'name', 'n', ['MBR_ADDR']],
    ]);
    expect(checkTable(store.state, tableOf(store, 'customer'), 'name')).toEqual(
      []
    );
    expect(
      read(
        checkDictionaryRow(store.state, 'term', termOf(store, 't3'), 'domainId')
      )
    ).toEqual([['unknownDomain', 'domainId', 'gone', []]]);
  });

  it('names its target, the table of a column, and no table for a row', () => {
    const store = seed(SCHEMA, DICTIONARIES);

    expect(checkColumn(store.state, columnOf(store, 'c6'))[0].target).toEqual({
      kind: 'column',
      id: 'c6',
      tableId: 'member',
    });
    expect(
      checkTable(store.state, tableOf(store, 'customer'))[0].target
    ).toEqual({
      kind: 'table',
      id: 'customer',
      tableId: 'customer',
    });
    expect(
      checkDictionaryRow(store.state, 'term', termOf(store, 't2'))[0].target
    ).toEqual({ kind: 'term', id: 't2', tableId: '' });
  });
});

describe('markOf', () => {
  it('shows the loudest level a cell holds, none for no check', () => {
    const store = seed(SCHEMA, DICTIONARIES);

    expect(markOf([])).toBeNull();
    expect(markOf(checkColumn(store.state, columnOf(store, 'c4')))).toBe(
      'warning'
    );
    expect(markOf(checkColumn(store.state, columnOf(store, 'c3')))).toBe(
      'error'
    );
    expect(markOf(checkColumn(store.state, columnOf(store, 'c6')))).toBe(
      'error'
    );
  });

  it('gives each of the seven checks a level', () => {
    expect(DictionaryCheckCodeList).toEqual([
      'duplicateName',
      'unknownDomain',
      'unregisteredWord',
      'forbiddenWord',
      'synonymWord',
      'physicalNameMismatch',
      'domainTypeMismatch',
    ]);
    expect(
      DictionaryCheckCodeList.map(code => DictionaryCheckLevelOf[code])
    ).toEqual([
      'error',
      'error',
      'warning',
      'error',
      'warning',
      'warning',
      'warning',
    ]);
  });
});

describe('listDictionaryChecks', () => {
  it('lists the sheets in their order, then each table and its columns, the removed left out', () => {
    const store = seed(SCHEMA, DICTIONARIES, [
      ...column('member', 'c7', { domainId: 'd1', dataType: 'INT' }),
      ...table('gone', 'gone', '고객'),
      ...column('gone', 'c10', { name: 'q', domainId: 'never' }),
      ...column('gone', 'c11', { domainId: 'd1', dataType: 'INT' }),
      removeTableAction({ id: 'gone' }),
    ]);

    expect(
      listDictionaryChecks(store.state).map(({ code, target }) => [
        target.kind,
        target.id,
        code,
      ])
    ).toEqual([
      ['word', 'w3', 'duplicateName'],
      ['word', 'w4', 'duplicateName'],
      ['term', 't1', 'duplicateName'],
      ['term', 't2', 'duplicateName'],
      ['term', 't3', 'unregisteredWord'],
      ['term', 't3', 'unknownDomain'],
      ['term', 't4', 'synonymWord'],
      ['domain', 'd1', 'duplicateName'],
      ['domain', 'd2', 'duplicateName'],
      ['column', 'c2', 'physicalNameMismatch'],
      ['column', 'c3', 'synonymWord'],
      ['column', 'c3', 'forbiddenWord'],
      ['column', 'c4', 'unregisteredWord'],
      ['column', 'c5', 'unknownDomain'],
      ['column', 'c6', 'unknownDomain'],
      ['column', 'c7', 'domainTypeMismatch'],
      ['table', 'customer', 'unregisteredWord'],
    ]);
  });
});
