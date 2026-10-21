import { toJson } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import {
  addDictionaryAction,
  removeDictionaryAction,
  updateDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import {
  buildNameIndex,
  buildWordIndex,
  findDomain,
  findTerm,
  getDomainNames,
  getTermNames,
  getWordIndex,
  normalizeDictionaryName,
  raiseDictionaryGeneration,
  splitDictionaryList,
  WordIndex,
  WordMarks,
} from '@/engine/modules/dictionary/dictionaryIndex';
import {
  clearAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
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
import { createStore, Store } from '@/engine/store';
import { createDomain } from '@/utils/collection/domain.entity';
import { createWord } from '@/utils/collection/word.entity';

const newStore = (observed = false) =>
  createStore({ toWidth: text => text.length, clock: new Clock() }, observed);

/** The marks the trie holds for exactly this text, walked code unit by code unit. */
function marksOf(index: WordIndex, text: string): WordMarks | undefined {
  let node: WordIndex['root'] | undefined = index.root;
  for (let position = 0; node && position < text.length; position++) {
    node = node.next.get(text.charCodeAt(position));
  }
  return node?.marks;
}

const idsOf = (rows?: ReadonlyArray<{ id: string }>) =>
  rows?.map(({ id }) => id);

/** Counts the distinct values a reader hands out, each one a build. */
function countBuilds<T>(read: () => T) {
  const built = new Set<T>();
  return () => {
    built.add(read());
    return built.size;
  };
}

const word = (id: string, name: string, extra?: object): AnyAction =>
  addDictionaryAction({ kind: 'word', id, values: { name, ...extra } });

describe('dictionary names', () => {
  it('compares a name trimmed and composed, its case kept', () => {
    expect(normalizeDictionaryName('  가입 ')).toBe('가입');
    expect(normalizeDictionaryName(' Member ')).toBe('Member');
    expect(normalizeDictionaryName('   ')).toBe('');
  });

  it('splits a list at its commas and leaves out what holds nothing', () => {
    expect(splitDictionaryList('손님, 고객님 ,, 가 ')).toEqual([
      '손님',
      '고객님',
      '가',
    ]);
    expect(splitDictionaryList('')).toEqual([]);
  });
});

describe('buildWordIndex', () => {
  it('marks each name, synonym and forbidden word with the words in sheet order', () => {
    const customer = createWord({
      id: 'w1',
      name: '고객',
      synonyms: '손님, 고객',
      forbiddenWords: '커스터머',
    });
    const client = createWord({
      id: 'w2',
      name: ' 거래처 ',
      synonyms: '손님,손님',
    });
    const again = createWord({ id: 'w3', name: '고객' });
    const index = buildWordIndex([customer, client, again]);

    expect(idsOf(marksOf(index, '고객')?.words)).toEqual(['w1', 'w3']);
    expect(idsOf(marksOf(index, '고객')?.synonymOf)).toEqual([]);
    expect(idsOf(marksOf(index, '거래처')?.words)).toEqual(['w2']);
    expect(idsOf(marksOf(index, '손님')?.synonymOf)).toEqual(['w1', 'w2']);
    expect(idsOf(marksOf(index, '커스터머')?.forbiddenOf)).toEqual(['w1']);
    expect(marksOf(index, '고')).toBeUndefined();
    expect(idsOf(index.byName.get('고객'))).toEqual(['w1', 'w3']);
    expect(idsOf(index.rows)).toEqual(['w1', 'w2', 'w3']);
  });

  it('lists nothing for a word without a name, though it stays a row', () => {
    const unnamed = createWord({ id: 'w1', name: ' ', synonyms: '손님' });
    const index = buildWordIndex([unnamed]);

    expect(index.byName.size).toBe(0);
    expect(index.root.next.size).toBe(0);
    expect(idsOf(index.rows)).toEqual(['w1']);
  });
});

describe('buildNameIndex', () => {
  it('groups the rows by normalized name and keeps the unnamed among the rows', () => {
    const rows = [
      createDomain({ id: 'd1', name: '금액N15' }),
      createDomain({ id: 'd2', name: '' }),
      createDomain({ id: 'd3', name: ' 금액N15' }),
      createDomain({ id: 'd4', name: '금액n15' }),
    ];
    const index = buildNameIndex(rows);

    expect(idsOf(index.byName.get('금액N15'))).toEqual(['d1', 'd3']);
    expect(idsOf(index.byName.get('금액n15'))).toEqual(['d4']);
    expect(index.byName.size).toBe(2);
    expect(idsOf(index.rows)).toEqual(['d1', 'd2', 'd3', 'd4']);
  });
});

describe('the lookups by name', () => {
  it('finds the first listed term and domain of a name, a removed one never', () => {
    const store = newStore();
    store.dispatchSync(
      addDictionaryAction({
        kind: 'term',
        id: 't1',
        values: { name: '회원번호' },
      }),
      addDictionaryAction({
        kind: 'term',
        id: 't2',
        values: { name: '회원번호' },
      }),
      addDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { name: '번호' },
      }),
      addDictionaryAction({
        kind: 'domain',
        id: 'd2',
        values: { name: '코드' },
      })
    );

    expect(findTerm(store.state, ' 회원번호 ')?.id).toBe('t1');
    expect(findTerm(store.state, '회원')).toBeUndefined();
    expect(findDomain(store.state, '번호')?.id).toBe('d1');

    store.dispatchSync(
      removeDictionaryAction({ kind: 'term', id: 't1' }),
      removeDictionaryAction({ kind: 'domain', id: 'd2' })
    );

    expect(findTerm(store.state, '회원번호')?.id).toBe('t2');
    expect(findDomain(store.state, '코드')).toBeUndefined();
  });
});

