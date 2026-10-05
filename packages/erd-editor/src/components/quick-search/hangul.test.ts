import { disassemble, getChoseong } from 'es-hangul';
import { findAll } from 'highlight-words-core';
import { describe, expect, it } from 'vite-plus/test';

import {
  clearHangulForms,
  findPaletteChunks,
  hangulFormsOf,
  HangulQuery,
  hangulQueryOf,
  hangulRanges,
  HangulTier,
  hangulTier,
  hitRange,
  matchText,
  rankHits,
  TextHit,
} from '@/components/quick-search/hangul';
import { createMatcher, DEFAULT_FIND_OPTIONS } from '@/utils/find-replace';

const queryOf = (keyword: string): HangulQuery => {
  const query = hangulQueryOf(keyword);
  if (!query) throw new Error(`no Hangul in ${keyword}`);
  return query;
};

/** The parts of a text the ranges cover, which is what a reader sees lit. */
const covered = (text: string, keyword: string) =>
  hangulRanges(text, queryOf(keyword)).map(({ start, end }) =>
    text.slice(start, end)
  );

const matcherOf = (keyword: string) => {
  const { matcher } = createMatcher(keyword, DEFAULT_FIND_OPTIONS);
  if (!matcher) throw new Error('no matcher');
  return matcher;
};

/** The text as macOS stores a file name, each syllable in conjoining jamo. */
const nfd = (text: string) => text.normalize('NFD');

/** What HighlightedText lights for the words, through the palette's chunks. */
const lit = (text: string, searchWords: string[]) =>
  findAll({
    searchWords,
    textToHighlight: text,
    autoEscape: true,
    findChunks: findPaletteChunks,
  })
    .filter(chunk => chunk.highlight)
    .map(({ start, end }) => text.slice(start, end));

describe('hangulQueryOf', () => {
  it('reads no Hangul search into a keyword without Hangul', () => {
    expect(hangulQueryOf('user')).toBeNull();
    expect(hangulQueryOf('  ')).toBeNull();
    expect(hangulQueryOf('')).toBeNull();
  });

  it('spells the keyword in jamo, and reads a keyword of consonants alone as initials', () => {
    expect(hangulQueryOf('사요')).toEqual({ jamo: 'ㅅㅏㅇㅛ', choseong: null });
    expect(hangulQueryOf(' ㅅㅇㅈ ')).toEqual({
      jamo: 'ㅅㅇㅈ',
      choseong: 'ㅅㅇㅈ',
    });
    // Spaces between the initials are dropped.
    expect(hangulQueryOf('ㅈㅁ ㄴㅇ')?.choseong).toBe('ㅈㅁㄴㅇ');
    // Latin lower-cased beside the Hangul, and a vowel is no initial.
    expect(hangulQueryOf('USER사')).toEqual({
      jamo: 'userㅅㅏ',
      choseong: null,
    });
    expect(hangulQueryOf('ㅅㅏ')?.choseong).toBeNull();
  });

  it('splits a cluster a Windows IME composed of two initials, and keeps a double consonant whole', () => {
    expect(hangulQueryOf('ㅄ')).toEqual({ jamo: 'ㅂㅅ', choseong: 'ㅂㅅ' });
    expect(hangulQueryOf('ㄳ ㄱ')?.choseong).toBe('ㄱㅅㄱ');
    expect(hangulQueryOf('ㄲㅅ')?.choseong).toBe('ㄲㅅ');
  });
});

