import { describe, expect, it } from 'vite-plus/test';

import { findAll, findChunks } from '@/utils/highlightWords';

// Positions: 01234567890123456789012345678901234567
const TEXT = 'This is a string with words to search.';

/** The parts of the text the words light, through findAll. */
const lit = (textToHighlight: string, searchWords: string[]) =>
  findAll({ searchWords, textToHighlight })
    .filter(chunk => chunk.highlight)
    .map(({ start, end }) => textToHighlight.slice(start, end));

describe('findChunks', () => {
  it('finds every occurrence of a word in any letter case, in order', () => {
    expect(findChunks({ searchWords: ['th'], textToHighlight: TEXT })).toEqual([
      { start: 0, end: 2 },
      { start: 19, end: 21 },
    ]);
  });

  it('lists the words one after the other, overlaps and all', () => {
    expect(
      findChunks({ searchWords: ['is', 'thi'], textToHighlight: TEXT })
    ).toEqual([
      { start: 2, end: 4 },
      { start: 5, end: 7 },
      { start: 0, end: 3 },
    ]);
  });

  it('finds a word again only past its last occurrence', () => {
    expect(
      findChunks({ searchWords: ['aa'], textToHighlight: 'aaaaa' })
    ).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
  });

  it('matches only the letter case typed when caseSensitive', () => {
    expect(
      findChunks({
        searchWords: ['t'],
        textToHighlight: TEXT,
        caseSensitive: true,
      })
    ).toEqual([
      { start: 11, end: 12 },
      { start: 19, end: 20 },
      { start: 28, end: 29 },
    ]);
    expect(
      findChunks({
        searchWords: ['T'],
        textToHighlight: TEXT,
        caseSensitive: true,
      })
    ).toEqual([{ start: 0, end: 1 }]);
  });

  it('reads an unclosed parenthesis as typed', () => {
    expect(
      findChunks({ searchWords: ['text)'], textToHighlight: '(This is text)' })
    ).toEqual([{ start: 9, end: 14 }]);
  });

  it('reads every character a regular expression gives a meaning as typed', () => {
    // Each of these once, one to a position, from 1 on.
    const special = '-[]/{}()*+?.\\^$|';
    const text = `x${special}x`;
    [...special].forEach((word, index) => {
      expect(
        findChunks({ searchWords: [word], textToHighlight: text })
      ).toEqual([{ start: index + 1, end: index + 2 }]);
    });
    expect(
      findChunks({
        searchWords: ['[a-z]', '.*', 'w?', '\\d'],
        textToHighlight: 'abc',
      })
    ).toEqual([]);
    expect(
      findChunks({
        searchWords: ['.*', '\\d', '[a-z]'],
        textToHighlight: 'a.*b\\d[a-z]',
      })
    ).toEqual([
      { start: 1, end: 3 },
      { start: 4, end: 6 },
      { start: 6, end: 11 },
    ]);
  });

  it('folds letter case as a regular expression without the u flag does, never from beyond ASCII onto it', () => {
    expect(findChunks({ searchWords: ['é'], textToHighlight: 'CAFÉ' })).toEqual(
      [{ start: 3, end: 4 }]
    );
    // Read with Unicode case folding, ſ and the Kelvin sign would light these.
    expect(findChunks({ searchWords: ['s'], textToHighlight: 'ſ' })).toEqual(
      []
    );
    expect(
      findChunks({ searchWords: ['k'], textToHighlight: '\u212a' })
    ).toEqual([]);
  });

  it('drops an empty word', () => {
    expect(
      findChunks({ searchWords: ['', 'th', ''], textToHighlight: TEXT })
    ).toEqual([
      { start: 0, end: 2 },
      { start: 19, end: 21 },
    ]);
    expect(findChunks({ searchWords: [''], textToHighlight: TEXT })).toEqual(
      []
    );
    expect(findChunks({ searchWords: [], textToHighlight: TEXT })).toEqual([]);
  });
});

