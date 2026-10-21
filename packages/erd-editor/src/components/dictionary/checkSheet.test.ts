import type { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { createTestI18n, pseudoMessages } from '@/__test-utils__/index';
import {
  checkCellText,
  checkDestination,
  checkRows,
  checkSheetColumns,
} from '@/components/dictionary/checkSheet';
import { NameViewMode } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  type DictionaryAddPayload,
  DictionaryKind,
} from '@/engine/modules/dictionary/actions';
import { addDictionaryAction } from '@/engine/modules/dictionary/atom.actions';
import type { DictionaryCheck } from '@/engine/modules/dictionary/checks';
import { FocusType } from '@/engine/modules/editor/state';
import { changeNameViewModeAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableLogicalNameAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnDomainAction,
  changeColumnLogicalNameAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { createStore, type Store } from '@/engine/store';

const row = (
  kind: DictionaryKind,
  id: string,
  values: Record<string, string>
): AnyAction =>
  addDictionaryAction({ kind, id, values } as DictionaryAddPayload);

/** A table whose logical name uses a synonym, a column its term names otherwise, and a duplicate on each sheet. */
const SEED: AnyAction[] = [
  addTableAction({ id: 'member', ui: { x: 0, y: 0, zIndex: 1 } }),
  changeTableNameAction({ id: 'member', value: 'member' }),
  changeTableLogicalNameAction({ id: 'member', value: '멤버' }),
  addColumnAction({ id: 'c1', tableId: 'member' }),
  changeColumnNameAction({ id: 'c1', tableId: 'member', value: 'mbr_no' }),
  changeColumnLogicalNameAction({
    id: 'c1',
    tableId: 'member',
    value: '회원번호',
  }),
  row('word', 'w1', { name: '회원', abbreviation: 'MBR', synonyms: '멤버' }),
  row('word', 'w2', { name: '번호', abbreviation: 'NO' }),
  row('word', 'w3', { name: '번호', abbreviation: 'NUM' }),
  row('term', 't1', { name: '회원번호', physicalName: 'MBR_NO' }),
  row('term', 't2', { name: '회원번호' }),
  row('domain', 'd1', { name: '번호N10' }),
  row('domain', 'd2', { name: '번호N10' }),
];

function seed(): Store {
  const store = createStore(
    { toWidth: text => text.length, clock: new Clock() },
    false
  );
  store.dispatchSync(SEED);
  return store;
}

/** Each check the sheet lists as the three cells it shows. */
const cells = (store: Store, checks: ReadonlyArray<DictionaryCheck>) =>
  checks.map(check =>
    ['type', 'target', 'detail'].map(id =>
      checkCellText(store.state, check, id)
    )
  );

describe('checkSheetColumns', () => {
  it('lists the type, the target and the detail, read-only in every document, in the reader language', () => {
    const i18n = createTestI18n('ko-KR', pseudoMessages('ko'));

    expect(checkSheetColumns({ target: 300 }, i18n)).toEqual([
      { id: 'type', label: 'ko:Type', width: 180, readonly: true },
      { id: 'target', label: 'ko:Target', width: 300, readonly: true },
      { id: 'detail', label: 'ko:Detail', width: 360, readonly: true },
    ]);
    expect(checkSheetColumns().map(({ label }) => label)).toEqual([
      'Type',
      'Target',
      'Detail',
    ]);
  });
});

describe('checkRows', () => {
  it('lists every check the document gives, each as its kind, what it is about and what it found', () => {
    const store = seed();

    expect(cells(store, checkRows(store.state))).toEqual([
      ['Duplicate name', '번호', '번호'],
      ['Duplicate name', '번호', '번호'],
      ['Duplicate name', '회원번호', '회원번호'],
      ['Duplicate name', '회원번호', '회원번호'],
      ['Duplicate name', '번호N10', '번호N10'],
      ['Duplicate name', '번호N10', '번호N10'],
      ['Synonym', 'member', '멤버 → 회원'],
      ['Physical name mismatch', 'member.mbr_no', 'mbr_no → MBR_NO'],
    ]);
  });

  it('keeps the checks whose cells hold the search, case and composition aside', () => {
    const store = seed();

    expect(cells(store, checkRows(store.state, ' MBR_no '))).toEqual([
      ['Physical name mismatch', 'member.mbr_no', 'mbr_no → MBR_NO'],
    ]);
    expect(checkRows(store.state, 'synonym')).toHaveLength(1);
    expect(checkRows(store.state, 'n10')).toHaveLength(2);
    expect(checkRows(store.state, 'nothing like it')).toEqual([]);
    expect(Object.isFrozen(checkRows(store.state))).toBe(true);
  });

  it('reads the kind in the reader language and the names as they are', () => {
    const store = seed();
    const i18n = createTestI18n('ko-KR', pseudoMessages('ko'));
    const [check] = checkRows(store.state, '', i18n);

    expect(checkCellText(store.state, check, 'type', i18n)).toBe(
      'ko:Duplicate name'
    );
    expect(checkCellText(store.state, check, 'target', i18n)).toBe('번호');
    expect(checkCellText(store.state, check, 'id', i18n)).toBe('');
  });

  it('names a table or a column as the name view does, unnamed where the view shows none', () => {
    const store = seed();
    const switchTo = (
      value: (typeof NameViewMode)[keyof typeof NameViewMode]
    ) =>
      store.dispatchSync(
        changeNameViewModeAction({
          value,
          shared: false,
          editorId: store.state.editor.id,
        })
      );
    const targets = () =>
      cells(store, checkRows(store.state))
        .slice(6)
        .map(([, target]) => target);

    switchTo(NameViewMode.logical);
    expect(targets()).toEqual(['멤버', '멤버.회원번호']);

    switchTo(NameViewMode.both);
    expect(targets()).toEqual([
      '멤버 (member)',
      '멤버 (member).회원번호 (mbr_no)',
    ]);

    store.dispatchSync(
      changeColumnNameAction({ id: 'c1', tableId: 'member', value: '' }),
      changeColumnLogicalNameAction({ id: 'c1', tableId: 'member', value: '' })
    );
    switchTo(NameViewMode.physical);
    store.dispatchSync(
      addColumnAction({ id: 'c2', tableId: 'member' }),
      changeColumnLogicalNameAction({
        id: 'c2',
        tableId: 'member',
        value: '회원주소',
      })
    );
    expect(
      cells(store, checkRows(store.state, '주소')).map(([, target]) => target)
    ).toEqual(['member.unnamed']);

    switchTo(NameViewMode.logical);
    expect(
      cells(store, checkRows(store.state, '회원주소')).map(
        ([, target]) => target
      )
    ).toEqual(['멤버.회원주소']);
  });

  it("shows a column off its domain's type by its type, then the domain's, and leads to its domain cell", () => {
    const store = seed();
    store.dispatchSync(
      row('domain', 'd3', { name: '금액', dataType: 'NUMERIC(15)' }),
      addColumnAction({ id: 'c2', tableId: 'member' }),
      changeColumnNameAction({ id: 'c2', tableId: 'member', value: 'amt' }),
      changeColumnDomainAction({ id: 'c2', tableId: 'member', value: 'd3' }),
      changeColumnDataTypeAction({ id: 'c2', tableId: 'member', value: 'INT' })
    );
    const checks = checkRows(store.state, 'amt');

    expect(cells(store, checks)).toEqual([
      ['Domain type mismatch', 'member.amt', 'INT → NUMERIC(15)'],
    ]);
    expect(checkDestination(checks[0])).toEqual({
      kind: 'erd',
      target: {
        kind: 'column',
        tableId: 'member',
        columnId: 'c2',
        focusType: FocusType.columnDomain,
      },
    });
  });

  it('draws an empty side of a mismatch as a dash, as the diff tree draws an empty value', () => {
    const store = seed();
    store.dispatchSync(
      row('domain', 'd3', { name: '금액', dataType: 'NUMERIC(15)' }),
      row('domain', 'd4', { name: '비고' }),
      addColumnAction({ id: 'c2', tableId: 'member' }),
      changeColumnNameAction({ id: 'c2', tableId: 'member', value: 'amt' }),
      changeColumnDomainAction({ id: 'c2', tableId: 'member', value: 'd3' }),
      addColumnAction({ id: 'c3', tableId: 'member' }),
      changeColumnNameAction({ id: 'c3', tableId: 'member', value: 'memo' }),
      changeColumnDomainAction({ id: 'c3', tableId: 'member', value: 'd4' }),
      changeColumnDataTypeAction({ id: 'c3', tableId: 'member', value: 'TEXT' })
    );

    expect(cells(store, checkRows(store.state, 'member.'))).toEqual(
      expect.arrayContaining([
        ['Domain type mismatch', 'member.amt', '— → NUMERIC(15)'],
        ['Domain type mismatch', 'member.memo', 'TEXT → —'],
      ])
    );
  });

  it('shows nothing of a target the document no longer holds', () => {
    const store = seed();
    const gone = (
      kind: DictionaryCheck['target']['kind']
    ): DictionaryCheck => ({
      code: 'duplicateName',
      target: { kind, id: 'gone', tableId: 'gone' },
      field: 'name',
      text: 'x',
      suggestions: [],
    });

    expect(
      (['table', 'column', 'word', 'term', 'domain'] as const).map(kind =>
        checkCellText(store.state, gone(kind), 'target')
      )
    ).toEqual(['', '.', '', '', '']);
  });
});

describe('checkDestination', () => {
  const check = (
    target: DictionaryCheck['target'],
    field: DictionaryCheck['field']
  ): DictionaryCheck => ({
    code: 'unregisteredWord',
    target,
    field,
    text: 'x',
    suggestions: [],
  });

  it('leads a dictionary row to the cell of its field on its own sheet', () => {
    expect(
      checkDestination(check({ kind: 'word', id: 'w', tableId: '' }, 'name'))
    ).toEqual({ kind: 'entry', sheet: 'word', id: 'w', columnId: 'name' });
    expect(
      checkDestination(
        check({ kind: 'term', id: 't', tableId: '' }, 'domainId')
      )
    ).toEqual({ kind: 'entry', sheet: 'term', id: 't', columnId: 'domainId' });
  });

  it("leads a column to the cell of its field on the ERD tab, and a table to its header's", () => {
    const column = { kind: 'column', id: 'c', tableId: 't' } as const;
    const table = { kind: 'table', id: 't', tableId: 't' } as const;

    expect(
      (['name', 'logicalName', 'domainId'] as const).map(field =>
        checkDestination(check(column, field))
      )
    ).toEqual(
      [
        FocusType.columnName,
        FocusType.columnLogicalName,
        FocusType.columnDomain,
      ].map(focusType => ({
        kind: 'erd',
        target: { kind: 'column', tableId: 't', columnId: 'c', focusType },
      }))
    );
    expect(
      (['name', 'logicalName', 'domainId'] as const).map(field =>
        checkDestination(check(table, field))
      )
    ).toEqual(
      [
        FocusType.tableName,
        FocusType.tableLogicalName,
        FocusType.tableName,
      ].map(focusType => ({
        kind: 'erd',
        target: { kind: 'table', tableId: 't', focusType },
      }))
    );
  });
});
