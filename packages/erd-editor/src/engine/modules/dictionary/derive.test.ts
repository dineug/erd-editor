import { describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import {
  addDictionaryAction,
  removeDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import {
  compose,
  composeName,
  decompose,
  derivePhysical,
  splitNameUnits,
  WordToken,
} from '@/engine/modules/dictionary/derive';
import { buildWordIndex } from '@/engine/modules/dictionary/dictionaryIndex';
import { createStore } from '@/engine/store';
import { DeepPartial, Word } from '@/internal-types';
import { createWord } from '@/utils/collection/word.entity';

const indexOf = (...words: Array<DeepPartial<Word>>) =>
  buildWordIndex(
    words.map((word, position) => createWord({ id: `w${position}`, ...word }))
  );

/** Each token as its text and kind, with the names of the words it reads as. */
const read = (tokens: WordToken[]) =>
  tokens.map(({ text, kind, words }) => [
    text,
    kind,
    words.map(({ name }) => name),
  ]);

const newStore = () =>
  createStore({ toWidth: text => text.length, clock: new Clock() }, false);

describe('splitNameUnits', () => {
  it('splits at blanks, underscores, hyphens, middle dots and slashes', () => {
    expect(splitNameUnits(' 회원  가입_일자-코드·번호/명\t여부 ')).toEqual([
      '회원',
      '가입',
      '일자',
      '코드',
      '번호',
      '명',
      '여부',
    ]);
    expect(splitNameUnits('__ - ')).toEqual([]);
    expect(splitNameUnits('가입')).toEqual(['가입']);
  });
});

describe('decompose', () => {
  const index = indexOf(
    { name: '회원', abbreviation: 'MBR' },
    { name: '가입', abbreviation: 'JOIN' },
    { name: '가입일', abbreviation: 'JOIN_DT' },
    { name: '일자', abbreviation: 'DT' }
  );

  it('takes the longest word from the left', () => {
    expect(read(decompose(index, '회원가입일'))).toEqual([
      ['회원', 'word', ['회원']],
      ['가입일', 'word', ['가입일']],
    ]);
  });

  it('never goes back, so a longer word can leave a stretch no word matches', () => {
    expect(read(decompose(index, '가입일자'))).toEqual([
      ['가입일', 'word', ['가입일']],
      ['자', 'unregistered', []],
    ]);
  });

  it('reads each unit on its own, so no word crosses a separator', () => {
    expect(read(decompose(index, '가입 일자'))).toEqual([
      ['가입', 'word', ['가입']],
      ['일자', 'word', ['일자']],
    ]);
    expect(read(decompose(index, '가입일_자'))).toEqual([
      ['가입일', 'word', ['가입일']],
      ['자', 'unregistered', []],
    ]);
  });

  it('joins what no word matches into one stretch, up to the next word', () => {
    expect(read(decompose(index, 'XY회원ZZ일자Q'))).toEqual([
      ['XY', 'unregistered', []],
      ['회원', 'word', ['회원']],
      ['ZZ', 'unregistered', []],
      ['일자', 'word', ['일자']],
      ['Q', 'unregistered', []],
    ]);
  });

  it('compares the case as typed', () => {
    const latin = indexOf({ name: 'Member', abbreviation: 'MBR' });

    expect(read(decompose(latin, 'member'))).toEqual([
      ['member', 'unregistered', []],
    ]);
  });

  it('reads a synonym or a forbidden word as the words that list it', () => {
    const marked = indexOf(
      {
        name: '고객',
        abbreviation: 'CUST',
        synonyms: '손님',
        forbiddenWords: '커스터머',
      },
      { name: '번호', abbreviation: 'NO' }
    );

    expect(read(decompose(marked, '손님번호'))).toEqual([
      ['손님', 'synonym', ['고객']],
      ['번호', 'word', ['번호']],
    ]);
    expect(read(decompose(marked, '커스터머번호'))).toEqual([
      ['커스터머', 'forbidden', ['고객']],
      ['번호', 'word', ['번호']],
    ]);
  });

  it('takes the longest marked text of any kind, a word first, then a forbidden word', () => {
    const marked = indexOf(
      { name: '가입일', abbreviation: 'JOIN_DT', forbiddenWords: '가입일자' },
      { name: '번호', abbreviation: 'NO', synonyms: '넘버' },
      { name: '넘버', abbreviation: 'NUM' },
      { name: '코드', abbreviation: 'CD', synonyms: '부호' },
      { name: '기호', abbreviation: 'SYM', forbiddenWords: '부호' }
    );

    expect(read(decompose(marked, '가입일자'))).toEqual([
      ['가입일자', 'forbidden', ['가입일']],
    ]);
    expect(read(decompose(marked, '넘버'))).toEqual([
      ['넘버', 'word', ['넘버']],
    ]);
    expect(read(decompose(marked, '부호'))).toEqual([
      ['부호', 'forbidden', ['기호']],
    ]);
  });

  it('reads every text as unregistered with no word listed', () => {
    expect(read(decompose(indexOf(), '회원'))).toEqual([
      ['회원', 'unregistered', []],
    ]);
  });
});

describe('compose', () => {
  const index = indexOf(
    { name: '회원', abbreviation: 'Mbr' },
    { name: '번호', abbreviation: ' NO ' },
    { name: '이름' },
    { name: '고객', abbreviation: 'CUST', synonyms: '손님' },
    { name: '회원', abbreviation: 'MEMBER' }
  );

  it('joins the abbreviations with underscores in their case as typed, trimmed', () => {
    expect(compose(decompose(index, '회원번호'))).toBe('Mbr_NO');
  });

  it('puts no bound on the length', () => {
    const name = '회원'.repeat(80);

    expect(compose(decompose(index, name))).toBe(
      Array.from({ length: 80 }, () => 'Mbr').join('_')
    );
  });

  it('gives null for a stretch that is no standard word, or a word with no abbreviation', () => {
    expect(compose(decompose(index, '손님번호'))).toBeNull();
    expect(compose(decompose(index, '회원XY'))).toBeNull();
    expect(compose(decompose(index, '회원이름'))).toBeNull();
    expect(compose([])).toBeNull();
  });
});

describe('composeName', () => {
  it('composes from the listed words and nothing with none listed', () => {
    const store = newStore();
    expect(composeName(store.state, '회원번호')).toBeNull();

    store.dispatchSync(
      addDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { name: '회원', abbreviation: 'MBR' },
      }),
      addDictionaryAction({
        kind: 'word',
        id: 'w2',
        values: { name: '번호', abbreviation: 'NO' },
      })
    );

    expect(composeName(store.state, '회원 번호')).toBe('MBR_NO');
    expect(composeName(store.state, '회원명')).toBeNull();
  });
});