describe('hangulFormsOf', () => {
  const SAMPLES = [
    '사용자',
    '주문 내역',
    'user사용자',
    'USER_사용자_ID',
    '값 없음',
    'ㄳ과 ㅘ',
    '😀사용 자',
    'Hello World',
    '',
    nfd('사용자'),
    nfd('USER_값 없음'),
    `a${nfd('사')}😀${nfd('용')}`,
    // A final after an open syllable composes; after a closed one it cannot.
    '가\u11a8',
    '각\u11a8',
    `가${nfd('나')}`,
    // An archaic initial composes into no modern syllable.
    '\u1140\u1161',
  ];

  it('spells what disassemble reads of the text composed and what getChoseong reads, clusters split and spaces dropped', () => {
    for (const text of SAMPLES) {
      const forms = hangulFormsOf(text);
      expect(forms.jamo).toBe(disassemble(text.normalize('NFC')).toLowerCase());
      expect(forms.choseong).toBe(
        disassemble(getChoseong(text)).replace(/\s/g, '')
      );
    }
  });

  it('reads a lone conjoining initial as its compatibility letter, as getChoseong does', () => {
    expect(hangulFormsOf('\u1109')).toEqual({ jamo: 'ㅅ', choseong: 'ㅅ' });
    expect(getChoseong('\u1109')).toBe('ㅅ');
  });

  it('keeps a text however many others are spelled, until the forms are cleared', () => {
    const first = hangulFormsOf('캐시 확인');
    expect(hangulFormsOf('캐시 확인')).toBe(first);

    // More texts than a document of a thousand tables of thirty columns holds.
    for (let index = 0; index < 120_000; index++) {
      hangulFormsOf(`가${index}`);
    }
    expect(hangulFormsOf('캐시 확인')).toBe(first);

    clearHangulForms();
    const again = hangulFormsOf('캐시 확인');
    expect(again).not.toBe(first);
    expect(again).toEqual(first);
    clearHangulForms();
  });
});

describe('hangulTier', () => {
  it('holds every step a Korean IME hands over while composing 사용', () => {
    for (const step of ['ㅅ', '사', '상', '사요', '사용', '사용자']) {
      expect(hangulTier('사용자', queryOf(step))).not.toBeNull();
    }
    expect(hangulTier('사용자', queryOf('사용자'))).toBe(HangulTier.exact);
    expect(hangulTier('사용자', queryOf('상'))).toBe(HangulTier.prefix);
    expect(hangulTier('주문한 사용자', queryOf('사요'))).toBe(
      HangulTier.inside
    );
  });

  it('holds a keyword of initials by the initials of the syllables', () => {
    expect(hangulTier('사용자', queryOf('ㅅㅇㅈ'))).toBe(HangulTier.exact);
    expect(hangulTier('사용자', queryOf('ㅅ'))).toBe(HangulTier.prefix);
    expect(hangulTier('주문 내역', queryOf('ㅈㅁ'))).toBe(HangulTier.prefix);
    expect(hangulTier('주문 내역', queryOf('ㅈㅁ ㄴㅇ'))).toBe(
      HangulTier.exact
    );
    expect(hangulTier('주문 내역', queryOf('ㅈㅁㄴㅇ'))).toBe(HangulTier.exact);
    expect(hangulTier('상품 주문', queryOf('ㅈㅁ'))).toBe(HangulTier.inside);
    expect(hangulTier('사용자', queryOf('ㅇㅅ'))).toBeNull();
  });

  it('takes the closer of the two readings', () => {
    // ㅅ is all of 사's initials, and only the start of its jamo.
    expect(hangulTier('사', queryOf('ㅅ'))).toBe(HangulTier.exact);
    // A compound consonant is one initial, and two jamo.
    expect(hangulTier('ㄳ', queryOf('ㄱㅅ'))).toBe(HangulTier.exact);
    expect(hangulTier('ㄳㄱㅅ', queryOf('ㄱㅅ'))).toBe(HangulTier.prefix);
  });

  it('holds every value a Windows IME hands over while the initials of a name are typed', () => {
    const typed: Array<[string, string[]]> = [
      ['부서', ['ㅂ', 'ㅄ']],
      ['배송지', ['ㅂ', 'ㅄ', 'ㅄㅈ']],
      ['검색 기록', ['ㄱ', 'ㄳ', 'ㄳㄱ', 'ㄳㄱㄹ']],
      ['로그', ['ㄹ', 'ㄺ']],
      ['가상', ['ㄱ', 'ㄳ']],
      ['방식', ['ㅂ', 'ㅄ']],
    ];

    for (const [text, steps] of typed) {
      for (const step of steps) {
        expect(hangulTier(text, queryOf(step))).not.toBeNull();
      }
    }
    expect(hangulTier('부서', queryOf('ㅄ'))).toBe(HangulTier.exact);
    expect(hangulTier('검색 기록', queryOf('ㄳㄱㄹ'))).toBe(HangulTier.exact);
    // A text's own cluster holds the pair and the cluster alike.
    expect(hangulTier('ㄳ', queryOf('ㄳ'))).toBe(HangulTier.exact);
  });

  it('holds a decomposed text as its composed twin', () => {
    for (const keyword of ['ㅅㅇㅈ', '상', '사용자']) {
      expect(hangulTier(nfd('사용자'), queryOf(keyword))).toBe(
        hangulTier('사용자', queryOf(keyword))
      );
    }
    expect(hangulTier(nfd('사용자'), queryOf('ㅅㅇㅈ'))).toBe(HangulTier.exact);
  });

  it('holds Hangul after Latin, in any case', () => {
    expect(hangulTier('user사용자', queryOf('user사'))).toBe(HangulTier.prefix);
    expect(hangulTier('User사용자', queryOf('user사'))).toBe(HangulTier.prefix);
    expect(hangulTier('user사용자', queryOf('users사'))).toBeNull();
  });

  it('finds nothing in a text without Hangul', () => {
    expect(hangulTier('users', queryOf('사'))).toBeNull();
    expect(hangulTier('', queryOf('ㅅ'))).toBeNull();
  });
});

