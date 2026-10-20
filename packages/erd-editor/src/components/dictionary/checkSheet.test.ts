import type { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { createTestI18n, pseudoMessages } from '@/__test-utils__/index';
import {
  checkCellText,
  checkRows,
  checkSheetColumns,
} from '@/components/dictionary/checkSheet';
import { Clock } from '@/engine/clock';
import {
  type DictionaryAddPayload,
  DictionaryKind,
} from '@/engine/modules/dictionary/actions';
import { addDictionaryAction } from '@/engine/modules/dictionary/atom.actions';
import type { DictionaryCheck } from '@/engine/modules/dictionary/checks';
import {
  addTableAction,
  changeTableLogicalNameAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
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
