import { describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import { addDictionaryAction } from '@/engine/modules/dictionary/atom.actions';
import { raiseDictionaryGeneration } from '@/engine/modules/dictionary/dictionaryIndex';
import {
  buildTermIndex,
  completeTerms,
  getTermIndex,
  TERM_COMPLETION_LIMIT,
  TermIndex,
  toTermKey,
} from '@/engine/modules/dictionary/termIndex';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { createStore } from '@/engine/store';
import { Term } from '@/internal-types';
import { createTerm } from '@/utils/collection/term.entity';

const newStore = () =>
  createStore({ toWidth: text => text.length, clock: new Clock() }, false);

const idsOf = (terms: ReadonlyArray<Term>) => terms.map(({ id }) => id);

/** The index with every read of one of its keys counted: one comparison each. */
function countComparisons(index: TermIndex) {
  let reads = 0;
  const keys = new Proxy(index.keys as string[], {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/.test(property)) reads++;
      return Reflect.get(target, property, receiver);
    },
  });

  return {
    index: { keys, terms: index.terms },
    take: () => {
      const taken = reads;
      reads = 0;
      return taken;
    },
  };
}

/** A seeded generator, so a failing run reads the same terms again. */
function random(seed: number) {
  let state = seed >>> 0;
  return (bound: number) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) % bound;
  };
}

const SYLLABLES = [
  ...'고객번호회원가입일자명코드주소금액수량상태구분여부시간등록변경삭제',
  ...'사용유형값순서종류비율계좌은행전화메일우편지역국통단위기준작료',
];

/** Term names as a public standard sheet spells them, two to five syllables. */
function syntheticTermNames(count: number, next: (bound: number) => number) {
  const names = new Set<string>();
  while (names.size < count) {
    const length = 2 + next(4);
    let name = '';
    for (let position = 0; position < length; position++) {
      name += SYLLABLES[next(SYLLABLES.length)];
    }
    names.add(name);
  }
  return [...names];
}

describe('buildTermIndex', () => {
  it('sorts one term per name by key, a name in two cases by the name, and leaves out the unnamed', () => {
    const index = buildTermIndex([
      createTerm({ id: 't1', name: '회원번호' }),
      createTerm({ id: 't2', name: 'id' }),
      createTerm({ id: 't3', name: 'ID' }),
      createTerm({ id: 't4', name: ' 회원번호' }),
      createTerm({ id: 't5', name: ' ' }),
      createTerm({ id: 't6', name: 'Abc' }),
      createTerm({ id: 't7', name: '가입' }),
    ]);

    expect(index.keys).toEqual(['abc', 'id', 'id', '가입', '회원번호']);
    expect(idsOf(index.terms)).toEqual(['t6', 't3', 't2', 't7', 't1']);
  });

  it('compares a key composed and in lower case', () => {
    expect(toTermKey('가입 ID')).toBe('가입 id');
  });
});

describe('completeTerms', () => {
  const index = buildTermIndex([
    createTerm({ id: 't1', name: '회원번호' }),
    createTerm({ id: 't2', name: 'ID' }),
    createTerm({ id: 't3', name: 'id' }),
    createTerm({ id: 't4', name: '가입' }),
    createTerm({ id: 't5', name: '회원 등급' }),
  ]);

  it('gives the terms whose names start with what is typed, in any case or form', () => {
    expect(idsOf(completeTerms(index, 'i'))).toEqual(['t2', 't3']);
    expect(idsOf(completeTerms(index, 'I'))).toEqual(['t2', 't3']);
    expect(idsOf(completeTerms(index, '가'))).toEqual(['t4']);
    expect(idsOf(completeTerms(index, ' 회원'))).toEqual(['t5', 't1']);
    expect(idsOf(completeTerms(index, '회원 '))).toEqual(['t5']);
  });

  it('gives nothing for an empty prefix, one no name starts with, or no room', () => {
    expect(completeTerms(index, '')).toEqual([]);
    expect(completeTerms(index, '   ')).toEqual([]);
    expect(completeTerms(index, '회원번호이')).toEqual([]);
    expect(completeTerms(index, '회원', 0)).toEqual([]);
    expect(idsOf(completeTerms(index, '회원', 1))).toEqual(['t5']);
    expect(completeTerms(buildTermIndex([]), '회원')).toEqual([]);
  });

  it('gives at most eight terms, the first in key order', () => {
    const many = buildTermIndex(
      Array.from({ length: 20 }, (_, position) =>
        createTerm({ id: `t${position + 1}`, name: `회원${position + 1}` })
      )
    );

    expect(TERM_COMPLETION_LIMIT).toBe(8);
    expect(completeTerms(many, '회원').map(({ name }) => name)).toEqual([
      '회원1',
      '회원10',
      '회원11',
      '회원12',
      '회원13',
      '회원14',
      '회원15',
      '회원16',
    ]);
  });
});

describe('the term index over a public standard sheet', () => {
  it('builds once over a hundred queries on 13,176 terms, each reading at most 24 keys', () => {
    const next = random(20_261_020);
    const names = syntheticTermNames(13_176, next);
    const store = newStore();
    store.dispatchSync(
      ...names.map((name, position) =>
        addDictionaryAction({
          kind: 'term',
          id: `t${position}`,
          values: { name },
        })
      )
    );

    const built = new Set<TermIndex>();
    const sorted = [...names].sort();
    let most = 0;

    for (let query = 0; query < 100; query++) {
      const index = getTermIndex(store.state);
      built.add(index);

      const name = names[next(names.length)];
      const typed =
        query % 10 === 9 ? `${name}없음` : name.slice(0, 1 + next(3));
      const counted = countComparisons(index);
      const found = completeTerms(counted.index, typed).map(({ name }) => name);
      const reads = counted.take();
      most = Math.max(most, reads);

      expect(found).toEqual(
        sorted.filter(each => each.startsWith(typed)).slice(0, 8)
      );
      expect(reads).toBeLessThanOrEqual(24);
    }

    expect(store.state.doc.termIds).toHaveLength(13_176);
    expect(getTermIndex(store.state).keys).toHaveLength(13_176);
    expect(built.size).toBe(1);
    expect(most).toBeGreaterThan(14);
  });

  it('builds again only once the term sheet is written', () => {
    const store = newStore();
    store.dispatchSync(
      addDictionaryAction({ kind: 'term', id: 't1', values: { name: '회원' } })
    );
    const first = getTermIndex(store.state);

    store.dispatchSync(
      addDictionaryAction({ kind: 'word', id: 'w1', values: { name: '회원' } }),
      addTableAction({ id: 'table', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    expect(getTermIndex(store.state)).toBe(first);

    store.dispatchSync(
      addDictionaryAction({
        kind: 'term',
        id: 't2',
        values: { name: '회원번호' },
      })
    );
    const second = getTermIndex(store.state);
    expect(second).not.toBe(first);
    expect(idsOf(completeTerms(second, '회원'))).toEqual(['t1', 't2']);

    raiseDictionaryGeneration(store.state, 'term');
    expect(getTermIndex(store.state)).not.toBe(second);
  });
});