describe('hangulRanges', () => {
  it('covers whole syllables, however far into one a jamo reaches', () => {
    expect(covered('사용자', '사')).toEqual(['사']);
    expect(covered('사용자', '상')).toEqual(['사용']);
    expect(covered('사용자', '사요')).toEqual(['사용']);
    expect(covered('주문한 사용자', 'ㅅㅇㅈ')).toEqual(['사용자']);
  });

  it('covers the initials across the spaces and letters between them', () => {
    expect(covered('주문 내역', 'ㅈㅁㄴㅇ')).toEqual(['주문 내역']);
    expect(covered('사a용', 'ㅅㅇ')).toEqual(['사a용']);
  });

  it('lists every place in order, by jamo and by initials', () => {
    expect(covered('사용자와 사용자', '사용')).toEqual(['사용', '사용']);
    expect(
      hangulRanges('사용 상품', queryOf('ㅅ')).map(({ start }) => start)
    ).toEqual([0, 0, 3, 3]);
  });

  it('keeps to the text around letters of two code units or a longer lower case', () => {
    expect(covered('😀사용자', 'ㅅㅇ')).toEqual(['사용']);
    expect(covered('사😀용', 'ㅅㅇ')).toEqual(['사😀용']);
    expect(covered('İ사용', '사')).toEqual(['사']);
    expect(covered('user😀사', 'user😀사')).toEqual(['user😀사']);
  });

  it('covers a lone cluster and the syllables after it', () => {
    expect(covered('ㄳ과', 'ㅅㄱ')).toEqual(['ㄳ과', 'ㄳ과']);
    expect(covered('검색 기록', 'ㄳㄱ')).toEqual(['검색 기']);
  });

  it('covers every jamo of a decomposed syllable, never part of one', () => {
    expect(covered(nfd('사용자'), '상')).toEqual([nfd('사용')]);
    expect(covered(nfd('주문 내역'), 'ㅈㅁㄴㅇ')).toEqual([nfd('주문 내역')]);
    const mixed = `a${nfd('사')}😀${nfd('용')}`;
    expect(covered(mixed, 'ㅅㅇ')).toEqual([`${nfd('사')}😀${nfd('용')}`]);
  });

  it('finds nothing in a text without Hangul', () => {
    expect(hangulRanges('users', queryOf('사'))).toEqual([]);
  });
});