describe('the index cache', () => {
  function seed(store: Store) {
    store.dispatchSync(
      word('w1', '회원', { abbreviation: 'MBR' }),
      addDictionaryAction({ kind: 'term', id: 't1', values: { name: '회원' } }),
      addDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { name: '번호' },
      }),
      addTableAction({ id: 'table', ui: { x: 0, y: 0, zIndex: 1 } }),
      addColumnAction({ id: 'column', tableId: 'table' })
    );
  }

  it('reads one index while only tables and columns change', () => {
    const store = newStore();
    seed(store);
    const words = countBuilds(() => getWordIndex(store.state));
    const terms = countBuilds(() => getTermNames(store.state));
    const domains = countBuilds(() => getDomainNames(store.state));

    for (let index = 0; index < 50; index++) {
      words();
      terms();
      domains();
    }
    store.dispatchSync(
      changeTableNameAction({ id: 'table', value: 'member' }),
      changeTableLogicalNameAction({ id: 'table', value: '회원' }),
      changeColumnNameAction({ id: 'column', tableId: 'table', value: 'id' }),
      changeColumnLogicalNameAction({
        id: 'column',
        tableId: 'table',
        value: '회원번호',
      }),
      changeColumnDataTypeAction({
        id: 'column',
        tableId: 'table',
        value: 'INT',
      }),
      changeColumnDomainAction({ id: 'column', tableId: 'table', value: 'd1' }),
      addTableAction({ id: 'other', ui: { x: 0, y: 0, zIndex: 2 } })
    );

    expect(words()).toBe(1);
    expect(terms()).toBe(1);
    expect(domains()).toBe(1);
  });

  it('builds again once a row is added to or removed from its sheet, and only that sheet', () => {
    const store = newStore();
    seed(store);
    const words = countBuilds(() => getWordIndex(store.state));
    const terms = countBuilds(() => getTermNames(store.state));
    words();
    terms();

    store.dispatchSync(word('w2', '번호', { abbreviation: 'NO' }));
    expect(words()).toBe(2);
    expect(marksOf(getWordIndex(store.state), '번호')?.words).toHaveLength(1);

    store.dispatchSync(removeDictionaryAction({ kind: 'word', id: 'w1' }));
    expect(words()).toBe(3);
    expect(getWordIndex(store.state).byName.has('회원')).toBe(false);

    expect(terms()).toBe(1);
  });

  it('builds again once a row of its sheet is renamed', () => {
    const store = newStore();
    seed(store);
    const words = countBuilds(() => getWordIndex(store.state));
    words();

    store.dispatchSync(
      updateDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { name: '고객' },
      })
    );

    expect(words()).toBe(2);
    expect(getWordIndex(store.state).byName.has('고객')).toBe(true);
  });

  it('builds again once the generation of its sheet is raised, and only for that sheet', () => {
    const store = newStore();
    seed(store);
    const words = countBuilds(() => getWordIndex(store.state));
    const domains = countBuilds(() => getDomainNames(store.state));
    words();
    domains();

    raiseDictionaryGeneration(store.state, 'word');

    expect(words()).toBe(2);
    expect(words()).toBe(2);
    expect(domains()).toBe(1);
  });

  it('builds again for the dictionaries a load or a clear brings, never for those it keeps', () => {
    const store = newStore();
    seed(store);
    const words = countBuilds(() => getWordIndex(store.state));
    words();

    store.dispatchSync(
      loadJsonAction({ value: toJson(store.state), keepDictionaries: true })
    );
    expect(words()).toBe(1);

    store.dispatchSync(loadJsonAction({ value: toJson(store.state) }));
    expect(words()).toBe(2);
    expect(getWordIndex(store.state).byName.has('회원')).toBe(true);

    store.dispatchSync(clearAction({ keepDictionaries: true }));
    expect(words()).toBe(2);

    store.dispatchSync(clearAction());
    expect(words()).toBe(3);
    expect(getWordIndex(store.state).rows).toEqual([]);
  });

  it('keeps one index over the collection an observed store hands its readers', () => {
    const store = newStore(true);
    seed(store);
    const words = countBuilds(() => getWordIndex(store.state));

    for (let index = 0; index < 20; index++) words();
    store.dispatchSync(
      loadJsonAction({ value: toJson(store.state), keepDictionaries: true })
    );
    expect(words()).toBe(1);

    raiseDictionaryGeneration(store.state, 'word');
    expect(words()).toBe(2);
  });

  it('builds over the rows the sheet lists, in key order', () => {
    const store = newStore();
    store.dispatchSync(
      addDictionaryAction({
        kind: 'term',
        id: 't1',
        values: { name: 'A', order: 'a1' },
      }),
      addDictionaryAction({
        kind: 'term',
        id: 't2',
        values: { name: 'B', order: 'a0' },
      }),
      updateDictionaryAction({
        kind: 'term',
        id: 'stub',
        values: { name: 'C' },
      })
    );

    expect(idsOf(getTermNames(store.state).rows)).toEqual(['t2', 't1']);
    expect(getTermNames(store.state).byName.has('C')).toBe(false);
  });
});