describe('findAll', () => {
  it('has no chunk for an empty text', () => {
    expect(findAll({ searchWords: ['search'], textToHighlight: '' })).toEqual(
      []
    );
  });

  it('chunks the whole text end to end, words that overlap lit as one', () => {
    expect(
      findAll({ searchWords: ['thi', 'is'], textToHighlight: TEXT })
    ).toEqual([
      { start: 0, end: 4, highlight: true },
      { start: 4, end: 5, highlight: false },
      { start: 5, end: 7, highlight: true },
      { start: 7, end: 38, highlight: false },
    ]);
  });

  it('lights words that touch as one chunk', () => {
    expect(
      findAll({ searchWords: ['ab', 'cd'], textToHighlight: 'abcde' })
    ).toEqual([
      { start: 0, end: 4, highlight: true },
      { start: 4, end: 5, highlight: false },
    ]);
    expect(lit('aaaaa', ['aa'])).toEqual(['aaaa']);
  });

  it('keeps the whole text plain when no word matches', () => {
    expect(findAll({ searchWords: ['zebra'], textToHighlight: TEXT })).toEqual([
      { start: 0, end: 38, highlight: false },
    ]);
    expect(findAll({ searchWords: [], textToHighlight: TEXT })).toEqual([
      { start: 0, end: 38, highlight: false },
    ]);
  });

  it('passes caseSensitive on to the words', () => {
    expect(lit(TEXT, ['this'])).toEqual(['This']);
    expect(
      findAll({
        searchWords: ['this'],
        textToHighlight: TEXT,
        caseSensitive: true,
      })
    ).toEqual([{ start: 0, end: 38, highlight: false }]);
  });

  it('lights what a findChunks of its own finds, given the words and the text', () => {
    const seen: unknown[] = [];
    const chunks = findAll({
      searchWords: ['xxx'],
      textToHighlight: TEXT,
      caseSensitive: true,
      findChunks: args => {
        seen.push(args);
        return [{ start: 1, end: 3 }];
      },
    });

    expect(chunks).toEqual([
      { start: 0, end: 1, highlight: false },
      { start: 1, end: 3, highlight: true },
      { start: 3, end: 38, highlight: false },
    ]);
    expect(seen).toEqual([
      { searchWords: ['xxx'], textToHighlight: TEXT, caseSensitive: true },
    ]);
    expect(
      findAll({
        searchWords: ['This'],
        textToHighlight: TEXT,
        findChunks: () => [],
      })
    ).toEqual([{ start: 0, end: 38, highlight: false }]);
  });

  it('sorts the ranges a findChunks returns and merges those that overlap, touch or nest', () => {
    const ranges = [
      { start: 30, end: 38 },
      { start: 6, end: 8 },
      { start: 1, end: 3 },
      { start: 2, end: 4 },
      { start: 4, end: 5 },
      { start: 10, end: 20 },
      { start: 12, end: 14 },
    ];

    expect(
      findAll({
        searchWords: [],
        textToHighlight: TEXT,
        findChunks: () => ranges,
      })
    ).toEqual([
      { start: 0, end: 1, highlight: false },
      { start: 1, end: 5, highlight: true },
      { start: 5, end: 6, highlight: false },
      { start: 6, end: 8, highlight: true },
      { start: 8, end: 10, highlight: false },
      { start: 10, end: 20, highlight: true },
      { start: 20, end: 30, highlight: false },
      { start: 30, end: 38, highlight: true },
    ]);
    expect(ranges[0]).toEqual({ start: 30, end: 38 });
  });

  it('starts and ends on a lit chunk where a word opens or closes the text', () => {
    expect(lit(TEXT, ['this', 'search.'])).toEqual(['This', 'search.']);
    expect(findAll({ searchWords: ['abc'], textToHighlight: 'abc' })).toEqual([
      { start: 0, end: 3, highlight: true },
    ]);
  });
});