describe('derivePhysical', () => {
  function seed() {
    const store = newStore();
    store.dispatchSync(
      addDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { name: '회원', abbreviation: 'MBR' },
      }),
      addDictionaryAction({
        kind: 'word',
        id: 'w2',
        values: { name: '번호', abbreviation: 'NO' },
      }),
      addDictionaryAction({
        kind: 'word',
        id: 'w3',
        values: { name: '이름', abbreviation: 'NM' },
      }),
      addDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { name: '번호N10', dataType: 'NUMERIC(10)' },
      }),
      addDictionaryAction({
        kind: 'term',
        id: 't1',
        values: { name: '회원번호', physicalName: 'MEMBER_NO', domainId: 'd1' },
      }),
      addDictionaryAction({
        kind: 'term',
        id: 't2',
        values: { name: '회원이름' },
      }),
      addDictionaryAction({
        kind: 'term',
        id: 't3',
        values: { name: '가입경로', domainId: 'gone' },
      })
    );
    return store;
  }

  it('takes the matched term first, its physical name and its domain', () => {
    const store = seed();

    expect(derivePhysical(store.state, ' 회원번호 ')).toEqual({
      physicalName: 'MEMBER_NO',
      domainId: 'd1',
      term: store.state.collections.termEntities.t1,
    });
  });

  it('composes the physical name of a term that holds none', () => {
    const store = seed();

    expect(derivePhysical(store.state, '회원이름')).toMatchObject({
      physicalName: 'MBR_NM',
      domainId: '',
    });
  });

  it('gives a term no physical name where the words compose none, and no domain it does not list', () => {
    const store = seed();

    expect(derivePhysical(store.state, '가입경로')).toEqual({
      physicalName: '',
      domainId: '',
      term: store.state.collections.termEntities.t3,
    });

    store.dispatchSync(removeDictionaryAction({ kind: 'domain', id: 'd1' }));
    expect(derivePhysical(store.state, '회원번호')?.domainId).toBe('');
  });

  it('composes from the words without a term, and gives null where they compose nothing', () => {
    const store = seed();

    expect(derivePhysical(store.state, '회원 이름 번호')).toEqual({
      physicalName: 'MBR_NM_NO',
      domainId: '',
      term: null,
    });
    expect(derivePhysical(store.state, '회원주소')).toBeNull();
    expect(derivePhysical(store.state, '  ')).toBeNull();
  });

  it('matches no removed term, and compares a term name in its case', () => {
    const store = seed();
    store.dispatchSync(removeDictionaryAction({ kind: 'term', id: 't1' }));

    expect(derivePhysical(store.state, '회원번호')).toEqual({
      physicalName: 'MBR_NO',
      domainId: '',
      term: null,
    });

    store.dispatchSync(
      addDictionaryAction({
        kind: 'term',
        id: 't4',
        values: { name: 'Member', physicalName: 'MEMBER' },
      })
    );
    expect(derivePhysical(store.state, 'member')).toBeNull();
    expect(derivePhysical(store.state, 'Member')?.physicalName).toBe('MEMBER');
  });

  it('skips the terms with none listed and composes nothing with no word listed', () => {
    const words = newStore();
    words.dispatchSync(
      addDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { name: '회원', abbreviation: 'MBR' },
      })
    );
    expect(derivePhysical(words.state, '회원')?.physicalName).toBe('MBR');

    const terms = newStore();
    terms.dispatchSync(
      addDictionaryAction({
        kind: 'term',
        id: 't1',
        values: { name: '회원' },
      })
    );
    expect(derivePhysical(terms.state, '회원')).toMatchObject({
      physicalName: '',
      domainId: '',
    });
    expect(derivePhysical(terms.state, '고객')).toBeNull();
    expect(derivePhysical(newStore().state, '회원')).toBeNull();
  });
});