describe('matchText', () => {
  it('prefers the keyword as typed, which the panel finds too', () => {
    expect(
      matchText('주문한 사용자', matcherOf('사용'), queryOf('사용'))
    ).toEqual({ start: 4, end: 6, literal: true });
  });

  it('falls back on the Hangul letters, which only the palette reads', () => {
    expect(
      matchText('주문한 사용자', matcherOf('사요'), queryOf('사요'))
    ).toEqual({ literal: false, tier: HangulTier.inside });
    expect(matchText('사용자', matcherOf('ㅅㅇㅈ'), queryOf('ㅅㅇㅈ'))).toEqual(
      { literal: false, tier: HangulTier.exact }
    );
  });

  it('holds nothing without a Hangul keyword or a Hangul hit', () => {
    expect(matchText('users', matcherOf('xyz'), null)).toBeNull();
    expect(matchText('사용자', matcherOf('주'), queryOf('주'))).toBeNull();
  });
});

describe('hitRange', () => {
  /** Where the hit for a keyword lies, as the text it covers. */
  const coveredBy = (text: string, keyword: string) => {
    const hangul = hangulQueryOf(keyword);
    const hit = matchText(text, matcherOf(keyword), hangul);
    if (!hit) throw new Error(`${keyword} is not in ${text}`);
    const { start, end } = hitRange(text, hit, hangul);
    return text.slice(start, end);
  };

  it('lies where the keyword is as typed', () => {
    expect(coveredBy('주문한 사용자', '사용')).toBe('사용');
    expect(coveredBy('users.email', 'EMAIL')).toBe('email');
  });

  it('lies on the first syllables the Hangul letters spell, as the highlight does', () => {
    expect(coveredBy('주문한 사용자', '사요')).toBe('사용');
    expect(coveredBy('사용자 사용', '상')).toBe('사용');
    expect(coveredBy('주문 내역.사용자', 'ㅅㅇㅈ')).toBe('사용자');
    expect(coveredBy(nfd('사용자'), '상')).toBe(nfd('사용'));
  });
});

describe('rankHits', () => {
  const hitOf = (name: string, hit: TextHit) => ({ name, hit });
  const typed = (name: string) =>
    hitOf(name, { start: 0, end: 1, literal: true });
  const spelled = (name: string, tier: HangulTier) =>
    hitOf(name, { literal: false, tier });

  it('puts the hits as typed first as they came, then the spelled ones closest first', () => {
    const hits = [
      spelled('inside', HangulTier.inside),
      typed('typed 1'),
      spelled('prefix 1', HangulTier.prefix),
      spelled('exact', HangulTier.exact),
      typed('typed 2'),
      spelled('prefix 2', HangulTier.prefix),
    ];

    expect(rankHits(hits).map(({ name }) => name)).toEqual([
      'typed 1',
      'typed 2',
      'exact',
      'prefix 1',
      'prefix 2',
      'inside',
    ]);
    expect(hits[0].name).toBe('inside');
  });
});

describe('findPaletteChunks', () => {
  it('lights what the words match as typed, as HighlightedText always has', () => {
    expect(lit('the dog and the cat', ['the'])).toEqual(['the', 'the']);
    expect(lit('users.email · Column', ['em', 'users'])).toEqual([
      'users',
      'em',
    ]);
  });

  it('lights the syllables a Hangul word spells, merged with what it matches as typed', () => {
    expect(lit('사용자', ['상'])).toEqual(['사용']);
    expect(lit('주문 내역.사용자 · Column', ['ㅅㅇㅈ'])).toEqual(['사용자']);
    expect(lit('user사용자', ['user사'])).toEqual(['user사']);
    expect(lit('사용자 사용', ['사용'])).toEqual(['사용', '사용']);
    expect(lit('😀사용 İ자', ['ㅅㅇ', 'ㅈ'])).toEqual(['사용', '자']);
    expect(lit(nfd('사용자'), ['상'])).toEqual([nfd('사용')]);
  });
});
